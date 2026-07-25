import { readFileSync, writeFileSync } from 'node:fs';
import { GoogleAuth } from 'google-auth-library';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  env[m[1]] = v;
}
const SITE = env.GOOGLE_SEARCH_CONSOLE_SITE_URL;
const auth = new GoogleAuth({
  credentials: {
    client_email: env.GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL,
    private_key: env.GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY.replace(/\\+n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
});
const client = await auth.getClient();
const tokenRes = await client.getAccessToken();
const token = typeof tokenRes === 'string' ? tokenRes : tokenRes.token;

const urls = readFileSync('/tmp/sitemap_urls.txt', 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
const API = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function inspect(url, attempt = 0) {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionUrl: url, siteUrl: SITE }),
    });
    if (res.status === 429 || res.status === 503) {
      if (attempt < 5) { await sleep(2000 * (attempt + 1)); return inspect(url, attempt + 1); }
      return { url, verdict: 'RATE_LIMIT', coverage: 'quota/rate exceeded' };
    }
    if (!res.ok) return { url, verdict: 'ERROR', coverage: `HTTP ${res.status}` };
    const j = await res.json();
    const r = j.inspectionResult?.indexStatusResult || {};
    return {
      url,
      verdict: r.verdict || 'UNKNOWN',
      coverage: r.coverageState || 'n/a',
      lastCrawl: r.lastCrawlTime || null,
      canonicalG: r.googleCanonical || null,
      canonicalU: r.userCanonical || null,
      robots: r.robotsTxtState || null,
      indexingState: r.indexingState || null,
    };
  } catch (e) {
    return { url, verdict: 'ERROR', coverage: String(e.message).slice(0, 60) };
  }
}

const results = [];
const CONC = 6;
let i = 0;
let done = 0;
async function worker() {
  while (i < urls.length) {
    const idx = i++;
    results[idx] = await inspect(urls[idx]);
    done++;
    if (done % 50 === 0) console.error(`  ...${done}/${urls.length}`);
    await sleep(120); // ~ stay well under 600/min across 6 workers
  }
}
await Promise.all(Array.from({ length: CONC }, worker));

writeFileSync('/tmp/gsc_index_audit.json', JSON.stringify(results));

// Summary
const byCoverage = {};
for (const r of results) byCoverage[r.coverage] = (byCoverage[r.coverage] || 0) + 1;
console.log('\n=== RESUMO por coverageState ===');
Object.entries(byCoverage).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(String(v).padStart(5), k));

const sec = (u) => { const p = u.replace('https://apostoladodegarabandal.com/', ''); const s = p.split('/')[0]; return ['en','es','it','fr','l'].includes(s) ? s : 'pt'; };
const notIndexed = results.filter(r => r.verdict !== 'PASS');
const bySec = {};
for (const r of notIndexed) { const s = sec(r.url); bySec[s] = (bySec[s] || 0) + 1; }
console.log('\n=== NÃO indexadas, por secção ===');
Object.entries(bySec).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(String(v).padStart(5), k));
console.log(`\nTotal indexadas (PASS): ${results.filter(r=>r.verdict==='PASS').length} / ${results.length}`);
