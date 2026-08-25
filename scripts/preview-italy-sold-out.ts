/**
 * Gera uma pré-visualização local do aviso de esgotado da peregrinação
 * Itália + Medjugorje. Não consulta a base de dados e não envia emails.
 *
 *   npx tsx scripts/preview-italy-sold-out.ts
 */

import { writeFileSync } from 'node:fs';
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });
process.env.APP_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://apostoladodegarabandal.com').replace(/\/+$/, '');

const TEMPLATE_KEY = 'italy_medjugorje_sold_out';
const PILGRIMAGE_IMAGE = 'https://pntzzuxzjnzksubbjfvj.supabase.co/storage/v1/object/public/site-content/pilgrimages/covers/1768917805305_l2ho16.png';

async function main() {
  const { renderMarketingTemplateEmail } = await import('../src/lib/email-renderer');
  const { subject, html } = renderMarketingTemplateEmail({
    templateKey: TEMPLATE_KEY,
    name: 'Maria',
    email: 'preview@apostoladodegarabandal.com',
    language: 'pt',
    pilgrimageName: 'Peregrinação a Itália e Medjugorje — abril de 2027',
    pilgrimageImageUrl: PILGRIMAGE_IMAGE,
    unsubscribeUrl: 'https://apostoladodegarabandal.com/cancelar-subscricao?preview=1',
  });

  const output = 'emails/_preview-italy-sold-out-pt.html';
  writeFileSync(output, html, 'utf8');

  if (/75\s*%|vagas preenchidas|vagas já foram|localhost|127\.0\.0\.1/i.test(`${subject}\n${html}`)) {
    throw new Error('O preview contém uma percentagem, disponibilidade ou link inválido.');
  }

  console.log(`Preview criado: ${output}`);
  console.log(`Assunto: ${subject}`);
  console.log('Nenhum email foi enviado.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
