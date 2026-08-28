/**
 * Push de reactivacao: falar com quem instalou a app e deixou de aparecer.
 *
 * PORQUE E QUE ISTO NAO E UM EMAIL. Os avisos de quota ja vao por email e sao
 * sobre dinheiro. Este e sobre oracao, e vai para o telefone de quem quis a app
 * — sao publicos e conversas diferentes. Nenhuma linha deste ficheiro fala de
 * pagamentos, e isso e uma regra e nao um acaso: a app esta na App Store e a
 * regra 3.1.3 nao permite encaminhar para pagamento externo.
 *
 * QUEM RECEBE, exactamente:
 *   - tem um dispositivo registado (ou seja: instalou a app),
 *   - com token e com o interruptor de push ligado,
 *   - sem sinal de vida ha mais de 30 dias,
 *   - que nao recebeu outro push destes nos ultimos 60 dias,
 *   - e sao 10 da manha NO FUSO DELE.
 *
 * O SINAL DE VIDA E O MAIOR DE DOIS. `member_activity` so regista quem abre
 * conteudos, oracoes ou novenas; quem entra para ver a sua quota e sai nao
 * deixa la nada. O batimento de `member_devices.last_seen_at` apanha esse caso.
 * Usar so um dos dois trataria como adormecido quem esteve la ontem.
 *
 * A HORA LOCAL NAO E UM DETALHE. Sao 98 membros no Brasil e 65 em Portugal,
 * quatro horas de diferenca. Um "sentimos a sua falta" as 6 da manha nao e um
 * erro tecnico, e uma desinstalacao. Quem nao tem fuso conhecido nao recebe:
 * mais vale nao enviar do que enviar a uma hora inventada.
 *
 * O cron corre DE HORA A HORA. E a janela de uma hora no fuso de cada um que faz
 * o trabalho de segmentacao — nao ha aqui nenhuma lista de paises.
 */
import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { localHourFor, sendExpoPush, type ExpoPushMessage } from '../../../../lib/expo-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Manha, no fuso de quem recebe. */
const SEND_HOUR_LOCAL = 10;

/** Sem sinal de vida ha mais de isto, e alguem que se afastou. */
const DORMANT_DAYS = 30;

/**
 * E ha quanto tempo tem de ter sido o ultimo destes.
 *
 * Deliberadamente o dobro do limiar de ausencia. Quem recebe isto e nao volta
 * esta a dizer alguma coisa, e a resposta certa a esse silencio nao e insistir
 * todos os meses. Duas vezes por ano, no maximo.
 */
const MIN_GAP_DAYS = 60;

/** O canal `avisos` da app. Tem de existir la antes de ser usado aqui. */
const CHANNEL = 'avisos';

const NOTIFICATION_TYPE = 'reactivation_30d';

/**
 * Convite, e nao cobranca.
 *
 * Quem nao abre a app ha um mes nao precisa de ser lembrado disso — precisa de
 * um motivo para voltar. Por isso o texto nao conta dias de ausencia nem diz
 * "sentimos a sua falta": abre uma porta e cala-se.
 */
const COPY = {
    pt: {
        title: 'Um momento de oração hoje 🕊️',
        body: 'A novena e as orações continuam aqui, sempre que quiser voltar.',
    },
    en: {
        title: 'A moment of prayer today 🕊️',
        body: 'The novena and the prayers are here whenever you want to return.',
    },
} as const;

type DeviceRow = {
    id: string;
    user_id: string;
    expo_push_token: string | null;
    timezone: string | null;
    locale: string | null;
    last_seen_at: string;
};

const localeOf = (value: string | null) =>
    (value || '').toLowerCase().startsWith('en') ? 'en' : 'pt';

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

