#!/usr/bin/env node
//
// Import an ESP newsletter export (e.g. MailerLite "Subscribers-export-*.csv")
// into public.newsletter_subscribers, which is a *source* for the marketing
// contacts projection (see src/lib/marketing-data.ts).
//
// - Language comes from the "Groups" column (authoritative): Portuguesa=pt,
//   Inglesa=en, Espanhola=es. Multi-group rows resolve pt > en > es.
// - "Email status" routes rows: active -> newsletter_subscribers;
//   bounced / unsubscribed -> marketing_suppression_list (never sent).
// - Dedupe by lowercased email (in-file + upsert on unique email).
//
// Dry-run by default (prints a summary, writes no rows). Pass --apply to write.
//
//   npx tsx scripts/import-newsletter.mjs "/path/Subscribers-export.csv"
//   npx tsx scripts/import-newsletter.mjs "/path/…csv" --apply

import fs from 'node:fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const csvPath = args.find((a) => !a.startsWith('--'));

if (!csvPath) {
  console.error('Usage: npx tsx scripts/import-newsletter.mjs <path-to-csv> [--apply]');
  process.exit(1);
}

// ---- read + repair encoding ------------------------------------------------
let text = fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, '');
// If the file is UTF-8 bytes that were stored as Latin-1 (classic "Ã­"/"Ã§"
// mojibake), re-decode. Detect the tell-tale sequences and fix, up to twice.
for (let i = 0; i < 2; i += 1) {
  if (/Ã[-¿]|Â[ -¿]|â€/.test(text)) {
    text = Buffer.from(text, 'latin1').toString('utf8');
  } else break;
}

// ---- minimal RFC-4180 CSV parser (quotes + embedded newlines) --------------
function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < input.length; i += 1) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c === '\r') {
      // ignore; \n handles the row break
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCsv(text);
const header = rows.shift() || [];
const col = (name) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());

const IDX = {
  email: col('Email'),
  groups: col('Groups'),
  status: col('Email status'),
  location: col('Location'),
  created: col('Created'),
  first: col('First name'),
  last: col('Last name'),
};

// ---- helpers ---------------------------------------------------------------
const normEmail = (v) => {
  const e = String(v || '').trim().toLowerCase();
  return e.includes('@') ? e : null;
};

const languageFromGroups = (groups) => {
  const g = String(groups || '').toLowerCase();
  if (g.includes('portugues')) return 'pt';   // Portuguesa (covers "Fundadores"? no)
  if (g.includes('ingles')) return 'en';       // Inglesa
  if (g.includes('espanhol') || g.includes('española')) return 'es';
  return 'pt'; // Fundadores / empty / self -> default pt
};

const parseLocation = (loc) => {
  const s = String(loc || '').trim();
  if (!s) return { city: null, country: null };
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { city: parts.slice(0, -1).join(', '), country: parts[parts.length - 1] };
  return { city: null, country: parts[0] || null };
};

