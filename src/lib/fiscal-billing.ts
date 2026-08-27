import {
  formatPostalCode,
  resolveCountryCode,
  validatePostalCode,
} from './country-utils';

export type FiscalBillingDetails = {
  name: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  taxIdRequested: boolean;
  nif: string | null;
};

export type FiscalBillingInput = Partial<{
  name: unknown;
  email: unknown;
  address: unknown;
  postalCode: unknown;
  city: unknown;
  country: unknown;
  taxIdRequested: unknown;
  nif: unknown;
}>;

export type FiscalBillingField =
  | 'name'
  | 'email'
  | 'address'
  | 'postalCode'
  | 'city'
  | 'country'
  | 'nif';

const clean = (value: unknown, maxLength: number) =>
  String(value ?? '').trim().slice(0, maxLength);

export const normalizeFiscalTaxId = (value: unknown): string | null => {
  const normalized = clean(value, 30).replace(/\D/g, '').slice(0, 20);
  return normalized || null;
};

export const normalizeFiscalCountry = (value: unknown): string =>
  resolveCountryCode(clean(value, 100)) || '';

const normalizeFiscalPostalCode = (
  value: unknown,
  country: string,
): string => {
  const raw = clean(value, 40);
  const compact = raw.replace(/[\s-]/g, '');
  const isCompactPortugueseCode = country === 'PT' && /^\d{7}$/.test(compact);
  const isCompactBrazilianCode = country === 'BR' && /^\d{8}$/.test(compact);

  return isCompactPortugueseCode || isCompactBrazilianCode
    ? formatPostalCode(compact, country)
    : raw;
};

export const isValidFiscalEmail = (value: unknown) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value, 200).toLowerCase());

const isPortugueseNif = (digits: string): boolean => {
  if (!/^\d{9}$/.test(digits)) return false;
  let sum = 0;
  for (let index = 0; index < 8; index += 1) {
    sum += Number(digits[index]) * (9 - index);
  }
  const remainder = 11 - (sum % 11);
  return (remainder >= 10 ? 0 : remainder) === Number(digits[8]);
};

export const isValidFiscalTaxId = (
  value: unknown,
  country: unknown,
): boolean => {
  const digits = normalizeFiscalTaxId(value) || '';
  const countryCode = normalizeFiscalCountry(country);
  // A Portuguese invoice can only carry a real NIF, so that one stays strict.
  if (countryCode === 'PT') return isPortugueseNif(digits);
  // Everywhere else the tax number belongs to the person, not to where they
  // live: Portuguese members resident in Brazil pay with their PT NIF, and
  // Brazilians living in Europe pay with their CPF.
  if (isPortugueseNif(digits)) return true;
  if (countryCode === 'BR') return digits.length === 11 || digits.length === 14;
  return digits.length >= 5 && digits.length <= 15;
};

export const normalizeFiscalBilling = (
  input: FiscalBillingInput,
): FiscalBillingDetails => {
  const taxIdRequested = input.taxIdRequested === true;
  const country = normalizeFiscalCountry(input.country);
  return {
    name: clean(input.name, 100),
    email: clean(input.email, 200).toLowerCase(),
    address: clean(input.address, 200),
    postalCode: normalizeFiscalPostalCode(input.postalCode, country),
    city: clean(input.city, 100),
    country,
    taxIdRequested,
    nif: taxIdRequested ? normalizeFiscalTaxId(input.nif) : null,
  };
};

export const fiscalBillingMissingFields = (
  input: FiscalBillingInput,
): FiscalBillingField[] => {
  const billing = normalizeFiscalBilling(input);
  const missing: FiscalBillingField[] = [];
  if (!billing.name) missing.push('name');
  if (!isValidFiscalEmail(billing.email)) missing.push('email');
  if (!billing.address) missing.push('address');
  if (!billing.postalCode) missing.push('postalCode');
  if (!billing.city) missing.push('city');
  if (!billing.country) missing.push('country');
  if (
    billing.postalCode
    && billing.country
    && !validatePostalCode(billing.country, billing.postalCode)
    && !missing.includes('postalCode')
  ) {
    missing.push('postalCode');
  }
  if (
    billing.taxIdRequested
    && !isValidFiscalTaxId(billing.nif, billing.country)
  ) {
    missing.push('nif');
  }
  return missing;
};

export const hasCompleteFiscalBilling = (input: FiscalBillingInput) =>
  fiscalBillingMissingFields(input).length === 0;

export const fiscalBillingErrorMessage = (
  fields: FiscalBillingField[],
  isEnglish = false,
  country?: unknown,
) => {
  if (fields.includes('email')) {
    return isEnglish ? 'Invalid billing email.' : 'Email de faturação inválido.';
  }
  if (fields.includes('country')) {
    return isEnglish
      ? 'Select the billing country.'
      : 'Seleciona o país de faturação.';
  }
  if (fields.includes('postalCode')) {
    return isEnglish
      ? 'Invalid billing postal code.'
      : 'Código postal de faturação inválido.';
  }
  if (fields.includes('nif')) {
    const code = normalizeFiscalCountry(country);
    if (code === 'PT') {
      return isEnglish
        ? 'Invalid tax number. Check the 9 digits of your NIF.'
        : 'NIF inválido. Confirma os 9 dígitos do teu NIF.';
    }
    if (code === 'BR') {
      return isEnglish
        ? 'Invalid tax number. The CPF has 11 digits (or use your 9-digit Portuguese NIF).'
        : 'CPF inválido. O CPF tem 11 dígitos (ou usa o NIF português de 9 dígitos).';
    }
    return isEnglish ? 'Invalid tax number.' : 'NIF/CPF inválido.';
  }
  return isEnglish
    ? 'Complete all billing address fields.'
    : 'Preenche a morada de faturação completa.';
};
