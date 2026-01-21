import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Create a Supabase client for server-side operations with user context
 * Uses anon key with user's JWT from cookies
 */
export function createSupabaseServerClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const cookieStore = cookies();
    const authToken = cookieStore.get('sb-access-token')?.value ||
        cookieStore.get('supabase-auth-token')?.value;

    return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: authToken ? {
                Authorization: `Bearer ${authToken}`
            } : {}
        }
    });
}

/**
 * Verify user is authenticated and return user or throw
 */
export async function requireAuth() {
    const supabase = createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        throw new Error('Unauthorized');
    }

    return { user, supabase };
}

/**
 * Check if user is admin (using email domain - TODO: replace with RBAC)
 */
export function isAdmin(email?: string): boolean {
    if (!email) return false;
    return email.endsWith('@apostoladodegarabandal.com');
}

/**
 * Verify user owns a booking
 */
export async function verifyBookingOwnership(supabase: any, bookingId: string, userId: string): Promise<boolean> {
    const { data: booking, error } = await supabase
        .from('bookings')
        .select('user_id')
        .eq('id', bookingId)
        .single();

    if (error || !booking) return false;
    return booking.user_id === userId;
}

/**
 * Generate a secure view token for public booking access
 */
export function generateViewToken(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Generate idempotency key
 */
export function generateIdempotencyKey(parts: string[]): string {
    return parts.join('-') + '-' + Date.now();
}
