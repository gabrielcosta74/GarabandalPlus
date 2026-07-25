import fs from 'fs';
import path from 'path';
import { APP_URL } from './config';
import { INTEREST_MARKER } from './chat-config';
import {
    formatFlightEstimate,
    getCountryBasedFlightPolicy,
} from './pilgrimage-flight-policy';

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
    const money = (v: unknown) => (v === null || v === undefined) ? 'N/D' : `${Number(v).toFixed(2)}€`;
    const list = (arr: unknown) => Array.isArray(arr) && arr.length ? arr.map((x: unknown) => `- ${typeof x === 'string' ? x : JSON.stringify(x)}`).join('\n') : '(nenhum)';
    const oneLine = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim();
    const cleanSlug = String(p.slug || '').trim();
    const pilgrimageUrl = cleanSlug ? `${APP_URL}/peregrinacoes/${cleanSlug}` : `${APP_URL}/peregrinacoes`;
    const registrationUrl = cleanSlug ? `${APP_URL}/peregrinacoes/${cleanSlug}/inscrever` : `${APP_URL}/peregrinacoes`;
    const pdfUrl = cleanSlug ? `${APP_URL}/api/pilgrimages/${cleanSlug}/pdf` : '';
    const pdfBrlUrl = cleanSlug ? `${APP_URL}/api/pilgrimages/${cleanSlug}/pdf?currency=BRL` : '';

    const vacanciesRaw = typeof p.effective_vacancies === 'number'
        ? p.effective_vacancies
        : typeof p.current_vacancies === 'number'
            ? p.current_vacancies
            : null;
    const availabilityLabel = p.status === 'waitlist' || p.status === 'closed' || vacanciesRaw === 0
        ? 'Lista de espera / esgotado'
        : typeof vacanciesRaw === 'number' && vacanciesRaw > 0
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
            .map(i => `Dia ${i.day_number} — ${i.title}\n${(i.description || '').trim()}`)
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
    const supplementsText = Object.keys(supplements).length
        ? Object.entries(supplements).map(([k, v]) => `- ${supplementLabel(k)}: +${money(v)}`).join('\n')
        : '(ver na página da peregrinação)';
    const singleSupplement = supplements.single ?? null;

    const countryBasedFlightPolicy = getCountryBasedFlightPolicy(p);
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
PEREGRINAÇÃO ATUAL: ${p.title}
Slug: ${p.slug}
Descrição: ${p.description || '(sem descrição)'}
Link da página: ${pilgrimageUrl}
Link de inscrição/lista de espera: ${registrationUrl}
Link do PDF/programa: ${pdfUrl}
Link do PDF com valores aproximados em BRL: ${pdfBrlUrl}

DATAS:
- Início: ${fmtDate(p.start_date)}
- Fim: ${fmtDate(p.end_date)}
- Data limite de inscrição: ${fmtDate(p.registration_deadline)}

PREÇOS:
- Valor total apresentado no site para o terrestre, sem voo/passagem aérea: ${hasDisplayedPrice ? money(totalDisplayedPrice) : 'N/D'}
- Composição do valor: restante/base ${money(p.base_price)} + 1ª doação/taxa de inscrição ${money(p.deposit_value)}
- Se perguntarem "custo total da viagem", explicar que o terrestre é o valor acima e que voo, seguro, despesas pessoais, quarto individual e outros extras podem alterar o total conforme a pessoa.
- Se perguntarem em reais/BRL, dizer que o preço contratual é em euros; para valor aproximado em BRL, indicar o PDF com currency=BRL ou explicar que depende do câmbio do dia. Não inventar cotação.
- Suplementos de quarto:
${supplementsText}
- Suplemento de quarto individual: ${singleSupplement !== null && singleSupplement !== undefined ? `+${money(singleSupplement)}` : 'não publicado no contexto'}

