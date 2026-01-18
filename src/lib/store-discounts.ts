export const MEMBER_DISCOUNT_RATE = 0.05;

type MemberRecord = {
  is_membro?: boolean | null;
  estado_quota?: string | null;
  tipo_subscricao?: string | null;
};

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

export const isActiveMember = (member?: MemberRecord | null) => {
  if (!member?.is_membro) return false;
  const status = (member.estado_quota || '').toLowerCase();
  const tipo = (member.tipo_subscricao || '').toLowerCase();
  const isFounder = tipo.includes('fundador');
  const isPaid = status === 'pago' || status === 'paid' || status === 'ativo';
  return isPaid || isFounder;
};

export const applyMemberDiscount = (price: number, isMember: boolean) => {
  if (!isMember) return price;
  return roundCurrency(price * (1 - MEMBER_DISCOUNT_RATE));
};
