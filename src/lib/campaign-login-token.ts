import { createHmac, timingSafeEqual } from 'node:crypto';

// Assina tokens de auto-login para campanhas de email (links estáveis e não-expiráveis;
// o magic link real do Supabase é gerado na hora, ao clicar). O propósito ("campaign-login")
// entra no HMAC para que um token não possa ser reutilizado noutro contexto (ex.: unsubscribe).
const PURPOSE = 'campaign-login';

const getSecret = () =>
  process.env.CAMPAIGN_LOGIN_SECRET || process.env.CRON_SECRET || 'garabandal-campaign-login';

const base64url = (value: string) => Buffer.from(value, 'utf8').toString('base64url');
const fromBase64url = (value: string) => Buffer.from(value, 'base64url').toString('utf8');

const sign = (email: string) =>
  createHmac('sha256', getSecret())
    .update(`${PURPOSE}:${email.trim().toLowerCase()}`)
    .digest('base64url');

export const createCampaignLoginToken = (email: string) => ({
  e: base64url(email.trim().toLowerCase()),
  t: sign(email),
});

export const decodeCampaignLoginEmail = (e: string): string | null => {
  try {
    const email = fromBase64url(e).trim().toLowerCase();
    return email.includes('@') ? email : null;
  } catch {
    return null;
  }
};

export const verifyCampaignLoginToken = (email: string, token: string): boolean => {
  const expected = sign(email);
  const a = Buffer.from(expected);
  const b = Buffer.from(token || '');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};
