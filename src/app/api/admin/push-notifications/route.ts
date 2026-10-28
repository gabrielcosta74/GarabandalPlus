import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdmin } from '../../../../lib/admin-auth';
import { logAdminAction } from '../../../../lib/admin-logger';
import { isExpoPushToken } from '../../../../lib/expo-push';
import { isAllowedPushDestination } from '../../../../lib/push-destinations';
import {
    DEFAULT_REACTIVATION_AUTOMATION,
    getReactivationAutomation,
    sendPushCampaign,
    type PushCampaign,
} from '../../../../lib/push-campaigns';
import { supabaseServer } from '../../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const destinationSchema = z.string().refine(isAllowedPushDestination, 'Destino inválido.');

const campaignSchema = z.object({
    action: z.literal('create_campaign'),
    mode: z.enum(['send_now', 'schedule']),
    name: z.string().trim().min(2).max(80),
    titlePt: z.string().trim().min(2).max(60),
    bodyPt: z.string().trim().min(2).max(180),
    titleEn: z.string().trim().min(2).max(60),
    bodyEn: z.string().trim().min(2).max(180),
    destinationUrl: destinationSchema,
    scheduledFor: z.string().datetime().nullable().optional(),
});

const automationSchema = z.object({
    action: z.literal('update_automation'),
    enabled: z.boolean(),
    sendHourLocal: z.number().int().min(0).max(23),
    inactivityDays: z.number().int().min(1).max(365),
    cooldownDays: z.number().int().min(1).max(730),
    titlePt: z.string().trim().min(2).max(60),
    bodyPt: z.string().trim().min(2).max(180),
    titleEn: z.string().trim().min(2).max(60),
    bodyEn: z.string().trim().min(2).max(180),
    destinationUrl: destinationSchema,
});

const cancelSchema = z.object({
    action: z.literal('cancel_campaign'),
    campaignId: z.string().uuid(),
});

const requestSchema = z.discriminatedUnion('action', [campaignSchema, automationSchema, cancelSchema]);

type DeviceRow = {
    user_id: string;
    expo_push_token: string | null;
    push_enabled: boolean;
    platform: string | null;
    locale: string | null;
    last_seen_at: string;
};

const isMissingTable = (error: { code?: string; message?: string } | null) =>
    Boolean(error && (error.code === '42P01' || error.message?.includes('does not exist')));

export async function GET(request: Request) {
    const { authorized, error: authError } = await verifyAdmin(request);
    if (!authorized) {
        return NextResponse.json({ error: authError || 'Não autorizado.' }, { status: 401 });
    }
    if (!supabaseServer) {
        return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [devicesResult, campaignsResult, logsResult] = await Promise.all([
        supabaseServer
            .from('member_devices')
            .select('user_id, expo_push_token, push_enabled, platform, locale, last_seen_at')
            .range(0, 4999),
        supabaseServer
            .from('push_campaigns')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30),
        supabaseServer
            .from('push_notifications')
            .select('delivered_count, sent_at, type')
            .not('sent_at', 'is', null)
            .gte('sent_at', thirtyDaysAgo)
            .range(0, 4999),
    ]);

    if (devicesResult.error) {
        return NextResponse.json({ error: devicesResult.error.message }, { status: 500 });
    }

    const devices = (devicesResult.data || []) as DeviceRow[];
    const reachable = devices.filter(
        (device) => device.push_enabled && isExpoPushToken(device.expo_push_token),
    );
    const reachableUsers = new Set(reachable.map((device) => device.user_id));
    const activeRecently = reachable.filter((device) => device.last_seen_at >= thirtyDaysAgo);
    const logs = logsResult.error ? [] : logsResult.data || [];
    const reactivationAcceptedLast30Days = logs.reduce(
        (sum, row) => sum + Number(row.delivered_count || 0),
        0,
    );

    const setupRequired = isMissingTable(campaignsResult.error);
    const campaigns = setupRequired || campaignsResult.error ? [] : campaignsResult.data || [];
    const campaignAcceptedLast30Days = campaigns
        .filter((campaign) => campaign.sent_at && campaign.sent_at >= thirtyDaysAgo)
        .reduce((sum, campaign) => sum + Number(campaign.delivered_count || 0), 0);
    const automation = await getReactivationAutomation();

    return NextResponse.json({
        setupRequired,
        stats: {
            reachablePeople: reachableUsers.size,
            reachableDevices: reachable.length,
            activeDevices30d: activeRecently.length,
            ios: reachable.filter((device) => device.platform === 'ios').length,
            android: reachable.filter((device) => device.platform === 'android').length,
            english: reachable.filter((device) => (device.locale || '').toLowerCase().startsWith('en')).length,
            acceptedLast30Days: reactivationAcceptedLast30Days + campaignAcceptedLast30Days,
            reactivationAcceptedLast30Days,
            disabledDevices: devices.filter((device) => !device.push_enabled).length,
        },
        automation,
        campaigns,
    });
}

