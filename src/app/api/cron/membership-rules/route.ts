import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { sendQuotaReminderEmail, sendMembershipRevokedEmail } from '../../../../lib/email';
import { inferLanguage } from '../../../../lib/marketing-core';
import { ensureNotificationRecord, markNotificationSent } from '../../../../lib/email-notifications';
import { getAppUrl } from '../../../../lib/config';

import { daysBetweenUtc } from '../../../../lib/membership-logic';
import { isPaidStatus, isRevokedStatus } from '../../../../lib/membership-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const toUtcDate = (value: Date) =>
    new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const buildMembershipUrl = () => {
    const siteUrl = getAppUrl();
    return `${siteUrl}/login?next=/member/quota`;
};

const isFounderType = (value?: string | null) => (value || '').toLowerCase().includes('fundador');

export async function GET(request: Request) {
    if (!supabaseServer) return NextResponse.json({ message: 'Supabase nao configurado' }, { status: 500 });

    const secret = process.env.CRON_SECRET || '';
    if (!secret) {
        return NextResponse.json({ message: 'CRON_SECRET não configurado.' }, { status: 500 });
    }
    const authHeader = request.headers.get('authorization') || '';
    if (authHeader !== `Bearer ${secret}`) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { data: membros, error } = await supabaseServer
        .from('membros')
        .select('id, nome, email, numero_socio, proxima_quota, estado_quota, tipo_subscricao, is_membro, country')
        .not('proxima_quota', 'is', null);

    if (error) {
        return NextResponse.json({ message: 'Erro ao carregar membros', error: error.message }, { status: 500 });
    }

    const today = toUtcDate(new Date());
    const results: Array<{ userId: string; action: string; success: boolean }> = [];

    for (const member of membros || []) {
        // 0. Founder Immunity
        if (isFounderType(member.tipo_subscricao)) continue;

        if (!member?.email || !member?.proxima_quota) continue;

        const dueDate = new Date(member.proxima_quota);
        if (Number.isNaN(dueDate.getTime())) continue;

        const diffDays = daysBetweenUtc(today, dueDate); // Positive = Future, Negative = Past
        const isPaid = isPaidStatus(member.estado_quota);
        const isRevoked = isRevokedStatus(member.estado_quota) || (member.estado_quota || '').toLowerCase() === 'expirado';

        // 1. State Transitions (DB Updates)
        // No grace period: membership expires immediately after due date.
        if (diffDays < 0 && !isRevoked) {
            await supabaseServer
                .from('membros')
                .update({ estado_quota: 'expirado', is_membro: false })
                .eq('id', member.id);
            results.push({ userId: member.id, action: 'set_expired', success: true });
        }

        // 2. Notifications (Reminders)
        // Don't send reminders if already revoked (unless it's the revocation notice itself)
        if (isRevoked && diffDays < -35) continue; // Stop processing old revoked members

        let notificationType: string | null = null;
        let reminderPayload: { daysUntilDue?: number; daysOverdue?: number } = {};

        if (diffDays === -1 && !isRevoked) {
            // First day after due date -> membership revoked.
            notificationType = 'membership_revoked';
        } else if (!isPaid && !isRevoked) {
            // Reminders only for members who are not paid and not revoked.
            if (diffDays === 30) {
                notificationType = 'quota_reminder_30d';
                reminderPayload = { daysUntilDue: 30 };
            } else if (diffDays === 7) {
                notificationType = 'quota_reminder_7d';
                reminderPayload = { daysUntilDue: 7 };
            } else if (diffDays === 1) {
                notificationType = 'quota_reminder_1d';
                reminderPayload = { daysUntilDue: 1 };
            }
        }

        if (!notificationType) continue;

        const reference = `${member.id}:${notificationType}:${member.proxima_quota}`;
        const notification = await ensureNotificationRecord(supabaseServer, {
            type: notificationType as any,
            reference,
            userId: member.id,
            email: member.email,
        });

        if (!notification.shouldSend) {
            continue;
        }

        try {
            let sent = false;

            const memberLocale = inferLanguage(member.country ?? null);

            if (notificationType === 'membership_revoked') {
                sent = await sendMembershipRevokedEmail({
                    email: member.email,
                    name: member.nome || '',
                    payLink: buildMembershipUrl(),
                    locale: memberLocale,
                });
            } else {
                sent = await sendQuotaReminderEmail({
                    toEmail: member.email,
                    memberName: member.nome ?? null,
                    memberNumber: member.numero_socio ?? null,
                    nextQuotaDate: member.proxima_quota,
                    membershipUrl: buildMembershipUrl(),
                    locale: memberLocale,
                    ...reminderPayload,
                });
            }

            if (!sent) {
                results.push({ userId: member.id, action: `email_not_sent_${notificationType}`, success: false });
                continue;
            }

            await markNotificationSent(supabaseServer, notification.recordId);
            results.push({ userId: member.id, action: `notify_${notificationType}`, success: true });
        } catch (err) {
            console.error(`Erro notification ${notificationType}:`, err);
            results.push({ userId: member.id, action: `notify_${notificationType}`, success: false });
        }
    }

    return NextResponse.json({ ok: true, processed: results.length, details: results });
}
