/**
 * send-faby-access-help.mjs
 *
 * Envia UM email de ajuda de acesso à Fabiana (faby_p.sousa@hotmail.com).
 * Ela usa Hotmail/Outlook: o scanner de segurança "gasta" os links de acesso
 * antes de ela os abrir -> aparece "expirado". A solução robusta é o fluxo de
 * CÓDIGO de 6 dígitos (/auth/forgot-password), imune a scanners de links.
 *
 * Este email é 100% estático (não contém segredos): explica, passo a passo,
 * como recuperar o acesso pelo código e concluir o pagamento de novembro.
 *
 * Segurança: arranca em DRY-RUN. Só envia mesmo com --send.
 *   Ver sem enviar:   node scripts/send-faby-access-help.mjs
 *   Enviar de verdade: node scripts/send-faby-access-help.mjs --send
 *   Enviar para outro: node scripts/send-faby-access-help.mjs --to=teste@exemplo.com --send
 */

import { readFileSync } from 'fs';
import { Resend } from 'resend';

/* --------------------------------- config --------------------------------- */

const TEMPLATE_FILE = '../emails/_faby-acesso-novembro.html';
const DEFAULT_TO = 'faby_p.sousa@hotmail.com';
const SUBJECT = 'Fabiana, como voltar a entrar na sua conta (2 minutos)';

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
const resend = new Resend(env.RESEND_API_KEY);
const fromAddr = (env.NOTIFY_EMAIL_FROM || 'geral@apostoladodegarabandal.com').trim();
const from = `Apostolado de Garabandal <${fromAddr}>`;
// A pessoa é convidada a responder; garantir que a resposta chega a uma caixa real.
const replyTo = 'geral@apostoladodegarabandal.com';

/* --------------------------------- args ----------------------------------- */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const doSend = Boolean(args.send);
const to = typeof args.to === 'string' ? args.to : DEFAULT_TO;

/* ---------------------------------- main ---------------------------------- */

async function main() {
  const html = readFileSync(new URL(TEMPLATE_FILE, import.meta.url).pathname, 'utf8');

  console.log(`\nDe:      ${from}`);
  console.log(`Para:    ${to}`);
  console.log(`Assunto: ${SUBJECT}`);
  console.log(`Modo:    ${doSend ? 'ENVIO REAL' : 'DRY-RUN (não envia)'}\n`);

  if (!doSend) {
    console.log('(DRY-RUN. Acrescenta --send para enviar mesmo.)');
    return;
  }

  const res = await resend.emails.send({ from, to: [to], subject: SUBJECT, html, replyTo });
  if (res.error) {
    console.error('FALHA Resend:', res.error);
    process.exit(1);
  }
  console.log('OK enviado. id=' + res.data?.id);
}

main().catch((e) => { console.error('Erro inesperado:', e); process.exit(1); });
