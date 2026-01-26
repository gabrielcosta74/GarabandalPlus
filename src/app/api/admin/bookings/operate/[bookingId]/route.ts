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

        return NextResponse.json({ success: true });

        await logAdminAction(user.email, 'DELETE_BOOKING', {}, bookingId);

    } catch (err: any) {
        console.error('Delete booking error:', err);
        return NextResponse.json(
            { error: err.message || 'Failed to delete booking' },
            { status: 500 }
        );
    }
}
