import { createHmac, timingSafeEqual } from 'node:crypto';

// Secret used to sign unsubscribe tokens. Falls back to CRON_SECRET so the
// feature works without extra env config; set UNSUBSCRIBE_SECRET to rotate.
const getSecret = () =>
  process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || 'garabandal-unsubscribe';

const base64url = (value: string) =>
  Buffer.from(value, 'utf8').toString('base64url');

const fromBase64url = (value: string) =>
  Buffer.from(value, 'base64url').toString('utf8');

const sign = (email: string) =>
  createHmac('sha256', getSecret()).update(email.trim().toLowerCase()).digest('base64url');

export const createUnsubscribeToken = (email: string) => ({
  e: base64url(email.trim().toLowerCase()),
  t: sign(email),
});

export const decodeUnsubscribeEmail = (e: string): string | null => {
  try {
    const email = fromBase64url(e).trim().toLowerCase();
    return email.includes('@') ? email : null;
  } catch {
    return null;
  }
};

export const verifyUnsubscribeToken = (email: string, token: string): boolean => {
  const expected = sign(email);
  const a = Buffer.from(expected);
  const b = Buffer.from(token || '');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};
