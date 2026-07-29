export const DONATION_SIMPLIFIED_INVOICE_LIMIT_EUR = 100;

export type DonationFiscalInput = {
  name?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  zip?: string | null;
  country?: string | null;
  nif?: string | null;
};

const hasText = (value: string | null | undefined) => Boolean(value?.trim());

export const isValidDonationEmail = (value: string | null | undefined) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value?.trim() || '');

export const isValidDonationTaxId = (
  value: string | null | undefined,
  country: string | null | undefined,
) => {
  const digits = String(value || '').replace(/\D/g, '');
  const normalizedCountry = String(country || '').trim().toUpperCase();
  if (normalizedCountry === 'PT') return digits.length === 9;
  if (normalizedCountry === 'BR') return digits.length === 11;
  return digits.length >= 5 && digits.length <= 15;
};

export const donationRequiresFullFiscalData = (amount: number) =>
  Number.isFinite(amount) && amount > DONATION_SIMPLIFIED_INVOICE_LIMIT_EUR;

export const hasCompleteDonationFiscalData = (input: DonationFiscalInput) =>
  hasText(input.name)
  && isValidDonationEmail(input.email)
  && hasText(input.address)
  && hasText(input.city)
  && hasText(input.zip)
  && hasText(input.country)
  && hasText(input.nif);
