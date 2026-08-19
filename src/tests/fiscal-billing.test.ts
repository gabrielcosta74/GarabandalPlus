import { describe, expect, it } from 'vitest';

import {
  fiscalBillingMissingFields,
  normalizeFiscalBilling,
} from '../lib/fiscal-billing';

describe('fiscal billing validation', () => {
  const complete = {
    name: 'Maria Exemplo',
    email: 'MARIA@example.com ',
    address: 'Rua Principal, 1',
    postalCode: '4000-001',
    city: 'Porto',
    country: 'Portugal',
  };

  it('normalizes the country and permits final consumer without a taxpayer number', () => {
    expect(normalizeFiscalBilling({
      ...complete,
      taxIdRequested: false,
      nif: '256396078',
    })).toEqual({
      ...complete,
      email: 'maria@example.com',
      country: 'PT',
      taxIdRequested: false,
      nif: null,
    });
    expect(fiscalBillingMissingFields({
      ...complete,
      taxIdRequested: false,
    })).toEqual([]);
  });

  it('requires a valid taxpayer number only when requested', () => {
    expect(fiscalBillingMissingFields({
      ...complete,
      taxIdRequested: true,
      nif: '',
    })).toContain('nif');
    expect(fiscalBillingMissingFields({
      ...complete,
      taxIdRequested: true,
      nif: '256396078',
    })).toEqual([]);
  });

  it('normalizes an unformatted Brazilian postal code before validation', () => {
    const billing = normalizeFiscalBilling({
      ...complete,
      postalCode: '35590050',
      city: 'Lagoa da Prata',
      country: 'BR',
      taxIdRequested: false,
    });

    expect(billing.postalCode).toBe('35590-050');
    expect(fiscalBillingMissingFields(billing)).toEqual([]);
  });

  it('rejects missing or invalid address fields', () => {
    expect(fiscalBillingMissingFields({
      ...complete,
      city: '',
      taxIdRequested: false,
    })).toContain('city');
    expect(fiscalBillingMissingFields({
      ...complete,
      postalCode: 'invalid',
      taxIdRequested: false,
    })).toContain('postalCode');
    expect(fiscalBillingMissingFields({
      ...complete,
      country: 'Outro',
      taxIdRequested: false,
    })).toContain('country');
  });
});
