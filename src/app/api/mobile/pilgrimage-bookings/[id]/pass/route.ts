/* eslint-disable @typescript-eslint/no-explicit-any */
import { ensurePassesForBooking, isBookingFullyPaid } from '../../../../../../lib/pilgrimage-passes';
import { supabaseServer } from '../../../../../../lib/supabase';
import {
  authenticateMobileUser,
  getPublicSiteUrl,
  isSafeUuid,
  mobileError,
  mobileSuccess,
  privateCacheHeaders,
} from '../../../_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateMobileUser(request);
  if (auth.error) return auth.error;
  if (!supabaseServer) {
    return mobileError(503, 'not_configured', 'Serviço temporariamente indisponível.');
  }

  const { id } = await params;
  if (!isSafeUuid(id)) {
    return mobileError(400, 'invalid_request', 'Identificador de inscrição inválido.');
  }
  const { data, error } = await supabaseServer
    .from('bookings')
    .select(`
      id,
      user_id,
      pilgrimage_id,
      status,
      total_amount,
      paid_amount,
      pilgrimage:pilgrimages (id,title,start_date,end_date),
      pilgrims (
        id,
        full_name,
        email,
        phone,
        room_type,
        flight_option,
        allergies,
        dietary_restrictions,
        health_notes,
        notes
      ),
      payments:pilgrimage_payments (id,amount,status)
    `)
    .eq('id', id)
    .eq('user_id', auth.identity.userId)
    .maybeSingle();

  if (error) {
    console.error('[mobile/pilgrimage-bookings/:id/pass] Booking lookup failed:', error);
    return mobileError(502, 'upstream_error', 'Não foi possível carregar o passe.');
  }
  if (!data) return mobileError(404, 'not_found', 'Inscrição não encontrada.');

  const booking = data as Record<string, any>;
  if (['cancelled', 'canceled'].includes(String(booking.status || '').toLowerCase())) {
    return mobileSuccess(
      {
        code: '',
        qrPayload: '',
        valid: false,
        pass: {
          available: false,
          reason: 'cancelled',
          message: 'Esta inscrição foi cancelada.',
          passes: [],
        },
      },
      { headers: privateCacheHeaders },
    );
  }

  if (!isBookingFullyPaid(booking)) {
    return mobileSuccess(
      {
        code: '',
        qrPayload: '',
        valid: false,
        pass: {
          available: false,
          reason: 'payment_pending',
          message: 'O Passe de Peregrino fica disponível quando a inscrição estiver totalmente paga.',
          passes: [],
          paidAmount: Number(booking.paid_amount) || 0,
          totalAmount: Number(booking.total_amount) || 0,
        },
      },
      { headers: privateCacheHeaders },
    );
  }

  try {
    const passes = await ensurePassesForBooking(supabaseServer, booking, getPublicSiteUrl());
    const serializedPasses = passes.map((pass) => ({
      id: pass.id,
      code: pass.token,
      status: pass.status,
      issuedAt: pass.issued_at,
      participant: {
        id: pass.pilgrim.id,
        fullName: pass.pilgrim.full_name,
        email: pass.pilgrim.email ?? null,
        phone: pass.pilgrim.phone ?? null,
        roomType: pass.pilgrim.room_type ?? null,
        flightOption: pass.pilgrim.flight_option ?? null,
        allergies: pass.pilgrim.allergies ?? null,
        dietaryRestrictions: pass.pilgrim.dietary_restrictions ?? null,
        healthNotes: pass.pilgrim.health_notes ?? null,
        notes: pass.pilgrim.notes ?? null,
      },
      qrSvg: pass.qrSvg,
      qrPayload: pass.qrPayload,
    }));
    const primaryPass = serializedPasses[0] ?? null;
    return mobileSuccess(
      {
        code: primaryPass?.code ?? '',
        qrPayload: primaryPass?.qrPayload ?? '',
        valid: Boolean(primaryPass),
        pass: {
          available: true,
          booking: {
            id: booking.id,
            pilgrimageId: booking.pilgrimage_id,
            pilgrimage: booking.pilgrimage,
          },
          passes: serializedPasses,
        },
      },
      { headers: privateCacheHeaders },
    );
  } catch (passError) {
    console.error('[mobile/pilgrimage-bookings/:id/pass] Pass generation failed:', passError);
    return mobileError(502, 'upstream_error', 'Não foi possível gerar o passe.');
  }
}
