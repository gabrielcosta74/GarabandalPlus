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
