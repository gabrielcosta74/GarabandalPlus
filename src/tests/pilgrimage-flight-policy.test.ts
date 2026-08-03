import { describe, expect, it } from 'vitest';
import {
    deriveFlightOption,
    formatFlightEstimate,
    getCountryBasedFlightPolicy,
    getFlightRegistrationOptions,
    getFlightEstimate,
    normalizeResidenceCountryCode,
    parseCountryBasedFlightPolicy,
} from '../lib/pilgrimage-flight-policy';

const policyInput = {
    kind: 'country_based_v1',
    agency_required_countries: ['PT', 'BR'],
    self_arranged_rule: 'all_other_countries',
    estimates_eur: {
        BR: 1300,
        PT: null,
    },
    own_flight_schedule: {
        rome_arrival: {
            date: '2027-04-05',
            by: '10:00',
            timezone: 'Europe/Rome',
            airport: 'Aeroporto Leonardo da Vinci/Fiumicino (FCO)',
        },
        rome_split: {
            date: '2027-04-14',
            period: 'afternoon',
        },
        split_home: {
            date: '2027-04-17',
            period: 'afternoon',
        },
    },
    agency_segments: ['residence_to_rome', 'rome_to_split', 'split_to_home'],
};

describe('country-based pilgrimage flight policy', () => {
    const policy = parseCountryBasedFlightPolicy(policyInput);

    it('parses the configured schedule and estimates', () => {
        expect(policy).not.toBeNull();
        expect(policy?.own_flight_schedule.rome_arrival.by).toBe('10:00');
        expect(policy?.estimates_eur).toEqual({ BR: 1300, PT: null });
    });

    it('forces Portugal and Brazil through the agency', () => {
        expect(deriveFlightOption('PT', policy!)).toBe('agency');
        expect(deriveFlightOption('Portugal', policy!)).toBe('agency');
        expect(deriveFlightOption('BR', policy!)).toBe('agency');
        expect(deriveFlightOption('Brasil', policy!)).toBe('agency');
    });

    it('forces every other valid country to use self-arranged flights', () => {
        ['US', 'GB', 'IE', 'AU', 'ES', 'FR', 'AO', 'MZ'].forEach(country => {
            expect(deriveFlightOption(country, policy!)).toBe('own');
        });
    });

    it('rejects missing or unknown residence countries', () => {
        expect(normalizeResidenceCountryCode('')).toBeNull();
        expect(normalizeResidenceCountryCode('ZZ')).toBeNull();
        expect(deriveFlightOption('ZZ', policy!)).toBeNull();
    });

    it('keeps estimates informative and nullable', () => {
        expect(getFlightEstimate('BR', policy!)).toBe(1300);
        expect(getFlightEstimate('PT', policy!)).toBeNull();
        expect(getFlightEstimate('US', policy!)).toBeNull();
        expect(formatFlightEstimate(null, 'pt')).toBe('A confirmar');
        expect(formatFlightEstimate(null, 'en')).toBe('To be confirmed');
    });

    it('returns null for standard pilgrimages without the special policy', () => {
        expect(parseCountryBasedFlightPolicy(null)).toBeNull();
        expect(parseCountryBasedFlightPolicy({ kind: 'standard' })).toBeNull();
    });

    it('reads the policy from pricing_config without changing room supplements', () => {
        const pricingConfig = {
            room_supplements: { double: 0, single: 900 },
            flight_registration_policy: policyInput,
        };

        expect(getCountryBasedFlightPolicy({ pricing_config: pricingConfig })?.kind).toBe('country_based_v1');
        expect(pricingConfig.room_supplements).toEqual({ double: 0, single: 900 });
    });
});

describe('selectable pilgrimage flight options', () => {
    it('keeps the existing three options when no custom list is configured', () => {
        expect(getFlightRegistrationOptions({ pricing_config: {} })).toEqual([
            'none',
            'own',
            'agency',
        ]);
    });

    it('supports an explicit own-flight and group-flight choice', () => {
        expect(getFlightRegistrationOptions({
            pricing_config: {
                flight_registration_options: ['own', 'agency'],
            },
        })).toEqual(['own', 'agency']);
    });

    it('ignores duplicates and unsupported values', () => {
        expect(getFlightRegistrationOptions({
            pricing_config: {
                flight_registration_options: ['own', 'unsupported', 'agency', 'own'],
            },
        })).toEqual(['own', 'agency']);
    });
});
