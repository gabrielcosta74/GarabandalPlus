export type QuotaStatus = 'pendente' | 'pago' | 'expirado' | 'revogado';

const normalizeRaw = (value?: string | null) =>
  (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/^['"`]+|['"`]+$/g, '');

export const normalizeQuotaStatus = (value?: string | null): QuotaStatus | null => {
  const raw = normalizeRaw(value);
  if (!raw) return null;
  if (['pago', 'paid', 'ativo', 'active'].includes(raw)) return 'pago';
  if (['pendente', 'pending', 'pend'].includes(raw)) return 'pendente';
  if (['expirado', 'expired', 'overdue', 'em_atraso', 'em atraso', 'atrasado'].includes(raw)) return 'expirado';
  if (['revogado', 'cancelado', 'canceled', 'cancelled', 'suspenso', 'suspended'].includes(raw)) return 'revogado';
  return null;
};

export const isPaidStatus = (value?: string | null) => normalizeQuotaStatus(value) === 'pago';
export const isRevokedStatus = (value?: string | null) => normalizeQuotaStatus(value) === 'revogado';
