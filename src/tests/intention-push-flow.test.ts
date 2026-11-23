import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyFirstPrayer, processIntentionNotifications } from '../lib/intention-notifications';
import { fakeSupabase } from './fake-supabase';

vi.mock('../lib/email', () => ({ sendIntentionReportsAlert: vi.fn() }));

const author = 'author';
const tokenA = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const morning = new Date('2026-11-23T10:00:00Z'); // 10h em Lisboa
const evening = new Date('2026-11-23T18:30:00Z');

type Sent = { to: string; title: string; body: string; mutableContent?: boolean; richContent?: { image: string }; data: Record<string, unknown> };
let sent: Sent[] = [];

beforeEach(() => {
  sent = [];
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
    const batch = JSON.parse(init.body) as Sent[];
    sent.push(...batch);
    return { ok: true, json: async () => ({ data: batch.map((_m, i) => ({ status: 'ok', id: `t-${sent.length}-${i}` })) }) };
  }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const device = (extra: Record<string, unknown> = {}) => ({
  user_id: author, expo_push_token: tokenA, timezone: 'Europe/Lisbon', locale: 'pt-BR', platform: 'ios',
  intention_push_enabled: true, last_seen_at: '2026-11-22T10:00:00Z', ...extra,
});
const intention = (id: string) => ({ id, user_id: author, is_hidden: false, prayer_count: 1, created_at: '2026-11-20T10:00:00Z' });
const prayer = (intention_id: string, user_id: string, created_at: string) => ({ intention_id, user_id, created_at });

function setup(prayers: ReturnType<typeof prayer>[], options: { devices?: object[]; blocks?: object[]; hidden?: string[]; push?: object[]; ids?: string[] } = {}) {
  const tables = {
    novena_intentions: (options.ids ?? ['i1', 'i2']).map(intention),
    novena_intention_prayers: prayers,
    novena_intention_reports: [],
    member_devices: (options.devices ?? [device()]) as Record<string, unknown>[],
    member_blocks: (options.blocks ?? []) as Record<string, unknown>[],
    push_notifications: (options.push ?? []) as Record<string, unknown>[],
    push_tickets: [] as Record<string, unknown>[],
  };
  const supabase = fakeSupabase(tables, {
    is_discoverable: ({ p_user }) => !(options.hidden ?? []).includes(p_user as string),
    full_person_name: ({ p_user }) => (p_user === 'noname' ? null : `${p_user} Gomes`),
    person_short_name: ({ p_user }) => (p_user === 'noname' ? 'Anagomes123' : `${p_user} Gomes`),
    person_avatar: ({ p_user }) => `https://example.com/${p_user}.jpg`,
  });
  return { supabase, tables };
}
const at = async (now: Date, run: () => Promise<unknown>) => { vi.setSystemTime(now); return run(); };

describe('first prayer push', () => {
  it('shows who prayed, with the photo on iOS', async () => {
    const { supabase, tables } = setup([prayer('i1', 'Ana', '2026-11-23T09:59:00Z')]);
    expect(await at(morning, () => notifyFirstPrayer(supabase, 'i1', morning))).toBe('sent');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      title: 'Ana rezou por você', body: 'Pela intenção que você publicou.', mutableContent: true,
      data: { kind: 'intention-first-prayer', senderName: 'Ana Gomes', senderAvatar: 'https://example.com/Ana.jpg', senderBody: 'Rezou pela sua intenção.' },
    });
    expect(sent[0].richContent).toBeUndefined();
    expect(tables.push_tickets).toHaveLength(1);
  });

  it('sends the photo as the notification image on Android', async () => {
    const { supabase } = setup([prayer('i1', 'Ana', '2026-11-23T09:59:00Z')], { devices: [device({ platform: 'android' })] });
    await at(morning, () => notifyFirstPrayer(supabase, 'i1', morning));
    expect(sent[0].richContent).toEqual({ image: 'https://example.com/Ana.jpg' });
    expect(sent[0].mutableContent).toBeUndefined();
    expect(sent[0].data).not.toHaveProperty('senderName');
  });

  it('never names someone who is hidden, or whose only name is an email', async () => {
    for (const who of ['Oculta', 'noname']) {
      sent = [];
      const { supabase } = setup([prayer('i1', who, '2026-11-23T09:59:00Z')], { hidden: ['Oculta'] });
      await at(morning, () => notifyFirstPrayer(supabase, 'i1', morning));
      expect(sent[0].title).toBe('Alguém rezou por você');
      expect(JSON.stringify(sent[0])).not.toMatch(/Oculta|noname|Anagomes|example\.com/);
    }
  });

  it('ignores people blocked either way', async () => {
    for (const block of [{ blocker_id: author, blocked_id: 'Ana' }, { blocker_id: 'Ana', blocked_id: author }]) {
      const { supabase } = setup([prayer('i1', 'Ana', '2026-11-23T09:59:00Z')], { blocks: [block] });
      expect(await at(morning, () => notifyFirstPrayer(supabase, 'i1', morning))).toBe('no_prayers');
    }
    expect(sent).toHaveLength(0);
  });

  it('sends one push when the same token is on two device rows', async () => {
    const { supabase } = setup([prayer('i1', 'Ana', '2026-11-23T09:59:00Z')], { devices: [device(), device({ last_seen_at: '2026-10-01T00:00:00Z' })] });
    await at(morning, () => notifyFirstPrayer(supabase, 'i1', morning));
    expect(sent).toHaveLength(1);
  });

  it('keeps quiet hours', async () => {
    const night = new Date('2026-11-23T23:00:00Z');
    const { supabase } = setup([prayer('i1', 'Ana', '2026-11-23T22:59:00Z')]);
    expect(await at(night, () => notifyFirstPrayer(supabase, 'i1', night))).toBe('quiet_hours');
  });
});

