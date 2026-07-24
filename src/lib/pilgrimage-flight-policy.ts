import { ALL_COUNTRY_CODES } from './country-data';
import { resolveCountryMeta } from './country-utils';

export const COUNTRY_BASED_FLIGHT_POLICY_KIND = 'country_based_v1' as const;

export type CountryBasedFlightPolicy = {
    kind: typeof COUNTRY_BASED_FLIGHT_POLICY_KIND;
    agency_required_countries: string[];
    self_arranged_rule: 'all_other_countries';
    estimates_eur: {
        BR: number | null;
        PT: number | null;
    };
    own_flight_schedule: {
        rome_arrival: {
            date: string;
            by: string;
            timezone: string;
            airport: string;
        };
        rome_split: {
            date: string;
            period: 'afternoon';
        };
        split_home: {
            date: string;
            period: 'afternoon';
        };
    };
    agency_segments: [
        'residence_to_rome',
        'rome_to_split',
        'split_to_home',
    ];
};

export type FlightOption = 'agency' | 'own';

export type PilgrimageFlightPolicySource = {
    flight_registration_policy?: unknown;
    pricing_config?: {
        flight_registration_policy?: unknown;
    } | null;
};

const COUNTRY_CODE_SET = new Set(ALL_COUNTRY_CODES);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const nullableEstimate = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export const normalizeResidenceCountryCode = (country: unknown): string | null => {
    if (typeof country !== 'string') return null;
    const normalized = country.trim();
    if (!normalized) return null;

    const upper = normalized.toUpperCase();
    if (COUNTRY_CODE_SET.has(upper)) return upper;

    const knownCountry = resolveCountryMeta(normalized);
    return knownCountry?.code || null;
};

export const parseCountryBasedFlightPolicy = (value: unknown): CountryBasedFlightPolicy | null => {
    if (!isRecord(value) || value.kind !== COUNTRY_BASED_FLIGHT_POLICY_KIND) return null;

    const estimates = isRecord(value.estimates_eur) ? value.estimates_eur : {};
    const schedule = isRecord(value.own_flight_schedule) ? value.own_flight_schedule : {};
    const romeArrival = isRecord(schedule.rome_arrival) ? schedule.rome_arrival : {};
    const romeSplit = isRecord(schedule.rome_split) ? schedule.rome_split : {};
    const splitHome = isRecord(schedule.split_home) ? schedule.split_home : {};
    const agencyCountries = Array.isArray(value.agency_required_countries)
        ? value.agency_required_countries
            .map(normalizeResidenceCountryCode)
            .filter((country): country is string => Boolean(country))
        : [];

    if (
        agencyCountries.length === 0 ||
        typeof romeArrival.date !== 'string' ||
        typeof romeArrival.by !== 'string' ||
        typeof romeArrival.airport !== 'string' ||
        typeof romeSplit.date !== 'string' ||
        typeof splitHome.date !== 'string'
    ) {
        return null;
    }

    return {
        kind: COUNTRY_BASED_FLIGHT_POLICY_KIND,
        agency_required_countries: agencyCountries,
        self_arranged_rule: 'all_other_countries',
        estimates_eur: {
            BR: nullableEstimate(estimates.BR),
            PT: nullableEstimate(estimates.PT),
        },
        own_flight_schedule: {
            rome_arrival: {
                date: romeArrival.date,
                by: romeArrival.by,
                timezone: typeof romeArrival.timezone === 'string' ? romeArrival.timezone : 'Europe/Rome',
                airport: romeArrival.airport,
            },
            rome_split: {
                date: romeSplit.date,
                period: 'afternoon',
            },
            split_home: {
                date: splitHome.date,
                period: 'afternoon',
            },
        },
        agency_segments: [
            'residence_to_rome',
            'rome_to_split',
            'split_to_home',
        ],
    };
};

export const getCountryBasedFlightPolicy = (
    pilgrimage: PilgrimageFlightPolicySource | null | undefined,
): CountryBasedFlightPolicy | null => {
    if (!pilgrimage) return null;
    return parseCountryBasedFlightPolicy(
        pilgrimage.flight_registration_policy
        ?? pilgrimage.pricing_config?.flight_registration_policy,
    );
};

export const deriveFlightOption = (
    country: unknown,
    policy: CountryBasedFlightPolicy,
): FlightOption | null => {
    const countryCode = normalizeResidenceCountryCode(country);
    if (!countryCode) return null;
    return policy.agency_required_countries.includes(countryCode) ? 'agency' : 'own';
};

export const getFlightEstimate = (
    country: unknown,
    policy: CountryBasedFlightPolicy,
): number | null => {
    const countryCode = normalizeResidenceCountryCode(country);
    if (countryCode !== 'BR' && countryCode !== 'PT') return null;
    return policy.estimates_eur[countryCode];
};

export const formatFlightEstimate = (
    estimate: number | null,
    locale: 'pt' | 'en' = 'pt',
): string => {
    if (estimate === null) return locale === 'en' ? 'To be confirmed' : 'A confirmar';
    return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'pt-PT', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 2,
    }).format(estimate);
};
