import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        if (!supabaseServer) {
            return NextResponse.json({ exists: false });
        }

        const { searchParams } = new URL(req.url);
        const email = searchParams.get('email');

        if (!email || !email.includes('@')) {
            return NextResponse.json({ exists: false });
        }

        // Check if email exists in auth.users
        // Note: This is safe because we only return a boolean, no user data
        const { data, error } = await supabaseServer.auth.admin.listUsers();

        if (error || !data) {
            console.error('[check-email-exists] Error:', error);
            return NextResponse.json({ exists: false });
        }

        const exists = data.users.some(user => user.email === email);

        return NextResponse.json({ exists });

    } catch (error) {
        console.error('[check-email-exists] Unexpected error:', error);
        return NextResponse.json({ exists: false });
    }
}
