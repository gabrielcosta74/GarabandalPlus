import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { requireAuth, verifyBookingOwnership } from '../../../../lib/auth-utils';

/**
 * POST /api/payments/upload-receipt
 * 
 * SECURITY: Requires authentication and booking ownership
 */
export async function POST(req: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { bookingId, fileData, fileName, fileType, installmentLabel, installmentAmount, token } = body;
        const parsedAmount = typeof installmentAmount === 'number' ? installmentAmount : Number(installmentAmount);
        const hasAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;

        console.log(`📂 [API Upload] Receipt for Booking ${bookingId}, Installment: ${installmentLabel}`);
        console.log(`💰 [API Upload] Received installmentAmount:`, installmentAmount, `(type: ${typeof installmentAmount})`);

        if (!bookingId || !fileData || !fileName) {
            return NextResponse.json({ error: "Missing data" }, { status: 400 });
        }

        let userId: string;

        // SECURITY: Two authentication modes
        if (token) {
            // MODE 1: Token-based authentication (for users accessing via URL token)
            const { data: booking, error } = await supabaseServer
                .from('bookings')
                .select('user_id')
                .eq('id', bookingId)
                .eq('view_token', token)
                .single();

            if (error || !booking) {
                console.error(`❌ [API Upload] Invalid token for booking ${bookingId}`);
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            userId = booking.user_id;
            console.log(`✅ [API Upload] Token validated for user ${userId}`);
        } else {
            // MODE 2: Session-based authentication (for logged in users)
            const { user, supabase } = await requireAuth();

            // Verify booking ownership
            const ownsBooking = await verifyBookingOwnership(supabase, bookingId, user.id);
            if (!ownsBooking) {
                console.error(`❌ [API Upload] User ${user.id} does not own booking ${bookingId}`);
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }

            userId = user.id;
        }

        // 1. Convert base64 to Buffer
        const buffer = Buffer.from(fileData, 'base64');

        // SECURITY: User-scoped path (receipts/{user_id}/{booking_id}/timestamp_file.jpg)
        const filePath = `receipts/${userId}/${bookingId}/${Date.now()}_${fileName}`;

        // 2. Upload to Supabase Storage using service role (authenticated path upload)
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

        // 4. Try to Update Existing Pending Payment First
        let updated = false;

        const { data: existingPayment } = await supabaseServer
            .from('pilgrimage_payments')
            .select('id')
            .eq('booking_id', bookingId)
            .eq('user_id', userId) // SECURITY: Double-check user ownership
            .in('status', ['pending', 'pending_verification'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (existingPayment) {
            const updatePayload: Record<string, any> = {
                receipt_url: publicUrl,
                status: 'verifying',
                verified_at: new Date().toISOString(),
                notes: `Comprovativo enviado: ${installmentLabel || 'Pagamento Inscrição'}`
            };

            if (hasAmount) {
                updatePayload.amount = parsedAmount;
            }

            const { error: updateError } = await supabaseServer
                .from('pilgrimage_payments')
                .update(updatePayload)
                .eq('id', existingPayment.id);

            if (!updateError) updated = true;
        }

        // 5. If no pending payment found, INSERT a new record
        if (!updated) {
            const { error: insertError } = await supabaseServer
                .from('pilgrimage_payments')
                .insert({
                    booking_id: bookingId,
                    user_id: userId, // SECURITY: Use authenticated user ID
                    amount: hasAmount ? parsedAmount : 0,
                    method: 'bank_transfer',
                    status: 'verifying',
                    receipt_url: publicUrl,
                    created_at: new Date().toISOString(),
                    notes: `Novo Comprovativo (Sem registo prévio): ${installmentLabel || 'Pagamento'}`
                });

            if (insertError) {
                console.error("❌ Failed to insert new payment record with receipt:", insertError);
                return NextResponse.json({ error: "Erro ao registar comprovativo." }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true, url: publicUrl });

    } catch (error: any) {
        console.error("🚨 Receipt Upload Error:", error);

        // Handle authentication errors
        if (error.message === 'Unauthorized') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