export async function GET(request: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ message: 'Supabase nao configurado' }, { status: 500 });
    }

    const secret = process.env.CRON_SECRET || '';
    if (!secret) {
        return NextResponse.json({ message: 'CRON_SECRET não configurado.' }, { status: 500 });
    }
    if ((request.headers.get('authorization') || '') !== `Bearer ${secret}`) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Permite ver a seleccao sem enviar nada. Enquanto nao houver development
    // build nao existe um unico token na tabela, e esta e a unica forma de
    // confirmar que a escolha de destinatarios esta certa.
    const url = new URL(request.url);
    const dryRun = url.searchParams.get('dryRun') === '1';

    const now = new Date();
    const dormantBefore = daysAgo(DORMANT_DAYS);

    // Candidatos: quem pode mesmo receber. O filtro de ausencia por
    // `last_seen_at` ja corta aqui a maioria; a actividade confirma-se a seguir.
    const { data: devices, error: devicesError } = await supabaseServer
        .from('member_devices')
        .select('id, user_id, expo_push_token, timezone, locale, last_seen_at')
        .not('expo_push_token', 'is', null)
        .eq('push_enabled', true)
        .lt('last_seen_at', dormantBefore.toISOString());

    if (devicesError) {
        return NextResponse.json(
            { message: 'Erro ao carregar dispositivos', error: devicesError.message },
            { status: 500 },
        );
    }

    const rows = (devices || []) as DeviceRow[];
    const results: Array<{ userId: string; action: string; success: boolean }> = [];

    if (rows.length === 0) {
        return NextResponse.json({ ok: true, processed: 0, sent: 0, details: [], dryRun });
    }

    // Um membro pode ter mais do que um telefone. A decisao e por PESSOA — o
    // aparelho mais recente manda no fuso — mas o envio vai para todos os
    // aparelhos dela, que e onde quer que a notificacao apareca.
    const byUser = new Map<string, DeviceRow[]>();
    for (const row of rows) {
        const list = byUser.get(row.user_id) || [];
        list.push(row);
        byUser.set(row.user_id, list);
    }

    const userIds = [...byUser.keys()];

    // A outra metade do sinal de vida. Uma consulta so, para todos: por membro
    // isto seriam dezenas de idas a base de dados para responder a mesma coisa.
    const { data: activity } = await supabaseServer
        .from('member_activity')
        .select('user_id, created_at')
        .in('user_id', userIds)
        .gte('created_at', dormantBefore.toISOString());

    const activeRecently = new Set((activity || []).map((row: { user_id: string }) => row.user_id));

    // Quem ja recebeu um destes ha pouco. Mesma logica: uma consulta para todos.
    const { data: recentPushes } = await supabaseServer
        .from('push_notifications')
        .select('user_id, sent_at')
        .eq('type', NOTIFICATION_TYPE)
        .in('user_id', userIds)
        .not('sent_at', 'is', null)
        .gte('sent_at', daysAgo(MIN_GAP_DAYS).toISOString());

    const recentlyNudged = new Set(
        (recentPushes || []).map((row: { user_id: string }) => row.user_id),
    );

    for (const [userId, userDevices] of byUser) {
        if (activeRecently.has(userId)) {
            // Abriu uma oracao ou uma novena; `last_seen_at` e que ficou para tras.
            continue;
        }
        if (recentlyNudged.has(userId)) continue;

        // O aparelho que viu mais recentemente e o que provavelmente ainda usa,
        // e portanto o fuso dele e o que interessa.
        const newest = [...userDevices].sort(
            (a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime(),
        )[0];

        const hour = localHourFor(newest.timezone, now);
        if (hour === null) {
            results.push({ userId, action: 'skipped_unknown_timezone', success: false });
            continue;
        }
        if (hour !== SEND_HOUR_LOCAL) continue;

        const copy = COPY[localeOf(newest.locale)];
        const tokens = [
            ...new Set(
                userDevices
                    .map((device) => device.expo_push_token)
                    .filter((token): token is string => Boolean(token)),
            ),
        ];

        if (tokens.length === 0) continue;

        if (dryRun) {
            results.push({ userId, action: `dry_run_would_send_${tokens.length}`, success: true });
            continue;
        }

        // Marca a intencao ANTES de enviar. Se o processo morrer a meio, a
        // proxima corrida encontra a linha por enviar e tenta outra vez; o que
        // nao pode acontecer e enviar e nao ficar registo, porque ai a corrida
        // seguinte repetia o envio.
        //
        // NAO E UM UPSERT. Um upsert com `sent_at: null` no payload apagaria, ao
        // colidir, a data de um envio que ja tinha acontecido — e a linha que
        // servia de prova passaria a autorizar o reenvio. Ler primeiro e so
        // inserir o que falta e mais comprido e nao tem esse buraco.
        const reference = `${userId}:${now.toISOString().slice(0, 10)}`;

        const { data: existing } = await supabaseServer
            .from('push_notifications')
            .select('id, sent_at')
            .eq('type', NOTIFICATION_TYPE)
            .eq('reference', reference)
            .limit(1)
            .maybeSingle();

        if (existing?.sent_at) continue; // Ja saiu hoje.

        let recordId: string | null = existing?.id ?? null;

        if (!recordId) {
            const { data: inserted, error: insertError } = await supabaseServer
                .from('push_notifications')
                .insert({ user_id: userId, type: NOTIFICATION_TYPE, reference, sent_at: null })
                .select('id')
                .maybeSingle();

            if (insertError) {
                results.push({ userId, action: 'record_failed', success: false });
                continue;
            }

            recordId = (inserted as { id?: string } | null)?.id ?? null;
        }

        const messages: ExpoPushMessage[] = tokens.map((token) => ({
            to: token,
            title: copy.title,
            body: copy.body,
            channelId: CHANNEL,
            sound: 'default',
            data: { kind: 'reactivation', url: '/(tabs)' },
        }));

        const outcome = await sendExpoPush(messages);

        if (outcome.invalidTokens.length > 0) {
            // App desinstalada ou token rodado. Se ficassem, todas as corridas
            // seguintes tentavam entregar a destinos que nunca mais respondem.
            await supabaseServer
                .from('member_devices')
                .delete()
                .in('expo_push_token', outcome.invalidTokens);
        }

        if (outcome.delivered === 0) {
            results.push({ userId, action: 'push_not_delivered', success: false });
            continue;
        }

        if (recordId) {
            await supabaseServer
                .from('push_notifications')
                .update({ sent_at: new Date().toISOString(), delivered_count: outcome.delivered })
                .eq('id', recordId);
        }

        results.push({ userId, action: `reactivation_sent_${outcome.delivered}`, success: true });
    }

    return NextResponse.json({
        ok: true,
        processed: results.length,
        sent: results.filter((item) => item.success).length,
        dryRun,
        details: results,
    });
}