VAGAS:
- Disponibilidade pública: ${availabilityLabel}
- Não indicar números exatos de vagas; usar apenas "lugares limitados", "últimas vagas" ou "lista de espera/esgotado".
- Se a disponibilidade pública for lista de espera/esgotado, o próximo passo é entrar na lista de espera/deixar contacto; não dizer que há vaga confirmada.
${availabilityLabel === 'Lista de espera / esgotado'
            ? `- Esta peregrinação está em LISTA DE ESPERA devido à grande procura${isNovemberPilgrimage ? ' (a de novembro tem tido uma procura enorme)' : ''}. Segue a secção "Lista de Espera e Peregrinações Esgotadas" da base de conhecimento.
- Enquadra um lugar como uma graça/chance: quem sente o chamado deve agir com urgência serena, sem deixar para depois.
- Fala sempre em POSSIBILIDADE de abrir mais lugares (por causa da procura) ou de surgir vaga por desistência/reorganização. NUNCA garantas vaga nem prometas que "vamos aumentar" os lugares.
- REFORÇA a seleção limitada: com tanta procura, o Apostolado vai poder escolher apenas um número limitado de pessoas entre os interessados. Quem mostra interesse já e fala no WhatsApp aumenta a possibilidade de ser considerado/selecionado. Nunca prometas que a pessoa será selecionada.
- Passos a oferecer, por ordem: (1) clicar em "Estou mesmo interessado em ir" (regista o interesse junto do Apostolado para ser considerado na seleção); (2) falar já no WhatsApp com urgência; (3) entrar na lista de espera deixando contacto.
- IMPORTANTE (sinal técnico): quando a pessoa demonstrar vontade real de ir (ex.: "quero ir", "adorava ir", "ainda dá para entrar", "como faço para ir", "quero garantir a minha vaga"), termina a tua resposta acrescentando, na última linha e sozinho, exatamente o token ${INTEREST_MARKER}. Não expliques o token, não o alteres e não escrevas nada depois dele. Ele faz aparecer o botão "Estou interessado em ir".`
            : ''}

PONTO DE ENCONTRO: ${p.meeting_point_text || 'N/D'}
FIM DA PEREGRINAÇÃO: ${p.meeting_end_text || 'N/D'}

VOOS / AÉREO:
- Resumo para resposta curta: ${flightSummary}
- Voo próprio / encontro com o grupo: ${ownFlightSummary}
- Detalhes de voo de grupo/agência: ${p.group_flight_details || '(não publicado no contexto)'}
- Valor de referência do voo de grupo/agência: ${p.flight_price_from ? money(p.flight_price_from) : 'não publicado no contexto'}
- Se perguntarem nome/telefone da agência e não estiver nos detalhes acima, dizer que essa informação específica não está publicada e encaminhar para WhatsApp/email.
${countryBasedFlightPolicy
    ? '- Nesta peregrinação a regra não é uma preferência: para residentes em Portugal/Brasil o pacote da agência é obrigatório; para todos os outros países, os voos próprios são obrigatórios. Não apresentar alternativas.'
    : '- Quando houver voo organizado/agência publicado, recomendar essa opção com carinho: ajuda a pessoa a viajar acompanhada, chegar com outros peregrinos e, quando aplicável, voar com o sacerdote/diretor espiritual. Também ajuda a apoiar as despesas de voo do sacerdote. Fazer isto como convite, nunca como pressão.'}

PLANO DE PAGAMENTO:
${p.payment_plan_text || '(ver condições gerais)'}
- Prazo geral de pagamento quando não houver data mais específica: as prestações devem terminar um mês antes do início da peregrinação, conforme condições gerais.

POLÍTICA DE CANCELAMENTO (resumo oficial desta peregrinação):
${p.cancellation_policy_text || '(ver condições gerais)'}
Resumo conversacional: ${cancellationSummary}

INCLUI:
${list(p.included_items)}

NÃO INCLUI:
${list(p.not_included_items)}
- Se perguntarem ementa/menu/cardápio específico, explicar que as ementas são definidas pelos próprios hotéis e restaurantes e normalmente não são conhecidas com antecedência. Há cuidado com alergias alimentares: a pessoa deve indicar alergias/restrições no formulário para que seja pedida uma refeição alternativa.

RESUMO DO ITINERÁRIO:
${p.itinerary_summary || '(ver página da peregrinação)'}

ITINERÁRIO DIA-A-DIA:
${itineraryBlock}

OUTRAS PEREGRINAÇÕES FUTURAS PUBLICADAS (usar apenas quando perguntarem por outras datas, meses ou anos):
${relatedBlock}

REGRA PARA DATAS AINDA NAO PUBLICADAS:
- Por norma, as peregrinações do Apostolado costumam ser agendadas para abril, outubro e novembro, mas pode haver exceções. Se perguntarem por setembro, 2027 ou outro mês/ano ainda não publicado, explicar isso e convidar a acompanhar a página ou falar com o Apostolado.
    `.trim();
}
