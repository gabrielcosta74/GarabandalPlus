import fs from 'fs';
import path from 'path';

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

type Pilgrimage = Record<string, any>;
type ItineraryItem = { day_number: number; title: string; description: string };

export function buildPilgrimageContext(p: Pilgrimage | null, itinerary: ItineraryItem[] = []): string {
    if (!p) return 'NENHUMA peregrinação específica foi selecionada — responde apenas a perguntas gerais.';

    const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/D';
    const money = (v: any) => (v === null || v === undefined) ? 'N/D' : `${Number(v).toFixed(2)}€`;
    const list = (arr: any) => Array.isArray(arr) && arr.length ? arr.map((x: any) => `- ${typeof x === 'string' ? x : JSON.stringify(x)}`).join('\n') : '(nenhum)';

    const vacanciesRaw = typeof p.effective_vacancies === 'number'
        ? p.effective_vacancies
        : typeof p.current_vacancies === 'number'
            ? p.current_vacancies
            : null;
    const availabilityLabel = p.status === 'waitlist' || p.status === 'closed' || vacanciesRaw === 0
        ? 'Lista de espera / esgotado'
        : typeof vacanciesRaw === 'number' && vacanciesRaw <= 5
            ? 'Últimas vagas'
            : 'Lugares limitados';

    const itineraryBlock = itinerary.length
        ? itinerary
            .sort((a, b) => a.day_number - b.day_number)
            .map(i => `Dia ${i.day_number} — ${i.title}\n${(i.description || '').trim()}`)
            .join('\n\n')
        : '(itinerário detalhado não disponível)';

    const supplements = p.pricing_config?.room_supplements || {};
    const supplementsText = Object.keys(supplements).length
        ? Object.entries(supplements).map(([k, v]) => `- ${k}: +${money(v)}`).join('\n')
        : '(ver na página da peregrinação)';

    return `
PEREGRINAÇÃO ATUAL: ${p.title}
Slug: ${p.slug}
Descrição: ${p.description || '(sem descrição)'}

DATAS:
- Início: ${fmtDate(p.start_date)}
- Fim: ${fmtDate(p.end_date)}
- Data limite de inscrição: ${fmtDate(p.registration_deadline)}

PREÇOS:
- Preço base (terrestre): ${money(p.base_price)}
- 1ª doação / taxa de inscrição: ${money(p.deposit_value)}
- Suplementos de quarto:
${supplementsText}

VAGAS:
- Disponibilidade pública: ${availabilityLabel}
- Não indicar números exatos de vagas; usar apenas "lugares limitados", "últimas vagas" ou "lista de espera/esgotado".

PONTO DE ENCONTRO: ${p.meeting_point_text || 'N/D'}
FIM DA PEREGRINAÇÃO: ${p.meeting_end_text || 'N/D'}

VOOS / AÉREO:
${p.flight_info_text || '(ver secção de opções de aéreo na página da peregrinação)'}

PLANO DE PAGAMENTO:
${p.payment_plan_text || '(ver condições gerais)'}

POLÍTICA DE CANCELAMENTO (resumo oficial desta peregrinação):
${p.cancellation_policy_text || '(ver condições gerais)'}

INCLUI:
${list(p.included_items)}

NÃO INCLUI:
${list(p.not_included_items)}

RESUMO DO ITINERÁRIO:
${p.itinerary_summary || '(ver página da peregrinação)'}

ITINERÁRIO DIA-A-DIA:
${itineraryBlock}
    `.trim();
}
