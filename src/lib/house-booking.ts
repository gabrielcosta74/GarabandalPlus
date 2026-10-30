import { supabaseBrowser } from './supabase-browser';

export type HouseStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled';
export type HouseBooking = {
  id: string; checkIn: string; checkOut: string; guests: number; status: HouseStatus;
  teamMessage: string | null; wantsToDonate: boolean; contactName: string;
  contactPhone: string; contactEmail: string; notes: string | null; companions: string[];
};
export type HouseOverview = {
  enabled: boolean; maxGuests: number; maxNights: number; minMemberYears: number;
  horizonDays: number; rulesContentId: string | null; rulesTitle: string | null;
  rulesVersion: number; rulesPt: string[]; rulesEn: string[]; seniorityOk: boolean;
  bookings: HouseBooking[];
};
export type HouseRange = { startsOn: string; endsOn: string };
export type HouseErrorCode = 'member_only' | 'closed' | 'invalid_code' | 'seniority' |
  'invalid_guests' | 'invalid_contact' | 'invalid_dates' | 'rules_changed' |
  'rules_not_accepted' | 'already_booked' | 'dates_taken' | 'cannot_cancel' | 'generic';

export class HouseError extends Error {
  constructor(public code: HouseErrorCode) { super(code); }
}

const errorCodes: HouseErrorCode[] = ['member_only', 'closed', 'invalid_code', 'seniority',
  'invalid_guests', 'invalid_contact', 'invalid_dates', 'rules_changed', 'rules_not_accepted',
  'already_booked', 'dates_taken', 'cannot_cancel'];
const str = (value: unknown) => typeof value === 'string' ? value : null;
const lines = (value: unknown) => (str(value) ?? '').split('\n').map(line => line.trim()).filter(Boolean);

function fail(message: string): never {
  throw new HouseError(errorCodes.find(code => message.includes(`house_${code}`)) ?? 'generic');
}

function booking(value: unknown): HouseBooking | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (!str(row.id) || !str(row.checkIn) || !str(row.checkOut) ||
    !['pending', 'confirmed', 'declined', 'cancelled'].includes(String(row.status))) return null;
  return {
    id: String(row.id), checkIn: String(row.checkIn), checkOut: String(row.checkOut),
    guests: Number(row.guests) || 1, status: row.status as HouseStatus,
    teamMessage: str(row.teamMessage), wantsToDonate: row.wantsToDonate === true,
    contactName: str(row.contactName) ?? '', contactPhone: str(row.contactPhone) ?? '',
    contactEmail: str(row.contactEmail) ?? '', notes: str(row.notes),
    companions: Array.isArray(row.companions) ? row.companions.filter((name): name is string => typeof name === 'string') : [],
  };
}

export async function getHouseOverview(): Promise<HouseOverview> {
  const { data, error } = await supabaseBrowser.rpc('house_overview');
  if (error) fail(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    enabled: row.enabled !== false, maxGuests: Number(row.maxGuests) || 6,
    maxNights: Number(row.maxNights) || 7, minMemberYears: Number(row.minMemberYears) || 0,
    horizonDays: Number(row.horizonDays) || 365, rulesContentId: str(row.rulesContentId),
    rulesTitle: str(row.rulesTitle), rulesVersion: Number(row.rulesVersion) || 1,
    rulesPt: lines(row.rulesPt), rulesEn: lines(row.rulesEn), seniorityOk: row.seniorityOk === true,
    bookings: Array.isArray(row.bookings) ? row.bookings.map(booking).filter((item): item is HouseBooking => !!item) : [],
  };
}

export type CodeReason = 'invalid' | 'not_yours' | 'revoked' | 'expired' | 'seniority' | 'rate_limited';
export async function verifyHouseCode(code: string): Promise<{ ok: true } | { ok: false; reason: CodeReason }> {
  const { data, error } = await supabaseBrowser.rpc('house_verify_training_code', { p_code: code });
  if (error) fail(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.ok === true) return { ok: true };
  const reasons: CodeReason[] = ['invalid', 'not_yours', 'revoked', 'expired', 'seniority', 'rate_limited'];
  return { ok: false, reason: reasons.find(reason => reason === row.reason) ?? 'invalid' };
}

export async function getHouseAvailability(from: string, to: string): Promise<HouseRange[]> {
  const { data, error } = await supabaseBrowser.rpc('house_availability', { p_from: from, p_to: to });
  if (error) fail(error.message);
  return (Array.isArray(data) ? data : []).flatMap((value: unknown) => {
    const row = value as Record<string, unknown>;
    return str(row.starts_on) && str(row.ends_on)
      ? [{ startsOn: String(row.starts_on), endsOn: String(row.ends_on) }] : [];
  });
}

export type NewHouseBooking = {
  code: string; checkIn: string; checkOut: string; guests: number; contactName: string;
  contactPhone: string; contactEmail: string; companions: string[]; notes: string;
  rulesVersion: number; acceptRules: boolean; acceptDamages: boolean;
  wantsToDonate: boolean; idempotencyKey: string;
};
export async function createHouseBooking(input: NewHouseBooking): Promise<string> {
  const { data, error } = await supabaseBrowser.rpc('house_create_booking', {
    p_code: input.code, p_check_in: input.checkIn, p_check_out: input.checkOut,
    p_guests: input.guests, p_contact_name: input.contactName,
    p_contact_phone: input.contactPhone, p_contact_email: input.contactEmail,
    p_companions: input.companions, p_notes: input.notes, p_rules_version: input.rulesVersion,
    p_accept_rules: input.acceptRules, p_accept_damages: input.acceptDamages,
    p_wants_to_donate: input.wantsToDonate, p_idempotency_key: input.idempotencyKey,
  });
  if (error) fail(error.message);
  if (typeof data !== 'string') throw new HouseError('generic');
  return data;
}

export async function cancelHouseBooking(id: string): Promise<void> {
  const { error } = await supabaseBrowser.rpc('house_cancel_booking', { p_id: id });
  if (error) fail(error.message);
}

export const isActiveHouseBooking = (booking: HouseBooking, today: string) =>
  (booking.status === 'pending' || booking.status === 'confirmed') && booking.checkOut > today;
