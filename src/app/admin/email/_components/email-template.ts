import { EMAIL_FONT, inlineEmailStyles } from './email-html';

/**
 * Modelo do Apostolado para os emails escritos na caixa geral, e a assinatura.
 *
 * Tudo em tabelas e estilos inline: é o único HTML que o Gmail, o Outlook
 * (incluindo o do Windows) e o Mail do iPhone mostram da mesma maneira.
 */

const SITE = 'https://apostoladodegarabandal.com';
const LOGO = `${SITE}/apple-touch-icon.png`;
const HANDWRITTEN = `${SITE}/images/assinatura-garabandal.png`;

const INK = '#0f172a';
const TEXT = '#1f2937';
const MUTED = '#64748b';
const GOLD = '#d4af37';
// O dourado da marca é claro demais para texto em fundo branco.
const GOLD_TEXT = '#9a7b1f';
const SERIF = "Georgia, 'Times New Roman', serif";

export type SignatureSettings = {
    enabled: boolean;
    name: string;
    role: string;
    phone: string;
    handwritten: boolean;
};

export const DEFAULT_SIGNATURE: SignatureSettings = {
    enabled: true,
    name: 'Rui Costa',
    role: 'Apostolado de Garabandal',
    phone: '',
    handwritten: false,
};

const esc = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Com `logo` a assinatura leva o ícone; dentro do modelo não, que o cabeçalho já o tem. */
export function signatureHtml(sig: SignatureSettings, from: string | null, { logo = true }: { logo?: boolean } = {}) {
    if (!sig.enabled || !sig.name.trim()) return '';
    const email = from || 'geral@apostoladodegarabandal.com';
    const phone = sig.phone.trim();
    const contacts = [
        `<a href="mailto:${esc(email)}" style="color:${MUTED};text-decoration:none;">${esc(email)}</a>`,
        `<a href="${SITE}" style="color:${MUTED};text-decoration:none;">apostoladodegarabandal.com</a>`,
        ...(phone ? [`<a href="tel:${esc(phone.replace(/[^\d+]/g, ''))}" style="color:${MUTED};text-decoration:none;">${esc(phone)}</a>`] : []),
    // Espaços normais à volta do "·": a linha tem de poder partir no telemóvel.
    ].join(`<span style="color:#cbd5e1;"> &nbsp;·&nbsp; </span>`);

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;border-collapse:collapse;">
  ${sig.handwritten ? `<tr><td style="padding:0 0 2px;"><img src="${HANDWRITTEN}" width="132" alt="" style="display:block;width:132px;height:auto;border:0;margin-left:-14px;" /></td></tr>` : ''}
  <tr>
    <td style="padding:0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>
          ${logo ? `<td valign="middle" style="padding:0 14px 0 0;">
            <img src="${LOGO}" width="46" height="46" alt="Apostolado de Garabandal" style="display:block;width:46px;height:46px;border:0;border-radius:50%;" />
          </td>` : ''}
          <td valign="middle" style="padding:0 0 0 14px;border-left:2px solid ${GOLD};">
            <div style="font-family:${SERIF};font-size:17px;line-height:1.25;color:${INK};font-weight:bold;">${esc(sig.name.trim())}</div>
            ${sig.role.trim() ? `<div style="font-family:${EMAIL_FONT};font-size:12px;line-height:1.5;color:${GOLD_TEXT};letter-spacing:0.08em;text-transform:uppercase;font-weight:bold;padding-top:3px;">${esc(sig.role.trim())}</div>` : ''}
            <div style="font-family:${EMAIL_FONT};font-size:12.5px;line-height:1.6;color:${MUTED};padding-top:5px;">${contacts}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}

/** Texto simples da assinatura (parte text/plain do email). */
export function signatureText(sig: SignatureSettings, from: string | null) {
    if (!sig.enabled || !sig.name.trim()) return '';
    return ['--', sig.name.trim(), sig.role.trim(), [from || 'geral@apostoladodegarabandal.com', 'apostoladodegarabandal.com', sig.phone.trim()].filter(Boolean).join(' · ')]
        .filter(Boolean)
        .join('\n');
}

const quoteBlock = (quote: string) =>
    quote ? `<div style="margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;font-family:${EMAIL_FONT};font-size:13px;line-height:1.5;color:#6b7280;">${inlineEmailStyles(quote)}</div>` : '';

/**
 * Junta texto + assinatura + mensagem original. Com `branded`, dentro do
 * cartão do Apostolado (logótipo, linha dourada e rodapé); sem ele, como um
 * email normal.
 */
export function buildEmail({ body, quote, signature, from, branded }: {
    body: string;
    quote?: string;
    signature: SignatureSettings;
    from: string | null;
    branded: boolean;
}) {
    const content = `${inlineEmailStyles(body)}${signatureHtml(signature, from, { logo: !branded })}${quoteBlock(quote || '')}`;

    if (!branded) {
        return `<div style="font-family:${EMAIL_FONT};font-size:14px;line-height:1.6;color:${TEXT};">${content}</div>`;
    }

    return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<style>
  @media (max-width: 480px) {
    .mbx-pad { padding-left: 20px !important; padding-right: 20px !important; }
    .mbx-outer { padding: 12px 6px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;border-collapse:collapse;">
  <tr>
    <td align="center" class="mbx-outer" style="padding:28px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-collapse:separate;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
        <tr><td style="height:3px;line-height:3px;font-size:0;background:${GOLD};">&nbsp;</td></tr>
        <tr>
          <td class="mbx-pad" style="padding:22px 36px 18px;border-bottom:1px solid #f1f2f4;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td valign="middle" style="padding:0 12px 0 0;">
                  <a href="${SITE}" style="text-decoration:none;"><img src="${LOGO}" width="38" height="38" alt="" style="display:block;width:38px;height:38px;border:0;border-radius:50%;" /></a>
                </td>
                <td valign="middle" style="padding:0;">
                  <a href="${SITE}" style="text-decoration:none;">
                    <div style="font-family:${SERIF};font-size:18px;line-height:1.2;color:${INK};font-weight:bold;">Apostolado de Garabandal</div>
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="mbx-pad" style="padding:30px 36px 34px;font-family:${EMAIL_FONT};font-size:15px;line-height:1.65;color:${TEXT};">
            ${content}
          </td>
        </tr>
        <tr>
          <td class="mbx-pad" style="padding:16px 36px 18px;background:#fafafa;border-top:1px solid #f1f2f4;font-family:${EMAIL_FONT};font-size:11.5px;line-height:1.6;color:#9ca3af;">
            Apostolado de Garabandal &nbsp;·&nbsp; <a href="${SITE}" style="color:#9ca3af;text-decoration:underline;">apostoladodegarabandal.com</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
