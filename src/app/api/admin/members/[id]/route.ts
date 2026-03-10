import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { calculateNextQuotaDate } from '../../../../../lib/membership-logic';
import { normalizeQuotaStatus } from '../../../../../lib/membership-status';
import { sendMemberDiplomaEmail, sendMemberReceiptEmail } from '../../../../../lib/email';
import { generateMemberDiplomaPdf } from '../../../../../lib/member-diploma';

import { verifyAdmin } from '../../../../../lib/admin-auth';
import { logAdminAction } from '../../../../../lib/admin-logger';

const INTERNAL_EMAIL_SUFFIX = '@sem-email.local';

const normalizePaymentType = (value?: unknown) => {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'donation' || raw === 'doacao' || raw === 'doação') return 'donation';
    return 'quota';
};

const inferPaymentTypeFromNotes = (notes?: string | null) => {
    const text = (notes || '').toUpperCase();
    if (text.includes('[TYPE:DONATION]') || text.includes('[DOAÇÃO]') || text.includes('[DOACAO]')) {
        return 'donation';
    }
    if (text.includes('[TYPE:QUOTA]')) return 'quota';
    return 'quota';
};

const isMissingNotesColumnError = (error: any) =>
    String(error?.message || '').toLowerCase().includes('pagamentos_quotas.notes') &&
    String(error?.message || '').toLowerCase().includes('does not exist');

