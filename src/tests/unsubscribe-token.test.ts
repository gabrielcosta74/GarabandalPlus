import { afterEach, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { createUnsubscribeToken, verifyUnsubscribeToken } from '../lib/unsubscribe-token';

const legacyToken = (secret: string, email: string) =>
  createHmac('sha256', secret).update(email).digest('base64url');

afterEach(() => {
  delete process.env.UNSUBSCRIBE_SECRET;
  delete process.env.UNSUBSCRIBE_SECRET_PREVIOUS;
  process.env.CRON_SECRET = 'cron-original';
});

describe('unsubscribe tokens', () => {
  it('keeps links signed with the old CRON_SECRET working after a dedicated secret is set', () => {
    process.env.CRON_SECRET = 'cron-original';
    const oldLink = createUnsubscribeToken('ana@gmail.com'); // assinado com o CRON_SECRET
    process.env.UNSUBSCRIBE_SECRET = 'novo-segredo-proprio';
    expect(verifyUnsubscribeToken('ana@gmail.com', oldLink.t)).toBe(true);
    // novos links usam o segredo próprio
    const newLink = createUnsubscribeToken('ana@gmail.com');
    expect(newLink.t).not.toBe(oldLink.t);
    expect(verifyUnsubscribeToken('ana@gmail.com', newLink.t)).toBe(true);
  });

  it('survives rotating the CRON_SECRET once UNSUBSCRIBE_SECRET is set', () => {
    process.env.UNSUBSCRIBE_SECRET = 'segredo-estavel';
    const link = createUnsubscribeToken('ana@gmail.com');
    process.env.CRON_SECRET = 'cron-rodado';
    expect(verifyUnsubscribeToken('ana@gmail.com', link.t)).toBe(true);
  });

  it('accepts the previous secret during a rotation and rejects unknown ones', () => {
    process.env.UNSUBSCRIBE_SECRET = 'segredo-novo';
    process.env.UNSUBSCRIBE_SECRET_PREVIOUS = 'segredo-antigo';
    expect(verifyUnsubscribeToken('ana@gmail.com', legacyToken('segredo-antigo', 'ana@gmail.com'))).toBe(true);
    expect(verifyUnsubscribeToken('ana@gmail.com', legacyToken('outro', 'ana@gmail.com'))).toBe(false);
    expect(verifyUnsubscribeToken('outra@gmail.com', legacyToken('segredo-antigo', 'ana@gmail.com'))).toBe(false);
  });
});