const parseCreated = (v) => {
  const s = String(v || '').trim();
  if (!s) return null;
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

// ---- build deduped records -------------------------------------------------
const STATUS_RANK = { active: 3, '': 3, bounced: 2, unsubscribed: 1 };
const byEmail = new Map();
let skippedNoEmail = 0;

for (const r of rows) {
  if (!r.length || r.every((c) => !String(c).trim())) continue;
  const email = normEmail(r[IDX.email]);
  if (!email) { skippedNoEmail += 1; continue; }

  const status = String(r[IDX.status] || '').trim().toLowerCase();
  const groups = r[IDX.groups] || '';
  const name = [r[IDX.first], r[IDX.last]].map((s) => String(s || '').trim()).filter(Boolean).join(' ') || null;
  const { city, country } = parseLocation(r[IDX.location]);
  const created = parseCreated(r[IDX.created]);
  const lang = languageFromGroups(groups);

  const prev = byEmail.get(email);
  if (!prev) {
    byEmail.set(email, {
      email, name, language: lang, group_label: groups || null, city, country,
      status, subscribed_at: created, sawUnsub: status === 'unsubscribed',
    });
  } else {
    // Merge duplicates: keep best status, richest name, earliest signup, and an
    // opt-out on ANY row wins (respect unsubscribe even if another list says active).
    if (status === 'unsubscribed') prev.sawUnsub = true;
    if ((STATUS_RANK[status] ?? 0) > (STATUS_RANK[prev.status] ?? 0)) prev.status = status;
    if (name && (!prev.name || name.length > prev.name.length)) prev.name = name;
    if (created && (!prev.subscribed_at || created < prev.subscribed_at)) prev.subscribed_at = created;
    // language: pt > en > es
    const rank = { pt: 3, en: 2, es: 1 };
    if ((rank[lang] ?? 0) > (rank[prev.language] ?? 0)) prev.language = lang;
  }
}

const subscribers = [];
const suppressions = [];
for (const rec of byEmail.values()) {
  if (rec.sawUnsub) {
    suppressions.push({ email: rec.email, reason: 'newsletter_unsubscribed' });
  } else if (rec.status === 'bounced') {
    suppressions.push({ email: rec.email, reason: 'newsletter_bounced' });
  } else {
    subscribers.push(rec);
  }
}

// ---- cross-check against existing data -------------------------------------
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const supabase = createClient(url, key, { auth: { persistSession: false } });

const emails = subscribers.map((s) => s.email);
const existingMemberEmails = new Set();
const existingContactEmails = new Set();
for (let i = 0; i < emails.length; i += 300) {
  const chunk = emails.slice(i, i + 300);
  const [{ data: mem }, { data: con }] = await Promise.all([
    supabase.from('membros').select('email').in('email', chunk),
    supabase.from('marketing_contacts').select('normalized_email').in('normalized_email', chunk),
  ]);
  (mem || []).forEach((m) => m.email && existingMemberEmails.add(String(m.email).toLowerCase()));
  (con || []).forEach((c) => c.normalized_email && existingContactEmails.add(c.normalized_email));
}

const byLang = subscribers.reduce((acc, s) => ((acc[s.language] = (acc[s.language] || 0) + 1), acc), {});
const alreadyMembers = subscribers.filter((s) => existingMemberEmails.has(s.email)).length;
const alreadyContacts = subscribers.filter((s) => existingContactEmails.has(s.email)).length;

console.log('\n=== Newsletter import summary ===');
console.log('CSV rows (excl. header):', rows.length, '| skipped (no email):', skippedNoEmail);
console.log('Unique emails:', byEmail.size);
console.log('-> to import (active):', subscribers.length, JSON.stringify(byLang));
console.log('   of which already members:', alreadyMembers, '| already marketing_contacts:', alreadyContacts,
  '| brand new:', subscribers.length - alreadyContacts);
console.log('-> to suppress:', suppressions.length,
  '(bounced:', suppressions.filter((s) => s.reason === 'newsletter_bounced').length,
  '| unsubscribed:', suppressions.filter((s) => s.reason === 'newsletter_unsubscribed').length, ')');
console.log('ES (held out of funnels):', byLang.es || 0);

if (!apply) {
  console.log('\nDRY RUN — no rows written. Re-run with --apply to write.\n');
  process.exit(0);
}

// ---- write -----------------------------------------------------------------
console.log('\nApplying…');
let up = 0;
for (let i = 0; i < subscribers.length; i += 200) {
  const chunk = subscribers.slice(i, i + 200).map((s) => ({
    normalized_email: s.email,
    display_name: s.name,
    language: s.language,
    group_label: s.group_label,
    country: s.country,
    city: s.city,
    consent_state: 'explicit',
    external_status: s.status || 'active',
    subscribed_at: s.subscribed_at,
    raw: {},
  }));
  const { error } = await supabase.from('newsletter_subscribers').upsert(chunk, { onConflict: 'normalized_email' });
  if (error) { console.error('subscriber upsert failed:', error.message); process.exit(1); }
  up += chunk.length;
}
let sup = 0;
for (let i = 0; i < suppressions.length; i += 200) {
  const chunk = suppressions.slice(i, i + 200).map((s) => ({
    normalized_email: s.email, reason: s.reason, source: 'newsletter_import',
  }));
  const { error } = await supabase.from('marketing_suppression_list').upsert(chunk, { onConflict: 'normalized_email,reason' });
  if (error) { console.error('suppression upsert failed:', error.message); process.exit(1); }
  sup += chunk.length;
}
console.log(`Done. Upserted ${up} subscribers, ${sup} suppressions.`);
console.log('Next: rebuild the projection (buildMarketingContacts) so these appear as marketing_contacts.\n');
