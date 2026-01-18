import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { sendQuotaReminderEmail } from '../../../../lib/email';
import { ensureNotificationRecord, markNotificationSent } from '../../../../lib/email-notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;

const toUtcDate = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const daysBetweenUtc = (from: Date, to: Date) => {
  const diff = to.getTime() - from.getTime();
  return Math.round(diff / DAY_MS);
};

const buildMembershipUrl = () => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://payments-web-kappa.vercel.app';
  return `${siteUrl.replace(/\/$/, '')}/login?next=/member/quota`;
};

const isFounderType = (value?: string | null) => (value || '').toLowerCase().includes('fundador');

export async function GET(request: Request) {
  if (!supabaseServer) return NextResponse.json({ message: 'Supabase nao configurado' }, { status: 500 });

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get('authorization') || '';
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
  }

  const { data: membros, error } = await supabaseServer
    .from('membros')
    .select('id, nome, email, numero_socio, proxima_quota, estado_quota, tipo_subscricao, is_membro')
    .not('proxima_quota', 'is', null);

  if (error) {
    return NextResponse.json({ message: 'Erro ao carregar membros', error: error.message }, { status: 500 });
  }

  const today = toUtcDate(new Date());
  const results: Array<{ userId: string; type: string; sent: boolean }> = [];

  for (const member of membros || []) {
    if (!member?.email || !member?.proxima_quota) continue;
    if (isFounderType(member.tipo_subscricao)) continue;
    if (!member.is_membro) continue;

    const dueDate = new Date(member.proxima_quota);
    if (Number.isNaN(dueDate.getTime())) continue;

    const diffDays = daysBetweenUtc(today, dueDate);
    const status = (member.estado_quota || '').toLowerCase();

    let notificationType: string | null = null;
    let reminderPayload: { daysUntilDue?: number; daysOverdue?: number } = {};

    if (diffDays === 30) {
      notificationType = 'quota_reminder_30d';
      reminderPayload = { daysUntilDue: 30 };
    } else if (diffDays === 7) {
      notificationType = 'quota_reminder_7d';
      reminderPayload = { daysUntilDue: 7 };
    } else if (diffDays === 1) {
      notificationType = 'quota_reminder_1d';
      reminderPayload = { daysUntilDue: 1 };
    } else if (diffDays === -7 && status !== 'pago') {
      notificationType = 'quota_overdue_7d';
      reminderPayload = { daysOverdue: 7 };
    } else if (diffDays === -14 && status !== 'pago') {
      notificationType = 'quota_overdue_14d';
      reminderPayload = { daysOverdue: 14 };
    } else if (diffDays === -30 && status !== 'pago') {
      notificationType = 'quota_overdue_30d';
      reminderPayload = { daysOverdue: 30 };
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
      results.push({ userId: member.id, type: notificationType, sent: false });
      continue;
    }

    try {
      await sendQuotaReminderEmail({
        toEmail: member.email,
        memberName: member.nome ?? null,
        memberNumber: member.numero_socio ?? null,
        nextQuotaDate: member.proxima_quota,
        membershipUrl: buildMembershipUrl(),
        ...reminderPayload,
      });
      await markNotificationSent(supabaseServer, notification.recordId);
      results.push({ userId: member.id, type: notificationType, sent: true });
    } catch (err) {
      console.error('Erro ao enviar lembrete de quota:', err);
      results.push({ userId: member.id, type: notificationType, sent: false });
    }
  }

  return NextResponse.json({ ok: true, sent: results });
}
