/**
 * Avisos do mural de intencoes da app.
 *
 * Tres coisas, todas pequenas e todas idempotentes:
 *
 *  1. PRIMEIRA ORACAO. Quando o primeiro membro reza por uma intencao, o autor
 *     recebe logo um aviso. A app chama `/api/app/intentions/prayed` no toque;
 *     se esse pedido se perder, ou se for de noite no fuso do autor, o cron
 *     horario apanha-o mais tarde.
 *
 *     No maximo um por autor e por dia: se outra intencao dele receber a
 *     primeira oracao no mesmo dia, entra no resumo.
 *
 *  2. RESUMO DIARIO. No maximo um por AUTOR por dia, com todas as intencoes
 *     juntas, ao fim da tarde no fuso dele, e so se alguem rezou desde o ultimo
 *     aviso. Nunca um push por cada oracao: isso seria ruido, nao comunidade.
 *
 *  Quem bloqueou ou foi bloqueado pelo autor nunca conta; quem escolheu nao ser
 *  encontrado conta, mas sem nome nem foto, tal como no mural.
 *
 *  3. ALERTA DE DENUNCIAS. A App Store (Guideline 1.2) espera que as denuncias
 *     sejam vistas depressa. Cada denuncia nova gera um email para a equipa,
 *     agrupado por corrida do cron.
 *
 * A idempotencia vem da chave unica (type, reference) de `push_notifications`
 * e `email_notifications`: uma corrida repetida depois de uma falha nao reenvia
 * o que ja saiu.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { localHourFor, sendExpoPush, type ExpoPushMessage } from './expo-push';
import { storePushTickets } from './push-receipts';
import { loadPushSender, senderPhotoFields } from './push-sender';
import { sendIntentionReportsAlert } from './email';

const CHANNEL = 'avisos';
const FIRST_TYPE = 'intention_first_prayer';
const DAILY_TYPE = 'intention_daily';
const REPORT_EMAIL_TYPE = 'intention_report_alert';

/** As intencoes saem do mural publico ao fim de 30 dias; os avisos tambem. */
const WALL_DAYS = 30;
/** Nunca entre as 22h e as 8h no fuso do autor. */
const QUIET_FROM = 22;
const QUIET_UNTIL = 8;
/** O resumo sai ao fim da tarde: entre as 18h e as 21h locais. */
const SUMMARY_FROM = 18;
const SUMMARY_UNTIL = 21;
/** Sem fuso conhecido, assume-se Portugal, onde esta a maior parte dos membros. */
const FALLBACK_TIMEZONE = 'Europe/Lisbon';

type Device = {
    user_id: string;
    expo_push_token: string | null;
    timezone: string | null;
    locale: string | null;
    platform: string | null;
    last_seen_at: string | null;
};

type IntentionRow = {
    id: string;
    user_id: string;
    is_hidden: boolean;
    created_at: string;
};

type Prayer = { intention_id: string; user_id: string; created_at: string };

type PrayerSender = { id: string; name: string; avatar: string | null };

export type FirstPrayerOutcome =
    | 'sent'
    | 'already_sent'
    /** Ja houve hoje uma primeira oracao para este autor: esta entra no resumo. */
    | 'in_summary'
    | 'no_prayers'
    | 'hidden'
    | 'no_devices'
    | 'quiet_hours'
    | 'not_delivered'
    | 'not_found';

const isEnglish = (locale: string | null) => (locale || '').toLowerCase().startsWith('en');

/** Só o primeiro nome, para o título caber; sem nome usável, "Alguém". */
export function firstName(value: string | null | undefined): string | null {
    const cleaned = (value || '')
        .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
        .replace(/\s+/g, ' ').trim();
    const first = cleaned.split(' ')[0] || '';
    return first && Array.from(first).length <= 14 ? first : null;
}

/**
 * Título curto com quem rezou (a app já mostra esse nome no cartão do pedido);
 * o corpo nunca cita o texto da intenção, que ficaria no ecrã bloqueado.
 * A app fala português do Brasil ("você").
 */
