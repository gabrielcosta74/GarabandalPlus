/**
 * Newsletter mensal de artigos — envio em lotes, seguro por defeito.
 *
 * - DRY RUN é o modo por defeito: mostra a audiência, grava um preview HTML e
 *   NÃO envia nada. O envio real exige SEND=1 explícito.
 * - Lotes: máximo MAX_SENDS por corrida (defeito 300). Correr o script em dias
 *   seguidos retoma onde ficou — quem já recebeu esta edição é saltado
 *   (dedupe por metadata.campaign_slug em marketing_message_logs).
 * - Regras respeitadas sempre: supressão/unsubscribe, emails internos
 *   (@sem-email.local), 1 email de marketing por contacto/24h, registo em
 *   marketing_campaigns + marketing_message_logs (o admin vê tudo).
 * - ES fica fora por desenho: a audiência é o segmento newsletter-pt ou
 *   newsletter-en via language + newsletter_subscriber.
 *
 * Uso:
 *   npx tsx scripts/send-newsletter.ts scripts/newsletter-editions/2026-07-pt.json          # dry run
 *   SEND=1 npx tsx scripts/send-newsletter.ts scripts/newsletter-editions/2026-07-pt.json   # envio real (lote)
 *   SEND=1 MAX_SENDS=300 npx tsx scripts/send-newsletter.ts <edicao.json>                   # lote com teto explícito
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
process.env.APP_URL = (process.env.APP_URL || 'https://apostoladodegarabandal.com').replace(/\/+$/, '');

const SEND = process.env.SEND === '1';
const MAX_SENDS = Math.max(1, Math.min(500, Number(process.env.MAX_SENDS || 300)));
const SEND_DELAY_MS = 650;
const APP_URL = process.env.APP_URL;

type EditionArticle = {
  title: string;
  url: string;
  excerpt?: string | null;
  imageUrl?: string | null;
  tag?: string | null;
};

type Edition = {
  campaignSlug: string; // ex.: "newsletter-2026-07-pt" — chave de dedupe entre corridas
  name: string; // nome legível para marketing_campaigns
  language: 'pt' | 'en';
  subject: string;
  intro?: string[]; // parágrafos de abertura (opcional; usa o texto do template se ausente)
  articles: EditionArticle[];
};

async function main() {
  const editionPath = process.argv[2];
  if (!editionPath) {
    console.error('Uso: npx tsx scripts/send-newsletter.ts <ficheiro-edicao.json>');
    process.exit(1);
  }
  const edition: Edition = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), editionPath), 'utf8'));
  if (!edition.campaignSlug || !edition.subject || !Array.isArray(edition.articles) || !edition.articles.length) {
    console.error('Edição inválida: precisa de campaignSlug, subject e articles[].');
    process.exit(1);
  }
  if (!['pt', 'en'].includes(edition.language)) {
    console.error(`Edição inválida: language "${edition.language}" — só pt/en (ES está fora de envios por decisão).`);
    process.exit(1);
  }
  for (const article of edition.articles) {
    if (!article.url?.startsWith(APP_URL!)) {
      console.error(`Artigo com URL fora do site (${article.url}) — a newsletter só liga conteúdo real do site.`);
      process.exit(1);
    }
  }

  const { Resend } = await import('resend');
  const { createClient } = await import('@supabase/supabase-js');
  const { renderMarketingTemplateEmail } = await import('../src/lib/email-renderer');
  const { createUnsubscribeToken } = await import('../src/lib/unsubscribe-token');
  const { isDeliverableMarketingEmail } = await import('../src/lib/marketing-core');

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

  // ---- Audiência: subscritores da newsletter na língua da edição ----
  const { data: contacts, error: contactsError } = await supabase
    .from('marketing_contacts')
    .select('id,display_name,normalized_email,language,consent_state,source_summary')
    .eq('language', edition.language)
    .not('consent_state', 'in', '(suppressed,unsubscribed)')
    .not('normalized_email', 'is', null)
    .order('normalized_email')
    .range(0, 4999);
  if (contactsError) throw contactsError;

  const subscribers = (contacts || [])
    .filter((c) => Boolean((c.source_summary as any)?.newsletter_subscriber))
    .filter((c) => isDeliverableMarketingEmail(c.normalized_email));

  // ---- Dedupe da edição: quem já recebeu esta campanha não repete ----
  const { data: campaignLogs, error: campaignLogsError } = await supabase
    .from('marketing_message_logs')
    .select('contact_id')
    .eq('status', 'sent')
    .eq('template_key', 'newsletter_monthly')
    .contains('metadata', { campaign_slug: edition.campaignSlug });
  if (campaignLogsError) throw campaignLogsError;
  const alreadySent = new Set((campaignLogs || []).map((row) => row.contact_id).filter(Boolean));

  // ---- Regra 1 email de marketing/24h por contacto ----
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentLogs, error: recentError } = await supabase
    .from('marketing_message_logs')
    .select('contact_id')
    .eq('status', 'sent')
    .gte('created_at', since);
  if (recentError) throw recentError;
  const recentlyEmailed = new Set((recentLogs || []).map((row) => row.contact_id).filter(Boolean));

  const pending = subscribers.filter((c) => !alreadySent.has(c.id));
  const eligibleNow = pending.filter((c) => !recentlyEmailed.has(c.id));
  const batch = eligibleNow.slice(0, MAX_SENDS);

  console.log(`Edição: ${edition.name} (${edition.campaignSlug}, ${edition.language.toUpperCase()})`);
  console.log(`Subscritores ${edition.language.toUpperCase()} contactáveis: ${subscribers.length}`);
  console.log(`  → já receberam esta edição: ${alreadySent.size}`);
  console.log(`  → adiados pela regra 24h (ficam para a próxima corrida): ${pending.length - eligibleNow.length}`);
  console.log(`  → neste lote (teto ${MAX_SENDS}): ${batch.length}${SEND ? '' : '  (DRY RUN — nada será enviado)'}`);

  const unsubscribeUrl = (email: string) => {
    const { e, t } = createUnsubscribeToken(email);
    const p = edition.language === 'en' ? '/en/unsubscribe' : '/cancelar-subscricao';
    return `${APP_URL}${p}?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`;
  };
  const oneClickUrl = (email: string) => {
    const { e, t } = createUnsubscribeToken(email);
    return `${APP_URL}/api/marketing/unsubscribe?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`;
  };

  const renderFor = (contact: { display_name: string | null; normalized_email: string }) =>
    renderMarketingTemplateEmail({
      templateKey: 'newsletter_monthly',
      name: contact.display_name || '',
      email: contact.normalized_email,
      language: edition.language,
      subjectOverride: edition.subject,
      bodyOverride: edition.intro?.length ? edition.intro.join('\n') : null,
      articles: edition.articles,
      unsubscribeUrl: unsubscribeUrl(contact.normalized_email),
    });

  if (!SEND) {
    for (const sample of batch.slice(0, 5)) {
      const rendered = renderFor(sample as any);
      console.log(`  · ${sample.normalized_email} → "${rendered.subject}"`);
    }
    const previewContact = batch[0] || subscribers[0];
    if (previewContact) {
      const rendered = renderFor(previewContact as any);
      const out = path.resolve(process.cwd(), `emails/_dryrun-${edition.campaignSlug}.html`);
      fs.writeFileSync(out, rendered.html);
      console.log(`\nHTML real (1.º contacto do lote) gravado em: ${out}`);
    }
    console.log('\nDRY RUN concluído. Nenhum email enviado, nada registado. Para enviar: SEND=1 …');
    return;
  }

  if (!batch.length) {
    console.log('Nada a enviar nesta corrida (edição completa ou todos adiados 24h).');
    return;
  }

  // ---- Campanha: uma linha por edição, reutilizada entre corridas/lotes ----
  const { data: existingCampaign } = await supabase
    .from('marketing_campaigns')
    .select('id,metrics')
    .contains('metrics', { campaign_slug: edition.campaignSlug })
    .maybeSingle();

  let campaignId = existingCampaign?.id || null;
  if (!campaignId) {
    const { data: campaign, error: campaignError } = await supabase
      .from('marketing_campaigns')
      .insert({
        name: edition.name,
        segment_slug: edition.language === 'en' ? 'newsletter-en' : 'newsletter-pt',
        subject: edition.subject,
        template_key: 'newsletter_monthly',
        status: 'active',
        metrics: { campaign_slug: edition.campaignSlug, audience: subscribers.length, sent: 0, failed: 0 },
      })
      .select('id')
      .single();
    if (campaignError) console.warn('Aviso: campanha não registada:', campaignError.message);
    campaignId = campaign?.id || null;
  }

  let sent = 0;
  let failed = 0;
  const startedAt = Date.now();

  for (const [index, contact] of batch.entries()) {
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
      template_key: 'newsletter_monthly',
      status: ok ? 'sent' : 'failed',
      error_message: errorMessage,
      sent_at: ok ? new Date().toISOString() : null,
      metadata: { source: 'newsletter_script', campaign_slug: edition.campaignSlug },
    });

    if ((index + 1) % 50 === 0 || index === batch.length - 1) {
      console.log(`  ${index + 1}/${batch.length} · enviados ${sent} · falhados ${failed}`);
    }
    await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
  }

  const remaining = pending.length - sent;
  if (campaignId) {
    const previousMetrics = (existingCampaign?.metrics as Record<string, unknown>) || {};
    await supabase
      .from('marketing_campaigns')
      .update({
        status: remaining <= 0 ? 'completed' : 'active',
        metrics: {
          ...previousMetrics,
          campaign_slug: edition.campaignSlug,
          audience: subscribers.length,
          sent: Number(previousMetrics.sent || 0) + sent,
          failed: Number(previousMetrics.failed || 0) + failed,
          remaining,
          last_batch_s: Math.round((Date.now() - startedAt) / 1000),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId);
  }

  console.log(`\nLote concluído: ${sent} enviados, ${failed} falhados. Restam ${Math.max(0, remaining)} para próximas corridas.`);
}

main().catch((error) => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
