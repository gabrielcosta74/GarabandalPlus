/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../lib/admin-auth';
import { extractPassToken, isBookingFullyPaid } from '../../../../../lib/pilgrimage-passes';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const CHECKPOINT_LABELS: Record<string, string> = {
    bus_boarding: 'Entrada no autocarro',
};

export async function POST(req: Request) {
    const { authorized, user, error: authError } = await verifyAdmin(req);
    if (!authorized || !user) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseServer) {
        return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    try {
        const body = await req.json();
        const token = extractPassToken(body?.payload || body?.token || '');
        const passId = String(body?.passId || '').trim();
        const pilgrimageId = String(body?.pilgrimageId || '').trim();
        const checkpointType = String(body?.checkpointType || 'bus_boarding').trim() || 'bus_boarding';

        if (!token && !passId) {
            return NextResponse.json({ status: 'invalid', message: 'QR Code vazio ou inválido.' }, { status: 400 });
        }

        let passQuery = supabaseServer
            .from('pilgrim_passes')
            .select(`
                id,
                token,
                status,
                pilgrimage_id,
                booking_id,
                pilgrim_id,
                booking:bookings (
                    id,
                    status,
                    total_amount,
                    paid_amount,
                    payments:pilgrimage_payments (
                        id,
                        amount,
                        status
                    )
                ),
                pilgrimage:pilgrimages (
                    id,
                    title,
                    start_date,
                    end_date
                ),
                pilgrim:pilgrims (
                    id,
                    full_name,
                    email,
                    phone,
                    room_type,
                    flight_option,
                    allergies,
                    dietary_restrictions,
                    health_notes,
                    notes
                )
            `);

        passQuery = passId ? passQuery.eq('id', passId) : passQuery.eq('token', token);

        const { data: passData, error: passError } = await passQuery.maybeSingle();
        const pass: any = passData;

        if (passError) throw passError;

        if (!pass) {
            return NextResponse.json({ status: 'invalid', message: 'Passe não encontrado.' }, { status: 404 });
        }

        if (pass.status !== 'active') {
            await recordRejected(pass, checkpointType, user, 'Passe revogado');
            return NextResponse.json({ status: 'rejected', message: 'Este passe foi revogado.', pass: buildPassResponse(pass) }, { status: 409 });
        }

        if (pilgrimageId && pass.pilgrimage_id !== pilgrimageId) {
            await recordRejected(pass, checkpointType, user, 'Passe de outra peregrinação');
            return NextResponse.json({
                status: 'rejected',
                message: 'Este passe pertence a outra peregrinação.',
                pass: buildPassResponse(pass),
            }, { status: 409 });
        }

        if (String(pass.booking?.status || '').toLowerCase() === 'cancelled') {
            await recordRejected(pass, checkpointType, user, 'Inscrição cancelada');
            return NextResponse.json({ status: 'rejected', message: 'A inscrição está cancelada.', pass: buildPassResponse(pass) }, { status: 409 });
        }

        if (!isBookingFullyPaid(pass.booking)) {
            await recordRejected(pass, checkpointType, user, 'Pagamento incompleto');
            return NextResponse.json({ status: 'rejected', message: 'A inscrição ainda não está totalmente paga.', pass: buildPassResponse(pass) }, { status: 409 });
        }

        const { data: existing, error: existingError } = await supabaseServer
            .from('pilgrimage_checkins')
            .select('id, created_at, admin_email')
            .eq('pass_id', pass.id)
            .eq('checkpoint_type', checkpointType)
            .eq('result', 'accepted')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existingError) throw existingError;

        if (existing) {
            await supabaseServer.from('pilgrimage_checkins').insert({
                pilgrimage_id: pass.pilgrimage_id,
                pass_id: pass.id,
                booking_id: pass.booking_id,
                pilgrim_id: pass.pilgrim_id,
                checkpoint_type: checkpointType,
                result: 'duplicate',
                admin_user_id: user.id,
                admin_email: user.email,
                notes: `Duplicado: ${CHECKPOINT_LABELS[checkpointType] || checkpointType}`,
                metadata: { previous_checkin_id: existing.id, previous_checkin_at: existing.created_at },
            });

            return NextResponse.json({
                status: 'duplicate',
                message: 'Este passe já foi validado para este modo.',
                previous_checkin_at: existing.created_at,
                previous_checkin_by: existing.admin_email,
                pass: buildPassResponse(pass),
            });
        }

        const { data: checkin, error: insertError } = await supabaseServer
            .from('pilgrimage_checkins')
            .insert({
                pilgrimage_id: pass.pilgrimage_id,
                pass_id: pass.id,
                booking_id: pass.booking_id,
                pilgrim_id: pass.pilgrim_id,
                checkpoint_type: checkpointType,
                result: 'accepted',
                admin_user_id: user.id,
                admin_email: user.email,
                notes: CHECKPOINT_LABELS[checkpointType] || checkpointType,
                metadata: {},
            })
            .select('id, created_at')
            .single();

        if (insertError) throw insertError;

        return NextResponse.json({
            status: 'accepted',
            message: 'Passe validado.',
            checkin,
            pass: buildPassResponse(pass),
        });
    } catch (err: any) {
        console.error('Pilgrimage pass scan error:', err);
        return NextResponse.json({ error: err?.message || 'Failed to scan pass' }, { status: 500 });
    }
}

async function recordRejected(pass: any, checkpointType: string, user: any, notes: string) {
    await supabaseServer?.from('pilgrimage_checkins').insert({
        pilgrimage_id: pass.pilgrimage_id,
        pass_id: pass.id,
        booking_id: pass.booking_id,
        pilgrim_id: pass.pilgrim_id,
        checkpoint_type: checkpointType,
        result: 'rejected',
        admin_user_id: user.id,
        admin_email: user.email,
        notes,
        metadata: {},
    });
}

function buildPassResponse(pass: any) {
    return {
        pass_id: pass.id,
        booking_id: pass.booking_id,
        pilgrimage_id: pass.pilgrimage_id,
        pilgrimage_title: pass.pilgrimage?.title || '',
        pilgrim: {
            id: pass.pilgrim?.id,
            full_name: pass.pilgrim?.full_name || 'Sem nome',
            email: pass.pilgrim?.email || null,
            phone: pass.pilgrim?.phone || null,
            room_type: pass.pilgrim?.room_type || null,
            flight_option: pass.pilgrim?.flight_option || null,
            allergies: pass.pilgrim?.allergies || null,
            dietary_restrictions: pass.pilgrim?.dietary_restrictions || null,
            health_notes: pass.pilgrim?.health_notes || null,
            notes: pass.pilgrim?.notes || null,
        },
    };
}
