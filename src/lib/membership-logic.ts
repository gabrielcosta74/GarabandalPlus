/**
 * Core Membership Logic (Pure Functions)
 * Extracted for testing purposes.
 */

// 1. Calculate Next Quota Date
// Rule: payment on any date counts until Jan 31 of the NEXT year (relative to payment date year).
export const calculateNextQuotaDate = (paymentDate: Date = new Date()) => {
    const paymentYear = paymentDate.getUTCFullYear();
    return new Date(Date.UTC(paymentYear + 1, 0, 31));
};

// 2. Calculate Expiration Date (1 day after quota date?)
export const calculateExpirationDate = (quotaDate: Date) => {
    const expiration = new Date(quotaDate);
    expiration.setDate(quotaDate.getDate() + 1);
    return expiration;
};

// 3. Days Between (UTC)
const DAY_MS = 24 * 60 * 60 * 1000;
export const daysBetweenUtc = (from: Date, to: Date) => {
    // Normalize to midnight UTC
    const utcFrom = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()));
    const utcTo = new Date(Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()));
    const diff = utcTo.getTime() - utcFrom.getTime();
    return Math.round(diff / DAY_MS);
};

// 4. Status Determination
export const determineMemberStatus = (
    currentStatus: string | null,
    nextQuotaDate: string | null,
    isPaid: boolean,
    now: Date = new Date()
) => {
    const status = (currentStatus || '').toLowerCase();

    // If explicitly revoked/expired/paid, respect it (unless calculating transitions)
    if (status === 'revogado') return 'revogado';
    if (status === 'expirado') return 'expirado';
    // Wait, the Cron job updates these. We want to test the TRANSITION logic here.

    if (!nextQuotaDate) return status || 'pendente';

    const dueDate = new Date(nextQuotaDate);
    const diff = daysBetweenUtc(now, dueDate);

    // No grace period: any day past due => expired.
    if (isPaid) return 'pago';
    if (diff < 0) return 'expirado';
    return status || 'pendente';
};
