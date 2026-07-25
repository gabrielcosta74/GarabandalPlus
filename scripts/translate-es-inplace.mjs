/**
 * Translate EXISTING Spanish CMS rows that are still raw Portuguese, in place.
 *
 * Many legacy /es rows were seeded as verbatim PT copies (same slug, untranslated
 * body) and never processed by the translate pipeline. This script translates the
 * PT peer (via translation group, falling back to the row's own content) into
 * Spanish and UPDATES the existing ES row — keeping its id, slug and locale, so
 * the live URL is unchanged (no redirect needed). Marks mt_unreviewed=true.
 *
 * SAFETY: dry-run by default. Pass --commit to write.
 *
 * Usage:
 *   node scripts/translate-es-inplace.mjs --slug=<es-slug> --type=page          # dry preview one
 *   node scripts/translate-es-inplace.mjs --slug=<es-slug> --type=page --commit # write one
 *   node scripts/translate-es-inplace.mjs --type=page --all --commit            # all untranslated ES pages
 *   node scripts/translate-es-inplace.mjs --type=post --all --commit            # all untranslated ES posts
 */
import { createClient } from '@supabase/supabase-js';
import DOMPurify from 'isomorphic-dompurify';
import fs from 'node:fs';
import crypto from 'node:crypto';

function loadEnv() {
  const envPath = '.env';
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadEnv();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing Supabase env'); process.exit(1); }
if (!OPENAI_KEY) { console.error('Missing OPENAI_API_KEY'); process.exit(1); }

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const TYPE = args.type === 'post' ? 'post' : 'page';
const TABLE = TYPE === 'page' ? 'wp_pages' : 'posts';
const COMMIT = Boolean(args.commit);
const ALL = Boolean(args.all);
const ONE_SLUG = typeof args.slug === 'string' ? args.slug : null;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ---- sanitize (ported from src/lib/cms/sanitize.ts, same as translate-missing-en) ----
const ALLOWED_TAGS = ['h1','h2','h3','h4','h5','h6','p','br','hr','ul','ol','li','blockquote','strong','b','em','i','u','s','mark','code','a','img','figure','figcaption','table','thead','tbody','tr','td','th','iframe','div','span'];
const ALLOWED_ATTR = ['href','title','rel','target','class','src','alt','width','height','allow','allowfullscreen','frameborder','loading','data-original','colspan','rowspan','data-cms-block','data-variant','data-align','data-columns','data-ratio'];
const ALLOWED_CLASS_RE = /^cms-(block|section|layout|columns|column|callout|quote|media|image|gallery|embed|divider|rule|todo|table|code|align|variant)(-[a-z0-9]+)*$/;
const ALLOWED_DATA_ATTR = {
  'data-cms-block': /^(section|callout|quote|image|gallery|video|columns|divider|table|code|todo|embed)$/,
  'data-variant': /^(info|success|warning|danger|default|gold|line|asterisks|wide|compact)$/,
  'data-align': /^(left|center|right|wide|full)$/,
  'data-columns': /^[2-4]$/,
  'data-ratio': /^(16-9|4-3|1-1|auto)$/,
};
const ALLOWED_IFRAME_HOSTS = ['www.youtube.com','youtube.com','youtu.be','www.youtube-nocookie.com','player.vimeo.com','vimeo.com','w.soundcloud.com','gloria.tv'];
const ALLOWED_IMG_HOSTS_RE = /^https?:\/\/([^/]+\.)?(supabase\.co|clvaw-cdnwnd\.com)\//i;
function sanitizeHtml(input) {
  if (!input) return '';
  return DOMPurify.sanitize(input, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i, FORBID_ATTR: ['style','id'], USE_PROFILES: { html: true }, SAFE_FOR_TEMPLATES: false, ADD_ATTR: ['allowfullscreen'] });
}
function pruneCmsAttributes(html) {
  let cleaned = html.replace(/\sclass="([^"]*)"/gi, (_f, cv) => { const a = cv.split(/\s+/).filter((t) => ALLOWED_CLASS_RE.test(t)); return a.length ? ` class="${a.join(' ')}"` : ''; });
  cleaned = cleaned.replace(/\s(data-[a-z0-9-]+)="([^"]*)"/gi, (full, attr, value) => { const v = ALLOWED_DATA_ATTR[attr.toLowerCase()]; if (!v) return ''; return v.test(value) ? full : ''; });
  return cleaned;
}
function sanitizeAndValidate(html) {
  let cleaned = pruneCmsAttributes(sanitizeHtml(html));
  cleaned = cleaned.replace(/<iframe[^>]*src="([^"]+)"[^>]*><\/iframe>/gi, (full, src) => { try { const u = new URL(src, 'https://example.com'); if (ALLOWED_IFRAME_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h))) return full; } catch {} return ''; });
  cleaned = cleaned.replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, (full, src) => { if (src.startsWith('/') || src.startsWith('data:image/')) return full; if (ALLOWED_IMG_HOSTS_RE.test(src)) return full; return ''; });
  return cleaned;
}

