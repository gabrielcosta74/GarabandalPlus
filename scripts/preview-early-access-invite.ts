/**
 * Gera uma pré-visualização local do email de convite VIP para o
 * Caminho Mariano 2027 (acesso antecipado). Não consulta a base de dados
 * e não envia emails.
 *
 *   npx tsx scripts/preview-early-access-invite.ts
 */

import { writeFileSync } from 'node:fs';
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });
process.env.APP_URL = (
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://apostoladodegarabandal.com'
).replace(/\/+$/, '');

async function main() {
  const { renderEarlyAccessInviteEmail } = await import(
    '../src/lib/emails/early-access-invite'
  );

  const pt = renderEarlyAccessInviteEmail({ locale: 'pt', recipientName: 'Maria' });
  const en = renderEarlyAccessInviteEmail({ locale: 'en', recipientName: 'Mary' });

  const ptOut = 'emails/_preview-early-access-invite-pt.html';
  const enOut = 'emails/_preview-early-access-invite-en.html';
  writeFileSync(ptOut, pt.html, 'utf8');
  writeFileSync(enOut, en.html, 'utf8');

  console.log(`Preview PT criado: ${ptOut}  — ${pt.subject}`);
  console.log(`Preview EN criado: ${enOut}  — ${en.subject}`);
  console.log('Nenhum email foi enviado.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
