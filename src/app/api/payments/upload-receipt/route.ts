import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export async function POST(req: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { bookingId, paymentId, fileData, fileName, fileType, installmentLabel } = body;

        console.log(`📂 [API Upload] Receipt for Booking ${bookingId}, Installment: ${installmentLabel}`);

        if (!bookingId || !fileData || !fileName) {
            return NextResponse.json({ error: "Missing data" }, { status: 400 });
        }

        // 1. Convert base64 to Buffer
        const buffer = Buffer.from(fileData, 'base64');
        const filePath = `receipts/${bookingId}/${Date.now()}_${fileName}`;

        // 2. Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseServer.storage
            .from('receipts')
            .upload(filePath, buffer, {
                contentType: fileType,
                upsert: true
            });

        if (uploadError) {
            console.error("❌ Upload Error:", uploadError);
            return NextResponse.json({ error: "Falha ao carregar o ficheiro." }, { status: 500 });
        }

        // 3. Get Public URL
        const { data: { publicUrl } } = supabaseServer.storage
            .from('receipts')
            .getPublicUrl(filePath);

        // 4. Update Payment Record
        const { error: updateError } = await supabaseServer
            .from('pilgrimage_payments')
            .update({
                receipt_url: publicUrl,
                status: 'verifying',
                notes: `Comprovativo enviado pelo utilizador: ${installmentLabel || 'Pagamento Inscrição'}`
            })
            .eq(paymentId ? 'id' : 'booking_id', paymentId || bookingId)
            // If paymentId is provided, use it, otherwise use bookingId (usually for initial deposit)
            .order('created_at', { ascending: false })
            .limit(1);

        if (updateError) {
            console.error("❌ Database Update Error:", updateError);
            return NextResponse.json({ error: "Falha ao atualizar registo de pagamento." }, { status: 500 });
        }

        return NextResponse.json({ success: true, url: publicUrl });

    } catch (error: any) {
        console.error("🚨 Receipt Upload Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