// ---- OpenAI (same model/prompts as translate-missing-en, PT→ES) ----
const SYSTEM_BODY = `You are a careful translator of devotional Catholic content from European Portuguese to European Spanish.

Rules:
- Preserve the EXACT HTML structure: keep every <h1> <h2> <h3> <p> <ul> <ol> <li> <blockquote> <strong> <em> <a> <img> <iframe> tag and attribute as in the source. Do not invent tags.
- Do NOT translate href URLs, src URLs, or class/data-* attribute values. Keep them byte-identical.
- Translate alt="" and title="" attributes when present.
- Preserve <img> and <iframe> exactly where they are.
- Keep personal/place proper nouns in their canonical form (Garabandal, Conchita, Mari Loli, Jacinta, Mari Cruz, Padre Pio). Marian titles should use the natural Spanish form (e.g. "Nossa Senhora do Carmo" → "Nuestra Señora del Carmen").
- Output ONLY the translated HTML. No commentary, no markdown, no code fences.`;
const SYSTEM_SHORT = `Translate this short text from European Portuguese to European Spanish. Keep tone and proper nouns. Output ONLY the translation, no quotes or commentary.`;
const SYSTEM_META = `You write SEO meta descriptions in European Spanish for a Catholic devotional site about the Garabandal apparitions. Given a page title and a plain-text excerpt of its body, write ONE compelling meta description in Spanish: 120-160 characters, natural (not keyword-stuffed), reflecting the page content, keeping proper nouns (Garabandal, Conchita, Fátima…). Output ONLY the description text, no quotes, no commentary.`;
async function seoMetaDescription(title, bodyPlain) {
  const user = `Título: ${title}\n\nExtracto del cuerpo:\n${(bodyPlain || '').slice(0, 1200)}`;
  return (await openai(SYSTEM_META, user)).trim().replace(/^["']|["']$/g, '');
}
const htmlToText = (html) => (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function openai(system, user, attempt = 0) {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` }, body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
    if (res.status === 429 || res.status >= 500) throw new Error(`OpenAI ${res.status}`);
    if (!res.ok) throw Object.assign(new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`), { fatal: true });
    const data = await res.json();
    let out = data.choices?.[0]?.message?.content?.trim() ?? '';
    out = out.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '');
    return out;
  } catch (e) { if (e.fatal || attempt >= 5) throw e; await sleep(1000 * Math.pow(2, attempt) + Math.random() * 500); return openai(system, user, attempt + 1); }
}
async function translateShort(text) { if (!text || !text.trim()) return text ?? null; return (await openai(SYSTEM_SHORT, text)).trim(); }
function chunkHtml(html, maxLen = 28000) {
  if (html.length <= maxLen) return [html];
  const parts = html.split(/(?<=<\/(?:p|h1|h2|h3|h4|h5|h6|li|ul|ol|blockquote|figure|table|tr|div)>)/i);
  const chunks = []; let buf = '';
  for (const p of parts) { if (buf.length + p.length > maxLen && buf) { chunks.push(buf); buf = ''; } buf += p; }
  if (buf) chunks.push(buf); return chunks;
}
async function translateBody(html) {
  if (!html || !html.trim()) return '';
  const chunks = chunkHtml(html); const out = [];
  for (let i = 0; i < chunks.length; i++) { out.push(await openai(SYSTEM_BODY, chunks[i])); if (chunks.length > 1) process.stdout.write(`    body chunk ${i + 1}/${chunks.length}\r`); }
  return sanitizeAndValidate(out.join(''));
}

