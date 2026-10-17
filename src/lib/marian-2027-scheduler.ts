import { createHash } from 'node:crypto';
import { normalizeEmail } from './marketing-core';
import { renderMarketingEmail, sendMarketingEmail } from './marketing-email';
import { countMarketingSendsForContact, getMarketingEmailLimits } from './marketing-limits';
import { loadMarian2027Audience, MARIAN_2027_SLUG, MARIAN_2027_STEPS, marian2027EmailContext, type Marian2027StepKey } from './marian-2027-campaign';

type Language = 'pt' | 'en';
type Database = { from: (table: string) => any };
type CampaignRow = { id: string; name: string; status: string; template_key: string; scheduled_at: string; metrics: Record<string, unknown> | null };
type MessageLog = { to_email: string | null; status: string; sent_at: string | null; created_at: string };

export const MARIAN_2027_CAMPAIGN_FAMILY = 'marian-2027';
const DAY_MS = 86_400_000;

async function allRows<T>(makeQuery: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await makeQuery(start, start + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
}

const campaignSlug = (language: Language, key: Marian2027StepKey) => `${MARIAN_2027_CAMPAIGN_FAMILY}:${language}:${key}`;
const campaignDate = (startAt: Date, day: number) => new Date(startAt.getTime() + day * DAY_MS).toISOString();

export async function getMarian2027Schedule(supabase: Database): Promise<CampaignRow[]> {
  const { data, error } = await supabase.from('marketing_campaigns')
    .select('id,name,status,template_key,scheduled_at,metrics')
    .contains('metrics', { family: MARIAN_2027_CAMPAIGN_FAMILY })
    .order('scheduled_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function scheduleMarian2027Campaign(supabase: Database, startAtIso: string) {
  const startAt = new Date(startAtIso);
  if (!Number.isFinite(startAt.getTime()) || startAt.getTime() < Date.now() + 15 * 60_000) {
    throw new Error('Escolha uma data futura, com pelo menos 15 minutos de antecedência.');
  }
  const existing = await getMarian2027Schedule(supabase);
  if (existing.length) throw new Error('Esta campanha já tem um calendário. Consulte ou pause os envios existentes.');

  const cutoff = new Date().toISOString();
  const audienceByLanguage = await Promise.all((['pt', 'en'] as const).map((language) => loadMarian2027Audience(supabase, language, cutoff)));
  if (audienceByLanguage.some((entry) => !entry.sendable)) throw new Error('Peregrinação sem inscrições abertas ou vagas confirmadas.');

  const rows = (['pt', 'en'] as const).flatMap((language, languageIndex) => MARIAN_2027_STEPS.map((step) => {
    const subject = renderMarketingEmail({
      contact: { normalized_email: 'preview@example.com', display_name: 'Maria', language, recommendation: '' },
      templateKey: step.key,
      context: marian2027EmailContext(step.key),
    }).subject;
    return {
      name: `${language === 'pt' ? 'Caminho Mariano' : 'Marian Way'} 2027 · ${step.label} · ${language.toUpperCase()}`,
      segment_slug: language === 'pt' ? 'newsletter-pt' : 'newsletter-en',
      subject,
      template_key: step.key,
      status: 'scheduled',
      scheduled_at: campaignDate(startAt, step.day),
      metrics: {
        family: MARIAN_2027_CAMPAIGN_FAMILY,
        campaign_slug: campaignSlug(language, step.key),
        language,
        audience_cutoff: cutoff,
        original_audience: audienceByLanguage[languageIndex].audience.length,
        sent: 0,
        failed: 0,
      },
    };
  }));

  const { data, error } = await supabase.from('marketing_campaigns').insert(rows)
    .select('id,name,status,template_key,scheduled_at,metrics');
  if (error) throw error;
  return { campaigns: data || [], audience: { pt: audienceByLanguage[0].stats, en: audienceByLanguage[1].stats } };
}

async function campaignLogs(supabase: Database, key: Marian2027StepKey): Promise<MessageLog[]> {
  return allRows<MessageLog>((start, end) => supabase.from('marketing_message_logs')
    .select('to_email,status,sent_at,created_at')
    .eq('template_key', key).in('status', ['sent', 'queued'])
    .order('created_at', { ascending: true }).range(start, end));
}

function sentAndQueued(logs: MessageLog[]) {
  const sent = new Map<string, string>();
  const queued = new Set<string>();
  for (const log of logs) {
    const email = normalizeEmail(log.to_email);
    if (!email) continue;
    if (log.status === 'sent') sent.set(email, log.sent_at || log.created_at);
    if (log.status === 'queued') queued.add(email);
  }
  return { sent, queued };
}

export async function processMarian2027ScheduledCampaigns(
  supabase: Database,
  options: { limit: number; dryRun?: boolean; now?: Date },
) {
  const now = options.now || new Date();
  const maxSends = Math.max(0, options.limit);
  const campaigns = await getMarian2027Schedule(supabase);
  const dueCampaignCount = campaigns.filter((campaign) => ['scheduled', 'active'].includes(campaign.status) && campaign.scheduled_at && new Date(campaign.scheduled_at) <= now).length;
  const perCampaignLimit = Math.max(1, Math.ceil(maxSends / Math.max(1, dueCampaignCount)));
  const results: Array<{ campaign: string; language: string; step: string; sent: number; failed: number; remaining: number; reason?: string }> = [];
  let totalSent = 0;
  let totalAttempted = 0;

  for (const campaign of campaigns) {
    if (maxSends <= totalAttempted) break;
    if (!['scheduled', 'active'].includes(campaign.status) || !campaign.scheduled_at || new Date(campaign.scheduled_at) > now) continue;
    const step = MARIAN_2027_STEPS.find((item) => item.key === campaign.template_key);
    const language = campaign.metrics?.language;
    const cutoff = campaign.metrics?.audience_cutoff;
    if (!step || (language !== 'pt' && language !== 'en') || typeof cutoff !== 'string') continue;

    const previousStep = MARIAN_2027_STEPS[MARIAN_2027_STEPS.indexOf(step) - 1];
    const previousCampaign = previousStep
      ? campaigns.find((row) => row.template_key === previousStep.key && row.metrics?.language === language)
      : null;
    if (previousStep && !previousCampaign) continue;

    const { audience, sendable } = await loadMarian2027Audience(supabase, language, cutoff);
    if (!sendable) {
      results.push({ campaign: campaign.id, language, step: step.key, sent: 0, failed: 0, remaining: audience.length, reason: 'registration_closed' });
      continue;
    }
    const own = sentAndQueued(await campaignLogs(supabase, step.key));
    const prior = previousStep ? sentAndQueued(await campaignLogs(supabase, previousStep.key)) : null;
    const pending = audience.filter((contact) => {
      const email = contact.normalized_email!;
      if (own.sent.has(email) || own.queued.has(email)) return false;
      return !previousStep || Boolean(prior?.sent.has(email));
    });
    const target = pending.filter((contact) => {
      if (!previousStep) return true;
      const priorSentAt = prior?.sent.get(contact.normalized_email!);
      return Boolean(priorSentAt && now.getTime() - new Date(priorSentAt).getTime() >= (step.day - previousStep.day) * DAY_MS);
    });
    const unresolvedQueued = audience.filter((contact) => own.queued.has(contact.normalized_email!) && !own.sent.has(contact.normalized_email!)).length;
    const remaining = pending.length + unresolvedQueued;
    if (options.dryRun) {
      results.push({ campaign: campaign.id, language, step: step.key, sent: 0, failed: 0, remaining });
      continue;
    }

    if (remaining === 0) {
      if (previousCampaign && previousCampaign.status !== 'completed') {
        results.push({ campaign: campaign.id, language, step: step.key, sent: 0, failed: 0, remaining: 0, reason: 'waiting_previous_campaign' });
        continue;
      }
      const sent = audience.filter((contact) => own.sent.has(contact.normalized_email!)).length;
      const { error } = await supabase.from('marketing_campaigns').update({ status: 'completed', metrics: { ...campaign.metrics, sent, remaining: 0, last_run_at: now.toISOString() }, updated_at: now.toISOString() }).eq('id', campaign.id);
      if (error) throw error;
      results.push({ campaign: campaign.id, language, step: step.key, sent: 0, failed: 0, remaining: 0 });
      continue;
    }

    let sent = 0;
    let failed = 0;
    let attempted = 0;
    for (const contact of target) {
      if (totalAttempted >= maxSends || attempted >= perCampaignLimit) break;
      const email = contact.normalized_email!;
      // A consulta ao público é repetida para respeitar inscrições e cancelamentos
      // ocorridos desde o início do lote.
      const current = await loadMarian2027Audience(supabase, language, cutoff);
      if (!current.sendable || !current.audience.some((person) => person.normalized_email === email)) continue;

      const { data: existingContact, error: lookupError } = await supabase.from('marketing_contacts')
        .select('id,consent_state').eq('normalized_email', email).maybeSingle();
      if (lookupError) throw lookupError;
      if (existingContact && ['unsubscribed', 'suppressed'].includes(existingContact.consent_state)) continue;
      const { data: persisted, error: contactError } = existingContact
        ? { data: existingContact, error: null }
        : await supabase.from('marketing_contacts').insert({
            normalized_email: email,
            display_name: contact.display_name,
            language,
            consent_state: 'explicit',
          }).select('id').single();
      if (contactError || !persisted) throw contactError || new Error('Falha ao registar contacto.');

      const limits = getMarketingEmailLimits();
      const counts = await countMarketingSendsForContact(supabase, persisted.id, new Date(), limits);
      if (counts.recent >= 1 || counts.week >= limits.maxEmailsPer7Days) continue;

      const { data: queued, error: queueError } = await supabase.from('marketing_message_logs').insert({
        contact_id: persisted.id,
        campaign_id: campaign.id,
        to_email: email,
        subject: campaign.name,
        template_key: step.key,
        status: 'queued',
        metadata: { campaign: MARIAN_2027_SLUG, language, step: step.key },
      }).select('id').single();
      if (queueError || !queued) throw queueError || new Error('Falha ao registar tentativa.');

      const idempotencyKey = createHash('sha256').update(`${MARIAN_2027_SLUG}:${step.key}:${email}`).digest('hex');
      totalAttempted += 1;
      attempted += 1;
      let delivery: Awaited<ReturnType<typeof sendMarketingEmail>>;
      try {
        delivery = await sendMarketingEmail({ contact, templateKey: step.key, context: marian2027EmailContext(step.key), idempotencyKey });
      } catch (error) {
        delivery = { sent: false, error: error instanceof Error ? error.message : 'Falha no serviço de envio.' };
      }
      const { error: logError } = await supabase.from('marketing_message_logs').update({
        provider_message_id: delivery.providerId || null,
        subject: delivery.subject || campaign.name,
        status: delivery.sent ? 'sent' : 'failed',
        error_message: delivery.sent ? null : delivery.error || 'Falha no envio.',
        sent_at: delivery.sent ? new Date().toISOString() : null,
      }).eq('id', queued.id);
      if (logError) throw logError;
      if (delivery.sent) { sent += 1; totalSent += 1; } else failed += 1;
    }

    const { error: campaignError } = await supabase.from('marketing_campaigns').update({
      status: 'active',
      metrics: { ...campaign.metrics, sent: Number(campaign.metrics?.sent || 0) + sent, failed: Number(campaign.metrics?.failed || 0) + failed, remaining: Math.max(0, remaining - sent), last_run_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    }).eq('id', campaign.id);
    if (campaignError) throw campaignError;
    results.push({ campaign: campaign.id, language, step: step.key, sent, failed, remaining: Math.max(0, remaining - sent) });
  }

  return { sent: totalSent, attempted: totalAttempted, campaigns: results };
}
