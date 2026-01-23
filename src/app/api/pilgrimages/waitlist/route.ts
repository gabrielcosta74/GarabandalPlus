import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export async function POST(req: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { email, full_name, phone, notes, pilgrimage_id } = body;

        if (!email || !full_name || !pilgrimage_id) {
            return NextResponse.json({ error: "Dados em falta" }, { status: 400 });
        }

        // 1. Resolve User (Optional: link if exists)
        const { data: { users } } = await supabaseServer.auth.admin.listUsers();
        const existingUser = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
        const userId = existingUser?.id || null; // Can be null for waitlist if not forced to register

        // 2. Insert into Waitlist
        const { error } = await supabaseServer
            .from('pilgrimage_waitlists')
            .insert({
                pilgrimage_id,
                user_id: userId, // Link if possible
                email,
                full_name,
                phone,
                notes,
                status: 'pending'
            });

        if (error) {
            // Check for unique constraint if I added one (didn't add unique constraint in SQL but good practice)
            console.error("Waitlist Error:", error);
            throw new Error("Erro ao entrar na lista de espera");
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Waitlist API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
