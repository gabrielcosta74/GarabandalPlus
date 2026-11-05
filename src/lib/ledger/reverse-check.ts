import { addDays } from './invoice-safety';

/*
 * The reverse of reconciliation: every bank-transfer payment marked as paid on
 * the site must have money behind it. A movement can only justify one payment.
 */

/** 90% of transfers are registered within this many days of reaching the bank. */
export const GRACE_DAYS = 7;
/** The money reaches the bank before the admin registers it; allow a late bank line too. */
const DAYS_BEFORE = 30;
const DAYS_AFTER = 3;

export type CheckedPayment = { id: string; amount: number; paidOn: string; linked: boolean };
export type AvailableMovement = { id: string; amount: number; bookingDate: string };
export type PaymentState = 'linked' | 'candidate' | 'waiting' | 'missing';

const cents = (value: number) => Math.round(value * 100);

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

/**
 * `bankReadUntil` is the latest day the bank has shown us. Ages count from it,
 * so a stale bank read can never raise a false "money is missing" alarm.
 */
export function checkPaymentsAgainstBank(
  payments: CheckedPayment[],
  movements: AvailableMovement[],
  bankReadUntil: string,
): Map<string, PaymentState> {
  const states = new Map<string, PaymentState>();
  const claimed = new Set<string>();
  const ordered = [...payments].sort((a, b) => a.paidOn.localeCompare(b.paidOn));

  for (const payment of ordered) {
    if (payment.linked) {
      states.set(payment.id, 'linked');
      continue;
    }
    const earliest = addDays(payment.paidOn, -DAYS_BEFORE);
    const latest = addDays(payment.paidOn, DAYS_AFTER);
    const match = movements
      .filter(movement => !claimed.has(movement.id)
        && cents(movement.amount) === cents(payment.amount)
        && movement.bookingDate >= earliest
        && movement.bookingDate <= latest)
      .sort((a, b) => a.bookingDate.localeCompare(b.bookingDate))[0];
    if (match) {
      claimed.add(match.id);
      states.set(payment.id, 'candidate');
    } else {
      states.set(payment.id, daysBetween(payment.paidOn, bankReadUntil) >= GRACE_DAYS ? 'missing' : 'waiting');
    }
  }
  return states;
}
