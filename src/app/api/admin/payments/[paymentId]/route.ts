import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../lib/admin-auth';
import { logAdminAction } from '../../../../../lib/admin-logger';

export async function DELETE(
    req: Request,
    context: { params: Promise<{ paymentId: string }> }
) {
    try {
        if (!supabaseServer) {
            return NextResponse.json({ error: 'Servidor Supabase indisponível.' }, { status: 500 });
        }

        const resolvedParams = await context.params;
        const paymentId = resolvedParams.paymentId;

        // 1. Verify admin status
        const { authorized, user, error: authError } = await verifyAdmin(req);
        if (!authorized || !user) {
            return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
        }

        console.log(`🚀 [API] Starting Deletion for Payment: ${paymentId}`);

        // 2. Fetch the payment to verify it exists and get bookingId
        const { data: payment, error: fetchError } = await supabaseServer
            .from('pilgrimage_payments')
            .select('booking_id, amount, status')
            .eq('id', paymentId)
            .single();

        if (fetchError || !payment) {
            console.error("❌ [API] Payment not found for deletion:", fetchError);
            return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 });
        }

        const bookingId = payment.booking_id;

        // 3. Delete the payment record
        console.log(`🚀 [API] Deleting Payment Record...`);
        const { error: deleteError } = await supabaseServer
            .from('pilgrimage_payments')
            .delete()
            .eq('id', paymentId);

        if (deleteError) {
            console.error('❌ [API] Error deleting payment:', deleteError);
            return NextResponse.json({ error: 'Erro ao remover pagamento.' }, { status: 500 });
        }

        // 4. Recalculate and update booking paid_amount
        console.log("🚀 [API] Recalculating Booking Total...");

        // Fetch all REMAINING valid payments for this booking
        const { data: allPayments, error: allPaymentsError } = await supabaseServer
            .from('pilgrimage_payments')
            .select('amount')
            .eq('booking_id', bookingId)
            .in('status', ['verified', 'succeeded', 'paid', 'manual']);

        if (allPaymentsError) {
            console.error('❌ [API] Error fetching remaining payments:', allPaymentsError);
            return NextResponse.json({ error: 'Erro ao recalcular total da reserva.' }, { status: 500 });
        }

        const newTotalPaid = allPayments.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);
        console.log(`🚀 [API] New Total Paid for Booking ${bookingId}: ${newTotalPaid}`);

        // Fetch booking info to re-evaluate status
        const { data: bookingData, error: bookingDataError } = await supabaseServer
            .from('bookings')
            .select('id, pilgrimage_id, status, total_amount, pilgrimage:pilgrimages(deposit_value)')
            .eq('id', bookingId)
            .single();

        if (bookingDataError || !bookingData) {
            console.error('❌ [API] Error fetching booking for status update:', bookingDataError);
            // Even if this fails, the payment is deleted, but status is out of sync
            return NextResponse.json({ error: 'Pagamento removido, mas erro ao atualizar reserva.' }, { status: 500 });
        }

        // Evaluate pilgrims count to check deposit requirements
        const { count: pilgrimsCount } = await supabaseServer
            .from('pilgrims')
            .select('id', { count: 'exact', head: true })
            .eq('booking_id', bookingId);

        const numPilgrims = Math.max(1, Number(pilgrimsCount || 1));
        const depositValue = Number((bookingData.pilgrimage as any)?.deposit_value || 0);
        const requiredDeposit = depositValue * numPilgrims;
        const totalAmount = Number(bookingData.total_amount || 0);

        // Status Logic matching verifying endpoint
        const isDepositPaid = newTotalPaid >= (requiredDeposit - 0.01);
        const isFullyPaid = totalAmount > 0 && newTotalPaid >= (totalAmount - 0.01);

        // If they drop below deposit requirements, change status from 'confirmed' back to 'pending'
        // But do not touch 'canceled' bookings
        let nextStatus = bookingData.status;
        if (bookingData.status !== 'canceled') {
            nextStatus = (isDepositPaid || isFullyPaid) ? 'confirmed' : 'pending';
        }

        const bookingUpdates: Record<string, any> = {
            paid_amount: newTotalPaid,
            status: nextStatus,
            updated_at: new Date().toISOString(),
        };

        // If deposit is no longer met, we should ideally clear deposit_confirmed_at, but we'll leave it 
        // as a historical marker or clear it. To be safe/strict, let's nullify it if payment drops below required.
        if (!isDepositPaid && !isFullyPaid) {
            bookingUpdates.deposit_confirmed_at = null;
        }

        console.log(`🚀 [API] Updating Booking with:`, bookingUpdates);
        const { error: updateBookingError } = await supabaseServer
            .from('bookings')
            .update(bookingUpdates)
            .eq('id', bookingId);

        if (updateBookingError) {
            console.error('❌ [API] Error updating booking:', updateBookingError);
            return NextResponse.json({ error: 'Erro ao atualizar total da reserva.' }, { status: 500 });
        }

        // Step 5: Update Pilgrimage Vacancies (Since status could go from confirmed -> pending and free up a spot)
        if (bookingData.pilgrimage_id) {
            const { error: vacancySyncError } = await supabaseServer
                .rpc('recalculate_pilgrimage_vacancies', { p_pilgrimage_id: bookingData.pilgrimage_id });
            if (vacancySyncError) {
                console.error('❌ [API] Error syncing vacancies after payment deletion:', vacancySyncError);
            }
        }

        console.log("🚀 [API] Success!");
        await logAdminAction(user.email, 'DELETE_PAYMENT', { paymentId, bookingId, oldAmount: payment.amount, newTotalPaid }, paymentId);

        return NextResponse.json({ success: true, newTotalPaid });

    } catch (error: any) {
        console.error('❌ [API] Critical error in admin/payments/[...] delete:', error);
        return NextResponse.json({ error: 'Erro interno no servidor: ' + error.message }, { status: 500 });
    }
}
