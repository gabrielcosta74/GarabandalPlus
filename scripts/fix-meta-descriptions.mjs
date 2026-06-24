/**
 * Rewrite over-length CMS meta descriptions into compelling ~150-char SEO
 * snippets, in the row's own language (PT/EN/ES/FR), via OpenAI gpt-4o-mini.
 *
 * Only touches rows whose meta_description exceeds MAX_OK chars; the body
 * (content_html) is never modified. Dry-run by default; pass --commit to write.
 *
 * Usage:
 *   node --env-file=.env scripts/fix-meta-descriptions.mjs --limit=5          # dry preview
 *   node --env-file=.env scripts/fix-meta-descriptions.mjs --commit           # rewrite all
 *   node --env-file=.env scripts/fix-meta-descriptions.mjs --locale=fr --commit
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

function loadEnv() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.OPENAI_API_KEY) return;
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing Supabase env'); process.exit(1); }
if (!OPENAI_KEY) { console.error('Missing OPENAI_API_KEY'); process.exit(1); }

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const LIMIT = args.limit ? parseInt(args.limit, 10) : Infinity;
const COMMIT = Boolean(args.commit);
const ONLY_LOCALE = typeof args.locale === 'string' ? args.locale : null;
const MAX_OK = 160;       // anything longer is rewritten
const TARGET_MAX = 158;   // hard cap for the rewrite

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const LOCALE_LABEL = { pt: 'European Portuguese', en: 'English', es: 'European Spanish', fr: 'French' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openai(system, user, attempt = 0) {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (res.status === 429 || res.status >= 500) throw new Error(`OpenAI ${res.status}`);
    if (!res.ok) throw Object.assign(new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`), { fatal: true });
    const data = await res.json();
    return (data.choices?.[0]?.message?.content ?? '').trim().replace(/^["']|["']$/g, '');
  } catch (e) {
    if (e.fatal || attempt >= 5) throw e;
    await sleep(1000 * Math.pow(2, attempt) + Math.random() * 500);
    return openai(system, user, attempt + 1);
  }
}

// Hard-trim fallback at a word boundary so we never exceed the cap.
function trimToBoundary(text, max = TARGET_MAX) {
  if (text.length <= max) return text;
  let t = text.slice(0, max);
  const cut = t.lastIndexOf(' ');
  if (cut > 80) t = t.slice(0, cut);
  return t.replace(/[\s,;:.\-–—]+$/u, '');
}

async function rewriteMeta(lang, title, current) {
  const system = `You write concise, compelling SEO meta descriptions in ${lang}. `
    + `Rewrite the description into a SINGLE sentence of AT MOST ${TARGET_MAX} characters (ideally 140-155). `
    + `Keep the key topic and proper nouns (Garabandal, Conchita, Mari Loli, Jacinta, Padre Pio, Our Lady). `
    + `Make it accurate to the title, natural and click-worthy. Output ONLY the description — no quotes, no label.`;
  const user = `Title: ${title || '(none)'}\n\nCurrent description (too long):\n${current}`;
  let out = await openai(system, user);
  out = out.replace(/\s+/g, ' ').trim();
  if (out.length > MAX_OK) out = trimToBoundary(out);
  return out;
}

async function run() {
  console.log(`\n${COMMIT ? '🟢 COMMIT' : '🟡 DRY-RUN'} | rewrite meta_description > ${MAX_OK} chars${ONLY_LOCALE ? ` | locale=${ONLY_LOCALE}` : ''} | limit=${LIMIT === Infinity ? 'all' : LIMIT}\n`);
  let done = 0, failed = 0;
  for (const [type, table] of [['page', 'wp_pages'], ['post', 'posts']]) {
    let q = supabase.from(table).select('id, locale, title, meta_description');
    if (ONLY_LOCALE) q = q.eq('locale', ONLY_LOCALE);
    const { data: rows, error } = await q;
    if (error) { console.error(`${table} read error`, error.message); continue; }
    const over = (rows ?? []).filter((r) => r.meta_description && r.meta_description.length > MAX_OK);
    console.log(`[${table}] ${over.length} over ${MAX_OK} chars${ONLY_LOCALE ? '' : ' (all locales)'}`);
    for (const r of over) {
      if (done >= LIMIT) break;
      try {
        const next = await rewriteMeta(LOCALE_LABEL[r.locale] ?? r.locale, r.title, r.meta_description);
        if (!next || next.length < 40) throw new Error(`bad rewrite (${next.length} chars)`);
        if (COMMIT) {
          const { error: upErr } = await supabase.from(table).update({ meta_description: next }).eq('id', r.id);
          if (upErr) throw upErr;
        }
        console.log(`  ${r.locale} ${table.slice(0, 4)} ${r.meta_description.length}→${next.length}  "${next.slice(0, 80)}${next.length > 80 ? '…' : ''}"`);
        done++;
      } catch (e) {
        failed++;
        console.error(`  ✗ ${r.locale} ${r.id}: ${e.message}`);
      }
    }
    if (done >= LIMIT) break;
  }
  console.log(`\nDone. rewritten=${done} failed=${failed} ${COMMIT ? '(written)' : '(dry-run)'}\n`);
}

run().catch((e) => { console.error(e); process.exit(1); });
