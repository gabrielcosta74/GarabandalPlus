import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

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

        if (!amount || amount < 1) {
            return NextResponse.json({ message: "Valor inválido" }, { status: 400 });
        }

        if (receiptRequired && (!donorName || !donorEmail)) {
            return NextResponse.json({ message: "Nome e email são obrigatórios para emissão de recibo" }, { status: 400 });
        }

        const finalName = donorName || 'Doador Anónimo';
        const finalEmail = donorEmail || 'anonimo@garabandal.pt';

        if (!supabaseServer) {
            throw new Error("Supabase não configurado");
        }

        const { data, error } = await supabaseServer
            .from('donations')
            .insert({
                amount_cents: Math.round(amount * 100),
                currency: 'EUR',
                method: 'bank_transfer',
                status: 'pending_verification',
                donor_name: finalName,
                donor_email: finalEmail,
                donor_address: donorAddress || null,
                donor_city: donorCity || null,
                donor_zip: donorZip || null,
                donor_country: donorCountry || null,
                donor_nif: donorNif || null,
                description: donorMessage || 'Doação via Transferência Bancária',
                proof_url: proofUrl || null,
                receipt_required: receiptRequired ?? true,
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
                amount: amount,
                currency: 'EUR',
                paymentMethod: 'bank_transfer',
                status: 'pending_verification',
                description: donorMessage || 'Doação via Transferência Bancária',
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
