import { describe, expect, it } from 'vitest';
import { getPostalInvalidMessage, listCountryOptions } from '../lib/country-utils';

describe('country utilities', () => {
  it('exposes a broad English country list for public forms', () => {
    const countries = listCountryOptions('en');
    const labels = countries.map((country) => country.label);

    expect(countries.length).toBeGreaterThan(100);
    expect(countries).toContainEqual({ code: 'GB', label: 'United Kingdom' });
    expect(countries).toContainEqual({ code: 'US', label: 'United States' });
    expect(labels).not.toEqual(['Portugal', 'Brasil']);
  });

  it('returns validation messages in English when requested', () => {
    expect(getPostalInvalidMessage('GB', 'en')).toContain('Invalid postal code');
  });
});
