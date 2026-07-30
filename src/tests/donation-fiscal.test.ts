import { describe, expect, it } from 'vitest';

import {
  hasCompleteDonationBillingIdentity,
  hasCompleteDonationFiscalData,
  isValidDonationEmail,
  isValidDonationTaxId,
} from '../lib/donation-fiscal';

describe('donation fiscal requirements', () => {
  it('requires a real email for every donation', () => {
    expect(isValidDonationEmail('doador@example.com')).toBe(true);
    expect(isValidDonationEmail('anonimo')).toBe(false);
    expect(isValidDonationEmail('')).toBe(false);
  });

  it('recognizes complete billing identity for a final consumer invoice-receipt', () => {
    expect(hasCompleteDonationBillingIdentity({
      name: 'Maria Exemplo',
      email: 'maria@example.com',
      address: 'Rua Principal, 1',
      city: 'Porto',
      zip: '4000-001',
      country: 'PT',
      nif: null,
    })).toBe(true);
  });

  it('recognizes complete data when the taxpayer number is requested', () => {
    expect(hasCompleteDonationFiscalData({
      name: 'Maria Exemplo',
      email: 'maria@example.com',
      address: 'Rua Principal, 1',
      city: 'Porto',
      zip: '4000-001',
      country: 'PT',
      nif: '123456789',
    })).toBe(true);
    expect(hasCompleteDonationFiscalData({
      name: 'Maria Exemplo',
      email: 'maria@example.com',
      address: 'Rua Principal, 1',
      city: '',
      zip: '4000-001',
      country: 'PT',
      nif: '123456789',
    })).toBe(false);
  });

  it('validates Portuguese NIF and Brazilian CPF lengths', () => {
    expect(isValidDonationTaxId('256 396 078', 'PT')).toBe(true);
    expect(isValidDonationTaxId('25639607', 'PT')).toBe(false);
    expect(isValidDonationTaxId('123.456.789-01', 'BR')).toBe(true);
    expect(isValidDonationTaxId('ABC', 'US')).toBe(false);
  });
});
