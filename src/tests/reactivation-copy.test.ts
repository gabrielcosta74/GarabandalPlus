import { describe, expect, it } from 'vitest';
import { reactivationCopy, requestsSince } from '../lib/reactivation-copy';

const now = new Date('2026-11-14T12:00:00Z');
const template = { title: 'Pedidos de oração', body: '{pedidos} pessoas pediram oração desde a sua última visita. Reze por uma.' };

describe('reactivation copy', () => {
  it('fills in the number of prayer requests', () => {
    expect(reactivationCopy(template, false, 12)).toEqual({
      title: 'Pedidos de oração',
      body: '12 pessoas pediram oração desde a sua última visita. Reze por uma.',
    });
  });

  it('drops the number when it would not convince', () => {
    expect(reactivationCopy(template, false, 1).body).toBe('Há pedidos de oração na comunidade. Reze por um.');
    expect(reactivationCopy(template, true, null).title).toBe('Prayer requests');
  });

  it('leaves a template without the token untouched', () => {
    const plain = { title: 'Olá', body: 'Volte quando quiser.' };
    expect(reactivationCopy(plain, false, 40)).toBe(plain);
  });

  it('counts requests by others since the last visit, within the wall window', () => {
    const rows = [
      { user_id: 'me', created_at: '2026-11-10T00:00:00Z' },
      { user_id: 'a', created_at: '2026-11-10T00:00:00Z' },
      { user_id: 'b', created_at: '2026-10-20T00:00:00Z' },
      { user_id: 'c', created_at: '2026-10-01T00:00:00Z' },
    ];
    expect(requestsSince(rows, 'me', '2026-10-15T00:00:00Z', now)).toBe(2);
    // Visita muito antiga: só conta o que o mural ainda mostra (30 dias).
    expect(requestsSince(rows, 'me', '2026-08-01T00:00:00Z', now)).toBe(2);
    expect(requestsSince(rows, 'me', null, now)).toBe(2);
  });
});