// clean the junk "es-" prefix some legacy meta_titles carry
const stripEsPrefix = (s) => (typeof s === 'string' ? s.replace(/^es-/, '') : s);

async function ptPeerOf(esRow) {
  const { data: link } = await supabase.from('content_translations').select('group_id').eq('content_type', TYPE).eq('content_id', esRow.id).maybeSingle();
  if (!link) return null;
  const { data: members } = await supabase.from('content_translations').select('content_id').eq('content_type', TYPE).eq('group_id', link.group_id);
  const ids = (members ?? []).map((m) => m.content_id);
  const { data: rows } = await supabase.from(TABLE).select('*').in('id', ids);
  return (rows ?? []).find((r) => r.locale === 'pt') ?? null;
}

async function fixRow(esRow) {
  const pt = (await ptPeerOf(esRow)) ?? esRow; // fall back to the ES row's own (PT) content
  const fields = {
    title: await translateShort(pt.title),
    meta_title: await translateShort(stripEsPrefix(pt.meta_title) || pt.title),
    meta_description: await translateShort(pt.meta_description),
    excerpt: await translateShort(pt.excerpt),
    content_html: await translateBody(pt.content_html),
  };
  // SEO: generate a proper meta description when the source one is weak
  // (missing, too short, or just a copy of the title).
  const md = fields.meta_description;
  const weak = !md || md.trim().length < 60 || md.trim() === (fields.title || '').trim();
  if (weak) {
    fields.meta_description = await seoMetaDescription(fields.title, htmlToText(fields.content_html));
  }
  const tag = `  • ${esRow.slug}`;
  if (!COMMIT) {
    console.log(`${tag}\n     title: "${(fields.title || '').slice(0, 80)}"\n     body:  ${fields.content_html.length} chars`);
    return true;
  }
  const { error } = await supabase.from(TABLE).update({
    title: fields.title,
    meta_title: fields.meta_title,
    meta_description: fields.meta_description,
    excerpt: fields.excerpt,
    content_html: fields.content_html,
    mt_unreviewed: true,
    updated_at: new Date().toISOString(),
  }).eq('id', esRow.id);
  if (error) { console.error(`${tag}  ✗ ${error.message}`); return false; }
  console.log(`${tag}  → ES "${(fields.title || '').slice(0, 70)}" (${fields.content_html.length} chars)`);
  return true;
}

async function selectTargets() {
  if (ONE_SLUG) {
    const { data } = await supabase.from(TABLE).select('*').eq('locale', 'es').eq('slug', ONE_SLUG);
    return data ?? [];
  }
  // --all: recompute the "still Portuguese" set
  const { data: rows } = await supabase.from(TABLE).select('*');
  const { data: links } = await supabase.from('content_translations').select('group_id, content_id').eq('content_type', TYPE);
  const g2c = new Map();
  for (const l of links ?? []) { const a = g2c.get(l.group_id) ?? []; a.push(l.content_id); g2c.set(l.group_id, a); }
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  const targets = [];
  for (const es of (rows ?? []).filter((r) => r.locale === 'es')) {
    let grp = null; for (const [g, ids] of g2c) if (ids.includes(es.id)) { grp = g; break; }
    let pt = null; if (grp) for (const id of g2c.get(grp)) { const r = byId.get(id); if (r?.locale === 'pt') pt = r; }
    if (/^es-/.test(es.meta_title || '') || (pt && es.title === pt.title)) targets.push(es);
  }
  return targets;
}

async function run() {
  const targets = await selectTargets();
  console.log(`\n${COMMIT ? '🟢 COMMIT' : '🟡 DRY-RUN'} | ${TABLE} | ${targets.length} target(s)\n`);
  let ok = 0, fail = 0;
  for (const es of targets) { try { (await fixRow(es)) ? ok++ : fail++; } catch (e) { fail++; console.error(`  • ${es.slug}  ✗ ${e.message}`); } }
  console.log(`\nDone. ok=${ok} fail=${fail} ${COMMIT ? '(written)' : '(dry-run)'}\n`);
}
run().catch((e) => { console.error(e); process.exit(1); });
