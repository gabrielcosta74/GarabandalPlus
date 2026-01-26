import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';

import { verifyAdmin } from '../../../../../lib/admin-auth';
import { logAdminAction } from '../../../../../lib/admin-logger';

export async function POST(req: Request) {
    try {
        if (!supabaseServer) {
            return NextResponse.json({ error: 'Servidor Supabase indisponível.' }, { status: 500 });
        }

        // 1. Verify admin status
        const { authorized, user, error: authError } = await verifyAdmin(req);
        if (!authorized || !user) {
            return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { paymentId, bookingId, amount, label } = body;
        console.log(`🚀 [API] Processing Verification for Payment: ${paymentId}, Booking: ${bookingId}, Amount: ${amount}`);

        if (!paymentId || !bookingId) {
            return NextResponse.json({ error: 'Faltam dados: paymentId ou bookingId.' }, { status: 400 });
        }

        // 2. Fetch the payment to verify it exists
        const { data: payment, error: fetchError } = await supabaseServer
            .from('pilgrimage_payments')
            .select('amount, status, notes')
            .eq('id', paymentId)
            .single();

        if (fetchError || !payment) {
            console.error("❌ [API] Payment not found:", fetchError);
            return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 });
        }

        // 3. Update payment status to verified
        const updateData: any = {
            status: 'verified',
            verified_at: new Date().toISOString()
        };

        // Admin can override the amount
        if (amount !== undefined && amount !== null && amount !== '') {
            updateData.amount = Number(amount);
        }

        // Append label to notes if provided
        if (label) {
            const currentNotes = payment.notes || '';
            updateData.notes = currentNotes ? `${currentNotes} | ${label}` : label;
        }

        console.log("🚀 [API] Updating Payment...", updateData);
        const { data: updatedPayment, error: updatePayError } = await supabaseServer
            .from('pilgrimage_payments')
            .update(updateData)
            .eq('id', paymentId)
            .select('id, status, amount')
            .single();

        if (updatePayError || !updatedPayment) {
            console.error('❌ [API] Error verifying payment:', updatePayError);
            return NextResponse.json({ error: 'Erro ao validar pagamento.' }, { status: 500 });
        }

        // 4. Recalculate and update booking paid_amount
        console.log("🚀 [API] Recalculating Booking Total...");
        const { data: allPayments, error: allPaymentsError } = await supabaseServer
            .from('pilgrimage_payments')
            .select('amount')
            .eq('booking_id', bookingId)
            .in('status', ['verified', 'succeeded', 'paid']); // Include all valid statuses

        if (allPaymentsError) {
            console.error('❌ [API] Error fetching all payments:', allPaymentsError);
            return NextResponse.json({ error: 'Erro ao recalcular total da reserva.' }, { status: 500 });
        }

        const totalPaid = allPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        console.log(`🚀 [API] New Total Paid for Booking ${bookingId}: ${totalPaid}`);

        const { error: updateBookingError } = await supabaseServer
            .from('bookings')
            .update({ paid_amount: totalPaid })
            .eq('id', bookingId);

        if (updateBookingError) {
            console.error('❌ [API] Error updating booking:', updateBookingError);
            return NextResponse.json({ error: 'Erro ao atualizar total da reserva.' }, { status: 500 });
        }

        console.log("🚀 [API] Success!");
        await logAdminAction(user.email, 'VERIFY_PAYMENT', { paymentId, bookingId, totalPaid }, paymentId);
        return NextResponse.json({ success: true, totalPaid, payment: updatedPayment });

    } catch (error: any) {
        console.error('❌ [API] Critical error in admin/payments/verify:', error);
        return NextResponse.json({ error: 'Erro interno no servidor: ' + error.message }, { status: 500 });
    }
}
