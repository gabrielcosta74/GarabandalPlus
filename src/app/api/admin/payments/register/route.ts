import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../lib/admin-auth';
import { logAdminAction } from '../../../../../lib/admin-logger';

export async function POST(req: Request) {
    try {
        // 1. Verify admin status
        const { authorized, user, error: authError } = await verifyAdmin(req);
        if (!authorized || !user) {
            return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { bookingId, amount, method, notes, label, verifiedAt } = body;
        const registerAmount = Number(amount);

        if (!bookingId || !Number.isFinite(registerAmount) || registerAmount <= 0) {
            return NextResponse.json({ error: 'Faltam dados obrigatórios.' }, { status: 400 });
        }

        if (!supabaseServer) {
            return NextResponse.json({ error: 'Servidor Supabase indisponível.' }, { status: 500 });
        }

        // 2. Get the user_id from the booking (since admin is inserting on behalf of user)
        const { data: booking, error: bookingError } = await supabaseServer
            .from('bookings')
            .select('user_id, paid_amount, pilgrimage_id, pilgrimage:pilgrimages(deposit_value)')
            .eq('id', bookingId)
            .single();

        if (bookingError || !booking) {
            console.error('Error fetching booking:', bookingError);
            return NextResponse.json({ error: 'Reserva não encontrada.' }, { status: 404 });
        }

        const userId = booking.user_id;
        const paymentMethod = method === 'cash' ? 'manual' : (method || 'manual');
        const paymentTimestamp = verifiedAt || new Date().toISOString();

        // 3. Insert the payment record (Service Role bypasses RLS)
        const { data: insertedPayment, error: insertError } = await supabaseServer
            .from('pilgrimage_payments')
            .insert({
                booking_id: bookingId,
                user_id: userId,
                amount: registerAmount,
                method: paymentMethod,
                status: 'verified',
                notes: label ? `[${label}] ${notes || 'Pagamento manual'}` : (notes || 'Pagamento registado manualmente pelo Admin'),
                verified_at: paymentTimestamp,
                verified_by: user.id,
            })
            .select('id, amount, method, status, verified_at')
            .single();

        if (insertError) {
            console.error('Error inserting payment:', insertError);
            return NextResponse.json({ error: `Erro ao inserir: ${insertError.message}` }, { status: 500 });
        }

        // 4. Recalculate the booking paid_amount from valid payments
        const { data: allPayments, error: allPaymentsError } = await supabaseServer
            .from('pilgrimage_payments')
            .select('amount')
            .eq('booking_id', bookingId)
            .eq('deleted', false)
            .in('status', ['verified', 'succeeded', 'paid', 'manual']);

        if (allPaymentsError) {
            console.error('Error fetching payments for recalculation:', allPaymentsError);
            return NextResponse.json({ error: `Erro ao recalcular pagamentos: ${allPaymentsError.message}` }, { status: 500 });
        }

        const newTotalPaid = (allPayments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

        const { count: pilgrimsCount } = await supabaseServer
            .from('pilgrims')
            .select('id', { count: 'exact', head: true })
            .eq('booking_id', bookingId);

        const depositValue = Number((booking.pilgrimage as any)?.deposit_value || 0);
        const requiredDeposit = depositValue * Math.max(1, Number(pilgrimsCount || 1));
        const nextStatus = newTotalPaid >= requiredDeposit ? 'confirmed' : 'pending';
        const bookingUpdates: Record<string, string | number | null> = {
            paid_amount: newTotalPaid,
            status: nextStatus,
            updated_at: new Date().toISOString(),
        };
        if (newTotalPaid >= requiredDeposit) {
            bookingUpdates.deposit_confirmed_at = paymentTimestamp;
        }

        const { error: updateError } = await supabaseServer
            .from('bookings')
            .update(bookingUpdates)
            .eq('id', bookingId);

        if (updateError) {
            console.error('Error updating booking:', updateError);
            return NextResponse.json({ error: `Erro ao atualizar reserva: ${updateError.message}` }, { status: 500 });
        }

        if (booking.pilgrimage_id) {
            const { error: vacancySyncError } = await supabaseServer
                .rpc('recalculate_pilgrimage_vacancies', { p_pilgrimage_id: booking.pilgrimage_id });
            if (vacancySyncError) {
                console.error('Error syncing vacancies after manual register:', vacancySyncError);
            }
        }

        await logAdminAction(user.email, 'REGISTER_PAYMENT', {
            bookingId,
            amount: registerAmount,
            method: paymentMethod,
            notes,
            label,
        }, insertedPayment?.id || bookingId);

        return NextResponse.json({ success: true, newTotal: newTotalPaid, payment: insertedPayment });
    } catch (error: any) {
        console.error('Critical internal error in admin/payments/register:', error);
        return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
    }
}
