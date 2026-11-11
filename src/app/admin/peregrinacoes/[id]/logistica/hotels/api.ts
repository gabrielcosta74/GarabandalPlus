"use client";

import { supabaseBrowser } from '../../../../../../lib/supabase-browser';

/** Fetch autenticado do admin. Lança Error com a mensagem do servidor. */
export async function adminCall<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    if (!supabaseBrowser) throw new Error('A ligação à área administrativa não está disponível.');
    const { data } = await supabaseBrowser.auth.getSession();
    const token = data.session?.access_token;
    const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
    const res = await fetch(path, {
        ...init,
        cache: 'no-store',
        headers: {
            ...(isForm ? {} : { 'Content-Type': 'application/json' }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(init.headers || {}),
        },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as { error?: string })?.error || 'Não foi possível gravar.');
    return body as T;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

/** Todas as escritas dos hotéis num sítio. */
export function hotelApi(pilgrimageId: string) {
    const base = `/api/admin/logistics/${pilgrimageId}`;
    const stay = (stayId: string) => `${base}/stays/${stayId}`;
    return {
        createStay: (values: Record<string, unknown>) => adminCall<{ id: string }>(`${base}/stays`, json('POST', values)),
        patchStay: (id: string, values: Record<string, unknown>) => adminCall(`${base}/stays`, json('PATCH', { id, ...values })),
        deleteStay: (id: string) => adminCall(`${base}/stays?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
        mergeStays: (keepId: string, dropId: string) => adminCall(`${base}/stays/merge`, json('POST', { keepId, dropId })),

        addLines: (stayId: string, lines: Record<string, unknown>[]) => adminCall(`${stay(stayId)}/lines`, json('POST', { lines })),
        patchLine: (stayId: string, id: string, values: Record<string, unknown>) => adminCall(`${stay(stayId)}/lines`, json('PATCH', { id, ...values })),
        deleteLine: (stayId: string, id: string) => adminCall(`${stay(stayId)}/lines?lineId=${encodeURIComponent(id)}`, { method: 'DELETE' }),

        addInstallment: (stayId: string, values: Record<string, unknown>) => adminCall(`${stay(stayId)}/installments`, json('POST', values)),
        /** Várias prestações de uma vez, tal como vêm na proforma. */
        addInstallments: (stayId: string, items: { label: string; dueDate: string; amount: number }[]) =>
            adminCall(`${stay(stayId)}/installments`, json('POST', { items })),
        patchInstallment: (stayId: string, id: string, values: Record<string, unknown>) =>
            adminCall(`${stay(stayId)}/installments`, json('PATCH', { id, ...values })),
        deleteInstallment: (stayId: string, id: string) =>
            adminCall(`${stay(stayId)}/installments?installmentId=${encodeURIComponent(id)}`, { method: 'DELETE' }),

        addQuote: (values: Record<string, unknown>) => adminCall(`${base}/quotes`, json('POST', values)),
        patchQuote: (id: string, values: Record<string, unknown>) => adminCall(`${base}/quotes`, json('PATCH', { id, ...values })),
        deleteQuote: (id: string) => adminCall(`${base}/quotes?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
    };
}

export type AgreementDetail = {
    agreement: {
        id: string; supplier: string; description: string | null; total: number; paidOutsideBank: number;
        paidByBank: number; paid: number; remaining: number; hasProforma: boolean; hasFinalInvoice: boolean;
        logisticsKey: string | null; status: 'open' | 'cancelled';
    };
    payments: { id: string; booking_date: string; amount: number; description_raw: string | null }[];
    documents: { id: string; fileName: string | null; kind: string; onAgreement: boolean; url: string | null }[];
};

export type PaymentCandidateView = {
    id: string; bookingDate: string; amount: number; description: string; counterparty: string | null; reason: string | null;
};

/** O acordo vive na Contabilidade; os Hotéis usam as mesmas rotas. */
export const agreementApi = {
    get: (id: string) => adminCall<AgreementDetail>(`/api/admin/contabilidade/acordos/${id}`),
    create: (values: { pilgrimageId: string; supplier: string; totalAmount: number; hotelStayId: string }) =>
        adminCall<{ id: string }>('/api/admin/contabilidade/acordos', json('POST', values)),
    update: (id: string, values: Record<string, unknown>) => adminCall(`/api/admin/contabilidade/acordos/${id}`, json('PATCH', values)),
    candidates: (id: string) => adminCall<{ candidates: PaymentCandidateView[] }>(`/api/admin/contabilidade/acordos/${id}/candidatos`),
    /** Liga um débito do banco ao acordo; a BD atualiza o pago do hotel. */
    linkPayment: (movementId: string, agreementId: string) =>
        adminCall(`/api/admin/contabilidade/movimentos/${movementId}/acordo`, json('POST', { agreementId })),
    unlinkPayment: (movementId: string) => adminCall(`/api/admin/contabilidade/movimentos/${movementId}/acordo`, { method: 'DELETE' }),
    attach: (id: string, file: File, kind: 'proforma' | 'fatura') => {
        const form = new FormData();
        form.append('file', file);
        form.append('kind', kind);
        return adminCall(`/api/admin/contabilidade/acordos/${id}/documentos`, { method: 'POST', body: form });
    },
};
