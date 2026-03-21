export type PilgrimagePaymentLike = {
  method?: string | null;
  status?: string | null;
  receipt_url?: string | null;
};

const normalize = (value: string | null | undefined) => String(value || '').trim().toLowerCase();

const hasReceipt = (value: string | null | undefined) => String(value || '').trim().length > 0;

export function isReceiptValidationStatus(status: string | null | undefined) {
  const normalized = normalize(status);
  return normalized === 'verifying' || normalized === 'pending_verification';
}

export function isPaymentAwaitingReceiptValidation(payment: PilgrimagePaymentLike) {
  return isReceiptValidationStatus(payment.status) && hasReceipt(payment.receipt_url);
}
