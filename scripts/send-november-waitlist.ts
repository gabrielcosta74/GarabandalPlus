// One-off: send the "waitlist_more_spots" email to the November pilgrimage waiting list.
//
// Safety:
//  - Dedupes by email, excludes marketing_suppression_list (unsubscribed/bounced),
//    excludes internal/synthetic emails, skips anyone already sent this template.
//  - Adds unsubscribe + RFC 8058 List-Unsubscribe headers (via sendMarketingEmail).
//  - Logs every send into marketing_message_logs (so the anti-spam governor + history are correct).
//  - DRY RUN by default. Real send only when env SEND=1.
//
// Run (dry):  npx tsx --env-file=.env scripts/send-november-waitlist.ts
// Run (send): SEND=1 npx tsx --env-file=.env scripts/send-november-waitlist.ts

import { createClient } from '@supabase/supabase-js';

const NOV_SLUG = 'peregrinacao-iberico-novembro-2026';
const TEMPLATE_KEY = 'waitlist_more_spots';
const SEND = process.env.SEND === '1';

process.env.APP_URL = (process.env.APP_URL || 'https://apostoladodegarabandal.com').replace(/\/+$/, '');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) throw new Error('Missing Supabase env.');
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const isSyntheticEmail = (e: string) =>
  !e || e.endsWith('@chat.local') || e.endsWith('@placeholder') || e.startsWith('interesse+') || e.endsWith('@placeholder.com') || e === 'no-email@placeholder';

async function main() {
  const { sendMarketingEmail } = await import('../src/lib/email-renderer.ts').then(() => import('../src/lib/marketing-email.ts'));

  const { data: nov, error: pErr } = await db
    .from('pilgrimages')
    .select('id, title, slug, cover_image')
    .eq('slug', NOV_SLUG)
    .single();
  if (pErr || !nov) throw new Error('November pilgrimage not found: ' + (pErr?.message || ''));

  const pilgrimageUrl = `${process.env.APP_URL}/peregrinacoes/${nov.slug}`;

  const { data: rows, error: wErr } = await db
    .from('pilgrimage_waitlists')
    .select('email, full_name, notes, created_at')
    .eq('pilgrimage_id', nov.id)
    .order('created_at', { ascending: true });
  if (wErr) throw wErr;

  // Suppression list
  const { data: suppressed } = await db.from('marketing_suppression_list').select('normalized_email');
  const suppressedSet = new Set((suppressed || []).map((s: any) => (s.normalized_email || '').toLowerCase()));

  // Already sent this template
  const { data: alreadyLogs } = await db
    .from('marketing_message_logs')
    .select('to_email')
    .eq('template_key', TEMPLATE_KEY);
  const alreadySet = new Set((alreadyLogs || []).map((l: any) => (l.to_email || '').toLowerCase()));

  const seen = new Set<string>();
  const recipients: { email: string; name: string; locale: 'pt' | 'en' }[] = [];
  const skipped: { email: string; reason: string }[] = [];

  for (const r of rows || []) {
    const email = (r.email || '').trim().toLowerCase();
    const name = (r.full_name || '').trim();
    const locale: 'pt' | 'en' = /\[locale:en\]/i.test(r.notes || '') ? 'en' : 'pt';
    if (!email) { skipped.push({ email: '(vazio)', reason: 'sem email' }); continue; }
    if (isSyntheticEmail(email)) { skipped.push({ email, reason: 'email sintético' }); continue; }
    if (suppressedSet.has(email)) { skipped.push({ email, reason: 'suprimido (unsub)' }); continue; }
    if (alreadySet.has(email)) { skipped.push({ email, reason: 'já enviado' }); continue; }
    if (seen.has(email)) { skipped.push({ email, reason: 'duplicado' }); continue; }
    seen.add(email);
    recipients.push({ email, name, locale });
  }

  console.log(`\nPeregrinação: ${nov.title}`);
  console.log(`Template: ${TEMPLATE_KEY}  |  Modo: ${SEND ? '🚨 ENVIO REAL' : 'DRY-RUN (não envia)'}`);
  console.log(`Destinatários únicos elegíveis: ${recipients.length}  |  Ignorados: ${skipped.length}`);
  console.log('─'.repeat(70));
  recipients.forEach((r, i) => console.log(`  ${i + 1}. ${r.email}  (${r.name || 'sem nome'}) [${r.locale}]`));
  if (skipped.length) {
    console.log('  Ignorados:');
    skipped.forEach((s) => console.log(`    - ${s.email}: ${s.reason}`));
  }
  console.log('─'.repeat(70));

  if (!SEND) {
    // Render one to confirm output, no send.
    const { renderMarketingEmail } = await import('../src/lib/marketing-email.ts');
    const sample = recipients[0];
    if (sample) {
      const rendered = renderMarketingEmail({
        contact: { display_name: sample.name, normalized_email: sample.email, language: sample.locale, recommendation: null },
        templateKey: TEMPLATE_KEY,
        context: { pilgrimageName: nov.title, pilgrimageUrl, pilgrimageImageUrl: nov.cover_image, pilgrimageStatus: 'waitlist' },
      });
      console.log(`SUBJECT (exemplo p/ ${sample.email}): ${rendered.subject}`);
    }
    console.log('\nDRY-RUN concluído. Nada foi enviado. Para enviar: SEND=1 npx tsx --env-file=.env scripts/send-november-waitlist.ts\n');
    return;
  }

  let ok = 0, fail = 0;
  for (const r of recipients) {
    const res = await sendMarketingEmail({
      contact: { display_name: r.name, normalized_email: r.email, language: r.locale, recommendation: null },
      templateKey: TEMPLATE_KEY,
      context: { pilgrimageName: nov.title, pilgrimageUrl, pilgrimageImageUrl: nov.cover_image, pilgrimageStatus: 'waitlist' },
    });
    await db.from('marketing_message_logs').insert({
      channel: 'email',
      to_email: r.email,
      subject: res.subject || null,
      template_key: TEMPLATE_KEY,
      status: res.sent ? 'sent' : 'failed',
      error_message: res.sent ? null : (res.error || 'unknown'),
      provider_message_id: res.sent ? (res.providerId || null) : null,
      sent_at: new Date().toISOString(),
      metadata: { source: 'manual_november_waitlist', pilgrimage_id: nov.id },
    });
    if (res.sent) { ok++; console.log(`  ✓ ${r.email}`); }
    else { fail++; console.log(`  ✗ ${r.email} — ${res.error}`); }
    await new Promise((res) => setTimeout(res, 600));
  }
  console.log(`\nConcluído. Enviados: ${ok}  |  Falhados: ${fail}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
