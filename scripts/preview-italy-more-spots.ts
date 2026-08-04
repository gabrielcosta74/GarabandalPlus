/**
 * Gera os previews do email "vagas extra" da Itália + Medjugorje (PT e EN).
 *
 *   npx tsx scripts/preview-italy-more-spots.ts
 *
 * Lê o número real de vagas e a capa da peregrinação da base de dados, para que
 * o preview mostre exatamente o que o destinatário vai receber. Não envia nada.
 */

import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

import { renderMarketingTemplateEmail } from '../src/lib/email-renderer';

config({ path: '.env.local' });
config({ path: '.env' });

const PILGRIMAGE_ID = 'a7e2616e-fe39-48dc-968e-b14153c25325';
const TEMPLATE_KEY = 'italy_medjugorje_more_spots';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(url, key);
  const { data: pilgrimage, error } = await supabase
    .from('pilgrimages')
    .select('title, title_en, slug, cover_image, current_vacancies, status')
    .eq('id', PILGRIMAGE_ID)
    .single();
  if (error) throw error;

  const vacancies = Number(pilgrimage.current_vacancies || 0);
  console.log(`Peregrinação: ${pilgrimage.title}`);
  console.log(`Estado: ${pilgrimage.status} · vagas disponíveis: ${vacancies}`);
  if (pilgrimage.status !== 'open') {
    console.warn('AVISO: a peregrinação não está "open" — o botão não vai permitir inscrição.');
  }
  if (vacancies <= 0) {
    console.warn('AVISO: não há vagas disponíveis. O email vai anunciar 0 vagas.');
  }

  const variants = [
    {
      locale: 'pt' as const,
      name: 'Maria Angela',
      file: 'emails/_preview-italy-more-spots-pt.html',
      currency: { code: 'BRL', rate: 6.2 },
    },
    {
      locale: 'en' as const,
      name: 'Connie',
      file: 'emails/_preview-italy-more-spots-en.html',
      currency: { code: 'USD', rate: 1.08 },
    },
  ];

  for (const variant of variants) {
    const { subject, html } = renderMarketingTemplateEmail({
      templateKey: TEMPLATE_KEY,
      name: variant.name,
      email: 'preview@apostoladodegarabandal.com',
      language: variant.locale,
      pilgrimageName: variant.locale === 'en' ? pilgrimage.title_en || pilgrimage.title : pilgrimage.title,
      pilgrimageImageUrl: pilgrimage.cover_image,
      pilgrimageVacancies: vacancies,
      pilgrimageStatus: pilgrimage.status as 'open' | 'waitlist',
      localCurrency: variant.currency,
      unsubscribeUrl: 'https://apostoladodegarabandal.com/unsubscribe?preview=1',
    });

    if (/localhost|127\.0\.0\.1/.test(html)) {
      throw new Error(`[${variant.locale}] O email contém links para localhost. Corre com APP_URL=https://apostoladodegarabandal.com`);
    }

    writeFileSync(variant.file, html, 'utf8');
    console.log(`\n[${variant.locale.toUpperCase()}] ${variant.file}`);
    console.log(`  Assunto: ${subject}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
