/**
 * One-off blast: 15% book flash sale (first apparition day, 2 July) to all
 * contactable PT contacts — newsletter + site sources.
 *
 * Renders per-recipient via the real marketing renderer (personalised subject,
 * promo product cards, per-contact unsubscribe link), registers the campaign in
 * `marketing_campaigns` and logs every send in `marketing_message_logs` so the
 * admin outbox and the 1-email/day rate limit see these sends.
 *
 * Usage:
 *   DRY_RUN=1 npx tsx scripts/send-flash-sale-books.ts   # plan only, no emails
 *   npx tsx scripts/send-flash-sale-books.ts             # real send
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
process.env.APP_URL = (process.env.APP_URL || 'https://apostoladodegarabandal.com').replace(/\/+$/, '');

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const TEMPLATE_KEY = 'store_book_flash_sale';
const CAMPAIGN_NAME = 'Flash 15% livros — 1.ª aparição (2026-07-02)';
const SEND_DELAY_MS = 650;
const APP_URL = process.env.APP_URL;

async function main() {
  const { Resend } = await import('resend');
  const { createClient } = await import('@supabase/supabase-js');
  const { renderMarketingTemplateEmail } = await import('../src/lib/email-renderer');
  const { createUnsubscribeToken } = await import('../src/lib/unsubscribe-token');
  const { isStoreBookPromoActive, STORE_BOOK_PROMO } = await import('../src/lib/store-promo');
  const { isDeliverableMarketingEmail } = await import('../src/lib/marketing-core');

  if (!isStoreBookPromoActive()) {
    console.error(`A promoção já terminou (${STORE_BOOK_PROMO.endsAtIso}). Abortado — o email prometeria um desconto inexistente.`);
    process.exit(1);
  }
  if (!process.env.RESEND_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('Faltam env vars (RESEND_API_KEY / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL).');
    process.exit(1);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const rawFrom = (process.env.NOTIFY_EMAIL_FROM || '').trim();
  const fromAddress = rawFrom.includes('<')
    ? (rawFrom.match(/<([^>]+)>/)?.[1]?.trim() || 'no-reply@apostoladodegarabandal.com')
    : rawFrom || 'no-reply@apostoladodegarabandal.com';
  const FROM = `Apostolado de Garabandal <${fromAddress}>`;

  // ---- Audience: PT, contactable, deliverable ----
  const { data: contacts, error: contactsError } = await supabase
    .from('marketing_contacts')
    .select('id,display_name,normalized_email,language,consent_state,source_summary')
    .eq('language', 'pt')
    .not('consent_state', 'in', '(suppressed,unsubscribed)')
    .not('normalized_email', 'is', null)
    .order('normalized_email')
    .range(0, 4999);
  if (contactsError) throw contactsError;

  const deliverable = (contacts || []).filter((c) => isDeliverableMarketingEmail(c.normalized_email));

  // ---- Rate rule: never a 2nd marketing email in the same 24h window ----
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentLogs, error: logsError } = await supabase
    .from('marketing_message_logs')
    .select('contact_id')
    .eq('status', 'sent')
    .gte('created_at', since);
  if (logsError) throw logsError;
  const recentlyEmailed = new Set((recentLogs || []).map((row) => row.contact_id).filter(Boolean));

  const audience = deliverable.filter((c) => !recentlyEmailed.has(c.id));
  const skippedRate = deliverable.length - audience.length;
  const newsletterCount = audience.filter((c) => Boolean((c.source_summary as any)?.newsletter_subscriber)).length;

  console.log(`Audiência PT contactável: ${deliverable.length}`);
  console.log(`  → newsletter: ${newsletterCount} · só-site: ${audience.length - newsletterCount}`);
  console.log(`  → saltados por regra 1 email/24h: ${skippedRate}`);
  console.log(`  → a enviar: ${audience.length}${DRY_RUN ? '  (DRY RUN — nada será enviado)' : ''}`);

  const unsubscribeUrl = (email: string) => {
    const { e, t } = createUnsubscribeToken(email);
    return `${APP_URL}/cancelar-subscricao?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`;
  };
  const oneClickUrl = (email: string) => {
    const { e, t } = createUnsubscribeToken(email);
    return `${APP_URL}/api/marketing/unsubscribe?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`;
  };

  const renderFor = (contact: { display_name: string | null; normalized_email: string }) =>
    renderMarketingTemplateEmail({
      templateKey: TEMPLATE_KEY,
      name: contact.display_name || '',
      email: contact.normalized_email,
      language: 'pt',
      recommendation: null,
      subjectOverride: null,
      bodyOverride: null,
      unsubscribeUrl: unsubscribeUrl(contact.normalized_email),
    } as any);

  if (DRY_RUN) {
    for (const sample of audience.slice(0, 5)) {
      const rendered = renderFor(sample as any);
      console.log(`  · ${sample.normalized_email} → "${rendered.subject}"`);
    }
    if (audience[0]) {
      const rendered = renderFor(audience[0] as any);
      const out = path.resolve(process.cwd(), 'emails/_dryrun-flash-sale-real-contact.html');
      fs.writeFileSync(out, rendered.html);
      console.log(`\nHTML real (1.º contacto) gravado em: ${out}`);
      const hasPromoPrice = rendered.html.includes('14,03');
      console.log(`Preço promocional 14,03 € presente no HTML: ${hasPromoPrice ? 'sim ✅' : 'NÃO ⚠️ verificar'}`);
    }
    console.log('\nDRY RUN concluído. Nenhum email enviado, nada registado.');
    return;
  }

  // ---- Register the campaign so the admin outbox tells the whole story ----
  const { data: campaign, error: campaignError } = await supabase
    .from('marketing_campaigns')
    .insert({
      name: CAMPAIGN_NAME,
      segment_slug: 'newsletter-subscribers',
      subject: 'Só hoje: 15% nos livros de Garabandal',
      template_key: TEMPLATE_KEY,
      status: 'sending',
      metrics: { planned: audience.length, skipped_rate_limited: skippedRate, promo_id: STORE_BOOK_PROMO.id },
    })
    .select('id')
    .single();
  if (campaignError) console.warn('Aviso: campanha não registada:', campaignError.message);
  const campaignId = campaign?.id || null;

  let sent = 0;
  let failed = 0;
  const startedAt = Date.now();

  for (const [index, contact] of audience.entries()) {
    const email = contact.normalized_email as string;
    const rendered = renderFor(contact as any);

    let providerId: string | null = null;
    let errorMessage: string | null = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const result = await resend.emails.send({
          from: FROM,
          to: [email],
          subject: rendered.subject,
          html: rendered.html,
          headers: {
            'List-Unsubscribe': `<${oneClickUrl(email)}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        });
        const resultError = (result as any)?.error;
        if (resultError) {
          const message = String(resultError?.message || resultError);
          if (/rate|429|too many/i.test(message) && attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 2500 * attempt));
            continue;
          }
          errorMessage = message;
        } else {
          providerId = (result as any)?.data?.id || null;
        }
        break;
      } catch (error: any) {
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 2500 * attempt));
          continue;
        }
        errorMessage = error?.message || String(error);
      }
    }

    const ok = !errorMessage;
    if (ok) sent += 1;
    else failed += 1;

    await supabase.from('marketing_message_logs').insert({
      contact_id: contact.id,
      campaign_id: campaignId,
      channel: 'email',
      to_email: email,
      provider_message_id: providerId,
      subject: rendered.subject,
      template_key: TEMPLATE_KEY,
      status: ok ? 'sent' : 'failed',
      error_message: errorMessage,
      sent_at: ok ? new Date().toISOString() : null,
      metadata: { source: 'flash_sale_script', promo_id: STORE_BOOK_PROMO.id },
    });

    if ((index + 1) % 50 === 0 || index === audience.length - 1) {
      console.log(`  ${index + 1}/${audience.length} · enviados ${sent} · falhados ${failed}`);
    }
    await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
  }

  if (campaignId) {
    await supabase
      .from('marketing_campaigns')
      .update({
        status: 'sent',
        metrics: { planned: audience.length, sent, failed, skipped_rate_limited: skippedRate, duration_s: Math.round((Date.now() - startedAt) / 1000), promo_id: STORE_BOOK_PROMO.id },
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId);
  }

  console.log(`\nConcluído: ${sent} enviados, ${failed} falhados, ${skippedRate} saltados (regra 24h).`);
}

main().catch((error) => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