export async function POST(request: Request) {
    const { authorized, user, error: authError } = await verifyAdmin(request);
    if (!authorized || !user) {
        return NextResponse.json({ error: authError || 'Não autorizado.' }, { status: 401 });
    }
    if (!supabaseServer) {
        return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 });
    }

    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.issues[0]?.message || 'Dados inválidos.' },
            { status: 400 },
        );
    }

    const payload = parsed.data;

    if (payload.action === 'update_automation') {
        const now = new Date().toISOString();
        const { data, error } = await supabaseServer
            .from('push_automation_settings')
            .upsert({
                key: DEFAULT_REACTIVATION_AUTOMATION.key,
                name: DEFAULT_REACTIVATION_AUTOMATION.name,
                description: DEFAULT_REACTIVATION_AUTOMATION.description,
                enabled: payload.enabled,
                send_hour_local: payload.sendHourLocal,
                inactivity_days: payload.inactivityDays,
                cooldown_days: payload.cooldownDays,
                title_pt: payload.titlePt,
                body_pt: payload.bodyPt,
                title_en: payload.titleEn,
                body_en: payload.bodyEn,
                destination_url: payload.destinationUrl,
                updated_by: user.id,
                updated_at: now,
            }, { onConflict: 'key' })
            .select('*')
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        await logAdminAction(user.email || 'admin', 'UPDATE_PUSH_AUTOMATION', {
            key: DEFAULT_REACTIVATION_AUTOMATION.key,
            enabled: payload.enabled,
            inactivity_days: payload.inactivityDays,
            cooldown_days: payload.cooldownDays,
            send_hour_local: payload.sendHourLocal,
        });
        return NextResponse.json({ ok: true, automation: data });
    }

    if (payload.action === 'cancel_campaign') {
        const { data, error } = await supabaseServer
            .from('push_campaigns')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', payload.campaignId)
            .eq('status', 'scheduled')
            .select('id')
            .maybeSingle();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!data) {
            return NextResponse.json({ error: 'Este envio já não pode ser cancelado.' }, { status: 409 });
        }
        await logAdminAction(user.email || 'admin', 'CANCEL_PUSH_CAMPAIGN', {
            campaign_id: payload.campaignId,
        });
        return NextResponse.json({ ok: true });
    }

    const scheduledFor = payload.mode === 'schedule' ? payload.scheduledFor : new Date().toISOString();
    if (payload.mode === 'schedule') {
        if (!scheduledFor || new Date(scheduledFor).getTime() <= Date.now()) {
            return NextResponse.json({ error: 'Escolhe uma data futura para o envio.' }, { status: 400 });
        }
    }

    const { data: inserted, error: insertError } = await supabaseServer
        .from('push_campaigns')
        .insert({
            name: payload.name,
            target: 'all_push_enabled',
            title_pt: payload.titlePt,
            body_pt: payload.bodyPt,
            title_en: payload.titleEn,
            body_en: payload.bodyEn,
            destination_url: payload.destinationUrl,
            status: payload.mode === 'schedule' ? 'scheduled' : 'sending',
            scheduled_for: scheduledFor,
            created_by: user.id,
        })
        .select('*')
        .single();

    if (insertError || !inserted) {
        return NextResponse.json(
            { error: insertError?.message || 'Não foi possível criar o envio.' },
            { status: 500 },
        );
    }

    await logAdminAction(user.email || 'admin', 'CREATE_PUSH_CAMPAIGN', {
        campaign_id: inserted.id,
        name: inserted.name,
        mode: payload.mode,
        scheduled_for: scheduledFor,
        destination_url: payload.destinationUrl,
    });

    if (payload.mode === 'schedule') {
        return NextResponse.json({ ok: true, campaign: inserted });
    }

    try {
        const outcome = await sendPushCampaign(inserted as PushCampaign, supabaseServer);
        return NextResponse.json({ ok: true, campaign: inserted, outcome });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha inesperada no envio.';
        await supabaseServer
            .from('push_campaigns')
            .update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() })
            .eq('id', inserted.id);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
