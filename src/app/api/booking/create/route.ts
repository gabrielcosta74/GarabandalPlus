import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { sendBookingConfirmationEmail } from '../../../../lib/email';
import { WhatsAppService } from '../../../../lib/whatsapp';
import { getAppUrl } from '../../../../lib/config';
import { parseRoomInfo } from '../../../../lib/utils';
import { generateViewToken, generateIdempotencyKey } from '../../../../lib/auth-utils';

export async function POST(req: Request) {
    console.log("🚀 [API] Booking Create Request Received");

    if (!supabaseServer) {
        console.error("❌ [API] Supabase Server client not initialized");
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { email, pilgrim_data, pilgrimage_id, payment_method, room_distribution, idempotency_key } = body;

        console.log(`📦 [API] Payload: Email=${email}, Pilgrims=${pilgrim_data?.length}`);

        if (!pilgrim_data || !pilgrimage_id || !email) {
            return NextResponse.json({ error: "Missing required data" }, { status: 400 });
        }

        // 1. SECURITY: User Resolution (no user_id_hint accepted from frontend)
        let userId: string;
        let isNewUser = false;
        let tempPassword: string | null = null; // Store for session creation

        const adminAuth = supabaseServer.auth.admin;

        console.log("🔍 [API] Searching user by email:", email);

        // Check if user exists
        const { data: { users }, error: listError } = await adminAuth.listUsers();
        const existingUser = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (existingUser) {
            console.log("✅ [API] User found:", existingUser.id);
            userId = existingUser.id;
        } else {
            console.log("🆕 [API] Creating new user for:", email);
            tempPassword = Math.random().toString(36).slice(-8) + "Aa1!";
            const { data: newUser, error: createError } = await adminAuth.createUser({
                email: email,
                password: tempPassword,
                email_confirm: true // Auto-confirm
            });

            if (createError) {
                console.error("❌ [API] Create User Error:", createError);
                throw new Error("Falha ao criar conta de utilizador.");
            }

            userId = newUser.user.id;
            isNewUser = true;
        }

        // 1.5. SECURITY: Idempotency Check
        const bookingIdempotencyKey = idempotency_key || generateIdempotencyKey([email, pilgrimage_id]);

        const { data: existingBooking } = await supabaseServer
            .from('bookings')
            .select('id, view_token')
            .eq('user_id', userId)
            .eq('pilgrimage_id', pilgrimage_id)
            .eq('idempotency_key', bookingIdempotencyKey)
            .single();

        if (existingBooking) {
            console.log("⚠️ [API] Duplicate booking request detected. Returning existing booking.");
            return NextResponse.json({
                success: true,
                booking_id: existingBooking.id,
                view_token: existingBooking.view_token,
                user_id: userId,
                new_account: false,
                duplicate: true
            });
        }

        // 2. Fetch Pilgrimage Details for Pricing
        const { data: pilgrimage, error: pilgError } = await supabaseServer
            .from('pilgrimages')
            .select('base_price, title, deposit_value, min_deposit, pricing_config, start_date')
            .eq('id', pilgrimage_id)
            .single();

        if (pilgError) throw pilgError;

        // 3. Calculate Total (Server Side Verification)
        let totalAmount = 0;
        const basePrice = Number(pilgrimage.base_price) || 0;
        // Priority to deposit_value (new), fallback to min_deposit (old) for safety during migration
        const regFee = Number(pilgrimage.deposit_value || pilgrimage.min_deposit) || 0;
        const supplements = (pilgrimage.pricing_config as any)?.room_supplements || {};

        const pilgrimsToInsert = pilgrim_data.map((p: any) => {
            // Determine room type for this pilgrim
            let roomType = p.room_type || 'double';

            // Formula: Base + Registration Fee + Supplement
            const supplementPrice = Number(supplements[roomType]) || 0;

            // Safety: Ensure basePrice is a number. If 0, log warning.
            if (basePrice === 0) console.warn("⚠️ [API] Base Price is 0 for pilgrimage:", pilgrimage_id);

            let pilgrimSubtotal = basePrice + regFee + supplementPrice;

            // Fallback for hardcoded Single Supplement ONLY if not configured in JSON
            // Matches Frontend Logic
            if (roomType === 'single' && (!supplements.single || supplements.single === 0)) {
                if (Object.keys(supplements).length === 0) pilgrimSubtotal += 250;
            }

            // Age Logic (Discounts)
            let discount = 0;
            if (p.birth_date) {
                const birth = new Date(p.birth_date);
                const today = new Date();

                // Fallback matching frontend: if invalid date, assume adult
                if (isNaN(birth.getTime())) {
                    console.warn(`⚠️ [API] Invalid birth_date for ${p.full_name}: ${p.birth_date}. Assuming adult (30y).`);
                    discount = 0;
                } else {
                    let age = today.getFullYear() - birth.getFullYear();
                    const m = today.getMonth() - birth.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

                    if (age >= 2 && age < 6) discount = pilgrimSubtotal * 0.2; // 20%
                    if (age < 2) discount = pilgrimSubtotal; // 100%

                    console.log(`👤 [API] Pilgrim ${p.full_name}: Age=${age}, Sub=${pilgrimSubtotal}€, Disc=${discount}€, Final=${Math.max(0, pilgrimSubtotal - discount)}€`);
                }
            }

            const finalPilgrimPrice = Math.max(0, pilgrimSubtotal - discount);
            totalAmount += finalPilgrimPrice;

            // Extract room preferences automatically for backward compatibility with form
            const roomInfo = parseRoomInfo(p.notes);
            let bedPreference = null;
            let sharingMode = null;

            // Map legacy note values (or explicitly injected via notes from frontend) to database enums
            if (roomInfo.bedType) {
                const type = roomInfo.bedType.toLowerCase();
                // Frontend uses 'big_bed' for Casal
                if (type.includes('twin') || type.includes('duas')) bedPreference = 'twin_beds';
                else if (type.includes('casal') || type.includes('duplo') || type === 'big_bed') bedPreference = 'double_bed';
                else if (type.includes('single') || type.includes('uma')) bedPreference = 'single_bed';
                else bedPreference = roomInfo.bedType;
            }

            if (roomInfo.sharingMode) {
                const mode = roomInfo.sharingMode.toLowerCase();
                if (mode.includes('aleat') || mode.includes('random')) sharingMode = 'random';
                // Frontend uses 'specific_friend' or 'Com Amigo'
                else if (mode.includes('parceiro') || mode.includes('conjunto') || mode.includes('amigo')) sharingMode = 'partner';
                else sharingMode = roomInfo.sharingMode;
            }

            return {
                // booking_id will be added after
                full_name: p.full_name,
                email: p.email,
                phone: p.phone,
                birth_date: p.birth_date,
                sex: p.sex,
                address: p.address,
                postal_code: p.postal_code,
                city: p.city,
                country: p.country,
                room_type: roomType,
                flight_option: p.flight_option,
                allergies: p.allergies,
                notes: p.notes, // Keep original notes for safety
                cpf_nif: p.cpf_nif,
                dietary_restrictions: p.allergies,
                health_notes: p.health_notes || `Cidadania: ${p.country || 'N/A'}`,
                // New Columns
                bed_preference: bedPreference,
                sharing_mode: sharingMode,
                roommate_name: roomInfo.roommates
            };
        });

        console.log(`💰 [API] Calculated Total: ${totalAmount}€ for ${pilgrimsToInsert.length} pilgrims`);

        if (totalAmount <= 0) {
            console.error(`❌ [API] Critical: Calculated Total is ${totalAmount}. Check configuration and birth dates.`);
            throw new Error(`Erro no cálculo do preço: O total resultou em 0€. Verifique se os preços estão configurados e se as datas de nascimento dos peregrinos estão corretas.`);
        }

        // 4. Insert Booking with Security Fields
        const viewToken = generateViewToken();

        const { data: booking, error: bookingError } = await supabaseServer
            .from('bookings')
            .insert({
                user_id: userId,
                pilgrimage_id: pilgrimage_id,
                total_amount: totalAmount,
                status: 'pending',
                notes: `Payment Plan: ${payment_method} | Created via API ${isNewUser ? '(New Account)' : ''}`,
                payment_plan: body.payment_plan || null,
                view_token: viewToken,
                idempotency_key: bookingIdempotencyKey
            })
            .select()
            .single();

        if (bookingError) {
            console.error("❌ [API] Booking Insert Error:", bookingError);
            throw bookingError;
        }

        // 5. Insert Pilgrims
        const pilgrimsWithId = pilgrimsToInsert.map((p: any) => ({
            ...p,
            booking_id: booking.id
        }));

        const { error: pilgrimsError } = await supabaseServer
            .from('pilgrims')
            .insert(pilgrimsWithId);

        if (pilgrimsError) {
            console.error("❌ [API] Pilgrim Insert Error:", pilgrimsError);
            throw pilgrimsError;
        }

        // 6. Record Initial Deposit Payment as Pending
        const registrationFeePerPerson = Number(pilgrimage?.deposit_value || 0);
        const totalDepositAmount = pilgrimsToInsert.length * registrationFeePerPerson;

        const { error: paymentError } = await supabaseServer
            .from('pilgrimage_payments')
            .insert({
                booking_id: booking.id,
                user_id: userId,
                amount: totalDepositAmount,
                method: body.payment_method === 'installments' ? 'bank_transfer' : 'stripe',
                status: 'pending',
                date: new Date().toISOString(),
                notes: 'Sinal de Inscrição (Automático)'
            });

        if (paymentError) {
            console.error("❌ [API] Payment Insert Error:", paymentError);
            // Don't throw - payment can be added manually later
            console.warn("⚠️ [API] Continuing without initial payment record. Admin can add manually.");
        }

        // 7. Generate Magic Link & Send Email
        try {
            // Robust Origin Detection for Magic Link
            // FORCE localhost in development mode to avoid any confusion or Vercel fallbacks
            let origin;
            const host = req.headers.get('host');

            // Check multiple conditions for development environment
            if (process.env.NODE_ENV === 'development' || host?.includes('localhost')) {
                origin = 'http://localhost:3000';
                console.log('🔧 [API] Development mode detected - using localhost');
            } else {
                const protocol = req.headers.get('x-forwarded-proto') || 'https';
                origin = host ? `${protocol}://${host}` : getAppUrl();
            }

            console.log(`📧 [API] Environment: ${process.env.NODE_ENV}`);
            console.log(`📧 [API] Using origin for magic link: ${origin}`);

            const { data: linkData, error: linkError } = await adminAuth.generateLink({
                type: 'magiclink',
                email: email,
                options: {
                    redirectTo: `${origin}/peregrinacoes/inscricao/${booking.id}`
                }
            });

            if (linkError) {
                console.error("⚠️ [API] Failed to generate magic link:", linkError);
            }

            // Awaiting is safer for "flawless" execution confirmation, though slower.
            // We'll await but catch errors so we don't fail the HTTP request if email fails.

            const magicLink = linkData?.properties?.action_link || `${origin}/peregrinacoes/inscricao/${booking.id}`;

            await sendBookingConfirmationEmail({
                bookingId: booking.id,
                email: email,
                pilgrimageName: pilgrimage.title,
                amount: totalDepositAmount,
                totalAmount: totalAmount,
                paymentMethod: payment_method,
                magicLink: magicLink
            });

        } catch (emailErr) {
            console.error("⚠️ [API] Email sending failed:", emailErr);
        }

        // 8. Send WhatsApp Notification (Async - do not block response)
        try {
            // We use the first pilgrim's data for the notification
            // Note: In detailed implementation, we might want to check if the user consented to WA.
            const mainPilgrim = pilgrimsToInsert[0]; // { full_name, phone, ... }
            // We pass the simplified booking structure or just the needed fields
            await WhatsAppService.sendWelcomeMessage(
                {
                    id: booking.id,
                    pilgrims: [{ full_name: mainPilgrim.full_name, phone: mainPilgrim.whatsapp || mainPilgrim.phone }]
                },
                pilgrimage.title
            );
        } catch (waErr) {
            console.error("⚠️ [API] WhatsApp sending failed:", waErr);
        }


        console.log("✅ [API] Success! Booking ID:", booking.id);

        // 8. Auto-Login Logic (for new users)
        // If we created a new user, we have the password. Let's create a session immediately.
        let sessionData = null;
        if (isNewUser && tempPassword) {
            try {
                const { data: signInData, error: signInError } = await supabaseServer.auth.signInWithPassword({
                    email: email,
                    password: tempPassword
                });

                if (!signInError && signInData.session) {
                    console.log("🔓 [API] Auto-login successful for new user");
                    sessionData = signInData.session;
                } else {
                    console.warn("⚠️ [API] Auto-login failed:", signInError);
                }
            } catch (authErr) {
                console.error("⚠️ [API] Auto-login exception:", authErr);
            }
        }

        // 9. Return Success Response with Session
        return NextResponse.json({
            success: true,
            booking_id: booking.id,
            view_token: viewToken,
            user_id: userId,
            new_account: isNewUser,
            session: sessionData, // Frontend will use this to set session
            user: {
                id: userId,
                email: email
            }
        });

    } catch (error: any) {
        console.error("🚨 [API] Critical Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
