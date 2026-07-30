import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import {
    isValidDonationEmail,
} from '../../../../lib/donation-fiscal';
import {
    fiscalBillingErrorMessage,
    fiscalBillingMissingFields,
    normalizeFiscalBilling,
} from '../../../../lib/fiscal-billing';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            amount,
            donorName,
            donorEmail,
            donorAddress,
            donorCity,
            donorZip,
            donorCountry,
            donorNif,
            donorMessage,
            proofUrl,
            receiptRequired
        } = body;

        const normalizedAmount = Number(amount);
        if (!Number.isFinite(normalizedAmount) || normalizedAmount < 1) {
            return NextResponse.json({ message: "Valor inválido" }, { status: 400 });
        }

        if (!donorName?.trim() || !isValidDonationEmail(donorEmail)) {
            return NextResponse.json({ message: "Nome e email são obrigatórios" }, { status: 400 });
        }
        if (!proofUrl || typeof proofUrl !== 'string') {
            return NextResponse.json({ message: "O comprovativo da transferência é obrigatório" }, { status: 400 });
        }

        const billing = normalizeFiscalBilling({
            name: donorName,
            email: donorEmail,
            address: donorAddress,
            city: donorCity,
            postalCode: donorZip,
            country: donorCountry,
            taxIdRequested: Boolean(receiptRequired),
            nif: donorNif,
        });
        const missingBillingFields = fiscalBillingMissingFields(billing);
        if (missingBillingFields.length > 0) {
            return NextResponse.json({
                message: fiscalBillingErrorMessage(missingBillingFields),
            }, { status: 400 });
        }

        const finalName = billing.name;
        const finalEmail = billing.email;

        if (!supabaseServer) {
            throw new Error("Supabase não configurado");
        }

        const { data, error } = await supabaseServer
            .from('donations')
            .insert({
                amount_cents: Math.round(normalizedAmount * 100),
                currency: 'EUR',
                method: 'bank_transfer',
                status: 'pending_verification',
                donor_name: finalName,
                donor_email: finalEmail,
                donor_address: billing.address,
                donor_city: billing.city,
                donor_zip: billing.postalCode,
                donor_country: billing.country,
                donor_nif: billing.nif,
                description: 'Doação - Associação do Apostolado de Garabandal',
                proof_url: proofUrl || null,
                receipt_required: billing.taxIdRequested,
                metadata: {
                    provider: 'bank_transfer',
                    donorMessage: donorMessage?.trim() || null,
                    taxIdRequested: billing.taxIdRequested,
                },
            })
            .select()
            .single();

        if (error) throw error;

        // 3. Notify Admin
        try {
            const { sendDonationNotification } = await import('../../../../lib/email');
            await sendDonationNotification({
                donorName: finalName,
                donorEmail: finalEmail,
                amount: normalizedAmount,
                currency: 'EUR',
                paymentMethod: 'bank_transfer',
                status: 'pending_verification',
                description: 'Doação - Associação do Apostolado de Garabandal',
                paidAt: new Date().toISOString()
            });
        } catch (emailErr) {
            console.error('Erro ao notificar admin sobre doação manual:', emailErr);
        }

        return NextResponse.json({ success: true, donation: data });
    } catch (err: any) {
        console.error('Erro em /api/donations/manual:', err);
        return NextResponse.json({ message: err.message || "Erro interno" }, { status: 500 });
    }
}
