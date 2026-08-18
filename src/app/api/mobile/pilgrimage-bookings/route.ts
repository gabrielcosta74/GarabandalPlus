/* eslint-disable @typescript-eslint/no-explicit-any */
import { POST as createWebBooking } from '../../booking/create/route';
import { GET as getMobileBooking } from './[id]/route';
import { getConfiguredInstallmentDeadline } from '../../../../lib/pilgrimage-installments';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { supabaseServer } from '../../../../lib/supabase';
import {
  MOBILE_BOOKING_PILGRIMAGE_FIELDS,
  serializeBookingSummary,
} from '../_lib/bookings';
import {
  buildInstallmentPlan,
  mapMobileParticipants,
  MobileRegistrationError,
} from '../_lib/registration';
import {
  authenticateMobileUser,
  getBearerToken,
  getMobileLocale,
  isSafeUuid,
  mobileError,
  mobileSuccess,
  privateCacheHeaders,
} from '../_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

const legacyErrorCode = (status: number) => {
  if (status === 401) return 'unauthorized' as const;
  if (status === 404) return 'not_found' as const;
  if (status === 409) return 'conflict' as const;
  if (status === 429) return 'rate_limited' as const;
  if (status >= 500) return 'upstream_error' as const;
  return 'invalid_request' as const;
};

async function legacyError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  const message = typeof payload?.error === 'string' ? payload.error : fallback;
  return mobileError(response.status, legacyErrorCode(response.status), message);
}

