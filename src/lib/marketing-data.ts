import {
  MarketingContact,
  MarketingEvent,
  MarketingSourceLink,
  calculateMarketingScore,
  determineLifecycleStage,
  emptySourceSummary,
  evaluateMarketingSegments,
  getMarketingContactId,
  getMarketingRecommendation,
  inferLanguage,
  isDeliverableMarketingEmail,
  normalizeLocale,
  normalizeCountry,
  normalizeEmail,
  normalizePhone,
  normalizeQuotaStatus,
  normalizeText,
} from './marketing-core';

type SupabaseLike = {
  from: (table: string) => any;
};

type MutableContact = Omit<MarketingContact, 'segments'> & {
  segments: string[];
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const addUnique = (items: string[], value?: unknown) => {
  const id = typeof value === 'string' ? value : '';
  if (id && !items.includes(id)) items.push(id);
};

const hasOpenAvailability = (pilgrimage?: any) => {
  if (!pilgrimage) return false;
  const status = normalizeText(pilgrimage.status).toLowerCase();
  if (!['open', 'active', 'ativo'].includes(status)) return false;
  if (toNumber(pilgrimage.current_vacancies) <= 0) return false;
  if (pilgrimage.registration_deadline) {
    const deadline = new Date(pilgrimage.registration_deadline).getTime();
    if (!Number.isNaN(deadline) && deadline < Date.now()) return false;
  }
  return true;
};

const trackPilgrimageInterest = (
  contact: MutableContact,
  pilgrimageId?: unknown,
  pilgrimage?: any,
  options: { waitlist?: boolean } = {},
) => {
  addUnique(contact.source_summary.pilgrimage_interest_ids, pilgrimageId);
  if (options.waitlist) addUnique(contact.source_summary.waitlist_pilgrimage_ids, pilgrimageId);
  if (hasOpenAvailability(pilgrimage)) {
    addUnique(contact.source_summary.available_pilgrimage_ids, pilgrimageId);
    if (options.waitlist) addUnique(contact.source_summary.waitlist_available_pilgrimage_ids, pilgrimageId);
  }
  contact.source_summary.available_pilgrimages = contact.source_summary.available_pilgrimage_ids.length;
  contact.source_summary.waitlist_available_pilgrimages = contact.source_summary.waitlist_available_pilgrimage_ids.length;
};

const latest = (current: string | null, candidate?: string | null) => {
  if (!candidate) return current;
  if (!current) return candidate;
  return new Date(candidate).getTime() > new Date(current).getTime() ? candidate : current;
};

const getSourceKey = (input: { email?: unknown; phone?: unknown; fallback: string }) => {
  const email = normalizeEmail(input.email);
  if (email) return `email:${email}`;
  const phone = normalizePhone(input.phone);
  if (phone) return `phone:${phone}`;
  return input.fallback;
};

const mergeName = (current: string, next?: unknown) => {
  const value = normalizeText(next);
  if (!value) return current;
  if (!current) return value;
  return current.length >= value.length ? current : value;
};

const ensureContact = (
  map: Map<string, MutableContact>,
  input: {
    key: string;
    email?: unknown;
    phone?: unknown;
    name?: unknown;
    country?: unknown;
    locale?: unknown;
    occurredAt?: string | null;
  },
) => {
  const existing = map.get(input.key);
  const country = normalizeCountry(input.country);
  const locale = normalizeLocale(input.locale);
  if (existing) {
    const hadCountry = Boolean(existing.country);
    existing.display_name = mergeName(existing.display_name, input.name);
    existing.normalized_email = existing.normalized_email || normalizeEmail(input.email);
    existing.normalized_phone = existing.normalized_phone || normalizePhone(input.phone);
    existing.country = existing.country || country;
    existing.language = locale || (!hadCountry && country ? inferLanguage(country) : existing.language);
    existing.latest_activity_at = latest(existing.latest_activity_at, input.occurredAt);
    return existing;
  }

  const normalizedEmail = normalizeEmail(input.email);
  const normalizedPhone = normalizePhone(input.phone);
  const normalizedCountry = country;
  const source_summary = emptySourceSummary();
  const contact: MutableContact = {
    id: getMarketingContactId(input.key),
    source_key: input.key,
    normalized_email: normalizedEmail,
    normalized_phone: normalizedPhone,
    display_name: mergeName('', input.name),
    country: normalizedCountry,
    language: inferLanguage(normalizedCountry, locale),
    consent_state: 'assumed',
    lifecycle_stage: 'lead',
    lead_score: 0,
    recommendation: 'Keep nurturing',
    latest_activity_at: input.occurredAt || null,
    source_summary,
    value_total: 0,
    events: [],
    links: [],
    segments: [],
  };
  map.set(input.key, contact);
  return contact;
};

const addLink = (contact: MutableContact, link: MarketingSourceLink) => {
  if (contact.links.some((item) => item.source_table === link.source_table && item.source_id === link.source_id)) return;
  contact.links.push(link);
};

const addEvent = (contact: MutableContact, event: MarketingEvent) => {
  if (contact.events.some((item) => item.event_type === event.event_type && item.source_table === event.source_table && item.source_id === event.source_id)) return;
  contact.events.push(event);
  contact.latest_activity_at = latest(contact.latest_activity_at, event.occurred_at);
};

const safeSelect = async (supabase: SupabaseLike, table: string, select: string) => {
  const { data, error } = await supabase.from(table).select(select);
  if (error) {
    console.warn(`[Marketing] Failed to fetch ${table}:`, error.message || error);
    return [];
  }
  return data || [];
};

export async function buildMarketingContacts(supabase: SupabaseLike): Promise<MarketingContact[]> {
  const [
    members,
    leads,
    waitlists,
    bookings,
    pilgrims,
    pilgrimagePayments,
    donations,
    orders,
    quotaPayments,
    newsletterSubscribers,
    suppressions,
  ] = await Promise.all([
    safeSelect(supabase, 'membros', 'id,nome,email,telefone,country,is_membro,estado_quota,tipo_subscricao,data_adesao,proxima_quota,referral_code,referred_by_code,referrals_count,store_credits,updated_at'),
    safeSelect(supabase, 'booking_leads', 'id,pilgrimage_id,email,phone,name,status,step_reached,data,created_at,updated_at,last_notified_at,pilgrimages(title,slug,start_date,status,current_vacancies,registration_deadline)'),
    safeSelect(supabase, 'pilgrimage_waitlists', 'id,pilgrimage_id,user_id,email,full_name,phone,notes,status,created_at,pilgrimages(title,slug,start_date,status,current_vacancies,registration_deadline)'),
    safeSelect(supabase, 'bookings', 'id,user_id,pilgrimage_id,status,total_amount,paid_amount,notes,booking_date,created_at,updated_at,pilgrimages(title,slug,start_date,status,current_vacancies,registration_deadline)'),
    safeSelect(supabase, 'pilgrims', 'id,booking_id,full_name,email,phone,country,created_at,bookings(id,status,pilgrimage_id,pilgrimages(title,slug,start_date,status,current_vacancies,registration_deadline))'),
    safeSelect(supabase, 'pilgrimage_payments', 'id,booking_id,user_id,amount,status,method,created_at,bookings(id,pilgrimages(title,slug))'),
    safeSelect(supabase, 'donations', 'id,user_id,amount_cents,currency,status,method,metadata,donor_name,donor_email,donor_country,created_at,updated_at'),
    safeSelect(supabase, 'store_orders', 'id,order_ref,buyer_user_id,buyer_name,buyer_email,buyer_phone,billing_country,shipping_country,total_amount,currency,status,created_at'),
    safeSelect(supabase, 'pagamentos_quotas', 'id,user_id,data_pagamento,valor,metodo_pagamento,estado,membros(id,email,nome,telefone,country,estado_quota,is_membro)'),
    safeSelect(supabase, 'newsletter_subscribers', 'id,normalized_email,display_name,language,group_label,country,city,consent_state,subscribed_at,imported_at'),
    safeSelect(supabase, 'marketing_suppression_list', 'normalized_email,normalized_phone,reason'),
  ]);

  const byUserId = new Map<string, any>();
  const contacts = new Map<string, MutableContact>();

  for (const member of members) {
    if (member?.id) byUserId.set(member.id, member);
    const key = getSourceKey({ email: member.email, phone: member.telefone, fallback: `member:${member.id}` });
    const contact = ensureContact(contacts, {
      key,
      email: member.email,
      phone: member.telefone,
      name: member.nome,
      country: member.country,
      locale: member.country ? undefined : null,
      occurredAt: member.updated_at || member.data_adesao,
    });
    contact.source_summary.is_member = Boolean(member.is_membro || member.numero_socio || member.estado_quota);
    contact.source_summary.member_status = normalizeQuotaStatus(member.estado_quota);
    contact.source_summary.member_type = normalizeText(member.tipo_subscricao) || null;
    contact.source_summary.member_since = member.data_adesao || null;
    contact.source_summary.has_referral_code = Boolean(normalizeText(member.referral_code));
    contact.source_summary.referrals_count = toNumber(member.referrals_count);
    contact.source_summary.referred_by_code = normalizeText(member.referred_by_code) || null;
    addLink(contact, { source_table: 'membros', source_id: member.id, source_label: 'Membro' });
    addEvent(contact, {
      event_type: 'member_profile',
      source_table: 'membros',
      source_id: member.id,
      title: contact.source_summary.is_member ? 'Registo de membro' : 'Perfil de contacto',
      occurred_at: member.data_adesao || member.updated_at || new Date().toISOString(),
      metadata: { estado_quota: member.estado_quota, tipo_subscricao: member.tipo_subscricao },
    });
  }

  for (const lead of leads) {
    const key = getSourceKey({ email: lead.email, phone: lead.phone, fallback: `lead:${lead.id}` });
    const contact = ensureContact(contacts, {
      key,
      email: lead.email,
      phone: lead.phone,
      name: lead.name,
      country: lead.data?.country,
      locale: lead.data?.locale,
      occurredAt: lead.updated_at || lead.created_at,
    });
    // 'interested' = "Estou interessado em ir" (chat/page WhatsApp flow). It is a soft demand
    // signal only and must NOT count as a lead, or it would sweep the contact into the active
    // abandoned-registration / hot-pilgrimage-leads funnels (wrong copy). See marketing-core.ts.
    if (lead.status !== 'waitlist' && lead.status !== 'interested') contact.source_summary.leads += 1;
    if (lead.status === 'brochure_request') contact.source_summary.brochure_requests += 1;
    if (lead.status === 'waitlist') contact.source_summary.waitlists += 1;
    trackPilgrimageInterest(contact, lead.pilgrimage_id, lead.pilgrimages, { waitlist: lead.status === 'waitlist' });
    addLink(contact, {
      source_table: 'booking_leads',
      source_id: lead.id,
      source_label: lead.pilgrimages?.title || 'Lead de peregrinação',
      metadata: { status: lead.status, step_reached: lead.step_reached },
    });
    addEvent(contact, {
      event_type: lead.status === 'brochure_request' ? 'brochure_requested' : lead.status === 'waitlist' ? 'waitlist_joined' : lead.status === 'interested' ? 'interest_expressed' : 'registration_abandoned',
      source_table: 'booking_leads',
      source_id: lead.id,
      title: lead.pilgrimages?.title ? `Lead: ${lead.pilgrimages.title}` : 'Lead de peregrinação',
      occurred_at: lead.created_at,
      metadata: { status: lead.status, step_reached: lead.step_reached },
    });
    if (toNumber(lead.step_reached) >= 2 && lead.status === 'draft') contact.source_summary.leads += 1;
  }

  for (const waitlist of waitlists) {
    const key = getSourceKey({ email: waitlist.email, phone: waitlist.phone, fallback: `waitlist:${waitlist.id}` });
    const contact = ensureContact(contacts, {
      key,
      email: waitlist.email,
      phone: waitlist.phone,
      name: waitlist.full_name,
      locale: String(waitlist.notes || '').match(/\[locale:en\]/i) ? 'en' : undefined,
      occurredAt: waitlist.created_at,
    });
    contact.source_summary.waitlists += 1;
    trackPilgrimageInterest(contact, waitlist.pilgrimage_id, waitlist.pilgrimages, { waitlist: true });
    addLink(contact, {
      source_table: 'pilgrimage_waitlists',
      source_id: waitlist.id,
      source_label: waitlist.pilgrimages?.title || 'Lista de espera',
      metadata: { status: waitlist.status },
    });
    addEvent(contact, {
      event_type: 'waitlist_joined',
      source_table: 'pilgrimage_waitlists',
      source_id: waitlist.id,
      title: waitlist.pilgrimages?.title ? `Lista de espera: ${waitlist.pilgrimages.title}` : 'Entrou em lista de espera',
      occurred_at: waitlist.created_at,
      metadata: { status: waitlist.status },
    });
  }

  for (const pilgrim of pilgrims) {
    const key = getSourceKey({ email: pilgrim.email, phone: pilgrim.phone, fallback: `pilgrim:${pilgrim.id}` });
    const contact = ensureContact(contacts, {
      key,
      email: pilgrim.email,
      phone: pilgrim.phone,
      name: pilgrim.full_name,
      country: pilgrim.country,
      occurredAt: pilgrim.created_at,
    });
    contact.source_summary.pilgrims += 1;
    trackPilgrimageInterest(contact, pilgrim.bookings?.pilgrimage_id, pilgrim.bookings?.pilgrimages);
    addLink(contact, {
      source_table: 'pilgrims',
      source_id: pilgrim.id,
      source_label: pilgrim.bookings?.pilgrimages?.title || 'Peregrino',
      metadata: { booking_id: pilgrim.booking_id },
    });
    addEvent(contact, {
      event_type: 'pilgrim_recorded',
      source_table: 'pilgrims',
      source_id: pilgrim.id,
      title: pilgrim.bookings?.pilgrimages?.title ? `Peregrino: ${pilgrim.bookings.pilgrimages.title}` : 'Registo de peregrino',
      occurred_at: pilgrim.created_at,
      metadata: { booking_status: pilgrim.bookings?.status },
    });
  }

  for (const booking of bookings) {
    const member = booking.user_id ? byUserId.get(booking.user_id) : null;
    const key = getSourceKey({ email: member?.email, phone: member?.telefone, fallback: `booking:${booking.id}` });
    const contact = ensureContact(contacts, {
      key,
      email: member?.email,
      phone: member?.telefone,
      name: member?.nome,
      country: member?.country,
      locale: String(booking.notes || '').match(/\[locale:en\]/i) ? 'en' : String(booking.notes || '').match(/\[locale:pt\]/i) ? 'pt' : undefined,
      occurredAt: booking.updated_at || booking.booking_date || booking.created_at,
    });
    contact.source_summary.bookings += 1;
    if (['confirmed', 'completed'].includes(String(booking.status))) contact.source_summary.confirmed_bookings += 1;
    trackPilgrimageInterest(contact, booking.pilgrimage_id, booking.pilgrimages);
    addLink(contact, {
      source_table: 'bookings',
      source_id: booking.id,
      source_label: booking.pilgrimages?.title || 'Reserva de peregrinação',
      metadata: { status: booking.status, total_amount: booking.total_amount, paid_amount: booking.paid_amount },
    });
    addEvent(contact, {
      event_type: 'booking_created',
      source_table: 'bookings',
      source_id: booking.id,
      title: booking.pilgrimages?.title ? `Reserva: ${booking.pilgrimages.title}` : 'Reserva de peregrinação',
      occurred_at: booking.booking_date || booking.created_at,
      metadata: { status: booking.status, total_amount: booking.total_amount, paid_amount: booking.paid_amount },
    });
  }

  for (const payment of pilgrimagePayments) {
    const member = payment.user_id ? byUserId.get(payment.user_id) : null;
    const key = getSourceKey({ email: member?.email, phone: member?.telefone, fallback: `pilgrimage_payment:${payment.id}` });
    const contact = ensureContact(contacts, {
      key,
      email: member?.email,
      phone: member?.telefone,
      name: member?.nome,
      country: member?.country,
      occurredAt: payment.created_at,
    });
    contact.source_summary.pilgrimage_payments += 1;
    if (['verified', 'succeeded', 'paid'].includes(String(payment.status))) {
      contact.source_summary.pilgrimage_payment_value += toNumber(payment.amount);
    }
    if (['failed', 'canceled'].includes(String(payment.status))) contact.source_summary.failed_or_canceled_payments += 1;
    addEvent(contact, {
      event_type: 'pilgrimage_payment',
      source_table: 'pilgrimage_payments',
      source_id: payment.id,
      title: payment.bookings?.pilgrimages?.title ? `Pagamento: ${payment.bookings.pilgrimages.title}` : 'Pagamento de peregrinação',
      occurred_at: payment.created_at,
      metadata: { status: payment.status, method: payment.method, amount: payment.amount },
    });
  }

  for (const donation of donations) {
    const member = donation.user_id ? byUserId.get(donation.user_id) : null;
    const key = getSourceKey({
      email: donation.donor_email || member?.email,
      phone: member?.telefone,
      fallback: `donation:${donation.id}`,
    });
    const contact = ensureContact(contacts, {
      key,
      email: donation.donor_email || member?.email,
      phone: member?.telefone,
      name: donation.donor_name || member?.nome,
      country: donation.donor_country || member?.country,
      locale: donation.metadata?.locale,
      occurredAt: donation.updated_at || donation.created_at,
    });
    contact.source_summary.donations += 1;
    if (donation.status === 'succeeded') {
      contact.source_summary.succeeded_donations += 1;
      contact.source_summary.donation_value += toNumber(donation.amount_cents) / 100;
    }
    if (['failed', 'canceled'].includes(String(donation.status))) contact.source_summary.failed_or_canceled_payments += 1;
    addLink(contact, {
      source_table: 'donations',
      source_id: donation.id,
      source_label: 'Doação',
      metadata: { status: donation.status, method: donation.method },
    });
    addEvent(contact, {
      event_type: donation.status === 'succeeded' ? 'donation_succeeded' : 'donation_activity',
      source_table: 'donations',
      source_id: donation.id,
      title: donation.status === 'succeeded' ? 'Doação confirmada' : 'Atividade de doação',
      occurred_at: donation.created_at,
      metadata: { status: donation.status, amount_cents: donation.amount_cents, method: donation.method },
    });
  }

  for (const order of orders) {
    const member = order.buyer_user_id ? byUserId.get(order.buyer_user_id) : null;
    const key = getSourceKey({
      email: order.buyer_email || member?.email,
      phone: order.buyer_phone || member?.telefone,
      fallback: `store_order:${order.id}`,
    });
    const contact = ensureContact(contacts, {
      key,
      email: order.buyer_email || member?.email,
      phone: order.buyer_phone || member?.telefone,
      name: order.buyer_name || member?.nome,
      country: order.billing_country || order.shipping_country || member?.country,
      occurredAt: order.created_at,
    });
    contact.source_summary.store_orders += 1;
    if (['paid', 'succeeded', 'delivered'].includes(String(order.status))) {
      contact.source_summary.store_value += toNumber(order.total_amount);
    }
    addLink(contact, {
      source_table: 'store_orders',
      source_id: order.id,
      source_label: order.order_ref || 'Encomenda',
      metadata: { status: order.status, total_amount: order.total_amount },
    });
    addEvent(contact, {
      event_type: 'store_order',
      source_table: 'store_orders',
      source_id: order.id,
      title: order.order_ref ? `Encomenda ${order.order_ref}` : 'Encomenda na loja',
      occurred_at: order.created_at,
      metadata: { status: order.status, total_amount: order.total_amount },
    });
  }

  for (const quota of quotaPayments) {
    const member = quota.membros;
    const key = getSourceKey({ email: member?.email, phone: member?.telefone, fallback: `quota:${quota.id}` });
    const contact = ensureContact(contacts, {
      key,
      email: member?.email,
      phone: member?.telefone,
      name: member?.nome,
      country: member?.country,
      locale: String(quota.notes || '').match(/\[locale:en\]/i) ? 'en' : String(quota.notes || '').match(/\[locale:pt\]/i) ? 'pt' : undefined,
      occurredAt: quota.data_pagamento,
    });
    contact.source_summary.quota_payments += 1;
    if (['pago', 'paid'].includes(normalizeQuotaStatus(quota.estado))) {
      contact.source_summary.quota_value += toNumber(quota.valor);
    }
    addEvent(contact, {
      event_type: 'quota_payment',
      source_table: 'pagamentos_quotas',
      source_id: quota.id,
      title: 'Pagamento de quota',
      occurred_at: quota.data_pagamento ? `${quota.data_pagamento}T12:00:00Z` : new Date().toISOString(),
      metadata: { estado: quota.estado, metodo_pagamento: quota.metodo_pagamento, valor: quota.valor },
    });
  }

  for (const subscriber of newsletterSubscribers) {
    const key = getSourceKey({ email: subscriber.normalized_email, fallback: `newsletter:${subscriber.id}` });
    const contact = ensureContact(contacts, {
      key,
      email: subscriber.normalized_email,
      name: subscriber.display_name,
      country: subscriber.country,
      // Group/list language is authoritative — pass it as the locale so it wins
      // over any country inference for both new and existing (enriched) contacts.
      locale: subscriber.language,
      occurredAt: subscriber.subscribed_at,
    });
    contact.source_summary.newsletter_subscriber = true;
    contact.source_summary.newsletter_group = normalizeText(subscriber.group_label) || null;
    // Newsletter opt-in is an explicit consent upgrade — but never override a
    // stronger negative state (suppression is applied further below and wins).
    if (contact.consent_state === 'assumed' || contact.consent_state === 'unknown') {
      contact.consent_state = 'explicit';
    }
    addLink(contact, { source_table: 'newsletter_subscribers', source_id: subscriber.id, source_label: subscriber.group_label || 'Newsletter' });
    addEvent(contact, {
      event_type: 'newsletter_subscribed',
      source_table: 'newsletter_subscribers',
      source_id: subscriber.id,
      title: 'Subscrição de newsletter',
      occurred_at: subscriber.subscribed_at || subscriber.imported_at || new Date().toISOString(),
      metadata: { group_label: subscriber.group_label, language: subscriber.language },
    });
  }

  const suppressedEmails = new Set((suppressions || []).map((row: any) => normalizeEmail(row.normalized_email)).filter(Boolean) as string[]);
  const suppressedPhones = new Set((suppressions || []).map((row: any) => normalizePhone(row.normalized_phone)).filter(Boolean) as string[]);

  return Array.from(contacts.values())
    .map((contact) => {
      contact.value_total =
        contact.source_summary.donation_value +
        contact.source_summary.quota_value +
        contact.source_summary.store_value +
        contact.source_summary.pilgrimage_payment_value;
      contact.lead_score = calculateMarketingScore(contact.source_summary, contact.latest_activity_at);
      contact.lifecycle_stage = determineLifecycleStage(contact.source_summary);
      if (
        (contact.normalized_email && suppressedEmails.has(contact.normalized_email)) ||
        (contact.normalized_phone && suppressedPhones.has(contact.normalized_phone))
      ) {
        contact.lifecycle_stage = 'suppressed';
        contact.consent_state = 'suppressed';
      }
      contact.segments = evaluateMarketingSegments(contact);
      contact.recommendation = getMarketingRecommendation(contact);
      contact.events.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
      return contact;
    })
    .sort((a, b) => {
      if (b.lead_score !== a.lead_score) return b.lead_score - a.lead_score;
      return new Date(b.latest_activity_at || 0).getTime() - new Date(a.latest_activity_at || 0).getTime();
    });
}

export const filterMarketingContacts = (
  contacts: MarketingContact[],
  filters: { search?: string | null; segment?: string | null; stage?: string | null; minScore?: number | null },
) => {
  const search = normalizeText(filters.search).toLowerCase();
  return contacts.filter((contact) => {
    if (filters.segment && !contact.segments.includes(filters.segment)) return false;
    if (filters.stage && contact.lifecycle_stage !== filters.stage) return false;
    if (typeof filters.minScore === 'number' && contact.lead_score < filters.minScore) return false;
    if (!search) return true;
    return [
      contact.display_name,
      contact.normalized_email,
      contact.normalized_phone,
      contact.country,
      contact.recommendation,
      ...contact.links.map((link) => link.source_label || ''),
    ]
      .join(' ')
      .toLowerCase()
      .includes(search);
  });
};

const BATCH_SIZE_CONTACTS = 100;
const BATCH_SIZE_LINKS = 200;
const BATCH_SIZE_EVENTS = 200;


export async function persistMarketingContacts(supabase: SupabaseLike, contacts: MarketingContact[]) {
  let persistedContacts = 0;
  let persistedLinks = 0;
  let persistedEvents = 0;

  const now = new Date().toISOString();

  // 1. Batch-upsert all contacts and collect their DB ids
  const eligible = contacts.filter((c) => isDeliverableMarketingEmail(c.normalized_email));
  const emailToId = new Map<string, string>();

  for (let i = 0; i < eligible.length; i += BATCH_SIZE_CONTACTS) {
    const chunk = eligible.slice(i, i + BATCH_SIZE_CONTACTS);
    const rows = chunk.map((contact) => ({
      normalized_email: contact.normalized_email,
      normalized_phone: contact.normalized_phone,
      display_name: contact.display_name,
      country: contact.country,
      language: contact.language,
      consent_state: contact.consent_state,
      source_summary: contact.source_summary,
      latest_activity_at: contact.latest_activity_at,
      lead_score: contact.lead_score,
      lifecycle_stage: contact.lifecycle_stage,
      recommendation: contact.recommendation,
      updated_at: now,
    }));

    const { data: upserted, error: upsertError } = await supabase
      .from('marketing_contacts')
      .upsert(rows, { onConflict: 'normalized_email' })
      .select('id,normalized_email');

    if (upsertError || !upserted) {
      console.warn('[Marketing] Contact batch upsert failed:', upsertError?.message || upsertError);
      continue;
    }

    for (const row of upserted) {
      if (row.id && row.normalized_email) emailToId.set(row.normalized_email, row.id);
    }
    persistedContacts += upserted.length;
  }

  // 2. Batch-upsert links and events for all contacts that got an id
  const allLinkRows: object[] = [];
  const allEventRows: object[] = [];

  for (const contact of eligible) {
    const contactId = contact.normalized_email ? emailToId.get(contact.normalized_email) : undefined;
    if (!contactId) continue;

    for (const link of contact.links) {
      allLinkRows.push({
        contact_id: contactId,
        source_table: link.source_table,
        source_id: link.source_id,
        source_label: link.source_label || null,
        metadata: link.metadata || {},
      });
    }

    for (const event of contact.events.slice(0, 50)) {
      allEventRows.push({
        contact_id: contactId,
        event_type: event.event_type,
        source_table: event.source_table,
        source_id: event.source_id,
        title: event.title,
        occurred_at: event.occurred_at,
        metadata: event.metadata || {},
      });
    }
  }

  // Batch the links and events
  for (let i = 0; i < allLinkRows.length; i += BATCH_SIZE_LINKS) {
    const chunk = allLinkRows.slice(i, i + BATCH_SIZE_LINKS);
    const { error } = await supabase
      .from('marketing_contact_links')
      .upsert(chunk, { onConflict: 'contact_id,source_table,source_id' });
    if (!error) persistedLinks += chunk.length;
    else console.warn('[Marketing] Link batch upsert failed:', error.message || error);
  }

  for (let i = 0; i < allEventRows.length; i += BATCH_SIZE_EVENTS) {
    const chunk = allEventRows.slice(i, i + BATCH_SIZE_EVENTS);
    const { error } = await supabase
      .from('marketing_events')
      .upsert(chunk, { onConflict: 'contact_id,event_type,source_table,source_id' });
    if (!error) persistedEvents += chunk.length;
    else console.warn('[Marketing] Event batch upsert failed:', error.message || error);
  }

  return { persistedContacts, persistedLinks, persistedEvents };
}

export const buildMarketingOverview = (contacts: MarketingContact[]) => {
  const segmentCounts = contacts.reduce<Record<string, number>>((acc, contact) => {
    for (const segment of contact.segments) acc[segment] = (acc[segment] || 0) + 1;
    return acc;
  }, {});

  const activeContacts = contacts.filter((contact) => contact.consent_state !== 'suppressed');
  const hotLeads = contacts.filter((contact) => contact.segments.includes('hot-pilgrimage-leads')).slice(0, 8);
  const recentEvents = contacts
    .flatMap((contact) =>
      contact.events.slice(0, 4).map((event) => ({
        ...event,
        contact_id: contact.id,
        contact_name: contact.display_name,
        contact_email: contact.normalized_email,
      })),
    )
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 12);

  return {
    stats: {
      total_contacts: contacts.length,
      marketable_contacts: activeContacts.filter((contact) => !!contact.normalized_email).length,
      hot_pilgrimage_leads: segmentCounts['hot-pilgrimage-leads'] || 0,
      abandoned_registrations: segmentCounts['abandoned-registration'] || 0,
      waitlist_contacts: segmentCounts['waitlist-contacts'] || 0,
      donors_not_members: segmentCounts['donors-not-members'] || 0,
      members_without_referrals: segmentCounts['members-without-referrals'] || 0,
      high_value_supporters: segmentCounts['high-value-supporters'] || 0,
      total_value: contacts.reduce((sum, contact) => sum + contact.value_total, 0),
    },
    segmentCounts,
    hotLeads,
    recentEvents,
  };
};
