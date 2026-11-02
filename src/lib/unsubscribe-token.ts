import { createHmac, timingSafeEqual } from 'node:crypto';

// Segredo que assina os tokens de cancelar subscrição. Definir UNSUBSCRIBE_SECRET: assim
// rodar o CRON_SECRET deixa de invalidar todas as ligações já enviadas por email.
// Para trocar de segredo sem partir ligações antigas, pôr o anterior em
// UNSUBSCRIBE_SECRET_PREVIOUS; o CRON_SECRET (valor antigo por omissão) continua
// aceite só na verificação.
const getSecret = () =>
  process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || 'garabandal-unsubscribe';

const acceptedSecrets = () =>
  Array.from(
    new Set(
      [
        process.env.UNSUBSCRIBE_SECRET,
        process.env.UNSUBSCRIBE_SECRET_PREVIOUS,
        process.env.CRON_SECRET,
        'garabandal-unsubscribe',
      ].filter((value): value is string => Boolean(value)),
    ),
  );

const base64url = (value: string) =>
  Buffer.from(value, 'utf8').toString('base64url');

const fromBase64url = (value: string) =>
  Buffer.from(value, 'base64url').toString('utf8');

const signWith = (secret: string, email: string) =>
  createHmac('sha256', secret).update(email.trim().toLowerCase()).digest('base64url');

const sign = (email: string) => signWith(getSecret(), email);

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
  const b = Buffer.from(token || '');
  return acceptedSecrets().some((secret) => {
    const a = Buffer.from(signWith(secret, email));
    return a.length === b.length && timingSafeEqual(a, b);
  });
};
