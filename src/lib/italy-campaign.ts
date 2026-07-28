/**
 * Campanha Itália + Medjugorje (abril 2027) — motor de envio partilhado.
 *
 * Usado pelo script manual (`scripts/send-italy-campaign.ts`) e pelo cron do
 * Railway (`/api/cron/italy-campaign`). Ter um só motor é deliberado: lógica de
 * audiência duplicada em dois sítios é como se enviam emails a dobrar.
 *
 * Garantias, em qualquer chamador:
 *  - quem já está inscrito nesta peregrinação nunca recebe (recalculado sempre);
 *  - supressos, unsubscritos e endereços internos ficam de fora;
 *  - ninguém recebe duas vezes o mesmo passo (dedupe por campaign_slug);
 *  - ninguém recebe dois emails de marketing em 24h;
 *  - os follow-ups só vão a quem recebeu o passo anterior.
 */
import { Resend } from 'resend';
import { renderMarketingTemplateEmail } from './email-renderer';
import { isDeliverableMarketingEmail } from './marketing-core';
import { createUnsubscribeToken } from './unsubscribe-token';

export const ITALY_PILGRIMAGE_SLUG = 'italia-medjugorje-abril-2027';

const APP_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://apostoladodegarabandal.com').replace(/\/+$/, '');

export type ItalyStepId = 'launch' | 'story' | 'value' | 'last-call';

export type ItalyStep = {
  id: ItalyStepId;
  templateKey: 'italy_medjugorje_launch' | 'italy_medjugorje_story' | 'italy_medjugorje_value' | 'italy_medjugorje_last_call';
  campaignSlug: string;
  name: string;
  /** Passo que o contacto tem de ter recebido antes deste (null = entrada da sequência). */
  requires: string | null;
  subject: { pt: string; en: string };
};

export const ITALY_STEPS: Record<ItalyStepId, ItalyStep> = {
  launch: {
    id: 'launch',
    templateKey: 'italy_medjugorje_launch',
    campaignSlug: 'italy-medjugorje-2027-launch',
    name: 'Itália + Medjugorje 2027 · 1. Lançamento',
    requires: null,
    subject: {
      pt: 'Itália e Medjugorje 2027: 75% das vagas já foram',
      en: 'Italy and Medjugorje 2027: 75% of the places are gone',
    },
  },
  story: {
    id: 'story',
    templateKey: 'italy_medjugorje_story',
    campaignSlug: 'italy-medjugorje-2027-story',
    name: 'Itália + Medjugorje 2027 · 2. Padre Pio e Garabandal',
    requires: 'italy-medjugorje-2027-launch',
    subject: {
      pt: 'O Padre Pio viu Garabandal antes de morrer',
      en: 'Padre Pio saw Garabandal before he died',
    },
  },
  value: {
    id: 'value',
    templateKey: 'italy_medjugorje_value',
    campaignSlug: 'italy-medjugorje-2027-value',
    name: 'Itália + Medjugorje 2027 · 3. Preço e parcelamento',
    requires: 'italy-medjugorje-2027-story',
    subject: {
      pt: '1.850 € com tudo incluído — e dá para parcelar em 10x',
      en: '€1,850 all-in — and you can split it into 10',
    },
  },
  'last-call': {
    id: 'last-call',
    templateKey: 'italy_medjugorje_last_call',
    campaignSlug: 'italy-medjugorje-2027-last-call',
    name: 'Itália + Medjugorje 2027 · 4. Última chamada',
    requires: 'italy-medjugorje-2027-value',
    subject: {
      pt: 'Últimas vagas para Itália e Medjugorje',
      en: 'Final places for Italy and Medjugorje',
    },
  },
};

export type ItalySlot = 'afternoon' | 'evening';

type ScheduleEntry = { date: string; slot: ItalySlot; step: ItalyStepId; maxSends: number };

/**
 * Calendário da campanha, em datas de Lisboa. `afternoon` = corrida das 14:00,
 * `evening` = corrida das 21:00 (São Paulo 10:00 e 17:00 enquanto Lisboa estiver
 * em UTC+1). O cron corre às terças, quartas e quintas e só envia se o dia +
 * slot existirem aqui — fora do calendário não faz nada.
 *
 * Os primeiros dias são deliberadamente pequenos: este domínio nunca passou de
 * ~23 emails/dia, e saltar direto para 300 arriscaria a reputação de envio.
 */
