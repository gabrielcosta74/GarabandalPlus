import { createHmac, timingSafeEqual } from 'node:crypto';

// Svix signs "{id}.{timestamp}.{payload}" with a base64-encoded HMAC secret.
export const verifySvixSignature = (secret: string, id: string, timestamp: string, payload: string, signatureHeader: string) => {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', secretBytes).update(`${id}.${timestamp}.${payload}`).digest('base64');
  return signatureHeader.split(' ').some((part) => {
    const candidate = part.includes(',') ? part.split(',')[1] : part;
    if (!candidate || candidate.length !== expected.length) return false;
    try {
      return timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
    } catch {
      return false;
    }
  });
};