export async function GET(request: Request) {
  const auth = await authenticateMobileUser(request);
  if (auth.error) return auth.error;
  if (!supabaseServer) {
    return mobileError(503, 'not_configured', 'Serviço temporariamente indisponível.');
  }

  const locale = getMobileLocale(request);
  const { data, error } = await supabaseServer
    .from('bookings')
    .select(`
      id,
      pilgrimage_id,
      created_at,
      updated_at,
      total_amount,
      paid_amount,
      status,
      notes,
      payment_plan,
      pilgrims (id,birth_date),
      payments:pilgrimage_payments (amount, status, deleted),
      pilgrimage:pilgrimages (
        ${MOBILE_BOOKING_PILGRIMAGE_FIELDS}
      )
    `)
    .eq('user_id', auth.identity.userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[mobile/pilgrimage-bookings] Failed to load bookings:', error);
    return mobileError(502, 'upstream_error', 'Não foi possível carregar as inscrições.');
  }

  const bookings = (data ?? []).map((booking) => serializeBookingSummary(booking, locale));
  return mobileSuccess(
    { bookings },
    { headers: privateCacheHeaders, meta: { count: bookings.length } },
  );
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, {
    keyPrefix: 'mobile-pilgrimage-booking-create',
    windowMs: 60_000,
    max: 10,
  });
  if (!rateLimit.allowed) {
    return mobileError(429, 'rate_limited', 'Demasiadas tentativas. Tenta novamente dentro de instantes.');
  }

  const auth = await authenticateMobileUser(request);
  if (auth.error) return auth.error;
  if (!auth.identity.email) {
    return mobileError(400, 'invalid_request', 'A conta autenticada não tem um email válido.');
  }

  const body = await request.json().catch(() => null) as Record<string, any> | null;
  if (!body) return mobileError(400, 'invalid_request', 'Pedido JSON inválido.');

  const headerKey = request.headers.get('idempotency-key')?.trim() || '';
  const bodyKey = typeof body.idempotencyKey === 'string'
    ? body.idempotencyKey.trim()
    : typeof body.idempotency_key === 'string' ? body.idempotency_key.trim() : '';
  if (headerKey && bodyKey && headerKey !== bodyKey) {
    return mobileError(400, 'invalid_request', 'As chaves de idempotência não coincidem.');
  }
  const idempotencyKey = headerKey || bodyKey;
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    return mobileError(
      400,
      'invalid_request',
      'É obrigatória uma chave Idempotency-Key válida (8 a 128 caracteres).',
    );
  }

  if (body.termsAccepted !== true && body.terms_accepted !== true) {
    return mobileError(400, 'invalid_request', 'É necessário aceitar os termos da inscrição.');
  }

  const pilgrimageId = body.pilgrimageId ?? body.pilgrimage_id;
  if (!isSafeUuid(pilgrimageId)) {
    return mobileError(400, 'invalid_request', 'Identificador de peregrinação inválido.');
  }

  const { data: pilgrimage, error: pilgrimageError } = await supabaseServer!
    .from('pilgrimages')
    .select('id,start_date,deposit_value,pricing_config')
    .eq('id', pilgrimageId)
    .maybeSingle();
  if (pilgrimageError) {
    console.error('[mobile/pilgrimage-bookings] Pilgrimage configuration failed:', pilgrimageError);
    return mobileError(502, 'upstream_error', 'Não foi possível validar a peregrinação.');
  }
  if (!pilgrimage) return mobileError(404, 'not_found', 'Peregrinação não encontrada.');

  const isMobileContract = Array.isArray(body.participants);
  const paymentMethod = body.paymentPlan === 'installments' || body.paymentPlan === 'full'
    ? body.paymentPlan
    : body.payment_method === 'installments' ? 'installments' : 'full';
  let pilgrimData: Array<Record<string, unknown>>;
  let provisionalPlan = body.payment_plan;
  try {
    if (isMobileContract) {
      const pricing = pilgrimage.pricing_config && typeof pilgrimage.pricing_config === 'object'
        ? pilgrimage.pricing_config as Record<string, unknown>
        : {};
      const roomSupplements = pricing.room_supplements && typeof pricing.room_supplements === 'object'
        ? pricing.room_supplements as Record<string, unknown>
        : {};
      pilgrimData = mapMobileParticipants({
        participants: body.participants,
        rooms: body.rooms,
        sessionEmail: auth.identity.email,
        roomSupplements,
      });
      provisionalPlan = buildInstallmentPlan({
        paymentMethod,
        totalAmount: Number(pilgrimage.deposit_value || 0) * pilgrimData.length + 1,
        depositPerParticipant: Number(pilgrimage.deposit_value || 0),
        participants: pilgrimData,
        startDate: pilgrimage.start_date,
        installmentDeadline: getConfiguredInstallmentDeadline(pilgrimage),
        installmentCount: body.installmentCount ?? null,
      });
    } else {
      if (!Array.isArray(body.pilgrim_data) || body.pilgrim_data.length === 0) {
        throw new MobileRegistrationError('Adiciona pelo menos um peregrino.');
      }
      pilgrimData = body.pilgrim_data.map((pilgrim: unknown, index: number) => (
        index === 0 && pilgrim && typeof pilgrim === 'object'
          ? { ...(pilgrim as Record<string, unknown>), email: auth.identity.email }
          : pilgrim as Record<string, unknown>
      ));
    }
  } catch (registrationError) {
    if (registrationError instanceof MobileRegistrationError) {
      return mobileError(400, 'invalid_request', registrationError.message);
    }
    throw registrationError;
  }

  const delegatedBody = {
    ...body,
    email: auth.identity.email,
    pilgrimage_id: pilgrimageId,
    pilgrim_data: pilgrimData,
    payment_method: paymentMethod,
    payment_plan: provisionalPlan,
    terms_accepted: true,
    idempotency_key: idempotencyKey,
  };

  const delegatedHeaders = new Headers(request.headers);
  delegatedHeaders.set('content-type', 'application/json');
  delegatedHeaders.set('authorization', `Bearer ${getBearerToken(request)}`);
  const delegatedRequest = new Request(request.url, {
    method: 'POST',
    headers: delegatedHeaders,
    body: JSON.stringify(delegatedBody),
  });
  const response = await createWebBooking(delegatedRequest);
  if (!response.ok) return legacyError(response, 'Não foi possível criar a inscrição.');

  const result = await response.json() as Record<string, unknown>;
  const bookingId = typeof result.booking_id === 'string' ? result.booking_id : null;
  if (!bookingId) {
    return mobileError(502, 'upstream_error', 'A inscrição foi processada sem um identificador válido.');
  }

  let finalPlan = provisionalPlan;
  if (isMobileContract) {
    const { data: createdBooking, error: createdBookingError } = await supabaseServer!
      .from('bookings')
      .select('id,total_amount')
      .eq('id', bookingId)
      .eq('user_id', auth.identity.userId)
      .maybeSingle();
    if (createdBookingError || !createdBooking) {
      console.error('[mobile/pilgrimage-bookings] Created booking reload failed:', createdBookingError);
      return mobileError(502, 'upstream_error', 'A inscrição foi criada, mas não foi possível finalizar o plano.');
    }
    try {
      finalPlan = buildInstallmentPlan({
        paymentMethod,
        totalAmount: Number(createdBooking.total_amount) || 0,
        depositPerParticipant: Number(pilgrimage.deposit_value || 0),
        participants: pilgrimData,
        startDate: pilgrimage.start_date,
        installmentDeadline: getConfiguredInstallmentDeadline(pilgrimage),
        installmentCount: body.installmentCount ?? null,
      });
    } catch (planError) {
      return mobileError(
        400,
        'invalid_request',
        planError instanceof Error ? planError.message : 'Plano de prestações inválido.',
      );
    }
  }

  const { error: finalizeError } = await supabaseServer!
    .from('bookings')
    .update({
      terms_accepted: true,
      payment_plan: finalPlan,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .eq('user_id', auth.identity.userId);
  if (finalizeError) {
    console.error('[mobile/pilgrimage-bookings] Booking finalization failed:', finalizeError);
    return mobileError(502, 'upstream_error', 'A inscrição foi criada, mas não foi possível finalizar os dados.');
  }

  const detailResponse = await getMobileBooking(request, {
    params: Promise.resolve({ id: bookingId }),
  });
  if (!detailResponse.ok) return detailResponse;
  const detailPayload = await detailResponse.json() as Record<string, any>;
  return mobileSuccess(
    {
      booking: detailPayload.data?.booking,
      nextAction: 'payment',
    },
    {
      status: result.duplicate === true ? 200 : 201,
      headers: privateCacheHeaders,
      meta: { idempotencyKey, duplicate: result.duplicate === true },
    },
  );
}
