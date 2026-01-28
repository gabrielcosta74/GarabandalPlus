const EU_COUNTRIES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
]);

const normalizeCountry = (value?: string | null) => (value || '').trim().toUpperCase();

export const isPhysicalShippingAllowed = (country?: string | null) => {
  const code = normalizeCountry(country);
  if (!code) return false;
  return code === 'BR' || code === 'PT';
};

export const getShippingZone = (country?: string | null) => {
  const code = normalizeCountry(country);
  if (!code) return 'other';
  if (code === 'PT') return 'pt';
  if (code === 'BR') return 'br';
  if (code === 'US') return 'us';
  if (EU_COUNTRIES.has(code)) return 'eu';
  return 'other';
};

export const getShippingOrigin = (country?: string | null) => {
  const zone = getShippingZone(country);
  return zone === 'br' || zone === 'us' ? 'BR' : 'PT';
};

export const getShippingCost = (country?: string | null, hasPhysical = false) => {
  if (!hasPhysical) return 0;
  if (!isPhysicalShippingAllowed(country)) return null;
  const zone = getShippingZone(country);
  if (zone === 'pt' || zone === 'br') return 0;
  // Others are not allowed anymore
  return null;
};

export const getShippingLabel = (country?: string | null) => {
  const zone = getShippingZone(country);
  if (zone === 'pt' || zone === 'br') return 'Grátis';
  return '—';
};
