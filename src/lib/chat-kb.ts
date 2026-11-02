import fs from 'fs';
import path from 'path';
import { APP_URL } from './config';
import { INTEREST_MARKER } from './chat-config';
import {
    formatFlightEstimate,
    getCountryBasedFlightPolicy,
    getFlightRegistrationOptions,
} from './pilgrimage-flight-policy';
import {
    getConfiguredInstallmentDeadline,
    getMaxInstallments,
} from './pilgrimage-installments';
import { richTextToPlain } from './rich-text';

let cachedKb: string | null = null;

export function _resetCache() {
    cachedKb = null;
}

export function loadGeneralKb(): string {
    if (cachedKb) return cachedKb;
    const dir = path.join(process.cwd(), 'src', 'lib', 'chat-kb');
    try {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();
        cachedKb = files.map(f => {
            const content = fs.readFileSync(path.join(dir, f), 'utf8').trim();
            return `<<<FILE: ${f}>>>\n${content}`;
        }).join('\n\n');
    } catch (e) {
        console.error('[chat-kb] Failed to load KB:', e);
        cachedKb = '';
    }
    return cachedKb;
}

type Pilgrimage = {
    title?: string | null;
    slug?: string | null;
    description?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    registration_deadline?: string | null;
    base_price?: number | null;
    deposit_value?: number | null;
    effective_vacancies?: number | null;
    current_vacancies?: number | null;
    status?: string | null;
    meeting_point_text?: string | null;
    meeting_end_text?: string | null;
    flight_info_text?: string | null;
    flight_price_from?: number | null;
    group_flight_details?: string | null;
    payment_plan_text?: string | null;
    cancellation_policy_text?: string | null;
    included_items?: unknown;
    not_included_items?: unknown;
    itinerary_summary?: string | null;
    pricing_config?: {
        room_supplements?: Record<string, number | null | undefined>;
        flight_registration_policy?: unknown;
        flight_registration_options?: unknown;
        installment_deadline?: unknown;
    } | null;
};
type ItineraryItem = { day_number: number; title: string; description: string };
type RelatedPilgrimage = {
    title?: string | null;
    slug?: string | null;
    start_date?: string | null;
    status?: string | null;
    current_vacancies?: number | null;
    effective_vacancies?: number | null;
    base_price?: number | null;
    deposit_value?: number | null;
};

