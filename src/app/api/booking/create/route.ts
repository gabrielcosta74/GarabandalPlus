import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { sendBookingConfirmationEmail } from '../../../../lib/email';
import { getAppUrl } from '../../../../lib/config';
import { parseRoomInfo } from '../../../../lib/utils';
import { generateViewToken, generateIdempotencyKey } from '../../../../lib/auth-utils';
import { isActiveMember } from '../../../../lib/store-discounts';

async function findAuthUserByEmail(
    adminAuth: NonNullable<typeof supabaseServer>['auth']['admin'],
    email: string
) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return null;

    const perPage = 200;
    let page = 1;

    while (true) {
        const { data, error } = await adminAuth.listUsers({ page, perPage });
        if (error) throw error;

        const users = data?.users || [];
        const found = users.find((u) => (u.email || '').toLowerCase() === normalized);
        if (found) return found;

        if (users.length < perPage) break;
        page += 1;
    }

    return null;
}

export async function POST(req: Request) {
    console.log("🚀 [API] Booking Create Request Received");

    if (!supabaseServer) {
        console.error("❌ [API] Supabase Server client not initialized");
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { email, pilgrim_data, pilgrimage_id, payment_method, room_distribution, idempotency_key } = body;
        let bookingEmail = String(email || '').trim().toLowerCase();

        console.log(`📦 [API] Payload: Email=${bookingEmail}, Pilgrims=${pilgrim_data?.length}`);

        if (!pilgrim_data || !pilgrimage_id || !bookingEmail) {
            return NextResponse.json({ error: "Missing required data" }, { status: 400 });
        }

        // 1. SECURITY: User Resolution (no user_id_hint accepted from frontend)
        let userId: string;
        let isNewUser = false;
        let tempPassword: string | null = null; // Store for session creation

        const adminAuth = supabaseServer.auth.admin;

        console.log("🔍 [API] Searching user by email:", email);

        // Prefer authenticated session if frontend sent Authorization header
        const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
        const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

        let existingUser: any = null;
        if (bearerToken) {
            const { data: authUserData, error: authUserError } = await supabaseServer.auth.getUser(bearerToken);
            if (!authUserError && authUserData?.user?.id) {
                existingUser = authUserData.user;
                console.log("✅ [API] Authenticated session user resolved:", existingUser.id);

                const sessionEmail = String(authUserData.user.email || '').trim().toLowerCase();
                if (sessionEmail) {
                    if (sessionEmail !== bookingEmail) {
                        console.warn(`⚠️ [API] Booking email override due to authenticated session: payload=${bookingEmail} session=${sessionEmail}`);
                    }
                    bookingEmail = sessionEmail;
                }
            }
        }

        // Fallback: Check if user exists by email (paginated lookup)
        if (!existingUser) {
            existingUser = await findAuthUserByEmail(adminAuth, bookingEmail);
        }

        if (existingUser) {
            console.log("✅ [API] User found:", existingUser.id);
            userId = existingUser.id;
        } else {
            console.log("🆕 [API] Creating new user for:", bookingEmail);
            tempPassword = Math.random().toString(36).slice(-8) + "Aa1!";
            const { data: newUser, error: createError } = await adminAuth.createUser({
                email: bookingEmail,
                password: tempPassword,
                email_confirm: true // Auto-confirm
            });

            if (createError) {
                // Race condition or stale lookup: user may already exist.
                if ((createError as any)?.code === 'email_exists' || String((createError as any)?.message || '').toLowerCase().includes('already been registered')) {
                    const lateFoundUser = await findAuthUserByEmail(adminAuth, bookingEmail);
                    if (lateFoundUser?.id) {
                        console.warn("⚠️ [API] User existed during createUser, reusing existing account:", lateFoundUser.id);
                        userId = lateFoundUser.id;
                    } else {
                        console.error("❌ [API] Create User Error (email_exists, but lookup failed):", createError);
                        throw new Error("Falha ao criar conta de utilizador.");
                    }
                } else {
                    console.error("❌ [API] Create User Error:", createError);
                    throw new Error("Falha ao criar conta de utilizador.");
                }
            } else {
                userId = newUser.user.id;
                isNewUser = true;
            }
        }

        // 1.5. SECURITY: Idempotency Check
        const bookingIdempotencyKey = idempotency_key || generateIdempotencyKey([bookingEmail, pilgrimage_id]);

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

        // 3. Resolve active members for 50€ discount
        const candidateEmails = new Set<string>();
        const normalizedBookingEmail = bookingEmail;
        if (normalizedBookingEmail.includes('@')) candidateEmails.add(normalizedBookingEmail);
        (pilgrim_data || []).forEach((p: any) => {
            const pilgrimEmail = typeof p?.email === 'string' ? p.email.trim().toLowerCase() : '';
            if (pilgrimEmail.includes('@')) candidateEmails.add(pilgrimEmail);
        });

        const activeMemberEmails = new Set<string>();
        if (candidateEmails.size > 0) {
            const { data: members, error: membersError } = await supabaseServer
                .from('membros')
                .select('email, is_membro, estado_quota, tipo_subscricao, proxima_quota')
                .in('email', Array.from(candidateEmails));

            if (membersError) {
                console.warn('⚠️ [API] Failed to load member status for discount:', membersError.message);
            } else {
                (members || []).forEach((m: any) => {
                    const mEmail = String(m?.email || '').toLowerCase();
                    if (mEmail && isActiveMember(m)) {
                        activeMemberEmails.add(mEmail);
                    }
                });
            }
        }

        // 4. Calculate Total (Server Side Verification)
        let totalAmount = 0;
        const basePrice = Number(pilgrimage.base_price) || 0;
        // Priority to deposit_value (new), fallback to min_deposit (old) for safety during migration
        const regFee = Number(pilgrimage.deposit_value || pilgrimage.min_deposit) || 0;
        const supplements = (pilgrimage.pricing_config as any)?.room_supplements || {};

        const pilgrimsToInsert = pilgrim_data.map((p: any, idx: number) => {
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
            let age = 30;
            let discount = 0;
            if (p.birth_date) {
                const birth = new Date(p.birth_date);
                const today = new Date();

                // Fallback matching frontend: if invalid date, assume adult
                if (isNaN(birth.getTime())) {
                    console.warn(`⚠️ [API] Invalid birth_date for ${p.full_name}: ${p.birth_date}. Assuming adult (30y).`);
                    discount = 0;
                } else {
                    age = today.getFullYear() - birth.getFullYear();
                    const m = today.getMonth() - birth.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

                    if (age >= 2 && age < 6) discount = pilgrimSubtotal * 0.2; // 20%
                    if (age < 2) discount = pilgrimSubtotal; // 100%
                }
            }

            // Active member discount: flat 50€ (except infants)
            const pilgrimEmail = typeof p?.email === 'string' ? p.email.trim().toLowerCase() : '';
            const effectiveEmail = pilgrimEmail || (idx === 0 ? normalizedBookingEmail : '');
            if (age >= 2 && effectiveEmail && activeMemberEmails.has(effectiveEmail)) {
                discount += 50;
            }

            console.log(`👤 [API] Pilgrim ${p.full_name}: Age=${age}, Sub=${pilgrimSubtotal}€, Disc=${discount}€, Final=${Math.max(0, pilgrimSubtotal - discount)}€`);

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

        // 4. Vacancy Sync Auto-Repair
        // `create_booking_atomic` relies on `pilgrimages.current_vacancies`.
        // Keep it aligned with: total - manual_occupied - active web bookings.
        try {
            const { data: vacancySyncData, error: vacancySyncError } = await supabaseServer
                .rpc('recalculate_pilgrimage_vacancies', { p_pilgrimage_id: pilgrimage_id });
            if (vacancySyncError) throw vacancySyncError;

            const vacancySyncRow = Array.isArray(vacancySyncData) ? vacancySyncData[0] : vacancySyncData;
            if (vacancySyncRow) {
                console.log(
                    `✅ [API] Vacancy sync: total=${vacancySyncRow.total_vacancies}, manual=${vacancySyncRow.manual_occupied_pax}, web=${vacancySyncRow.web_occupied_pax}, available=${vacancySyncRow.current_vacancies}`
                );
            }
        } catch (vacancySyncError) {
            console.warn('⚠️ [API] Vacancy sync pre-check failed, continuing with atomic RPC:', vacancySyncError);
        }

        // 5. ATOMIC BOOKING TRANSACTION (Insert w/ Vacancy Check)
        const bookingNotes = `Payment Plan: ${payment_method} | Created via API ${isNewUser ? '(New Account)' : ''}`;

        const { data: atomicResult, error: atomicError } = await supabaseServer.rpc('create_booking_atomic', {
            p_pilgrimage_id: pilgrimage_id,
            p_user_id: userId,
            p_total_amount: totalAmount,
            p_pilgrim_data: pilgrimsToInsert,
            p_payment_plan: body.payment_plan || null,
            p_notes: bookingNotes,
            p_idempotency_key: bookingIdempotencyKey
        });

        if (atomicError) {
            console.error("❌ [API] Atomic Booking Error:", atomicError);
            if (atomicError.message && atomicError.message.includes('Not enough vacancies')) {
                return NextResponse.json({ error: "Desculpe, a peregrinação esgotou durante o seu processo de inscrição." }, { status: 409 });
            }
            throw atomicError;
        }

        const booking = {
            id: atomicResult.booking_id,
            view_token: atomicResult.view_token
        };

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
                created_at: new Date().toISOString(),
                notes: 'Sinal de Inscrição (Automático)'
            });

        if (paymentError) {
            console.error("❌ [API] Payment Insert Error:", paymentError);
            // Don't throw - payment can be added manually later
            console.warn("⚠️ [API] Continuing without initial payment record. Admin can add manually.");
        }

        // 6.1 Re-sync vacancies.
        // Booking creation no longer means occupied seat; only paid deposit does.
        try {
            await supabaseServer.rpc('recalculate_pilgrimage_vacancies', { p_pilgrimage_id: pilgrimage_id });
        } catch (syncErr) {
            console.warn('⚠️ [API] Vacancy sync after booking creation failed:', syncErr);
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
                email: bookingEmail,
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
                email: bookingEmail,
                pilgrimageName: pilgrimage.title,
                amount: totalDepositAmount,
                totalAmount: totalAmount,
                paymentMethod: payment_method,
                magicLink: magicLink
            });

        } catch (emailErr) {
            console.error("⚠️ [API] Email sending failed:", emailErr);
        }

        console.log("✅ [API] Success! Booking ID:", booking.id);

        // 8. Auto-Login Logic (for new users)
        // If we created a new user, we have the password. Let's create a session immediately.
        let sessionData = null;
        if (isNewUser && tempPassword) {
            try {
                const { data: signInData, error: signInError } = await supabaseServer.auth.signInWithPassword({
                    email: bookingEmail,
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
            view_token: booking.view_token,
            user_id: userId,
            new_account: isNewUser,
            session: sessionData, // Frontend will use this to set session
            user: {
                id: userId,
                email: bookingEmail
            }
        });

    } catch (error: any) {
        console.error("🚨 [API] Critical Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