export function firstCopy(locale: string | null, prayerName: string | null = null) {
    const name = firstName(prayerName);
    return isEnglish(locale)
        ? { title: name ? `${name} prayed for you` : 'Someone prayed for you', body: 'For the intention you shared.' }
        : { title: name ? `${name} rezou por você` : 'Alguém rezou por você', body: 'Pela intenção que você publicou.' };
}

/**
 * Uma pessoa so: diz quem foi (se o nome puder aparecer). Varias: diz quantas.
 * Sem "hoje": quem reza depois do resumo so entra no do dia seguinte.
 */
export function dailyCopy(locale: string | null, count: number, prayerName: string | null = null) {
    const name = count === 1 ? firstName(prayerName) : null;
    if (isEnglish(locale)) {
        return {
            title: name ? `${name} prayed for you` : count === 1 ? '1 person prayed for you' : `${count} people prayed for you`,
            body: name ? 'For your intention.' : 'For your intention. See who.',
        };
    }
    return {
        title: name ? `${name} rezou por você` : count === 1 ? '1 pessoa rezou por você' : `${count} pessoas rezaram por você`,
        body: name ? 'Pela sua intenção.' : 'Pela sua intenção. Veja quem foi.',
    };
}

/** No iOS o titulo passa a ser o nome de quem rezou; o corpo diz o resto. */
export function prayerSenderBody(locale: string | null) {
    return isEnglish(locale) ? 'Prayed for your intention.' : 'Rezou pela sua intenção.';
}

/** O aparelho visto mais recentemente manda no fuso e na lingua. */
function primaryDevice(devices: Device[]) {
    return [...devices].sort((a, b) => (b.last_seen_at || '').localeCompare(a.last_seen_at || ''))[0];
}

function localHour(device: Device | undefined, now: Date) {
    return localHourFor(device?.timezone || FALLBACK_TIMEZONE, now) ?? localHourFor(FALLBACK_TIMEZONE, now) ?? 12;
}

function isQuiet(hour: number) {
    return hour >= QUIET_FROM || hour < QUIET_UNTIL;
}

export function localDate(device: Pick<Device, 'timezone'> | undefined, now: Date) {
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: device?.timezone || FALLBACK_TIMEZONE }).format(now);
    } catch {
        return now.toISOString().slice(0, 10);
    }
}

async function devicesFor(supabase: SupabaseClient, userId: string): Promise<Device[]> {
    const { data } = await supabase
        .from('member_devices')
        .select('user_id, expo_push_token, timezone, locale, platform, last_seen_at')
        .eq('user_id', userId)
        .eq('intention_push_enabled', true)
        .not('expo_push_token', 'is', null);
    return (data || []) as Device[];
}

/**
 * Reserva o envio (type, reference). Devolve o id do registo, ou null se ja
 * saiu antes. Um registo sem `sent_at` e de uma tentativa falhada: reaproveita-se.
 */
async function claim(supabase: SupabaseClient, type: string, reference: string, userId: string) {
    const { data: existing } = await supabase
        .from('push_notifications')
        .select('id, sent_at')
        .eq('type', type)
        .eq('reference', reference)
        .limit(1)
        .maybeSingle();
    if (existing?.sent_at) return null;
    if (existing?.id) return existing.id as string;

    const { data: inserted, error } = await supabase
        .from('push_notifications')
        .insert({ user_id: userId, type, reference, sent_at: null })
        .select('id')
        .maybeSingle();
    if (error) return null; // Outra corrida reservou-o primeiro.
    return (inserted as { id?: string } | null)?.id ?? null;
}

