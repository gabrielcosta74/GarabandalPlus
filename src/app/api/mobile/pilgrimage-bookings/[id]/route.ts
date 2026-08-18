/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadPilgrimageBillingProfile } from '../../../../../lib/pilgrimage-billing';
import { UNIFIED_ONLINE_PAYMENT_OPTIONS } from '../../../../../lib/payment-options';
import { toSignedReceiptUrl } from '../../../../../lib/receipt-utils';
import { supabaseServer } from '../../../../../lib/supabase';
import { WHATSAPP_NUMBER } from '../../../../../lib/chat-config';
import {
  getBookingDepositAmount,
  getBookingPaymentSummary,
  MOBILE_BOOKING_PILGRIMAGE_FIELDS,
  reconstructRooms,
  serializeBookingSummary,
  serializeParticipants,
  singleRelation,
} from '../../_lib/bookings';
import {
  authenticateMobileUser,
  getMobileLocale,
  isSafeUuid,
  mobileError,
  mobileSuccess,
  privateCacheHeaders,
} from '../../_lib/server';

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

  const locale = getMobileLocale(request);
  const { data, error } = await supabaseServer
    .from('bookings')
    .select(`
      id,
      user_id,
      pilgrimage_id,
      created_at,
      updated_at,
      total_amount,
      paid_amount,
      status,
      notes,
      payment_plan,
      pilgrimage:pilgrimages (
        ${MOBILE_BOOKING_PILGRIMAGE_FIELDS}
      ),
      pilgrims (
        id,
        full_name,
        email,
        phone,
        birth_date,
        sex,
        address,
        postal_code,
        city,
        country,
        cpf_nif,
        room_type,
        bed_preference,
        sharing_mode,
        roommate_name,
        flight_option,
        allergies,
        dietary_restrictions,
        health_notes,
        notes,
        created_at
      ),
      payments:pilgrimage_payments (
        id,
        amount,
        method,
        status,
        created_at,
        verified_at,
        notes,
        external_reference,
        processing_fee_amount,
        charged_amount,
        receipt_url,
        deleted
      )
    `)
    .eq('id', id)
    .eq('user_id', auth.identity.userId)
    .maybeSingle();

  if (error) {
    console.error('[mobile/pilgrimage-bookings/:id] Failed to load booking:', error);
    return mobileError(502, 'upstream_error', 'Não foi possível carregar a inscrição.');
  }
  if (!data) return mobileError(404, 'not_found', 'Inscrição não encontrada.');

  const booking = data as Record<string, any>;
  const pilgrimage = singleRelation(booking.pilgrimage) as Record<string, any> | null;
  const participants = Array.isArray(booking.pilgrims) ? booking.pilgrims : [];
  const payments = Array.isArray(booking.payments)
    ? booking.payments.filter((payment: Record<string, unknown>) => payment.deleted !== true)
    : [];
  const paymentIds = payments
    .map((payment: Record<string, unknown>) => payment.id)
    .filter((paymentId: unknown): paymentId is string => typeof paymentId === 'string');

  const [itineraryResult, fiscalResult, billingProfile] = await Promise.all([
    supabaseServer
      .from('pilgrimage_itinerary_items')
      .select('id,day_number,title,title_en,description,description_en,image_url,display_order')
      .eq('pilgrimage_id', booking.pilgrimage_id)
      .order('day_number', { ascending: true })
      .order('display_order', { ascending: true }),
    paymentIds.length > 0
      ? supabaseServer
        .from('factpt_documents')
        .select('source_id,status,factpt_number,issued_at,email_sent_at,created_at')
        .eq('source_type', 'pilgrimage')
        .in('source_id', paymentIds)
        .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    loadPilgrimageBillingProfile(supabaseServer, {
      id: String(booking.id),
      user_id: String(booking.user_id),
      pilgrims: Array.isArray(booking.pilgrims) ? booking.pilgrims : [],
    }).catch((billingError) => {
      console.error('[mobile/pilgrimage-bookings/:id] Billing profile failed:', billingError);
      return null;
    }),
  ]);

  if (itineraryResult.error) {
    console.error('[mobile/pilgrimage-bookings/:id] Itinerary failed:', itineraryResult.error);
  }
  if (fiscalResult.error) {
    console.error('[mobile/pilgrimage-bookings/:id] Fiscal status failed:', fiscalResult.error);
  }

  const fiscalByPayment = new Map<string, Record<string, unknown>>();
  for (const document of fiscalResult.data ?? []) {
    if (!fiscalByPayment.has(document.source_id)) fiscalByPayment.set(document.source_id, document);
  }

  const safePayments = await Promise.all(payments.map(async (payment: Record<string, any>) => ({
    id: payment.id,
    amount: Number(payment.amount) || 0,
    processingFeeAmount: Number(payment.processing_fee_amount) || 0,
    chargedAmount: Number(payment.charged_amount) || Number(payment.amount) || 0,
    method: payment.method,
    status: payment.status,
    createdAt: payment.created_at,
    verifiedAt: payment.verified_at ?? null,
    notes: payment.notes ?? null,
    externalReference: payment.external_reference ?? null,
    receiptUrl: payment.receipt_url ? await toSignedReceiptUrl(payment.receipt_url, 3600) : null,
    fiscalDocument: fiscalByPayment.has(payment.id) ? {
      status: fiscalByPayment.get(payment.id)?.status ?? null,
      number: fiscalByPayment.get(payment.id)?.factpt_number ?? null,
      issuedAt: fiscalByPayment.get(payment.id)?.issued_at ?? null,
      emailSentAt: fiscalByPayment.get(payment.id)?.email_sent_at ?? null,
    } : null,
  })));

  const payment = getBookingPaymentSummary({
    totalAmount: booking.total_amount,
    paidAmount: booking.paid_amount,
    depositAmount: getBookingDepositAmount(participants, pilgrimage?.deposit_value),
    paymentPlan: booking.payment_plan,
    payments,
    notes: booking.notes,
  });
  const summary = serializeBookingSummary(booking, locale);
  const meetingPoints = [
    locale === 'en' ? pilgrimage?.meeting_point_text_en || pilgrimage?.meeting_point_text : pilgrimage?.meeting_point_text,
    locale === 'en' ? pilgrimage?.meeting_end_text_en || pilgrimage?.meeting_end_text : pilgrimage?.meeting_end_text,
  ].filter((point): point is string => typeof point === 'string' && point.trim().length > 0);

  return mobileSuccess(
    {
      booking: {
        ...summary,
        notes: booking.notes ?? null,
        payment,
        payments: safePayments,
        participants: serializeParticipants(participants),
        rooms: reconstructRooms(participants),
        billingProfile,
        meetingPoints,
        supportPhone: `+${WHATSAPP_NUMBER}`,
        passAvailable: summary.passAvailable,
        itinerary: (itineraryResult.data ?? []).map((item) => ({
          id: item.id,
          dayNumber: item.day_number,
          title: locale === 'en' ? item.title_en || item.title : item.title,
          description: locale === 'en' ? item.description_en || item.description : item.description,
          imageUrl: item.image_url,
          displayOrder: item.display_order,
        })),
        paymentOptions: UNIFIED_ONLINE_PAYMENT_OPTIONS
          .filter((option) => option.provider === 'reduniq')
          .map(({ id: optionId, label, description, provider }) => ({
            id: optionId,
            label,
            description,
            provider,
          })),
      },
    },
    { headers: privateCacheHeaders, meta: { locale } },
  );
}
