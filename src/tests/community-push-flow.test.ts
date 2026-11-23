import { afterEach, describe, expect, it, vi } from 'vitest';
import { processCommunityPush } from '../lib/community-push';
import { fakeSupabase } from './fake-supabase';

afterEach(() => { vi.unstubAllGlobals(); });

const now = new Date('2026-11-23T12:00:00Z');
const activity = (id: string, actor_id: string, kind = 'like') => ({
  id, recipient_id: 'me', actor_id, kind, post_id: null, intention_id: 'i1', gathering_id: null, created_at: '2026-11-23T11:00:00Z',
});

async function run(rows: ReturnType<typeof activity>[], platforms: [string, string][]) {
  const sent: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
    const batch = JSON.parse(init.body) as Record<string, unknown>[];
    sent.push(...batch);
    return { ok: true, json: async () => ({ data: batch.map((_m, i) => ({ status: 'ok', id: `t${i}` })) }) };
  }));
  const tables = {
    community_push_config: [{ id: true, enabled: true, daily_cap: 3, test_user_id: null }],
    community_activity: rows,
    member_devices: platforms.map(([token, platform], i) => ({
      user_id: 'me', expo_push_token: `ExponentPushToken[${token}]`, timezone: 'Europe/Lisbon', locale: 'pt-BR', platform,
      push_enabled: true, community_push_enabled: true, last_seen_at: `2026-11-2${i}T10:00:00Z`,
    })),
    push_notifications: [{ id: 'r1', user_id: 'me', type: 'community_social', reference: 'x', sent_at: null }] as Record<string, unknown>[],
    push_tickets: [] as Record<string, unknown>[],
  };
  const result = await processCommunityPush(fakeSupabase(tables, {
    list_community_push_candidates: () => rows,
    claim_community_push: () => 'r1',
    community_push_event_visible: () => true,
    full_person_name: ({ p_user }) => (p_user === 'noname' ? null : 'Ana Gomes'),
    person_short_name: () => 'Ana Gomes',
    person_avatar: () => 'https://example.com/a.jpg',
  }), now);
  return { result, sent, tables };
}

describe('community push sending', () => {
  it('puts the photo where each platform can show it, once per token', async () => {
    const { result, sent, tables } = await run([activity('a1', 'ana')], [['a', 'android'], ['b', 'ios'], ['b', 'ios']]);
    expect(result).toMatchObject({ sent: 1, acceptedDevices: 2 });
    const android = sent.find((m) => m.to === 'ExponentPushToken[a]')!;
    const ios = sent.find((m) => m.to === 'ExponentPushToken[b]')!;
    expect(sent).toHaveLength(2);
    expect(android).toMatchObject({ title: 'Nova curtida', body: 'Ana Gomes curtiu sua publicação.', richContent: { image: 'https://example.com/a.jpg' } });
    expect(ios).toMatchObject({ mutableContent: true, data: { activityType: 'like', senderName: 'Ana Gomes', senderBody: 'Curtiu sua publicação.' } });
    expect(tables.push_tickets).toHaveLength(2);
  });

  it('groups only when someone else is there', async () => {
    expect((await run([activity('a1', 'ana'), activity('a2', 'ana')], [['a', 'android']])).sent[0].title).toBe('Nova curtida');
    expect((await run([activity('a1', 'ana'), activity('a2', 'rui')], [['a', 'android']])).sent[0].body).toBe('Ana Gomes e mais pessoas curtiram.');
  });

  it('does not show a name taken from an email', async () => {
    expect((await run([activity('a1', 'noname')], [['a', 'android']])).sent[0].body).toBe('Alguém curtiu sua publicação.');
  });
});