export const ITALY_SCHEDULE: ScheduleEntry[] = [
  // 1 · Lançamento — rampa de aquecimento (100 → 200 → 300 → resto)
  { date: '2026-07-28', slot: 'afternoon', step: 'launch', maxSends: 100 },
  { date: '2026-07-29', slot: 'afternoon', step: 'launch', maxSends: 100 },
  { date: '2026-07-29', slot: 'evening', step: 'launch', maxSends: 100 },
  { date: '2026-07-30', slot: 'afternoon', step: 'launch', maxSends: 150 },
  { date: '2026-07-30', slot: 'evening', step: 'launch', maxSends: 150 },
  // Tetos folgados no último dia do lançamento: se uma corrida for perdida
  // (deploy, avaria), ninguém pode ficar sem o email 1 — quem não o receber
  // nunca entra nos follow-ups, porque estes exigem o passo anterior.
  { date: '2026-08-04', slot: 'afternoon', step: 'launch', maxSends: 250 },
  { date: '2026-08-04', slot: 'evening', step: 'launch', maxSends: 250 },
  // 2 · Padre Pio
  { date: '2026-08-05', slot: 'afternoon', step: 'story', maxSends: 160 },
  { date: '2026-08-05', slot: 'evening', step: 'story', maxSends: 160 },
  { date: '2026-08-06', slot: 'afternoon', step: 'story', maxSends: 160 },
  { date: '2026-08-06', slot: 'evening', step: 'story', maxSends: 160 },
  { date: '2026-08-11', slot: 'afternoon', step: 'story', maxSends: 200 },
  { date: '2026-08-11', slot: 'evening', step: 'story', maxSends: 200 },
  // 3 · Preço e parcelamento
  { date: '2026-08-12', slot: 'afternoon', step: 'value', maxSends: 160 },
  { date: '2026-08-12', slot: 'evening', step: 'value', maxSends: 160 },
  { date: '2026-08-13', slot: 'afternoon', step: 'value', maxSends: 160 },
  { date: '2026-08-13', slot: 'evening', step: 'value', maxSends: 160 },
  { date: '2026-08-18', slot: 'afternoon', step: 'value', maxSends: 200 },
  { date: '2026-08-18', slot: 'evening', step: 'value', maxSends: 200 },
  // 4 · Última chamada
  { date: '2026-08-19', slot: 'afternoon', step: 'last-call', maxSends: 160 },
  { date: '2026-08-19', slot: 'evening', step: 'last-call', maxSends: 160 },
  { date: '2026-08-20', slot: 'afternoon', step: 'last-call', maxSends: 160 },
  { date: '2026-08-20', slot: 'evening', step: 'last-call', maxSends: 160 },
  { date: '2026-08-25', slot: 'afternoon', step: 'last-call', maxSends: 200 },
  { date: '2026-08-25', slot: 'evening', step: 'last-call', maxSends: 200 },
];

const LISBON_TZ = 'Europe/Lisbon';

/** Data civil de Lisboa (YYYY-MM-DD) — o calendário acima é lido nesta hora. */
export const lisbonDate = (now: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: LISBON_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export const lisbonHour = (now: Date = new Date()) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: LISBON_TZ, hour: 'numeric', hour12: false }).format(now));

/**
 * Slot da corrida a partir da hora de Lisboa. A janela é larga (12–17 e 18–23)
 * para uma corrida atrasada pelo arranque do serviço ainda contar para o slot
 * certo, em vez de ser silenciosamente ignorada.
 */
export const italySlotForHour = (hour: number): ItalySlot | null => {
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 24) return 'evening';
  return null;
};

export const findItalyScheduleEntry = (now: Date = new Date()) => {
  const slot = italySlotForHour(lisbonHour(now));
  if (!slot) return null;
  const date = lisbonDate(now);
  return ITALY_SCHEDULE.find((entry) => entry.date === date && entry.slot === slot) || null;
};

