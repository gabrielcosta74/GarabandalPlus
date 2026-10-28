import type { SupabaseClient } from '@supabase/supabase-js';
import { isExpoPushToken, localHourFor, sendExpoPush, type ExpoPushMessage } from './expo-push';

type CommunityKind = 'comment' | 'friend_request' | 'gathering_invite' | 'gathering_join' | 'friend_accept' | 'like';

type Activity = {
    id: string;
    recipient_id: string;
    kind: CommunityKind;
    post_id: string | null;
    intention_id: string | null;
    gathering_id: string | null;
    created_at: string;
};

type Device = {
    user_id: string;
    expo_push_token: string | null;
    timezone: string | null;
    locale: string | null;
    last_seen_at: string;
};

type SentPush = { user_id: string; reference: string | null; sent_at: string };

type PushChoice = { kind: CommunityKind; activity: Activity; reference: string };

type Sender = { name: string; avatar: string | null };

/** Only public https photos; the iOS extension downloads them before showing the push. */
function safeAvatar(value: string | null | undefined): string | null {
    const url = (value || '').trim();
    return url.startsWith('https://') && url.length <= 1000 ? url : null;
}

export function communityPushData(choice: PushChoice, actorId: string, sender?: Sender) {
    const avatar = safeAvatar(sender?.avatar);
    return {
        kind: 'community-activity',
        // Older app releases understand this safe fallback; newer ones use the IDs below.
        url: '/community',
        activityType: choice.kind,
        activityId: choice.activity.id,
        actorId,
        // The app's iOS notification extension shows this photo in a circle, like Instagram.
        ...(sender && avatar ? { senderName: sender.name, senderAvatar: avatar } : {}),
        ...(choice.activity.post_id ? { postId: choice.activity.post_id } : {}),
        ...(choice.activity.intention_id ? { intentionId: choice.activity.intention_id } : {}),
        ...(choice.activity.gathering_id ? { gatheringId: choice.activity.gathering_id } : {}),
    };
}

export type CommunityPushResult = {
    enabled: boolean;
    candidates: number;
    eligible: number;
    sent: number;
    acceptedDevices: number;
    failed: number;
    dryRun: boolean;
    testTicketIds: string[];
};

const TYPE = 'community_social';
const CHANNEL = 'avisos';
const LOOKBACK_MS = 36 * 60 * 60 * 1000;
const MIN_GAP_MS = 2 * 60 * 60 * 1000;
// Invitations are chosen separately (see chooseInvite).
const PRIORITY: CommunityKind[] = [
    'comment', 'friend_request', 'friend_accept', 'gathering_join', 'like',
];
const DELAY_MS: Record<CommunityKind, number> = {
    comment: 5 * 60 * 1000, // Leave time for moderation or deletion.
    friend_request: 0,
    gathering_invite: 0,
    gathering_join: 10 * 60 * 1000, // Several people often join together after an invite.
    friend_accept: 0,
    like: 20 * 60 * 1000, // Collect likes rather than interrupting on each one.
};

function localDay(timezone: string, now: Date): string | null {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(now);
        const part = (type: string) => parts.find((item) => item.type === type)?.value;
        const year = part('year');
        const month = part('month');
        const day = part('day');
        return year && month && day ? `${year}-${month}-${day}` : null;
    } catch {
        return null;
    }
}

function shortActorName(value: string | null, english: boolean): string {
    const cleaned = (value || '')
        .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
        .replace(/\s+/g, ' ').trim();
    if (!cleaned) return english ? 'Someone' : 'Alguém';
    const points = Array.from(cleaned);
    if (points.length <= 24) return cleaned;
    const first = cleaned.split(' ')[0];
    return Array.from(first).length <= 24 ? first : (english ? 'Someone' : 'Alguém');
}

