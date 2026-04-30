// Standalone render test for marketing templates with real-shape contact data.
// Uses tsx to import the TypeScript renderer directly.
//
// Usage: npx tsx scripts/test-marketing-render.mjs
//
// Outputs subject + plain-text excerpt for each template/contact combo so we
// can spot-check personalisation BEFORE the cron actually sends anything.

import { renderMarketingTemplateEmail } from '../src/lib/email-renderer.ts';

const samples = [
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
  },
  {
    label: 'Donor → member invitation — real name',
    templateKey: 'member_invitation',
    contact: { name: 'Cláudio Emanuel Pereira', email: 'claudio@example.com', language: 'pt' },
  },
  {
    label: 'Abandoned registration FAQ — real name',
    templateKey: 'abandoned_registration_faq',
    contact: { name: 'Rita de Cassia Maria Ribeiro', email: 'rita@example.com', language: 'pt' },
    pilgrimageName: 'Garabandal — Outubro 2026',
  },
  {
    label: 'EN: Member referral activation',
    templateKey: 'referral_activation',
    contact: { name: 'John Smith', email: 'john@example.com', language: 'en' },
  },
];

const stripHtml = (html) =>
  html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const truncate = (s, n = 280) => (s.length > n ? s.slice(0, n) + '…' : s);

for (const sample of samples) {
  const payload = {
    templateKey: sample.templateKey,
    name: sample.contact.name,
    email: sample.contact.email,
    language: sample.contact.language,
    pilgrimageName: sample.pilgrimageName || null,
  };

  const rendered = renderMarketingTemplateEmail(payload);
  const text = stripHtml(rendered.html);

  console.log('═'.repeat(80));
  console.log(`▸ ${sample.label}`);
  console.log(`  template_key: ${sample.templateKey}`);
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
