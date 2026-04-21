import { ALL_COUNTRY_CODES, COUNTRY_META_BY_CODE, COUNTRY_META_BY_NAME, CountryMeta } from './country-data';

const getDisplayNames = (locale = 'pt-PT') => {
  try {
    return new Intl.DisplayNames(locale, { type: 'region' });
  } catch {
    return null;
  }
};

export const listCountryOptions = (locale = 'pt-PT') => {
  const displayNames = getDisplayNames(locale);
  return ALL_COUNTRY_CODES.map((code) => ({
    code,
    label: displayNames?.of(code) || code,
  })).sort((a, b) => a.label.localeCompare(b.label, locale));
};

export const listCountryLabels = (locale = 'pt-PT') => listCountryOptions(locale).map((option) => option.label);

export const resolveCountryMeta = (country: string | null | undefined): CountryMeta | undefined => {
  if (!country) return undefined;
  const normalized = country.trim();
  if (!normalized) return undefined;
  const byCode = COUNTRY_META_BY_CODE[normalized.toUpperCase()];
  if (byCode) return byCode;
  return COUNTRY_META_BY_NAME[normalized];
};

export const normalizePhone = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('00')) {
    return `+${trimmed.slice(2).replace(/[^\d]/g, '')}`;
  }
  if (trimmed.startsWith('+')) {
    return `+${trimmed.replace(/[^\d]/g, '')}`;
  }
  return trimmed.replace(/[^\d]/g, '');
};

export const withCountryPrefix = (value: string, country?: string | null) => {
  if (!value) return value;
  if (value.startsWith('+')) return value;
  const meta = resolveCountryMeta(country);
  if (!meta) return value;
  const digits = value.replace(/[^\d]/g, '');
  return `${meta.phonePrefix}${digits ? ` ${digits}` : ''}`.trim();
};

export const formatPostalCode = (value: string, country?: string | null) => {
  if (!value) return '';
  const raw = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const meta = resolveCountryMeta(country);
  const code = meta?.code;
  switch (code) {
    case 'PT':
      return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4, 7)}` : raw;
    case 'BR':
      return raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5, 8)}` : raw;
    case 'JP':
      return raw.length > 3 ? `${raw.slice(0, 3)}-${raw.slice(3, 7)}` : raw;
    case 'US':
      return raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5, 9)}` : raw;
    case 'CA':
      return raw.length > 3 ? `${raw.slice(0, 3)} ${raw.slice(3, 6)}` : raw;
    case 'GB':
      return raw.length > 3 ? `${raw.slice(0, raw.length - 3)} ${raw.slice(-3)}` : raw;
    default:
      return raw;
  }
};

export const validatePostalCode = (country: string | null | undefined, postalCode: string) => {
  const trimmed = (postalCode || '').trim().toUpperCase();
  if (!trimmed) return false;
  const meta = resolveCountryMeta(country);
  if (!meta) return trimmed.length >= 3;
  return meta.postalRegex.test(trimmed);
};

export const validatePhone = (value: string, country: string | null | undefined) => {
  const normalized = normalizePhone(value);
  if (!normalized || !normalized.startsWith('+')) return false;
  const digits = normalized.replace(/[^\d]/g, '');
  const meta = resolveCountryMeta(country);
  if (!meta) return digits.length >= 8 && digits.length <= 15;
  return digits.length >= meta.phoneMin && digits.length <= meta.phoneMax;
};

export const getPostalInvalidMessage = (country: string | null | undefined, locale = 'pt-PT') => {
  const meta = resolveCountryMeta(country);
  const isEnglish = locale.toLowerCase().startsWith('en');
  if (meta) {
    return isEnglish
      ? `Invalid postal code. Example: ${meta.postalExample}`
      : `Código postal inválido. Exemplo: ${meta.postalExample}`;
  }
  return isEnglish ? 'Invalid postal code.' : 'Código postal inválido.';
};

export const getPhoneInvalidMessage = (country: string | null | undefined, locale = 'pt-PT') => {
  const meta = resolveCountryMeta(country);
  const isEnglish = locale.toLowerCase().startsWith('en');
  return meta
    ? isEnglish
      ? `Invalid phone number. Example: ${meta.phoneExample}`
      : `Telefone inválido. Exemplo: ${meta.phoneExample}`
    : isEnglish
      ? 'Invalid phone number. Include the country code (+...).'
      : 'Telefone inválido. Inclui o indicativo do país (+...).';
};

export const getPostalInputMode = (country: string | null | undefined) => {
  const code = resolveCountryMeta(country)?.code;
  if (!code) return 'text';
  if (['PT', 'BR', 'ES', 'FR', 'DE', 'US', 'IT', 'JP', 'CN', 'AU'].includes(code)) return 'numeric';
  return 'text';
};
