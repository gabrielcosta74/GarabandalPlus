/**
 * Convite para o acesso antecipado — Caminho Mariano 2027.
 *
 * Audiência: toda a base contactável MENOS quem já está inscrito na
 * peregrinação de Novembro 2026 e na de Itália + Medjugorje (abril 2027).
 *
 * - DRY RUN é o modo por defeito: mostra a audiência real, grava previews PT/EN
 *   em emails/ e NÃO envia nada nem escreve na base. O envio exige SEND=1.
 * - Os links são sempre de produção (apostoladodegarabandal.com), mesmo a
 *   correr da shell local.
 * - Dedupe: quem já recebeu este convite não recebe outra vez, e respeita-se a
 *   regra de 1 email de marketing por contacto/24h.
 *
 * Uso:
 *   npx tsx scripts/send-early-access-invite.ts                  # dry run + previews
 *   SEND=1 npx tsx scripts/send-early-access-invite.ts           # envia um lote
 *   SEND=1 MAX_SENDS=150 npx tsx scripts/send-early-access-invite.ts
 *   ONLY=me@exemplo.com SEND=1 npx tsx scripts/send-early-access-invite.ts   # teste a 1 endereço
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Os links do email têm de ser sempre de produção, mesmo a correr localmente.
process.env.APP_URL = (process.env.APP_URL || 'https://apostoladodegarabandal.com').replace(/\/+$/, '');

const SEND = process.env.SEND === '1';
const MAX_SENDS = Math.max(1, Math.min(500, Number(process.env.MAX_SENDS || 200)));
const ONLY = (process.env.ONLY || '').trim().toLowerCase();
const SEND_DELAY_MS = Math.max(0, Number(process.env.SEND_DELAY_MS || 650));

const CAMPAIGN_SLUG = 'early-access-caminho-mariano-2027-invite';
const CAMPAIGN_NAME = 'Convite acesso antecipado — Caminho Mariano 2027';
const SEGMENT_SLUG = 'all-contacts-except-nov-2026-and-italy-2027-enrolled';

/** Peregrinações cujos inscritos NÃO devem receber este convite. */
const EXCLUDED_PILGRIMAGE_IDS = [
  '5c655de3-8fb3-48be-ab15-1543405b2658', // Caminho Ibérico — Novembro 2026
  'a7e2616e-fe39-48dc-968e-b14153c25325', // Itália + Medjugorje — Abril 2027
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Contact = {
  id: string;
  display_name: string | null;
  normalized_email: string;
  language: string | null;
  consent_state: string | null;
};

const localeOf = (contact: Contact): 'pt' | 'en' => (contact.language === 'pt' ? 'pt' : 'en');

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
  const { renderEarlyAccessInviteEmail } = await import('../src/lib/emails/early-access-invite');
  const { createUnsubscribeToken } = await import('../src/lib/unsubscribe-token');
  const { isDeliverableMarketingEmail } = await import('../src/lib/marketing-core');
  const APP_URL = process.env.APP_URL!;

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // ---- Exclusão: quem já está inscrito nas peregrinações protegidas ----
  const { data: bookingRows, error: bookingsError } = await supabase
    .from('bookings')
    .select('id,status,pilgrimage_id')
    .in('pilgrimage_id', EXCLUDED_PILGRIMAGE_IDS);
  if (bookingsError) throw bookingsError;

  const activeBookingIds = (bookingRows || [])
    .filter((row: any) => !['cancelled', 'canceled'].includes(String(row.status || '').toLowerCase()))
    .map((row: any) => row.id);

  const enrolledEmails = new Set<string>();
  if (activeBookingIds.length) {
    const { data: pilgrimRows, error: pilgrimsError } = await supabase
      .from('pilgrims')
      .select('email,booking_id')
      .in('booking_id', activeBookingIds);
    if (pilgrimsError) throw pilgrimsError;
    for (const row of pilgrimRows || []) {
      const email = String(row.email || '').trim().toLowerCase();
      if (email) enrolledEmails.add(email);
    }
  }

  // ---- Audiência: base contactável menos inscritos ----
  // PostgREST corta em `db.max_rows` (1000 neste projeto) e não avisa: um
  // `.range(0, 4999)` devolve 1000 linhas silenciosamente e perde-se o resto da
  // base. Paginamos até vir uma página incompleta.
  const PAGE = 1000;
  const contactRows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data: page, error: pageError } = await supabase
      .from('marketing_contacts')
      .select('id,display_name,normalized_email,language,consent_state')
      .not('consent_state', 'in', '(suppressed,unsubscribed)')
      .not('normalized_email', 'is', null)
      .order('normalized_email')
      .range(from, from + PAGE - 1);
    if (pageError) throw pageError;
    contactRows.push(...(page || []));
    if (!page || page.length < PAGE) break;
  }

  const audience: Contact[] = (contactRows || [])
    .filter((c: any) => isDeliverableMarketingEmail(c.normalized_email))
    .filter((c: any) => !enrolledEmails.has(String(c.normalized_email).trim().toLowerCase()));

  // ---- Dedupe: já recebeu este convite? ----
  const { data: sentRows, error: sentError } = await supabase
    .from('marketing_message_logs')
    .select('contact_id')
    .eq('status', 'sent')
    .contains('metadata', { campaign_slug: CAMPAIGN_SLUG });
  if (sentError) throw sentError;
  const alreadySent = new Set((sentRows || []).map((r: any) => r.contact_id).filter(Boolean));

  // ---- Regra: 1 email de marketing por contacto/24h ----
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentRows, error: recentError } = await supabase
    .from('marketing_message_logs')
    .select('contact_id')
    .eq('status', 'sent')
    .gte('created_at', since);
  if (recentError) throw recentError;
  const recentlyEmailed = new Set((recentRows || []).map((r: any) => r.contact_id).filter(Boolean));

  const pending = audience.filter((c) => !alreadySent.has(c.id));
  const eligibleNow = pending.filter((c) => !recentlyEmailed.has(c.id));
  const targetPool = ONLY ? eligibleNow.filter((c) => c.normalized_email.toLowerCase() === ONLY) : eligibleNow;
  const batch = targetPool.slice(0, MAX_SENDS);

  const unsubscribeUrl = (email: string, locale: 'pt' | 'en') => {
    const { e, t } = createUnsubscribeToken(email);
    const p = locale === 'en' ? '/en/unsubscribe' : '/cancelar-subscricao';
    return `${APP_URL}${p}?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`;
  };
  const oneClickUrl = (email: string) => {
    const { e, t } = createUnsubscribeToken(email);
    return `${APP_URL}/api/marketing/unsubscribe?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`;
  };

  const renderFor = (contact: Contact) => {
    const locale = localeOf(contact);
    const firstName = (contact.display_name || '').trim().split(/\s+/)[0] || '';
    return renderEarlyAccessInviteEmail({
      locale,
      recipientName: firstName,
      unsubscribeUrl: unsubscribeUrl(contact.normalized_email, locale),
    });
  };

  const ptCount = audience.filter((c) => localeOf(c) === 'pt').length;
  const enCount = audience.length - ptCount;

  console.log(`Campanha: ${CAMPAIGN_NAME}`);
  console.log(`Segmento: ${SEGMENT_SLUG}`);
  console.log(`Inscritos excluídos (Nov 2026 + Itália/Medjugorje 2027): ${enrolledEmails.size} emails`);
  console.log(`Audiência contactável: ${audience.length}  (PT ${ptCount} · EN ${enCount})`);
  console.log(`  → já recebeu este convite: ${alreadySent.size}`);
  console.log(`  → adiados pela regra 24h: ${pending.length - eligibleNow.length}`);
  if (ONLY) console.log(`  → filtro ONLY=${ONLY}: ${targetPool.length} correspondência(s)`);
  console.log(`  → neste lote (teto ${MAX_SENDS}): ${batch.length}`);

  if (!SEND) {
    for (const locale of ['pt', 'en'] as const) {
      const sample =
        batch.find((c) => localeOf(c) === locale) ||
        audience.find((c) => localeOf(c) === locale) ||
        ({
          id: 'preview',
          display_name: locale === 'en' ? 'Mary' : 'Maria',
          normalized_email: 'preview@example.com',
          language: locale,
          consent_state: 'explicit',
        } as Contact);
      const rendered = renderFor(sample);
      const out = path.resolve(process.cwd(), `emails/_preview-early-access-invite-${locale}.html`);
      fs.writeFileSync(out, rendered.html);
      console.log(`\n[${locale.toUpperCase()}] "${rendered.subject}"\n  preview: ${out}`);
    }
    const linkCheck = renderFor(batch[0] || ({ id: 'x', display_name: 'Maria', normalized_email: 'preview@example.com', language: 'pt', consent_state: 'explicit' } as Contact));
    console.log(`\nLinks de produção: ${linkCheck.html.includes('https://apostoladodegarabandal.com') ? 'OK' : 'FALHA'}`);
    console.log(`Contém localhost: ${linkCheck.html.includes('localhost') ? 'SIM — NÃO ENVIAR' : 'não'}`);
    console.log('\nDRY RUN concluído. Nenhum email enviado, nada registado. Para enviar: SEND=1 …');
    return;
  }

  if (!batch.length) {
    console.log('Nada a enviar.');
    return;
  }

  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY!);

  const rawFrom = (process.env.NOTIFY_EMAIL_FROM || '').trim();
  const fromAddress = rawFrom.includes('<')
    ? rawFrom.match(/<([^>]+)>/)?.[1]?.trim() || 'no-reply@apostoladodegarabandal.com'
    : rawFrom || 'no-reply@apostoladodegarabandal.com';
  const FROM = `Apostolado de Garabandal <${fromAddress}>`;

  // ---- Campanha: uma linha reutilizada entre lotes ----
  const { data: existingCampaign } = await supabase
    .from('marketing_campaigns')
    .select('id')
    .contains('metrics', { campaign_slug: CAMPAIGN_SLUG })
    .maybeSingle();

  let campaignId = existingCampaign?.id || null;
  if (!campaignId) {
    const { data: campaign, error: campaignError } = await supabase
      .from('marketing_campaigns')
      .insert({
        name: CAMPAIGN_NAME,
        segment_slug: SEGMENT_SLUG,
        subject: 'Seu convite VIP — Caminho Mariano 2027',
        template_key: 'early_access_invite',
        status: 'active',
        metrics: { campaign_slug: CAMPAIGN_SLUG, audience: audience.length, sent: 0, failed: 0 },
      })
      .select('id')
      .single();
    if (campaignError) console.warn('[early-access] campanha não registada:', campaignError.message);
    campaignId = campaign?.id || null;
  }

  let sent = 0;
  let failed = 0;

  for (const contact of batch) {
    const email = contact.normalized_email;
    const rendered = renderFor(contact);

    let providerId: string | null = null;
    let errorMessage: string | null = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const result: any = await resend.emails.send({
          from: FROM,
          to: [email],
          subject: rendered.subject,
          html: rendered.html,
          headers: {
            'List-Unsubscribe': `<${oneClickUrl(email)}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        });
        if (result?.error) {
          const message = String(result.error?.message || result.error);
          if (/rate|429|too many/i.test(message) && attempt < 3) {
            await sleep(2500 * attempt);
            continue;
          }
          errorMessage = message;
        } else {
          providerId = result?.data?.id || null;
          errorMessage = null;
        }
        break;
      } catch (error: any) {
        errorMessage = String(error?.message || error);
        if (attempt < 3) {
          await sleep(2500 * attempt);
          continue;
        }
      }
    }

    if (errorMessage) {
      failed += 1;
      console.warn(`  ✗ ${email}: ${errorMessage}`);
    } else {
      sent += 1;
      console.log(`  ✓ ${email}`);
    }

    await supabase.from('marketing_message_logs').insert({
      contact_id: contact.id,
      campaign_id: campaignId,
      channel: 'email',
      to_email: email,
      status: errorMessage ? 'failed' : 'sent',
      subject: rendered.subject,
      template_key: 'early_access_invite',
      provider_message_id: providerId,
      error_message: errorMessage,
      sent_at: errorMessage ? null : new Date().toISOString(),
      metadata: { campaign_slug: CAMPAIGN_SLUG, locale: localeOf(contact) },
    });

    if (SEND_DELAY_MS) await sleep(SEND_DELAY_MS);
  }

  console.log(`\nLote: ${batch.length} · enviados ${sent} · falhados ${failed}`);
  console.log(`Restam ${Math.max(0, pending.length - sent)} para próximas corridas.`);
}

main().catch((error) => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
