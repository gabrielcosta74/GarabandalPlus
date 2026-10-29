/**
 * Casa do Apostolado em Garabandal: o que o admin precisa do lado do servidor.
 *
 * As tabelas `house_*` vivem no Supabase (migração `house_bookings` da app dos
 * membros). Os membros só escrevem através de funções `security definer`; aqui,
 * com a chave de serviço, a equipa aprova, emite códigos e fecha datas.
 */
import { createHash, randomInt } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendExpoPush, type ExpoPushMessage } from './expo-push';

/** Sem letras nem números que se confundam (0/O, 1/I/L). */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Igual a `public.house_code_hash`: maiúsculas, só letras e números, sha256 em hex. */
export function houseCodeHash(code: string) {
    const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/** Um código novo, mostrado uma única vez à equipa: XXXX-XXXX. */
export function newHouseCode() {
    const raw = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    return { display: `${raw.slice(0, 4)}-${raw.slice(4)}`, hash: houseCodeHash(raw), hint: raw.slice(4) };
}

const isEnglish = (locale: string | null) => (locale || '').toLowerCase().startsWith('en');

const formatStay = (checkIn: string, checkOut: string, english: boolean) => {
    const format = new Intl.DateTimeFormat(english ? 'en-GB' : 'pt-PT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return `${format.format(new Date(`${checkIn}T00:00:00Z`))} – ${format.format(new Date(`${checkOut}T00:00:00Z`))}`;
};

function decisionCopy(status: 'confirmed' | 'declined', stay: { checkIn: string; checkOut: string }, locale: string | null) {
    const english = isEnglish(locale);
    const dates = formatStay(stay.checkIn, stay.checkOut, english);
    if (status === 'confirmed') {
        return english
            ? { title: 'The house is booked', body: `Your stay for ${dates} is confirmed.` }
            : { title: 'A casa está reservada', body: `A sua estadia de ${dates} está confirmada.` };
    }
    return english
        ? { title: 'Your house request', body: `The team answered your request for ${dates}.` }
        : { title: 'O seu pedido da casa', body: `A equipa respondeu ao pedido de ${dates}.` };
}

/**
 * Avisa o membro quando o pedido é confirmado ou recusado. Uma vez por estado
 * (chave única `type` + `reference` em `push_notifications`). Nunca lança.
 */
export async function notifyHouseDecision(
    supabase: SupabaseClient,
    booking: { id: string; membro_id: string; check_in: string; check_out: string },
    status: 'confirmed' | 'declined',
) {
    try {
        const reference = `${booking.id}:${status}`;
        const { data: existing } = await supabase
            .from('push_notifications')
            .select('id, sent_at')
            .eq('type', 'house_booking')
            .eq('reference', reference)
            .maybeSingle();
        if (existing?.sent_at) return 0;

        const { data: devices } = await supabase
            .from('member_devices')
            .select('expo_push_token, locale')
            .eq('user_id', booking.membro_id)
            .eq('push_enabled', true)
            .not('expo_push_token', 'is', null);
        const rows = (devices || []) as { expo_push_token: string; locale: string | null }[];
        if (rows.length === 0) return 0;

        let recordId = existing?.id as string | undefined;
        if (!recordId) {
            const { data: inserted, error } = await supabase
                .from('push_notifications')
                .insert({ user_id: booking.membro_id, type: 'house_booking', reference, sent_at: null })
                .select('id')
                .maybeSingle();
            if (error || !inserted) return 0;
            recordId = (inserted as { id: string }).id;
        }

        const messages: ExpoPushMessage[] = rows.map((device) => ({
            to: device.expo_push_token,
            ...decisionCopy(status, { checkIn: booking.check_in, checkOut: booking.check_out }, device.locale),
            channelId: 'avisos',
            sound: 'default',
            data: { kind: 'house-booking', url: `/member-area/house/${booking.id}` },
        }));
        const outcome = await sendExpoPush(messages);
        if (outcome.invalidTokens.length > 0) {
            await supabase.from('member_devices').delete().in('expo_push_token', outcome.invalidTokens);
        }
        if (outcome.delivered > 0) {
            await supabase
                .from('push_notifications')
                .update({ sent_at: new Date().toISOString(), delivered_count: outcome.delivered })
                .eq('id', recordId);
        }
        return outcome.delivered;
    } catch (error) {
        console.warn('[house] push falhou', error);
        return 0;
    }
}
