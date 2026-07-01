import { sendMarketingEmail } from './marketing-email';
import { isContactInSegment, isDeliverableMarketingEmail, isInternalMemberEmail, normalizeEmail } from './marketing-core';
import { buildMarketingContacts, persistMarketingContacts } from './marketing-data';
import {
  countMarketingSendsForContact,
  getMarketingEmailLimits,
} from './marketing-limits';
import { APP_URL } from './config';

export const addMarketingHours = (date: Date, hours: number) =>
  new Date(date.getTime() + hours * 60 * 60 * 1000);

const getSummary = (contact: any) => contact?.source_summary || {};

const RECOVERY_REQUIRES_AVAILABILITY = new Set([
  'abandoned_registration_1',
  'abandoned_registration_faq',
  'abandoned_registration_final',
]);

const splitStepCondition = (condition?: string | null) =>
  String(condition || '')
    .split(/[,|&]+/)
    .map((item) => item.trim())
    .filter(Boolean);

export const getMarketingStepConditions = (step?: any) => {
  const conditions = splitStepCondition(step?.condition);
  if (
    step?.channel !== 'task' &&
    RECOVERY_REQUIRES_AVAILABILITY.has(String(step?.template_key || '')) &&
    !conditions.includes('has_availability')
  ) {
    conditions.push('has_availability');
  }
  return conditions;
};

export const marketingContactReachedGoal = (contact: any, goals: string[] = []) => {
  const summary = getSummary(contact);
  return goals.some((goal) => {
    if (goal === 'booked_pilgrimage') return Number(summary.bookings || 0) > 0;
    if (goal === 'donated') return Number(summary.succeeded_donations || 0) > 0;
    if (goal === 'became_member') return Boolean(summary.is_member);
    if (goal === 'suppressed') return contact?.consent_state === 'suppressed';
    if (goal === 'unsubscribed') return contact?.consent_state === 'unsubscribed';
    return false;
  });
};

export const marketingStepConditionPasses = (contact: any, condition?: string | null) => {
  if (!condition) return true;
  const summary = getSummary(contact);
  if (condition === 'not_booked') return Number(summary.bookings || 0) === 0;
  if (condition === 'not_member') return !summary.is_member;
  if (condition === 'has_availability') return Number(summary.available_pilgrimages || 0) > 0;
  if (condition === 'has_pending_payment') {
    return Number(summary.pilgrimage_payments || 0) > 0 && Number(summary.pilgrimage_payment_value || 0) === 0;
  }
  if (condition === 'has_email') return Boolean(contact?.normalized_email);
  return true;
};

export const marketingStepConditionsPass = (contact: any, step?: any) =>
  getMarketingStepConditions(step).every((condition) => marketingStepConditionPasses(contact, condition));

export const getMarketingEnrollmentStep = (enrollment: any) => {
  const steps = Array.isArray(enrollment?.funnel?.steps) ? enrollment.funnel.steps : [];
  return { steps, step: steps[enrollment?.current_step || 0] || null };
};

