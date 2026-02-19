/**
 * Booking API Integration with Auto-Login
 * 
 * This file provides utilities for creating bookings and automatically
 * logging in users so they can immediately upload receipts.
 */

import { Session } from '@supabase/supabase-js';
import { supabaseBrowser } from './supabase-browser';

export interface BookingResponse {
    success: boolean;
    booking_id: string;
    view_token: string;
    user_id: string;
    new_account: boolean;
    session: Session | null;
    user: {
        id: string;
        email: string;
    };
}

export interface BookingFormData {
    email: string;
    pilgrim_data: any[];
    pilgrimage_id: string;
    payment_method: string;
    payment_plan?: string;
    room_distribution?: any;
    idempotency_key?: string;
    installment_count?: number;
    terms_accepted?: boolean;
}

/**
 * Create a booking and return the response with session
 */
export async function createBooking(formData: BookingFormData): Promise<BookingResponse> {
    const { data: sessionData } = await supabaseBrowser?.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    const response = await fetch('/api/booking/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(formData),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create booking');
    }

    return response.json();
}

/**
 * Handle booking creation with automatic session setup
 * 
 * Usage in booking form component:
 * 
 * ```typescript
 * import { handleBookingWithAutoLogin } from '@/lib/booking-api';
 * import { useAuth } from '@/contexts/AuthContext';
 * 
 * const { setSession } = useAuth();
 * 
 * const onSubmit = async (formData) => {
 *   try {
 *     const result = await handleBookingWithAutoLogin(formData, setSession);
 *     
 *     // User is now authenticated if session was provided
 *     // Redirect to payment/success page
 *     router.push(`/peregrinacoes/inscricao/${result.booking_id}`);
 *   } catch (error) {
 *     // Handle error
 *   }
 * };
 * ```
 */
export async function handleBookingWithAutoLogin(
    formData: BookingFormData,
    setSession: (session: Session | null) => Promise<void>
): Promise<BookingResponse> {
    // Create booking
    const result = await createBooking(formData);

    // If session was returned (new user), set it for auto-login
    if (result.session) {
        console.log('✅ [Booking] Auto-login session received, setting session...');
        try {
            // CRITICAL: Wait for session to be set before redirecting
            await setSession(result.session);
            console.log('✅ [Booking] User is now authenticated');
        } catch (err) {
            console.error('❌ [Booking] Failed to set session:', err);
            // Continue anyway - user can use magic link
        }
    } else {
        console.log('ℹ️ [Booking] No session returned (existing user), using existing session or magic link');
    }

    return result;
}

/**
 * Check if user is authenticated before allowing receipt upload
 */
export function requireAuth(isAuthenticated: boolean): void {
    if (!isAuthenticated) {
        throw new Error('Por favor, aceda através do link no seu email para fazer upload do comprovativo.');
    }
}
