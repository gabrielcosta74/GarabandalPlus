export type PilgrimageInstallment = {
  date: string;
  amount: number;
};

export type OutstandingInstallment = {
  index: number;
  amountDue: number;
  remainingAmounts: number[];
};

export type InstallmentAmountChoice = {
  count: number | null;
  amount: number;
};

export type InstallmentPaymentState = 'paid' | 'verifying' | 'pending';

const toCents = (value: unknown): number => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
};

const fromCents = (value: number): number => value / 100;

export function getInstallmentPaymentState({
  index,
  paidAmount,
  pendingAmount = 0,
  depositValue,
  paymentPlan,
}: {
  index: number;
  paidAmount: number;
  pendingAmount?: number;
  depositValue: number;
  paymentPlan: PilgrimageInstallment[];
}): InstallmentPaymentState {
  const targetCents = toCents(depositValue) + paymentPlan
    .slice(0, index + 1)
    .reduce((sum, installment) => sum + toCents(installment.amount), 0);
  const paidCents = toCents(paidAmount);

  if (paidCents >= targetCents) return 'paid';
  if (paidCents + toCents(pendingAmount) >= targetCents) return 'verifying';
  return 'pending';
}

/**
 * Finds the first installment that is not covered by confirmed or validating
 * payments. All comparisons happen in integer cents so a settled installment
 * can never become pending because of binary floating-point noise.
 */
export function resolveOutstandingInstallment({
  paidAmount,
  pendingAmount = 0,
  depositValue,
  paymentPlan,
}: {
  paidAmount: number;
  pendingAmount?: number;
  depositValue: number;
  paymentPlan: PilgrimageInstallment[];
}): OutstandingInstallment | null {
  const paidCents = toCents(paidAmount);
  const coveredCents = paidCents + toCents(pendingAmount);
  let cumulativeTargetCents = toCents(depositValue);

  for (let index = 0; index < paymentPlan.length; index += 1) {
    cumulativeTargetCents += toCents(paymentPlan[index].amount);
    if (coveredCents >= cumulativeTargetCents) continue;

    const amountDueCents = Math.max(0, cumulativeTargetCents - paidCents);
    const remainingAmounts = [
      fromCents(amountDueCents),
      ...paymentPlan
        .slice(index + 1)
        .map((installment) => fromCents(toCents(installment.amount)))
        .filter((amount) => amount > 0),
    ];

    return {
      index,
      amountDue: fromCents(amountDueCents),
      remainingAmounts,
    };
  }

  return null;
}

/**
 * Builds the quick choices from the actual remaining installment values.
 * This preserves a differently-sized final installment instead of multiplying
 * the next amount and potentially leaving a few cents unpaid.
 */
export function buildInstallmentAmountChoices({
  remainingAmounts,
  maxAmount,
  maxNumberedChoices = 3,
}: {
  remainingAmounts: number[];
  maxAmount: number;
  maxNumberedChoices?: number;
}): InstallmentAmountChoice[] {
  const maxCents = toCents(maxAmount);
  if (maxCents <= 0) return [];

  const choices: InstallmentAmountChoice[] = [];
  let cumulativeCents = 0;

  for (
    let index = 0;
    index < remainingAmounts.length && index < maxNumberedChoices;
    index += 1
  ) {
    cumulativeCents += toCents(remainingAmounts[index]);
    const choiceCents = Math.min(cumulativeCents, maxCents);
    if (choiceCents <= 0) continue;

    choices.push({
      count: index + 1,
      amount: fromCents(choiceCents),
    });

    if (choiceCents >= maxCents) break;
  }

  choices.push({ count: null, amount: fromCents(maxCents) });

  const seenAmounts = new Set<number>();
  return choices.filter((choice) => {
    const amountCents = toCents(choice.amount);
    if (seenAmounts.has(amountCents)) return false;
    seenAmounts.add(amountCents);
    return true;
  });
}
