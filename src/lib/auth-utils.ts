import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import type { CookieOptions } from '@supabase/ssr';

/**
 * Create a Supabase client for server-side operations with user context
 * Uses anon key with user's JWT from cookies OR Auth Header
 */
export async function createSupabaseServerClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const cookieStore = await cookies();
    const headersList = await headers();

    const authHeader = headersList.get('authorization');
    const authToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    return createServerClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        },
        cookies: {
            getAll() {
                return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
            },
            setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
                cookiesToSet.forEach(({ name, value, options }) => {
                    cookieStore.set(name, value, options);
                });
            },
        },
    });
}

/**
 * Verify user is authenticated and return user or throw
 */
export async function requireAuth() {
    const supabase = await createSupabaseServerClient();

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        throw new Error('Unauthorized');
    }

    return { user, supabase };
}

// SECURITY: Strict Admin List
const ADMIN_EMAILS = [
    'gabrielcosta74@gmail.com', // Replace/Add actual admin emails
    'geral@apostoladodegarabandal.com',

];

export async function verifyAdmin() {
    const { user } = await requireAuth();

    // Check Email Allowlist
    if (!user.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        console.error(`🚨 [Admin Block] Unauthorized access attempt by ${user.email}`);
        throw new Error('Forbidden: Not an Admin');
    }

    return { user };
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
    // Deterministic key based on content to prevent double-submission
    // e.g. userId-pilgrimageId-amount
    return parts.join('_').replace(/[^a-zA-Z0-9-_]/g, '');
}
