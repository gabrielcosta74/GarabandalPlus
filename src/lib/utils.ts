import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"


export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

const getCivilDateParts = (value?: string | null) => {
    if (!value) return null;
    const match = value.match(CIVIL_DATE_PATTERN);
    if (!match) return null;

    const [, year, month, day] = match;
    return {
        year: Number(year),
        month: Number(month),
        day: Number(day),
    };
};

export const getCivilDateInputValue = (value?: string | null) => {
    const parts = getCivilDateParts(value);
    if (!parts) return '';

    const month = String(parts.month).padStart(2, '0');
    const day = String(parts.day).padStart(2, '0');
    return `${parts.year}-${month}-${day}`;
};

export const parseCivilDate = (value?: string | null) => {
    const parts = getCivilDateParts(value);
    if (!parts) return new Date(Number.NaN);

    // Use local noon so formatting never slips to the previous/next day across timezones.
    return new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0);
};

export const getCivilDateTimestamp = (value?: string | null) => {
    const date = parseCivilDate(value);
    return date.getTime();
};

export const serializeCivilDateForStorage = (value?: string | null) => {
    const input = getCivilDateInputValue(value);
    if (!input) return null;
    return `${input}T00:00:00+00:00`;
};

export const todayCivilTimestamp = (now: Date = new Date()) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0).getTime();

export const getPublicAvailabilityLabel = (remainingSpots: number, locale: 'pt' | 'en' = 'pt') => {
    if (remainingSpots <= 10) {
        if (locale === 'en') {
            return `${remainingSpots} ${remainingSpots === 1 ? 'Spot' : 'Spots'}`;
        }

        return `${remainingSpots} ${remainingSpots === 1 ? 'Vaga' : 'Vagas'}`;
    }

    if (locale === 'en') {
        return 'Limited Spots';
    }

    return 'Vagas Limitadas';
};

export const parseRoomInfo = (notes?: string) => {
    if (!notes) return { bedType: null, sharingMode: null, roommates: null, cleanNotes: '' };

    const bedTypeMatch = notes.match(/\[Pref\. Cama:\s*(.+?)\]/);
    const sharingModeMatch = notes.match(/\[Modo Partilha:\s*(.+?)\]/);
    const roommatesMatch = notes.match(/\[Com Quem:\s*(.+?)\]/);

    // Remove the extracted info from notes to get clean user notes
    let cleanNotes = notes
        .replace(/\[Pref\. Cama:.+?\]/g, '')
        .replace(/\[Modo Partilha:.+?\]/g, '')
        .replace(/\[Com Quem:.+?\]/g, '')
        .replace(/\[Quarto:.+?\]/g, '')
        .trim();

    return {
        bedType: bedTypeMatch ? bedTypeMatch[1].trim() : null,
        sharingMode: sharingModeMatch ? sharingModeMatch[1].trim() : null,
        roommates: roommatesMatch ? roommatesMatch[1].trim() : null,
        cleanNotes: cleanNotes || null
    };
};

// ============================================
// 💰 INSTALLMENT PAYMENT TRACKING SYSTEM
// ============================================

export interface InstallmentStatus {
    label: string;              // "Sinal de Inscrição", "Prestação 1", etc.
    expectedAmount: number;     // Valor esperado desta prestação
    paidAmount: number;         // Valor já pago para esta prestação
    remainingAmount: number;    // Valor em falta
    status: 'paid' | 'partial' | 'pending';
    dueDate?: string;           // Data de vencimento (ISO string)
    percentage: number;         // Percentagem paga (0-100)
    payments: Array<{          // Pagamentos alocados a esta prestação
        id: string;
        amount: number;
        date: string;
        method: string;
    }>;
}

export interface Payment {
    id: string;
    amount: number;
    status: string;
    method: string;
    created_at: string;
    notes?: string;
    receipt_url?: string | null;
}

/**
 * Calcula o status de cada prestação usando algoritmo "Waterfall"
 * 
 * Lógica:
 * 1. Ordena pagamentos por data (mais antigos primeiro)
 * 2. Aloca pagamentos sequencialmente: Sinal → Prestação 1 → Prestação 2 → ...
 * 3. Se pagamento exceder prestação, overflow vai para próxima
 * 4. Suporta pagamentos parciais
 * 
 * @param totalPaid - Total já pago (booking.paid_amount)
 * @param depositValue - Valor do sinal
 * @param paymentPlan - Array de prestações [{date, amount}]
 * @param payments - Array de pagamentos verificados
 * @returns Array com status de cada prestação
 */
