import { supabaseServer } from './supabase';

/**
 * Get a signed URL for a receipt/file in Supabase Storage
 */
export async function getSignedUrl(path: string, bucket: string = 'receipts', expiresIn = 3600): Promise<string | null> {
    if (!supabaseServer) return null;

    try {
        const { data, error } = await supabaseServer
            .storage
            .from(bucket)
            .createSignedUrl(path, expiresIn);

        if (error || !data) {
            console.error('Error creating signed URL:', error);
            return null;
        }

        return data.signedUrl;
    } catch (e) {
        console.error('Exception creating signed URL:', e);
        return null;
    }
}

const RECEIPTS_PUBLIC_MARKER = '/storage/v1/object/public/receipts/';
const RECEIPTS_SIGNED_MARKER = '/storage/v1/object/sign/receipts/';

export function extractReceiptPath(value?: string | null): string | null {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    // Already a bare storage path
    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
        return raw.replace(/^\/+/, '');
    }

    const publicIdx = raw.indexOf(RECEIPTS_PUBLIC_MARKER);
    if (publicIdx !== -1) {
        return decodeURIComponent(raw.slice(publicIdx + RECEIPTS_PUBLIC_MARKER.length));
    }

    const signedIdx = raw.indexOf(RECEIPTS_SIGNED_MARKER);
    if (signedIdx !== -1) {
        const tail = raw.slice(signedIdx + RECEIPTS_SIGNED_MARKER.length);
        const clean = tail.split('?')[0] || '';
        return decodeURIComponent(clean);
    }

    return null;
}

export async function toSignedReceiptUrl(value?: string | null, expiresIn = 3600): Promise<string | null> {
    if (!value) return null;
    const path = extractReceiptPath(value);
    if (!path) return value;
    return getSignedUrl(path, 'receipts', expiresIn);
}

/**
 * Upload a receipt to Supabase Storage
 */
export async function uploadReceipt(
    file: File | Blob,
    path: string,
    bucket: string = 'receipts'
): Promise<{ path: string; error: any }> {
    if (!supabaseServer) return { path: '', error: 'Server config error' };

    const { data, error } = await supabaseServer
        .storage
        .from(bucket)
        .upload(path, file, {
            upsert: true
        });

    return { path: data?.path || '', error };
}
