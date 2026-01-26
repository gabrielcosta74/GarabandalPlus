import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { normalizeEmail } from '../../../../lib/normalize';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        if (!supabaseServer) {
            return NextResponse.json({ exists: false });
        }

        const { searchParams } = new URL(req.url);
        const email = normalizeEmail(searchParams.get('email'));

        if (!email || !email.includes('@')) {
            return NextResponse.json({ exists: false });
        }

        // Check if email exists in auth.users
        // Note: This is safe because we only return a boolean, no user data
        const { data, error } = await supabaseServer.auth.admin.getUserByEmail(email);
        if (error) {
            console.error('[check-email-exists] Error:', error);
            return NextResponse.json({ exists: false });
        }

        return NextResponse.json({ exists: !!data?.user });

    } catch (error) {
        console.error('[check-email-exists] Unexpected error:', error);
        return NextResponse.json({ exists: false });
    }
}
