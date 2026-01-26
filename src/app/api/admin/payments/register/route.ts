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

        if (!bookingId || !amount) {
            return NextResponse.json({ error: 'Faltam dados obrigatórios.' }, { status: 400 });
        }

        if (!supabaseServer) {
            return NextResponse.json({ error: 'Servidor Supabase indisponível.' }, { status: 500 });
        }

        // 2. Get the user_id from the booking (since admin is inserting on behalf of user)
        const { data: booking, error: bookingError } = await supabaseServer
            .from('bookings')
            .select('user_id, paid_amount')
            .eq('id', bookingId)
            .single();

        if (bookingError || !booking) {
            console.error('Error fetching booking:', bookingError);
            return NextResponse.json({ error: 'Reserva não encontrada.' }, { status: 404 });
        }

        const userId = booking.user_id;
        const currentPaid = Number(booking.paid_amount) || 0;
        const registerAmount = Number(amount);

        // 3. Insert the payment record (Service Role bypasses RLS)
        const { error: insertError } = await supabaseServer
            .from('pilgrimage_payments')
            .insert({
                booking_id: bookingId,
                user_id: userId,
                amount: registerAmount,
                method: method === 'cash' ? 'manual' : method,
                status: 'verified',
                notes: label ? `[${label}] ${notes || 'Pagamento manual'}` : (notes || 'Pagamento registado manualmente pelo Admin'),
                verified_at: verifiedAt || new Date().toISOString()
            });

        if (insertError) {
            console.error('Error inserting payment:', insertError);
            return NextResponse.json({ error: `Erro ao inserir: ${insertError.message}` }, { status: 500 });
        }

        // 4. Update the booking paid_amount
        const { error: updateError } = await supabaseServer
            .from('bookings')
            .update({ paid_amount: currentPaid + registerAmount })
            .eq('id', bookingId);

        if (updateError) {
            console.error('Error updating booking:', updateError);
            return NextResponse.json({ error: `Erro ao atualizar reserva: ${updateError.message}` }, { status: 500 });
        }

        return NextResponse.json({ success: true, newTotal: currentPaid + registerAmount });

        // Log asynchronously
        await logAdminAction(user.email, 'REGISTER_PAYMENT', { bookingId, amount, method, notes }, userId);
    } catch (error: any) {
        console.error('Critical internal error in admin/payments/register:', error);
        return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
    }
}
