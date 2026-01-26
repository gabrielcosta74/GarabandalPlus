import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { sendWelcomeEmail } from '../../../../lib/email';
import { calculateNextQuotaDate } from '../../../../lib/membership-logic';

// ... (keep isAdmin helper)
// Helper to validate Admin Session
const isAdmin = async (req: Request) => {
    if (!supabaseServer) return false;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return false;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseServer.auth.getUser(token);
    return !error && !!user;
};

// ... (keep GET)
export async function GET(req: Request) {
    if (!await isAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
            .order('numero_socio', { ascending: true });

        if (error) throw error;

        // Calculate Summary
        const allMembers = members || [];
        const total = allMembers.length;

        const active = allMembers.filter(m => (m.estado_quota || '').toLowerCase() === 'pago' || (m.estado_quota || '').toLowerCase() === 'paid').length;
        const overdue = allMembers.filter(m => (m.estado_quota || '').toLowerCase().includes('atras')).length;
        const pending = allMembers.filter(m => (m.estado_quota || '').toLowerCase() === 'pendente').length;

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
    if (!await isAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseServer) {
        return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
    }

    try {
        const body = await req.json();

        // Action: Create Member
        if (body.action === 'create_member') {
            const { email, nome, telefone, nif, address, postal_code, country } = body;

            if (!email) return NextResponse.json({ error: 'Email obrigatorio' }, { status: 400 });

            // Generate Secure Temporary Password
            const tempPassword = `Membro.${Math.random().toString(36).slice(-6)}!`;

            // 1. Create Auth User
            const { data: authData, error: authError } = await supabaseServer.auth.admin.createUser({
                email: email,
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

            const userId = authData.user.id;

            // 2. Update Profile in 'membros'
            const { initial_payment, payment_method } = body;

            // Calculate Dates if paid
            let quotaStatus = 'pendente';
            let nextQuotaDate = null;
            let joinDate = new Date().toISOString().slice(0, 10);

            if (initial_payment) {
                quotaStatus = 'pago';
                const nextQuotaObj = calculateNextQuotaDate(null);
                nextQuotaDate = nextQuotaObj.toISOString().slice(0, 10);
            }

            // Upsert Profile
            const { error: profileError } = await supabaseServer
                .from('membros')
                .upsert({
                    id: userId,
                    email: email,
                    nome: nome,
                    telefone: telefone,
                    nif: nif,
                    address: address,
                    postal_code: postal_code,
                    country: country,
                    data_adesao: joinDate,
                    is_membro: true,
                    estado_quota: quotaStatus,
                    proxima_quota: nextQuotaDate
                });

            if (profileError) {
                console.error('Profile Update Error:', profileError);
            }

            // 3. Log Initial Payment if selected
            if (initial_payment) {
                await supabaseServer.from('payments').insert({
                    email: email,
                    amount: 25.00, // Standard Amount? Or should we accept it? Defaulting to 25.
                    status: 'paid',
                    method: payment_method || 'transfer',
                    notes: 'Pagamento inicial na criação manual',
                    created_at: new Date().toISOString(),
                    type: 'MANUAL_ENTRY'
                });
            }

            // 4. Send Email (Awaited to ensure delivery, as users reported issues)
            try {
                // Always send the welcome email so they know about their account
                await sendWelcomeEmail({ name: nome, email: email });

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

            return NextResponse.json({ success: true, userId, temporaryPassword: tempPassword });
        }

        return NextResponse.json({ error: 'Invalid Action' }, { status: 400 });

    } catch (error: any) {
        console.error("Admin Create Member Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