export function buildPilgrimageContext(
    p: Pilgrimage | null,
    itinerary: ItineraryItem[] = [],
    relatedPilgrimages: RelatedPilgrimage[] = []
): string {
    if (!p) return 'NENHUMA peregrinação específica foi selecionada — responde apenas a perguntas gerais.';

    const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/D';
    // "2350.00€" read as a machine dump and the model copied it verbatim; whole
    // euros drop the decimals so it can format the number for the reader's language.
    const money = (v: unknown) => {
        if (v === null || v === undefined || !Number.isFinite(Number(v))) return 'N/D';
        const n = Number(v);
        return `${Number.isInteger(n) ? n : n.toFixed(2)} €`;
    };
    // Admin fields are TipTap HTML; raw <p> tags cost tokens and blur the facts.
    const plain = (value?: string | null) => richTextToPlain(value);
    const list = (arr: unknown) => Array.isArray(arr) && arr.length ? arr.map((x: unknown) => `- ${typeof x === 'string' ? x : JSON.stringify(x)}`).join('\n') : '(nenhum)';
    const oneLine = (value?: string | null) => plain(value);
    const cleanSlug = String(p.slug || '').trim();
    const pilgrimageUrl = cleanSlug ? `${APP_URL}/peregrinacoes/${cleanSlug}` : `${APP_URL}/peregrinacoes`;
    const registrationUrl = cleanSlug ? `${APP_URL}/peregrinacoes/${cleanSlug}/inscrever` : `${APP_URL}/peregrinacoes`;

    const vacanciesRaw = typeof p.effective_vacancies === 'number'
        ? p.effective_vacancies
        : typeof p.current_vacancies === 'number'
            ? p.current_vacancies
            : null;
    // Exact counts stay hidden while there is comfortable availability, but below 5
    // the real number is the honest urgency — so the assistant may state it.
    const isSoldOut = p.status === 'waitlist' || p.status === 'closed' || vacanciesRaw === 0;
    const canRevealCount = !isSoldOut && typeof vacanciesRaw === 'number' && vacanciesRaw > 0 && vacanciesRaw < 5;
    const availabilityLabel = isSoldOut
        ? 'Lista de espera / esgotado'
        : canRevealCount
            ? (vacanciesRaw === 1 ? 'Resta apenas 1 vaga' : `Restam apenas ${vacanciesRaw} vagas`)
            : 'Lugares limitados';
    const isNovemberPilgrimage = [p.slug, p.title]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes('novembro'));

    const totalDisplayedPrice = Number(p.base_price || 0) + Number(p.deposit_value || 0);
    const hasDisplayedPrice = Number.isFinite(totalDisplayedPrice) && totalDisplayedPrice > 0;

    const itineraryBlock = itinerary.length
        ? itinerary
            .sort((a, b) => a.day_number - b.day_number)
            .map(i => `Dia ${i.day_number} — ${plain(i.title)}\n${plain(i.description)}`)
            .join('\n\n')
        : '(itinerário detalhado não disponível)';

    const supplements = p.pricing_config?.room_supplements || {};
    const supplementLabel = (key: string) => {
        const labels: Record<string, string> = {
            single: 'quarto individual',
            double: 'quarto duplo',
            triple: 'quarto triplo',
            quadruple: 'quarto quádruplo',
        };
        return labels[key] || key;
    };
    // A zero supplement rendered as "+0.00€" invited the model to improvise, so it is
    // spelled out. The list below is the complete set of room types on offer — the
    // generic KB lists only single/double/triple and was making the chat drop the
    // quadruple option on pilgrimages that have it.
    const supplementsText = Object.keys(supplements).length
        ? Object.entries(supplements)
            .map(([k, v]) => `- ${supplementLabel(k)}: ${Number(v) > 0 ? `+${money(v)}` : 'sem suplemento (incluído no valor apresentado)'}`)
            .join('\n')
        : '(ver na página da peregrinação)';
    const singleSupplement = supplements.single ?? null;

    // The chat used to quote payment_plan_text verbatim ("até 10x") and the generic
    // "one month before departure" rule. Both drift from what the form actually
    // offers: the plan is rebuilt from today's date against the configured deadline,
    // so someone registering late sees fewer instalments than the copy promises.
    const installmentDeadline = getConfiguredInstallmentDeadline(p);
    const maxInstallments = p.start_date
        ? getMaxInstallments(String(p.start_date), installmentDeadline)
        : null;
    const lastInstallmentDate = installmentDeadline
        ? fmtDate(installmentDeadline)
        : p.start_date
            ? `${fmtDate(p.start_date)} menos um mês (regra geral)`
            : 'N/D';

    // Affordability framing ("~185 €/mês") is the strongest answer to "quanto custa?",
    // and it has to be computed here so the model never does the division itself.
    const remainingAmount = Number(p.base_price || 0);
    const monthlyEstimate = maxInstallments && maxInstallments > 0 && remainingAmount > 0
        ? Math.ceil(remainingAmount / maxInstallments)
        : null;
    const today = new Date();
    const daysToStart = p.start_date
        ? Math.ceil((new Date(p.start_date).getTime() - today.getTime()) / 86_400_000)
        : null;

    const countryBasedFlightPolicy = getCountryBasedFlightPolicy(p);
    const flightRegistrationOptions = getFlightRegistrationOptions(p);
    const allowsAgencyFlight = flightRegistrationOptions.includes('agency');
    const allowsOwnFlight = flightRegistrationOptions.includes('own');
    const hasGroupFlight = Boolean(p.flight_price_from || oneLine(p.group_flight_details));
    const flightSummary = countryBasedFlightPolicy
        ? `A regra é obrigatória por país de residência: Portugal e Brasil contratam o pacote completo diretamente com a agência indicada pelo Apostolado; todos os restantes países compram os próprios voos. O aéreo nunca é somado ao valor terrestre da inscrição. Estimativa Brasil: ${formatFlightEstimate(countryBasedFlightPolicy.estimates_eur.BR)}. Estimativa Portugal: ${formatFlightEstimate(countryBasedFlightPolicy.estimates_eur.PT)}.`
        : hasGroupFlight
            ? `Há opção de voo de grupo/agência publicada. O valor do voo, quando indicado, é separado do terrestre${p.flight_price_from ? ` e tem valor de referência de ${money(p.flight_price_from)}` : ''}.`
            : 'Não há opção de voo de grupo/agência publicada nesta peregrinação. O valor apresentado no site é terrestre e o voo/passagem aérea não está incluído.';
    const ownFlightSummary = countryBasedFlightPolicy
        ? `Para residentes fora de Portugal e do Brasil: estar no ${countryBasedFlightPolicy.own_flight_schedule.rome_arrival.airport} até às ${countryBasedFlightPolicy.own_flight_schedule.rome_arrival.by} de 5 de abril de 2027; reservar Roma–Split para a tarde de 14 de abril; reservar Split–destino de regresso para a tarde de 17 de abril.`
        : p.flight_info_text
            ? oneLine(p.flight_info_text)
            : 'A pessoa pode tratar do próprio voo e encontrar o grupo no ponto indicado pela organização, quando essa opção estiver disponível na página.';

    const cancellationSummary = p.cancellation_policy_text
        ? 'Cancelamento pessoal: os valores já entregues em doações, incluindo a taxa/primeira doação de inscrição, não são reembolsados. A alternativa indicada é encontrar outra pessoa que ocupe o lugar na mesma peregrinação, quando aceite pela organização. Recomendar seguro de viagem quando a pessoa demonstrar receio.'
        : 'Usar as condições gerais de cancelamento da base de conhecimento e recomendar confirmação com a equipa.';

    const relatedList = relatedPilgrimages.length
        ? relatedPilgrimages
            .filter(item => item.slug && item.slug !== cleanSlug)
            .slice(0, 8)
            .map(item => {
                const relatedVacancies = typeof item.effective_vacancies === 'number'
                    ? item.effective_vacancies
                    : typeof item.current_vacancies === 'number'
                        ? item.current_vacancies
                        : null;
                const relatedAvailability = item.status === 'waitlist' || item.status === 'closed' || relatedVacancies === 0
                    ? 'lista de espera/esgotada'
                    : typeof relatedVacancies === 'number' && relatedVacancies <= 5
                        ? 'últimas vagas'
                        : 'lugares limitados';
                const relatedTotal = Number(item.base_price || 0) + Number(item.deposit_value || 0);
                const relatedPrice = relatedTotal > 0 ? `. Valor apresentado: ${money(relatedTotal)}` : '';
                return `- ${item.title || 'Peregrinação'} (${fmtDate(item.start_date)}): ${relatedAvailability}. Link: ${APP_URL}/peregrinacoes/${item.slug}${relatedPrice}`;
            })
            .join('\n')
        : '';
    const relatedBlock = relatedList || '(nenhuma outra peregrinação futura publicada no contexto)';

    return `
FACTOS RÁPIDOS (os números que mais convencem — usa-os tal como estão):
- Hoje: ${fmtDate(today.toISOString())}${daysToStart !== null && daysToStart > 0 ? ` · faltam ${daysToStart} dias para a partida` : ''}
- Valor terrestre total: ${hasDisplayedPrice ? money(totalDisplayedPrice) : 'N/D'} (= 1ª doação ${money(p.deposit_value)} paga até 5 dias após a inscrição + restante ${money(p.base_price)})
- Restante em até ${maxInstallments ?? 'N/D'} prestações mensais sem juros${monthlyEstimate ? `: cerca de ${monthlyEstimate} €/mês` : ''}${installmentDeadline ? `, a última em ${fmtDate(installmentDeadline)}` : ''}
- Voo: NÃO incluído no valor terrestre.
- Disponibilidade: ${availabilityLabel}

PEREGRINAÇÃO ATUAL: ${p.title}
Slug: ${p.slug}
Descrição: ${plain(p.description) || '(sem descrição)'}
Link da página: ${pilgrimageUrl}
Link de inscrição/lista de espera: ${registrationUrl}
NOTA: não existe roteiro/programa em PDF para descarregar. Nunca ofereças um PDF nem inventes um link de download. O itinerário está na página da peregrinação e no bloco "ITINERÁRIO DIA-A-DIA" mais abaixo — usa esse conteúdo para descrever o programa.

DATAS:
- Início: ${fmtDate(p.start_date)}
- Fim: ${fmtDate(p.end_date)}
- Data limite de inscrição: ${fmtDate(p.registration_deadline)}

PREÇOS:
- Valor total apresentado no site para o terrestre, sem voo/passagem aérea: ${hasDisplayedPrice ? money(totalDisplayedPrice) : 'N/D'}
- Composição do valor: restante/base ${money(p.base_price)} + 1ª doação/taxa de inscrição ${money(p.deposit_value)}
- Se perguntarem "custo total da viagem", explicar que o terrestre é o valor acima e que voo, seguro, despesas pessoais, quarto individual e outros extras podem alterar o total conforme a pessoa.
- Se perguntarem em reais/BRL, explicar que o valor contratual é sempre em euros e que o valor em reais depende do câmbio do dia e do banco/operadora usados; sugerir consultar a cotação no próprio banco. Não inventar cotação nem indicar PDFs.
- Suplementos de quarto (esta é a lista COMPLETA de tipos de quarto desta peregrinação — não acrescentes nem retires tipos, e indica sempre o valor de cada um):
${supplementsText}
- Suplemento de quarto individual: ${singleSupplement !== null && singleSupplement !== undefined ? `+${money(singleSupplement)}` : 'não publicado no contexto'}
- O valor do suplemento individual varia muito entre peregrinações. Usa SEMPRE o valor acima; nunca cites valores de outras peregrinações nem da base de conhecimento geral.

VAGAS:
- Disponibilidade pública: ${availabilityLabel}
${canRevealCount
            ? `- Restam MENOS DE 5 lugares, por isso PODES dizer o número exato (${vacanciesRaw}). Di-lo com urgência serena e verdadeira, como um convite a não deixar para depois, nunca como pressão.
