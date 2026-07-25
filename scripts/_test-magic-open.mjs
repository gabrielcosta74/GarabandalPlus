import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}

const env = loadEnv(new URL('../.env', import.meta.url).pathname);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const SITE_URL = 'https://apostoladodegarabandal.com';
const email = process.argv[2];
const next = process.argv[3] || '/';
const openIt = process.argv.includes('--open');

if (!email) { console.error('Uso: node scripts/_test-magic-open.mjs <email> [next] [--open]'); process.exit(1); }

const redirectTo = `${SITE_URL}/auth-callback?next=${encodeURIComponent(next)}`;
const { data, error } = await supabase.auth.admin.generateLink({
  type: 'magiclink', email, options: { redirectTo },
});
const link = data?.properties?.action_link;
if (error || !link) { console.error('FALHA:', error?.message || 'sem action_link'); process.exit(1); }

console.log('Email:', email);
console.log('Destino após login (next):', next);
console.log('redirectTo:', redirectTo);
console.log('\nMagic link:\n' + link + '\n');
if (openIt) { console.log('A abrir no browser...'); execSync(`open "${link}"`); }
