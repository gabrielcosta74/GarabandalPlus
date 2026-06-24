/**
 * Batch-translate missing EN peers for CMS content (wp_pages + posts).
 *
 * Mirrors the CMS pipeline:
 *   - source = PT row that belongs to a translation group with no EN peer
 *   - translate title / meta_title / meta_description / excerpt (short) and
 *     content_html (body) via OpenAI gpt-4o-mini using the same prompts as
 *     /api/admin/cms/translate
 *   - sanitize the body the same way the CMS does before persisting
 *   - insert an EN row (status='draft', SAME slug) and link it in
 *     content_translations under the PT row's group_id (creating the group +
 *     the PT link first if the PT row isn't grouped yet)
 *
 * SAFETY: dry-run by default. Pass --commit to write. EN rows are created as
 * DRAFT so nothing goes live.
 *
 * Usage:
 *   node --env-file=.env scripts/translate-missing-en.mjs --type=page --limit=3            # dry preview
 *   node --env-file=.env scripts/translate-missing-en.mjs --type=page --limit=3 --commit   # write 3 pages
 *   node --env-file=.env scripts/translate-missing-en.mjs --type=all --commit              # full run
 *
 * If --env-file isn't supported by your node, the script also parses .env itself.
 */
import { createClient } from '@supabase/supabase-js';
import DOMPurify from 'isomorphic-dompurify';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------- env loading
function loadEnv() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.OPENAI_API_KEY) return;
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing Supabase env'); process.exit(1); }
if (!OPENAI_KEY) { console.error('Missing OPENAI_API_KEY'); process.exit(1); }

// ---------------------------------------------------------------- args
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const TYPE = args.type === 'all' || args.type === undefined ? 'all' : args.type; // page|post|all
const LIMIT = args.limit ? parseInt(args.limit, 10) : Infinity;
const COMMIT = Boolean(args.commit);
const SOURCE_LOCALE = 'pt';
const TARGET_LOCALE = typeof args.target === 'string' ? args.target : 'en'; // en|es|fr|it
if (!['en', 'es', 'fr', 'it'].includes(TARGET_LOCALE)) {
  console.error(`Unsupported --target=${TARGET_LOCALE} (use en|es|fr|it)`);
  process.exit(1);
}
const TGT = TARGET_LOCALE.toUpperCase();

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ---------------------------------------------------------------- sanitize (ported from src/lib/cms/sanitize.ts)
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
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS, ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_ATTR: ['style', 'id'],
    USE_PROFILES: { html: true },
    SAFE_FOR_TEMPLATES: false,
    ADD_ATTR: ['allowfullscreen'],
  });
}
function pruneCmsAttributes(html) {
  let cleaned = html.replace(/\sclass="([^"]*)"/gi, (_f, classValue) => {
    const allowed = classValue.split(/\s+/).filter((t) => ALLOWED_CLASS_RE.test(t));
    return allowed.length ? ` class="${allowed.join(' ')}"` : '';
  });
  cleaned = cleaned.replace(/\s(data-[a-z0-9-]+)="([^"]*)"/gi, (full, attr, value) => {
    const v = ALLOWED_DATA_ATTR[attr.toLowerCase()];
    if (!v) return '';
    return v.test(value) ? full : '';
  });
  return cleaned;
}
function sanitizeAndValidate(html) {
  let cleaned = pruneCmsAttributes(sanitizeHtml(html));
  cleaned = cleaned.replace(/<iframe[^>]*src="([^"]+)"[^>]*><\/iframe>/gi, (full, src) => {
    try {
      const u = new URL(src, 'https://example.com');
      if (ALLOWED_IFRAME_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h))) return full;
    } catch {}
    return '';
  });
  cleaned = cleaned.replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, (full, src) => {
    if (src.startsWith('/') || src.startsWith('data:image/')) return full;
    if (ALLOWED_IMG_HOSTS_RE.test(src)) return full;
    return '';
  });
  return cleaned;
}

