import type { SupabaseClient } from '@supabase/supabase-js';

const STORE_FILES_BUCKET = 'store_files';
const SIGNED_URL_SECONDS = 5 * 60;
const OBJECT_PATH = /^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/;

export const PAID_STORE_ORDER_STATUSES = ['paid', 'pago', 'succeeded'];

export const isPaidStoreOrder = (status?: string | null) =>
  PAID_STORE_ORDER_STATUSES.includes(String(status || ''));

/** Object path inside the store bucket, or null when the address is hosted elsewhere. */
export function storeFilePath(address: string, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  if (!supabaseUrl) return null;
  try {
    const url = new URL(address);
    if (url.host !== new URL(supabaseUrl).host) return null;
    const match = OBJECT_PATH.exec(url.pathname);
    return match && match[1] === STORE_FILES_BUCKET ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
}

/**
 * Where to send a buyer who was already authorised. Files of the store bucket get a
 * short-lived signed link, never their permanent address, so this keeps working once the
 * bucket is private. Addresses the admin hosted elsewhere are returned as they are.
 */
export async function buyerFileUrl(supabase: SupabaseClient, address: string): Promise<string | null> {
  const path = storeFilePath(address);
  if (!path) return /^https?:\/\//i.test(address) ? address : null;

  const { data, error } = await supabase.storage
    .from(STORE_FILES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error('Não foi possível assinar o ficheiro da loja:', error?.message);
    return null;
  }
  return data.signedUrl;
}

const RECENT_ORDER_MS = 60 * 60 * 1000;

/**
 * The payment confirmation is public and only knows the order reference, which is not a
 * secret. Buyer details are therefore shown only right after checkout; later on they are
 * reached through the order email or the library.
 */
export function isRecentStoreOrder(createdAt?: string | null, now = Date.now()): boolean {
  const age = now - new Date(createdAt || '').getTime();
  return age >= 0 && age <= RECENT_ORDER_MS;
}