export function communityPushCopy(kind: CommunityKind, english: boolean, actorName: string | null, grouped: boolean) {
    const name = shortActorName(actorName, english);
    // The members app speaks Brazilian Portuguese ("você").
    const pt = {
        comment: { title: grouped ? 'Novos comentários' : 'Novo comentário',
            body: grouped ? `${name} e mais pessoas comentaram.` : `${name} comentou sua publicação.` },
        friend_request: { title: 'Pedido de amizade', body: `${name} enviou um pedido de amizade para você.` },
        gathering_invite: { title: 'Convite para rezar', body: `${name} convidou você para rezar.` },
        gathering_join: { title: 'Vão rezar com você',
            body: grouped ? `${name} e mais pessoas entraram no seu grupo de oração.` : `${name} entrou no seu grupo de oração.` },
        friend_accept: { title: 'Pedido aceito', body: `${name} aceitou seu pedido de amizade.` },
        like: { title: grouped ? 'Novas curtidas' : 'Nova curtida',
            body: grouped ? `${name} e mais pessoas curtiram.` : `${name} curtiu sua publicação.` },
    };
    const en = {
        comment: { title: grouped ? 'New comments' : 'New comment',
            body: grouped ? `${name} and others commented.` : `${name} commented on your post.` },
        friend_request: { title: 'Friend request', body: `${name} wants to be friends.` },
        gathering_invite: { title: 'Prayer invitation', body: `${name} invited you to pray.` },
        gathering_join: { title: 'Praying with you',
            body: grouped ? `${name} and others joined your prayer group.` : `${name} joined your prayer group.` },
        friend_accept: { title: 'Request accepted', body: `${name} accepted your request.` },
        like: { title: grouped ? 'New likes' : 'New like',
            body: grouped ? `${name} and others liked your posts.` : `${name} liked your post.` },
    };
    return (english ? en : pt)[kind];
}

const inviteReference = (userId: string, gatheringId: string) => `${userId}:gathering_invite:${gatheringId}`;

/**
 * A prayer invitation is addressed to one person and has a time attached, so
 * each one gets its own push (once per gathering). The daily cap, two-hour gap,
 * and quiet hours still apply.
 */
function chooseInvite(activities: Activity[], sent: SentPush[], userId: string): PushChoice | null {
    for (const activity of activities) {
        if (activity.kind !== 'gathering_invite' || !activity.gathering_id) continue;
        const reference = inviteReference(userId, activity.gathering_id);
        if (sent.some((item) => item.user_id === userId && item.reference === reference)) continue;
        return { kind: 'gathering_invite', activity, reference };
    }
    return null;
}

/**
 * Invitations first (one push each), without the two-hour gap: an invitation
 * often points to a session later the same day. Everything else: one push per
 * kind and local day, with the gap. All pushes share the daily cap.
 */
export function chooseCommunityPush(
    activities: Activity[], sent: SentPush[], userId: string, timezone: string,
    now: Date, dailyCap: number,
): PushChoice | null {
    const hour = localHourFor(timezone, now);
    const day = localDay(timezone, now);
    if (hour === null || hour < 8 || hour >= 22 || !day) return null;

    const recent = sent.filter((item) => item.user_id === userId &&
        now.getTime() - new Date(item.sent_at).getTime() < 24 * 60 * 60 * 1000);
    if (recent.length >= dailyCap) return null;

    const invite = chooseInvite(activities, sent, userId);
    if (invite) return invite;
    if (recent.some((item) => now.getTime() - new Date(item.sent_at).getTime() < MIN_GAP_MS)) return null;

    for (const kind of PRIORITY) {
        const reference = `${userId}:${kind}:${day}`;
        if (sent.some((item) => item.user_id === userId && item.reference === reference)) continue;
        const lastKindPush = sent
            .filter((item) => item.user_id === userId && item.reference?.startsWith(`${userId}:${kind}:`))
            .reduce((latest, item) => Math.max(latest, new Date(item.sent_at).getTime()), 0);
        const activity = activities.find((item) => item.kind === kind &&
            new Date(item.created_at).getTime() > lastKindPush &&
            now.getTime() - new Date(item.created_at).getTime() >= DELAY_MS[kind]);
        if (activity) return { kind, activity, reference };
    }
    return null;
}

