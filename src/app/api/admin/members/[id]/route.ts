import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';

import { verifyAdmin } from '../../../../../lib/admin-auth';
import { logAdminAction } from '../../../../../lib/admin-logger';

// GET: Fetch Member Details + Payments
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const { authorized, error } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
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
    const { authorized, user, error: authError } = await verifyAdmin(req);
    if (!authorized || !user) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    try {
        const id = params.id;
        if (!supabaseServer) return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });
        const body = await req.json();

        // Whitelist allowed fields to prevent arbitrary column updates
        const updates: any = {};
        // The original 'allowed' array already includes all the fields mentioned in the instruction.
        // The instruction seems to imply adding them, but they are already present.
        // The provided "Code Edit" block replaces the 'allowed' array and forEach loop
        // with individual if statements, which is a different implementation style.
        // I will implement the change by replacing the 'allowed' array and forEach loop
        // with the provided if statements, ensuring all fields from the original 'allowed'
        // array are covered, and correcting any syntax issues.

        // Original allowed fields:
        // ['nome', 'email', 'telefone', 'address', 'postal_code', 'country', 'nif', 'numero_socio', 'estado_quota', 'tipo_subscricao', 'is_membro', 'proxima_quota', 'data_adesao'];

        // Applying the structure from the provided "Code Edit"
        if (body.estado_quota !== undefined) updates.estado_quota = body.estado_quota;
        if (body.proxima_quota !== undefined) updates.proxima_quota = body.proxima_quota;
        if (body.tipo_subscricao !== undefined) updates.tipo_subscricao = body.tipo_subscricao;
        if (body.numero_socio !== undefined) updates.numero_socio = body.numero_socio;
        if (body.is_membro !== undefined) updates.is_membro = body.is_membro;
        if (body.data_adesao !== undefined) updates.data_adesao = body.data_adesao;
        if (body.email !== undefined) updates.email = body.email; // Ensure email is also covered

        // Personal Data Updates (as per instruction and provided code edit)
        if (body.nome !== undefined) updates.nome = body.nome;
        if (body.nif !== undefined) updates.nif = body.nif;
        if (body.telefone !== undefined) updates.telefone = body.telefone;
        if (body.address !== undefined) updates.address = body.address;
        if (body.postal_code !== undefined) updates.postal_code = body.postal_code;
        if (body.country !== undefined) updates.country = body.country;

        const { data, error } = await supabaseServer
            .from('membros')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Log Action
        await logAdminAction(user.email, 'UPDATE_MEMBER', { updates }, id);

        return NextResponse.json({ member: data });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST: Execute Actions (Revoke, Register Payment, etc)
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const { authorized, user, error: authError } = await verifyAdmin(req);
    if (!authorized || !user) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
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
                // Rule: Quota covers current year, valid until Jan 31st of Next Year.
                const today = new Date();
                const nextYear = today.getFullYear() + 1;
                // Deadline: Jan 31st of Next Year
                const nextQuotaDate = new Date(Date.UTC(nextYear, 0, 31));

                await supabaseServer
                    .from('membros')
                    .update({
                        estado_quota: 'pago',
                        proxima_quota: nextQuotaDate.toISOString().slice(0, 10)
                    })
                    .eq('id', id);
            }

            return NextResponse.json({ success: true, message: 'Payment registered' });

            await logAdminAction(user.email, 'REGISTER_PAYMENT', { amount, method, notes, update_quota }, id);
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE: Hard Delete (Danger)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const { authorized, user, error: authError } = await verifyAdmin(req);
    if (!authorized || !user) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    try {
        const id = params.id;
        if (!supabaseServer) return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });

        const { error } = await supabaseServer
            .from('membros')
            .delete()
            .eq('id', id);

        if (error) throw error;
        await logAdminAction(user.email, 'DELETE_MEMBER', {}, id);

        return NextResponse.json({ success: true });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