export function calculateInstallmentStatus(
    totalPaid: number,
    depositValue: number,
    paymentPlan: Array<{ date: string; amount: number }> = [],
    payments: Payment[] = []
): InstallmentStatus[] {
    const installments: InstallmentStatus[] = [];

    // Sort payments by date (oldest first) for waterfall allocation
    const sortedPayments = [...payments]
        .filter(p => {
            const status = p.status?.toLowerCase();
            return status === 'verified' || status === 'succeeded' || status === 'paid' || status === 'manual';
        })
        .map(p => ({
            ...p,
            amount: Number(p.amount) || 0
        }))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let paymentQueue = [...sortedPayments];

    // Helper to allocate payments to an installment
    const allocateToInstallment = (expectedAmount: number): {
        paidAmount: number;
        allocatedPayments: Array<{ id: string; amount: number; date: string; method: string }>;
    } => {
        let paidAmount = 0;
        const allocatedPayments: Array<{ id: string; amount: number; date: string; method: string }> = [];

        while (paymentQueue.length > 0 && paidAmount < expectedAmount) {
            const payment = paymentQueue[0];
            const amountNeeded = expectedAmount - paidAmount;
            const amountToAllocate = Math.min(payment.amount, amountNeeded);

            allocatedPayments.push({
                id: payment.id,
                amount: amountToAllocate,
                date: payment.created_at,
                method: payment.method
            });

            paidAmount += amountToAllocate;

            // If payment is fully consumed, remove from queue
            if (amountToAllocate >= payment.amount) {
                paymentQueue.shift();
            } else {
                // Partial payment consumed, update remaining amount
                paymentQueue[0] = {
                    ...payment,
                    amount: payment.amount - amountToAllocate
                };
            }
        }

        return { paidAmount, allocatedPayments };
    };

    // 1. Allocate to Deposit (Sinal)
    const depositAllocation = allocateToInstallment(depositValue);
    installments.push({
        label: 'Sinal de Inscrição',
        expectedAmount: depositValue,
        paidAmount: depositAllocation.paidAmount,
        remainingAmount: Math.max(0, depositValue - depositAllocation.paidAmount),
        status: depositAllocation.paidAmount >= depositValue ? 'paid' :
            depositAllocation.paidAmount > 0 ? 'partial' : 'pending',
        percentage: Math.min(100, (depositAllocation.paidAmount / depositValue) * 100),
        payments: depositAllocation.allocatedPayments
    });

    // 2. Allocate to Installments
    paymentPlan.forEach((installment, idx) => {
        const allocation = allocateToInstallment(installment.amount);
        installments.push({
            label: `Prestação ${idx + 1}`,
            expectedAmount: installment.amount,
            paidAmount: allocation.paidAmount,
            remainingAmount: Math.max(0, installment.amount - allocation.paidAmount),
            status: allocation.paidAmount >= installment.amount ? 'paid' :
                allocation.paidAmount > 0 ? 'partial' : 'pending',
            dueDate: installment.date,
            percentage: Math.min(100, (allocation.paidAmount / installment.amount) * 100),
            payments: allocation.allocatedPayments
        });
    });

    return installments;
}

/**
 * Valida integridade financeira do sistema
 * 
 * Verifica:
 * 1. paid_amount = soma de todos os pagamentos verificados
 * 2. Soma das alocações = paid_amount
 * 3. Nenhuma prestação excede valor esperado (com tolerância de 0.01€)
 * 
 * @returns { valid: boolean, errors: string[] }
 */
export function validateFinancialIntegrity(
    paidAmount: number,
    payments: Payment[],
    installments: InstallmentStatus[]
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const TOLERANCE = 0.01; // 1 cent tolerance for rounding

    // Rule 1: paid_amount = SUM(verified payments)
    const verifiedPaymentsSum = payments
        .filter(p => p.status === 'verified' || p.status === 'succeeded')
        .reduce((sum, p) => sum + p.amount, 0);

    if (Math.abs(paidAmount - verifiedPaymentsSum) > TOLERANCE) {
        errors.push(
            `Inconsistência: paid_amount (${paidAmount}€) ≠ soma de pagamentos verificados (${verifiedPaymentsSum}€)`
        );
    }

    // Rule 2: SUM(installments.paidAmount) = paid_amount
    const allocatedSum = installments.reduce((sum, inst) => sum + inst.paidAmount, 0);
    if (Math.abs(allocatedSum - paidAmount) > TOLERANCE) {
        errors.push(
            `Inconsistência: soma alocada (${allocatedSum}€) ≠ paid_amount (${paidAmount}€)`
        );
    }

    // Rule 3: No installment exceeds expected amount (with tolerance)
    installments.forEach(inst => {
        if (inst.paidAmount > inst.expectedAmount + TOLERANCE) {
            errors.push(
                `${inst.label}: valor pago (${inst.paidAmount}€) excede esperado (${inst.expectedAmount}€)`
            );
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
}
