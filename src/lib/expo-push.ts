/**
 * Envio de push pela API do Expo.
 *
 * Nao ha SDK aqui de proposito. O `expo-server-sdk` traz uma arvore de
 * dependencias inteira para fazer um POST com um array de objectos; o que
 * poupava era a divisao em lotes de 100 e a validacao do formato do token, que
 * sao seis linhas cada uma.
 *
 * O QUE ESTA CAMADA GARANTE A QUEM CHAMA:
 *
 *  1. NAO LANCA. O Expo em baixo, um timeout, um JSON malformado — nada disso
 *     pode rebentar um cron que ainda tem outros membros para processar. Os
 *     erros voltam como contagem, nao como excepcao.
 *
 *  2. DIZ QUANTOS FORAM MESMO ACEITES. E por isso que o retorno tem `delivered`
 *     e nao um booleano: "enviei para 3 telefones e o Expo recusou 2" e uma
 *     resposta diferente de "enviei para 1", e a tabela de registo guarda a
 *     diferenca.
 *
 *  3. DEVOLVE OS TOKENS MORTOS. `DeviceNotRegistered` significa app desinstalada
 *     ou token rodado. Quem chama tem de os apagar, senao a tabela enche-se de
 *     destinos que nunca mais recebem nada e todos os envios seguintes pagam o
 *     custo de os tentar.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** O Expo aceita 100 mensagens por pedido. */
const CHUNK_SIZE = 100;

export type ExpoPushMessage = {
    to: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    /** Canal Android. Tem de existir na app antes de ser usado aqui. */
    channelId?: string;
    sound?: 'default' | null;
    badge?: number;
};

export type ExpoPushResult = {
    delivered: number;
    failed: number;
    /** Tokens a apagar: a app foi desinstalada ou o token rodou. */
    invalidTokens: string[];
};

/**
 * "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" ou o formato antigo "ExpoPushToken[...]".
 *
 * Vale a pena filtrar antes de enviar: um token malformado no meio de um lote
 * nao invalida o lote, mas gasta uma resposta de erro e polui as contagens.
 */
export function isExpoPushToken(token: string | null | undefined): boolean {
    if (!token) return false;
    return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token.trim());
}

function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

/**
 * Envia as mensagens e resume o que aconteceu.
 *
 * Um lote que falhe por inteiro (rede, 5xx do Expo) conta como falha de todas as
 * mensagens desse lote e nao impede os lotes seguintes de tentar.
 */
export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<ExpoPushResult> {
    const valid = messages.filter((message) => isExpoPushToken(message.to));
    const result: ExpoPushResult = {
        delivered: 0,
        failed: messages.length - valid.length,
        invalidTokens: [],
    };

    if (valid.length === 0) return result;

    for (const batch of chunk(valid, CHUNK_SIZE)) {
        try {
            const response = await fetch(EXPO_PUSH_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'Accept-Encoding': 'gzip, deflate',
                },
                body: JSON.stringify(batch),
            });

            if (!response.ok) {
                result.failed += batch.length;
                console.warn(`[expo-push] lote recusado: HTTP ${response.status}`);
                continue;
            }

            const payload = (await response.json()) as {
                data?: Array<{
                    status?: string;
                    message?: string;
                    details?: { error?: string };
                }>;
            };

            const tickets = payload?.data ?? [];

            tickets.forEach((ticket, index) => {
                if (ticket?.status === 'ok') {
                    result.delivered += 1;
                    return;
                }

                result.failed += 1;

                // O bilhete vem pela mesma ordem das mensagens do lote, e e assim
                // que se sabe QUAL token e que morreu.
                if (ticket?.details?.error === 'DeviceNotRegistered') {
                    const dead = batch[index]?.to;
                    if (dead) result.invalidTokens.push(dead);
                }
            });

            // Uma resposta mais curta do que o lote deixaria mensagens por
            // contabilizar e as contagens deixariam de fechar.
            if (tickets.length < batch.length) {
                result.failed += batch.length - tickets.length;
            }
        } catch (error) {
            result.failed += batch.length;
            console.warn('[expo-push] lote falhou:', error);
        }
    }

    return result;
}

/**
 * A hora local de quem recebe, a partir do fuso IANA guardado no dispositivo.
 *
 * Devolve null quando o fuso e desconhecido ou invalido — e quem chama decide o
 * que fazer com isso. Nao ha aqui nenhum "assume UTC": mandar uma notificacao a
 * uma hora inventada e exactamente o erro que este campo existe para evitar.
 */
export function localHourFor(timezone: string | null | undefined, now: Date = new Date()): number | null {
    if (!timezone) return null;

    try {
        const hour = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: 'numeric',
            hour12: false,
        }).format(now);

        const parsed = Number(hour);
        return Number.isFinite(parsed) ? parsed % 24 : null;
    } catch {
        // Fuso invalido (dados antigos, telefone mal configurado).
        return null;
    }
}
