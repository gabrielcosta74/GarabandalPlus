export type InstallmentDeadlineSource = {
    pricing_config?: {
        installment_deadline?: unknown;
    } | null;
};

type Installment = {
    date: Date;
    amount: number;
};

const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const roundToTwo = (value: number) => Math.round(value * 100) / 100;

const parseCivilDate = (value: string): Date | null => {
    const civilDate = value.slice(0, 10);
    if (!CIVIL_DATE_PATTERN.test(civilDate)) return null;
    const [year, month, day] = civilDate.split('-').map(Number);
    const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (
        parsed.getFullYear() !== year
        || parsed.getMonth() !== month - 1
        || parsed.getDate() !== day
    ) {
        return null;
    }
    return parsed;
};

export const getConfiguredInstallmentDeadline = (
    pilgrimage: InstallmentDeadlineSource | null | undefined,
): string | null => {
    const value = pilgrimage?.pricing_config?.installment_deadline;
    if (typeof value !== 'string' || !parseCivilDate(value)) return null;
    return value;
};

const resolveDeadline = (startDate: string, configuredDeadline?: string | null) => {
    const explicitDeadline = configuredDeadline ? parseCivilDate(configuredDeadline) : null;
    if (explicitDeadline) {
        return { deadline: explicitDeadline, isExplicit: true };
    }

    const pilgrimageStart = parseCivilDate(startDate);
    if (!pilgrimageStart) return null;
    pilgrimageStart.setMonth(pilgrimageStart.getMonth() - 1);
    return { deadline: pilgrimageStart, isExplicit: false };
};

const buildAvailableDates = (
    startDate: string,
    configuredDeadline?: string | null,
    now: Date = new Date(),
) => {
    const resolved = resolveDeadline(startDate, configuredDeadline);
    if (!resolved) return [];

    const current = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        10,
        12,
        0,
        0,
        0,
    );
    const dates: Date[] = [];

    while (current < resolved.deadline) {
        dates.push(new Date(current));
        current.setMonth(current.getMonth() + 1);
    }

    if (resolved.isExplicit && resolved.deadline > now) {
        const lastDate = dates.at(-1);
        if (!lastDate || lastDate.getTime() !== resolved.deadline.getTime()) {
            dates.push(new Date(resolved.deadline));
        }
    }

    return dates;
};

export const getMaxInstallments = (
    startDate: string,
    configuredDeadline?: string | null,
    now: Date = new Date(),
) => Math.max(1, buildAvailableDates(startDate, configuredDeadline, now).length);

export const calculateInstallments = (
    totalBalance: number,
    startDate: string,
    desiredCount?: number,
    configuredDeadline?: string | null,
    now: Date = new Date(),
): Installment[] => {
    if (totalBalance <= 0) return [];

    const resolved = resolveDeadline(startDate, configuredDeadline);
    if (!resolved) return [];

    const availableDates = buildAvailableDates(startDate, configuredDeadline, now);
    const maximumCount = Math.max(1, availableDates.length);
    const actualCount = desiredCount
        ? Math.max(1, Math.min(desiredCount, maximumCount))
        : maximumCount;
    const selectedDates = actualCount === 1
        ? [resolved.deadline]
        : availableDates.slice(0, actualCount);
    const perInstallment = roundToTwo(totalBalance / actualCount);
    let remaining = roundToTwo(totalBalance);

    return selectedDates.map((date, index) => {
        const amount = index === selectedDates.length - 1
            ? roundToTwo(remaining)
            : perInstallment;
        remaining = roundToTwo(remaining - amount);
        return { date, amount };
    });
};

export const isPaymentPlanWithinDeadline = (
    paymentPlan: unknown,
    configuredDeadline: string,
): boolean => {
    const deadline = parseCivilDate(configuredDeadline);
    if (!deadline) return false;
    deadline.setHours(23, 59, 59, 999);

    let parsed = paymentPlan;
    for (let depth = 0; depth < 2 && typeof parsed === 'string'; depth += 1) {
        try {
            parsed = JSON.parse(parsed);
        } catch {
            return false;
        }
    }

    if (!Array.isArray(parsed) || parsed.length === 0) return false;
    return parsed.every(item => {
        const date = new Date((item as { date?: unknown })?.date as string);
        return !Number.isNaN(date.getTime()) && date <= deadline;
    });
};