/** Câmbio do dia (PT-BR lê em BRL, EN em USD). Fallbacks iguais aos de currency.ts. */
const FALLBACK_RATES: Record<string, number> = { BRL: 6.15, USD: 1.08 };

export const getItalyExchangeRates = async () => {
  const rates: Record<string, number> = { ...FALLBACK_RATES };
  try {
    const response = await fetch('https://api.frankfurter.app/latest?from=EUR&to=BRL,USD');
    const data: any = await response.json();
    if (typeof data?.rates?.BRL === 'number') rates.BRL = data.rates.BRL;
    if (typeof data?.rates?.USD === 'number') rates.USD = data.rates.USD;
    return { rates, live: true };
  } catch {
    return { rates, live: false };
  }
};

type CampaignContact = {
  id: string;
  display_name: string | null;
  normalized_email: string;
  language: string | null;
};

export type ItalyBatchResult = {
  step: ItalyStepId;
  campaignSlug: string;
  dryRun: boolean;
  pilgrimage: { title: string; currentVacancies: number | null; totalVacancies: number | null; status: string | null };
  rates: { BRL: number; USD: number; live: boolean };
  enrolledExcluded: number;
  audience: number;
  audiencePt: number;
  audienceEn: number;
  targeted: number;
  alreadySent: number;
  deferred24h: number;
  batch: number;
  sent: number;
  failed: number;
  remaining: number;
  /** true quando o lote parou pelo orçamento de tempo; o resto sai na corrida seguinte. */
  timeBudgetHit?: boolean;
  /** Linha única para os logs do Railway (o cliente do cron só deixa passar campos conhecidos). */
  summary: string;
  sample?: { email: string; subject: string }[];
};

const localeOf = (contact: { language?: string | null }): 'pt' | 'en' => (contact.language === 'pt' ? 'pt' : 'en');

/**
 * Prepara a corrida sem enviar nada: peregrinação, câmbio, audiência elegível e
 * função de render. Partilhado entre dry run e envio real.
 */