describe('one first push and one summary per author and day', () => {
  it('puts the second intention and later prayers in a single summary', async () => {
    const { supabase, tables } = setup([
      prayer('i1', 'Ana', '2026-11-23T09:50:00Z'),
      prayer('i2', 'Rui', '2026-11-23T09:51:00Z'),
      prayer('i2', 'Ana', '2026-11-23T09:52:00Z'),
    ]);
    const first = await at(morning, () => processIntentionNotifications(supabase, morning));
    expect(first).toMatchObject({ firstPrayers: 1, dailySummaries: 0, errors: 0 });
    tables.novena_intention_prayers.push(prayer('i1', 'Eva', '2026-11-23T15:00:00Z'));

    const second = await at(evening, () => processIntentionNotifications(supabase, evening));
    expect(second).toMatchObject({ firstPrayers: 0, dailySummaries: 1, errors: 0 });
    // Rui e Ana em i2 (por avisar) e Eva em i1; a oração de Ana em i1 já tinha sido avisada.
    expect(sent.map((message) => message.title)).toEqual(['Ana rezou por você', '3 pessoas rezaram por você']);
    // Várias pessoas: sem foto, para o título continuar a contá-las.
    expect(sent[1].mutableContent).toBeUndefined();

    const later = new Date('2026-11-23T19:30:00Z');
    expect(await at(later, () => processIntentionNotifications(supabase, later))).toMatchObject({ firstPrayers: 0, dailySummaries: 0 });
    const tomorrow = new Date('2026-11-24T18:30:00Z');
    expect(await at(tomorrow, () => processIntentionNotifications(supabase, tomorrow))).toMatchObject({ firstPrayers: 0, dailySummaries: 0 });
    expect(sent).toHaveLength(2);
  });

  it('does not repeat the only prayer it already announced', async () => {
    const { supabase } = setup([prayer('i1', 'Ana', '2026-11-23T09:59:00Z')], { ids: ['i1'] });
    await at(morning, () => processIntentionNotifications(supabase, morning));
    await at(evening, () => processIntentionNotifications(supabase, evening));
    expect(sent).toHaveLength(1);
  });

  it('counts the summaries the old version already sent today', async () => {
    const { supabase } = setup([prayer('i1', 'Ana', '2026-11-23T18:20:00Z')], {
      ids: ['i1'],
      push: [
        { id: 'p0', user_id: author, type: 'intention_first_prayer', reference: 'i1', sent_at: '2026-11-21T10:00:00Z' },
        { id: 'p1', user_id: author, type: 'intention_daily', reference: 'i1:2026-11-23', sent_at: '2026-11-23T18:05:00Z' },
      ],
    });
    await at(evening, () => processIntentionNotifications(supabase, evening));
    expect(sent).toHaveLength(0);
  });
});
