import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { requireAdmin } from '../../../../../lib/admin-auth';

export async function POST(req: Request) {
    try {
        // 1. Verify admin status
        const { ok, user, status, message } = await requireAdmin(req);
        if (!ok) {
            return NextResponse.json({ error: message }, { status });
        }

        const { paymentId, bookingId, amount, label } = await req.json();

        if (!paymentId || !bookingId) {
            return NextResponse.json({ error: 'Faltam dados: paymentId ou bookingId.' }, { status: 400 });
        }

        if (!supabaseServer) {
            return NextResponse.json({ error: 'Servidor Supabase indisponível.' }, { status: 500 });
        }

        // 2. Fetch the payment to verify it exists
        const { data: payment, error: fetchError } = await supabaseServer
            .from('pilgrimage_payments')
            .select('amount, status')
            .eq('id', paymentId)
            .single();

        if (fetchError || !payment) {
            return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 });
        }

        if (payment.status === 'verified') {
            return NextResponse.json({ message: 'Pagamento já está verificado.' });
        }

        // 3. Update payment status to verified, update amount if provided, add label
        const updateData: any = {
            status: 'verified',
            verified_at: new Date().toISOString()
        };

        // Admin can override the amount
        if (amount !== undefined && amount !== null) {
            updateData.amount = Number(amount);
        }

        // Admin can add label (stored in notes)
        if (label) {
            updateData.notes = label;
        }

        const { error: updatePayError } = await supabaseServer
            .from('pilgrimage_payments')
            .update(updateData)
            .eq('id', paymentId);

        if (updatePayError) {
            console.error('Error verifying payment:', updatePayError);
            return NextResponse.json({ error: 'Erro ao validar pagamento.' }, { status: 500 });
        }

        // 4. Recalculate and update booking paid_amount
        const { data: allPayments, error: allPaymentsError } = await supabaseServer
            .from('pilgrimage_payments')
            .select('amount')
            .eq('booking_id', bookingId)
            .eq('status', 'verified');

        if (allPaymentsError) {
            console.error('Error fetching all payments:', allPaymentsError);
            return NextResponse.json({ error: 'Erro ao recalcular total da reserva.' }, { status: 500 });
        }

        const totalPaid = allPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

        const { error: updateBookingError } = await supabaseServer
            .from('bookings')
            .update({ paid_amount: totalPaid })
            .eq('id', bookingId);

        if (updateBookingError) {
            console.error('Error updating booking:', updateBookingError);
            return NextResponse.json({ error: 'Erro ao atualizar total da reserva.' }, { status: 500 });
        }

        return NextResponse.json({ success: true, totalPaid });
    } catch (error: any) {
        console.error('Critical error in admin/payments/verify:', error);
        return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
    }
}