/** Railway invokes this from the existing push cron; it never reads message text. */
export async function processCommunityPush(
    supabase: SupabaseClient, now: Date = new Date(), dryRun = false,
): Promise<CommunityPushResult> {
    const result: CommunityPushResult = {
        enabled: false, candidates: 0, eligible: 0, sent: 0,
        acceptedDevices: 0, failed: 0, dryRun,
        testTicketIds: [],
    };

    const { data: config, error: configError } = await supabase
        .from('community_push_config')
        .select('enabled, daily_cap, test_user_id')
        .eq('id', true)
        .single();
    if (configError) throw new Error(`Community push config: ${configError.message}`);
    if (!config?.enabled) return result;
    result.enabled = true;

    const since = new Date(now.getTime() - LOOKBACK_MS).toISOString();
    const { data: candidates, error: candidatesError } = await supabase
        .rpc('list_community_push_candidates', { p_since: since, p_limit: 500 });
    if (candidatesError) throw new Error(`Community push candidates: ${candidatesError.message}`);
    const activities = (candidates || []) as Activity[];
    result.candidates = activities.length;
    if (activities.length === 0) return result;

    const userIds = [...new Set(activities.map((item) => item.recipient_id))];
    const [{ data: deviceData, error: deviceError }, { data: sentData, error: sentError }] = await Promise.all([
        supabase.from('member_devices')
            .select('user_id, expo_push_token, timezone, locale, last_seen_at')
            .in('user_id', userIds)
            .eq('push_enabled', true)
            .eq('community_push_enabled', true)
            .not('expo_push_token', 'is', null),
        supabase.from('push_notifications')
            .select('user_id, reference, sent_at')
            .eq('type', TYPE)
            .in('user_id', userIds)
            .not('sent_at', 'is', null)
            .gte('sent_at', new Date(now.getTime() - LOOKBACK_MS).toISOString()),
    ]);
    if (deviceError) throw new Error(`Community push devices: ${deviceError.message}`);
    if (sentError) throw new Error(`Community push history: ${sentError.message}`);

    const devices = (deviceData || []) as Device[];
    const history = (sentData || []) as SentPush[];
    for (const userId of userIds) {
        const userDevices = devices.filter((item) => item.user_id === userId)
            .sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime());
        const timezone = userDevices[0]?.timezone;
        if (!timezone) continue;
        const tokens = [...new Set(userDevices.map((item) => item.expo_push_token)
            .filter((token): token is string => isExpoPushToken(token)))];
        if (tokens.length === 0) continue;

        const choice = chooseCommunityPush(
            activities.filter((item) => item.recipient_id === userId),
            history, userId, timezone, now, Number(config.daily_cap) || 3,
        );
        if (!choice) continue;
        result.eligible++;
        if (dryRun) continue;

        const { data: recordId, error: claimError } = await supabase
            .rpc('claim_community_push', { p_user: userId, p_reference: choice.reference });
        if (claimError) throw new Error(`Community push claim: ${claimError.message}`);
        if (!recordId) continue; // Already sent or leased by another run.

        // A comment may be hidden, a friendship cancelled, or a person blocked
        // between the initial scan and the actual send.
        const { data: stillVisible, error: visibleError } = await supabase
            .rpc('community_push_event_visible', { p_event: choice.activity.id, p_user: userId });
        if (visibleError) throw new Error(`Community push visibility: ${visibleError.message}`);
        if (!stillVisible) continue;

        const { data: actor, error: actorError } = await supabase
            .from('community_activity')
            .select('actor_id')
            .eq('id', choice.activity.id)
            .eq('recipient_id', userId)
            .maybeSingle();
        if (actorError) throw new Error(`Community push actor: ${actorError.message}`);
        if (!actor) continue;
        const [{ data: actorName, error: nameError }, { data: actorAvatar, error: avatarError }] = await Promise.all([
            supabase.rpc('person_short_name', { p_user: actor.actor_id }),
            supabase.rpc('person_avatar', { p_user: actor.actor_id }),
        ]);
        if (nameError) throw new Error(`Community push actor name: ${nameError.message}`);
        // A missing photo only costs the circle, never the push.
        const avatar = avatarError ? null : safeAvatar(actorAvatar as string | null);

        const grouped = (choice.kind === 'like' || choice.kind === 'comment' || choice.kind === 'gathering_join') && activities.some((item) =>
            item.recipient_id === userId && item.kind === choice.kind && item.id !== choice.activity.id &&
            new Date(item.created_at).getTime() >= new Date(choice.activity.created_at).getTime() &&
            now.getTime() - new Date(item.created_at).getTime() >= DELAY_MS[choice.kind]);
        const english = (userDevices[0].locale || '').toLowerCase().startsWith('en');
        const message = communityPushCopy(choice.kind, english, actorName, grouped);
        const sender = { name: shortActorName(actorName, english), avatar };
        const messages: ExpoPushMessage[] = tokens.map((token) => ({
            to: token, title: message.title, body: message.body,
            channelId: CHANNEL, sound: 'default',
            ...(avatar ? { mutableContent: true } : {}),
            data: communityPushData(choice, actor.actor_id, sender),
        }));
        const outcome = await sendExpoPush(messages);
        if (config.test_user_id === userId) {
            result.testTicketIds.push(...outcome.ticketIds);
        }
        if (outcome.invalidTokens.length > 0) {
            await supabase.from('member_devices').delete()
                .in('expo_push_token', outcome.invalidTokens);
        }
        if (outcome.delivered === 0) {
            result.failed++;
            continue;
        }
        const { error: updateError } = await supabase.from('push_notifications')
            .update({ sent_at: new Date().toISOString(), delivered_count: outcome.delivered })
            .eq('id', recordId);
        if (updateError) throw new Error(`Community push record: ${updateError.message}`);
        result.sent++;
        result.acceptedDevices += outcome.delivered;
    }
    return result;
}
