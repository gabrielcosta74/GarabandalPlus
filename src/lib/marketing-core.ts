export type MarketingLifecycleStage =
  | 'lead'
  | 'prospect'
  | 'pilgrim_lead'
  | 'pilgrim'
  | 'donor'
  | 'member'
  | 'supporter'
  | 'suppressed';

export type MarketingConsentState = 'assumed' | 'explicit' | 'unsubscribed' | 'suppressed' | 'unknown';

export type MarketingEvent = {
  event_type: string;
  source_table: string;
  source_id: string;
  title: string;
  occurred_at: string;
  metadata?: Record<string, unknown>;
};

export type MarketingSourceLink = {
  source_table: string;
  source_id: string;
  source_label?: string;
  metadata?: Record<string, unknown>;
};

export type MarketingContact = {
  id: string;
  source_key: string;
  normalized_email: string | null;
  normalized_phone: string | null;
  display_name: string;
  country: string | null;
  language: 'pt' | 'en';
  consent_state: MarketingConsentState;
  lifecycle_stage: MarketingLifecycleStage;
  lead_score: number;
  recommendation: string;
  latest_activity_at: string | null;
  source_summary: MarketingSourceSummary;
  value_total: number;
  events: MarketingEvent[];
  links: MarketingSourceLink[];
  segments: string[];
};

export type MarketingSourceSummary = {
  leads: number;
  brochure_requests: number;
  waitlists: number;
  bookings: number;
  confirmed_bookings: number;
  pilgrims: number;
  donations: number;
  succeeded_donations: number;
  donation_value: number;
  quota_payments: number;
  quota_value: number;
  store_orders: number;
  store_value: number;
  pilgrimage_payments: number;
  pilgrimage_payment_value: number;
  is_member: boolean;
  member_status: string | null;
  member_type: string | null;
  member_since: string | null;
  has_referral_code: boolean;
  referrals_count: number;
  referred_by_code: string | null;
  failed_or_canceled_payments: number;
  pilgrimage_interest_ids: string[];
  available_pilgrimage_ids: string[];
  waitlist_pilgrimage_ids: string[];
  waitlist_available_pilgrimage_ids: string[];
  available_pilgrimages: number;
  waitlist_available_pilgrimages: number;
};

export type MarketingSegment = {
  name: string;
  slug: string;
  description: string;
};

export const DEFAULT_MARKETING_SEGMENTS: MarketingSegment[] = [
  {
    name: 'Hot pilgrimage leads',
    slug: 'hot-pilgrimage-leads',
    description: 'High-intent contacts with pilgrimage interest but no booking.',
  },
  {
    name: 'Abandoned registration',
    slug: 'abandoned-registration',
    description: 'Contacts who started a pilgrimage registration and did not book.',
  },
  {
    name: 'Brochure requested but not booked',
    slug: 'brochure-requested-not-booked',
    description: 'Contacts who requested a brochure but have no booking.',
  },
  {
    name: 'Waitlist contacts',
    slug: 'waitlist-contacts',
    description: 'Contacts currently on a pilgrimage waitlist.',
  },
  {
    name: 'Past pilgrims',
    slug: 'past-pilgrims',
    description: 'Contacts with pilgrimage participation history.',
  },
  {
    name: 'Donors not members',
    slug: 'donors-not-members',
    description: 'Succeeded donors without active or historical membership.',
  },
  {
    name: 'New members',
    slug: 'new-members',
    description: 'Members who joined within the last 14 days (onboarding).',
  },
  {
    name: 'Members without referrals',
    slug: 'members-without-referrals',
    description: 'Members with no recorded referrals.',
  },
  {
    name: 'Expired/pending members',
    slug: 'expired-pending-members',
    description: 'Members with expired or pending quota state.',
  },
  {
    name: 'High-value supporters',
    slug: 'high-value-supporters',
    description: 'Contacts with meaningful donation, order, pilgrimage, or quota value.',
  },
];

export const normalizeEmail = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.includes('@') ? email : null;
};

export const INTERNAL_MEMBER_EMAIL_SUFFIX = '@sem-email.local';

