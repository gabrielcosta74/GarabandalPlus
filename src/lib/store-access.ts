import { createHash, randomBytes } from 'crypto';

const DAYS_IN_MS = 24 * 60 * 60 * 1000;

const toBase64Url = (buffer: Buffer) =>
  buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

export const generateAccessToken = () => toBase64Url(randomBytes(32));

export const hashAccessToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const createOrderAccessToken = async (
  supabaseServer: any,
  input: { orderRef: string; buyerEmail: string; expiresInDays?: number },
) => {
  const token = generateAccessToken();
  const tokenHash = hashAccessToken(token);
  const expiresAt = new Date(Date.now() + (input.expiresInDays ?? 7) * DAYS_IN_MS).toISOString();

  await supabaseServer.from('store_order_access_tokens').insert({
    order_ref: input.orderRef,
    buyer_email: input.buyerEmail,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  return { token, expiresAt };
};

export const createDigitalAccessToken = async (
  supabaseServer: any,
  input: { orderRef: string; productId: string; buyerEmail: string; expiresInDays?: number },
) => {
  const token = generateAccessToken();
  const tokenHash = hashAccessToken(token);
  const expiresAt = new Date(Date.now() + (input.expiresInDays ?? 7) * DAYS_IN_MS).toISOString();

  await supabaseServer.from('store_digital_access_tokens').insert({
    order_ref: input.orderRef,
    product_id: input.productId,
    buyer_email: input.buyerEmail,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  return { token, expiresAt };
};
