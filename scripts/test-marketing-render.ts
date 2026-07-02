// Standalone render test for marketing templates with real-shape contact data.
// Uses tsx to import the TypeScript renderer directly.
//
// Usage: npx tsx scripts/test-marketing-render.mjs
//
// Outputs subject + plain-text excerpt for each template/contact combo so we
// can spot-check personalisation BEFORE the cron actually sends anything.

import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

process.env.APP_URL = (process.env.APP_URL || 'https://apostoladodegarabandal.com').replace(/\/+$/, '');

const APP_URL = process.env.APP_URL;
const octoberPilgrimage = {
  name: 'Peregrinação a Garabandal — Caminho Mariano — Outubro 2026',
  url: `${APP_URL}/peregrinacoes/peregrinacao-iberica-2026`,
  imageUrl: 'https://pntzzuxzjnzksubbjfvj.supabase.co/storage/v1/object/public/site-content/pilgrimages/covers/1768917805305_l2ho16.png',
};

const officialProducts = [
  {
    title: 'Livro - Garabandal, Um Chamamento Urgente à Conversão',
    price: '16,50 EUR',
    imageUrl: 'https://pntzzuxzjnzksubbjfvj.supabase.co/storage/v1/object/public/store-products/products/200000048/1766876268448.webp',
    url: `${APP_URL}/loja/200000048-livro-garabandal-um-chamamento-urgente-a-conversao`,
    label: 'Livro físico',
  },
  {
    title: 'Diário de Conchita - Versão digital em Português',
    price: '19,99 EUR',
    imageUrl: 'https://pntzzuxzjnzksubbjfvj.supabase.co/storage/v1/object/public/store-products/products/978-989-33-8094--9/1766876383807.webp',
    url: `${APP_URL}/loja/978-989-33-8094--9-diario-de-conchita-versao-digital-em-portugues`,
    label: 'Livro digital',
  },
  {
    title: 'Guia do Peregrino - Garabandal (Português / Espanhol) - PDF',
    price: '9,99 EUR',
    imageUrl: 'https://pntzzuxzjnzksubbjfvj.supabase.co/storage/v1/object/public/store-products/products/200000057/1766876326970.webp',
    url: `${APP_URL}/loja/200000057-guia-do-peregrino-garabandal-portugues-espanhol-pdf`,
    label: 'Guia digital',
  },
];

const officialProductsEn = [
  {
    title: 'Garabandal, An Urgent Call to Conversion',
    price: '16.50 EUR',
    imageUrl: officialProducts[0].imageUrl,
    url: `${APP_URL}/en/store/200000048-livro-garabandal-um-chamamento-urgente-a-conversao`,
    label: 'Physical book',
  },
  {
    title: "Conchita's Diary - Digital Version in Portuguese",
    price: '19.99 EUR',
    imageUrl: officialProducts[1].imageUrl,
    url: `${APP_URL}/en/store/978-989-33-8094--9-diario-de-conchita-versao-digital-em-portugues`,
    label: 'Digital book',
  },
  {
    title: 'Pilgrim Guide - Garabandal (Portuguese / Spanish) - PDF',
    price: '9.99 EUR',
    imageUrl: officialProducts[2].imageUrl,
    url: `${APP_URL}/en/store/200000057-guia-do-peregrino-garabandal-portugues-espanhol-pdf`,
    label: 'Digital guide',
  },
];

