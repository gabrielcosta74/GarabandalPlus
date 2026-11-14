/**
 * Texto da reativação (quem não abre a app há 30 dias).
 *
 * O texto vive em `push_automation_settings` para a equipa o poder mudar sem
 * deploy. Pode levar `{pedidos}`: o número de pedidos de oração publicados na
 * comunidade desde a última visita da pessoa — um motivo verdadeiro para
 * voltar, em vez de um convite genérico. Com menos de dois pedidos o número
 * não convence, e sai um texto fixo sem ele.
 */
export const REQUESTS_TOKEN = '{pedidos}';

/** O mural mostra os pedidos dos últimos 30 dias; contar mais atrás seria prometer o que já lá não está. */
export const REQUESTS_WINDOW_DAYS = 30;

export type RequestRow = { user_id: string; created_at: string };

export function usesRequestsCount(copy: { title: string; body: string }) {
    return copy.title.includes(REQUESTS_TOKEN) || copy.body.includes(REQUESTS_TOKEN);
}

/** Pedidos de outras pessoas publicados depois da última visita (dentro da janela do mural). */
export function requestsSince(rows: RequestRow[], userId: string, lastSeenAt: string | null, now: Date) {
    const windowStart = now.getTime() - REQUESTS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const lastSeen = lastSeenAt ? Date.parse(lastSeenAt) : Number.NaN;
    const since = Number.isFinite(lastSeen) ? Math.max(lastSeen, windowStart) : windowStart;
    return rows.filter((row) => row.user_id !== userId && Date.parse(row.created_at) > since).length;
}

export function reactivationCopy(template: { title: string; body: string }, english: boolean, requests: number | null) {
    if (!usesRequestsCount(template)) return template;
    if (requests !== null && requests >= 2) {
        const count = String(requests);
        return { title: template.title.split(REQUESTS_TOKEN).join(count), body: template.body.split(REQUESTS_TOKEN).join(count) };
    }
    return english
        ? { title: 'Prayer requests', body: 'People in the community are asking for prayer. Pray for one.' }
        : { title: 'Pedidos de oração', body: 'Há pedidos de oração na comunidade. Reze por um.' };
}
