import { describe, expect, it } from 'vitest';
import { chooseCommunityPush } from '../lib/community-push';

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
});