const samples: Array<any> = [
  // Real-shaped contacts pulled from the live BD (only display_name+email used).
  // Names anonymised slightly but representative of what's in production.
  {
    label: 'Member referral activation — clean name',
    templateKey: 'referral_activation',
    contact: { name: 'Cristina Maria Saraiva Nunes Pinto', email: 'cristina@example.com', language: 'pt' },
  },
  {
    label: 'Member referral activation — single first name',
    templateKey: 'referral_activation',
    contact: { name: 'Beatriz', email: 'beatriz@example.com', language: 'pt' },
  },
  {
    label: 'Abandoned registration #1 — placeholder name',
    templateKey: 'abandoned_registration_1',
    contact: { name: 'Peregrino (Rascunho)', email: 'placeholder@example.com', language: 'pt' },
    pilgrimageName: 'Garabandal — Setembro 2026',
  },
  {
    label: 'Abandoned registration #1 — real name',
    templateKey: 'abandoned_registration_1',
    contact: { name: 'Maria Reginalda dos Santos', email: 'maria@example.com', language: 'pt' },
    pilgrimageName: 'Garabandal — Setembro 2026',
    pilgrimageUrl: 'https://apostoladodegarabandal.com/peregrinacoes/garabandal-setembro-2026',
  },
  {
    label: 'Waitlist welcome — no pressure',
    templateKey: 'waitlist_welcome',
    contact: { name: 'Ana Martins', email: 'ana@example.com', language: 'pt' },
    pilgrimageName: 'Garabandal — Outubro 2026',
  },
  {
    label: 'Waitlist open spot — gated by availability',
    templateKey: 'waitlist_open_spot',
    contact: { name: 'Luis Ferreira', email: 'luis@example.com', language: 'pt' },
    pilgrimageName: octoberPilgrimage.name,
    pilgrimageUrl: octoberPilgrimage.url,
    pilgrimageImageUrl: octoberPilgrimage.imageUrl,
  },
  {
    label: 'Waitlist more spots — November urgency PT-BR',
    templateKey: 'waitlist_more_spots',
    contact: { name: 'Mariana Oliveira', email: 'mariana@example.com', language: 'pt' },
    pilgrimageName: 'Peregrinação a Garabandal — Caminho Ibérico — Novembro 2026',
    pilgrimageUrl: `${APP_URL}/peregrinacoes/peregrinacao-iberico-novembro-2026`,
    pilgrimageImageUrl: octoberPilgrimage.imageUrl,
  },
  {
    label: 'Waitlist more spots — placeholder name PT-BR',
    templateKey: 'waitlist_more_spots',
    contact: { name: 'Peregrino (Rascunho)', email: 'placeholder@example.com', language: 'pt' },
    pilgrimageName: 'Peregrinação a Garabandal — Caminho Ibérico — Novembro 2026',
    pilgrimageUrl: `${APP_URL}/peregrinacoes/peregrinacao-iberico-novembro-2026`,
    pilgrimageImageUrl: octoberPilgrimage.imageUrl,
  },
  {
    label: 'EN: Waitlist more spots — November urgency',
    templateKey: 'waitlist_more_spots',
    contact: { name: 'Mary Thompson', email: 'mary@example.com', language: 'en' },
    pilgrimageName: 'Garabandal Pilgrimage — Iberian Way — November 2026',
    pilgrimageUrl: `${APP_URL}/en/pilgrimages/peregrinacao-iberico-novembro-2026`,
    pilgrimageImageUrl: octoberPilgrimage.imageUrl,
  },
  {
    label: 'Waitlist nurture — story PT-BR',
    templateKey: 'waitlist_garabandal_story',
    contact: { name: 'Mariana Oliveira', email: 'mariana@example.com', language: 'pt' },
    pilgrimageName: octoberPilgrimage.name,
  },
  {
    label: 'Waitlist nurture — books PT-BR',
    templateKey: 'waitlist_book_recommendation',
    contact: { name: 'Mariana Oliveira', email: 'mariana@example.com', language: 'pt' },
    products: officialProducts,
  },
  {
    label: 'Waitlist nurture — mission support PT-BR',
    templateKey: 'waitlist_mission_support',
    contact: { name: 'Mariana Oliveira', email: 'mariana@example.com', language: 'pt' },
  },
  {
    label: 'Waitlist nurture — member invitation PT-BR',
    templateKey: 'waitlist_member_invitation',
    contact: { name: 'Mariana Oliveira', email: 'mariana@example.com', language: 'pt' },
  },
  {
    label: 'Donor to member — real name',
    templateKey: 'donor_to_member',
    contact: { name: 'Cláudio Emanuel Pereira', email: 'claudio@example.com', language: 'pt' },
  },
  {
    label: 'Member invitation — no product card',
    templateKey: 'member_invitation',
    contact: { name: 'Clara Almeida', email: 'clara@example.com', language: 'pt' },
  },
  {
    label: 'Store book recommendation — official products',
    templateKey: 'store_book_recommendation',
    contact: { name: 'Clara Almeida', email: 'clara@example.com', language: 'pt' },
    products: officialProducts,
  },
  {
    label: 'Donation impact — richer story',
    templateKey: 'donation_thank_you_story',
    contact: { name: 'Teresa Oliveira', email: 'teresa@example.com', language: 'pt' },
  },
  {
    label: 'Abandoned registration FAQ — real name',
    templateKey: 'abandoned_registration_faq',
    contact: { name: 'Rita de Cassia Maria Ribeiro', email: 'rita@example.com', language: 'pt' },
    pilgrimageName: 'Garabandal — Outubro 2026',
  },
  {
    label: 'EN: Waitlist open spot',
    templateKey: 'waitlist_open_spot',
    contact: { name: 'John Smith', email: 'john@example.com', language: 'en' },
    pilgrimageName: 'Garabandal Pilgrimage — Marian Way — October 2026',
    pilgrimageUrl: `${APP_URL}/en/pilgrimages/peregrinacao-iberica-2026`,
    pilgrimageImageUrl: octoberPilgrimage.imageUrl,
  },
  {
    label: 'EN: Waitlist nurture story',
    templateKey: 'waitlist_garabandal_story',
    contact: { name: 'Mary Thompson', email: 'mary@example.com', language: 'en' },
    pilgrimageName: 'Garabandal Pilgrimage — Marian Way — October 2026',
  },
  {
    label: 'EN: Waitlist nurture books',
    templateKey: 'waitlist_book_recommendation',
    contact: { name: 'Mary Thompson', email: 'mary@example.com', language: 'en' },
    products: officialProductsEn,
  },
  {
    label: 'EN: Waitlist nurture mission support',
    templateKey: 'waitlist_mission_support',
    contact: { name: 'Mary Thompson', email: 'mary@example.com', language: 'en' },
  },
  {
    label: 'EN: Waitlist nurture member invitation',
    templateKey: 'waitlist_member_invitation',
    contact: { name: 'Mary Thompson', email: 'mary@example.com', language: 'en' },
  },
  {
    label: 'EN: Donor to member',
    templateKey: 'donor_to_member',
    contact: { name: 'John Smith', email: 'john@example.com', language: 'en' },
  },
  {
    label: 'EN: Store book recommendation',
    templateKey: 'store_book_recommendation',
    contact: { name: 'John Smith', email: 'john@example.com', language: 'en' },
    products: officialProductsEn,
  },
  {
    label: 'EN: Donation impact',
    templateKey: 'donation_thank_you_story',
    contact: { name: 'John Smith', email: 'john@example.com', language: 'en' },
  },
  {
    label: 'EN: Referral activation',
    templateKey: 'referral_activation',
    contact: { name: 'John Smith', email: 'john@example.com', language: 'en' },
  },
];

