/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import QRCode from 'qrcode';

const SUCCESSFUL_PAYMENT_STATUSES = new Set(['verified', 'succeeded', 'paid', 'manual']);

export const PASS_URL_PATH = '/passe-peregrino';

export type PilgrimPass = {
    id: string;
    token: string;
    status: 'active' | 'revoked';
    issued_at: string;
    pilgrim: {
        id: string;
        full_name: string;
        email?: string | null;
        phone?: string | null;
        room_type?: string | null;
        flight_option?: string | null;
        allergies?: string | null;
        dietary_restrictions?: string | null;
        health_notes?: string | null;
        notes?: string | null;
    };
    qrSvg: string;
    qrPayload: string;
};

export function getPaidAmount(booking: any) {
    const bookingPaid = Number(booking?.paid_amount) || 0;
    const paymentsPaid = (booking?.payments || [])
        .filter((payment: any) => SUCCESSFUL_PAYMENT_STATUSES.has(String(payment?.status || '').toLowerCase()))
        .reduce((sum: number, payment: any) => sum + (Number(payment?.amount) || 0), 0);

    return Math.max(bookingPaid, paymentsPaid);
}

export function isBookingFullyPaid(booking: any) {
    const total = Number(booking?.total_amount) || 0;
    return total > 0 && getPaidAmount(booking) + 0.009 >= total;
}

export function createPassPayload(origin: string, token: string) {
    const safeOrigin = origin.replace(/\/$/, '');
    return `${safeOrigin}${PASS_URL_PATH}/${encodeURIComponent(token)}`;
}

export function extractPassToken(payload: string) {
    const raw = String(payload || '').trim();
    if (!raw) return '';

    try {
        const url = new URL(raw);
        const pathMatch = url.pathname.match(/\/passe-peregrino\/([^/?#]+)/);
        if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);
        const token = url.searchParams.get('token') || url.searchParams.get('pass');
        if (token) return token.trim();
    } catch {
        // Raw token fallback below.
    }

    return raw.replace(/^pass:/i, '').trim();
}

export async function createQrSvg(payload: string) {
    return QRCode.toString(payload, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
        color: {
            dark: '#111827',
            light: '#ffffff',
        },
    });
}

function createToken() {
    return `pp_${crypto.randomBytes(24).toString('base64url')}`;
}

export async function ensurePassesForBooking(supabase: any, booking: any, origin: string): Promise<PilgrimPass[]> {
    const pilgrims = Array.isArray(booking?.pilgrims) ? booking.pilgrims : [];
    const pilgrimageId = booking?.pilgrimage_id || booking?.pilgrimage?.id;

    if (!booking?.id || !pilgrimageId || pilgrims.length === 0) return [];

    const { data: existing, error: existingError } = await supabase
        .from('pilgrim_passes')
        .select('id, token, status, issued_at, pilgrim_id')
        .eq('booking_id', booking.id);

    if (existingError) throw existingError;

    const existingByPilgrimId = new Map((existing || []).map((pass: any) => [pass.pilgrim_id, pass]));
    const missingRows = pilgrims
        .filter((pilgrim: any) => !existingByPilgrimId.has(pilgrim.id))
        .map((pilgrim: any) => ({
            pilgrimage_id: pilgrimageId,
            booking_id: booking.id,
            pilgrim_id: pilgrim.id,
            token: createToken(),
        }));

    if (missingRows.length > 0) {
        const { error: insertError } = await supabase.from('pilgrim_passes').insert(missingRows);
        if (insertError) throw insertError;
    }

    const { data: passes, error: passError } = await supabase
        .from('pilgrim_passes')
        .select('id, token, status, issued_at, pilgrim_id')
        .eq('booking_id', booking.id)
        .eq('status', 'active')
        .order('issued_at', { ascending: true });

    if (passError) throw passError;

    await supabase
        .from('pilgrim_passes')
        .update({ last_viewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('booking_id', booking.id)
        .eq('status', 'active');

    return Promise.all((passes || []).map(async (pass: any) => {
        const pilgrim = pilgrims.find((item: any) => item.id === pass.pilgrim_id) || {};
        const qrPayload = createPassPayload(origin, pass.token);
        return {
            id: pass.id,
            token: pass.token,
            status: pass.status,
            issued_at: pass.issued_at,
            pilgrim: {
                id: pilgrim.id,
                full_name: pilgrim.full_name,
                email: pilgrim.email,
                phone: pilgrim.phone,
                room_type: pilgrim.room_type,
                flight_option: pilgrim.flight_option,
                allergies: pilgrim.allergies,
                dietary_restrictions: pilgrim.dietary_restrictions,
                health_notes: pilgrim.health_notes,
                notes: pilgrim.notes,
            },
            qrPayload,
            qrSvg: await createQrSvg(qrPayload),
        };
    }));
}