export const isInternalMemberEmail = (value: unknown) => {
  const email = normalizeEmail(value);
  return Boolean(email && email.endsWith(INTERNAL_MEMBER_EMAIL_SUFFIX));
};

export const isDeliverableMarketingEmail = (value: unknown) => {
  const email = normalizeEmail(value);
  return Boolean(email && !isInternalMemberEmail(email));
};

export const normalizePhone = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/[^\d+]/g, '');
  if (!digits || digits.length < 7) return null;
  return digits.startsWith('+') ? digits : digits.replace(/[^\d]/g, '');
};

export const normalizeText = (value: unknown) => {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^'+|'+$/g, '').trim();
};

export const normalizeQuotaStatus = (value: unknown) => {
  const status = normalizeText(value).toLowerCase();
  if (['pago', 'paid', 'active', 'ativa', 'ativo'].includes(status)) return 'pago';
  if (['expirado', 'expired', 'overdue'].includes(status)) return 'expirado';
  if (['revogado', 'revoked', 'suspenso', 'suspended'].includes(status)) return 'revogado';
  if (['pendente', 'pending', ''].includes(status)) return 'pendente';
  return status;
};

export const normalizeCountry = (value: unknown) => {
  const country = normalizeText(value);
  const lower = country.toLowerCase();
  if (!country) return null;
  if (['pt', 'portugal'].includes(lower)) return 'Portugal';
  if (['br', 'brasil', 'brazil'].includes(lower)) return 'Brasil';
  if (['us', 'usa', 'estados unidos', 'united states'].includes(lower)) return 'Estados Unidos';
  if (['uk', 'gb', 'great britain', 'united kingdom', 'reino unido'].includes(lower)) return 'United Kingdom';
  if (['au', 'australia', 'austrália'].includes(lower)) return 'Australia';
  if (['ca', 'canada', 'canadá'].includes(lower)) return 'Canada';
  if (['suiça', 'suica', 'switzerland'].includes(lower)) return 'Suiça';
  return country;
};

export const normalizeLocale = (value: unknown): 'pt' | 'en' | null => {
  const locale = normalizeText(value).toLowerCase();
  if (['en', 'eng', 'english', 'en-gb', 'en-us'].includes(locale)) return 'en';
  if (['pt', 'por', 'portuguese', 'pt-pt', 'pt-br'].includes(locale)) return 'pt';
  return null;
};

