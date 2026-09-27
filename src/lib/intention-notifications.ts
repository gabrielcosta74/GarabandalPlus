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
 *  2. RESUMO DIARIO. No maximo um por intencao por dia, ao fim da tarde no fuso
 *     do autor, e so se alguem rezou desde o ultimo aviso. Nunca um push por
 *     cada oracao: isso seria ruido, nao comunidade.
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
    last_seen_at: string | null;
};

type IntentionRow = {
    id: string;
    user_id: string;
    intention: string;
    is_hidden: boolean;
    created_at: string;
};

export type FirstPrayerOutcome =
    | 'sent'
    | 'already_sent'
    | 'no_prayers'
    | 'hidden'
    | 'no_devices'
    | 'quiet_hours'
    | 'not_delivered'
    | 'not_found';

const isEnglish = (locale: string | null) => (locale || '').toLowerCase().startsWith('en');

function excerpt(text: string, max = 70) {
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function firstCopy(locale: string | null, text: string) {
    return isEnglish(locale)
        ? { title: 'Someone prayed for you', body: `A member of the community prayed for your intention: “${excerpt(text)}”` }
        : { title: 'Alguém rezou por si', body: `Um membro da comunidade rezou pela sua intenção: “${excerpt(text)}”` };
}

function dailyCopy(locale: string | null, count: number) {
    if (isEnglish(locale)) {
        return {
            title: 'Prayers for your intention',
            body: count === 1 ? '1 person prayed for your intention today.' : `${count} people prayed for your intention today.`,
        };
    }
    return {
        title: 'Rezaram pela sua intenção',
        body: count === 1 ? '1 pessoa rezou hoje pela sua intenção.' : `${count} pessoas rezaram hoje pela sua intenção.`,
    };
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

function localDate(device: Device | undefined, now: Date) {
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: device?.timezone || FALLBACK_TIMEZONE }).format(now);
    } catch {
        return now.toISOString().slice(0, 10);
    }
}

async function devicesFor(supabase: SupabaseClient, userId: string): Promise<Device[]> {
    const { data } = await supabase
        .from('member_devices')
        .select('user_id, expo_push_token, timezone, locale, last_seen_at')
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
    url: string,
    kind: string,
) {
    const messages: ExpoPushMessage[] = devices
        .filter((device) => device.expo_push_token)
        .map((device) => ({
            to: device.expo_push_token!,
            title: copy.title,
            body: copy.body,
            channelId: CHANNEL,
            sound: 'default',
            data: { kind, url },
        }));

    const outcome = await sendExpoPush(messages);

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
        .select('id, user_id, intention, is_hidden, created_at')
        .eq('id', intentionId)
        .maybeSingle();
    return (data as IntentionRow | null) ?? null;
}

/** Orações de outros membros (a do proprio autor nunca conta). */
async function prayersByOthers(supabase: SupabaseClient, intention: IntentionRow, since?: string | null) {
    let query = supabase
        .from('novena_intention_prayers')
        .select('user_id', { count: 'exact', head: true })
        .eq('intention_id', intention.id)
        .neq('user_id', intention.user_id);
    if (since) query = query.gt('created_at', since);
    const { count } = await query;
    return count ?? 0;
}

export async function notifyFirstPrayer(
    supabase: SupabaseClient,
    intentionId: string,
    now: Date = new Date(),
): Promise<FirstPrayerOutcome> {
    const intention = await loadIntention(supabase, intentionId);
    if (!intention) return 'not_found';
    if (intention.is_hidden) return 'hidden';
    if ((await prayersByOthers(supabase, intention)) === 0) return 'no_prayers';

    const devices = await devicesFor(supabase, intention.user_id);
    if (devices.length === 0) return 'no_devices';
    const device = primaryDevice(devices);
    if (isQuiet(localHour(device, now))) return 'quiet_hours';

    const recordId = await claim(supabase, FIRST_TYPE, intention.id, intention.user_id);
    if (!recordId) return 'already_sent';

    const delivered = await deliver(
        supabase,
        recordId,
        devices,
        firstCopy(device?.locale ?? null, intention.intention),
        '/pray/intentions/mine',
        'intention-first-prayer',
    );
    return delivered > 0 ? 'sent' : 'not_delivered';
}

async function lastNotifiedAt(supabase: SupabaseClient, intentionId: string) {
    const { data } = await supabase
        .from('push_notifications')
        .select('sent_at')
        .in('type', [FIRST_TYPE, DAILY_TYPE])
        .or(`reference.eq.${intentionId},reference.like.${intentionId}:*`)
        .not('sent_at', 'is', null)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    return (data as { sent_at?: string } | null)?.sent_at ?? null;
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
            .select('id, user_id, intention, is_hidden, created_at')
            .eq('is_hidden', false)
            .gt('prayer_count', 0)
            .gte('created_at', since);

        for (const intention of (data || []) as IntentionRow[]) {
            try {
                const { data: first } = await supabase
                    .from('push_notifications')
                    .select('sent_at')
                    .eq('type', FIRST_TYPE)
                    .eq('reference', intention.id)
                    .not('sent_at', 'is', null)
                    .limit(1)
                    .maybeSingle();

                if (!first) {
                    if ((await notifyFirstPrayer(supabase, intention.id, now)) === 'sent') result.firstPrayers += 1;
                    continue;
                }

                const devices = await devicesFor(supabase, intention.user_id);
                if (devices.length === 0) continue;
                const device = primaryDevice(devices);
                const hour = localHour(device, now);
                if (hour < SUMMARY_FROM || hour > SUMMARY_UNTIL) continue;

                const count = await prayersByOthers(supabase, intention, await lastNotifiedAt(supabase, intention.id));
                if (count === 0) continue;

                const recordId = await claim(
                    supabase,
                    DAILY_TYPE,
                    `${intention.id}:${localDate(device, now)}`,
                    intention.user_id,
                );
                if (!recordId) continue;

                const delivered = await deliver(
                    supabase,
                    recordId,
                    devices,
                    dailyCopy(device?.locale ?? null, count),
                    '/pray/intentions/mine',
                    'intention-daily',
                );
                if (delivered > 0) result.dailySummaries += 1;
            } catch (error) {
                result.errors += 1;
                console.warn('[intentions] falhou uma intencao:', error);
            }
        }

        result.reportAlerts = await processReportAlerts(supabase);
    } catch (error) {
        result.errors += 1;
        console.warn('[intentions] passo falhou:', error);
    }

    return result;
}