const stripHtml = (html) =>
  html
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<xml[^>]*>[\s\S]*?<\/xml>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const truncate = (s, n = 280) => (s.length > n ? s.slice(0, n) + '…' : s);
const slugify = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const outputDir = join(process.cwd(), 'emails');
mkdirSync(outputDir, { recursive: true });
for (const fileName of readdirSync(outputDir)) {
  if (fileName.startsWith('_preview-marketing-') && fileName.endsWith('.html')) {
    unlinkSync(join(outputDir, fileName));
  }
}

async function main() {
  const { renderMarketingTemplateEmail } = await import('../src/lib/email-renderer.ts');

  for (const sample of samples) {
    const payload = {
      templateKey: sample.templateKey,
      name: sample.contact.name,
      email: sample.contact.email,
      language: sample.contact.language,
      pilgrimageName: sample.pilgrimageName || null,
      pilgrimageUrl: sample.pilgrimageUrl || null,
      pilgrimageImageUrl: sample.pilgrimageImageUrl || null,
      products: sample.products || undefined,
      productTitle: sample.productTitle || null,
      productPrice: sample.productPrice || null,
      productImageUrl: sample.productImageUrl || null,
      productUrl: sample.productUrl || null,
      unsubscribeUrl: 'https://apostoladodegarabandal.com/cancelar-subscricao?preview=1',
    };

    const rendered = renderMarketingTemplateEmail(payload);
    const text = stripHtml(rendered.html);
    const fileName = `_preview-marketing-${slugify(sample.templateKey)}-${slugify(sample.label)}.html`;
    const filePath = join(outputDir, fileName);
    writeFileSync(filePath, rendered.html, 'utf8');

    console.log('═'.repeat(80));
    console.log(`▸ ${sample.label}`);
    console.log(`  template_key: ${sample.templateKey}`);
    console.log(`  preview_file: ${filePath}`);
    console.log(`  name input:   "${sample.contact.name}"`);
    console.log('─'.repeat(80));
    console.log(`  SUBJECT: ${rendered.subject}`);
    console.log('─'.repeat(80));
    console.log(`  TEXT EXCERPT:\n  ${truncate(text)}`);
    console.log('');
  }

  console.log('═'.repeat(80));
  console.log('Done. Inspect the SUBJECT and TEXT EXCERPT for each sample above.');
  console.log('Look for: missing names, raw {{variables}}, awkward placeholders.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
