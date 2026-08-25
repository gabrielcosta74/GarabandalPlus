/**
 * Comunica que Itália + Medjugorje 2027 esgotou.
 *
 * Por defeito é uma simulação. Só envia com `--send`.
 * O lote inclui contactos em português com consentimento explícito e exclui:
 * inscritos ativos nesta peregrinação, suprimidos, quem recebeu marketing nas
 * últimas 24h e quem já recebeu esta campanha.
 *
 *   npx tsx scripts/send-italy-sold-out.ts
 *   npx tsx scripts/send-italy-sold-out.ts --send --max=100
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { Resend } from 'resend';

config({ path: '.env.local' });
config({ path: '.env' });

const PILGRIMAGE_ID = 'a7e2616e-fe39-48dc-968e-b14153c25325';
const TEMPLATE_KEY = 'italy_medjugorje_sold_out';
const CAMPAIGN_SLUG = 'italy-medjugorje-2027-sold-out-2026-08';
const APP_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://apostoladodegarabandal.com').replace(/\/+$/, '');
const FROM = process.env.MARKETING_FROM_EMAIL || 'Apostolado de Garabandal <geral@apostoladodegarabandal.com>';
const PAGE_SIZE = 500;

// `email-renderer` lê este valor durante o import. Fixamo-lo antes do import
// dinâmico para impedir que um ambiente local coloque links localhost num email.
process.env.APP_URL = APP_URL;

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchAll = async <T>(fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>) => {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
};

async function main() {
  const send = process.argv.includes('--send');
  const maxRaw = process.argv.find((arg) => arg.startsWith('--max='));
  const max = Math.max(1, Math.min(500, Number(maxRaw?.split('=')[1] || 100)));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { renderMarketingTemplateEmail } = await import('../src/lib/email-renderer');
  const { createUnsubscribeToken } = await import('../src/lib/unsubscribe-token');
  const { isDeliverableMarketingEmail } = await import('../src/lib/marketing-core');

  const { data: pilgrimage, error: pilgrimageError } = await supabase
    .from('pilgrimages')
    .select('id,title,slug,cover_image')
    .eq('id', PILGRIMAGE_ID)
    .single();
  if (pilgrimageError || !pilgrimage) throw new Error(pilgrimageError?.message || 'Peregrinação não encontrada');

  const { data: bookingRows, error: bookingError } = await supabase
    .from('bookings')
    .select('id,status')
    .eq('pilgrimage_id', PILGRIMAGE_ID);
  if (bookingError) throw new Error(bookingError.message);
  const activeBookingIds = (bookingRows || [])
    .filter((row: any) => !['cancelled', 'canceled'].includes(String(row.status || '').toLowerCase()))
    .map((row: any) => row.id);
  const enrolledEmails = new Set<string>();
  if (activeBookingIds.length) {
    const { data: pilgrims, error: pilgrimsError } = await supabase
      .from('pilgrims')
      .select('email')
      .in('booking_id', activeBookingIds);
    if (pilgrimsError) throw new Error(pilgrimsError.message);
    for (const pilgrim of pilgrims || []) {
      const email = normalizeEmail((pilgrim as any).email);
      if (email) enrolledEmails.add(email);
    }
  }

  const [contacts, suppressions, sentLogs, recentLogs] = await Promise.all([
    fetchAll<any>((from, to) => supabase
      .from('marketing_contacts')
      .select('id,display_name,normalized_email,language,consent_state')
      .eq('language', 'pt')
      .eq('consent_state', 'explicit')
      .not('normalized_email', 'is', null)
      .order('normalized_email')
      .range(from, to)),
    fetchAll<any>((from, to) => supabase
      .from('marketing_suppression_list')
      .select('normalized_email')
      .range(from, to)),
    fetchAll<any>((from, to) => supabase
      .from('marketing_message_logs')
      .select('contact_id')
      .eq('status', 'sent')
      .contains('metadata', { campaign_slug: CAMPAIGN_SLUG })
      .range(from, to)),
    fetchAll<any>((from, to) => supabase
      .from('marketing_message_logs')
      .select('contact_id')
      .eq('status', 'sent')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .range(from, to)),
  ]);

  const suppressedEmails = new Set(suppressions.map((row) => normalizeEmail(row.normalized_email)).filter(Boolean));
  const alreadySentIds = new Set(sentLogs.map((row) => row.contact_id).filter(Boolean));
  const recentlyEmailedIds = new Set(recentLogs.map((row) => row.contact_id).filter(Boolean));
  const skipped = { invalid: 0, enrolled: 0, suppressed: 0, alreadySent: 0, recent24h: 0 };
  const audience = contacts.filter((contact) => {
    const email = normalizeEmail(contact.normalized_email);
    if (!isDeliverableMarketingEmail(email)) { skipped.invalid += 1; return false; }
    if (enrolledEmails.has(email)) { skipped.enrolled += 1; return false; }
    if (suppressedEmails.has(email)) { skipped.suppressed += 1; return false; }
    if (alreadySentIds.has(contact.id)) { skipped.alreadySent += 1; return false; }
    if (recentlyEmailedIds.has(contact.id)) { skipped.recent24h += 1; return false; }
    return true;
  });
  const batch = audience.slice(0, max);

  console.log(JSON.stringify({
    mode: send ? 'SEND' : 'DRY_RUN',
    pilgrimage: pilgrimage.title,
    template: TEMPLATE_KEY,
    explicitPortugueseContacts: contacts.length,
    eligible: audience.length,
    batch: batch.length,
    skipped,
  }, null, 2));

  if (!send) {
    console.log('Simulação concluída. Nenhum email foi enviado.');
    return;
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) throw new Error('Falta RESEND_API_KEY');
  const resend = new Resend(resendApiKey);
  let sent = 0;
  let failed = 0;

  for (const contact of batch) {
    const email = normalizeEmail(contact.normalized_email);
    const { e, t } = createUnsubscribeToken(email);
    const unsubscribeUrl = `${APP_URL}/cancelar-subscricao?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`;
    const { subject, html } = renderMarketingTemplateEmail({
      templateKey: TEMPLATE_KEY,
      name: contact.display_name || '',
      email,
      language: 'pt',
      pilgrimageName: pilgrimage.title,
      pilgrimageImageUrl: pilgrimage.cover_image || '',
      unsubscribeUrl,
    });
    if (/75\s*%|vagas preenchidas|vagas já foram|localhost|127\.0\.0\.1/i.test(`${subject}\n${html}`)) {
      throw new Error('Proteção de envio: o email contém conteúdo ou links inválidos.');
    }

    try {
      const result = await resend.emails.send({
        from: FROM,
        to: [email],
        subject,
        html,
        headers: {
          'List-Unsubscribe': `<${APP_URL}/api/marketing/unsubscribe?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      if ((result as any).error) throw new Error((result as any).error.message || 'Erro do Resend');
      const { error: logError } = await supabase.from('marketing_message_logs').insert({
        contact_id: contact.id,
        channel: 'email',
        to_email: email,
        provider_message_id: (result as any).data?.id || null,
        subject,
        template_key: TEMPLATE_KEY,
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: { source: 'italy_sold_out_script', campaign_slug: CAMPAIGN_SLUG },
      });
      if (logError) throw new Error(`Email enviado, mas não foi possível registar: ${logError.message}`);
      sent += 1;
    } catch (error: any) {
      failed += 1;
      console.error(`Falha ao enviar para contacto ${contact.id}: ${error?.message || String(error)}`);
    }
    await pause(700);
  }

  console.log(JSON.stringify({ sent, failed, remaining: Math.max(0, audience.length - batch.length) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
