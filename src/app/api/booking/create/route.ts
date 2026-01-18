import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { sendBookingConfirmationEmail } from '../../../../lib/email';

export async function POST(req: Request) {
    console.log("🚀 [API] Booking Create Request Received");

    if (!supabaseServer) {
        console.error("❌ [API] Supabase Server client not initialized");
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { email, pilgrim_data, pilgrimage_id, payment_method, room_distribution, user_id_hint } = body;

        console.log(`📦 [API] Payload: Email=${email}, Pilgrims=${pilgrim_data?.length}, HID=${user_id_hint}`);

        if (!pilgrim_data || !pilgrimage_id) {
            return NextResponse.json({ error: "Missing required data" }, { status: 400 });
        }

        // 1. User Resolution
        let userId = user_id_hint;
        let isNewUser = false;

        // Use Supabase Admin to check/create user
        const adminAuth = supabaseServer.auth.admin;

        if (!userId && email) {
            console.log("🔍 [API] No ID provided. Searching user by email:", email);

            // Check if user exists (Supabase doesn't have a direct "getUserByEmail" in all SDK versions easily accessible without listUsers permissions which can be heavy, 
            // but inviteUserByEmail or createUser is standard).
            // Let's try to list users (filtered) or just try to create and catch error.

            const { data: { users }, error: listError } = await adminAuth.listUsers();
            // Note: listUsers might be slow if many users. Efficient way:
            const existingUser = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

            if (existingUser) {
                console.log("✅ [API] User found:", existingUser.id);
                userId = existingUser.id;
            } else {
                console.log("🆕 [API] Creating new user for:", email);
                const tempPassword = Math.random().toString(36).slice(-8) + "Aa1!";
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
                // Optional: Send welcome email here or later
            }
        }

        if (!userId) {
            return NextResponse.json({ error: "Could not identify or create user" }, { status: 400 });
        }

        // 2. Fetch Pilgrimage Details for Pricing
        const { data: pilgrimage, error: pilgError } = await supabaseServer
            .from('pilgrimages')
            .select('base_price, title')
            .eq('id', pilgrimage_id)
            .single();

        if (pilgError) throw pilgError;

        // 3. Calculate Total (Server Side Verification)
        // Basic logic: Base Price + Room Supplement
        let totalAmount = 0;
        const basePrice = Number(pilgrimage.base_price) || 0;

        // We rely on the `room_type` passed in pilgrim_data or derived from room_distribution
        // For simplicity and robustness given the previous issues, we will trust the client's calculated room types but verify prices.
        // Actually, let's iterate the pilgrims.

        // Supplement Map
        const SUPPLEMENTS: Record<string, number> = {
            'single': 250,
            'double': 0,
            'triple': 0,
            'quadruple': 0
        };

        const pilgrimsToInsert = pilgrim_data.map((p: any) => {
            // Determine room type for this pilgrim
            let roomType = 'double';
            if (room_distribution) {
                // Logic to find room type from distribution if sent
                // For now, let's assume the client sends the computed `room_type` inside pilgrim_data for simplicity
                // if we updated the client side correctly.
            }
            if (p.room_type) roomType = p.room_type;

            // Calculate Price
            let price = basePrice;

            // Age Logic (Children)
            if (p.birth_date) {
                const birth = new Date(p.birth_date);
                const age = new Date().getFullYear() - birth.getFullYear();
                if (age >= 2 && age <= 10) price = price * 0.5; // 50%
                if (age < 2) price = 0;
            }

            // Room Supplement
            price += (SUPPLEMENTS[roomType] || 0);

            totalAmount += price;

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
                notes: p.notes,
                cpf_nif: p.cpf_nif,
                dietary_restrictions: p.allergies, // Fallback/Legacy mapping just in case
                health_notes: p.health_notes || `Cidadania: ${p.country || 'N/A'}`
            };
        });

        console.log(`💰 [API] Calculated Total: ${totalAmount}€ for ${pilgrimsToInsert.length} pilgrims`);

        // 4. Insert Booking
        const { data: booking, error: bookingError } = await supabaseServer
            .from('bookings')
            .insert({
                user_id: userId,
                pilgrimage_id: pilgrimage_id,
                total_amount: totalAmount,
                status: 'pending',
                notes: `Payment Plan: ${payment_method} | Created via API ${isNewUser ? '(New Account)' : ''}`
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
            // Rollback? ideally yes, but for now log it.
            throw pilgrimsError;
        }

        // 6. Generate Magic Link & Send Email
        try {
            // Robust Origin Detection for Magic Link (Works on Localhost & Vercel)
            const host = req.headers.get('host');
            const protocol = req.headers.get('x-forwarded-proto') || 'http';
            const origin = req.headers.get('origin') || (host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_SITE_URL || 'https://apostoladodegarabandal.com');

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

            const magicLink = linkData?.properties?.action_link;

            await sendBookingConfirmationEmail({
                bookingId: booking.id,
                email: email,
                pilgrimageName: pilgrimage.title,
                totalAmount: totalAmount,
                magicLink: magicLink
            });

        } catch (emailErr) {
            console.error("⚠️ [API] Email sending failed:", emailErr);
        }

        console.log("✅ [API] Success! Booking ID:", booking.id);
        return NextResponse.json({
            success: true,
            booking_id: booking.id,
            user_id: userId,
            new_account: isNewUser
        });

    } catch (error: any) {
        console.error("🚨 [API] Critical Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
