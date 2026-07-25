/**
 * send-access-recovery-emails.mjs
 *
 * Reenvia acesso após a mudança de domínio app.apostoladodegarabandal.com -> apostoladodegarabandal.com.
 * Gera um magic link POR PESSOA (domínio NOVO) e injeta-o no template HTML de preview.
 *
 * Dois modos:
 *   --mode=general      -> todos os utilizadores com conta. Login direto para a PÁGINA INICIAL (next=/).
 *                          Template: emails/_preview-login-access.html
 *   --mode=pilgrimage   -> responsáveis de reserva da peregrinação de NOVEMBRO 2026.
 *                          Login direto para a página de pagamento da sua reserva
 *                          (next=/peregrinacoes/inscricao/{bookingId}).
 *                          Template: emails/_preview-peregrinacao-pagamento.html
 *
 * Segurança: arranca em DRY-RUN. Só envia mesmo com --send.
 *   Listar geral (sem enviar):       node scripts/send-access-recovery-emails.mjs --mode=general
 *   Listar peregrinação (sem enviar):node scripts/send-access-recovery-emails.mjs --mode=pilgrimage
 *   Testar a 1 email:                node scripts/send-access-recovery-emails.mjs --mode=general --only=teste@exemplo.com --send
 *   Enviar a todos:                  node scripts/send-access-recovery-emails.mjs --mode=general --send
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

/* --------------------------------- config --------------------------------- */

const SITE_URL = 'https://apostoladodegarabandal.com';
const PILGRIMAGE_MONTH = { year: 2026, month: 11 }; // Novembro de 2026
const SEND_THROTTLE_MS = 1200; // ~1 email/seg, seguro para o Resend

const TEMPLATES = {
  general: {
    file: '../emails/_preview-login-access.html',
    subject: 'O acesso à sua conta tem um novo endereço',
    nextPath: () => '/', // página inicial
  },
  pilgrimage: {
    file: '../emails/_preview-peregrinacao-pagamento.html',
    subject: 'Acesso direto aos pagamentos da sua peregrinação de novembro',
    nextPath: (bookingId) => `/peregrinacoes/inscricao/${bookingId}`,
  },
};

/* ------------------------------- env loader ------------------------------- */

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
const resend = new Resend(env.RESEND_API_KEY);
const fromAddr = (env.NOTIFY_EMAIL_FROM || 'geral@apostoladodegarabandal.com').trim();
const from = `Apostolado de Garabandal <${fromAddr}>`;

/* --------------------------------- args ----------------------------------- */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const mode = args.mode;
const doSend = Boolean(args.send);
const onlyEmail = typeof args.only === 'string' ? args.only.toLowerCase() : null;

if (!mode || !TEMPLATES[mode]) {
  console.error('Uso: --mode=general | --mode=pilgrimage  [--only=email] [--send]');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------ recipients -------------------------------- */

// { email, name?, bookingId? }
async function getRecipients() {
  if (mode === 'general') {
    const recipients = [];
    let page = 1;
    // Paginar todos os utilizadores do Supabase Auth.
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const users = data?.users || [];
      for (const u of users) {
        if (u.email) recipients.push({ email: u.email });
      }
      if (users.length < 1000) break;
      page++;
    }
    return recipients;
  }

  // mode === 'pilgrimage'
  const startOfMonth = `${PILGRIMAGE_MONTH.year}-${String(PILGRIMAGE_MONTH.month).padStart(2, '0')}-01`;
  const nextMonth = PILGRIMAGE_MONTH.month === 12
    ? `${PILGRIMAGE_MONTH.year + 1}-01-01`
    : `${PILGRIMAGE_MONTH.year}-${String(PILGRIMAGE_MONTH.month + 1).padStart(2, '0')}-01`;

  const { data: pilgrimages, error: pErr } = await supabase
    .from('pilgrimages')
    .select('id, title, start_date')
    .gte('start_date', startOfMonth)
    .lt('start_date', nextMonth);
  if (pErr) throw pErr;

  if (!pilgrimages?.length) {
    console.error(`Nenhuma peregrinação encontrada com início em ${startOfMonth}..${nextMonth}.`);
    return [];
  }
  console.log('Peregrinação(ões) de novembro 2026:');
  pilgrimages.forEach((p) => console.log(`  - ${p.title} (${p.start_date}) [${p.id}]`));

  const pilgrimageIds = pilgrimages.map((p) => p.id);
  const { data: bookings, error: bErr } = await supabase
    .from('bookings')
    .select('id, user_id, status')
    .in('pilgrimage_id', pilgrimageIds);
  if (bErr) throw bErr;

  const recipients = [];
  for (const b of bookings || []) {
    if (!b.user_id) continue;
    const { data: u } = await supabase.auth.admin.getUserById(b.user_id);
    const email = u?.user?.email;
    if (email) recipients.push({ email, bookingId: b.id });
  }
  return recipients;
}

/* ---------------------------------- main ---------------------------------- */

async function main() {
  const tpl = TEMPLATES[mode];
  const htmlTemplate = readFileSync(new URL(tpl.file, import.meta.url).pathname, 'utf8');

  let recipients = await getRecipients();
  if (onlyEmail) recipients = recipients.filter((r) => r.email.toLowerCase() === onlyEmail);

  console.log(`\nModo: ${mode} | Destinatários: ${recipients.length} | ${doSend ? 'ENVIO REAL' : 'DRY-RUN (não envia)'}\n`);

  let ok = 0, fail = 0;
  for (const [i, r] of recipients.entries()) {
    const next = tpl.nextPath(r.bookingId);
    const redirectTo = `${SITE_URL}/auth-callback?next=${encodeURIComponent(next)}`;
    const label = `[${i + 1}/${recipients.length}] ${r.email}${r.bookingId ? ` (reserva ${r.bookingId})` : ''} -> ${next}`;

    if (!doSend) {
      console.log('DRY ' + label);
      continue;
    }

    try {
      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: r.email,
        options: { redirectTo },
      });
      const magicLink = data?.properties?.action_link;
      if (error || !magicLink) {
        console.error('  FALHA magic link: ' + label, error?.message || '');
        fail++;
        continue;
      }

      const html = htmlTemplate.replaceAll('{{MAGIC_LINK}}', magicLink);
      const res = await resend.emails.send({ from, to: [r.email], subject: tpl.subject, html });
      if (res.error) {
        console.error('  FALHA Resend: ' + label, res.error);
        fail++;
      } else {
        console.log('  OK ' + label + ' id=' + res.data?.id);
        ok++;
      }
      await sleep(SEND_THROTTLE_MS);
    } catch (e) {
      console.error('  ERRO: ' + label, e?.message || e);
      fail++;
    }
  }

  if (doSend) console.log(`\n--- CONCLUSÃO --- enviados: ${ok} | erros: ${fail}`);
  else console.log('\n(DRY-RUN. Acrescenta --send para enviar mesmo.)');
}

main().catch((e) => { console.error('Erro inesperado:', e); process.exit(1); });
