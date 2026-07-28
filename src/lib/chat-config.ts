// Shared chat/contact config used by server prompt + client widget.
export const WHATSAPP_NUMBER = '351915206815';
export const CONTACT_EMAIL = 'geral@apostoladodegarabandal.com';

// Phrases the assistant emits when it doesn't have specific info.
// The widget watches for these to show the WhatsApp escalation CTA.
export const ESCALATION_MARKER_PT = 'Essa informação específica não tenho';
export const ESCALATION_MARKER_EN = "I don't have that specific information";
export const ESCALATION_MARKERS = [ESCALATION_MARKER_PT, ESCALATION_MARKER_EN] as const;
export const ESCALATION_MARKER = ESCALATION_MARKER_PT;

// Hidden token the assistant appends at the very end of a reply when the person
// shows real desire to go on a waitlisted/sold-out pilgrimage. The widget detects
// it, strips it from the visible text, and renders the "Estou interessado em ir"
// one-tap WhatsApp CTA. Kept ASCII + bracketed so gpt-4o-mini emits it reliably.
export const INTEREST_MARKER = '[[QUERO_IR]]';

// --- Action tokens -------------------------------------------------------
// The assistant ends a reply with one or more of these tokens; the widget strips
// them from the visible text and renders real buttons instead. This exists because
// telling someone to "click the yellow button" fails on mobile, where the chat
// covers the page. INTEREST_MARKER above is the original member of this family.
export type ChatAction =
    | 'QUERO_IR'
    | 'INSCREVER'
    | 'LISTA_ESPERA'
    | 'PAGAR'
    | 'MINHAS_INSCRICOES'
    | 'VOOS'
    | 'WHATSAPP'
    | 'CONTACTO';

export const CHAT_ACTIONS: ChatAction[] = [
    'QUERO_IR',
    'INSCREVER',
    'LISTA_ESPERA',
    'PAGAR',
    'MINHAS_INSCRICOES',
    'VOOS',
    'WHATSAPP',
    'CONTACTO',
];

export const ACTION_LABELS: Record<ChatAction, { pt: string; en: string }> = {
    QUERO_IR: { pt: 'Estou mesmo interessado em ir', en: "I'm really interested in going" },
    INSCREVER: { pt: 'Iniciar Inscrição', en: 'Start Registration' },
    LISTA_ESPERA: { pt: 'Entrar na Lista de Espera', en: 'Join the Waiting List' },
    PAGAR: { pt: 'Pagar / ver o meu plano', en: 'Pay / see my plan' },
    MINHAS_INSCRICOES: { pt: 'Ver as minhas inscrições', en: 'See my registrations' },
    VOOS: { pt: 'Ver Opções de Voo', en: 'See Flight Options' },
    WHATSAPP: { pt: 'Falar no WhatsApp', en: 'Talk on WhatsApp' },
    CONTACTO: { pt: 'Deixar o meu contacto', en: 'Leave my contact' },
};

// Matches any [[TOKEN]] we know about, plus a trailing partial token still being
// streamed (so half-written markers never flash on screen).
const ACTION_PATTERN = new RegExp(`\\[\\[(${CHAT_ACTIONS.join('|')})\\]\\]`, 'g');

/**
 * Splits an assistant reply into the text the person should see and the actions
 * the widget should render. Tolerates the model repeating a token.
 */
export function parseChatActions(text: string): { visibleText: string; actions: ChatAction[] } {
    const actions: ChatAction[] = [];
    let visibleText = text.replace(ACTION_PATTERN, (_match, token: ChatAction) => {
        if (!actions.includes(token)) actions.push(token);
        return '';
    });

    // Hide a partial token mid-stream, e.g. "[[INSCRE" -> nothing yet.
    const openIdx = visibleText.lastIndexOf('[[');
    if (openIdx !== -1 && !visibleText.slice(openIdx).includes(']]')) {
        const tail = visibleText.slice(openIdx);
        if (CHAT_ACTIONS.some(a => `[[${a}]]`.startsWith(tail))) {
            visibleText = visibleText.slice(0, openIdx);
        }
    }

    // The model sometimes writes a token mid-sentence ("o acesso direto: [[PAGAR]].").
    // Removing it would leave orphaned punctuation, so tidy up what it left behind.
    visibleText = visibleText
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/[:;,-]\s*([.!?])/g, '$1')
        .replace(/\s+([.,!?;:])/g, '$1')
        .replace(/[:;,]\s*$/gm, '')
        .replace(/\n{3,}/g, '\n\n');

    return { visibleText: visibleText.trimEnd(), actions };
}

export function buildWhatsAppLink(pilgrimageTitle?: string, prefilled?: string, isEn?: boolean) {
    const base = `https://wa.me/${WHATSAPP_NUMBER}`;
    const msg = prefilled
        ? prefilled
        : pilgrimageTitle
            ? (isEn
                ? `Hello, I am interested in ${pilgrimageTitle} and have a question.`
                : `Olá, estou interessado na ${pilgrimageTitle} e tenho uma dúvida.`)
            : (isEn
                ? 'Hello, I have a question about a pilgrimage.'
                : 'Olá, tenho uma dúvida sobre uma peregrinação.');
    return `${base}?text=${encodeURIComponent(msg)}`;
}

// Pre-filled WhatsApp message for the "Estou interessado em ir" flow (waitlist /
// sold-out pilgrimages). Truthful urgency: acknowledges the waiting list and asks
// about the *possibility* of a spot — never assumes one is guaranteed.
export function buildInterestWhatsAppLink(pilgrimageTitle?: string, isEn?: boolean) {
    const base = `https://wa.me/${WHATSAPP_NUMBER}`;
    const subject = pilgrimageTitle
        ? (isEn ? `the ${pilgrimageTitle}` : `a ${pilgrimageTitle}`)
        : (isEn ? 'the November pilgrimage to Garabandal' : 'a peregrinação de novembro a Garabandal');
    const msg = isEn
        ? `Hello 🙏 I saw that ${subject} is on the waiting list, but I am REALLY interested in going. I understand only a limited number of people will be selected — I would love to be considered. Is there any possibility?`
        : `Olá 🙏 Vi que ${subject} está em lista de espera, mas estou MESMO muito interessado(a) em ir. Sei que só um número limitado de pessoas poderá ser selecionado — gostava muito de ser considerado(a). Há possibilidade?`;
    return `${base}?text=${encodeURIComponent(msg)}`;
}
