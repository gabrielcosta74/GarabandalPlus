/**
 * Envia o aviso de vagas extra da Itália + Medjugorje a quem está na lista de
 * espera e ainda NÃO está inscrito.
 *
 *   npx tsx scripts/send-italy-more-spots.ts            # simulação (não envia)
 *   npx tsx scripts/send-italy-more-spots.ts --send     # envia mesmo
 *
 * Exclusões aplicadas, por esta ordem:
 *   1. quem já tem inscrição ativa nesta peregrinação
 *   2. quem está em `marketing_suppression_list` ou com consent_state
 *      suppressed/unsubscribed  (não é opcional — pediram para sair)
 *   3. duplicados de email na lista de espera
 *
 * Grava em `marketing_message_logs` para não haver envio repetido.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { Resend } from 'resend';

import { renderMarketingTemplateEmail } from '../src/lib/email-renderer';
import { createUnsubscribeToken } from '../src/lib/unsubscribe-token';

config({ path: '.env.local' });
config({ path: '.env' });

const PILGRIMAGE_ID = 'a7e2616e-fe39-48dc-968e-b14153c25325';
const TEMPLATE_KEY = 'italy_medjugorje_more_spots';
const CAMPAIGN_SLUG = 'italy-more-spots-2026-08';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://apostoladodegarabandal.com';
const FROM = process.env.MARKETING_FROM_EMAIL || 'Apostolado de Garabandal <geral@apostoladodegarabandal.com>';

/**
 * Correções manuais de idioma.
 *
 * O `marketing_contacts.language` marca estes contactos como PT, mas os nomes e
 * os telefones (+1) são norte-americanos. Sem isto receberiam o email em
 * português.
 */
const LOCALE_OVERRIDES: Record<string, 'pt' | 'en'> = {
  // Preencher com email -> idioma quando o `marketing_contacts.language` estiver
  // errado. Aconteceu no envio de agosto de 2026: dois contactos
  // norte-americanos estavam marcados como PT. Fica vazio em git para não
  // guardar moradas de correio de peregrinos no repositório.
};

