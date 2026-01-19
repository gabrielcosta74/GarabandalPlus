import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { WhatsAppService } from '../../../../../lib/whatsapp';
import { sendPilgrimagePaymentReceiptEmail } from '../../../../../lib/email';

export async function POST(req: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    try {
        const { paymentId, bookingId } = await req.json();

        if (!paymentId || !bookingId) {
            return NextResponse.json({ error: "Missing required data" }, { status: 400 });
        }

        // 1. Get Payment Details
        const { data: payment, error: payError } = await supabaseServer
            .from('pilgrimage_payments')
            .select('*')
            .eq('id', paymentId)
            .single();

        if (payError || !payment) {
            return NextResponse.json({ error: "Payment not found" }, { status: 404 });
        }

        if (payment.status === 'verified' || payment.status === 'succeeded') {
            return NextResponse.json({ error: "Payment already verified" }, { status: 400 });
        }

        // 2. Get Booking Details
        const { data: booking, error: bookError } = await supabaseServer
            .from('bookings')
            .select('*, pilgrimage:pilgrimages(title, deposit_value), pilgrims!inner(full_name, phone, whatsapp, email)')
            .eq('id', bookingId)
            .maybeSingle(); // We use maybeSingle and manual check to handle unexpected duplicates gracefully

        if (bookError || !booking) {
            return NextResponse.json({ error: "Booking not found" }, { status: 404 });
        }

        const amountPaid = Number(payment.amount) || 0;
        const newTotalPaid = (Number(booking.paid_amount) || 0) + amountPaid;
        const depositValue = Number(booking.pilgrimage?.deposit_value) || 0;

        // 3. Update Payment Status
        const { error: updatePayError } = await supabaseServer
            .from('pilgrimage_payments')
            .update({
                status: 'verified',
                verified_at: new Date().toISOString()
            })
            .eq('id', paymentId);

        if (updatePayError) throw updatePayError;

        // 4. Update Booking
        const updates: any = {
            paid_amount: newTotalPaid
        };

        // Auto-confirm if deposit met
        if (newTotalPaid >= depositValue && booking.status === 'pending') {
            updates.status = 'confirmed';
            updates.deposit_confirmed_at = new Date().toISOString();
        }

        const { error: updateBookError } = await supabaseServer
            .from('bookings')
            .update(updates)
            .eq('id', bookingId);

        if (updateBookError) throw updateBookError;

        // 5. Send WhatsApp Notification
        try {
            // Get main contact details
            const contact = booking.pilgrims?.[0]; // Accessing the joined pilgrims info
            if (contact) {
                const phone = contact.whatsapp || contact.phone;
                const name = contact.full_name?.split(' ')[0] || 'Peregrino';

                if (phone) {
                    await WhatsAppService.sendPaymentConfirmation(bookingId, amountPaid, phone, name);
                }
            }
        } catch (waErr) {
            console.error("⚠️ [API] Failed to trigger WhatsApp confirmation:", waErr);
        }

        // 6. Send Email Receipt (New Feature)
        try {
            const mainPilgrim = booking.pilgrims?.[0]; // Accessing the joined pilgrims info
            if (mainPilgrim && mainPilgrim.email) {
                // Generate Magic Link for user convenience
                let magicLink = undefined;

                // Robust Origin Detection
                const host = req.headers.get('host');
                const protocol = req.headers.get('x-forwarded-proto') || 'http';
                const origin = req.headers.get('origin') || (host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_SITE_URL || 'https://apostoladodegarabandal.com');

                try {
                    const { data: linkData } = await supabaseServer.auth.admin.generateLink({
                        type: 'magiclink',
                        email: mainPilgrim.email,
                        options: { redirectTo: `${origin}/peregrinacoes/inscricao/${bookingId}` }
                    });
                    magicLink = linkData?.properties?.action_link;
                } catch (linkErr) {
                    console.warn("⚠️ [API] Could not generate magic link for receipt:", linkErr);
                }

                await sendPilgrimagePaymentReceiptEmail({
                    bookingId: bookingId,
                    email: mainPilgrim.email,
                    name: mainPilgrim.full_name?.split(' ')[0] || 'Peregrino',
                    pilgrimageTitle: booking.pilgrimage?.title || 'Peregrinação',
                    amountPaid: amountPaid,
                    totalPaidSoFar: newTotalPaid,
                    totalCost: Number(booking.total_amount) || 0,
                    magicLink: magicLink
                });
                console.log(`✅ [API] Email receipt sent to ${mainPilgrim.email}`);
            } else {
                console.warn("⚠️ [API] No email found for receipt (guest?)");
            }
        } catch (emailErr) {
            console.error("⚠️ [API] Failed to trigger Email receipt:", emailErr);
        }

        return NextResponse.json({ success: true, newTotalPaid, status: updates.status || booking.status });

    } catch (error: any) {
        console.error("🚨 [API Verify Payment] Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
