/* eslint-disable @typescript-eslint/no-explicit-any */
import { serializePilgrimage } from './pilgrimages';

type PaymentRecord = {
  amount?: unknown;
  status?: unknown;
  deleted?: unknown;
};

type PaymentPlanItem = {
  date: string;
  amount: number;
};

const SUCCESSFUL_PAYMENT_STATUSES = new Set(['verified', 'succeeded', 'paid', 'manual']);
const VERIFYING_PAYMENT_STATUSES = new Set(['verifying', 'pending_verification']);

export const MOBILE_BOOKING_PILGRIMAGE_FIELDS = `
  id,
  title,
  title_en,
  slug,
  description,
  description_en,
  status,
  start_date,
  end_date,
  cover_image,
  registration_deadline,
  total_vacancies,
  current_vacancies,
  base_price,
  min_deposit,
  deposit_value,
  flight_price_from,
  pricing_config,
  meeting_point_text,
  meeting_point_text_en,
  meeting_end_text,
  meeting_end_text_en,
  flight_departure_time,
  flight_return_time,
  flight_info_text,
  flight_info_text_en,
  group_flight_details,
  group_flight_details_en,
  itinerary_summary,
  itinerary_summary_en,
  payment_plan_text,
  payment_plan_text_en,
  cancellation_policy_text,
  cancellation_policy_text_en,
  included_items,
  included_items_en,
  not_included_items,
  not_included_items_en
`;

export const asAmount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100) / 100) : 0;
};

export const parsePaymentPlan = (value: unknown): PaymentPlanItem[] => {
  let parsed = value;
  for (let depth = 0; depth < 2 && typeof parsed === 'string'; depth += 1) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const date = String((item as Record<string, unknown>).date || '').trim();
    const amount = asAmount((item as Record<string, unknown>).amount);
    if (!date || Number.isNaN(new Date(date).getTime()) || amount <= 0) return [];
    return [{ date, amount }];
  });
};

export function getBookingPaymentSummary(input: {
  totalAmount: unknown;
  paidAmount: unknown;
  depositAmount: unknown;
  paymentPlan: unknown;
  payments?: PaymentRecord[] | null;
  notes?: unknown;
}) {
  const totalAmount = asAmount(input.totalAmount);
  const depositAmount = asAmount(input.depositAmount);
  const payments = Array.isArray(input.payments) ? input.payments : [];
  const confirmedFromPayments = payments
    .filter((payment) => (
      payment?.deleted !== true
      && SUCCESSFUL_PAYMENT_STATUSES.has(String(payment?.status || '').toLowerCase())
    ))
    .reduce((sum, payment) => sum + asAmount(payment.amount), 0);
  const verifyingAmount = payments
    .filter((payment) => (
      payment?.deleted !== true
      && VERIFYING_PAYMENT_STATUSES.has(String(payment?.status || '').toLowerCase())
    ))
    .reduce((sum, payment) => sum + asAmount(payment.amount), 0);
  const paidAmount = Math.max(asAmount(input.paidAmount), asAmount(confirmedFromPayments));
  const outstandingAmount = asAmount(Math.max(0, totalAmount - paidAmount));
  const paymentProgress = totalAmount > 0
    ? Math.min(100, Math.round((paidAmount / totalAmount) * 100))
    : 0;
  const paymentPlan = parsePaymentPlan(input.paymentPlan);
  const notes = String(input.notes || '').toLowerCase();
  const mode = notes.includes('payment plan: full')
    ? 'full'
    : notes.includes('payment plan: installments') || paymentPlan.length > 0
      ? 'installments'
      : 'full';
  const isFullyPaid = totalAmount > 0 && paidAmount + 0.009 >= totalAmount;
  const isDepositPaid = depositAmount <= 0 || paidAmount + 0.009 >= depositAmount;

  let nextPayment: null | {
    kind: 'deposit' | 'installment' | 'balance' | 'full';
    amount: number;
    dueDate: string | null;
    installmentNumber: number | null;
  } = null;

  if (!isFullyPaid && outstandingAmount > 0) {
    if (mode === 'full') {
      nextPayment = {
        kind: paidAmount > 0 ? 'balance' : 'full',
        amount: outstandingAmount,
        dueDate: null,
        installmentNumber: null,
      };
    } else if (!isDepositPaid) {
      nextPayment = {
        kind: 'deposit',
        amount: asAmount(Math.min(outstandingAmount, depositAmount - paidAmount)),
        dueDate: null,
        installmentNumber: null,
      };
    } else {
      const nextIndex = paymentPlan.findIndex((_, index) => {
        const target = depositAmount + paymentPlan
          .slice(0, index + 1)
          .reduce((sum, installment) => sum + installment.amount, 0);
        return paidAmount + 0.009 < target;
      });

      if (nextIndex >= 0) {
        const target = depositAmount + paymentPlan
          .slice(0, nextIndex + 1)
          .reduce((sum, installment) => sum + installment.amount, 0);
        nextPayment = {
          kind: 'installment',
          amount: asAmount(Math.min(outstandingAmount, target - paidAmount)),
          dueDate: paymentPlan[nextIndex].date,
          installmentNumber: nextIndex + 1,
        };
      } else {
        nextPayment = {
          kind: 'balance',
          amount: outstandingAmount,
          dueDate: null,
          installmentNumber: null,
        };
      }
    }
  }

  return {
    totalAmount,
    paidAmount,
    outstandingAmount,
    paymentProgress,
    depositAmount,
    isDepositPaid,
    isFullyPaid,
    verifyingAmount: asAmount(verifyingAmount),
    mode,
    plan: paymentPlan,
    nextPayment,
    canUseCustomAmount: (
      mode === 'installments'
      && isDepositPaid
      && !isFullyPaid
      && verifyingAmount <= 0
      && Boolean(nextPayment?.amount)
    ),
  };
}