async function deliver(
    supabase: SupabaseClient,
    recordId: string,
    devices: Device[],
    copy: { title: string; body: string },
    kind: 'intention-first-prayer' | 'intention-daily',
    type: string,
    sender: PrayerSender | null,
) {
    // Um iPhone reinstalado pode ter duas linhas com o mesmo token: um aviso so.
    const byToken = new Map<string, Device>();
    for (const device of devices) {
        const token = device.expo_push_token;
        const known = token ? byToken.get(token) : undefined;
        if (token && (!known || (device.last_seen_at || '') > (known.last_seen_at || ''))) byToken.set(token, device);
    }
    const messages: ExpoPushMessage[] = [...byToken].map(([token, device]) => {
        const photo = senderPhotoFields(device.platform, sender && {
            name: sender.name,
            avatar: sender.avatar,
            body: prayerSenderBody(primaryDevice(devices)?.locale ?? null),
        });
        return {
            ...photo,
            to: token,
            title: copy.title,
            body: copy.body,
            channelId: CHANNEL,
            sound: 'default',
            data: {
                kind,
                url: '/pray/intentions/mine',
                ...photo.data,
                ...(sender && photo.data.senderName ? { actorId: sender.id } : {}),
            },
        };
    });

    const outcome = await sendExpoPush(messages);
    await storePushTickets(supabase, type, outcome.tickets);

    if (outcome.invalidTokens.length > 0) {
        await supabase.from('member_devices').delete().in('expo_push_token', outcome.invalidTokens);
    }
    if (outcome.delivered > 0) {
        await supabase
            .from('push_notifications')
            .update({ sent_at: new Date().toISOString(), delivered_count: outcome.delivered })
            .eq('id', recordId);
    }
    return outcome.delivered;
}

async function loadIntention(supabase: SupabaseClient, intentionId: string) {
    const { data } = await supabase
        .from('novena_intentions')
        .select('id, user_id, is_hidden, created_at')
        .eq('id', intentionId)
        .maybeSingle();
    return (data as IntentionRow | null) ?? null;
}

