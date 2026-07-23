import { supabaseServer } from '../../../../lib/supabase';
import {
  authenticateMobileMember,
  mobileError,
  mobileSuccess,
  privateCacheHeaders,
} from '../_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const asAmount = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
};

export async function GET(request: Request) {
  const auth = await authenticateMobileMember(request);
  if (auth.error) return auth.error;
  if (!supabaseServer) {
    return mobileError(503, 'not_configured', 'Serviço temporariamente indisponível.');
  }

  const { data, error } = await supabaseServer
    .from('bookings')
    .select(`
      id,
      pilgrimage_id,
      created_at,
      total_amount,
      paid_amount,
      status,
      payment_plan,
      pilgrimage:pilgrimages (
        id,
        title,
        title_en,
        slug,
        start_date,
        end_date,
        cover_image,
        deposit_value,
        base_price,
        status
      )
    `)
    .eq('user_id', auth.identity.userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[mobile/pilgrimage-bookings] Failed to load member bookings:', error);
    return mobileError(502, 'upstream_error', 'Não foi possível carregar as inscrições.');
  }

  const bookings = (data ?? []).map((booking) => {
    const totalAmount = asAmount(booking.total_amount);
    const paidAmount = Math.min(totalAmount || Number.POSITIVE_INFINITY, asAmount(booking.paid_amount));
    const outstandingAmount = Math.max(0, totalAmount - paidAmount);
    const paymentProgress = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;

    return {
      id: booking.id,
      createdAt: booking.created_at,
      status: booking.status,
      totalAmount,
      paidAmount,
      outstandingAmount,
      paymentProgress,
      paymentPlan: booking.payment_plan ?? null,
      pilgrimage: booking.pilgrimage,
    };
  });

  return mobileSuccess(
    { bookings },
    {
      headers: privateCacheHeaders,
      meta: { count: bookings.length, readOnly: true },
    },
  );
}
