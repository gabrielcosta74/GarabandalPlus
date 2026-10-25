import { describe, expect, it } from 'vitest';
import { chooseCommunityPush, communityPushCopy, communityPushData } from '../lib/community-push';

const userId = '11111111-1111-4111-8111-111111111111';
const time = new Date('2026-10-22T12:00:00Z');
const activity = (kind: 'like' | 'comment' | 'friend_request', createdAt: string) => ({
  id: '22222222-2222-4222-8222-222222222222',
  recipient_id: userId,
  kind,
  post_id: null,
  intention_id: null,
  gathering_id: null,
  created_at: createdAt,
});

describe('community push selection', () => {
  it('waits twenty minutes before pushing a like', () => {
    expect(chooseCommunityPush([activity('like', '2026-10-22T11:45:00Z')], [], userId, 'Europe/Lisbon', time, 3)).toBeNull();
    expect(chooseCommunityPush([activity('like', '2026-10-22T11:39:00Z')], [], userId, 'Europe/Lisbon', time, 3)?.kind).toBe('like');
  });

  it('prefers a comment and delays it for moderation', () => {
    const rows = [activity('like', '2026-10-22T11:00:00Z'), activity('comment', '2026-10-22T11:54:00Z')];
    expect(chooseCommunityPush(rows, [], userId, 'Europe/Lisbon', time, 3)?.kind).toBe('comment');
    rows[1] = activity('comment', '2026-10-22T11:58:00Z');
    expect(chooseCommunityPush(rows, [], userId, 'Europe/Lisbon', time, 3)?.kind).toBe('like');
  });

  it('keeps quiet hours in the recipient timezone', () => {
    const rows = [activity('friend_request', '2026-10-22T11:00:00Z')];
    expect(chooseCommunityPush(rows, [], userId, 'Asia/Tokyo', time, 3)).not.toBeNull();
    expect(chooseCommunityPush(rows, [], userId, 'America/Sao_Paulo', new Date('2026-10-22T09:00:00Z'), 3)).toBeNull();
  });

  it('deduplicates by kind and day, limits frequency and caps a day', () => {
    const rows = [activity('comment', '2026-10-22T11:00:00Z')];
    const sentAt = '2026-10-22T09:00:00Z';
    expect(chooseCommunityPush(rows, [{ user_id: userId, reference: `${userId}:comment:2026-10-22`, sent_at: sentAt }], userId, 'Europe/Lisbon', time, 3)).toBeNull();
    expect(chooseCommunityPush(rows, [{ user_id: userId, reference: 'other', sent_at: '2026-10-22T11:00:00Z' }], userId, 'Europe/Lisbon', time, 3)).toBeNull();
    expect(chooseCommunityPush(rows, Array.from({ length: 3 }, (_, i) => ({ user_id: userId, reference: `other:${i}`, sent_at: sentAt })), userId, 'Europe/Lisbon', time, 3)).toBeNull();
  });

  it('does not remind about the same unread interaction on the next day', () => {
    const nextDay = new Date('2026-10-23T12:00:00Z');
    const previous = { user_id: userId, reference: `${userId}:comment:2026-10-22`, sent_at: '2026-10-22T09:00:00Z' };
    expect(chooseCommunityPush([activity('comment', '2026-10-22T08:00:00Z')], [previous], userId, 'Europe/Lisbon', nextDay, 3)).toBeNull();
    expect(chooseCommunityPush([activity('comment', '2026-10-22T10:00:00Z')], [previous], userId, 'Europe/Lisbon', nextDay, 3)?.kind).toBe('comment');
  });
});

describe('prayer invitation push', () => {
  const invite = (gatheringId: string, createdAt = '2026-10-22T11:00:00Z') => ({
    ...activity('friend_request', createdAt), kind: 'gathering_invite' as const, gathering_id: gatheringId,
  });
  const g1 = '33333333-3333-4333-8333-333333333333';
  const g2 = '44444444-4444-4444-8444-444444444444';

  it('sends each invitation once, even several on the same day', () => {
    const first = chooseCommunityPush([invite(g1), invite(g2)], [], userId, 'Europe/Lisbon', time, 3);
    expect(first?.reference).toBe(`${userId}:gathering_invite:${g1}`);
    const sent = [{ user_id: userId, reference: first!.reference, sent_at: '2026-10-22T09:00:00Z' }];
    expect(chooseCommunityPush([invite(g1), invite(g2)], sent, userId, 'Europe/Lisbon', time, 3)?.reference)
      .toBe(`${userId}:gathering_invite:${g2}`);
  });

  it('respects the daily cap, the two-hour gap and quiet hours', () => {
    const busy = Array.from({ length: 3 }, (_, i) => ({ user_id: userId, reference: `other:${i}`, sent_at: '2026-10-22T11:50:00Z' }));
    expect(chooseCommunityPush([invite(g1)], busy, userId, 'Europe/Lisbon', time, 3)).toBeNull();
    expect(chooseCommunityPush([invite(g1)], busy.slice(0, 1), userId, 'Europe/Lisbon', time, 3)).toBeNull();
    expect(chooseCommunityPush([invite(g1)], [], userId, 'America/Sao_Paulo', new Date('2026-10-22T09:00:00Z'), 3)).toBeNull();
  });

  it('counts invitations toward the cap for other notifications', () => {
    const invites = [1, 2, 3].map((i) => ({ user_id: userId, reference: `${userId}:gathering_invite:g${i}`, sent_at: '2026-10-22T08:00:00Z' }));
    expect(chooseCommunityPush([activity('comment', '2026-10-22T11:00:00Z')], invites, userId, 'Europe/Lisbon', time, 3)).toBeNull();
  });
});

describe('community push copy', () => {
  it('uses a short title and identifies the commenter without quoting the comment', () => {
    expect(communityPushCopy('comment', false, 'Maria S.', false)).toEqual({
      title: 'Novo comentário', body: 'Maria S. comentou a tua partilha.',
    });
    expect(communityPushCopy('comment', false, 'Maria S.', true)).toEqual({
      title: 'Novos comentários', body: 'Maria S. e mais pessoas comentaram.',
    });
  });

  it('names one person and groups several likes in one notification', () => {
    expect(communityPushCopy('like', false, 'João P.', false)).toEqual({
      title: 'Novo gosto', body: 'João P. gostou da tua partilha.',
    });
    expect(communityPushCopy('like', false, 'João P.', true)).toEqual({
      title: 'Novos gostos', body: 'João P. e mais pessoas gostaram.',
    });
  });

  it('falls back when no safe short name is available', () => {
    expect(communityPushCopy('friend_request', false, '\n', false)).toEqual({
      title: 'Pedido de amizade', body: 'Alguém enviou-te um pedido.',
    });
  });
});

describe('community push destination data', () => {
  it('includes the target and activity for a comment, with a fallback for older apps', () => {
    const choice = {
      kind: 'comment' as const,
      activity: { ...activity('comment', '2026-10-22T11:00:00Z'), intention_id: '33333333-3333-4333-8333-333333333333' },
      reference: 'comment',
    };
    expect(communityPushData(choice, '44444444-4444-4444-8444-444444444444')).toEqual({
      kind: 'community-activity', url: '/community', activityType: 'comment',
      activityId: choice.activity.id, actorId: '44444444-4444-4444-8444-444444444444',
      intentionId: choice.activity.intention_id,
    });
  });
});
