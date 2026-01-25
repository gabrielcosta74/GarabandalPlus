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
