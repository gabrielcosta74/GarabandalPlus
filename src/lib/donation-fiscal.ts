import {
  hasCompleteFiscalBilling,
  isValidFiscalEmail,
  isValidFiscalTaxId,
} from './fiscal-billing';

export type DonationFiscalInput = {
  name?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  zip?: string | null;
  country?: string | null;
  nif?: string | null;
};

export const isValidDonationEmail = (value: string | null | undefined) =>
  isValidFiscalEmail(value);

export const isValidDonationTaxId = (
  value: string | null | undefined,
  country: string | null | undefined,
) => isValidFiscalTaxId(value, country);

/**
 * Direct donations always issue a named Fatura-Recibo. The tax identifier is
 * optional, but the billing identity is not.
 */
export const hasCompleteDonationBillingIdentity = (
  input: DonationFiscalInput,
) => hasCompleteFiscalBilling({
  name: input.name,
  email: input.email,
  address: input.address,
  postalCode: input.zip,
  city: input.city,
  country: input.country,
  taxIdRequested: false,
});

export const hasCompleteDonationFiscalData = (input: DonationFiscalInput) =>
  hasCompleteFiscalBilling({
    name: input.name,
    email: input.email,
    address: input.address,
    postalCode: input.zip,
    city: input.city,
    country: input.country,
    taxIdRequested: true,
    nif: input.nif,
  });
