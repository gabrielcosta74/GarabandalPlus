import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { validatePostalCode } from '../../../../lib/country-utils';
import {
    donationRequiresFullFiscalData,
    hasCompleteDonationFiscalData,
    isValidDonationEmail,
    isValidDonationTaxId,
} from '../../../../lib/donation-fiscal';

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

        const requiresFullFiscalData =
            Boolean(receiptRequired) || donationRequiresFullFiscalData(normalizedAmount);
        if (requiresFullFiscalData && !hasCompleteDonationFiscalData({
            name: donorName,
            email: donorEmail,
            address: donorAddress,
            city: donorCity,
            zip: donorZip,
            country: donorCountry,
            nif: donorNif,
        })) {
            return NextResponse.json({
                message: "Preenche o NIF e a morada fiscal completa para emitir a Fatura-Recibo",
            }, { status: 400 });
        }
        if (
            requiresFullFiscalData
            && !validatePostalCode(donorCountry || '', donorZip || '')
        ) {
            return NextResponse.json({ message: "Código postal inválido" }, { status: 400 });
        }
        if (
            requiresFullFiscalData
            && !isValidDonationTaxId(donorNif, donorCountry)
        ) {
            return NextResponse.json({ message: "NIF/CPF inválido" }, { status: 400 });
        }

        const finalName = donorName.trim();
        const finalEmail = donorEmail.trim().toLowerCase();

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
                donor_address: donorAddress || null,
                donor_city: donorCity || null,
                donor_zip: donorZip || null,
                donor_country: donorCountry || null,
                donor_nif: donorNif ? String(donorNif).replace(/\D/g, '') : null,
                description: 'Doação - Associação do Apostolado de Garabandal',
                proof_url: proofUrl || null,
                receipt_required: requiresFullFiscalData,
                metadata: {
                    provider: 'bank_transfer',
                    donorMessage: donorMessage?.trim() || null,
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
