import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../lib/admin-auth';
import { logAdminAction } from '../../../../../lib/admin-logger';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ pilgrimageId: string }> }
) {
  const { pilgrimageId } = await params;

  if (!supabaseServer) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  try {
    const { authorized, user, error: authError } = await verifyAdmin(req);
    if (!authorized || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    // Delete dependencies first to avoid FK violations.
    const tablesToClean = [
      { table: 'pilgrimage_itinerary_items', column: 'pilgrimage_id' },
      { table: 'pilgrimage_stages', column: 'pilgrimage_id' },
      { table: 'pilgrimage_team_members', column: 'pilgrimage_id' },
      { table: 'booking_leads', column: 'pilgrimage_id' },
      { table: 'pilgrimage_waitlists', column: 'pilgrimage_id' },
      { table: 'installment_plans', column: 'pilgrimage_id' },
    ];

    for (const item of tablesToClean) {
      const { error } = await supabaseServer
        .from(item.table)
        .delete()
        .eq(item.column, pilgrimageId);

      if (error) {
        return NextResponse.json(
          { error: `Failed cleaning ${item.table}: ${error.message}` },
          { status: 500 }
        );
      }
    }

    // Bookings have child tables.
    const { data: bookings, error: bookingsError } = await supabaseServer
      .from('bookings')
      .select('id')
      .eq('pilgrimage_id', pilgrimageId);

    if (bookingsError) {
      return NextResponse.json({ error: bookingsError.message }, { status: 500 });
    }

    const bookingIds = (bookings || []).map((b: any) => b.id).filter(Boolean);
    if (bookingIds.length > 0) {
      const { error: pilgrimsError } = await supabaseServer
        .from('pilgrims')
        .delete()
        .in('booking_id', bookingIds);
      if (pilgrimsError) {
        return NextResponse.json({ error: pilgrimsError.message }, { status: 500 });
      }

      const { error: paymentsError } = await supabaseServer
        .from('pilgrimage_payments')
        .delete()
        .in('booking_id', bookingIds);
      if (paymentsError) {
        return NextResponse.json({ error: paymentsError.message }, { status: 500 });
      }
    }

    const { error: bookingsDeleteError } = await supabaseServer
      .from('bookings')
      .delete()
      .eq('pilgrimage_id', pilgrimageId);

    if (bookingsDeleteError) {
      return NextResponse.json({ error: bookingsDeleteError.message }, { status: 500 });
    }

    const { error: pilgrimageDeleteError } = await supabaseServer
      .from('pilgrimages')
      .delete()
      .eq('id', pilgrimageId);

    if (pilgrimageDeleteError) {
      return NextResponse.json({ error: pilgrimageDeleteError.message }, { status: 500 });
    }

    await logAdminAction(user.email, 'DELETE_PILGRIMAGE', {}, pilgrimageId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to delete pilgrimage' },
      { status: 500 }
    );
  }
}
