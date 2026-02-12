import { normalizeQuotaStatus } from './membership-status';

export const MEMBER_DISCOUNT_RATE = 0.05;

type MemberRecord = {
  is_membro?: boolean | null;
  estado_quota?: string | null;
  tipo_subscricao?: string | null;
  proxima_quota?: string | null;
};

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

export const isActiveMember = (member?: MemberRecord | null) => {
  if (!member) return false;
  const status = normalizeQuotaStatus(member.estado_quota);
  const tipo = (member.tipo_subscricao || '').toLowerCase();
  const isFounder = tipo.includes('fundador');
  if (isFounder) return true;
  if (!member?.is_membro) return false;
  const isPaid = status === 'pago';
  if (!isPaid) return false;

  if (!member.proxima_quota) return true;
  const dueDate = new Date(member.proxima_quota);
  if (Number.isNaN(dueDate.getTime())) return true;

  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const dueUtc = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  return todayUtc <= dueUtc;
};

export const applyMemberDiscount = (price: number, isMember: boolean) => {
  if (!isMember) return price;
  return roundCurrency(price * (1 - MEMBER_DISCOUNT_RATE));
};