// GET: Fetch Member Details + Payments
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { authorized, error } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
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

        let payments: any[] = [];
        const { data: pData, error: paymentsError } = await supabaseServer
            .from('pagamentos_quotas')
            .select('*')
            .eq('user_id', id)
            .order('data_pagamento', { ascending: false });
        if (paymentsError) throw paymentsError;
        payments = (pData || []).map((payment: any) => {
            const notes = String(payment?.notes || '').toUpperCase();
            const payment_type =
                notes.includes('[TYPE:DONATION]') || notes.includes('[DOAÇÃO]') || notes.includes('[DOACAO]')
                    ? 'donation'
                    : 'quota';
            return { ...payment, payment_type };
        });

        return NextResponse.json({ member, payments });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// PATCH: Update Member Details
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { authorized, user, error: authError } = await verifyAdmin(req);
    if (!authorized || !user) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        if (!supabaseServer) return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });
        const body = await req.json();
        const { data: currentMember } = await supabaseServer
            .from('membros')
            .select('is_membro, estado_quota, numero_socio')
            .eq('id', id)
            .single();

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
        if (body.estado_quota !== undefined) {
            const normalized = normalizeQuotaStatus(body.estado_quota);
            updates.estado_quota = normalized ?? String(body.estado_quota).trim().toLowerCase();
        }
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

        const nextIsMember = updates.is_membro ?? currentMember?.is_membro ?? false;
        const nextQuotaStatus = normalizeQuotaStatus(updates.estado_quota ?? currentMember?.estado_quota);
        if (!nextIsMember && nextQuotaStatus === 'pendente' && updates.numero_socio !== undefined && updates.numero_socio !== null) {
            return NextResponse.json({
                error: 'Não é permitido atribuir número de sócio a um registo pendente/não membro.'
            }, { status: 400 });
        }

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
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { authorized, user, error: authError } = await verifyAdmin(req);
    if (!authorized || !user) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        if (!supabaseServer) return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });
        const { action, ...data } = await req.json();

        if (action === 'revoke_status') {
            const { data: member, error } = await supabaseServer
                .from('membros')
                .update({ is_membro: false, estado_quota: 'revogado' })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return NextResponse.json({ success: true, member });
        }

        if (action === 'restore_status') {
            const { data: member, error } = await supabaseServer
                .from('membros')
                .update({ is_membro: true, estado_quota: 'pago' })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return NextResponse.json({ success: true, member });
        }

        if (action === 'register_payment' || action === 'mark_paid') {
            const amount = Number(data.amount ?? (action === 'mark_paid' ? 25 : 0));
            if (!Number.isFinite(amount) || amount <= 0) {
                return NextResponse.json({ error: 'Valor de pagamento inválido.' }, { status: 400 });
            }

            const { date, method, notes, update_quota } = data;
            const paymentType = normalizePaymentType(data.payment_type);
            const paymentDate = date ? new Date(date) : new Date();
            const validPaymentDate = Number.isNaN(paymentDate.getTime()) ? new Date() : paymentDate;
            const notesPrefix = paymentType === 'donation' ? '[TYPE:DONATION]' : '[TYPE:QUOTA]';
            const finalNotes = `${notesPrefix}${notes ? ` ${String(notes).trim()}` : ''}`.trim();

            const paymentDateIso = validPaymentDate.toISOString().slice(0, 10);
            const paymentReference = action === 'mark_paid'
                ? `manual-${Date.now()}`
                : data.external_reference || null;

            const insertPayload: any = {
                user_id: id,
                valor: amount,
                metodo_pagamento: method || 'manual',
                estado: 'pago',
                data_pagamento: paymentDateIso,
                external_reference: paymentReference,
                notes: finalNotes,
            };

            let insertedPayment: any = null;
            let insertError: any = null;
            ({ data: insertedPayment, error: insertError } = await supabaseServer
                .from('pagamentos_quotas')
                .insert(insertPayload)
                .select('id, valor, metodo_pagamento, data_pagamento, external_reference')
                .single());

            if (insertError && isMissingNotesColumnError(insertError)) {
                delete insertPayload.notes;
                ({ data: insertedPayment, error: insertError } = await supabaseServer
                    .from('pagamentos_quotas')
                    .insert(insertPayload)
                    .select('id, valor, metodo_pagamento, data_pagamento, external_reference')
                    .single());
            }

            if (insertError) throw insertError;

            const shouldUpdateQuota = action === 'mark_paid'
                ? true
                : paymentType === 'quota' && !!update_quota;
            if (shouldUpdateQuota) {
                const nextQuotaDate = calculateNextQuotaDate(validPaymentDate);
                const { error: updateMemberError } = await supabaseServer
                    .from('membros')
                    .update({
                        estado_quota: 'pago',
                        proxima_quota: nextQuotaDate.toISOString().slice(0, 10),
                        is_membro: true,
                    })
                    .eq('id', id);
                if (updateMemberError) throw updateMemberError;
            }

            await logAdminAction(
                user.email,
                action === 'mark_paid' ? 'MARK_QUOTA_PAID' : 'REGISTER_PAYMENT',
                { amount, method, notes: finalNotes, paymentType, update_quota: shouldUpdateQuota },
                id
            );

            if (action === 'mark_paid' && paymentType === 'quota') {
                try {
                    const { data: memberForEmail } = await supabaseServer
                        .from('membros')
                        .select('email, nome, numero_socio, proxima_quota')
                        .eq('id', id)
                        .single();

                    if (memberForEmail?.email && !memberForEmail.email.endsWith(INTERNAL_EMAIL_SUFFIX)) {
                        await sendMemberReceiptEmail({
                            toEmail: memberForEmail.email,
                            memberName: memberForEmail.nome,
                            memberNumber: memberForEmail.numero_socio,
                            amount: Number(insertedPayment?.valor || amount),
                            currency: 'EUR',
                            paymentMethod: insertedPayment?.metodo_pagamento || method || 'manual',
                            paymentReference: insertedPayment?.external_reference || insertedPayment?.id || paymentReference,
                            nextQuotaDate: memberForEmail.proxima_quota,
                            paidAt: insertedPayment?.data_pagamento || paymentDateIso,
                            kind: 'renewal',
                            hasDiploma: false,
                        });
                    }
                } catch (emailError) {
                    console.error('Falha no envio automático do recibo após mark_paid:', emailError);
                }
            }

            return NextResponse.json({ success: true, message: action === 'mark_paid' ? 'Quota marcada como paga.' : 'Pagamento registado.' });
        }

        if (action === 'resend_receipt') {
            const { data: member, error: memberError } = await supabaseServer
                .from('membros')
                .select('id, nome, email, numero_socio, proxima_quota')
                .eq('id', id)
                .single();
            if (memberError || !member) {
                return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
            }
            if (!member.email || member.email.endsWith(INTERNAL_EMAIL_SUFFIX)) {
                return NextResponse.json({ error: 'Este membro não tem email para envio.' }, { status: 400 });
            }

            let paidPayments: any[] | null = null;
            let paymentError: any = null;
            ({ data: paidPayments, error: paymentError } = await supabaseServer
                .from('pagamentos_quotas')
                .select('id, valor, metodo_pagamento, data_pagamento, external_reference, notes, estado')
                .eq('user_id', id)
                .eq('estado', 'pago')
                .order('data_pagamento', { ascending: false })
                .limit(20));
            if (paymentError && isMissingNotesColumnError(paymentError)) {
                ({ data: paidPayments, error: paymentError } = await supabaseServer
                    .from('pagamentos_quotas')
                    .select('id, valor, metodo_pagamento, data_pagamento, external_reference, estado')
                    .eq('user_id', id)
                    .eq('estado', 'pago')
                    .order('data_pagamento', { ascending: false })
                    .limit(20));
            }
            if (paymentError) throw paymentError;
            const latestPayment = (paidPayments || []).find((row: any) => inferPaymentTypeFromNotes(row.notes) === 'quota');
            if (!latestPayment) {
                return NextResponse.json({ error: 'Sem pagamentos pagos para reenviar recibo.' }, { status: 400 });
            }

            await sendMemberReceiptEmail({
                toEmail: member.email,
                memberName: member.nome,
                memberNumber: member.numero_socio,
                amount: Number(latestPayment.valor || 0),
                currency: 'EUR',
                paymentMethod: latestPayment.metodo_pagamento || 'manual',
                paymentReference: latestPayment.external_reference || latestPayment.id,
                nextQuotaDate: member.proxima_quota,
                paidAt: latestPayment.data_pagamento,
                kind: 'renewal',
                hasDiploma: false,
            });

            await logAdminAction(
                user.email,
                'RESEND_MEMBER_RECEIPT',
                { paymentId: latestPayment.id, amount: latestPayment.valor, method: latestPayment.metodo_pagamento },
                id
            );

            return NextResponse.json({ success: true, message: 'Recibo reenviado com sucesso.' });
        }

        if (action === 'resend_diploma') {
            const { data: member, error: memberError } = await supabaseServer
                .from('membros')
                .select('id, nome, email, numero_socio')
                .eq('id', id)
                .single();
            if (memberError || !member) {
                return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
            }
            if (!member.email || member.email.endsWith(INTERNAL_EMAIL_SUFFIX)) {
                return NextResponse.json({ error: 'Este membro não tem email para envio.' }, { status: 400 });
            }
            if (!member.numero_socio) {
                return NextResponse.json({ error: 'Membro sem número de sócio. Não é possível gerar diploma.' }, { status: 400 });
            }

            const pdfBytes = await generateMemberDiplomaPdf({
                memberName: member.nome || 'Membro',
                memberNumber: Number(member.numero_socio),
                issuedAt: new Date().toISOString(),
            });

            await sendMemberDiplomaEmail({
                toEmail: member.email,
                memberName: member.nome || 'Membro',
                memberNumber: Number(member.numero_socio),
                issuedAt: new Date().toISOString(),
                attachments: [
                    {
                        filename: `diploma-socio-${member.numero_socio}.pdf`,
                        content: Buffer.from(pdfBytes),
                        contentType: 'application/pdf',
                    },
                ],
            });

            const { error: stampError } = await supabaseServer
                .from('membros')
                .update({ diploma_enviado_at: new Date().toISOString() })
                .eq('id', id);
            if (stampError) {
                console.error('Não foi possível atualizar diploma_enviado_at:', stampError);
            }

            await logAdminAction(
                user.email,
                'RESEND_MEMBER_DIPLOMA',
                { memberNumber: member.numero_socio },
                id
            );

            return NextResponse.json({ success: true, message: 'Diploma reenviado com sucesso.' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE: Hard Delete (Danger)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { authorized, user, error: authError } = await verifyAdmin(req);
    if (!authorized || !user) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
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
