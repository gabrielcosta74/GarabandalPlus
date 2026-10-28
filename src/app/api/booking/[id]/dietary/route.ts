import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '../../../../../lib/auth-utils';
import { dietaryAnswerSchema } from '../../../../../lib/pilgrimage-dietary';
import { checkRateLimit } from '../../../../../lib/rate-limit';
import { supabaseServer } from '../../../../../lib/supabase';

const schema = z.object({
    pilgrimId: z.string().uuid(),
    answer: dietaryAnswerSchema(),
    token: z.string().min(1).max(256).optional().nullable(),
});
const headers = { 'Cache-Control': 'private, no-store, max-age=0' };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!supabaseServer) return json({ error: 'Server not configured' }, 500);
    const limit = checkRateLimit(request, { keyPrefix: 'booking-dietary', windowMs: 60_000, max: 30 });
    if (!limit.allowed) return NextResponse.json({ error: 'Demasiados pedidos. Tenta novamente dentro de um minuto.' }, {
        status: 429, headers: { ...headers, 'Retry-After': String(limit.retryAfterSeconds) },
    });

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: 'Indica as alergias alimentares ou escreve “Não” (máximo 2000 caracteres).' }, 400);
    const { id } = await params;
    const { pilgrimId, answer, token } = parsed.data;

    try {
        // Scope the service-role lookup to a verified owner or the existing private booking link.
        let query = supabaseServer.from('bookings').select('id, status').eq('id', id);
        if (token) {
            query = query.eq('view_token', token);
        } else {
            const client = await createSupabaseServerClient();
            const { data: { user }, error } = await client.auth.getUser();
            if (error || !user) return json({ error: 'Unauthorized' }, 401);
            query = query.eq('user_id', user.id);
        }
        const { data: booking, error: bookingError } = await query.maybeSingle();
        if (bookingError) throw bookingError;
        if (!booking) return json({ error: 'Inscrição não encontrada ou acesso inválido.' }, 404);
        if (['cancelled', 'canceled', 'expired'].includes(booking.status)) return json({ error: 'Esta inscrição já não está ativa.' }, 409);

        // Update only dietary fields and only a participant of this booking, in one statement.
        const { data: pilgrim, error } = await supabaseServer.from('pilgrims')
            .update({ allergies: answer, dietary_restrictions: answer })
            .eq('id', pilgrimId).eq('booking_id', booking.id)
            .select('id, allergies, dietary_restrictions').maybeSingle();
        if (error) throw error;
        if (!pilgrim) return json({ error: 'Participante não encontrado nesta inscrição.' }, 404);
        return json({ pilgrim });
    } catch (error) {
        console.error('[Booking dietary] Save failed:', error instanceof Error ? error.message : 'Database error');
        return json({ error: 'Não foi possível guardar. Tenta novamente.' }, 500);
    }
}
