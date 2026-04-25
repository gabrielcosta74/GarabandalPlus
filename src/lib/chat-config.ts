// Shared chat/contact config used by server prompt + client widget.
export const WHATSAPP_NUMBER = '351915206815';
export const CONTACT_EMAIL = 'geral@apostoladodegarabandal.com';

// Phrase the assistant emits when it doesn't have specific info.
// The widget watches for this to show the WhatsApp escalation CTA.
export const ESCALATION_MARKER = 'Essa informação específica não tenho';

export function buildWhatsAppLink(pilgrimageTitle?: string, prefilled?: string) {
    const base = `https://wa.me/${WHATSAPP_NUMBER}`;
    const msg = prefilled
        ? prefilled
        : pilgrimageTitle
            ? `Olá, estou interessado na ${pilgrimageTitle} e tenho uma dúvida.`
            : 'Olá, tenho uma dúvida sobre uma peregrinação.';
    return `${base}?text=${encodeURIComponent(msg)}`;
}