/** Pessoas com quem o autor tem um bloqueio, num sentido ou no outro. */
async function blockedWith(supabase: SupabaseClient, authorId: string): Promise<Set<string>> {
    const { data, error } = await supabase
        .from('member_blocks')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${authorId},blocked_id.eq.${authorId}`);
    // Sem saber quem esta bloqueado nao se envia nada: o cron tenta outra vez.
    if (error) throw new Error(`Intention blocks: ${error.message}`);
    return new Set(((data || []) as { blocker_id: string; blocked_id: string }[])
        .map((row) => (row.blocker_id === authorId ? row.blocked_id : row.blocker_id)));
}

/** Orações de outras pessoas (a do próprio autor e as de bloqueados não contam), da mais recente para a mais antiga. */
async function prayersByOthers(
    supabase: SupabaseClient, authorId: string, intentionIds: string[], blocked: Set<string>,
): Promise<Prayer[]> {
    if (intentionIds.length === 0) return [];
    const { data, error } = await supabase
        .from('novena_intention_prayers')
        .select('intention_id, user_id, created_at')
        .in('intention_id', intentionIds)
        .neq('user_id', authorId)
        .order('created_at', { ascending: false })
        .limit(1000);
    if (error) throw new Error(`Intention prayers: ${error.message}`);
    return ((data || []) as Prayer[]).filter((prayer) => !blocked.has(prayer.user_id));
}

/** Nome e foto de quem rezou, só se essa pessoa aceita ser encontrada (a mesma regra do mural). */
async function visibleSender(supabase: SupabaseClient, userId: string): Promise<PrayerSender | null> {
    try {
        const { data: discoverable, error } = await supabase.rpc('is_discoverable', { p_user: userId });
        if (error || discoverable !== true) return null;
        const sender = await loadPushSender(supabase, userId);
        return sender.name && firstName(sender.name) ? { id: userId, name: sender.name, avatar: sender.avatar } : null;
    } catch {
        return null; // Sem nome sai "Alguém rezou por você".
    }
}

async function lastSentAt(supabase: SupabaseClient, userId: string, type: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('push_notifications')
        .select('sent_at')
        .eq('user_id', userId)
        .eq('type', type)
        .not('sent_at', 'is', null)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw new Error(`Intention history: ${error.message}`);
    return (data as { sent_at?: string } | null)?.sent_at ?? null;
}

const after = (value: string, limit: string | null | undefined) =>
    !limit || new Date(value).getTime() > new Date(limit).getTime();

export async function notifyFirstPrayer(
    supabase: SupabaseClient,
    intentionId: string,
    now: Date = new Date(),
): Promise<FirstPrayerOutcome> {
    const intention = await loadIntention(supabase, intentionId);
    if (!intention) return 'not_found';
    if (intention.is_hidden) return 'hidden';
    const authorId = intention.user_id;

    const prayers = await prayersByOthers(supabase, authorId, [intention.id], await blockedWith(supabase, authorId));
    // O que o último resumo já contou não volta a ser novidade.
    const summaryAt = await lastSentAt(supabase, authorId, DAILY_TYPE);
    const latest = prayers.find((prayer) => after(prayer.created_at, summaryAt));
    if (!latest) return 'no_prayers';

    const devices = await devicesFor(supabase, authorId);
    if (devices.length === 0) return 'no_devices';
    const device = primaryDevice(devices);
    if (isQuiet(localHour(device, now))) return 'quiet_hours';

    const firstAt = await lastSentAt(supabase, authorId, FIRST_TYPE);
    if (firstAt && localDate(device, new Date(firstAt)) === localDate(device, now)) {
        // Ou é esta mesma intenção, já avisada, ou fica para o resumo.
        return 'in_summary';
    }

    const recordId = await claim(supabase, FIRST_TYPE, intention.id, authorId);
    if (!recordId) return 'already_sent';

    const sender = await visibleSender(supabase, latest.user_id);
    const delivered = await deliver(
        supabase,
        recordId,
        devices,
        firstCopy(device?.locale ?? null, sender?.name ?? null),
        'intention-first-prayer',
        FIRST_TYPE,
        sender,
    );
    return delivered > 0 ? 'sent' : 'not_delivered';
}

/**
 * O que o resumo do dia conta: orações em qualquer intenção do autor depois do
 * último resumo, menos as que o aviso da primeira oração dessa intenção já disse.
 */
export function summaryPrayers(prayers: Prayer[], summaryAt: string | null, firstAtByIntention: Map<string, string>): Prayer[] {
    return prayers.filter((prayer) =>
        after(prayer.created_at, summaryAt) && after(prayer.created_at, firstAtByIntention.get(prayer.intention_id)));
}

async function notifyDailySummary(
    supabase: SupabaseClient, authorId: string, intentionIds: string[], now: Date,
): Promise<boolean> {
    const devices = await devicesFor(supabase, authorId);
    if (devices.length === 0) return false;
    const device = primaryDevice(devices);
    const hour = localHour(device, now);
    if (hour < SUMMARY_FROM || hour > SUMMARY_UNTIL) return false;

    const summaryAt = await lastSentAt(supabase, authorId, DAILY_TYPE);
    if (summaryAt && localDate(device, new Date(summaryAt)) === localDate(device, now)) return false;

    const { data: firstRows, error } = await supabase
        .from('push_notifications')
        .select('reference, sent_at')
        .eq('type', FIRST_TYPE)
        .in('reference', intentionIds)
        .not('sent_at', 'is', null);
    if (error) throw new Error(`Intention history: ${error.message}`);
    const firstAt = new Map(((firstRows || []) as { reference: string; sent_at: string }[])
        .map((row) => [row.reference, row.sent_at]));

    const prayers = summaryPrayers(
        await prayersByOthers(supabase, authorId, intentionIds, await blockedWith(supabase, authorId)),
        summaryAt,
        firstAt,
    );
    const people = [...new Set(prayers.map((prayer) => prayer.user_id))];
    if (people.length === 0) return false;

    const recordId = await claim(supabase, DAILY_TYPE, `${authorId}:${localDate(device, now)}`, authorId);
    if (!recordId) return false;

    // Com várias pessoas o título conta-as; a foto de uma só trocava-o pelo nome dela.
    const sender = people.length === 1 ? await visibleSender(supabase, people[0]) : null;
    const delivered = await deliver(
        supabase,
        recordId,
        devices,
        dailyCopy(device?.locale ?? null, people.length, sender?.name ?? null),
        'intention-daily',
        DAILY_TYPE,
        sender,
    );
    return delivered > 0;
}

async function processReportAlerts(supabase: SupabaseClient) {
    const { data: reports } = await supabase
        .from('novena_intention_reports')
        .select('id, intention_id, reporter_id, reason, created_at')
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(100);
    const open = (reports || []) as { id: string; intention_id: string; reporter_id: string; reason: string }[];
    if (open.length === 0) return 0;

    const { data: alerted } = await supabase
        .from('email_notifications')
        .select('reference')
        .eq('type', REPORT_EMAIL_TYPE)
        .in('reference', open.map((report) => report.id));
    const done = new Set(((alerted || []) as { reference: string }[]).map((row) => row.reference));
    const fresh = open.filter((report) => !done.has(report.id));
    if (fresh.length === 0) return 0;

    const { data: intentions } = await supabase
        .from('novena_intentions')
        .select('id, intention, is_hidden')
        .in('id', [...new Set(fresh.map((report) => report.intention_id))]);
    const byId = new Map(((intentions || []) as { id: string; intention: string; is_hidden: boolean }[])
        .map((row) => [row.id, row]));

    const grouped = new Map<string, { intention: string; hidden: boolean; reasons: string[] }>();
    for (const report of fresh) {
        const row = byId.get(report.intention_id);
        const entry = grouped.get(report.intention_id)
            ?? { intention: row?.intention ?? '—', hidden: Boolean(row?.is_hidden), reasons: [] };
        entry.reasons.push(report.reason);
        grouped.set(report.intention_id, entry);
    }

    const sent = await sendIntentionReportsAlert({
        reportCount: fresh.length,
        items: [...grouped.values()],
    });
    if (!sent) return 0;

    await supabase.from('email_notifications').insert(fresh.map((report) => ({
        user_id: report.reporter_id,
        type: REPORT_EMAIL_TYPE,
        reference: report.id,
        email: process.env.NOTIFY_EMAIL_TO || 'geral@apostoladodegarabandal.com',
        sent_at: new Date().toISOString(),
    })));
    return fresh.length;
}

/** O passo das intencoes no cron horario. Nunca lanca: devolve contagens. */
export async function processIntentionNotifications(supabase: SupabaseClient, now: Date = new Date()) {
    const result = { firstPrayers: 0, dailySummaries: 0, reportAlerts: 0, errors: 0 };

    try {
        const since = new Date(now.getTime() - WALL_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase
            .from('novena_intentions')
            .select('id, user_id, is_hidden, created_at')
            .eq('is_hidden', false)
            .gt('prayer_count', 0)
            .gte('created_at', since);

        const byAuthor = new Map<string, IntentionRow[]>();
        for (const intention of (data || []) as IntentionRow[]) {
            const list = byAuthor.get(intention.user_id) ?? [];
            list.push(intention);
            byAuthor.set(intention.user_id, list);
        }

        for (const [authorId, intentions] of byAuthor) {
            try {
                const ids = intentions.map((intention) => intention.id);
                const { data: firstRows, error: firstError } = await supabase
                    .from('push_notifications')
                    .select('reference')
                    .eq('type', FIRST_TYPE)
                    .in('reference', ids)
                    .not('sent_at', 'is', null);
                if (firstError) throw new Error(`Intention history: ${firstError.message}`);
                const announced = new Set(((firstRows || []) as { reference: string }[]).map((row) => row.reference));

                let sentNow = false;
                for (const id of ids) {
                    if (announced.has(id)) continue;
                    if ((await notifyFirstPrayer(supabase, id, now)) === 'sent') {
                        result.firstPrayers += 1;
                        sentNow = true;
                    }
                }
                // Nunca os dois avisos na mesma corrida: o resumo fica para a seguinte.
                if (sentNow) continue;
                if (await notifyDailySummary(supabase, authorId, ids, now)) result.dailySummaries += 1;
            } catch (error) {
                result.errors += 1;
                console.warn('[intentions] falhou um autor:', error);
            }
        }

        result.reportAlerts = await processReportAlerts(supabase);
    } catch (error) {
        result.errors += 1;
        console.warn('[intentions] passo falhou:', error);
    }

    return result;
}