export const prepareItalyBatch = async (supabase: any, step: ItalyStep, maxSends: number) => {
  const { data: pilgrimage, error: pilgrimageError } = await supabase
    .from('pilgrimages')
    .select('id,title,title_en,slug,cover_image,cover_image_en,current_vacancies,total_vacancies,status')
    .eq('slug', ITALY_PILGRIMAGE_SLUG)
    .single();
  if (pilgrimageError) throw pilgrimageError;

  const { rates, live } = await getItalyExchangeRates();

  // ---- Exclusão: quem já está inscrito nesta peregrinação ----
  const { data: bookingRows, error: bookingsError } = await supabase
    .from('bookings')
    .select('id,status')
    .eq('pilgrimage_id', pilgrimage.id);
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

  // ---- Audiência: toda a base contactável menos os inscritos ----
  const { data: contacts, error: contactsError } = await supabase
    .from('marketing_contacts')
    .select('id,display_name,normalized_email,language,consent_state')
    .not('consent_state', 'in', '(suppressed,unsubscribed)')
    .not('normalized_email', 'is', null)
    .order('normalized_email')
    .range(0, 4999);
  if (contactsError) throw contactsError;

  const audience: CampaignContact[] = (contacts || [])
    .filter((contact: any) => isDeliverableMarketingEmail(contact.normalized_email))
    .filter((contact: any) => !enrolledEmails.has(String(contact.normalized_email).trim().toLowerCase()));

  // ---- Dedupe deste passo + pré-requisito da sequência ----
  const sentContactIdsFor = async (campaignSlug: string) => {
    const { data, error } = await supabase
      .from('marketing_message_logs')
      .select('contact_id')
      .eq('status', 'sent')
      .contains('metadata', { campaign_slug: campaignSlug });
    if (error) throw error;
    return new Set((data || []).map((row: any) => row.contact_id).filter(Boolean));
  };

  const alreadySent = await sentContactIdsFor(step.campaignSlug);
  const eligibleByStep = step.requires ? await sentContactIdsFor(step.requires) : null;

  // ---- Regra: 1 email de marketing por contacto/24h ----
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentLogs, error: recentError } = await supabase
    .from('marketing_message_logs')
    .select('contact_id')
    .eq('status', 'sent')
    .gte('created_at', since);
  if (recentError) throw recentError;
  const recentlyEmailed = new Set((recentLogs || []).map((row: any) => row.contact_id).filter(Boolean));

  const targeted = audience.filter((contact) => (eligibleByStep ? eligibleByStep.has(contact.id) : true));
  const pending = targeted.filter((contact) => !alreadySent.has(contact.id));
  const eligibleNow = pending.filter((contact) => !recentlyEmailed.has(contact.id));
  const batch = eligibleNow.slice(0, Math.max(0, maxSends));

  const pilgrimageUrl = (locale: 'pt' | 'en') =>
    locale === 'en' ? `${APP_URL}/en/pilgrimages/${pilgrimage.slug}` : `${APP_URL}/peregrinacoes/${pilgrimage.slug}`;
  const coverImage = (locale: 'pt' | 'en') =>
    (locale === 'en' ? pilgrimage.cover_image_en || pilgrimage.cover_image : pilgrimage.cover_image) || '';
  const pilgrimageName = (locale: 'pt' | 'en') =>
    (locale === 'en' ? pilgrimage.title_en || pilgrimage.title : pilgrimage.title) as string;

  const unsubscribeUrl = (email: string, locale: 'pt' | 'en') => {
    const { e, t } = createUnsubscribeToken(email);
    const p = locale === 'en' ? '/en/unsubscribe' : '/cancelar-subscricao';
    return `${APP_URL}${p}?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`;
  };
  const oneClickUrl = (email: string) => {
    const { e, t } = createUnsubscribeToken(email);
    return `${APP_URL}/api/marketing/unsubscribe?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`;
  };

  const renderFor = (contact: { display_name: string | null; normalized_email: string; language?: string | null }) => {
    const locale = localeOf(contact);
    return renderMarketingTemplateEmail({
      templateKey: step.templateKey,
      name: contact.display_name || '',
      email: contact.normalized_email,
      language: locale,
      subjectOverride: step.subject[locale],
      pilgrimageName: pilgrimageName(locale),
      pilgrimageUrl: pilgrimageUrl(locale),
      pilgrimageImageUrl: coverImage(locale),
      pilgrimageDates: locale === 'en' ? '5–17 April 2027' : '5 a 17 de abril de 2027',
      pilgrimageStatus: 'open',
      pilgrimageVacancies: pilgrimage.current_vacancies ?? null,
      localCurrency: locale === 'pt' ? { code: 'BRL', rate: rates.BRL } : { code: 'USD', rate: rates.USD },
      unsubscribeUrl: unsubscribeUrl(contact.normalized_email, locale),
    });
  };

  return {
    pilgrimage,
    rates: { BRL: rates.BRL, USD: rates.USD, live },
    enrolledEmails,
    audience,
    targeted,
    pending,
    eligibleNow,
    batch,
    alreadySent,
    renderFor,
    oneClickUrl,
  };
};

/**
 * Corre um lote da campanha. `dryRun: true` não envia nem escreve nada —
 * devolve só as contagens e uma amostra do que sairia.
 */
