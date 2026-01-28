import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { getReduniqResult } from '../../../../lib/reduniq';
import { sendDonationReceiptEmail } from '../../../../lib/email';
import { ensureNotificationRecord, markNotificationSent } from '../../../../lib/email-notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const id = searchParams.get('id');

    if (!token && !id) {
        return NextResponse.json({ message: 'Token ou ID necessário.' }, { status: 400 });
    }

    if (!supabaseServer) {
        return NextResponse.json({ message: 'Erro de configuração.' }, { status: 500 });
    }

    try {
        // 1. Fetch Donation Record
        let query = supabaseServer.from('donations').select('*');
        if (token) query = query.eq('payment_intent_id', token);
        else if (id) query = query.eq('id', id);

        const { data: donation, error: fetchError } = await query.single();

        if (fetchError || !donation) {
            return NextResponse.json({ message: 'Doação não encontrada.' }, { status: 404 });
        }

        // if already succeeded, just return success
        if (donation.status === 'succeeded' || donation.status === 'paid') {
            return NextResponse.json({
                status: 'succeeded',
                donationId: donation.id,
                amount: donation.amount_cents / 100
            });
        }

        // 2. Check Reduniq Status (only if we have a token)
        let newStatus = donation.status;

        if (donation.method.includes('reduniq') || donation.payment_intent_id) {
            // If we don't have the token in the record but it was passed in query, use it
            const checkToken = donation.payment_intent_id || token;

            if (checkToken) {
                const result = await getReduniqResult(checkToken);
                const resultCode = result?.result?.code;

                // 00000000 = Success (Generic Reduniq)
                // But sometimes status comes in result.transaction.status

                if (resultCode === '00000000') {
                    newStatus = 'succeeded';
                } else {
                    // Check if it's pending/failed
                    // TODO: Map specific error codes if needed
                }
            }
        }

        // 3. Update Status if Changed to Succeeded
        if (newStatus === 'succeeded' && donation.status !== 'succeeded') {
            const { error: updateError } = await supabaseServer
                .from('donations')
                .update({
                    status: 'succeeded',
                    updated_at: new Date().toISOString()
                })
                .eq('id', donation.id);

            if (updateError) throw updateError;

            // 4. Update Meta (Total Raised)
            // Replicating logic from webhook
            try {
                const increment = donation.amount_cents / 100;
                const { data: metaRow } = await supabaseServer
                    .from('donations_meta')
                    .select('id, goal_eur, raised_eur')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const goal = metaRow?.goal_eur ?? 100000;
                const currentRaised = Number(metaRow?.raised_eur ?? 0);
                const newRaised = currentRaised + increment;

                if (metaRow?.id) {
                    await supabaseServer
                        .from('donations_meta')
                        .update({ raised_eur: newRaised }) // keep goal same
                        .eq('id', metaRow.id);
                } else {
                    await supabaseServer
                        .from('donations_meta')
                        .insert({ goal_eur: goal, raised_eur: newRaised });
                }
            } catch (metaErr) {
                console.error('Erro ao atualizar meta:', metaErr);
                // Don't block response
            }

            // 5. Send Email
            if (donation.donor_email) {
                try {
                    const notification = await ensureNotificationRecord(supabaseServer, {
                        type: 'donation_paid',
                        reference: donation.external_reference || donation.id,
                        userId: donation.user_id,
                        email: donation.donor_email,
                    });

                    if (notification.shouldSend) {
                        await sendDonationReceiptEmail({
                            toEmail: donation.donor_email,
                            donorName: donation.donor_name,
                            amount: donation.amount_cents / 100,
                            currency: donation.currency || 'EUR',
                            paymentReference: donation.external_reference || donation.id,
                            paidAt: new Date().toISOString(),
                            method: donation.method,
                        });
                        await markNotificationSent(supabaseServer, notification.recordId);
                    }
                } catch (emailErr) {
                    console.error('Erro ao enviar email de doação:', emailErr);
                }
            }
        }

        return NextResponse.json({
            status: newStatus,
            donationId: donation.id,
            amount: donation.amount_cents / 100
        });

    } catch (err: any) {
        console.error('Erro em /api/donations/status:', err);
        return NextResponse.json({ message: 'Erro ao verificar estado.' }, { status: 500 });
    }
}