export const inferLanguage = (country: string | null, explicitLocale?: unknown): 'pt' | 'en' => {
  const locale = normalizeLocale(explicitLocale);
  if (locale) return locale;
  if (!country) return 'pt';
  const normalizedCountry = normalizeCountry(country);
  const lower = normalizeText(normalizedCountry).toLowerCase();
  const portugueseCountries = ['portugal', 'brasil', 'brazil', 'angola', 'moçambique', 'mocambique', 'cabo verde', 'guiné-bissau', 'guine-bissau', 'são tomé e príncipe', 'sao tome e principe'];
  if (portugueseCountries.includes(lower)) return 'pt';
  return 'en';
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const getMarketingContactId = (sourceKey: string) => `mkt_${hashString(sourceKey)}`;

export const emptySourceSummary = (): MarketingSourceSummary => ({
  leads: 0,
  brochure_requests: 0,
  waitlists: 0,
  bookings: 0,
  confirmed_bookings: 0,
  pilgrims: 0,
  donations: 0,
  succeeded_donations: 0,
  donation_value: 0,
  quota_payments: 0,
  quota_value: 0,
  store_orders: 0,
  store_value: 0,
  pilgrimage_payments: 0,
  pilgrimage_payment_value: 0,
  is_member: false,
  member_status: null,
  member_type: null,
  member_since: null,
  has_referral_code: false,
  referrals_count: 0,
  referred_by_code: null,
  failed_or_canceled_payments: 0,
  pilgrimage_interest_ids: [],
  available_pilgrimage_ids: [],
  waitlist_pilgrimage_ids: [],
  waitlist_available_pilgrimage_ids: [],
  available_pilgrimages: 0,
  waitlist_available_pilgrimages: 0,
});

export const evaluateMarketingSegments = (contact: Pick<MarketingContact, 'source_summary' | 'lead_score' | 'lifecycle_stage'>) => {
  const s = contact.source_summary;
  const segments: string[] = [];
  if (contact.lead_score >= 70 && s.leads > 0 && s.waitlists === 0 && s.bookings === 0) segments.push('hot-pilgrimage-leads');
  if (s.leads > 0 && s.waitlists === 0 && s.bookings === 0) segments.push('abandoned-registration');
  if (s.brochure_requests > 0 && s.bookings === 0) segments.push('brochure-requested-not-booked');
  if (s.waitlists > 0) segments.push('waitlist-contacts');
  if (s.pilgrims > 0 || s.bookings > 0) segments.push('past-pilgrims');
  if (s.succeeded_donations > 0 && !s.is_member) segments.push('donors-not-members');
  if (s.is_member && s.member_since) {
    const joinedAt = new Date(s.member_since).getTime();
    if (!Number.isNaN(joinedAt) && (Date.now() - joinedAt) <= 14 * 24 * 60 * 60 * 1000) {
      segments.push('new-members');
    }
  }
  if (s.is_member && s.referrals_count === 0) segments.push('members-without-referrals');
  if (['expirado', 'pendente', 'revogado'].includes(s.member_status || '')) segments.push('expired-pending-members');
  if ((s.donation_value + s.quota_value + s.store_value + s.pilgrimage_payment_value) >= 100) segments.push('high-value-supporters');
  return segments;
};

export const calculateMarketingScore = (summary: MarketingSourceSummary, latestActivityAt: string | null) => {
  let score = 0;
  if (summary.brochure_requests > 0) score += 30;
  if (summary.leads > 0) score += 20;
  if (summary.waitlists > 0) score += 50;
  if (summary.confirmed_bookings > 0) score += 80;
  if (summary.succeeded_donations > 0) score += 50;
  if (summary.is_member && summary.member_status === 'pago') score += 30;
  if (summary.has_referral_code || summary.referrals_count > 0 || summary.referred_by_code) score += 20;
  if (summary.failed_or_canceled_payments > 0 && summary.succeeded_donations === 0 && summary.confirmed_bookings === 0) score -= 30;

  if (latestActivityAt) {
    const last = new Date(latestActivityAt).getTime();
    if (!Number.isNaN(last)) {
      const inactiveDays = (Date.now() - last) / (1000 * 60 * 60 * 24);
      if (inactiveDays > 180) score -= 50;
    }
  }

  return Math.max(0, Math.min(100, score));
};

export const determineLifecycleStage = (summary: MarketingSourceSummary): MarketingLifecycleStage => {
  if (summary.is_member) return 'member';
  if (summary.succeeded_donations > 0) return 'donor';
  if (summary.bookings > 0 || summary.pilgrims > 0) return 'pilgrim';
  if (summary.leads > 0 || summary.waitlists > 0 || summary.brochure_requests > 0) return 'pilgrim_lead';
  if (summary.store_orders > 0 || summary.quota_payments > 0 || summary.referrals_count > 0) return 'supporter';
  return 'prospect';
};

export const getMarketingRecommendation = (contact: Pick<MarketingContact, 'lead_score' | 'source_summary'>) => {
  const s = contact.source_summary;
  if (s.waitlists > 0 && s.bookings === 0) return 'Announce next available pilgrimage';
  if (contact.lead_score >= 70 && (s.leads > 0 || s.brochure_requests > 0) && s.bookings === 0) {
    return 'Manual follow-up + pilgrimage funnel';
  }
  if (s.succeeded_donations > 0 && !s.is_member) return 'Invite to become a member';
  if (s.is_member && s.referrals_count === 0) return 'Activate member referral sharing';
  if (['expirado', 'pendente', 'revogado'].includes(s.member_status || '')) return 'Renew membership support';
  if (s.donation_value + s.quota_value + s.store_value + s.pilgrimage_payment_value >= 100) return 'Invite deeper mission support';
  return 'Keep nurturing';
};

export const isContactInSegment = (contact: Pick<MarketingContact, 'segments'>, segmentSlug: string) =>
  contact.segments.includes(segmentSlug);
