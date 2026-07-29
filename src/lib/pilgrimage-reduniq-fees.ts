export const REDUNIQ_PILGRIMAGE_FEE_RATE = 0.019;

const roundCurrency = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

export type PilgrimagePaymentKind = 'deposit' | 'installment' | 'full' | 'balance';

export const resolvePilgrimagePaymentKind = (
  priceType: 'deposit' | 'full',
  paidAmount: number,
  depositAmount: number,
): PilgrimagePaymentKind => {
  const paid = roundCurrency(paidAmount);
  const deposit = roundCurrency(depositAmount);

  if (priceType === 'full') return paid > 0 ? 'balance' : 'full';
  return deposit > 0 && paid >= deposit ? 'installment' : 'deposit';
};

export const calculatePilgrimageReduniqCharge = (baseAmount: number) => {
  const normalizedBaseAmount = roundCurrency(baseAmount);
  const feeAmount = roundCurrency(normalizedBaseAmount * REDUNIQ_PILGRIMAGE_FEE_RATE);
  const chargedAmount = roundCurrency(normalizedBaseAmount + feeAmount);

  return {
    baseAmount: normalizedBaseAmount,
    feeAmount,
    chargedAmount,
    feeRate: REDUNIQ_PILGRIMAGE_FEE_RATE,
  };
};

export const buildPilgrimageReduniqFeeNote = (baseAmount: number) => {
  const { feeAmount, chargedAmount } = calculatePilgrimageReduniqCharge(baseAmount);

  return [
    'Pagamento via Reduniq',
    `Valor base: ${baseAmount.toFixed(2)}€`,
    `Taxa Reduniq: ${feeAmount.toFixed(2)}€`,
    `Total cobrado: ${chargedAmount.toFixed(2)}€`,
  ].join(' | ');
};
