/**
 * One-off blast: announce the new website to all marketing contacts.
 * Sends the PT or EN version based on each contact's `language`.
 *
 * Usage:
 *   DRY_RUN=1 npx tsx scripts/send-site-announcement.ts   # no emails sent, prints plan
 *   npx tsx scripts/send-site-announcement.ts              # real send
 */
import * as fs from 'fs';
import * as path from 'path';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const APP_URL = 'https://apostoladodegarabandal.com';

const SUBJECTS: Record<'pt' | 'en', string> = {
  pt: '✨ O Apostolado de Garabandal tem um novo website — venha conhecer',
  en: '✨ The Garabandal Apostolate has a new website — come and see',
};

const resend = new Resend(process.env.RESEND_API_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ---- From address (brand-formatted, same logic as src/lib/email.ts) ----
const rawFrom = (process.env.NOTIFY_EMAIL_FROM || '').trim();
const fromAddress = rawFrom.includes('<')
  ? (rawFrom.match(/<([^>]+)>/)?.[1]?.trim() || 'no-reply@apostoladodegarabandal.com')
  : rawFrom || 'no-reply@apostoladodegarabandal.com';
const FROM = `Apostolado de Garabandal <${fromAddress}>`;

// ---- Unsubscribe token (mirrors src/lib/unsubscribe-token.ts) ----
const unsubSecret =
  process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || 'garabandal-unsubscribe';
const unsubscribeUrl = (email: string) => {
  const e = Buffer.from(email.trim().toLowerCase(), 'utf8').toString('base64url');
  const t = createHmac('sha256', unsubSecret)
    .update(email.trim().toLowerCase())
    .digest('base64url');
  return `${APP_URL}/api/marketing/unsubscribe?e=${e}&t=${t}`;
};

// ---- Build the two single-language HTML docs from the combined preview ----
const combined = fs.readFileSync(
  path.resolve(process.cwd(), 'emails/announce-new-site.html'),
  'utf8',
);
const head = combined.slice(combined.indexOf('<head>'), combined.indexOf('</head>') + 7);
const docOpen = `<!DOCTYPE html><html lang="LANG" xmlns="http://www.w3.org/1999/xhtml">${head}<body style="margin:0;padding:0;background:#eef2f8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">`;
const docClose = `</body></html>`;

const sliceBetween = (start: string, end: string) => {
  const a = combined.indexOf(start);
  const b = combined.indexOf(end);
  if (a === -1 || b === -1) throw new Error(`Marker not found: ${start} / ${end}`);
  return combined.slice(a, b);
};

const ptBlock = sliceBetween(
  '<!-- ============================ PORTUGUÊS (BR) ============================ -->',
  '<!-- divider between languages (only for preview convenience) -->',
);
const enBlock = sliceBetween(
  '<!-- ============================ ENGLISH ============================ -->',
  '</body>',
);

const buildHtml = (lang: 'pt' | 'en', email: string) => {
  const block = lang === 'pt' ? ptBlock : enBlock;
  // inject the real per-recipient unsubscribe link (replaces the placeholder href="#")
  const withUnsub = block.replace('href="#"', `href="${unsubscribeUrl(email)}"`);
  return docOpen.replace('LANG', lang === 'pt' ? 'pt-BR' : 'en') + withUnsub + docClose;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { data, error } = await supabase
    .from('marketing_contacts')
    .select('id, normalized_email, language, consent_state')
    .not('normalized_email', 'is', null);
  if (error) throw error;

  const { data: suppressed } = await supabase
    .from('marketing_suppression_list')
    .select('normalized_email');
  const blocked = new Set((suppressed || []).map((s) => s.normalized_email));
  const optOut = new Set(['unsubscribed', 'opted_out', 'bounced', 'complained', 'suppressed']);

  const recipients = (data || [])
    .filter((c) => c.normalized_email && c.normalized_email.includes('@'))
    .filter((c) => !blocked.has(c.normalized_email))
    .filter((c) => !optOut.has((c.consent_state || '').toLowerCase()))
    .map((c) => ({
      id: c.id as string,
      email: c.normalized_email as string,
      lang: ((c.language || 'pt').toLowerCase().startsWith('en') ? 'en' : 'pt') as 'pt' | 'en',
    }));

  const ptCount = recipients.filter((r) => r.lang === 'pt').length;
  const enCount = recipients.filter((r) => r.lang === 'en').length;
  console.log(`\n=== Site announcement blast ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} ===`);
  console.log(`From: ${FROM}`);
  console.log(`Recipients: ${recipients.length}  (pt: ${ptCount}, en: ${enCount})`);
  console.log(`Subjects:\n  pt: ${SUBJECTS.pt}\n  en: ${SUBJECTS.en}\n`);

  if (DRY_RUN) {
    console.log('Sample PT recipient:', recipients.find((r) => r.lang === 'pt')?.email);
    console.log('Sample EN recipient:', recipients.find((r) => r.lang === 'en')?.email);
    fs.writeFileSync('emails/_preview-pt.html', buildHtml('pt', 'exemplo@teste.com'));
    fs.writeFileSync('emails/_preview-en.html', buildHtml('en', 'sample@test.com'));
    console.log('Wrote emails/_preview-pt.html and emails/_preview-en.html for inspection.');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const [i, r] of recipients.entries()) {
    const subject = SUBJECTS[r.lang];
    const html = buildHtml(r.lang, r.email);
    try {
      const { data: sent, error: sendErr } = await resend.emails.send({
        from: FROM,
        to: [r.email],
        subject,
        html,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl(r.email)}>, <mailto:geral@apostoladodegarabandal.com?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      if (sendErr) throw new Error(JSON.stringify(sendErr));
      ok++;
      console.log(`[${i + 1}/${recipients.length}] ✓ ${r.lang} ${r.email}`);
      await supabase.from('marketing_message_logs').insert({
        contact_id: r.id,
        channel: 'email',
        to_email: r.email,
        provider_message_id: sent?.id || null,
        subject,
        template_key: 'site_announcement_2026',
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: { campaign: 'new_website_announcement', lang: r.lang },
      });
    } catch (e: any) {
      fail++;
      console.error(`[${i + 1}/${recipients.length}] ✗ ${r.email}: ${e.message}`);
      await supabase.from('marketing_message_logs').insert({
        contact_id: r.id,
        channel: 'email',
        to_email: r.email,
        subject,
        template_key: 'site_announcement_2026',
        status: 'failed',
        error_message: String(e.message).slice(0, 500),
        metadata: { campaign: 'new_website_announcement', lang: r.lang },
      });
    }
    await sleep(550); // ~2/sec, respects Resend rate limit
  }

  console.log(`\n=== Done. Sent: ${ok}, Failed: ${fail} ===`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
