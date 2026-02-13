import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../../lib/admin-auth';
import { logAdminAction } from '../../../../../../lib/admin-logger';

/**
 * DELETE /api/admin/bookings/[bookingId]
 * 
 * Deletes a booking and all associated data (pilgrims, payments).
 * Protected: Admin only (via middleware/session check).
 */
export async function DELETE(
    req: Request,
    { params }: { params: { bookingId: string } }
) {
    const bookingId = params.bookingId;

    if (!supabaseServer) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    try {
        // 1. Verify Admin Session
        const { authorized, user, error: authError } = await verifyAdmin(req);
        if (!authorized || !user) {
            return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
        }

        const { data: bookingRow, error: bookingError } = await supabaseServer
            .from('bookings')
            .select('id, pilgrimage_id')
            .eq('id', bookingId)
            .maybeSingle();

        if (bookingError) {
            return NextResponse.json({ error: bookingError.message }, { status: 500 });
        }

        // 2. Perform Delete
        // RELIES ON CASCADE DELETE in Postgres for pilgrims and payments
        const { error } = await supabaseServer
            .from('bookings')
            .delete()
            .eq('id', bookingId);

        if (error) {
            console.error('Error deleting booking:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (bookingRow?.pilgrimage_id) {
            const { error: vacancyError } = await supabaseServer.rpc('recalculate_pilgrimage_vacancies', {
                p_pilgrimage_id: bookingRow.pilgrimage_id
            });
            if (vacancyError) {
                console.error('Error recalculating vacancies after booking delete:', vacancyError);
            }
        }

        await logAdminAction(user.email, 'DELETE_BOOKING', {}, bookingId);
        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error('Delete booking error:', err);
        return NextResponse.json(
            { error: err.message || 'Failed to delete booking' },
            { status: 500 }
        );
    }
}
