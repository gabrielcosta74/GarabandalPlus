import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isExpoPushToken, sendExpoPush, type ExpoPushMessage } from './expo-push';
import { supabaseServer } from './supabase';

export const DEFAULT_REACTIVATION_AUTOMATION = {
    key: 'reactivation_30d',
    name: 'Reativação de membros inativos',
    description: 'Convida a voltar quem não abre a app há algum tempo, respeitando o fuso horário e um intervalo mínimo entre envios.',
    enabled: true,
    send_hour_local: 10,
    inactivity_days: 30,
    cooldown_days: 60,
    title_pt: 'Um momento de oração hoje 🕊️',
    body_pt: 'A novena e as orações continuam aqui, sempre que quiser voltar.',
    title_en: 'A moment of prayer today 🕊️',
    body_en: 'The novena and the prayers are here whenever you want to return.',
    destination_url: '/',
    updated_at: null as string | null,
};

export type PushCampaign = {
    id: string;
    name: string;
    title_pt: string;
    body_pt: string;
    title_en: string | null;
    body_en: string | null;
    destination_url: string;
    status: string;
    scheduled_for: string | null;
    sent_at: string | null;
    recipient_count: number;
    device_count: number;
    delivered_count: number;
    failed_count: number;
    error_message: string | null;
    created_at: string;
};

type PushDevice = {
    user_id: string;
    expo_push_token: string | null;
    locale: string | null;
};

type CampaignOutcome = {
    status: 'sent' | 'partial' | 'failed';
    recipients: number;
    devices: number;
    delivered: number;
    failed: number;
};

const localeOf = (value: string | null) =>
    (value || '').toLowerCase().startsWith('en') ? 'en' : 'pt';

export async function getReactivationAutomation(client = supabaseServer) {
    if (!client) return DEFAULT_REACTIVATION_AUTOMATION;

    const { data, error } = await client
        .from('push_automation_settings')
        .select('*')
        .eq('key', DEFAULT_REACTIVATION_AUTOMATION.key)
        .maybeSingle();

    if (error || !data) return DEFAULT_REACTIVATION_AUTOMATION;
    return { ...DEFAULT_REACTIVATION_AUTOMATION, ...data };
}

/**
 * Envia um broadcast para cada token válido que tenha push ligado.
 *
 * O estado da campanha é atualizado aqui para que o envio imediato do admin e
 * o envio agendado do cron tenham exatamente a mesma contabilização.
 */
export async function sendPushCampaign(
    campaign: PushCampaign,
    client: SupabaseClient = supabaseServer as SupabaseClient,
): Promise<CampaignOutcome> {
    if (!client) throw new Error('Supabase não configurado.');

    const { data, error } = await client
        .from('member_devices')
        .select('user_id, expo_push_token, locale')
        .eq('push_enabled', true)
        .not('expo_push_token', 'is', null)
        .range(0, 4999);

    if (error) throw new Error(error.message);

    // Um token repetido nunca deve receber duas cópias do mesmo broadcast.
    const byToken = new Map<string, PushDevice>();
    for (const row of (data || []) as PushDevice[]) {
        const token = row.expo_push_token?.trim();
        if (token && isExpoPushToken(token) && !byToken.has(token)) {
            byToken.set(token, { ...row, expo_push_token: token });
        }
    }

    const devices = [...byToken.values()];
    const recipients = new Set(devices.map((device) => device.user_id)).size;

    if (devices.length === 0) {
        await client
            .from('push_campaigns')
            .update({
                status: 'failed',
                recipient_count: 0,
                device_count: 0,
                delivered_count: 0,
                failed_count: 0,
                error_message: 'Não existem dispositivos com push ativo.',
                updated_at: new Date().toISOString(),
            })
            .eq('id', campaign.id);

        return { status: 'failed', recipients: 0, devices: 0, delivered: 0, failed: 0 };
    }

    const messages: ExpoPushMessage[] = devices.map((device) => {
        const english = localeOf(device.locale) === 'en';
        return {
            to: device.expo_push_token as string,
            title: english ? campaign.title_en || campaign.title_pt : campaign.title_pt,
            body: english ? campaign.body_en || campaign.body_pt : campaign.body_pt,
            channelId: 'avisos',
            sound: 'default',
            data: { kind: 'admin_broadcast', url: campaign.destination_url },
        };
    });

    const outcome = await sendExpoPush(messages);

    if (outcome.invalidTokens.length > 0) {
        await client
            .from('member_devices')
            .delete()
            .in('expo_push_token', [...new Set(outcome.invalidTokens)]);
    }

    const status: CampaignOutcome['status'] =
        outcome.delivered === 0 ? 'failed' : outcome.failed > 0 ? 'partial' : 'sent';
    const now = new Date().toISOString();

    await client
        .from('push_campaigns')
        .update({
            status,
            sent_at: outcome.delivered > 0 ? now : null,
            recipient_count: recipients,
            device_count: devices.length,
            delivered_count: outcome.delivered,
            failed_count: outcome.failed,
            error_message: outcome.delivered === 0 ? 'O Expo não aceitou nenhuma notificação.' : null,
            updated_at: now,
        })
        .eq('id', campaign.id);

    return {
        status,
        recipients,
        devices: devices.length,
        delivered: outcome.delivered,
        failed: outcome.failed,
    };
}

/** Reclama e envia no máximo cinco campanhas vencidas em cada corrida. */
export async function processScheduledPushCampaigns(client = supabaseServer) {
    if (!client) return { processed: 0, delivered: 0 };

    const { data, error } = await client
        .from('push_campaigns')
        .select('*')
        .eq('status', 'scheduled')
        .lte('scheduled_for', new Date().toISOString())
        .order('scheduled_for', { ascending: true })
        .limit(5);

    // A migration pode ainda não ter sido aplicada durante uma publicação.
    if (error) return { processed: 0, delivered: 0 };

    let processed = 0;
    let delivered = 0;

    for (const candidate of (data || []) as PushCampaign[]) {
        const { data: claimed } = await client
            .from('push_campaigns')
            .update({ status: 'sending', updated_at: new Date().toISOString() })
            .eq('id', candidate.id)
            .eq('status', 'scheduled')
            .select('*')
            .maybeSingle();

        if (!claimed) continue;

        try {
            const outcome = await sendPushCampaign(claimed as PushCampaign, client);
            processed += 1;
            delivered += outcome.delivered;
        } catch (sendError) {
            await client
                .from('push_campaigns')
                .update({
                    status: 'failed',
                    error_message: sendError instanceof Error ? sendError.message : 'Falha inesperada.',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', candidate.id);
            processed += 1;
        }
    }

    return { processed, delivered };
}