- Se pedirem lugares para mais pessoas do que os ${vacanciesRaw} disponíveis, não desqualifiques ninguém: explica quantos lugares restam, convida a garantir já os que existem e a falar no WhatsApp para o Apostolado ver o que é possível fazer para o resto do grupo.`
            : '- NÃO indicar números exatos de vagas nem quantas pessoas já se inscreveram. Usar apenas "lugares limitados". O número exato só pode ser dito quando restarem menos de 5 lugares, o que não é o caso.'}
- Se a disponibilidade pública for lista de espera/esgotado, o próximo passo é entrar na lista de espera/deixar contacto; não dizer que há vaga confirmada.
${availabilityLabel === 'Lista de espera / esgotado'
            ? `- Esta peregrinação está em LISTA DE ESPERA devido à grande procura${isNovemberPilgrimage ? ' (a de novembro tem tido uma procura enorme)' : ''}. Segue a secção "Lista de Espera e Peregrinações Esgotadas" da base de conhecimento.
- Enquadra um lugar como uma graça/chance: quem sente o chamado deve agir com urgência serena, sem deixar para depois.
- Fala sempre em POSSIBILIDADE de abrir mais lugares (por causa da procura) ou de surgir vaga por desistência/reorganização. NUNCA garantas vaga nem prometas que "vamos aumentar" os lugares.
- REFORÇA a seleção limitada: com tanta procura, o Apostolado vai poder escolher apenas um número limitado de pessoas entre os interessados. Quem mostra interesse já e fala no WhatsApp aumenta a possibilidade de ser considerado/selecionado. Nunca prometas que a pessoa será selecionada.
- Passos a oferecer, por ordem: (1) clicar em "Estou mesmo interessado em ir" (regista o interesse junto do Apostolado para ser considerado na seleção); (2) falar já no WhatsApp com urgência; (3) entrar na lista de espera deixando contacto.
- IMPORTANTE (sinal técnico): quando a pessoa demonstrar vontade real de ir (ex.: "quero ir", "adorava ir", "ainda dá para entrar", "como faço para ir", "quero garantir a minha vaga"), termina a tua resposta acrescentando, na última linha e sozinho, exatamente o token ${INTEREST_MARKER}. Não expliques o token, não o alteres e não escrevas nada depois dele. Ele faz aparecer o botão "Estou interessado em ir".`
            : ''}

PONTO DE ENCONTRO: ${plain(p.meeting_point_text) || 'N/D'}
FIM DA PEREGRINAÇÃO: ${plain(p.meeting_end_text) || 'N/D'}

VOOS / AÉREO:
- Resumo para resposta curta: ${flightSummary}
- Voo próprio / encontro com o grupo: ${ownFlightSummary}
- Detalhes de voo de grupo/agência: ${plain(p.group_flight_details) || '(não publicado no contexto)'}
- Valor de referência do voo de grupo/agência: ${p.flight_price_from ? money(p.flight_price_from) : 'não publicado no contexto'}. Este é o ÚNICO valor de voo que existe — nunca cites outro.
- A QUEM SE APLICA o voo de grupo: só a quem parte do aeroporto/país indicado nos detalhes acima. A quem vem de outro país (ex.: EUA, Reino Unido, Canadá), não ofereças esse voo nem o seu preço: explica que compra o próprio voo e encontra o grupo no ponto de encontro.
- Se perguntarem nome/telefone da agência e não estiver nos detalhes acima, dizer que essa informação específica não está publicada e encaminhar para WhatsApp/email.
- OPÇÕES DE VOO QUE O FORMULÁRIO DESTA PEREGRINAÇÃO ACEITA: ${flightRegistrationOptions.join(', ')}.
${countryBasedFlightPolicy
    ? '- OBRIGATORIEDADE: nesta peregrinação a regra não é uma preferência. Para residentes em Portugal/Brasil o pacote da agência é obrigatório; para todos os outros países, os voos próprios são obrigatórios. Não apresentar alternativas.'
    : allowsAgencyFlight && allowsOwnFlight
        ? `- OBRIGATORIEDADE: nesta peregrinação as duas opções são VÁLIDAS e a escolha é da pessoa — pacote aéreo da agência OU passagens próprias. É PROIBIDO dizer que o pacote da agência é "obrigatório" para o Brasil, para Portugal ou para qualquer país: não é. Quem opta por voo próprio inscreve-se na mesma, escolhendo a opção de voo próprio no passo "Voos".