const norm = (v: unknown) => String(v || '').trim().toLowerCase();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const send = process.argv.includes('--send');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(url, key);

  const { data: pilgrimage, error: pErr } = await supabase
    .from('pilgrimages')
    .select('title,title_en,slug,cover_image,cover_image_en,status,current_vacancies,total_vacancies')
    .eq('id', PILGRIMAGE_ID)
    .single();
  if (pErr) throw pErr;

  const vacancies = Number(pilgrimage.current_vacancies || 0);
  if (pilgrimage.status !== 'open') throw new Error(`Peregrinação está "${pilgrimage.status}", não "open" — o botão não permitiria inscrição.`);
  if (vacancies <= 0) throw new Error('Não há vagas disponíveis — o email anunciaria 0 vagas.');

  // --- Lista de espera ---
  const { data: waitlist, error: wErr } = await supabase
    .from('pilgrimage_waitlists')
    .select('email,full_name,created_at')
    .eq('pilgrimage_id', PILGRIMAGE_ID)
    .order('created_at');
  if (wErr) throw wErr;

  // --- Já inscritos (excluir) ---
  const { data: bookings } = await supabase
    .from('bookings').select('id').eq('pilgrimage_id', PILGRIMAGE_ID).neq('status', 'cancelled');
  const bookingIds = (bookings || []).map((b: any) => b.id);
  const enrolled = new Set<string>();
  if (bookingIds.length) {
    const { data: pilgrims } = await supabase.from('pilgrims').select('email').in('booking_id', bookingIds);
    for (const row of pilgrims || []) if (norm(row.email)) enrolled.add(norm(row.email));
  }

  // --- Supressões (não negociável) ---
  const { data: suppressed } = await supabase.from('marketing_suppression_list').select('normalized_email');
  const suppressedSet = new Set((suppressed || []).map((r: any) => norm(r.normalized_email)).filter(Boolean));

  const { data: contacts } = await supabase
    .from('marketing_contacts').select('id,display_name,normalized_email,language,consent_state');
  const contactBy = new Map<string, any>();
  for (const c of contacts || []) if (norm(c.normalized_email)) contactBy.set(norm(c.normalized_email), c);

  // --- Já enviados nesta campanha ---
  const { data: sentLogs } = await supabase
    .from('marketing_message_logs').select('contact_id').eq('status', 'sent').contains('metadata', { campaign_slug: CAMPAIGN_SLUG });
  const alreadySent = new Set((sentLogs || []).map((r: any) => r.contact_id).filter(Boolean));

  // --- Construir destinatários ---
  const seen = new Set<string>();
  const recipients: any[] = [];
  const skipped: { name: string; email: string; reason: string }[] = [];

  for (const row of waitlist || []) {
    const email = norm(row.email);
    const name = String(row.full_name || '').trim();
    if (!email || !email.includes('@')) { skipped.push({ name, email: String(row.email || ''), reason: 'email inválido' }); continue; }
    if (seen.has(email)) { skipped.push({ name, email, reason: 'duplicado na lista de espera' }); continue; }
    seen.add(email);
    if (enrolled.has(email)) { skipped.push({ name, email, reason: 'já inscrito' }); continue; }

    const contact = contactBy.get(email);
    if (suppressedSet.has(email) || ['suppressed', 'unsubscribed'].includes(String(contact?.consent_state))) {
      skipped.push({ name, email, reason: 'pediu para não receber' }); continue;
    }
    if (contact?.id && alreadySent.has(contact.id)) { skipped.push({ name, email, reason: 'já recebeu este email' }); continue; }

    const locale = LOCALE_OVERRIDES[email] || (String(contact?.language) === 'en' ? 'en' : 'pt');
    recipients.push({ email, name: name || contact?.display_name || '', locale, contactId: contact?.id || null });
  }

  // --- Relatório ---
  console.log(`\nPeregrinação: ${pilgrimage.title}`);
  console.log(`Estado: ${pilgrimage.status} · ${vacancies} vagas de ${pilgrimage.total_vacancies}\n`);
  console.log(`DESTINATÁRIOS (${recipients.length})`);
  for (const r of recipients) console.log(`  [${r.locale.toUpperCase()}] ${r.name.padEnd(34)} ${r.email}`);
  console.log(`\nEXCLUÍDOS (${skipped.length})`);
  for (const s of skipped) console.log(`  ${s.name.padEnd(34)} ${s.reason}`);

  if (!send) {
    console.log('\n>>> SIMULAÇÃO. Nada foi enviado. Corre com --send para enviar a sério.\n');
    return;
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) throw new Error('Falta RESEND_API_KEY');
  const resend = new Resend(resendKey);

  console.log(`\n>>> A ENVIAR para ${recipients.length} pessoas...\n`);
  let ok = 0;
  let failed = 0;

  for (const r of recipients) {
    const { e, t } = createUnsubscribeToken(r.email);
    const unsubPath = r.locale === 'en' ? '/en/unsubscribe' : '/cancelar-subscricao';
    const { subject, html } = renderMarketingTemplateEmail({
      templateKey: TEMPLATE_KEY,
      name: r.name,
      email: r.email,
      language: r.locale,
      pilgrimageName: r.locale === 'en' ? pilgrimage.title_en || pilgrimage.title : pilgrimage.title,
      pilgrimageUrl: r.locale === 'en'
        ? `${APP_URL}/en/pilgrimages/${pilgrimage.slug}`
        : `${APP_URL}/peregrinacoes/${pilgrimage.slug}`,
      pilgrimageImageUrl: (r.locale === 'en' ? pilgrimage.cover_image_en || pilgrimage.cover_image : pilgrimage.cover_image) || '',
      pilgrimageStatus: 'open',
      pilgrimageVacancies: vacancies,
      localCurrency: r.locale === 'pt' ? { code: 'BRL', rate: 6.2 } : { code: 'USD', rate: 1.08 },
      unsubscribeUrl: `${APP_URL}${unsubPath}?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`,
    });

    // O `config.ts` cai para localhost quando APP_URL não está no ambiente, e o
    // dotenv só corre depois dos imports. Um botão a apontar para localhost
    // torna a campanha inútil, por isso abortamos antes de enviar.
    if (/localhost|127\.0\.0\.1/.test(html)) {
      throw new Error('Email contém link para localhost. Corre com APP_URL=https://apostoladodegarabandal.com');
    }

    try {
      const res = await resend.emails.send({
        from: FROM,
        to: r.email,
        subject,
        html,
        headers: {
          'List-Unsubscribe': `<${APP_URL}/api/marketing/unsubscribe?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      if (res.error) throw new Error(res.error.message);
      ok++;
      console.log(`  ok   [${r.locale}] ${r.email}`);
      await supabase.from('marketing_message_logs').insert({
        contact_id: r.contactId,
        channel: 'email',
        status: 'sent',
        subject,
        metadata: { campaign_slug: CAMPAIGN_SLUG, template_key: TEMPLATE_KEY, locale: r.locale, email: r.email },
      });
    } catch (err: any) {
      failed++;
      console.log(`  FALHA [${r.locale}] ${r.email} — ${err.message}`);
    }
    await sleep(700);
  }

  console.log(`\nEnviados: ${ok} · Falhas: ${failed}\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
