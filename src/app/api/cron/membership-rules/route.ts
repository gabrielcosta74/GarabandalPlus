import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import {
    sendQuotaWarningEmail,
    sendQuotaOverdueEmail,
    sendMembershipRevokedEmail
} from '../../../../lib/email';
import { APP_URL } from '../../../../lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ message: 'Supabase nao configurado' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    // Expiry check (30 days ago)
    const revocationDate = new Date(today);
    revocationDate.setDate(today.getDate() - 30);
    const revocationStr = revocationDate.toISOString().split('T')[0];

    const results = {
        warnings: 0,
        overdue: 0,
        revoked: 0
    };

    try {
        // 1. WARNINGS (7 Days Before)
        const { data: warningMembers } = await supabaseServer
            .from('membros')
            .select('id, nome, email, proxima_quota')
            .eq('proxima_quota', nextWeekStr)
            .eq('is_membro', true);

        if (warningMembers?.length) {
            for (const member of warningMembers) {
                if (member.email) {
                    await sendQuotaWarningEmail({
                        name: member.nome || 'Membro',
                        email: member.email,
                        daysRemaining: 7,
                        payLink: `${APP_URL}/member/quota`
                    });
                    results.warnings++;
                }
            }
        }

        // 2. OVERDUE (Expires Today) - Grace Period Starts
        const { data: overdueMembers } = await supabaseServer
            .from('membros')
            .select('id, nome, email, proxima_quota')
            .eq('proxima_quota', todayStr)
            .eq('is_membro', true);

        if (overdueMembers?.length) {
            for (const member of overdueMembers) {
                if (member.email) {
                    await sendQuotaOverdueEmail({
                        name: member.nome || 'Membro',
                        email: member.email,
                        payLink: `${APP_URL}/member/quota`
                    });
                    results.overdue++;
                }
            }
        }

        // 3. REVOCATION (Expired > 30 Days ago)
        const { data: revokedMembers } = await supabaseServer
            .from('membros')
            .select('id, nome, email, proxima_quota')
            .lt('proxima_quota', revocationStr) // Older than 30 days
            .eq('is_membro', true);

        if (revokedMembers?.length) {
            for (const member of revokedMembers) {
                // Update DB
                const { error } = await supabaseServer
                    .from('membros')
                    .update({
                        is_membro: false,
                        estado_quota: 'expirado',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', member.id);

                if (!error && member.email) {
                    await sendMembershipRevokedEmail({
                        name: member.nome || 'Ex-Membro',
                        email: member.email,
                        payLink: `${APP_URL}/member/quota`
                    });
                    results.revoked++;
                }
            }
        }

        return NextResponse.json({ success: true, results });

    } catch (err: any) {
        console.error('Membership Cron Error:', err);
        return NextResponse.json({ message: err.message }, { status: 500 });
    }
}
