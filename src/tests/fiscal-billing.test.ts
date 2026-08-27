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

  it('accepts every country the public forms offer, not only the curated ones', () => {
    // Registration stores whatever `listCountryOptions` offers (~250 ISO codes)
    // and older rows hold localized names. Anything that fails to resolve here
    // blocks checkout on "select the billing country" with no way to recover.
    const billing = normalizeFiscalBilling({
      ...complete,
      postalCode: '80904',
      city: 'Colorado Springs',
      country: 'United States',
      taxIdRequested: false,
    });

    expect(billing.country).toBe('US');
    expect(fiscalBillingMissingFields(billing)).toEqual([]);
    expect(normalizeFiscalBilling({ ...complete, country: 'AO' }).country).toBe('AO');
    expect(normalizeFiscalBilling({ ...complete, country: 'Angola' }).country).toBe('AO');
    expect(normalizeFiscalBilling({ ...complete, country: 'México' }).country).toBe('MX');
    expect(normalizeFiscalBilling({ ...complete, country: 'USA' }).country).toBe('US');
  });

  it('validates the taxpayer number against the resolved country', () => {
    const brazilian = {
      ...complete,
      postalCode: '58401-135',
      city: 'Campina Grande',
      country: 'Brasil',
      taxIdRequested: true,
    };

    expect(fiscalBillingMissingFields({ ...brazilian, nif: '6457348645' })).toContain('nif');
    expect(fiscalBillingMissingFields({ ...brazilian, nif: '064.573.486-45' })).toEqual([]);
  });

  it('accepts a taxpayer number issued by a country other than the billing one', () => {
    // A Portuguese member living in Belém pays with her PT NIF. Pinning the
    // format to the residence country locked her out of checkout entirely.
    expect(fiscalBillingMissingFields({
      ...complete,
      postalCode: '66093-671',
      city: 'Belém',
      country: 'BR',
      taxIdRequested: true,
      nif: '207067708',
    })).toEqual([]);
    // Brazilian CPF held by a member living in Germany.
    expect(fiscalBillingMissingFields({
      ...complete,
      postalCode: '67297',
      city: 'Marnheim',
      country: 'DE',
      taxIdRequested: true,
      nif: '46702149300',
    })).toEqual([]);
  });

  it('still rejects a truncated CPF and a NIF that fails its checksum', () => {
    expect(fiscalBillingMissingFields({
      ...complete,
      country: 'BR',
      postalCode: '58401-135',
      city: 'Campina Grande',
      taxIdRequested: true,
      nif: '6457348645',
    })).toContain('nif');
    expect(fiscalBillingMissingFields({
      ...complete,
      taxIdRequested: true,
      nif: '256396071',
    })).toContain('nif');
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
