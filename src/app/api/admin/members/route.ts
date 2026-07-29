import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { sendWelcomeEmail } from '../../../../lib/email';
import { calculateNextQuotaDate } from '../../../../lib/membership-logic';
import { isPaidStatus, normalizeQuotaStatus } from '../../../../lib/membership-status';
import { verifyAdmin } from '../../../../lib/admin-auth';
import { getNextMemberNumber } from '../../../../lib/membership-db';

export async function GET(req: Request) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseServer) {
        return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
    }

    try {
        const { searchParams } = new URL(req.url);
        // Filters can be processed client-side for small datasets, 
        // but we fetch everything to calculate the summary accurately.

        const { data: members, error } = await supabaseServer
            .from('membros')
            .select('*')
            .not('numero_socio', 'is', null)
            .order('numero_socio', { ascending: true });

        if (error) throw error;

        // Calculate Summary
        const allMembers = (members || []).filter((member) => {
            const quotaStatus = normalizeQuotaStatus(member.estado_quota);
            return member.is_membro || quotaStatus !== 'pendente';
        });
        const total = allMembers.length;

        const active = allMembers.filter(m => isPaidStatus(m.estado_quota)).length;
        const overdue = allMembers.filter(m => normalizeQuotaStatus(m.estado_quota) === 'expirado').length;
        const pending = allMembers.filter(m => normalizeQuotaStatus(m.estado_quota) === 'pendente').length;

        // Founders assumption: check type_subscription or low numbers? 
        // Using 'tipo_subscricao' if available, otherwise 0
        const founders = allMembers.filter(m => (m.tipo_subscricao || '').toLowerCase().includes('fundador')).length;

        // Due Soon (Arbitrary logic or based on dates if available)
        // For now, let's keep it 0 or simple logic
        const dueSoon = 0;

        return NextResponse.json({
            members: allMembers,
            summary: {
                total,
                active,
                pending,
                overdue,
                founders,
                dueSoon
            }
        });

    } catch (error) {
        console.error("Admin Members API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST: Create New Member
export async function POST(req: Request) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseServer) {
        return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
    }

    try {
        const body = await req.json();
        const makeInternalEmail = () =>
            `membro.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@sem-email.local`;

        // Action: Create Member
        if (body.action === 'create_member') {
            const createAccount = body.create_account !== false;
            const nome = String(body.nome || '').trim();
            const telefone = String(body.telefone || '').trim();
            const nif = body.nif ? String(body.nif).trim() : null;
            const address = body.address ? String(body.address).trim() : null;
            const postal_code = body.postal_code ? String(body.postal_code).trim() : null;
            const city = body.city ? String(body.city).trim() : null;
            const country = String(body.country || '').trim();
            const providedEmail = body.email ? String(body.email).trim().toLowerCase() : '';

            if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
            if (!telefone) return NextResponse.json({ error: 'Telefone é obrigatório.' }, { status: 400 });
            if (!country) return NextResponse.json({ error: 'País é obrigatório.' }, { status: 400 });
            if (createAccount && !providedEmail) {
                return NextResponse.json({ error: 'Email é obrigatório para criar conta.' }, { status: 400 });
            }

            // For members without account/email, store a technical internal email to keep DB compatibility.
            const email = providedEmail || makeInternalEmail();
            const isInternalEmail = email.endsWith('@sem-email.local');

            let userId = typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `member-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            let tempPassword: string | undefined;
            let hasAccount = false;

            if (createAccount) {
                tempPassword = `Membro.${Math.random().toString(36).slice(-6)}!`;
                const { data: authData, error: authError } = await supabaseServer.auth.admin.createUser({
                    email,
                    password: tempPassword,
                    email_confirm: true, // Auto-confirm
                    user_metadata: { nome }
                });

                if (authError) {
                    if (authError.message.includes('already registered') || authError.status === 422) {
                        return NextResponse.json({ error: 'Este email já está registado.' }, { status: 409 });
                    }
                    throw authError;
                }
                if (!authData.user) throw new Error('Falha ao criar utilizador');
                userId = authData.user.id;
                hasAccount = true;
            }

            // 2. Update Profile in 'membros'
            const { initial_payment, payment_method } = body;

            // Calculate Dates if paid
            let quotaStatus = 'pendente';
            let nextQuotaDate = null;
            let joinDate = new Date().toISOString().slice(0, 10);
            let nextMemberNumber: number | null = null;

            if (initial_payment) {
                quotaStatus = 'pago';
                const nextQuotaObj = calculateNextQuotaDate(new Date());
                nextQuotaDate = nextQuotaObj.toISOString().slice(0, 10);
                nextMemberNumber = await getNextMemberNumber(supabaseServer);
            }

            // Upsert Profile
            const { error: profileError } = await supabaseServer
                .from('membros')
                .upsert({
                    id: userId,
                    email,
                    nome,
                    telefone,
                    nif,
                    address,
                    postal_code,
                    city,
                    country,
                    data_adesao: joinDate,
                    is_membro: initial_payment,
                    estado_quota: quotaStatus,
                    proxima_quota: nextQuotaDate,
                    numero_socio: nextMemberNumber
                });

            if (profileError) throw profileError;

            // 3. Log Initial Payment if selected
            let paymentWarning: string | null = null;
            if (initial_payment) {
                const { error: paymentError } = await supabaseServer.from('pagamentos_quotas').insert({
                    user_id: userId,
                    valor: 25.00,
                    metodo_pagamento: payment_method || 'manual',
                    estado: 'pago',
                    data_pagamento: new Date().toISOString().slice(0, 10),
                });
                if (paymentError) {
                    console.error('Initial payment insert failed:', paymentError);
                    paymentWarning = 'Membro criado, mas o registo da quota inicial falhou.';
                    await supabaseServer
                        .from('membros')
                        .update({ is_membro: false, estado_quota: 'pendente', proxima_quota: null, numero_socio: null })
                        .eq('id', userId);
                }
            }

            // 4. Send Email (Awaited to ensure delivery, as users reported issues)
            if (hasAccount && !isInternalEmail) {
                try {
                // Always send the welcome email so they know about their account
                    await sendWelcomeEmail({ name: nome, email });

                    if (initial_payment) {
                        // Fetch assigned member number
                        const { data: memberData } = await supabaseServer
                            .from('membros')
                            .select('numero_socio')
                            .eq('id', userId)
                            .single();

                        if (memberData?.numero_socio) {
                            // Generate Diploma
                            const { generateMemberDiplomaPdf } = await import('../../../../lib/member-diploma');
                            const { sendMemberReceiptEmail } = await import('../../../../lib/email');

                            const pdfBytes = await generateMemberDiplomaPdf({
                                memberName: nome,
                                memberNumber: memberData.numero_socio,
                                issuedAt: new Date().toISOString()
                            });

                            await sendMemberReceiptEmail({
                                toEmail: email,
                                memberName: nome,
                                memberNumber: memberData.numero_socio,
                                amount: 25.00,
                                currency: 'EUR',
                                paymentMethod: payment_method || 'manual',
                                paymentReference: 'Manual/Admin',
                                paidAt: new Date().toISOString(),
                                kind: 'new',
                                hasDiploma: true,
                                attachments: [{
                                    filename: `diploma-socio-${memberData.numero_socio}.pdf`,
                                    content: Buffer.from(pdfBytes),
                                    contentType: 'application/pdf'
                                }]
                            });
                        }
                    }
                } catch (err) {
                    console.error('Failed to send email:', err);
                    // Do not fail the request, just log
                }
            }

            return NextResponse.json({
                success: true,
                userId,
                temporaryPassword: tempPassword,
                hasAccount,
                memberEmail: isInternalEmail ? null : email,
                warning: paymentWarning
            });
        }

        return NextResponse.json({ error: 'Invalid Action' }, { status: 400 });

    } catch (error: any) {
        console.error("Admin Create Member Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