export const evaluateMarketingEnrollment = (enrollment: any, counts?: { day?: number; week?: number }) => {
  const contact = enrollment?.contact;
  const { step } = getMarketingEnrollmentStep(enrollment);
  const nextRunAt = enrollment?.next_run_at ? new Date(enrollment.next_run_at) : null;
  const now = new Date();
  const limits = getMarketingEmailLimits();

  if (enrollment?.status === 'paused') {
    return { bucket: 'paused', label: 'Pausado', reason: 'Pausado pelo admin.', tone: 'slate' };
  }
  if (enrollment?.status === 'failed') {
    return { bucket: 'failed', label: 'Falhado', reason: enrollment?.stopped_reason || 'Falhou no último processamento.', tone: 'red' };
  }
  if (enrollment?.status === 'stopped') {
    return { bucket: 'stopped', label: 'Cancelado', reason: enrollment?.stopped_reason || 'Automação cancelada.', tone: 'slate' };
  }
  if (enrollment?.status === 'completed') {
    return { bucket: 'completed', label: 'Completo', reason: 'Funil terminado ou objetivo atingido.', tone: 'emerald' };
  }
  if (!step || !contact) {
    return { bucket: 'blocked', label: 'Bloqueado', reason: 'Falta contacto ou passo do funil.', tone: 'red' };
  }
  if (!contact?.normalized_email && step.channel !== 'task') {
    return { bucket: 'blocked', label: 'Bloqueado', reason: 'Contacto sem email válido.', tone: 'red' };
  }
  if (contact?.consent_state === 'suppressed' || contact?.consent_state === 'unsubscribed') {
    return { bucket: 'blocked', label: 'Bloqueado', reason: `Consentimento: ${contact.consent_state}.`, tone: 'red' };
  }
  if (marketingContactReachedGoal(contact, Array.isArray(step.stop_if) ? step.stop_if : ['suppressed', 'unsubscribed'])) {
    return { bucket: 'blocked', label: 'Objetivo atingido', reason: 'Uma regra de paragem já foi atingida.', tone: 'emerald' };
  }
  if (!marketingStepConditionsPass(contact, step)) {
    const conditions = getMarketingStepConditions(step).join(', ') || step.condition;
    return { bucket: 'blocked', label: 'Condição falhou', reason: `Condição não cumprida: ${conditions}.`, tone: 'amber' };
  }
  if ((counts?.day || 0) >= 1) {
    return { bucket: 'blocked', label: 'Limite de cadência', reason: `Já recebeu um email de marketing nas últimas ${limits.minHoursBetweenEmails}h.`, tone: 'amber' };
  }
  if ((counts?.week || 0) >= limits.maxEmailsPer7Days) {
    return { bucket: 'blocked', label: 'Limite 7 dias', reason: `Já atingiu o teto de ${limits.maxEmailsPer7Days} emails de marketing nos últimos 7 dias.`, tone: 'amber' };
  }
  if (!nextRunAt) {
    return { bucket: 'blocked', label: 'Sem data', reason: 'Não há próximo envio definido.', tone: 'amber' };
  }
  if (nextRunAt <= now) {
    return { bucket: 'ready', label: 'Pronto', reason: 'Elegível para envio no próximo cron.', tone: 'emerald' };
  }
  if (nextRunAt.toDateString() === now.toDateString()) {
    return { bucket: 'today', label: 'Hoje', reason: 'Programado para hoje.', tone: 'blue' };
  }
  return { bucket: 'upcoming', label: 'Programado', reason: 'Programado para uma data futura.', tone: 'slate' };
};