- Podes recomendar o voo da agência com carinho (viajar acompanhado, chegar com o grupo e, quando aplicável, voar com o sacerdote/diretor espiritual, ajudando a apoiar as despesas de voo do sacerdote), mas sempre como convite, nunca como obrigação nem pressão.`
        : allowsAgencyFlight
            ? '- OBRIGATORIEDADE: nesta peregrinação o formulário só aceita o pacote aéreo da agência. Não sugerir voo próprio.'
            : '- OBRIGATORIEDADE: nesta peregrinação o formulário só aceita voo próprio. Não prometer voo de grupo/agência.'}
- VENDA AVULSA DE TROÇOS: a agência parceira só vende o PACOTE AÉREO COMPLETO. Não vende troços separados (ex.: só o Roma–Split, só o regresso). Quem escolhe voo próprio trata dos três troços sozinho, respeitando os horários e o ponto de encontro do grupo indicados acima. Isto NÃO é motivo para escalar — é a regra e podes dizê-la.

PLANO DE PAGAMENTO:
${plain(p.payment_plan_text) || '(ver condições gerais)'}
- NÚMERO MÁXIMO DE PRESTAÇÕES PARA QUEM SE INSCREVER HOJE: ${maxInstallments !== null ? `${maxInstallments}` : 'N/D'}.
- DATA DA ÚLTIMA PRESTAÇÃO: ${lastInstallmentDate}.
- REGRA CRÍTICA: o número acima é o que o formulário realmente vai oferecer, calculado a partir de hoje. O texto do plano de pagamento pode mencionar um máximo maior (ex.: "até 10x") porque esse é o máximo de quem se inscreveu cedo — ele vai diminuindo à medida que o tempo passa. Quando perguntarem "posso pagar em prestações?" ou "em quantas prestações?", diz o número acima, não o número do texto promocional, e explica numa frase que o máximo depende do tempo que falta até à data da última prestação.
- Não repitas a regra genérica "terminam um mês antes do início" quando existir a data concreta acima: usa a data concreta.
- As prestações são mensais (dia 10 de cada mês) e sem juros. A 1ª doação/taxa de inscrição é paga à parte, até 5 dias após a inscrição, e não conta como prestação.

POLÍTICA DE CANCELAMENTO (resumo oficial desta peregrinação):
${plain(p.cancellation_policy_text) || '(ver condições gerais)'}
Resumo conversacional: ${cancellationSummary}

INCLUI:
${list(p.included_items)}

NÃO INCLUI:
${list(p.not_included_items)}
- Se perguntarem ementa/menu/cardápio específico, explicar que as ementas são definidas pelos próprios hotéis e restaurantes e normalmente não são conhecidas com antecedência. Há cuidado com alergias alimentares: a pessoa deve indicar alergias/restrições no formulário para que seja pedida uma refeição alternativa.

RESUMO DO ITINERÁRIO:
${plain(p.itinerary_summary) || '(ver página da peregrinação)'}

ITINERÁRIO DIA-A-DIA:
${itineraryBlock}

OUTRAS PEREGRINAÇÕES FUTURAS PUBLICADAS (usar apenas quando perguntarem por outras datas, meses ou anos):
${relatedBlock}

REGRA PARA DATAS AINDA NAO PUBLICADAS:
- Por norma, as peregrinações do Apostolado costumam ser agendadas para abril, outubro e novembro, mas pode haver exceções. Se perguntarem por setembro, 2027 ou outro mês/ano ainda não publicado, explicar isso e convidar a acompanhar a página ou falar com o Apostolado.
    `.trim();
}
