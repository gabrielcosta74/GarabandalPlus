// Shared client-side helper for the "Estou mesmo interessado em ir" flow.
// Fire-and-forget: records a soft demand signal, then the caller opens WhatsApp.

import { getAnalyticsRequestContext } from './analytics';

const ANON_KEY = 'interest:anon-id';

// Stable per-browser id so repeated taps dedupe server-side.
export function getInterestAnonId(): string {
    if (typeof window === 'undefined') return '';
    try {
        let id = window.localStorage.getItem(ANON_KEY);
        if (!id) {
            id = typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            window.localStorage.setItem(ANON_KEY, id);
        }
        return id;
    } catch {
        return '';
    }
}

export type InterestPayload = {
    source: 'chat_interest' | 'pilgrimage_page_interest';
    pilgrimageId?: string;
    pilgrimageTitle?: string;
    sessionId?: string;
    name?: string;
    email?: string;
    phone?: string;
    locale?: 'pt' | 'en';
};

export function captureInterest(payload: InterestPayload) {
    try {
        fetch('/api/leads/interest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ anonId: getInterestAnonId(), ...payload, analytics: getAnalyticsRequestContext() }),
        }).catch(() => { /* non-critical */ });
    } catch { /* non-critical */ }
}
