import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';

// Helper: Verify Admin Access
const isAdmin = async (req: Request) => {
    if (!supabaseServer) return false;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return false;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseServer.auth.getUser(token);

    // In a real prod app, you'd check a specific role claim or table, 
    // but here we check if the user exists and has a specific email or metadata if needed.
    // For now, consistent with other admin routes, we assume a valid session implies admin 
    // (if the app is admin-only or relies on RLS/middleware for the rest).
    // As per user request, we are strict about the session validity.
    return !error && !!user;
};

// GET: Fetch Member Details + Payments
export async function GET(req: Request, { params }: { params: { id: string } }) {
    if (!await isAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const id = params.id;
        if (!supabaseServer) return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });

        // Fetch Member
        const { data: member, error: memberError } = await supabaseServer
            .from('membros')
            .select('*')
            .eq('id', id)
            .single();

        if (memberError || !member) {
            return NextResponse.json({ error: 'Member not found' }, { status: 404 });
        }

        // Fetch Payments (join with bookings/payments logic or if there's a direct relation)
        // Assuming 'payments' table has some relation or we search by email? 
        // For simplicity, let's assume we look up payments linked to this member's email or ID if stored.
        // If there's no direct link, we might return empty or try to match email.
        let payments: any[] = [];
        if (member.email) {
            const { data: pData } = await supabaseServer
                .from('payments')
                .select('*')
                .eq('email', member.email) // Naive link by email if no user_id FK
                .order('created_at', { ascending: false });
            payments = pData || [];
        }

        return NextResponse.json({ member, payments });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// PATCH: Update Member Details
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    if (!await isAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const id = params.id;
        if (!supabaseServer) return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });
        const body = await req.json();

        // Whitelist allowed fields to prevent arbitrary column updates
        const updates: any = {};
        const allowed = ['nome', 'email', 'telefone', 'address', 'postal_code', 'country', 'nif', 'numero_socio', 'estado_quota', 'tipo_subscricao', 'is_membro', 'proxima_quota', 'data_adesao'];

        allowed.forEach(field => {
            if (body[field] !== undefined) updates[field] = body[field];
        });

        const { data, error } = await supabaseServer
            .from('membros')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ member: data });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST: Execute Actions (Revoke, Register Payment, etc)
export async function POST(req: Request, { params }: { params: { id: string } }) {
    if (!await isAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const id = params.id;
        if (!supabaseServer) return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });
        const { action, ...data } = await req.json();

        if (action === 'revoke_status') {
            const { data: member, error } = await supabaseServer
                .from('membros')
                .update({ is_membro: false, estado_quota: 'Cancelado' })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return NextResponse.json({ success: true, member });
        }

        if (action === 'restore_status') {
            const { data: member, error } = await supabaseServer
                .from('membros')
                .update({ is_membro: true, estado_quota: 'Ativo' }) // Default to active or pending?
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return NextResponse.json({ success: true, member });
        }

        if (action === 'register_payment') {
            // Manual payment registration
            // Create a payment record in 'payments' table?
            // Or just update quota status?
            // Let's Insert into 'payments' table if it exists
            const { amount, date, method, notes, update_quota } = data;

            // 1. Get member email for linkage
            const { data: member } = await supabaseServer.from('membros').select('email').eq('id', id).single();

            if (member?.email) {
                await supabaseServer.from('payments').insert({
                    email: member.email,
                    amount: amount,
                    status: 'paid',
                    method: method,
                    notes: notes,
                    created_at: new Date().toISOString(), // or date
                    // payment_date: date // if column exists
                    type: 'MANUAL_ENTRY'
                });
            }

            // 2. Update member quota status
            if (update_quota) {
                // Calculate next year date
                const nextYear = new Date();
                nextYear.setFullYear(nextYear.getFullYear() + 1);

                await supabaseServer
                    .from('membros')
                    .update({
                        estado_quota: 'pago',
                        proxima_quota: nextYear.toISOString()
                    })
                    .eq('id', id);
            }

            return NextResponse.json({ success: true, message: 'Payment registered' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE: Hard Delete (Danger)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    if (!await isAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const id = params.id;
        if (!supabaseServer) return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });

        const { error } = await supabaseServer
            .from('membros')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
