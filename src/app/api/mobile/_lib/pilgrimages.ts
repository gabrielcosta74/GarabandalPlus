import { getCivilDateTimestamp, isPubliclyListedPilgrimage, todayCivilTimestamp } from '../../../../lib/utils';
import {
  getCountryBasedFlightPolicy,
  getFlightRegistrationOptions,
} from '../../../../lib/pilgrimage-flight-policy';

type Locale = 'pt' | 'en';
type PilgrimageRow = Record<string, unknown>;

const numberOrNull = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const textOrNull = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const localizedText = (row: PilgrimageRow, field: string, locale: Locale) => {
  if (locale === 'en') return textOrNull(row[`${field}_en`]) || textOrNull(row[field]);
  return textOrNull(row[field]);
};

const localizedList = (row: PilgrimageRow, field: string, locale: Locale) => {
  const localized = locale === 'en' ? row[`${field}_en`] : row[field];
  const fallback = row[field];
  const value = Array.isArray(localized) && localized.length > 0 ? localized : fallback;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
};

const remainingSpots = (row: PilgrimageRow) => {
  const effective = numberOrNull(row.effective_vacancies);
  if (effective !== null) return Math.max(0, effective);

  const current = numberOrNull(row.current_vacancies);
  if (current !== null) return Math.max(0, current);

  const total = numberOrNull(row.total_vacancies) ?? 0;
  const confirmed = numberOrNull(row.confirmed_pax) ?? 0;
  return Math.max(0, total - confirmed);
};

const availabilityState = (row: PilgrimageRow, remaining: number) => {
  const status = String(row.status || '').toLowerCase();
  if (status === 'waitlist') return 'waitlist';
  if (['closed', 'archived', 'cancelled', 'canceled'].includes(status)) return 'closed';
  if (remaining <= 0) return 'sold_out';
  if (remaining <= 9) return 'limited';
  return 'available';
};

export function isMobilePublicPilgrimage(row: PilgrimageRow) {
  return isPubliclyListedPilgrimage({
    title: textOrNull(row.title),
    slug: textOrNull(row.slug),
    status: textOrNull(row.status),
    pricing_config: row.pricing_config ?? null,
  });
}

export function serializePilgrimage(row: PilgrimageRow, locale: Locale) {
  const remaining = remainingSpots(row);
  const startDate = textOrNull(row.start_date);
  const startTimestamp = getCivilDateTimestamp(startDate);

  const rawPricing = row.pricing_config && typeof row.pricing_config === 'object'
    ? row.pricing_config as Record<string, unknown>
    : {};
  const rawSupplements = rawPricing.room_supplements && typeof rawPricing.room_supplements === 'object'
    ? rawPricing.room_supplements as Record<string, unknown>
    : {};
  const roomSupplements = Object.fromEntries(
    Object.entries(rawSupplements).flatMap(([type, value]) => {
      const mobileType = type === 'quadruple' ? 'family' : type;
      if (!['single', 'double', 'triple', 'family'].includes(mobileType)) return [];
      const amount = numberOrNull(value);
      return amount === null ? [] : [[mobileType, amount]];
    }),
  );
  const countryPolicy = getCountryBasedFlightPolicy({ pricing_config: rawPricing });
  const flightOptions = getFlightRegistrationOptions({ pricing_config: rawPricing });
  const effectiveFlightOptions = countryPolicy ? ['agency', 'own'] : flightOptions;
  const optionCopy = (option: string) => {
    if (option === 'agency') return {
      id: option,
      label: locale === 'en' ? 'Agency flights' : 'Voos pela agência',
      description: localizedText(row, 'group_flight_details', locale),
      priceFrom: numberOrNull(row.flight_price_from),
    };
    if (option === 'own') return {
      id: option,
      label: locale === 'en' ? 'Own travel arrangements' : 'Viagem organizada por mim',
      description: localizedText(row, 'flight_info_text', locale),
      priceFrom: null,
    };
    return {
      id: option,
      label: locale === 'en' ? 'No group flight' : 'Sem voo de grupo',
      description: null,
      priceFrom: null,
    };
  };
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || process.env.APP_URL
    || 'https://apostoladodegarabandal.com'
  ).replace(/\/$/, '');

  return {
    id: textOrNull(row.id),
    slug: textOrNull(row.slug),
    title: localizedText(row, 'title', locale),
    description: localizedText(row, 'description', locale),
    coverImage: textOrNull(row.cover_image),
    startDate,
    endDate: textOrNull(row.end_date),
    status: textOrNull(row.status),
    isUpcoming: Number.isFinite(startTimestamp) && startTimestamp >= todayCivilTimestamp(),
    registrationDeadline: textOrNull(row.registration_deadline),
    itinerarySummary: localizedText(row, 'itinerary_summary', locale),
    prices: {
      currency: 'EUR',
      base: numberOrNull(row.base_price),
      deposit: numberOrNull(row.deposit_value),
      minimumDeposit: numberOrNull(row.min_deposit),
      flightFrom: numberOrNull(row.flight_price_from),
      configuration: row.pricing_config ?? null,
    },
    availability: {
      state: availabilityState(row, remaining),
      total: numberOrNull(row.total_vacancies),
      remaining,
      confirmed: numberOrNull(row.confirmed_pax) ?? 0,
      pending: numberOrNull(row.pending_pax) ?? 0,
    },
    logistics: {
      meetingPoint: localizedText(row, 'meeting_point_text', locale),
      meetingEnd: localizedText(row, 'meeting_end_text', locale),
      flightInfo: localizedText(row, 'flight_info_text', locale),
      groupFlightDetails: localizedText(row, 'group_flight_details', locale),
      paymentPlan: localizedText(row, 'payment_plan_text', locale),
      cancellationPolicy: localizedText(row, 'cancellation_policy_text', locale),
      transport: localizedText(row, 'transport_description', locale),
      accommodation: localizedText(row, 'accommodation_description', locale),
      included: localizedList(row, 'included_items', locale),
      notIncluded: localizedList(row, 'not_included_items', locale),
    },
    pricingConfig: {
      roomSupplements,
      installmentDeadline: textOrNull(rawPricing.installment_deadline),
      maximumInstallments: numberOrNull(rawPricing.maximum_installments),
      roomAvailability: Object.fromEntries(
        ['single', 'double', 'triple', 'family'].map((type) => [
          type,
          type === 'double' || Object.prototype.hasOwnProperty.call(roomSupplements, type),
        ]),
      ),
    },
    flightPolicy: {
      required: Boolean(countryPolicy) || !flightOptions.includes('none'),
      countryBased: Boolean(countryPolicy),
      options: effectiveFlightOptions.map(optionCopy),
    },
    termsUrl: locale === 'en' ? `${siteUrl}/en/terms` : `${siteUrl}/termos`,
  };
}

export function serializeLocalizedChild(
  row: Record<string, unknown>,
  locale: Locale,
  localizedFields: string[],
) {
  const result = { ...row };
  for (const field of localizedFields) {
    result[field] = localizedText(row, field, locale);
    delete result[`${field}_en`];
  }
  delete result.pilgrimage_id;
  return result;
}