// ---------------------------------------------------------------- OpenAI
const LOCALE_LABEL = { pt: 'European Portuguese', en: 'English', es: 'European Spanish', fr: 'French', it: 'Italian' };
const SYSTEM_BODY = `You are a careful translator of devotional Catholic content from ${LOCALE_LABEL[SOURCE_LOCALE]} to ${LOCALE_LABEL[TARGET_LOCALE]}.

Rules:
- Preserve the EXACT HTML structure: keep every <h1> <h2> <h3> <p> <ul> <ol> <li> <blockquote> <strong> <em> <a> <img> <iframe> tag and attribute as in the source. Do not invent tags.
- Do NOT translate href URLs, src URLs, or class/data-* attribute values. Keep them byte-identical.
- Translate alt="" and title="" attributes when present.
- Preserve <img> and <iframe> exactly where they are.
- Keep personal/place proper nouns in their canonical form (Garabandal, Conchita, Mari Loli, Jacinta, Mari Cruz, Padre Pio). Marian titles should use the natural form of the target language (e.g. "Nossa Senhora do Carmo" → English "Our Lady of Mount Carmel", Spanish "Nuestra Señora del Carmen").
- Output ONLY the translated HTML. No commentary, no markdown, no code fences.`;
const SYSTEM_SHORT = `Translate this short text from ${LOCALE_LABEL[SOURCE_LOCALE]} to ${LOCALE_LABEL[TARGET_LOCALE]}. Keep tone and proper nouns. Output ONLY the translation, no quotes or commentary.`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openai(system, user, attempt = 0) {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (res.status === 429 || res.status >= 500) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    if (!res.ok) throw Object.assign(new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`), { fatal: true });
    const data = await res.json();
    let out = data.choices?.[0]?.message?.content?.trim() ?? '';
    out = out.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '');
    return out;
  } catch (e) {
    // Retry transient network errors ("fetch failed") + 429/5xx with backoff.
    if (e.fatal || attempt >= 5) throw e;
    await sleep(1000 * Math.pow(2, attempt) + Math.random() * 500);
    return openai(system, user, attempt + 1);
  }
}

async function translateShort(text) {
  if (!text || !text.trim()) return text ?? null;
  return (await openai(SYSTEM_SHORT, text)).trim();
}

// Split HTML into <= maxLen chunks at block-closing boundaries to stay under
// the model's output cap, then translate + concatenate.
function chunkHtml(html, maxLen = 28000) {
  if (html.length <= maxLen) return [html];
  const parts = html.split(/(?<=<\/(?:p|h1|h2|h3|h4|h5|h6|li|ul|ol|blockquote|figure|table|tr|div)>)/i);
  const chunks = [];
  let buf = '';
  for (const p of parts) {
    if (buf.length + p.length > maxLen && buf) { chunks.push(buf); buf = ''; }
    buf += p;
  }
  if (buf) chunks.push(buf);
  return chunks;
}

async function translateBody(html) {
  if (!html || !html.trim()) return '';
  const chunks = chunkHtml(html);
  const out = [];
  for (let i = 0; i < chunks.length; i++) {
    const t = await openai(SYSTEM_BODY, chunks[i]);
    out.push(t);
    if (chunks.length > 1) process.stdout.write(`    body chunk ${i + 1}/${chunks.length}\r`);
  }
  return sanitizeAndValidate(out.join(''));
}

// ---------------------------------------------------------------- discovery
async function findMissing(type) {
  const table = type === 'page' ? 'wp_pages' : 'posts';
  const { data: rows, error } = await supabase.from(table).select('*');
  if (error) throw error;
  const { data: links } = await supabase
    .from('content_translations').select('group_id, content_id, locale').eq('content_type', type);
  const idToGroup = new Map();
  for (const l of links ?? []) idToGroup.set(l.content_id, l.group_id);

  const groups = new Map();
  for (const r of rows ?? []) {
    const gid = idToGroup.get(r.id) ?? `solo:${r.id}`;
    const b = groups.get(gid) ?? { gid, pt: null, tgt: null, hasLink: idToGroup.has(r.id) };
    if (r.locale === SOURCE_LOCALE) b.pt = r;
    else if (r.locale === TARGET_LOCALE) b.tgt = r;
    groups.set(gid, b);
  }
  return [...groups.values()].filter((g) => g.pt && !g.tgt).sort((a, b) => (a.pt.title || '').localeCompare(b.pt.title || ''));
}

// ---------------------------------------------------------------- write
// Read the group a PT row already belongs to (PK is content_type+content_id).
async function lookupGroup(type, contentId) {
  const { data } = await supabase
    .from('content_translations')
    .select('group_id')
    .eq('content_type', type)
    .eq('content_id', contentId)
    .maybeSingle();
  return data?.group_id ?? null;
}

async function ensureGroup(type, ptRow, existingGroupId) {
  if (existingGroupId && !String(existingGroupId).startsWith('solo:')) return existingGroupId;
  // Another concurrent run (e.g. the EN pass) may have just grouped this PT row.
  const already = await lookupGroup(type, ptRow.id);
  if (already) return already;
  const groupId = crypto.randomUUID();
  const { error } = await supabase.from('content_translations').insert({
    group_id: groupId, content_type: type, content_id: ptRow.id, locale: ptRow.locale,
  });
  // Lost the race to the PK (content_type, content_id) → use the winner's group.
  if (error) {
    if (error.code === '23505') return (await lookupGroup(type, ptRow.id)) ?? groupId;
    throw error;
  }
  return groupId;
}

// ---------------------------------------------------------------- SEO slugs
// Localized, SEO-friendly slug built from the TRANSLATED title (not the PT
// slug), so e.g. /fr/<french-words> ranks for the target language. Mirrors the
// CMS editor's SLUGIFY (NFKD + strip diacritics) and caps length at a word
// boundary so URLs stay readable and keyword-focused.
function slugify(text, maxLen = 75) {
  let base = (text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (base.length > maxLen) {
    base = base.slice(0, maxLen);
    const cut = base.lastIndexOf('-');
    if (cut > 30) base = base.slice(0, cut); // don't cut mid-word
    base = base.replace(/-+$/g, '');
  }
  return base;
}

// Used-slug sets per table for the target locale, seeded once from the DB so
// both reruns and within-run title collisions get a unique -2/-3 suffix.
const slugSets = {};
async function reserveSlug(table, title, fallback) {
  if (!slugSets[table]) {
    const set = new Set();
    const { data } = await supabase.from(table).select('slug').eq('locale', TARGET_LOCALE);
    for (const r of data ?? []) set.add(r.slug);
    slugSets[table] = set;
  }
  const set = slugSets[table];
  const base = slugify(title) || slugify(fallback) || fallback;
  let candidate = base, n = 2;
  while (set.has(candidate)) candidate = `${base}-${n++}`;
  set.add(candidate);
  return candidate;
}

async function createPeer(type, ptRow, fields) {
  const table = type === 'page' ? 'wp_pages' : 'posts';
  const slug = await reserveSlug(table, fields.title, ptRow.slug);
  const base = {
    slug,
    locale: TARGET_LOCALE,
    title: fields.title,
    meta_title: fields.meta_title,
    meta_description: fields.meta_description,
    og_image_url: ptRow.og_image_url,
    excerpt: fields.excerpt,
    content_html: fields.content_html,
    content_json: null,
    status: 'draft',
  };
  if (type === 'page') {
    base.category = ptRow.category;
    base.parent_slug = ptRow.parent_slug;
  } else {
    base.cover_image_url = ptRow.cover_image_url;
    base.tags = ptRow.tags ?? [];
    base.featured = false;
  }
  const { data: created, error } = await supabase.from(table).insert(base).select('id').single();
  if (error) throw error;
  return { id: created.id, slug };
}

// ---------------------------------------------------------------- main
async function run() {
  const types = TYPE === 'all' ? ['page', 'post'] : [TYPE];
  console.log(`\n${COMMIT ? '🟢 COMMIT' : '🟡 DRY-RUN'} | types=${types.join(',')} | limit=${LIMIT === Infinity ? 'all' : LIMIT} | ${SOURCE_LOCALE}→${TARGET_LOCALE}\n`);

  let done = 0, failed = 0;
  for (const type of types) {
    const missing = await findMissing(type);
    const slice = missing.slice(0, Math.max(0, LIMIT - done));
    console.log(`[${type}] ${missing.length} missing ${TGT} — processing ${slice.length}`);
    for (const g of slice) {
      if (done >= LIMIT) break;
      const pt = g.pt;
      const tag = `  • ${type} "${(pt.title || '').slice(0, 60)}" /${pt.slug}`;
      try {
        const fields = {
          title: await translateShort(pt.title),
          meta_title: await translateShort(pt.meta_title),
          meta_description: await translateShort(pt.meta_description),
          excerpt: await translateShort(pt.excerpt),
          content_html: await translateBody(pt.content_html),
        };
        if (COMMIT) {
          const groupId = await ensureGroup(type, pt, g.hasLink ? g.gid : null);
          const { id: newId, slug: newSlug } = await createPeer(type, pt, fields);
          await supabase.from('content_translations').insert({
            group_id: groupId, content_type: type, content_id: newId, locale: TARGET_LOCALE,
          });
          console.log(`${tag}  → ${TGT} /${newSlug} ${newId} (group ${groupId.slice(0, 8)})`);
        } else {
          console.log(`${tag}  → ${TGT} title: "${(fields.title || '').slice(0, 70)}" | body ${fields.content_html.length} chars`);
        }
        done++;
      } catch (e) {
        failed++;
        console.error(`${tag}  ✗ ${e.message}`);
      }
    }
    if (done >= LIMIT) break;
  }
  console.log(`\nDone. translated=${done} failed=${failed} ${COMMIT ? '(written)' : '(dry-run, nothing written)'}\n`);
}

run().catch((e) => { console.error(e); process.exit(1); });
