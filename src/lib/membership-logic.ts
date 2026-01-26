/**
 * Core Membership Logic (Pure Functions)
 * Extracted for testing purposes.
 */

// 1. Calculate Next Quota Date
export const calculateNextQuotaDate = (currentDueDate?: string | null, referenceDate: Date = new Date()) => {
    if (currentDueDate) {
        const currentDue = new Date(currentDueDate);
        // Always Jan 31st of the NEXT year relative to the current due date (annual renewal)
        return new Date(Date.UTC(currentDue.getFullYear() + 1, 0, 31));
    }

    const currentYear = referenceDate.getFullYear();
    const jan31CurrentYear = new Date(Date.UTC(currentYear, 0, 31));

    // Simplified Rule: If paying quota now, it's for the current year, valid until Jan 31st of NEXT year.
    // regardless of whether we are in Jan or Dec.
    return new Date(Date.UTC(currentYear + 1, 0, 31));
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

    // Logic from Cron:
    // if diff < 0 && !paid && !revoked -> atrasado
    // if diff <= -31 && !paid && !revoked -> expirado

    if (isPaid) return 'pago';

    if (diff <= -31) return 'expirado';
    if (diff < 0) return 'atrasado';

    return status; // Unchanged (e.g. 'pendente' or 'pago' becoming 'atrasado'?)
};
