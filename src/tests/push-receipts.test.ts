import { afterEach, describe, expect, it, vi } from 'vitest';
import { processPushReceipts, storePushTickets } from '../lib/push-receipts';
import { senderPhotoFields } from '../lib/push-sender';
import { fakeSupabase } from './fake-supabase';

afterEach(() => { vi.unstubAllGlobals(); });
const now = new Date('2026-11-23T12:00:00Z');
const ticket = (id: string, created_at = '2026-11-23T11:00:00Z') => ({ ticket_id: id, expo_push_token: `ExponentPushToken[${id}]`, type: 'x', status: 'pending', created_at });

describe('expo receipts', () => {
  it('closes delivered tickets, forgets dead tokens and waits for the rest', async () => {
    const tables = {
      push_tickets: [ticket('ok'), ticket('dead'), ticket('bad'), ticket('later'), ticket('new', '2026-11-23T11:55:00Z')] as Record<string, unknown>[],
      member_devices: [{ id: 1, expo_push_token: 'ExponentPushToken[dead]' }, { id: 2, expo_push_token: 'ExponentPushToken[ok]' }] as Record<string, unknown>[],
    };
    const asked: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
      asked.push(...JSON.parse(init.body).ids);
      return { ok: true, json: async () => ({ data: {
        ok: { status: 'ok' },
        dead: { status: 'error', details: { error: 'DeviceNotRegistered' } },
        bad: { status: 'error', details: { error: 'MismatchSenderId' } },
      } }) };
    }));
    const result = await processPushReceipts(fakeSupabase(tables, {}), now);
    expect(asked).toEqual(['ok', 'dead', 'bad', 'later']);
    expect(result).toEqual({ checked: 3, delivered: 1, failed: 2, deadTokens: 1 });
    expect(tables.push_tickets.map((row) => [row.ticket_id, row.status])).toEqual([
      ['ok', 'ok'], ['dead', 'error'], ['bad', 'error'], ['later', 'pending'], ['new', 'pending'],
    ]);
    expect(tables.member_devices.map((row) => row.expo_push_token)).toEqual([null, 'ExponentPushToken[ok]']);
  });

  it('never throws, even without the table or with Expo down', async () => {
    const broken = { from: () => { throw new Error('no table'); } } as never;
    await expect(storePushTickets(broken, 'x', [{ id: '1', token: 't' }])).resolves.toBeUndefined();
    await expect(processPushReceipts(broken, now)).resolves.toMatchObject({ checked: 0 });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('rede'); }));
    await expect(processPushReceipts(fakeSupabase({ push_tickets: [ticket('a')] }, {}), now)).resolves.toMatchObject({ checked: 0 });
  });
});

describe('sender photo', () => {
  it('only uses public https photos', () => {
    expect(senderPhotoFields('ios', { name: 'Rui', avatar: 'http://example.com/a.jpg', body: 'x' })).toEqual({ data: {} });
    expect(senderPhotoFields('android', { name: 'Rui', avatar: null, body: 'x' })).toEqual({ data: {} });
    expect(senderPhotoFields('android', null)).toEqual({ data: {} });
    expect(senderPhotoFields('ios', { name: 'Rui', avatar: 'https://example.com/a.jpg', body: 'x' }))
      .toEqual({ mutableContent: true, data: { senderName: 'Rui', senderAvatar: 'https://example.com/a.jpg', senderBody: 'x' } });
  });
});
