import { getBrowserAccessToken } from '../../../../lib/supabase-browser';

export type Address = { name: string; address: string };
export type Group = { id: string; label: string; description: string; count: number };
export type Contact = { name: string | null; email: string; tag: string };
export type FileDraft = { filename: string; contentType: string; content: string; size: number };

export type Draft = {
    mode: 'single' | 'group';
    to: Address[];
    cc: Address[];
    bcc: Address[];
    subject: string;
    html: string;
    /** Mensagem original (respostas/reencaminhar): vai por baixo da assinatura, fora do editor. */
    quote?: string;
    /** Dentro do cartão do Apostolado. */
    branded?: boolean;
    groupId?: string;
    files?: FileDraft[];
    inReplyTo?: string | null;
    references?: string[];
    answered?: { folder: string; uid: number } | null;
};

export class NotConfigured extends Error {}
export class SessionExpired extends Error {}

export const accessToken = () => getBrowserAccessToken().catch(() => { throw new SessionExpired(); });

export async function api(params: Record<string, string | number>, init?: { body: unknown }) {
    const token = await accessToken();
    const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    const res = await fetch(`/api/admin/mailbox${init ? '' : `?${query}`}`, {
        method: init ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${token}`, ...(init ? { 'Content-Type': 'application/json' } : {}) },
        body: init ? JSON.stringify(init.body) : undefined,
        cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (data?.notConfigured) throw new NotConfigured(data.error);
    if (res.status === 401) throw new SessionExpired();
    if (!res.ok) throw new Error(data?.error || 'Falha no pedido.');
    return data;
}

export const post = (body: unknown) => api({}, { body });

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Falha no pedido.');

export const fullAddress = (a: Address) => (a.name ? `${a.name} <${a.address}>` : a.address);
export const headerAddress = (a: Address) => (a.name ? `"${a.name.replace(/["\\]/g, '')}" <${a.address}>` : a.address);
export const isValidEmail = (value: string) => /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/.test(value);

export const formatSize = (bytes: number) =>
    (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

const AVATAR_COLORS = ['#0f4c81', '#7c3aed', '#0e7490', '#b45309', '#be185d', '#15803d', '#4338ca', '#9f1239'];
export const initials = (a?: Partial<Address>) => {
    const base = (a?.name || a?.address || '?').replace(/["']/g, '').trim();
    const parts = base.split(/[\s.@_-]+/).filter(Boolean);
    return ((parts[0]?.[0] || '?') + (parts.length > 1 && a?.name ? parts[parts.length - 1][0] : '')).toUpperCase();
};
export const avatarColor = (a?: Partial<Address>) => {
    const key = a?.address || '';
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};