export const prepareMarketingFunnelEnrollments = async (
  supabase: any,
  funnel: any,
  options: { limit?: number; reactivatePaused?: boolean } = {},
) => {
  if (!funnel?.id) return { sourceContacts: 0, eligible: 0, enrolled: 0, skippedExisting: 0 };
  if (!funnel.segment_slug) return { sourceContacts: 0, eligible: 0, enrolled: 0, skippedExisting: 0 };

  const contacts = await buildMarketingContacts(supabase);
  await persistMarketingContacts(supabase, contacts);

  const eligible = contacts
    .filter((contact) => isDeliverableMarketingEmail(contact.normalized_email) && contact.consent_state !== 'suppressed' && contact.consent_state !== 'unsubscribed')
    .filter((contact) => isContactInSegment(contact, funnel.segment_slug))
    .slice(0, options.limit || 250);

  if (!eligible.length) {
    return { sourceContacts: contacts.length, eligible: 0, enrolled: 0, skippedExisting: 0 };
  }

  const emails = eligible.map((contact) => contact.normalized_email).filter(Boolean);
  const { data: persistedContacts, error: persistedError } = await supabase
    .from('marketing_contacts')
    .select('id,normalized_email')
    .in('normalized_email', emails);
  if (persistedError) throw persistedError;

  const byEmail = new Map((persistedContacts || []).map((contact: any) => [contact.normalized_email, contact.id]));
  const contactIds = Array.from(byEmail.values());
  const { data: existingEnrollments, error: existingError } = contactIds.length
    ? await supabase
        .from('marketing_enrollments')
        .select('id,contact_id,status')
        .eq('funnel_id', funnel.id)
        .in('contact_id', contactIds)
    : { data: [], error: null };
  if (existingError) throw existingError;

  const existingByContactId = new Map((existingEnrollments || []).map((row: any) => [row.contact_id, row]));
  const firstStep = Array.isArray(funnel.steps) ? funnel.steps[0] : null;
  const delayHours = Number(firstStep?.delay_hours || 0);
  const nextRunAt = addMarketingHours(new Date(), delayHours).toISOString();
  let enrolled = 0;
  let skippedExisting = 0;

  for (const contact of eligible) {
    const contactId = byEmail.get(contact.normalized_email);
    if (!contactId) continue;

    const existing = existingByContactId.get(contactId) as { id?: string; status?: string } | undefined;
    if (existing?.id) {
      if (options.reactivatePaused && existing.status && ['paused', 'failed'].includes(existing.status)) {
        const { error } = await supabase
          .from('marketing_enrollments')
          .update({
            status: 'active',
            next_run_at: nextRunAt,
            stopped_reason: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (error) throw error;
        enrolled += 1;
      } else {
        skippedExisting += 1;
      }
      continue;
    }

    const { error } = await supabase.from('marketing_enrollments').insert({
      contact_id: contactId,
      funnel_id: funnel.id,
      status: 'active',
      current_step: 0,
      next_run_at: nextRunAt,
      metadata: { source: 'admin-activation', segment_slug: funnel.segment_slug },
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    enrolled += 1;
  }

  return { sourceContacts: contacts.length, eligible: eligible.length, enrolled, skippedExisting };
};

const hasOpenPilgrimageAvailability = (pilgrimage: any, now = new Date()) => {
  const status = String(pilgrimage?.status || '').toLowerCase();
  if (!['open', 'active', 'ativo'].includes(status)) return false;
  if (Number(pilgrimage?.current_vacancies || 0) <= 0) return false;
  if (pilgrimage?.registration_deadline) {
    const deadline = new Date(pilgrimage.registration_deadline).getTime();
    if (!Number.isNaN(deadline) && deadline < now.getTime()) return false;
  }
  return true;
};

const pilgrimageMarketingUrl = (pilgrimage: any) =>
  pilgrimage?.slug ? `${APP_URL}/peregrinacoes/${pilgrimage.slug}` : `${APP_URL}/peregrinacoes`;

export const processWaitlistOpenSpotNotifications = async (
  supabase: any,
  options: { limit?: number; dryRun?: boolean; now?: Date } = {},
) => {
  const now = options.now || new Date();
  const limits = getMarketingEmailLimits();
  const limit = Math.max(0, Number(options.limit || 0));
  if (limit <= 0) {
    return { checkedPilgrimages: 0, candidates: 0, sent: 0, skipped: 0, results: [] as any[] };
  }

  const { data: pilgrimages, error: pilgrimageError } = await supabase
    .from('pilgrimages')
    .select('id,title,slug,status,current_vacancies,registration_deadline,start_date,cover_image')
    .gt('current_vacancies', 0)
    .in('status', ['open', 'active', 'ativo'])
    .order('start_date', { ascending: true });

  if (pilgrimageError) {
    console.warn('[Marketing] Waitlist open-spot check skipped:', pilgrimageError.message || pilgrimageError);
    return {
      checkedPilgrimages: 0,
      candidates: 0,
      sent: 0,
      skipped: 0,
      results: [{ action: 'skipped', reason: 'pilgrimage_query_failed', error: pilgrimageError.message || String(pilgrimageError) }],
    };
  }

  const openPilgrimages = (pilgrimages || []).filter((pilgrimage: any) => hasOpenPilgrimageAvailability(pilgrimage, now));
  const results: any[] = [];
  let candidates = 0;
  let sent = 0;
  let skipped = 0;

  for (const pilgrimage of openPilgrimages) {
    if (sent >= limit) break;

    const { data: waitlistRows, error: waitlistError } = await supabase
      .from('pilgrimage_waitlists')
      .select('id,email,full_name,phone,notes,status,created_at')
      .eq('pilgrimage_id', pilgrimage.id)
      .in('status', ['pending', 'active', 'waiting', 'waitlist'])
      .order('created_at', { ascending: true })
      .limit(Math.max(limit * 3, 10));

    if (waitlistError) {
      skipped += 1;
      results.push({ pilgrimage: pilgrimage.id, action: 'skipped', reason: 'waitlist_query_failed', error: waitlistError.message || String(waitlistError) });
      continue;
    }

    const rows = (waitlistRows || [])
      .map((row: any) => ({ ...row, normalized_email: normalizeEmail(row.email) }))
      .filter((row: any) => isDeliverableMarketingEmail(row.normalized_email));
    candidates += rows.length;
    if (!rows.length) continue;

    const emails = rows.map((row: any) => row.normalized_email);
    const { data: contacts, error: contactsError } = await supabase
      .from('marketing_contacts')
      .select('id,normalized_email,display_name,language,consent_state,recommendation,lead_score')
      .in('normalized_email', emails);
    if (contactsError) throw contactsError;

    const contactByEmail = new Map((contacts || []).map((contact: any) => [contact.normalized_email, contact]));
    const contactIds = (contacts || []).map((contact: any) => contact.id).filter(Boolean);
    const { data: previousLogs, error: logsError } = contactIds.length
      ? await supabase
          .from('marketing_message_logs')
          .select('contact_id,status,metadata')
          .eq('template_key', 'waitlist_open_spot')
          .eq('status', 'sent')
          .in('contact_id', contactIds)
      : { data: [], error: null };
    if (logsError) throw logsError;

    const sentForPilgrimage = new Set(
      (previousLogs || [])
        .filter((log: any) => log?.metadata?.pilgrimage_id === pilgrimage.id)
        .map((log: any) => log.contact_id),
    );

    for (const row of rows) {
      if (sent >= limit) break;
      const contact = contactByEmail.get(row.normalized_email) as any;
      if (!contact?.id) {
        skipped += 1;
        results.push({ waitlist: row.id, pilgrimage: pilgrimage.id, action: 'skipped', reason: 'missing_marketing_contact' });
        continue;
      }
      if (contact.consent_state === 'suppressed' || contact.consent_state === 'unsubscribed') {
        skipped += 1;
        results.push({ contact: contact.id, pilgrimage: pilgrimage.id, action: 'skipped', reason: `consent_${contact.consent_state}` });
        continue;
      }
      if (sentForPilgrimage.has(contact.id)) {
        skipped += 1;
        results.push({ contact: contact.id, pilgrimage: pilgrimage.id, action: 'skipped', reason: 'already_sent_for_pilgrimage' });
        continue;
      }

      const sendCounts = await countMarketingSendsForContact(supabase, contact.id, now, limits);
      if (sendCounts.recent >= 1 || sendCounts.week >= limits.maxEmailsPer7Days) {
        skipped += 1;
        results.push({ contact: contact.id, pilgrimage: pilgrimage.id, action: 'skipped', reason: 'rate_limited', sendCounts });
        continue;
      }

      const payloadContext = {
        pilgrimageName: pilgrimage.title || 'Garabandal',
        pilgrimageUrl: pilgrimageMarketingUrl(pilgrimage),
        pilgrimageImageUrl: pilgrimage.cover_image || null,
      };

      if (options.dryRun) {
        results.push({
          contact: contact.id,
          email: row.normalized_email,
          pilgrimage: pilgrimage.id,
          templateKey: 'waitlist_open_spot',
          action: 'would_send',
          condition: 'has_availability',
          context: payloadContext,
        });
        continue;
      }

      const result = await sendMarketingEmail({
        contact: {
          display_name: contact.display_name || row.full_name || '',
          normalized_email: row.normalized_email,
          language: contact.language || (String(row.notes || '').match(/\[locale:en\]/i) ? 'en' : 'pt'),
          recommendation: contact.recommendation || 'Announce next available pilgrimage',
        },
        templateKey: 'waitlist_open_spot',
        context: payloadContext,
      });

      await supabase.from('marketing_message_logs').insert({
        contact_id: contact.id,
        channel: 'email',
        to_email: row.normalized_email,
        provider_message_id: result.providerId || null,
        subject: result.subject || 'Vaga disponível',
        template_key: result.templateKey || 'waitlist_open_spot',
        status: result.sent ? 'sent' : 'failed',
        error_message: result.sent ? null : result.error,
        sent_at: result.sent ? now.toISOString() : null,
        metadata: {
          source: 'waitlist_open_spot_cron',
          condition: 'has_availability',
          pilgrimage_id: pilgrimage.id,
          waitlist_id: row.id,
          current_vacancies: pilgrimage.current_vacancies,
        },
      });

      if (result.sent) {
        sent += 1;
        sentForPilgrimage.add(contact.id);
        results.push({ contact: contact.id, pilgrimage: pilgrimage.id, action: 'sent', templateKey: result.templateKey });
      } else {
        skipped += 1;
        results.push({ contact: contact.id, pilgrimage: pilgrimage.id, action: 'failed', error: result.error });
      }
    }
  }

  return { checkedPilgrimages: openPilgrimages.length, candidates, sent, skipped, results };
};

export const processMarketingEnrollment = async (supabase: any, enrollment: any) => {
  const funnel = enrollment.funnel;
  const contact = enrollment.contact;
  const { steps, step } = getMarketingEnrollmentStep(enrollment);
  const nowIso = new Date().toISOString();
  const limits = getMarketingEmailLimits();

  if (!step || !contact?.normalized_email || contact.consent_state === 'suppressed' || contact.consent_state === 'unsubscribed') {
    await supabase
      .from('marketing_enrollments')
      .update({ status: 'stopped', stopped_reason: 'missing_contact_or_consent', next_run_at: null, updated_at: nowIso })
      .eq('id', enrollment.id);
    return { enrollment: enrollment.id, status: 'stopped', reason: 'missing_contact_or_consent' };
  }

  if (step.channel !== 'task' && isInternalMemberEmail(contact.normalized_email)) {
    await supabase.from('marketing_message_logs').insert({
      contact_id: contact.id,
      funnel_id: funnel.id,
      enrollment_id: enrollment.id,
      channel: step.channel || 'email',
      to_email: contact.normalized_email,
      subject: funnel.name,
      template_key: step.template_key || null,
      status: 'skipped',
      error_message: 'Email técnico interno; envio bloqueado.',
      metadata: { step, reason: 'internal_member_email' },
    });
    await supabase
      .from('marketing_enrollments')
      .update({ status: 'stopped', stopped_reason: 'internal_member_email', next_run_at: null, updated_at: nowIso })
      .eq('id', enrollment.id);
    return { enrollment: enrollment.id, status: 'stopped', reason: 'internal_member_email' };
  }

  if (marketingContactReachedGoal(contact, Array.isArray(step.stop_if) ? step.stop_if : ['suppressed', 'unsubscribed'])) {
    await supabase
      .from('marketing_enrollments')
      .update({ status: 'completed', goal_reached_at: nowIso, next_run_at: null, updated_at: nowIso })
      .eq('id', enrollment.id);
    return { enrollment: enrollment.id, status: 'goal_reached' };
  }

  if (!marketingStepConditionsPass(contact, step)) {
    const conditions = getMarketingStepConditions(step);
    const nextStepIndex = enrollment.current_step + 1;
    const nextStep = steps[nextStepIndex];
    await supabase.from('marketing_message_logs').insert({
      contact_id: contact.id,
      funnel_id: funnel.id,
      enrollment_id: enrollment.id,
      channel: step.channel || 'email',
      to_email: contact.normalized_email,
      subject: funnel.name,
      template_key: step.template_key || null,
      status: 'skipped',
      error_message: `Condição não cumprida: ${conditions.join(', ') || step.condition}`,
      metadata: { step, reason: 'condition_failed', effective_conditions: conditions },
    });
    await supabase
      .from('marketing_enrollments')
      .update({
        current_step: nextStepIndex,
        status: nextStep ? 'active' : 'completed',
        next_run_at: nextStep ? addMarketingHours(new Date(), Number(nextStep.delay_hours || 24)).toISOString() : null,
        updated_at: nowIso,
      })
      .eq('id', enrollment.id);
    return { enrollment: enrollment.id, status: 'skipped', reason: 'condition_failed', conditions };
  }

  if (step.channel !== 'task') {
    const sendCounts = await countMarketingSendsForContact(supabase, contact.id, new Date(), limits);

    if (sendCounts.recent >= 1 || sendCounts.week >= limits.maxEmailsPer7Days) {
      const retryAt = addMarketingHours(new Date(), limits.minHoursBetweenEmails).toISOString();
      await supabase
        .from('marketing_enrollments')
        .update({ next_run_at: retryAt, updated_at: nowIso })
        .eq('id', enrollment.id);
      await supabase.from('marketing_message_logs').insert({
        contact_id: contact.id,
        funnel_id: funnel.id,
        enrollment_id: enrollment.id,
        channel: step.channel || 'email',
        to_email: contact.normalized_email,
        subject: funnel.name,
        template_key: step.template_key || null,
        status: 'skipped',
        error_message: `Limite de frequência atingido. Reagendado +${limits.minHoursBetweenEmails}h.`,
        metadata: {
          step,
          reason: 'rate_limited',
          retry_at: retryAt,
          limits,
          sendCounts,
        },
      });
      return { enrollment: enrollment.id, status: 'rate_limited', retryAt, limits, sendCounts };
    }
  }

  if (step.channel === 'task') {
    await supabase.from('marketing_tasks').insert({
      contact_id: contact.id,
      title: `Follow up: ${contact.display_name || contact.normalized_email}`,
      description: contact.recommendation || funnel.description,
      task_type: 'follow_up',
      priority: contact.lead_score >= 90 ? 'high' : 'medium',
      source: funnel.slug,
      metadata: { enrollment_id: enrollment.id, step },
    });
  } else {
    const result = await sendMarketingEmail({
      contact,
      subject: step.subject_override || null,
      body: step.body_override || null,
      templateKey: step.template_key,
    });

    await supabase.from('marketing_message_logs').insert({
      contact_id: contact.id,
      funnel_id: funnel.id,
      enrollment_id: enrollment.id,
      channel: 'email',
      to_email: contact.normalized_email,
      provider_message_id: result.providerId || null,
      subject: result.subject || funnel.name,
      template_key: result.templateKey || step.template_key || null,
      status: result.sent ? 'sent' : 'failed',
      error_message: result.sent ? null : result.error,
      sent_at: result.sent ? nowIso : null,
      metadata: { step },
    });

    if (!result.sent) {
      await supabase
        .from('marketing_enrollments')
        .update({ status: 'failed', stopped_reason: result.error || 'send_failed', updated_at: nowIso })
        .eq('id', enrollment.id);
      return { enrollment: enrollment.id, status: 'failed', error: result.error };
    }
  }

  const nextStepIndex = enrollment.current_step + 1;
  const nextStep = steps[nextStepIndex];
  await supabase
    .from('marketing_enrollments')
    .update({
      current_step: nextStepIndex,
      status: nextStep ? 'active' : 'completed',
      next_run_at: nextStep ? addMarketingHours(new Date(), Number(nextStep.delay_hours || 24)).toISOString() : null,
      updated_at: nowIso,
    })
    .eq('id', enrollment.id);

  return { enrollment: enrollment.id, status: step.channel === 'task' ? 'task_created' : 'sent', step: enrollment.current_step };
};