export const runItalyCampaignBatch = async ({
  supabase,
  step,
  maxSends,
  dryRun = true,
  sendDelayMs = 650,
  maxDurationMs = 240_000,
}: {
  supabase: any;
  step: ItalyStep;
  maxSends: number;
  dryRun?: boolean;
  sendDelayMs?: number;
  /**
   * Orçamento de tempo do lote. O cron responde só no fim da corrida e o cliente
   * HTTP desiste aos ~300s, por isso paramos antes disso: quem ficar por enviar
   * entra na corrida seguinte (o dedupe garante que ninguém repete).
   */
  maxDurationMs?: number;
}): Promise<ItalyBatchResult> => {
  const prepared = await prepareItalyBatch(supabase, step, maxSends);
  const { pilgrimage, rates, enrolledEmails, audience, targeted, pending, eligibleNow, batch, alreadySent, renderFor, oneClickUrl } =
    prepared;

  const base: ItalyBatchResult = {
    step: step.id,
    campaignSlug: step.campaignSlug,
    dryRun,
    pilgrimage: {
      title: pilgrimage.title,
      currentVacancies: pilgrimage.current_vacancies ?? null,
      totalVacancies: pilgrimage.total_vacancies ?? null,
      status: pilgrimage.status ?? null,
    },
    rates,
    enrolledExcluded: enrolledEmails.size,
    audience: audience.length,
    audiencePt: audience.filter((contact) => localeOf(contact) === 'pt').length,
    audienceEn: audience.filter((contact) => localeOf(contact) === 'en').length,
    targeted: targeted.length,
    alreadySent: alreadySent.size,
    deferred24h: pending.length - eligibleNow.length,
    batch: batch.length,
    sent: 0,
    failed: 0,
    remaining: pending.length,
    summary: '',
  };

  if (dryRun) {
    return {
      ...base,
      summary: `[dry run] ${step.id}: lote de ${batch.length} de ${pending.length} em falta (audiência ${audience.length}, ${enrolledEmails.size} inscritos excluídos)`,
      sample: batch.slice(0, 5).map((contact) => ({
        email: contact.normalized_email,
        subject: renderFor(contact).subject,
      })),
    };
  }

  if (!batch.length) return { ...base, summary: `${step.id}: nada a enviar (${pending.length} em falta, todos adiados ou concluídos)` };

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) throw new Error('RESEND_API_KEY em falta — nada foi enviado.');
  const resend = new Resend(resendApiKey);

  const rawFrom = (process.env.NOTIFY_EMAIL_FROM || '').trim();
  const fromAddress = rawFrom.includes('<')
    ? (rawFrom.match(/<([^>]+)>/)?.[1]?.trim() || 'no-reply@apostoladodegarabandal.com')
    : rawFrom || 'no-reply@apostoladodegarabandal.com';
  const FROM = `Apostolado de Garabandal <${fromAddress}>`;

  // ---- Campanha: uma linha por passo, reutilizada entre lotes ----
  const { data: existingCampaign } = await supabase
    .from('marketing_campaigns')
    .select('id,metrics')
    .contains('metrics', { campaign_slug: step.campaignSlug })
    .maybeSingle();

  let campaignId = existingCampaign?.id || null;
  if (!campaignId) {
    const { data: campaign, error: campaignError } = await supabase
      .from('marketing_campaigns')
      .insert({
        name: step.name,
        segment_slug: 'all-contacts-except-italy-2027-enrolled',
        subject: step.subject.pt,
        template_key: step.templateKey,
        status: 'active',
        metrics: { campaign_slug: step.campaignSlug, audience: targeted.length, sent: 0, failed: 0 },
      })
      .select('id')
      .single();
    if (campaignError) console.warn('[italy-campaign] campanha não registada:', campaignError.message);
    campaignId = campaign?.id || null;
  }

  let sent = 0;
  let failed = 0;
  let timeBudgetHit = false;
  const startedAt = Date.now();

  for (const contact of batch) {
    if (Date.now() - startedAt > maxDurationMs) {
      timeBudgetHit = true;
      break;
    }
    const email = contact.normalized_email;
    const rendered = renderFor(contact);

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
      template_key: step.templateKey,
      status: ok ? 'sent' : 'failed',
      error_message: errorMessage,
      sent_at: ok ? new Date().toISOString() : null,
      metadata: { source: 'italy_campaign', campaign_slug: step.campaignSlug, step: step.id },
    });

    if (sendDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, sendDelayMs));
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
          campaign_slug: step.campaignSlug,
          audience: targeted.length,
          sent: Number(previousMetrics.sent || 0) + sent,
          failed: Number(previousMetrics.failed || 0) + failed,
          remaining,
          last_batch_s: Math.round((Date.now() - startedAt) / 1000),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId);
  }

  return {
    ...base,
    sent,
    failed,
    remaining,
    timeBudgetHit,
    summary: `${step.id}: ${sent} enviados, ${failed} falhados, ${Math.max(0, remaining)} em falta${timeBudgetHit ? ' (lote cortado pelo tempo — segue na próxima corrida)' : ''}`,
  };
};