export const singleRelation = <T>(value: T | T[] | null | undefined): T | null => (
  Array.isArray(value) ? value[0] ?? null : value ?? null
);

export const getBookingDepositAmount = (
  participants: Array<Record<string, unknown>> | null | undefined,
  depositPerParticipant: unknown,
) => {
  const deposit = asAmount(depositPerParticipant);
  if (deposit <= 0) return 0;
  const chargeableCount = (participants ?? []).filter((participant) => {
    const birthDate = typeof participant.birth_date === 'string'
      ? participant.birth_date
      : typeof participant.birthDate === 'string' ? participant.birthDate : '';
    if (!birthDate) return true;
    const birth = new Date(birthDate);
    if (Number.isNaN(birth.getTime())) return true;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const month = today.getMonth() - birth.getMonth();
    if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
    return age > 2;
  }).length;
  return asAmount(deposit * chargeableCount);
};

const mobileRoomType = (value: unknown) => value === 'quadruple' ? 'family' : String(value || 'double');
const roomMarker = (notes: unknown) => String(notes || '').match(/\[Quarto:\s*([^\]]+)\]/i)?.[1]?.trim() || null;
const cleanParticipantNotes = (notes: unknown) => String(notes || '')
  .replace(/\[Pref\. Cama:.+?\]/gi, '')
  .replace(/\[Modo Partilha:.+?\]/gi, '')
  .replace(/\[Com Quem:.+?\]/gi, '')
  .replace(/\[Quarto:.+?\]/gi, '')
  .trim();

export function serializeParticipants(participants: Array<Record<string, any>>) {
  return participants.map((participant) => ({
    id: participant.id,
    fullName: participant.full_name,
    email: participant.email,
    phone: participant.phone,
    birthDate: participant.birth_date,
    sex: participant.sex,
    address: participant.address,
    postalCode: participant.postal_code,
    city: participant.city,
    country: participant.country,
    taxId: participant.cpf_nif,
    roomType: mobileRoomType(participant.room_type),
    flightOption: participant.flight_option,
    flightPolicyAcknowledged: true,
    allergies: participant.allergies,
    dietaryRestrictions: participant.dietary_restrictions,
    healthNotes: participant.health_notes,
    notes: cleanParticipantNotes(participant.notes),
  }));
}

export function reconstructRooms(participants: Array<Record<string, any>>) {
  const groups = new Map<string, Array<Record<string, any>>>();
  participants.forEach((participant, index) => {
    const marker = roomMarker(participant.notes);
    const fallback = participant.room_type === 'single'
      ? `single-${participant.id || index}`
      : `${participant.room_type || 'double'}-${participant.roommate_name || participant.id || index}`;
    const key = marker || fallback;
    groups.set(key, [...(groups.get(key) ?? []), participant]);
  });

  return [...groups.entries()].map(([id, occupants]) => {
    const first = occupants[0] ?? {};
    const sharing = String(first.sharing_mode || '').toLowerCase();
    return {
      id,
      type: mobileRoomType(first.room_type),
      occupantIds: occupants.map((occupant) => String(occupant.id)).filter(Boolean),
      bedPreference: ['double_bed', 'twin_beds'].includes(first.bed_preference)
        ? first.bed_preference
        : null,
      sharingMode: sharing === 'random'
        ? 'random'
        : sharing === 'partner' ? 'partner' : sharing ? 'household' : null,
      roommateName: String(first.roommate_name || ''),
    };
  });
}

export function serializeBookingSummary(booking: Record<string, any>, locale: 'pt' | 'en' = 'pt') {
  const pilgrimage = singleRelation(booking.pilgrimage) as Record<string, any> | null;
  const participants = Array.isArray(booking.pilgrims) ? booking.pilgrims : [];
  const depositAmount = getBookingDepositAmount(participants, pilgrimage?.deposit_value);
  const summary = getBookingPaymentSummary({
    totalAmount: booking.total_amount,
    paidAmount: booking.paid_amount,
    depositAmount,
    paymentPlan: booking.payment_plan,
    payments: booking.payments,
    notes: booking.notes,
  });

  return {
    id: booking.id,
    pilgrimageId: booking.pilgrimage_id,
    createdAt: booking.created_at,
    updatedAt: booking.updated_at ?? null,
    status: booking.status,
    totalAmount: summary.totalAmount,
    paidAmount: summary.paidAmount,
    outstandingAmount: summary.outstandingAmount,
    pilgrimsCount: participants.length,
    paymentPlan: summary.mode,
    nextPaymentAmount: summary.nextPayment?.amount ?? null,
    nextPaymentDate: summary.nextPayment?.dueDate ?? null,
    passAvailable: summary.isFullyPaid && !['cancelled', 'canceled'].includes(String(booking.status || '').toLowerCase()),
    payment: summary,
    pilgrimage: pilgrimage ? serializePilgrimage(pilgrimage, locale) : null,
  };
}
