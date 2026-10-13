/**
 * Email de acesso antecipado — Caminho Mariano 2027 (link + código).
 *
 * Audiência: leads do formulário /acesso-antecipado (booking_leads,
 * source = early_access_page). Exclui supressos/unsubscritos, endereços não
 * entregáveis, quem já está inscrito na peregrinação e quem já recebeu este
 * email (dedupe por campaign_slug). O código é lido de pilgrimage_access —
 * nunca fica escrito no código-fonte.
 *
 * DRY RUN é o modo por defeito (grava previews em emails/ e não envia nada).
 *
 * Uso:
 *   npx tsx scripts/send-early-access-email.ts            # dry run
 *   SEND=1 npx tsx scripts/send-early-access-email.ts     # envia
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
process.env.APP_URL = (process.env.APP_URL || 'https://apostoladodegarabandal.com').replace(/\/+$/, '');

const SEND = process.env.SEND === '1';
const PILGRIMAGE_SLUG = 'peregrinacao-mariana-2027';
const CAMPAIGN_SLUG = 'early-access-code-caminho-mariano-2027';
const TEMPLATE_KEY = 'early_access_code';
const APP_URL = process.env.APP_URL as string;

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('Faltam env vars (SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL).');
    process.exit(1);
  }
  if (SEND && !process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY em falta — nada foi enviado.');
    process.exit(1);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const { renderEarlyAccessCodeEmail } = await import('../src/lib/email-renderer');
  const { isDeliverableMarketingEmail } = await import('../src/lib/marketing-core');
  const { createUnsubscribeToken } = await import('../src/lib/unsubscribe-token');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: pilgrimage, error: pilgrimageError } = await supabase
    .from('pilgrimages')
    .select('id,slug')
    .eq('slug', PILGRIMAGE_SLUG)
    .single();
  if (pilgrimageError || !pilgrimage) throw pilgrimageError || new Error('Peregrinação não encontrada');

  const { data: access, error: accessError } = await supabase
    .from('pilgrimage_access')
    .select('access_code')
    .eq('pilgrimage_id', pilgrimage.id)
    .maybeSingle();
  if (accessError || !access?.access_code) throw accessError || new Error('Código de acesso não definido');
  // Sem hífen: evita confusão ao ler/digitar. O site aceita com ou sem hífen.
  const accessCode = String(access.access_code).replace(/[\s-]+/g, '').toUpperCase();

  // ---- Leads do acesso antecipado ----
  const { data: leads, error: leadsError } = await supabase
    .from('booking_leads')
    .select('email,name,data')
    .eq('status', 'interested')
    .filter('data->>source', 'eq', 'early_access_page');
  if (leadsError) throw leadsError;

  // ---- Contactos (consentimento / id para o registo) ----
  const emails = Array.from(new Set((leads || []).map((l: any) => String(l.email || '').trim().toLowerCase()).filter(Boolean)));
  const { data: contacts, error: contactsError } = await supabase
    .from('marketing_contacts')
    .select('id,display_name,normalized_email,consent_state')
    .in('normalized_email', emails);
  if (contactsError) throw contactsError;
  const contactByEmail = new Map((contacts || []).map((c: any) => [String(c.normalized_email).toLowerCase(), c]));

  // ---- Já inscritos nesta peregrinação ----
  const { data: bookingRows } = await supabase.from('bookings').select('id,status').eq('pilgrimage_id', pilgrimage.id);
  const activeBookingIds = (bookingRows || [])
    .filter((row: any) => !['cancelled', 'canceled'].includes(String(row.status || '').toLowerCase()))
    .map((row: any) => row.id);
  const enrolled = new Set<string>();
  if (activeBookingIds.length) {
    const { data: pilgrimRows } = await supabase.from('pilgrims').select('email').in('booking_id', activeBookingIds);
    for (const row of pilgrimRows || []) {
      const email = String(row.email || '').trim().toLowerCase();
      if (email) enrolled.add(email);
    }
  }

  // ---- Já enviado ----
  const { data: sentRows, error: sentError } = await supabase
    .from('marketing_message_logs')
    .select('contact_id')
    .eq('status', 'sent')
    .contains('metadata', { campaign_slug: CAMPAIGN_SLUG });
  if (sentError) throw sentError;
  const alreadySent = new Set((sentRows || []).map((r: any) => r.contact_id).filter(Boolean));

  type Target = { contactId: string; email: string; name: string; locale: 'pt' | 'en' };
  const skipped = { noContact: 0, blocked: 0, undeliverable: 0, enrolled: 0, alreadySent: 0 };
  const targets: Target[] = [];
  const seen = new Set<string>();
  for (const lead of leads || []) {
    const email = String(lead.email || '').trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    const contact: any = contactByEmail.get(email);
    if (!contact) { skipped.noContact += 1; continue; }
    if (['suppressed', 'unsubscribed'].includes(contact.consent_state)) { skipped.blocked += 1; continue; }
    if (!isDeliverableMarketingEmail(email)) { skipped.undeliverable += 1; continue; }
    if (enrolled.has(email)) { skipped.enrolled += 1; continue; }
    if (alreadySent.has(contact.id)) { skipped.alreadySent += 1; continue; }
    targets.push({
      contactId: contact.id,
      email,
      name: (lead.name || contact.display_name || '').trim(),
      locale: lead.data?.locale === 'en' ? 'en' : 'pt',
    });
  }

  const unsubscribeUrl = (email: string, locale: 'pt' | 'en') => {
    const { e, t } = createUnsubscribeToken(email);
    return `${APP_URL}${locale === 'en' ? '/en/unsubscribe' : '/cancelar-subscricao'}?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`;
  };
  const oneClickUrl = (email: string) => {
    const { e, t } = createUnsubscribeToken(email);
    return `${APP_URL}/api/marketing/unsubscribe?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`;
  };
  const renderFor = (t: Target) =>
    renderEarlyAccessCodeEmail({
      name: t.name,
      locale: t.locale,
      accessCode,
      pilgrimageUrl:
        t.locale === 'en'
          ? `${APP_URL}/en/pilgrimages/${PILGRIMAGE_SLUG}`
          : `${APP_URL}/peregrinacoes/${PILGRIMAGE_SLUG}`,
      unsubscribeUrl: unsubscribeUrl(t.email, t.locale),
    });

  const pt = targets.filter((t) => t.locale === 'pt').length;
  console.log(`Leads de acesso antecipado: ${seen.size}`);
  console.log(`Excluídos: ${JSON.stringify(skipped)}`);
  console.log(`A enviar: ${targets.length} (PT ${pt} · EN ${targets.length - pt})`);

  if (!SEND) {
    for (const locale of ['pt', 'en'] as const) {
      const sample = targets.find((t) => t.locale === locale) || { contactId: '', email: 'preview@example.com', name: 'Maria', locale };
      const rendered = renderFor(sample);
      const out = path.resolve(process.cwd(), `emails/_preview-early-access-${locale}.html`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, rendered.html);
      console.log(`[${locale.toUpperCase()}] "${rendered.subject}"\n  preview: ${out}`);
    }
    console.log('\nDRY RUN concluído. Nada foi enviado nem registado. Para enviar: SEND=1 …');
    return;
  }

  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY as string);
  const rawFrom = (process.env.NOTIFY_EMAIL_FROM || '').trim();
  const fromAddress = rawFrom.includes('<')
    ? rawFrom.match(/<([^>]+)>/)?.[1]?.trim() || 'no-reply@apostoladodegarabandal.com'
    : rawFrom || 'no-reply@apostoladodegarabandal.com';
  const FROM = `Apostolado de Garabandal <${fromAddress}>`;

  const { data: campaign } = await supabase
    .from('marketing_campaigns')
    .insert({
      name: 'Caminho Mariano 2027 · Acesso antecipado (link + código)',
      segment_slug: 'early-access-leads',
      subject: 'Já pode se inscrever: Caminho Mariano 2027 (acesso antecipado)',
      template_key: TEMPLATE_KEY,
      status: 'active',
      metrics: { campaign_slug: CAMPAIGN_SLUG, audience: targets.length, sent: 0, failed: 0 },
    })
    .select('id')
    .single();
  const campaignId = campaign?.id || null;

  let sent = 0;
  let failed = 0;
  for (const target of targets) {
    const rendered = renderFor(target);
    let providerId: string | null = null;
    let errorMessage: string | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const result: any = await resend.emails.send({
          from: FROM,
          to: [target.email],
          subject: rendered.subject,
          html: rendered.html,
          headers: {
            'List-Unsubscribe': `<${oneClickUrl(target.email)}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        });
        if (result?.error) {
          const message = String(result.error?.message || result.error);
          if (/rate|429|too many/i.test(message) && attempt < 3) {
            await new Promise((r) => setTimeout(r, 2500 * attempt));
            continue;
          }
          errorMessage = message;
        } else {
          providerId = result?.data?.id || null;
        }
        break;
      } catch (error: any) {
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 2500 * attempt));
          continue;
        }
        errorMessage = error?.message || String(error);
      }
    }
    const ok = !errorMessage;
    if (ok) sent += 1; else failed += 1;

    await supabase.from('marketing_message_logs').insert({
      contact_id: target.contactId,
      campaign_id: campaignId,
      channel: 'email',
      to_email: target.email,
      provider_message_id: providerId,
      subject: rendered.subject,
      template_key: TEMPLATE_KEY,
      status: ok ? 'sent' : 'failed',
      error_message: errorMessage,
      sent_at: ok ? new Date().toISOString() : null,
      metadata: { source: 'early_access_email', campaign_slug: CAMPAIGN_SLUG },
    });
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${target.email}${errorMessage ? ` — ${errorMessage}` : ''}`);
    await new Promise((r) => setTimeout(r, 650));
  }

  if (campaignId) {
    await supabase
      .from('marketing_campaigns')
      .update({ status: 'completed', metrics: { campaign_slug: CAMPAIGN_SLUG, audience: targets.length, sent, failed } })
      .eq('id', campaignId);
  }
  console.log(`\nConcluído: enviados ${sent} · falhados ${failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
