import { readFileSync } from 'node:fs';
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
const credentials = {
  client_email: env.GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL,
  private_key: env.GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY.replace(/\\+n/g, '\n'),
};
const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] });
const client = await auth.getClient();
const tokenRes = await client.getAccessToken();
const token = typeof tokenRes === 'string' ? tokenRes : tokenRes.token;
const API = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`;

async function q(body) {
  const res = await fetch(API, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ dataState: 'all', ...body }) });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return (await res.json()).rows || [];
}
const d = (x) => x.toISOString().slice(0, 10);
const day = (off) => { const x = new Date(); x.setUTCDate(x.getUTCDate() + off); return d(x); };
const pct = (x) => (x * 100).toFixed(1) + '%';

// Daily trend for the two brand queries over last 30 days
for (const term of ['garabandal', 'apostolado de garabandal']) {
  const rows = await q({
    startDate: day(-32), endDate: day(-1), dimensions: ['date'], rowLimit: 40,
    dimensionFilterGroups: [{ filters: [{ dimension: 'query', operator: 'equals', expression: term }] }],
  });
  console.log(`\n=== "${term}" — diário (pos / cliques / impressões) ===`);
  rows.sort((a, b) => a.keys[0].localeCompare(b.keys[0])).forEach(r =>
    console.log(r.keys[0], '  pos', r.position.toFixed(1).padStart(5), '  clk', String(r.clicks).padStart(3), '  imp', String(r.impressions).padStart(4), ' ', pct(r.ctr)));
}

// Which page ranks for each brand term, last 7d vs previous 7d
for (const term of ['garabandal', 'apostolado de garabandal', 'apostolado garabandal']) {
  for (const [label, s, e] of [['ULT 7d', day(-8), day(-1)], ['PREV 7d', day(-15), day(-8)]]) {
    const rows = await q({ startDate: s, endDate: e, dimensions: ['page'], rowLimit: 10,
      dimensionFilterGroups: [{ filters: [{ dimension: 'query', operator: 'equals', expression: term }] }] });
    console.log(`\n# "${term}" [${label} ${s}..${e}]`);
    rows.sort((a,b)=>b.impressions-a.impressions).slice(0,5).forEach(r =>
      console.log('   pos', r.position.toFixed(1).padStart(5), 'imp', String(r.impressions).padStart(4), 'clk', String(r.clicks).padStart(3), ' ', r.keys[0].replace('https://apostoladodegarabandal.com','') || '/'));
  }
}
