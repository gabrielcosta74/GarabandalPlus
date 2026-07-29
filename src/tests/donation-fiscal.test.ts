import { describe, expect, it } from 'vitest';

import {
  donationRequiresFullFiscalData,
  hasCompleteDonationFiscalData,
  isValidDonationEmail,
  isValidDonationTaxId,
} from '../lib/donation-fiscal';

describe('donation fiscal requirements', () => {
  it('allows simplified invoices up to and including 100 euros', () => {
    expect(donationRequiresFullFiscalData(100)).toBe(false);
    expect(donationRequiresFullFiscalData(100.01)).toBe(true);
  });

  it('requires a real email for every donation', () => {
    expect(isValidDonationEmail('doador@example.com')).toBe(true);
    expect(isValidDonationEmail('anonimo')).toBe(false);
    expect(isValidDonationEmail('')).toBe(false);
  });

  it('recognizes complete data for a Fatura-Recibo', () => {
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
