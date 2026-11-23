/**
 * Recibos da Expo.
 *
 * O bilhete de um envio só diz que a Expo aceitou a mensagem. Se a Apple ou o
 * Google a recusaram (app desinstalada, credenciais erradas) sabe-se no recibo,
 * uns minutos depois. Guardamos os bilhetes e o cron horário lê os recibos:
 * tokens mortos deixam de ser usados e os outros erros ficam registados.
 *
 * NADA AQUI LANÇA: nem a tabela por criar nem a Expo em baixo podem travar um envio.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExpoPushTicket } from './expo-push';

const RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const TABLE = 'push_tickets';
/** A Expo pede que se espere cerca de 15 minutos, e guarda os recibos 24 horas. */
const READY_MS = 15 * 60 * 1000;
const EXPIRED_MS = 24 * 60 * 60 * 1000;
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const BATCH = 300;
const MAX_PER_RUN = 900;

export type ReceiptsResult = { checked: number; delivered: number; failed: number; deadTokens: number };

export async function storePushTickets(supabase: SupabaseClient, type: string, tickets: ExpoPushTicket[]) {
    if (tickets.length === 0) return;
    try {
        const { error } = await supabase.from(TABLE).upsert(
            tickets.map((ticket) => ({ ticket_id: ticket.id, expo_push_token: ticket.token, type })),
            { onConflict: 'ticket_id', ignoreDuplicates: true },
        );
        if (error) console.warn('[push-receipts] bilhetes por guardar:', error.message);
    } catch (error) {
        console.warn('[push-receipts] bilhetes por guardar:', error);
    }
}

type Receipt = { status?: string; message?: string; details?: { error?: string } };

async function fetchReceipts(ids: string[]): Promise<Record<string, Receipt> | null> {
    const response = await fetch(RECEIPTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ids }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: Record<string, Receipt> };
    return payload?.data ?? {};
}

export async function processPushReceipts(supabase: SupabaseClient, now: Date = new Date()): Promise<ReceiptsResult> {
    const result: ReceiptsResult = { checked: 0, delivered: 0, failed: 0, deadTokens: 0 };
    try {
        const { data, error } = await supabase
            .from(TABLE)
            .select('ticket_id, expo_push_token')
            .eq('status', 'pending')
            .lte('created_at', new Date(now.getTime() - READY_MS).toISOString())
            .gte('created_at', new Date(now.getTime() - EXPIRED_MS).toISOString())
            .order('created_at', { ascending: true })
            .limit(MAX_PER_RUN);
        if (error) {
            console.warn('[push-receipts] bilhetes por ler:', error.message);
            return result;
        }

        const rows = (data || []) as { ticket_id: string; expo_push_token: string }[];
        for (let start = 0; start < rows.length; start += BATCH) {
            const batch = rows.slice(start, start + BATCH);
            const receipts = await fetchReceipts(batch.map((row) => row.ticket_id));
            if (!receipts) continue; // A próxima corrida tenta outra vez.

            const ok: string[] = [];
            for (const row of batch) {
                const receipt = receipts[row.ticket_id];
                if (!receipt) continue; // Ainda sem recibo.
                result.checked += 1;
                if (receipt.status === 'ok') {
                    ok.push(row.ticket_id);
                    result.delivered += 1;
                    continue;
                }
                result.failed += 1;
                const code = receipt.details?.error ?? 'unknown';
                await supabase.from(TABLE)
                    .update({ status: 'error', error: code.slice(0, 80), checked_at: now.toISOString() })
                    .eq('ticket_id', row.ticket_id);
                if (code === 'DeviceNotRegistered') {
                    // Só o token: a linha diz também quando a pessoa usou a app pela última vez.
                    await supabase.from('member_devices')
                        .update({ expo_push_token: null })
                        .eq('expo_push_token', row.expo_push_token);
                    result.deadTokens += 1;
                } else {
                    console.warn(`[push-receipts] recibo com erro: ${code}`);
                }
            }
            if (ok.length > 0) {
                await supabase.from(TABLE)
                    .update({ status: 'ok', checked_at: now.toISOString() })
                    .in('ticket_id', ok);
            }
        }

        await supabase.from(TABLE).delete().lt('created_at', new Date(now.getTime() - KEEP_MS).toISOString());
    } catch (error) {
        console.warn('[push-receipts] passo falhou:', error);
    }
    return result;
}
