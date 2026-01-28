import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '../../../../lib/supabase';
import { initReduniqPayment } from '../../../../lib/reduniq';

const bodySchema = z.object({
    amount: z.number().positive(),
    method: z.enum(['reduniq-mbway', 'reduniq-mb', 'reduniq-pix', 'reduniq-cc']),
    // Donation fields
    donorName: z.string().trim().min(1).optional(),
    donorEmail: z.string().trim().min(3).optional(),
    donorAddress: z.string().trim().min(3).optional().nullable(),
    donorCity: z.string().trim().min(2).optional().nullable(),
    donorZip: z.string().trim().min(3).optional().nullable(),
    donorCountry: z.string().trim().min(2).optional(),
    donorNif: z.string().trim().optional().nullable(),
    donorMessage: z.string().trim().optional().nullable(),
    receiptRequired: z.boolean().optional().default(false),
});

// Map internal method IDs to Reduniq Solution Codes
// NOTE: These codes should be verified with Reduniq documentation/support for your specific terminal.
// MB WAY: 107 (DPG, typically used) or 110 (SPG)
// Multibanco: 108 (DPG) or 111 (SPG)
// PIX: 116 (Braza)
// Credit Card: undefined (let Reduniq show options if no specific one, or use a specific code if known)
const SOLUTION_CODES: Record<string, number | undefined> = {
    'reduniq-mbway': 107, // Trying 107 for MB WAY
    'reduniq-mb': 108,    // Trying 108 for Multibanco
    'reduniq-pix': 116,   // 116 for PIX
    'reduniq-cc': undefined // Default for cards
};

export async function POST(request: Request) {
    try {
        const json = await request.json();
        const data = bodySchema.parse(json);
        const { amount, method, donorName, donorEmail } = data;

        if (!donorName || !donorEmail || !donorEmail.includes('@')) {
            return NextResponse.json({ message: 'Nome e email são obrigatórios.' }, { status: 400 });
        }

        if (!supabaseServer) {
            return NextResponse.json({ message: 'Erro de configuração interna.' }, { status: 500 });
        }

        // 1. Create Pending Donation Record
        // We insert BEFORE calling Reduniq to ensure we track the attempt
        const amountCents = Math.round(amount * 100);

        // Map internal method to what we store in DB (keep it simple or consistent)
        const dbMethod = method.replace('reduniq-', '');

        const { data: donation, error: insertError } = await supabaseServer
            .from('donations')
            .insert({
                amount_cents: amountCents,
                currency: 'EUR',
                method: dbMethod,
                status: 'pending', // Initial status
                donor_name: donorName,
                donor_email: donorEmail,
                donor_address: data.donorAddress || null,
                donor_city: data.donorCity || null,
                donor_zip: data.donorZip || null,
                donor_country: data.donorCountry || null,
                donor_nif: data.donorNif || null,
                description: data.donorMessage || 'Doação via Reduniq',
                receipt_required: data.receiptRequired,
                // external_reference and payment_intent_id will be updated after init
            })
            .select()
            .single();

        if (insertError) {
            console.error('Error creating donation record:', insertError);
            throw new Error('Erro ao registar doação.');
        }

        // 2. Initialize Reduniq Payment
        const solutionCode = SOLUTION_CODES[method];

        // Use the donation ID or a timestamp ref? 
        // Reduniq needs a unique ref. Let's use `donation_${id}` or similar if ID isUUID.
        // Or stick to the timestamp pattern but save it.
        const orderRef = `don_${donation.id.replace(/-/g, '').substring(0, 15)}_${Date.now().toString().substring(8)}`;

        let reduniqResult;
        try {
            reduniqResult = await initReduniqPayment({
                amount: amount,
                type: 'donation',
                userId: undefined,
                solution: solutionCode,
                orderRef: orderRef,
                metadata: {
                    donationId: donation.id,
                    donorName: donorName || '',
                    donorEmail: donorEmail || '',
                },
            });
        } catch (initError: any) {
            // Fallback: If specific solution is invalid (e.g. terminal doesn't support 116/PIX direct),
            // try generic payment (solution: undefined) so user can at least pay via landing page.
            if (initError.message?.includes('Invalid payment solution') || initError.message?.includes('Invalid solution')) {
                console.warn(`Reduniq Solution ${solutionCode} failed. Retrying with generic payment.`, initError.message);
                reduniqResult = await initReduniqPayment({
                    amount: amount,
                    type: 'donation',
                    userId: undefined,
                    solution: undefined, // Generic fallback
                    orderRef: orderRef,
                    metadata: {
                        donationId: donation.id,
                        donorName: donorName || '',
                        donorEmail: donorEmail || '',
                    },
                });
            } else {
                // Re-throw if it's another error (auth, network, etc)
                throw initError;
            }
        }

        // 3. Update Donation with Reduniq Info
        await supabaseServer
            .from('donations')
            .update({
                external_reference: orderRef,
                payment_intent_id: reduniqResult.token,
            })
            .eq('id', donation.id);

        return NextResponse.json({
            url: reduniqResult.redirectUrl,
            token: reduniqResult.token
        });

    } catch (err: any) {
        console.error('Erro em /api/donations/create:', err);
        return NextResponse.json({ message: err.message || 'Erro ao iniciar doação.' }, { status: 400 });
    }
}
