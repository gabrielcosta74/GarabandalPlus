import { Resend } from "resend";
import { APP_URL, ASSETS_URL } from "./config";
import { applyStoreBookPromo, getStoreBookPromoRemainingMs, STORE_BOOK_PROMO } from "./store-promo";

/* -------------------------------------------------------------------------- */
/*                                    TYPES                                   */
/* -------------------------------------------------------------------------- */

export type MembershipNotificationInput = {
  kind: "new" | "renewal";
  memberName?: string | null;
  memberEmail?: string | null;
  memberNumber?: number | null;
  amount: number;
  currency?: string;
  paymentMethod: string;
  paymentReference?: string | null;
  nextQuotaDate?: string | null;
  paidAt?: string | null;
};

export type EmailLocale = "pt" | "en";

export type DonationNotificationInput = {
  donorName?: string | null;
  donorEmail?: string | null;
  amount: number;
  currency?: string;
  paymentMethod: string;
  paymentReference?: string | null;
  description?: string | null;
  paidAt?: string | null;
  status: string;
};

export type StoreItem = {
  name: string;
  qty: number;
  unit_price: number;
};

export type EmailAttachment = {
  filename: string;
  content: string | Buffer;
  contentType?: string;
};

export type MemberReceiptInput = {
  toEmail: string;
  memberName?: string | null;
  memberNumber?: number | null;
  amount: number;
  currency?: string;
  paymentMethod: string;
  paymentReference?: string | null;
  nextQuotaDate?: string | null;
  paidAt?: string | null;
  kind: "new" | "renewal";
  attachments?: EmailAttachment[];
  hasDiploma?: boolean;
  locale?: EmailLocale;
};

export type MemberDiplomaInput = {
  toEmail: string;
  memberName?: string | null;
  memberNumber: number;
  issuedAt?: string | null;
  attachments: EmailAttachment[];
  locale?: EmailLocale;
};

export type DonationReceiptInput = {
  toEmail: string;
  donorName?: string | null;
  amount: number;
  currency?: string;
  paymentReference?: string | null;
  paidAt?: string | null;
  method: string;
  locale?: EmailLocale;
};

export type QuotaReminderInput = {
  toEmail: string;
  memberName?: string | null;
  memberNumber?: number | null;
  daysUntilDue?: number | null;
  daysOverdue?: number | null;
  nextQuotaDate?: string | null;
  membershipUrl?: string | null;
  locale?: EmailLocale;
};

export type PilgrimagePaymentReminderInput = {
  toEmail: string;
  recipientName?: string | null;
  pilgrimageName: string;
  obligationLabel: string;
  dueDate: string;
  amountDue: number;
  totalRemaining: number;
  bookingUrl: string;
  stage:
    | 'upcoming_3d'
    | 'upcoming_1d'
    | 'upcoming_7d'
    | 'upcoming_2d'
    | 'due_today'
    | 'overdue_2d'
    | 'overdue_5d'
    | 'overdue_3d'
    | 'overdue_10d';
  locale?: EmailLocale;
};

export type GeneralLeadInput = {
  email: string;
  name?: string;
  locale?: EmailLocale;
};

export type BrochureEmailInput = {
  email: string;
  name: string;
  pilgrimageName: string;
  pdfUrl: string;
  locale?: EmailLocale;
};

export type AbandonmentRecoveryInput = {
  email: string;
  name: string;
  pilgrimageName: string;
  recoveryLink: string;
};

export type BookingAdminNotificationInput = {
  bookingId: string;
  pilgrimageName: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  numberOfPilgrims: number;
  paymentMethod: string;
};

export type PaymentReceiptAdminNotificationInput = {
  bookingId: string;
  pilgrimageName: string;
  customerName: string;
  customerEmail: string;
  installmentLabel: string;
  receiptUrl: string;
};

/* -------------------------------------------------------------------------- */
/*                                   THEME                                    */
/* -------------------------------------------------------------------------- */

const COLORS = {
  bg: "#eef2f8",
  white: "#FFFFFF",
  text: "#334155",
  textLight: "#64748B",
  heading: "#0F172A",
  primary: "#d4af37", // Garabandal Gold
  primaryDark: "#1a1306",
  primaryLight: "#FEFCE8",
  border: "#E2E8F0",
  success: "#16A34A",
  successBg: "#F0FDF4",
  error: "#DC2626",
  errorBg: "#FEF2F2",
  link: "#CA8A04",
};

const FONTS = {
  serif: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  sans: "'Helvetica Neue', Helvetica, Arial, sans-serif",
};

/* --------------------------- DIRECT CONTACT --------------------------------- */
/* Emails are sent from no-reply@, so copy must never say "reply to this email".
   Point recipients to WhatsApp (number shown on the site) or the staffed inbox. */
const WHATSAPP_CONTACT_URL = "https://wa.me/351915206815";
const CONTACT_EMAIL_ADDRESS = "geral@apostoladodegarabandal.com";
const contactWa = `<a href="${WHATSAPP_CONTACT_URL}" style="color:${COLORS.primary};font-weight:700;text-decoration:none;">WhatsApp</a>`;
const contactMail = `<a href="mailto:${CONTACT_EMAIL_ADDRESS}" style="color:${COLORS.primary};font-weight:700;text-decoration:none;">${CONTACT_EMAIL_ADDRESS}</a>`;

const WhatsAppButton = (locale: EmailLocale = "pt") => `
  <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:18px auto 0;">
    <tr>
      <td align="center" bgcolor="#25D366" style="border-radius:999px;background:#25D366;">
        <a href="${WHATSAPP_CONTACT_URL}" style="display:inline-block;color:#FFFFFF;font-weight:800;font-size:14px;line-height:1;text-decoration:none;padding:13px 24px;border-radius:999px;">
          ${locale === "en" ? "Chat with us on WhatsApp" : "Falar com a gente no WhatsApp"}
        </a>
      </td>
    </tr>
  </table>`;

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

export const formatCurrency = (value: number, currency = "EUR", locale: EmailLocale = "pt") =>
  new Intl.NumberFormat(locale === "en" ? "en-GB" : "pt-PT", { style: "currency", currency }).format(value);

export const formatDate = (value?: string | null, locale: EmailLocale = "pt") => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(locale === "en" ? "en-GB" : "pt-PT");
};

/* -------------------------------------------------------------------------- */
/*                                 COMPONENTS                                 */
/* -------------------------------------------------------------------------- */

const Layout = ({
  title,
  preview,
  children,
  locale = "pt",
  unsubscribeUrl,
}: {
  title: string;
  preview?: string;
  children: string;
  locale?: EmailLocale;
  unsubscribeUrl?: string | null;
}) => `
<!DOCTYPE html>
<html lang="${locale === "en" ? "en" : "pt"}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <title>${title}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    :root { color-scheme: light only; supported-color-schemes: light; }
    html, body { margin:0 !important; padding:0 !important; height:100% !important; width:100% !important; background:${COLORS.bg} !important; }
    * { -ms-text-size-adjust:100%; -webkit-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt !important; mso-table-rspace:0pt !important; border-collapse:collapse !important; }
    img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
    a { text-decoration:none; }
    .hover-gold:hover { background:#c49a2a !important; }
    @media only screen and (max-width:620px) {
      .container { width:100% !important; }
      .px { padding-left:24px !important; padding-right:24px !important; }
      .h1 { font-size:26px !important; line-height:32px !important; }
      .outer-pad { padding:24px 10px !important; }
    }
    @media (prefers-color-scheme: dark) {
      body, .email-bg, .outer-wrap { background:${COLORS.bg} !important; color:${COLORS.text} !important; }
      .email-card, .content-bg { background:${COLORS.white} !important; color:${COLORS.text} !important; }
      .email-text, p, div, span, td { color:${COLORS.text} !important; }
      .email-heading, h1, h2, h3, strong { color:${COLORS.heading} !important; }
      .hero-title, .hero-title div { color:#ffffff !important; }
      .hero-subtitle { color:#CBD5E1 !important; }
      .brand-text, .muted-text { color:${COLORS.textLight} !important; }
      .gold-badge, .gold-button { background:${COLORS.primary} !important; color:${COLORS.primaryDark} !important; }
      .gold-button a { color:${COLORS.primaryDark} !important; }
      .whatsapp-button, .whatsapp-button a { background:#25D366 !important; color:#ffffff !important; }
    }
    [data-ogsc] body, [data-ogsb] body, [data-ogsc] .email-bg, [data-ogsb] .email-bg, [data-ogsc] .outer-wrap, [data-ogsb] .outer-wrap { background:${COLORS.bg} !important; }
    [data-ogsc] .email-card, [data-ogsb] .email-card, [data-ogsc] .content-bg, [data-ogsb] .content-bg { background:${COLORS.white} !important; }
    [data-ogsc] .email-text, [data-ogsb] .email-text { color:${COLORS.text} !important; }
    [data-ogsc] .email-heading, [data-ogsb] .email-heading { color:${COLORS.heading} !important; }
    [data-ogsc] .hero-title, [data-ogsb] .hero-title { color:#ffffff !important; }
    [data-ogsc] .gold-badge, [data-ogsb] .gold-badge, [data-ogsc] .gold-button, [data-ogsb] .gold-button { background:${COLORS.primary} !important; color:${COLORS.primaryDark} !important; }
  </style>
</head>
<body bgcolor="${COLORS.bg}" style="margin:0;padding:0;background:${COLORS.bg};background-color:${COLORS.bg};font-family:${FONTS.sans};color:${COLORS.text};-webkit-font-smoothing:antialiased;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;color:${COLORS.bg};">
    ${preview || title}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${COLORS.bg}" class="email-bg" style="width:100%;background:${COLORS.bg};background-color:${COLORS.bg};">
    <tr>
      <td align="center" bgcolor="${COLORS.bg}" class="outer-pad outer-wrap" style="padding:32px 12px;background:${COLORS.bg};background-color:${COLORS.bg};">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="container" style="width:600px;max-width:600px;">
          <tr>
            <td align="center" style="padding:0 0 18px;">
              <span class="brand-text" style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${COLORS.textLight};font-weight:800;">Apostolado de Garabandal</span>
            </td>
          </tr>
          <tr>
            <td bgcolor="${COLORS.white}" class="email-card" style="background:${COLORS.white};background-color:${COLORS.white};border-radius:20px;overflow:hidden;box-shadow:0 18px 50px rgba(15,23,42,0.12);">
              ${children}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${COLORS.white}" class="content-bg" style="background:${COLORS.white};background-color:${COLORS.white};">
                <tr><td class="px" style="padding:0 40px;"><div style="border-top:1px solid #e7ebf3;font-size:0;line-height:0;">&nbsp;</div></td></tr>
                <tr>
                  <td align="center" class="px" style="padding:26px 40px 34px;text-align:center;">
                    <p class="email-heading" style="margin:0 0 8px;font-size:15px;line-height:22px;font-weight:800;color:${COLORS.heading};">${locale === "en" ? "Need help?" : "Precisa de ajuda?"}</p>
                    <p class="email-text" style="margin:0;font-size:13px;line-height:21px;color:${COLORS.textLight};">${locale === "en" ? `Message us on ${contactWa} or email ${contactMail}.` : `Fale com a gente pelo ${contactWa} ou por ${contactMail}.`}</p>
                    ${WhatsAppButton(locale)}
                    ${unsubscribeUrl ? `<p class="muted-text" style="margin:18px 0 0;font-size:11px;line-height:18px;color:${COLORS.textLight};">${locale === "en" ? `If you no longer wish to receive these emails, you can <a href="${unsubscribeUrl}" style="color:${COLORS.textLight};text-decoration:underline;">unsubscribe here</a>.` : `Se já não deseja receber estes emails, pode <a href="${unsubscribeUrl}" style="color:${COLORS.textLight};text-decoration:underline;">cancelar a subscrição aqui</a>.`}</p>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:22px 24px 0;">
              <p class="muted-text" style="margin:0;font-size:12px;line-height:18px;color:#94a3b8;">${title} &middot; Apostolado de Garabandal<br>${locale === "en" ? "Uniting FAITH and HOPE." : "Unindo FE e ESPERANCA."}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const Header = ({
  title,
  subtitle,
  image = `${APP_URL}/images/nossasenhoragarabandal.jpg`,
  category = "Apostolado",
}: {
  title: string;
  subtitle?: string;
  image?: string;
  category?: string;
}) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td background="${image}" valign="bottom" style="background:#0f172a url('${image}') center/cover no-repeat;background-size:cover;">
      <!--[if gte mso 9]>
      <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:240px;">
        <v:fill type="frame" src="${image}" color="#0f172a" />
        <v:textbox inset="0,0,0,0">
      <![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td height="240" valign="bottom" style="background:linear-gradient(180deg, rgba(15,23,42,0.10) 0%, rgba(15,23,42,0.82) 100%);">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td class="px" style="padding:32px 40px 28px;">
                  <span class="gold-badge" style="display:inline-block;padding:6px 14px;border-radius:999px;background:${COLORS.primary};color:${COLORS.primaryDark};font-size:11px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;">${category}</span>
                  <div class="h1 hero-title" style="margin:16px 0 0;font-size:32px;line-height:38px;font-weight:900;color:#ffffff;">${title}</div>
                  ${subtitle ? `<div class="hero-subtitle" style="margin:10px 0 0;font-size:15px;line-height:22px;font-weight:600;color:#CBD5E1;">${subtitle}</div>` : ""}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!--[if gte mso 9]></v:textbox></v:rect><![endif]-->
    </td>
  </tr>
</table>
`;

const Section = ({
  children,
  style = "",
}: {
  children: string;
  style?: string;
}) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${COLORS.white}" class="content-bg" style="background:${COLORS.white};background-color:${COLORS.white};${style}">
  <tr>
    <td class="px email-text" style="padding:34px 40px 30px;font-size:16px;line-height:26px;color:${COLORS.text};">
      ${children}
    </td>
  </tr>
</table>
`;

const Card = ({ children, icon }: { children: string; icon?: string }) => `
<div style="background:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:12px;padding:24px;margin:24px 0;">
    ${icon ? `<div style="font-size:24px;margin-bottom:16px;">${icon}</div>` : ""}
    ${children}
</div>
`;

const InfoRow = ({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string | number;
  isLast?: boolean;
}) => `
<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:${isLast ? "none" : `1px solid ${COLORS.border}`};">
    <span style="color:${COLORS.textLight};font-size:14px;font-weight:500;">${label}</span>
    <span style="color:${COLORS.heading};font-weight:600;text-align:right;">${value}</span>
</div>
`;

const Button = ({
  label,
  url,
  variant = "primary",
}: {
  label: string;
  url: string;
  variant?: "primary" | "secondary" | "outline";
}) => {
  const styles = {
    primary: `background:${COLORS.primary};color:${COLORS.primaryDark};border:none;`,
    secondary: `background:${COLORS.heading};color:${COLORS.white};border:none;`,
    outline: `background:transparent;color:${COLORS.primary};border:1px solid ${COLORS.primary};`,
  };
  const textColor = variant === "primary" ? COLORS.primaryDark : variant === "outline" ? COLORS.primary : COLORS.white;
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:32px auto;">
      <tr>
        <td align="center" bgcolor="${variant === "primary" ? COLORS.primary : variant === "secondary" ? COLORS.heading : "transparent"}" class="${variant === "primary" ? "hover-gold gold-button" : ""}" style="${styles[variant]}border-radius:12px;">
          <a href="${url}" style="display:inline-block;padding:16px 34px;border-radius:12px;text-decoration:none;font-weight:900;font-size:15px;line-height:18px;color:${textColor};letter-spacing:0.2px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
    `;
};

const HeadingSmall = (text: string) => `
<h3 style="color:${COLORS.heading};font-size:18px;font-weight:700;margin:0 0 16px;font-family:${FONTS.serif};">${text}</h3>
`;

const Text = (text: string, style = "") => `
<p class="email-text" style="margin:0 0 16px;color:${COLORS.text};${style}">${text}</p>
`;

const ProductCard = ({
  title,
  price,
  imageUrl,
  url,
  label,
  locale = "pt",
}: {
  title?: string | null;
  price?: string | null;
  imageUrl?: string | null;
  url?: string | null;
  label?: string | null;
  locale?: EmailLocale;
}) => {
  if (!title || !url) return "";
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="margin:26px 0;border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;background:#ffffff;background-color:#ffffff;">
  <tr>
    ${imageUrl ? `<td width="150" valign="top" style="width:150px;padding:0;background:#f8fafc;"><img src="${imageUrl}" width="150" alt="" style="display:block;width:150px;max-width:150px;height:auto;border:0;" /></td>` : ""}
    <td valign="middle" style="padding:20px 22px;">
      <div class="brand-text" style="font-size:11px;line-height:16px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:${COLORS.primary};margin:0 0 6px;">${label || (locale === "en" ? "Official store" : "Loja oficial")}</div>
      <div class="email-heading" style="font-size:18px;line-height:24px;font-weight:900;color:${COLORS.heading};margin:0 0 8px;">${title}</div>
      ${price ? `<div class="email-text" style="font-size:15px;line-height:20px;color:${COLORS.text};font-weight:700;margin:0 0 14px;">${price}</div>` : ""}
      <a href="${url}" style="font-size:14px;line-height:20px;font-weight:800;color:${COLORS.primary};text-decoration:none;">${locale === "en" ? "View product" : "Ver produto"} &rarr;</a>
    </td>
  </tr>
</table>`;
};

const parseEuroPrice = (value?: string | null) => {
  if (!value) return null;
  const match = value.replace(/\s+/g, ' ').match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!match) return null;
  const parsed = Number(match[1].replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const formatPromoEuro = (value: number, locale: EmailLocale) =>
  formatCurrency(value, 'EUR', locale).replace(/\s+/g, ' ');

const storeBookPromoCountdownBlock = (locale: EmailLocale) => {
  const remainingMs = getStoreBookPromoRemainingMs();
  const totalMinutes = Math.max(0, Math.floor(remainingMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const label = locale === 'en'
    ? 'Offer ends at midnight in Brazil'
    : 'A campanha termina à meia-noite no Brasil';
  const urgency = locale === 'en'
    ? (hours > 0 ? `Only ${hours}h ${String(minutes).padStart(2, '0')}min left` : 'Less than 1 hour left')
    : (hours > 0 ? `Faltam só ${hours}h ${String(minutes).padStart(2, '0')}min` : 'Falta menos de 1 hora');

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0f172a" style="margin:24px 0;border-radius:18px;background:#0f172a;background-color:#0f172a;overflow:hidden;">
  <tr>
    <td style="padding:22px 24px;text-align:center;">
      <div style="font-size:11px;line-height:16px;font-weight:900;letter-spacing:1.6px;text-transform:uppercase;color:${COLORS.primary};margin:0 0 10px;">${locale === 'en' ? 'Today only' : 'Só hoje'}</div>
      <div style="font-size:24px;line-height:30px;font-weight:900;color:#ffffff;margin:0 0 14px;">${urgency}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 12px;">
        <tr>
          <td bgcolor="#ffffff" style="background:#ffffff;border-radius:14px;padding:12px 18px;text-align:center;">
            <div style="font-size:30px;line-height:32px;font-weight:900;color:#0f172a;font-family:${FONTS.sans};">${String(hours).padStart(2, '0')}</div>
            <div style="font-size:10px;line-height:14px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:#64748B;">${locale === 'en' ? 'Hours' : 'Horas'}</div>
          </td>
          <td width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td>
          <td bgcolor="#ffffff" style="background:#ffffff;border-radius:14px;padding:12px 18px;text-align:center;">
            <div style="font-size:30px;line-height:32px;font-weight:900;color:#0f172a;font-family:${FONTS.sans};">${String(minutes).padStart(2, '0')}</div>
            <div style="font-size:10px;line-height:14px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:#64748B;">MIN</div>
          </td>
        </tr>
      </table>
      <div style="font-size:13px;line-height:20px;color:#CBD5E1;">${label}. ${locale === 'en' ? 'After that, prices return to normal.' : 'Depois disso, os preços voltam ao normal.'}</div>
    </td>
  </tr>
</table>`;
};

const PromoProductCard = ({
  title,
  price,
  imageUrl,
  url,
  label,
  locale = "pt",
}: {
  title?: string | null;
  price?: string | null;
  imageUrl?: string | null;
  url?: string | null;
  label?: string | null;
  locale?: EmailLocale;
}) => {
  if (!title || !url) return "";
  const parsedPrice = parseEuroPrice(price);
  const promoPrice = parsedPrice === null ? null : applyStoreBookPromo(parsedPrice, { name: title, category: `${label || ''} livro` });
  const hasPromo = Boolean(promoPrice?.active);
  const originalPrice = promoPrice ? formatPromoEuro(promoPrice.originalPrice, locale) : price;
  const discountedPrice = promoPrice ? formatPromoEuro(promoPrice.discountedPrice, locale) : price;

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="margin:18px 0;border:1px solid rgba(212,175,55,0.55);border-radius:18px;overflow:hidden;background:#ffffff;background-color:#ffffff;">
  <tr>
    ${imageUrl ? `<td width="142" valign="top" style="width:142px;padding:0;background:#f8fafc;"><img src="${imageUrl}" width="142" alt="" style="display:block;width:142px;max-width:142px;height:auto;border:0;" /></td>` : ""}
    <td valign="middle" style="padding:18px 20px;">
      <div style="font-size:10px;line-height:15px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:${COLORS.primary};margin:0 0 7px;">${label || (locale === "en" ? "Official book" : "Livro oficial")}</div>
      <div class="email-heading" style="font-size:17px;line-height:23px;font-weight:900;color:${COLORS.heading};margin:0 0 10px;">${title}</div>
      ${hasPromo ? `
        <div style="margin:0 0 12px;">
          <span style="font-size:13px;line-height:18px;color:#94a3b8;text-decoration:line-through;font-weight:800;">${originalPrice}</span>
          <span style="font-size:20px;line-height:26px;color:#047857;font-weight:900;margin-left:8px;">${discountedPrice}</span>
          <span style="display:inline-block;margin-left:8px;padding:4px 8px;border-radius:999px;background:#dcfce7;color:#047857;font-size:10px;line-height:14px;font-weight:900;letter-spacing:0.8px;text-transform:uppercase;">-15%</span>
        </div>
      ` : price ? `<div class="email-text" style="font-size:15px;line-height:20px;color:${COLORS.text};font-weight:700;margin:0 0 14px;">${price}</div>` : ""}
      <a href="${url}" style="font-size:14px;line-height:20px;font-weight:900;color:${COLORS.primary};text-decoration:none;">${locale === "en" ? "Buy today" : "Comprar hoje"} &rarr;</a>
    </td>
  </tr>
</table>`;
};

/* -------------------------------------------------------------------------- */
/*           MEMBERSHIP BENEFITS BLOCK (rich, image cards — email-safe)        */
/* -------------------------------------------------------------------------- */

// Uses .png/.jpg (not .webp) so cards render in Outlook too.
const BENEFIT_IMG = {
  archive: `${APP_URL}/images/igrejagarabandal.jpg`,
  videos: `${APP_URL}/images/multimedia_background.png`,
  books: `${APP_URL}/images/descontoslivros.png`,
  masses: `${APP_URL}/images/padrerezar.png`,
  association: `${APP_URL}/images/associacao.webp`,
  houseVillage: `${APP_URL}/images/aldeiadacasa.webp`,
  houseBefore: `${APP_URL}/images/casaantes1.webp`,
  houseAfter: `${APP_URL}/images/casaafter.webp`,
};

const benefitImageCard = ({ img, eyebrow, title, desc }: { img: string; eyebrow: string; title: string; desc: string }) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;background:${COLORS.white};">
  <tr><td style="padding:0;line-height:0;"><img src="${img}" width="552" alt="" style="display:block;width:100%;max-width:552px;height:auto;border:0;" /></td></tr>
  <tr><td style="padding:20px 24px;">
    <div style="font-size:12px;font-weight:700;color:${COLORS.primary};text-transform:uppercase;letter-spacing:1.2px;margin:0 0 6px;">${eyebrow}</div>
    <div style="font-size:18px;font-weight:700;color:${COLORS.heading};font-family:${FONTS.serif};margin:0 0 8px;">${title}</div>
    <div style="font-size:15px;line-height:1.6;color:${COLORS.text};">${desc}</div>
  </td></tr>
</table>`;

const benefitFeaturedCard = ({ img, badge, title, desc }: { img: string; badge: string; title: string; desc: string }) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid rgba(202,138,4,0.45);border-radius:16px;overflow:hidden;background:#1a1407;">
  <tr><td style="padding:0;line-height:0;position:relative;"><img src="${img}" width="552" alt="" style="display:block;width:100%;max-width:552px;height:auto;border:0;opacity:0.55;" /></td></tr>
  <tr><td style="padding:22px 24px;background:#1a1407;">
    <div style="display:inline-block;font-size:11px;font-weight:700;color:#fcd34d;text-transform:uppercase;letter-spacing:1.4px;padding:5px 12px;border:1px solid rgba(252,211,77,0.45);border-radius:999px;margin:0 0 12px;">✨ ${badge}</div>
    <div style="font-size:20px;font-weight:700;color:#fde68a;font-family:${FONTS.serif};margin:0 0 8px;">${title}</div>
    <div style="font-size:15px;line-height:1.6;color:#e5e7eb;">${desc}</div>
  </td></tr>
</table>`;

const benefitChecklist = (title: string, items: string[]) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid ${COLORS.border};border-radius:16px;background:${COLORS.primaryLight};">
  <tr><td style="padding:22px 24px;">
    <div style="font-size:16px;font-weight:700;color:${COLORS.heading};font-family:${FONTS.serif};margin:0 0 14px;">${title}</div>
    ${items.map((item) => `<div style="font-size:15px;line-height:1.5;color:${COLORS.text};padding:6px 0;"><span style="color:${COLORS.primary};font-weight:700;">✓</span>&nbsp; ${item}</div>`).join('')}
  </td></tr>
</table>`;

const offerHighlight = ({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;border:2px solid ${COLORS.primary};border-radius:16px;background:#FEFCE8;">
  <tr><td style="padding:24px;text-align:center;">
    <div style="font-size:12px;font-weight:700;color:${COLORS.primary};text-transform:uppercase;letter-spacing:1.2px;margin:0 0 8px;">${eyebrow}</div>
    <div style="font-size:21px;font-weight:800;color:${COLORS.heading};font-family:${FONTS.serif};line-height:1.3;margin:0 0 8px;">${title}</div>
    <div style="font-size:14px;color:${COLORS.textLight};">${sub}</div>
  </td></tr>
</table>`;

const membershipWelcomeContent = (locale: EmailLocale) => {
  const intro = locale === 'en'
    ? [
        '<strong>{{greeting}}</strong>,',
        'At some point your heart drew close to Garabandal — perhaps through a pilgrimage, a prayer request, a donation, or simply through Our Lady\'s message. We believe it was not by chance.',
        'Today we would like to invite you to take one step further: to <strong>become a member of the Garabandal Apostolate</strong> — to belong, continuously, to a family that prays and works in the service of this message. Here is some of what awaits you:',
      ]
    : [
        '<strong>{{greeting}}</strong>,',
        'Em algum momento o seu coração aproximou-se de Garabandal — talvez por uma peregrinação, um pedido de oração, um donativo, ou simplesmente pela mensagem de Nossa Senhora. Acreditamos que não foi por acaso.',
        'Hoje queremos convidar você a dar um passo a mais: <strong>tornar-se membro do Apostolado de Garabandal</strong> — fazer parte, de forma contínua, de uma família que reza e trabalha ao serviço desta mensagem. Veja um pouco do que espera por você:',
      ];

  const cards = locale === 'en'
    ? benefitFeaturedCard({ img: BENEFIT_IMG.archive, badge: 'Golden Archive', title: 'Access to the Private Documentation', desc: 'Our most precious treasure: reserved access to the private Garabandal archive — documents, testimonies and historical records not shared publicly.' })
      + benefitImageCard({ img: BENEFIT_IMG.videos, eyebrow: 'Exclusive Content', title: 'Exclusive Videos', desc: 'Unlimited access to video content, documentaries and in-depth study materials on the Apparitions and Marian spirituality.' })
      + benefitImageCard({ img: BENEFIT_IMG.books, eyebrow: 'Online Store', title: '5% off Books', desc: 'A permanent direct discount across the entire official bookstore, to deepen your faith.' })
    : benefitFeaturedCard({ img: BENEFIT_IMG.archive, badge: 'Acervo de Ouro', title: 'Acesso à Documentação Privada', desc: 'O nosso tesouro mais precioso: acesso reservado ao arquivo privado de Garabandal — documentos, testemunhos e registros históricos que não são compartilhados publicamente.' })
      + benefitImageCard({ img: BENEFIT_IMG.videos, eyebrow: 'Conteúdo Exclusivo', title: 'Vídeos Exclusivos', desc: 'Acesso ilimitado a vídeos, documentários e materiais de estudo aprofundado sobre as Aparições e a espiritualidade mariana.' })
      + benefitImageCard({ img: BENEFIT_IMG.books, eyebrow: 'Loja Online', title: '5% nos Livros', desc: 'Desconto direto permanente em toda a livraria oficial, para aprofundar a sua fé.' });

  const checklist = locale === 'en'
    ? benefitChecklist('And also, as a member:', [
        '<strong>€50 discount</strong> on the annual pilgrimages',
        '<strong>Altar of Intentions</strong> — your prayers taken to the sacred site of the Apparitions',
        '<strong>Annual Masses</strong> celebrated for the intentions of members',
        '<strong>Community life</strong> — voting rights and a voice in decisions',
        '5% off the annual conferences and events',
      ])
    : benefitChecklist('E ainda, como membro:', [
        '<strong>Desconto de 50€</strong> nas peregrinações anuais',
        '<strong>Altar de Intenções</strong> — as suas orações levadas ao local sagrado das Aparições',
        '<strong>Missas anuais</strong> celebradas pelas intenções dos membros',
        '<strong>Vida associativa</strong> — direito a voto e voz nas decisões',
        '5% nas conferências e eventos anuais',
      ]);

  const offer = locale === 'en'
    ? offerHighlight({ eyebrow: 'Become a member', title: 'Belong to this mission the whole year', sub: 'Annual membership is just €25/year' })
    : offerHighlight({ eyebrow: 'Torne-se membro', title: 'Faça parte desta missão o ano inteiro', sub: 'Anuidade de apenas 25€/ano' });

  const quote = locale === 'en'
    ? '<p style="margin:24px 0 0;font-size:15px;font-style:italic;color:#64748B;text-align:center;">"You must pray much, pray with faith and fervour." — Message of Garabandal</p>'
    : '<p style="margin:24px 0 0;font-size:15px;font-style:italic;color:#64748B;text-align:center;">"É preciso rezar muito, rezar com fé e fervor." — Mensagem de Garabandal</p>';

  return `${intro.map((p) => Text(p)).join('')}${cards}${checklist}${offer}${quote}`;
};

const emailFeatureBlock = ({
  image,
  eyebrow,
  title,
  desc,
}: {
  image: string;
  eyebrow: string;
  title: string;
  desc: string;
}) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="margin:22px 0;border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;background:#ffffff;background-color:#ffffff;">
  <tr><td style="padding:0;line-height:0;"><img src="${image}" width="552" alt="" style="display:block;width:100%;max-width:552px;height:auto;border:0;" /></td></tr>
  <tr><td style="padding:20px 24px;">
    <div style="font-size:11px;line-height:16px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:${COLORS.primary};margin:0 0 7px;">${eyebrow}</div>
    <div style="font-size:20px;line-height:26px;font-weight:900;color:${COLORS.heading};font-family:${FONTS.serif};margin:0 0 8px;">${title}</div>
    <div class="email-text" style="font-size:15px;line-height:24px;color:${COLORS.text};">${desc}</div>
  </td></tr>
</table>`;

const emailNotePanel = (title: string, body: string) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#fffbeb" style="margin:20px 0;border:1px solid rgba(212,175,55,0.5);border-radius:14px;background:#fffbeb;background-color:#fffbeb;">
  <tr><td style="padding:20px 22px;">
    <div style="font-size:16px;line-height:22px;font-weight:900;color:${COLORS.heading};font-family:${FONTS.serif};margin:0 0 8px;">${title}</div>
    <div class="email-text" style="font-size:15px;line-height:24px;color:${COLORS.text};">${body}</div>
  </td></tr>
</table>`;

const emailSteps = (title: string, steps: string[]) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f8fafc" style="margin:20px 0;border:1px solid ${COLORS.border};border-radius:14px;background:#f8fafc;background-color:#f8fafc;">
  <tr><td style="padding:20px 22px;">
    <div style="font-size:16px;line-height:22px;font-weight:900;color:${COLORS.heading};font-family:${FONTS.serif};margin:0 0 12px;">${title}</div>
    ${steps.map((step, index) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;">
        <tr>
          <td width="30" valign="top" style="width:30px;">
            <div style="width:24px;height:24px;border-radius:999px;background:${COLORS.primary};color:${COLORS.primaryDark};font-size:13px;line-height:24px;text-align:center;font-weight:900;">${index + 1}</div>
          </td>
          <td class="email-text" valign="top" style="font-size:15px;line-height:24px;color:${COLORS.text};">${step}</td>
        </tr>
      </table>
    `).join('')}
  </td></tr>
</table>`;

// Real pilgrim testimonials (source: Supabase `testimonials` table). Native PT-BR + EN.
const REAL_TESTIMONIALS: { pt: string; en: string; author: string }[] = [
  {
    pt: 'Esta peregrinação aprofundou o meu encontro com Jesus e Maria. Uma viagem transformadora.',
    en: 'This pilgrimage deepened my encounter with Jesus and Mary. A truly transformative journey.',
    author: 'Danielle · Florianópolis',
  },
  {
    pt: 'Super recomendo. Itinerário perfeito, hospedagem excelente e presença real de Jesus e Nossa Senhora.',
    en: 'I highly recommend it. Perfect itinerary, excellent accommodation, and the real presence of Jesus and Our Lady.',
    author: 'Dani Silva · Curitiba',
  },
  {
    pt: 'Organização impecável, lugares lindos e muita fé. Não nos preocupamos com nada, só vivemos a graça!',
    en: 'Impeccable organization, beautiful places, and so much faith. We did not have to worry about anything; we simply lived the grace.',
    author: 'Mardja Cássia · Brasil',
  },
  {
    pt: 'Senti a presença forte de Maria e a alegria dos peregrinos. Minha fé foi profundamente fortalecida.',
    en: "I felt Mary's strong presence and the joy of the pilgrims. My faith was deeply strengthened.",
    author: 'Simone · Brasil',
  },
];

// Testimonial widget — a real pilgrim quote in a warm, quotation-styled card.
const testimonialCard = (locale: EmailLocale, index = 0) => {
  const t = REAL_TESTIMONIALS[index % REAL_TESTIMONIALS.length];
  const quote = locale === 'en' ? t.en : t.pt;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#fffbeb" style="margin:20px 0;border:1px solid rgba(212,175,55,0.4);border-left:4px solid ${COLORS.primary};border-radius:14px;background:#fffbeb;background-color:#fffbeb;">
  <tr><td style="padding:22px 24px;">
    <div style="font-size:34px;line-height:20px;color:${COLORS.primary};font-family:${FONTS.serif};height:20px;">&ldquo;</div>
    <div style="font-size:16px;line-height:26px;color:${COLORS.heading};font-family:${FONTS.serif};font-style:italic;margin:6px 0 12px;">${quote}</div>
    <div style="font-size:13px;font-weight:700;color:${COLORS.primary};">— ${t.author}</div>
  </td></tr>
</table>`;
};

// Card dinâmico da peregrinação recomendada: imagem real + estado (vaga/lista de espera)
// + nome + datas. Nome/datas/badge são placeholders resolvidos por fillMarketingVariables.
const pilgrimageCard = (locale: EmailLocale) => {
  const label = locale === 'en' ? 'Recommended pilgrimage' : 'Peregrinação recomendada';
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="margin:20px 0;border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;background:#ffffff;background-color:#ffffff;">
  <tr><td style="padding:0;line-height:0;position:relative;"><img src="{{pilgrimage_image_url}}" width="552" alt="{{pilgrimage_name}}" style="display:block;width:100%;max-width:552px;height:auto;border:0;" /></td></tr>
  <tr><td style="padding:20px 24px;">
    <div style="margin:0 0 10px;">{{pilgrimage_status_badge}}</div>
    <div style="font-size:11px;line-height:16px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:${COLORS.primary};margin:0 0 6px;">${label}</div>
    <div style="font-size:20px;line-height:26px;font-weight:900;color:${COLORS.heading};font-family:${FONTS.serif};margin:0;">{{pilgrimage_name}}</div>
    {{pilgrimage_dates_row}}
  </td></tr>
</table>`;
};

const pilgrimageTestimonyContent = (locale: EmailLocale) => {
  const isEn = locale === 'en';
  const intro = isEn
    ? [
        '<strong>{{greeting}}</strong>,',
        'Garabandal is a small, hidden village. And yet Our Lady\'s message here has touched millions.',
        'Those who go rarely come back the same. Here is what a few pilgrims told us:',
      ]
    : [
        '<strong>{{greeting}}</strong>,',
        'Garabandal é um lugarejo pequeno e escondido. E, ainda assim, a mensagem de Nossa Senhora aqui tocou milhões.',
        'Quem vai, dificilmente volta o mesmo. Veja o que alguns peregrinos nos contaram:',
      ];
  const closing = isEn
    ? 'If you feel this path may be for you, take a look at the dates below.'
    : 'Se você sente que esse caminho pode ser o seu, veja as datas logo abaixo.';
  return `${intro.map((p) => Text(p)).join('')}${pilgrimageCard(locale)}${testimonialCard(locale, 0)}${testimonialCard(locale, 3)}${Text(closing)}`;
};

const pilgrimageFaqContent = (locale: EmailLocale) => {
  const isEn = locale === 'en';
  const intro = isEn
    ? [
        '<strong>{{greeting}}</strong>,',
        '"I\'d love to go, but I\'m not sure I can..." — do you recognise this thought? It is completely normal to want everything clear before moving forward.',
      ]
    : [
        '<strong>{{greeting}}</strong>,',
        '"Adoraria ir, mas não sei se consigo..." — reconhece esse pensamento? É completamente normal querer ter tudo claro antes de decidir.',
      ];
  const checklist = isEn
    ? benefitChecklist('The most common questions — all answered', [
        '<strong>Total cost</strong> and payment by instalments',
        '<strong>Single or shared</strong> room options',
        '<strong>Travel</strong> included and who accompanies the group',
        '<strong>Cancellation</strong> and what happens if plans change',
      ])
    : benefitChecklist('As dúvidas mais comuns — todas respondidas', [
        '<strong>Valor total</strong> e pagamento parcelado',
        'Quarto <strong>individual ou compartilhado</strong>',
        '<strong>Viagem</strong> incluída e quem acompanha o grupo',
        '<strong>Cancelamento</strong> e o que acontece se os planos mudarem',
      ]);
  const closing = isEn
    ? 'If anything is still unclear, just reply or message us. We want you to decide with clarity, confidence and peace — no pressure of any kind.'
    : 'Se ainda ficar alguma dúvida, é só responder ou chamar no WhatsApp. Queremos que você decida com clareza, confiança e paz — sem pressão de nenhum tipo.';
  return `${intro.map((p) => Text(p)).join('')}${pilgrimageCard(locale)}${checklist}${Text(closing)}`;
};

const brochureFollowupContent = (locale: EmailLocale) => {
  const isEn = locale === 'en';
  const intro = isEn
    ? [
        '<strong>{{greeting}}</strong>,',
        'You asked for the itinerary of <strong>{{pilgrimage_name}}</strong> — and that already says something.',
        'Many who travel with us today started exactly like you: with a quiet curiosity that kept growing.',
      ]
    : [
        '<strong>{{greeting}}</strong>,',
        'Você pediu o roteiro de <strong>{{pilgrimage_name}}</strong> — e isso já diz muito.',
        'Muita gente que hoje viaja com a gente começou exatamente assim: com uma curiosidade simples que foi crescendo.',
      ];
  const note = isEn
    ? emailNotePanel('Small groups, limited places', 'Each pilgrimage is guided by our team, in a spirit of prayer and fellowship. Places fill quickly.')
    : emailNotePanel('Grupos pequenos, vagas limitadas', 'Cada peregrinação é acompanhada pela nossa equipe, com espírito de oração e comunhão. As vagas se preenchem rápido.');
  const closing = isEn
    ? 'If this feels like your moment, checking the dates is the natural next step.'
    : 'Se você sente que é o seu momento, ver as datas é o próximo passo natural.';
  return `${intro.map((p) => Text(p)).join('')}${pilgrimageCard(locale)}${testimonialCard(locale, 1)}${note}${Text(closing)}`;
};

const paymentSupportContent = (locale: EmailLocale) => {
  const isEn = locale === 'en';
  const intro = isEn
    ? [
        '<strong>{{greeting}}</strong>,',
        'We are following your registration for <strong>{{pilgrimage_name}}</strong> and noticed a payment may still be pending.',
        'We do not want you to lose your place over a small detail. It is simple to sort out:',
      ]
    : [
        '<strong>{{greeting}}</strong>,',
        'Estamos acompanhando sua inscrição em <strong>{{pilgrimage_name}}</strong> e notamos que um pagamento pode estar pendente.',
        'Não queremos que você perca a vaga por um detalhe. É simples de resolver:',
      ];
  const steps = isEn
    ? emailSteps('How to complete it', [
        'Open your registration using the button below.',
        'Already paid by bank transfer? Just upload the receipt.',
        'Our team confirms everything and secures your place.',
      ])
    : emailSteps('Como concluir', [
        'Abra sua inscrição no botão abaixo.',
        'Já pagou por transferência? É só enviar o comprovante.',
        'Nossa equipe confirma tudo e garante sua vaga.',
      ]);
  return `${intro.map((p) => Text(p)).join('')}${steps}`;
};

const membershipRenewalContent = (locale: EmailLocale) => {
  const isEn = locale === 'en';
  // Audiência = quota já expirada (segmento 'expired-members'). Tom: porta aberta,
  // zero culpa, zero contagem decrescente.
  const intro = isEn
    ? [
        '<strong>{{greeting}}</strong>,',
        'Your membership has expired — and we want you to know that nothing was lost: your place in this mission is still yours, and you remain in our prayers.',
        'Whenever you wish to return, renewing takes less than a minute and everything becomes active again right away:',
      ]
    : [
        '<strong>{{greeting}}</strong>,',
        'Sua anuidade de membro venceu — e queremos que saiba que nada se perdeu: seu lugar nesta missão continua guardado, e você continua presente nas nossas orações.',
        'Quando desejar voltar, renovar leva menos de um minuto e tudo volta a ficar ativo no mesmo instante:',
      ];
  const checklist = isEn
    ? benefitChecklist('By renewing, you regain:', [
        'The <strong>live Holy Mass</strong> from Garabandal',
        '<strong>Novenas</strong> and candles lit for your intentions',
        'Exclusive content and the spiritual Academy',
        'The certainty that your support sustains this mission',
      ])
    : benefitChecklist('Ao renovar, você volta a ter:', [
        'A <strong>Santa Missa ao vivo</strong> desde Garabandal',
        '<strong>Novenas</strong> e velas acesas pelas suas intenções',
        'Conteúdos exclusivos e a Academia espiritual',
        'A certeza de que seu apoio sustenta esta missão',
      ]);
  const closing = isEn
    ? 'And if this is not the right moment, be at peace: you remain part of this spiritual family, and we will be here when the time comes.'
    : 'E se este não for o momento certo, fique em paz: você continua fazendo parte desta família espiritual, e estaremos aqui quando for a hora.';
  return `${intro.map((p) => Text(p)).join('')}${checklist}${Text(closing)}`;
};

const leadToMemberFollowupContent = (locale: EmailLocale) => {
  const isEn = locale === 'en';
  const intro = isEn
    ? [
        '<strong>{{greeting}}</strong>,',
        'A few days ago we invited you to join the Apostolate. Perhaps the timing was not right — we understand.',
        'But let me ask just this: <strong>think of one intention</strong> you carry in your heart — a sick loved one, a hard decision, a grace you await. As a member, that intention is taken to the <strong>candles lit in Garabandal</strong> and to our community\'s <strong>novenas</strong>. You do not walk alone.',
      ]
    : [
        '<strong>{{greeting}}</strong>,',
        'Há poucos dias convidamos você a fazer parte do Apostolado. Talvez o momento não tenha sido o certo — a gente entende.',
        'Mas deixe eu pedir só isto: <strong>pense numa intenção</strong> que você traz no coração — um familiar doente, uma decisão difícil, uma graça que espera. Como membro, essa intenção passa a ser levada às <strong>velas acesas em Garabandal</strong> e às <strong>novenas</strong> da nossa comunidade. Você não caminha sozinho.',
      ];
  const offer = isEn
    ? offerHighlight({ eyebrow: 'Become a member', title: 'Belong to this mission the whole year', sub: 'Annual membership is just €25/year' })
    : offerHighlight({ eyebrow: 'Torne-se membro', title: 'Faça parte desta missão o ano inteiro', sub: 'Anuidade de apenas 25€/ano' });
  const closing = isEn
    ? 'Whatever you decide, you remain in our prayers.'
    : 'Seja qual for a sua decisão, você fica na nossa oração.';
  return `${intro.map((p) => Text(p)).join('')}${offer}${Text(closing)}`;
};

const supportSentence = (locale: EmailLocale) =>
  locale === 'en'
    ? `If you need help before deciding, message us on ${contactWa} or email ${contactMail}.`
    : `Se precisar de ajuda antes de decidir, fale com a gente pelo ${contactWa} ou por ${contactMail}.`;

const pilgrimageRecoveryContent = (locale: EmailLocale, stage: 'start' | 'faq' | 'final') => {
  const isEn = locale === 'en';
  if (stage === 'faq') {
    return isEn
      ? `${Text('<strong>{{greeting}}</strong>,')}${Text('When a registration is left unfinished, it is often because of one concrete question. That is normal: a pilgrimage is a serious decision and you should move forward with peace.')}
        ${emailFeatureBlock({ image: '{{pilgrimage_image_url}}', eyebrow: 'Pilgrimage with support', title: 'You do not need to solve everything alone', desc: 'We can help with payment options, accommodation, travelling alone or with family, documents and any practical doubts before you confirm.' })}
        ${benefitChecklist('Common questions we can clarify', ['Payment by instalments or bank transfer', 'Single or shared room options', 'Travel details and group accompaniment', 'What happens if plans change before departure'])}
        ${Text(`${supportSentence(locale)} If you are ready, the button below takes you back to your registration.`)}`
      : `${Text('<strong>{{greeting}}</strong>,')}${Text('Quando uma inscrição fica pela metade, quase sempre há uma dúvida concreta por trás. É normal: uma peregrinação é uma decisão importante e deve ser tomada com paz.')}
        ${emailFeatureBlock({ image: '{{pilgrimage_image_url}}', eyebrow: 'Peregrinação acompanhada', title: 'Você não precisa resolver tudo sozinho', desc: 'A gente ajuda com pagamento parcelado, hospedagem, viagem sozinho ou acompanhado, documentos e qualquer dúvida prática antes de confirmar.' })}
        ${benefitChecklist('Dúvidas que podemos esclarecer', ['Pagamento parcelado ou por transferência', 'Quarto individual ou compartilhado', 'Detalhes da viagem e acompanhamento do grupo', 'O que acontece se os planos mudarem antes da partida'])}
        ${Text(`${supportSentence(locale)} Se já está pronto, o botão abaixo leva você de volta à inscrição.`)}`;
  }

  if (stage === 'final') {
    return isEn
      ? `${Text('<strong>{{greeting}}</strong>,')}${Text('This is the last email we will send about your registration for <strong>{{pilgrimage_name}}</strong>. If this is not the right moment, we leave it here with respect.')}
        ${emailFeatureBlock({ image: '{{pilgrimage_image_url}}', eyebrow: 'One last invitation', title: '{{pilgrimage_name}}', desc: 'If this pilgrimage still speaks to your heart, this may be the right time to finish. We only mention a place here when there is real availability.' })}
        ${testimonialCard(locale, 0)}
        ${emailSteps('Before you decide', ['Review the programme and dates one final time.', 'Confirm the details that matter most to you.', 'Continue only if you feel ready and at peace.'])}
        ${Text(`${supportSentence(locale)} We will be glad to help, without pressure.`)}`
      : `${Text('<strong>{{greeting}}</strong>,')}${Text('Este é o último email que enviamos sobre sua inscrição em <strong>{{pilgrimage_name}}</strong>. Se este não for o momento certo, ficamos por aqui com respeito.')}
        ${emailFeatureBlock({ image: '{{pilgrimage_image_url}}', eyebrow: 'Um último convite', title: '{{pilgrimage_name}}', desc: 'Se essa peregrinação ainda fala ao seu coração, este pode ser o momento certo para concluir. Só mencionamos vaga aqui quando há disponibilidade real.' })}
        ${testimonialCard(locale, 0)}
        ${emailSteps('Antes de decidir', ['Reveja o programa e as datas uma última vez.', 'Confirme os detalhes que são mais importantes para você.', 'Avance apenas se sentir que está pronto e em paz.'])}
        ${Text(`${supportSentence(locale)} A gente ajuda com gosto, sem pressão.`)}`;
  }

  return isEn
    ? `${Text('<strong>{{greeting}}</strong>,')}${Text('You started registering for <strong>{{pilgrimage_name}}</strong>, but did not finish. It happens — an interruption, a question, a little more time to decide.')}
      ${emailFeatureBlock({ image: '{{pilgrimage_image_url}}', eyebrow: 'Your place is still waiting', title: '{{pilgrimage_name}}', desc: 'Places are limited, but yours can still be secured. Pick up exactly where you left off — in just a few clicks.' })}
      ${emailSteps('Three quick steps', ['Resume the registration from where you stopped.', 'Confirm your details, room preference and payment method.', 'Get confirmation and guidance from the Apostolate team.'])}
      ${testimonialCard(locale, 2)}
      ${Text(supportSentence(locale))}`
    : `${Text('<strong>{{greeting}}</strong>,')}${Text('Você começou a inscrição para <strong>{{pilgrimage_name}}</strong>, mas não concluiu. Acontece — uma interrupção, uma dúvida, um tempo a mais para decidir.')}
      ${emailFeatureBlock({ image: '{{pilgrimage_image_url}}', eyebrow: 'Sua vaga ainda espera por você', title: '{{pilgrimage_name}}', desc: 'As vagas são limitadas, mas a sua ainda pode ser garantida. Retome exatamente de onde parou — em poucos cliques.' })}
      ${emailSteps('Três passos rápidos', ['Retome a inscrição de onde parou.', 'Confirme seus dados, preferência de quarto e forma de pagamento.', 'Receba a confirmação e o acompanhamento da equipe do Apostolado.'])}
      ${testimonialCard(locale, 2)}
      ${Text(supportSentence(locale))}`;
};

/* -------------------------------------------------------------------------- */
/*        CAMPANHA ITÁLIA + MEDJUGORJE — abril 2027 (widgets + conteúdo)       */
/* -------------------------------------------------------------------------- */

// Números reais da peregrinação (tabela `pilgrimages`, slug abaixo). O
// `pricing_config.scarcity_fill_pct` do site está alinhado com `scarcityPct`
// para que email e página pública nunca digam coisas diferentes.
const ITALY_CAMPAIGN = {
  slug: 'italia-medjugorje-abril-2027',
  scarcityPct: 75,
  landPriceEur: 1850,
  depositEur: 500,
  singleSupplementEur: 950,
  installments: 10,
  path: { pt: '/peregrinacoes/italia-medjugorje-abril-2027', en: '/en/pilgrimages/italia-medjugorje-abril-2027' },
  dates: { pt: '5 a 17 de abril de 2027', en: '5–17 April 2027' },
  deadline: { pt: '30 de novembro de 2026', en: '30 November 2026' },
  price: { pt: '1.850 €', en: '€1,850' },
  deposit: { pt: '500 €', en: '€500' },
  single: { pt: '950 €', en: '€950' },
  stops: [
    { pt: 'Roma', en: 'Rome', note: { pt: 'Vaticano e Basílicas Maiores', en: 'The Vatican and the Major Basilicas' } },
    { pt: 'Cássia', en: 'Cascia', note: { pt: 'Santa Rita', en: 'Saint Rita' } },
    { pt: 'Perúgia', en: 'Perugia', note: { pt: 'coração da Úmbria', en: 'the heart of Umbria' } },
    { pt: 'Assis', en: 'Assisi', note: { pt: 'São Francisco e Santa Clara', en: 'Saint Francis and Saint Clare' } },
    { pt: 'Loreto', en: 'Loreto', note: { pt: 'a Santa Casa de Nazaré', en: 'the Holy House of Nazareth' } },
    { pt: 'Lanciano', en: 'Lanciano', note: { pt: 'o milagre eucarístico', en: 'the Eucharistic miracle' } },
    { pt: 'San Giovanni Rotondo', en: 'San Giovanni Rotondo', note: { pt: 'Padre Pio', en: 'Padre Pio' } },
    { pt: 'Monte Gargano', en: 'Monte Gargano', note: { pt: 'gruta de São Miguel Arcanjo', en: 'the cave of Saint Michael the Archangel' } },
    { pt: 'Pompeia', en: 'Pompeii', note: { pt: 'Nossa Senhora do Rosário', en: 'Our Lady of the Rosary' } },
    { pt: 'Medjugorje', en: 'Medjugorje', note: { pt: 'onde a peregrinação termina', en: 'where the pilgrimage ends' } },
  ],
};

const italyUrl = (locale: EmailLocale) => `${APP_URL}${ITALY_CAMPAIGN.path[locale === 'en' ? 'en' : 'pt']}`;

// Barra de escassez — a percentagem é a mesma que o site mostra na pill.
// Cartão claro de propósito: o override de dark mode do Layout força
// `div/span/td` para a cor de texto clara, pelo que um cartão escuro fica
// ilegível nos clientes em modo escuro. Aqui as classes `email-heading` /
// `email-text` recebem exatamente as cores certas nos dois modos.
const italyScarcityBar = (locale: EmailLocale) => {
  const isEn = locale === 'en';
  const pct = ITALY_CAMPAIGN.scarcityPct;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#FEFCE8" style="margin:24px 0;border:2px solid ${COLORS.primary};border-radius:18px;background:#FEFCE8;background-color:#FEFCE8;overflow:hidden;">
  <tr><td style="padding:24px 26px;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
      <tr><td bgcolor="${COLORS.primary}" class="gold-badge" style="background:${COLORS.primary};background-color:${COLORS.primary};border-radius:999px;padding:5px 13px;font-size:11px;line-height:16px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;color:${COLORS.primaryDark};">${isEn ? 'Availability' : 'Disponibilidade'}</td></tr>
    </table>
    <div class="email-heading" style="font-size:27px;line-height:33px;font-weight:900;color:${COLORS.heading};font-family:${FONTS.serif};margin:0 0 16px;">${isEn ? `${pct}% of the places are gone` : `${pct}% das vagas já foram`}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#e7e0c4" style="border-radius:999px;background:#e7e0c4;background-color:#e7e0c4;overflow:hidden;">
      <tr>
        <td width="${pct}%" bgcolor="${COLORS.primary}" height="14" style="width:${pct}%;height:14px;background:${COLORS.primary};background-color:${COLORS.primary};border-radius:999px;font-size:0;line-height:14px;">&nbsp;</td>
        <td width="${100 - pct}%" height="14" style="width:${100 - pct}%;height:14px;font-size:0;line-height:14px;">&nbsp;</td>
      </tr>
    </table>
    <div class="email-text" style="font-size:14px;line-height:22px;color:${COLORS.text};margin:14px 0 0;">${isEn
      ? 'Only a small group travels — and the remaining places are the last of this pilgrimage. There is no second departure in 2027.'
      : 'Só um grupo pequeno viaja — e as vagas que restam são as últimas desta peregrinação. Não há uma segunda saída em 2027.'}</div>
    <div style="margin:14px 0 0;"><a href="${italyUrl(locale)}" style="font-size:14px;line-height:20px;font-weight:900;color:${COLORS.primaryDark};text-decoration:underline;">${isEn ? 'See the remaining places' : 'Ver as vagas que restam'} &rarr;</a></div>
  </td></tr>
</table>`;
};

// Conversão de moeda para leitura: o valor cobrado é sempre o de EUR, por isso
// a conversão aparece sempre ao lado e marcada como aproximada.
const italyLocalPrice = (eur: number, payload: MarketingTemplatePayload) => {
  const rate = Number(payload.localCurrency?.rate || 0);
  const code = String(payload.localCurrency?.code || '');
  if (!rate || !code || code === 'EUR') return '';
  const localeTag = code === 'BRL' ? 'pt-BR' : 'en-US';
  return new Intl.NumberFormat(localeTag, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(eur * rate);
};

// Roteiro em duas colunas: cada paragem com o santuário/santo que a justifica.
const italyRouteWidget = (locale: EmailLocale) => {
  const isEn = locale === 'en';
  const stops = ITALY_CAMPAIGN.stops;
  const rows: string[] = [];
  for (let index = 0; index < stops.length; index += 2) {
    const cell = (stop: (typeof stops)[number] | undefined) =>
      stop
        ? `<td width="50%" valign="top" style="width:50%;padding:7px 8px 7px 0;">
             <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="border:1px solid ${COLORS.border};border-radius:12px;background:#ffffff;background-color:#ffffff;">
               <tr><td style="padding:12px 14px;">
                 <div style="font-size:15px;line-height:20px;font-weight:900;color:${COLORS.heading};">${isEn ? stop.en : stop.pt}</div>
                 <div style="font-size:12px;line-height:18px;color:${COLORS.textLight};margin:3px 0 0;">${isEn ? stop.note.en : stop.note.pt}</div>
               </td></tr>
             </table>
           </td>`
        : '<td width="50%" style="width:50%;">&nbsp;</td>';
    rows.push(`<tr>${cell(stops[index])}${cell(stops[index + 1])}</tr>`);
  }
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f8fafc" style="margin:24px 0;border:1px solid ${COLORS.border};border-radius:16px;background:#f8fafc;background-color:#f8fafc;">
  <tr><td style="padding:22px 22px 16px;">
    <div style="font-size:11px;line-height:16px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:${COLORS.primary};margin:0 0 6px;">${isEn ? '13 days · 2 countries' : '13 dias · 2 países'}</div>
    <div style="font-size:20px;line-height:26px;font-weight:900;color:${COLORS.heading};font-family:${FONTS.serif};margin:0 0 4px;">${isEn ? 'From Rome to Medjugorje' : 'De Roma a Medjugorje'}</div>
    <div class="email-text" style="font-size:14px;line-height:22px;color:${COLORS.text};margin:0 0 12px;">${isEn ? '10 of the greatest shrines in Europe, in one single journey.' : '10 dos maiores santuários da Europa, numa só viagem.'}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table>
  </td></tr>
</table>`;
};

// Cartão de preço: terrestre + inscrição + parcelamento. Valores de leitura —
// nenhum cálculo de pagamento vive aqui.
const italyPriceWidget = (locale: EmailLocale, payload: MarketingTemplatePayload) => {
  const isEn = locale === 'en';
  const price = isEn ? ITALY_CAMPAIGN.price.en : ITALY_CAMPAIGN.price.pt;
  const deposit = isEn ? ITALY_CAMPAIGN.deposit.en : ITALY_CAMPAIGN.deposit.pt;
  const localLand = italyLocalPrice(ITALY_CAMPAIGN.landPriceEur, payload);
  const localDeposit = italyLocalPrice(ITALY_CAMPAIGN.depositEur, payload);
  const localSingle = italyLocalPrice(ITALY_CAMPAIGN.singleSupplementEur, payload);
  const localInstalment = italyLocalPrice(
    (ITALY_CAMPAIGN.landPriceEur - ITALY_CAMPAIGN.depositEur) / ITALY_CAMPAIGN.installments,
    payload,
  );
  const instalmentEur = isEn
    ? `€${Math.round((ITALY_CAMPAIGN.landPriceEur - ITALY_CAMPAIGN.depositEur) / ITALY_CAMPAIGN.installments)}`
    : `${Math.round((ITALY_CAMPAIGN.landPriceEur - ITALY_CAMPAIGN.depositEur) / ITALY_CAMPAIGN.installments)} €`;
  const beside = (value: string) =>
    value ? `<span style="font-size:13px;line-height:19px;font-weight:800;color:${COLORS.textLight};">&nbsp;· ≈&nbsp;${value}</span>` : '';
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="margin:24px 0;border:2px solid ${COLORS.primary};border-radius:18px;background:#ffffff;background-color:#ffffff;overflow:hidden;">
  <tr><td bgcolor="#FEFCE8" style="padding:22px 24px 18px;background:#FEFCE8;background-color:#FEFCE8;text-align:center;">
    <div style="font-size:11px;line-height:16px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;color:${COLORS.primary};margin:0 0 8px;">${isEn ? 'Land package (no flight) · per person' : 'Terrestre (sem voo) · por pessoa'}</div>
    <div class="email-heading" style="font-size:42px;line-height:46px;font-weight:900;color:${COLORS.heading};font-family:${FONTS.serif};">${price}</div>
    ${localLand ? `<div class="email-text" style="font-size:15px;line-height:22px;font-weight:800;color:${COLORS.textLight};margin:4px 0 0;">≈ ${localLand}</div>` : ''}
    <div class="email-text" style="font-size:14px;line-height:22px;color:${COLORS.text};margin:8px 0 0;">${isEn
      ? `Hotel, all meals, drinks and coach travel included — for ${ITALY_CAMPAIGN.stops.length} shrines across 13 days.`
      : `Hotel, alimentação completa, bebidas e transporte incluídos — para ${ITALY_CAMPAIGN.stops.length} santuários em 13 dias.`}</div>
  </td></tr>
  <tr><td style="padding:18px 24px 22px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td valign="top" style="padding:8px 0;border-bottom:1px solid ${COLORS.border};font-size:14px;line-height:21px;color:${COLORS.textLight};">${isEn ? 'Registration (deposit)' : 'Inscrição (entrada)'}</td>
        <td valign="top" align="right" style="padding:8px 0;border-bottom:1px solid ${COLORS.border};font-size:14px;line-height:21px;font-weight:900;color:${COLORS.heading};">${deposit}${beside(localDeposit)}</td>
      </tr>
      <tr>
        <td valign="top" style="padding:8px 0;border-bottom:1px solid ${COLORS.border};font-size:14px;line-height:21px;color:${COLORS.textLight};">${isEn ? `The rest, in up to ${ITALY_CAMPAIGN.installments} instalments` : `O restante, em até ${ITALY_CAMPAIGN.installments}x`}</td>
        <td valign="top" align="right" style="padding:8px 0;border-bottom:1px solid ${COLORS.border};font-size:14px;line-height:21px;font-weight:900;color:#047857;">${instalmentEur}${beside(localInstalment)}<span style="font-size:12px;font-weight:800;color:${COLORS.textLight};"> ${isEn ? '· interest-free' : '· sem juros'}</span></td>
      </tr>
      <tr>
        <td valign="top" style="padding:8px 0;font-size:14px;line-height:21px;color:${COLORS.textLight};">${isEn ? 'Single room (optional)' : 'Quarto individual (opcional)'}</td>
        <td valign="top" align="right" style="padding:8px 0;font-size:14px;line-height:21px;font-weight:900;color:${COLORS.heading};">+ ${isEn ? ITALY_CAMPAIGN.single.en : ITALY_CAMPAIGN.single.pt}${beside(localSingle)}</td>
      </tr>
    </table>
    <div class="email-text" style="font-size:13px;line-height:20px;color:${COLORS.textLight};margin:14px 0 0;">${isEn
      ? 'Pay by card, bank transfer, MB WAY or Multibanco (Portugal), or PIX (Brazil).'
      : 'Pague por PIX (Brasil), cartão, MB WAY, Multibanco ou transferência bancária.'}</div>
    ${localLand ? `<div class="email-text" style="font-size:12px;line-height:19px;color:${COLORS.textLight};margin:8px 0 0;">${isEn
      ? 'Amounts are charged in euros; the conversion shown is indicative and follows the exchange rate of the day.'
      : 'Os valores são cobrados em euros; a conversão indicada é aproximada e segue o câmbio do dia.'}</div>` : ''}
  </td></tr>
</table>`;
};

// Incluído / não incluído lado a lado. A honestidade sobre o voo evita a
// objeção surgir depois, já dentro do formulário de inscrição.
const italyIncludedWidget = (locale: EmailLocale) => {
  const isEn = locale === 'en';
  const included = isEn
    ? ['4★ hotels', 'All meals', 'Drinks with meals', 'Coach travel throughout', 'Airport transfers']
    : ['Hotéis 4★', 'Alimentação completa', 'Bebidas às refeições', 'Transporte em autocarro', 'Transferes de aeroporto'];
  const excluded = isEn
    ? ['Flights', 'Travel insurance']
    : ['Bilhetes de avião', 'Seguro de viagem'];
  const column = (title: string, items: string[], mark: string, markColor: string) => `
    <td width="50%" valign="top" style="width:50%;padding:0 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="border:1px solid ${COLORS.border};border-radius:14px;background:#ffffff;background-color:#ffffff;height:100%;">
        <tr><td style="padding:16px 16px 14px;">
          <div style="font-size:11px;line-height:16px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:${markColor};margin:0 0 10px;">${title}</div>
          ${items.map((item) => `<div class="email-text" style="font-size:14px;line-height:22px;color:${COLORS.text};padding:3px 0;"><span style="color:${markColor};font-weight:900;">${mark}</span>&nbsp; ${item}</div>`).join('')}
        </td></tr>
      </table>
    </td>`;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;">
  <tr>
    ${column(isEn ? 'Included' : 'Está incluído', included, '✓', '#047857')}
    ${column(isEn ? 'Not included' : 'Não está incluído', excluded, '–', COLORS.textLight)}
  </tr>
</table>`;
};

const italyDeadlineWidget = (locale: EmailLocale) => {
  const isEn = locale === 'en';
  return emailNotePanel(
    isEn ? `Registrations close on ${ITALY_CAMPAIGN.deadline.en}` : `As inscrições fecham a ${ITALY_CAMPAIGN.deadline.pt}`,
    isEn
      ? 'After that date the group is closed with the travel agency and no further places can be added — not even if someone cancels. Departure is on 5 April 2027.'
      : 'Depois dessa data o grupo é fechado junto da agência e não é possível acrescentar mais ninguém — nem se alguém desistir. A partida é a 5 de abril de 2027.',
  );
};

const italyFlightNote = (locale: EmailLocale) =>
  locale === 'en'
    ? emailNotePanel(
        'About the flights',
        'Pilgrims living in Portugal or Brazil travel on the flight package arranged by our travel agency (paid directly to the agency, never added to the land price). From any other country you book your own flights — you only need to be in Rome by 10:00 on 5 April 2027. We tell you exactly what to book.',
      )
    : emailNotePanel(
        'Sobre os voos',
        'Quem mora em Portugal ou no Brasil viaja no pacote aéreo da nossa agência (pago direto à agência, nunca somado ao terrestre). De qualquer outro país, você compra a própria passagem — só precisa estar em Roma até às 10:00 do dia 5 de abril de 2027. A gente diz exatamente o que reservar.',
      );

// CTA secundário: quem tem dúvida raramente clica no botão principal, mas fala
// no WhatsApp. Os emails saem de no-reply@, por isso nunca pedimos resposta.
const italyTalkToUs = (locale: EmailLocale) =>
  locale === 'en'
    ? `${Text(`Any question at all — flights, rooms, travelling alone, paying in instalments — message us on ${contactWa} or email ${contactMail}. A real person answers.`)}`
    : `${Text(`Qualquer dúvida — voos, quarto, viajar sozinho(a), parcelamento — fale com a gente pelo ${contactWa} ou por ${contactMail}. Quem responde é uma pessoa de verdade.`)}`;

const italyLaunchContent = (locale: EmailLocale) => {
  const isEn = locale === 'en';
  const intro = isEn
    ? [
        '<strong>{{greeting}}</strong>,',
        'In April 2027 the Garabandal Apostolate is taking a group to <strong>Italy and Medjugorje</strong> — 13 days, 10 shrines, from the tomb of Padre Pio to the hill of the apparitions in Medjugorje.',
        'We are writing to you because the places are going faster than we expected.',
      ]
    : [
        '<strong>{{greeting}}</strong>,',
        'Em abril de 2027 o Apostolado de Garabandal leva um grupo à <strong>Itália e a Medjugorje</strong> — 13 dias, 10 santuários, do túmulo do Padre Pio à colina das aparições em Medjugorje.',
        'Estamos escrevendo porque as vagas estão saindo mais rápido do que esperávamos.',
      ];
  const closing = isEn
    ? 'Take a look at the full programme, day by day, with no commitment. If it speaks to your heart, the place is secured on the same page.'
    : 'Veja o programa completo, dia a dia, sem compromisso nenhum. Se falar ao seu coração, a vaga é garantida na mesma página.';
  return `${intro.map((paragraph) => Text(paragraph)).join('')}
    ${italyScarcityBar(locale)}
    ${italyRouteWidget(locale)}
    ${testimonialCard(locale, 1)}
    ${italyIncludedWidget(locale)}
    ${Text(closing)}`;
};

const italyStoryContent = (locale: EmailLocale) => {
  const isEn = locale === 'en';
  const intro = isEn
    ? [
        '<strong>{{greeting}}</strong>,',
        'There is a reason this pilgrimage goes to Italy — and it is not tourism.',
        'When Conchita went to San Giovanni Rotondo, <strong>Padre Pio</strong> had already died. And yet she was given his veil, and the message he had left for her. The story of Garabandal and the story of Italy are tied together — and Medjugorje continues the same call to prayer, fasting and conversion.',
      ]
    : [
        '<strong>{{greeting}}</strong>,',
        'Existe um motivo para esta peregrinação passar pela Itália — e não é turismo.',
        'Quando Conchita foi a San Giovanni Rotondo, o <strong>Padre Pio</strong> já tinha morrido. Ainda assim, entregaram a ela o véu dele e a mensagem que ele havia deixado. A história de Garabandal e a história da Itália estão amarradas — e Medjugorje continua o mesmo chamado à oração, ao jejum e à conversão.',
      ];
  const highlights = isEn
    ? benefitChecklist('Four moments people never forget', [
        '<strong>San Giovanni Rotondo</strong> — Mass at the tomb of Padre Pio',
        '<strong>Lanciano</strong> — the oldest Eucharistic miracle in the Church, still visible today',
        '<strong>Assisi</strong> — the tombs of Saint Francis and Saint Clare',
        '<strong>Medjugorje</strong> — Apparition Hill and the evening prayer programme',
      ])
    : benefitChecklist('Quatro momentos que ninguém esquece', [
        '<strong>San Giovanni Rotondo</strong> — Missa junto ao túmulo do Padre Pio',
        '<strong>Lanciano</strong> — o milagre eucarístico mais antigo da Igreja, visível até hoje',
        '<strong>Assis</strong> — os túmulos de São Francisco e de Santa Clara',
        '<strong>Medjugorje</strong> — a Colina das Aparições e o programa de oração da noite',
      ]);
  const closing = isEn
    ? 'This is what we mean when we say this is not a trip. You come back different.'
    : 'É isso que queremos dizer quando falamos que não é uma viagem. Você volta diferente.';
  return `${intro.map((paragraph) => Text(paragraph)).join('')}
    ${emailFeatureBlock({
      image: '{{pilgrimage_image_url}}',
      eyebrow: isEn ? 'Italy and Medjugorje · April 2027' : 'Itália e Medjugorje · Abril de 2027',
      title: isEn ? 'Where Garabandal and Padre Pio meet' : 'Onde Garabandal e o Padre Pio se encontram',
      desc: isEn
        ? 'Thirteen days walking through the places that shaped this message — accompanied by our team, in a spirit of prayer and fellowship.'
        : 'Treze dias percorrendo os lugares que formaram esta mensagem — acompanhado pela nossa equipe, com espírito de oração e comunhão.',
    })}
    ${highlights}
    ${testimonialCard(locale, 3)}
    ${italyScarcityBar(locale)}
    ${Text(closing)}`;
};

const italyValueContent = (locale: EmailLocale, payload: MarketingTemplatePayload) => {
  const isEn = locale === 'en';
  const intro = isEn
    ? [
        '<strong>{{greeting}}</strong>,',
        'The question we get most is always the same: <em>"how much is it, really?"</em>',
        'So here is everything, with nothing hidden.',
      ]
    : [
        '<strong>{{greeting}}</strong>,',
        'A pergunta que mais recebemos é sempre a mesma: <em>"quanto custa, de verdade?"</em>',
        'Então aqui está tudo, sem letras miúdas.',
      ];
  const steps = isEn
    ? emailSteps('How registration works', [
        'Open the pilgrimage page and choose your room.',
        'Complete the registration form and confirm your details.',
        `Settle the amount in up to ${ITALY_CAMPAIGN.installments} interest-free instalments, until April 2027.`,
      ])
    : emailSteps('Como funciona a inscrição', [
        'Abra a página da peregrinação e escolha o seu quarto.',
        'Preencha a inscrição e confirme os seus dados.',
        `Pague em até ${ITALY_CAMPAIGN.installments}x sem juros, até abril de 2027.`,
      ]);
  const mission = isEn
    ? emailNotePanel(
        'Your place also builds something',
        'Part of what this pilgrimage raises goes to the Apostolate\'s mission house project in Garabandal. You travel — and you leave something standing behind you.',
      )
    : emailNotePanel(
        'A sua vaga também constrói algo',
        'Parte do que esta peregrinação arrecada vai para o projeto da casa de missão do Apostolado em Garabandal. Você viaja — e deixa algo de pé atrás de si.',
      );
  return `${intro.map((paragraph) => Text(paragraph)).join('')}
    ${italyPriceWidget(locale, payload)}
    ${italyIncludedWidget(locale)}
    ${italyFlightNote(locale)}
    ${steps}
    ${mission}
    ${italyTalkToUs(locale)}`;
};

const italyLastCallContent = (locale: EmailLocale, payload: MarketingTemplatePayload) => {
  const isEn = locale === 'en';
  const intro = isEn
    ? [
        '<strong>{{greeting}}</strong>,',
        'This is the last email we will send you about <strong>Italy and Medjugorje 2027</strong>. If the timing is not right, we leave it here with respect — and you stay in our prayers either way.',
        'But if this has been on your mind these past weeks, please read this one short thing:',
      ]
    : [
        '<strong>{{greeting}}</strong>,',
        'Este é o último email que enviamos sobre a <strong>Itália e Medjugorje 2027</strong>. Se o momento não for o certo, ficamos por aqui com respeito — e você continua na nossa oração de qualquer forma.',
        'Mas se isso ficou na sua cabeça nas últimas semanas, leia só isto:',
      ];
  const closing = isEn
    ? 'Most people who go tell us the same sentence afterwards: <em>"I almost didn\'t come."</em> If your heart is saying yes, this is the week to answer it.'
    : 'Quase todo mundo que vai nos diz a mesma frase depois: <em>"eu quase não vim."</em> Se o seu coração está dizendo sim, esta é a semana de responder.';
  const localLand = italyLocalPrice(ITALY_CAMPAIGN.landPriceEur, payload);
  return `${intro.map((paragraph) => Text(paragraph)).join('')}
    ${italyScarcityBar(locale)}
    ${italyDeadlineWidget(locale)}
    ${emailFeatureBlock({
      image: '{{pilgrimage_image_url}}',
      eyebrow: isEn ? `Departure ${ITALY_CAMPAIGN.dates.en}` : `Partida ${ITALY_CAMPAIGN.dates.pt}`,
      title: isEn ? 'Rome · Assisi · Padre Pio · Medjugorje' : 'Roma · Assis · Padre Pio · Medjugorje',
      desc: isEn
        ? `13 days, 10 shrines, ${ITALY_CAMPAIGN.price.en}${localLand ? ` (≈ ${localLand})` : ''} for the land package with hotel, meals and travel included — payable in up to ${ITALY_CAMPAIGN.installments} interest-free instalments.`
        : `13 dias, 10 santuários, ${ITALY_CAMPAIGN.price.pt}${localLand ? ` (≈ ${localLand})` : ''} no terrestre com hotel, alimentação e transporte incluídos — em até ${ITALY_CAMPAIGN.installments}x sem juros.`,
    })}
    ${testimonialCard(locale, 2)}
    ${italyTalkToUs(locale)}
    ${Text(closing)}`;
};

const waitlistContent = (locale: EmailLocale, variant: 'welcome' | 'open_spot' | 'more_spots') => {
  const isEn = locale === 'en';
  if (variant === 'more_spots') {
    return isEn
      ? `${Text('<strong>{{greeting}}</strong>,')}${Text('We have important news for you. Demand for <strong>{{pilgrimage_name}}</strong> has been so great that the places sold out — but precisely because of that demand, the Apostolate is studying the <strong>possibility of releasing a few more places</strong>.')}
        ${emailFeatureBlock({ image: '{{pilgrimage_image_url}}', eyebrow: 'Limited selection', title: 'Only a limited number of people can be chosen', desc: 'Imagine arriving in the mountains of Garabandal, praying with the group, living the Holy Mass and placing your intentions in the hands of Our Lady. We cannot promise a place to everyone — but those on the waiting list who show their interest now have the greatest chance of being considered.' })}
        ${emailNotePanel('Why act now', 'This is not a generic email. You are on the waiting list for this pilgrimage, so you have priority to be considered if more places open. The people who reply first and talk to us are the first to enter the selection.')}
        ${emailSteps('What to do now — it takes 1 minute', ['Message us on WhatsApp right now and say you want to be considered to go.', 'Tell us how many people you would like to go with (alone, as a couple, or as a family).', 'Keep an eye on our messages: if a place opens, we contact people in this order.'])}
        ${testimonialCard(locale, 2)}
        ${Text('If you feel this call, do not leave it for later. An opportunity like this is a grace — and graces, once they pass, do not always return. We are waiting for you. 🕊️')}`
      : `${Text('<strong>{{greeting}}</strong>,')}${Text('Temos uma novidade importante para você. A procura pela <strong>{{pilgrimage_name}}</strong> foi tão grande que as vagas esgotaram — mas, justamente por causa dessa procura, o Apostolado está avaliando a <strong>possibilidade de disponibilizar mais alguns lugares</strong>.')}
        ${emailFeatureBlock({ image: '{{pilgrimage_image_url}}', eyebrow: 'Seleção limitada', title: 'Só um número limitado de pessoas poderá ser escolhido', desc: 'Imagine chegar às montanhas de Garabandal, rezar com o grupo, viver a Santa Missa e colocar as suas intenções nas mãos de Nossa Senhora. Não podemos prometer vaga a todos — mas quem está na lista de espera e mostra interesse agora tem a maior possibilidade de ser considerado.' })}
        ${emailNotePanel('Por que agir agora', 'Este não é um email genérico. Você está na lista de espera desta peregrinação e, por isso, tem prioridade para ser considerado se abrirem mais lugares. As pessoas que respondem primeiro e falam conosco são as primeiras a entrar na seleção.')}
        ${emailSteps('O que fazer agora — leva 1 minuto', ['Fale conosco no WhatsApp agora e diga que quer ser considerado(a) para ir.', 'Diga com quantas pessoas gostaria de ir (sozinho(a), casal ou família).', 'Fique atento(a) às nossas mensagens: se abrir um lugar, avisamos nesta ordem.'])}
        ${testimonialCard(locale, 2)}
        ${Text('Se você sente este chamado, não deixe para depois. Uma oportunidade destas é uma graça — e as graças, quando passam, nem sempre voltam. Estamos à sua espera. 🕊️')}`;
  }
  if (variant === 'open_spot') {
    return isEn
      ? `${Text('<strong>{{greeting}}</strong>,')}${Text('Right now, {{vacancies_phrase}} on the pilgrimage <strong>{{pilgrimage_name}}</strong>. You are receiving this because you were on the waiting list, and this message is only sent when the system detects real availability.')}
        ${emailFeatureBlock({ image: '{{pilgrimage_image_url}}', eyebrow: '{{pilgrimage_vacancies}} places left', title: 'This may be the moment you were waiting for', desc: 'Imagine arriving in the mountains, praying with the group, walking the paths of Garabandal and giving God a few days that are truly set apart. If this pilgrimage is calling you, do not leave the decision for later: with so few places, they can disappear quickly.' })}
        ${emailNotePanel('Why act now', 'This is not a general newsletter. It is a direct availability alert for the pilgrimage you showed interest in — {{vacancies_phrase}}. Opening the page now is the safest way to secure yours.')}
        ${emailSteps('Your next three steps', ['Open the pilgrimage page and check the programme, dates and practical details.', 'If the date fits, confirm your registration while there is still availability.', 'If you need help, message us on WhatsApp before the opportunity closes.'])}
        ${testimonialCard(locale, 3)}
        ${Text('If this is not the right moment, no problem. But if your heart moved when you saw this message, it may be worth taking the next step today.')}`
      : `${Text('<strong>{{greeting}}</strong>,')}${Text('Neste momento {{vacancies_phrase}} na peregrinação <strong>{{pilgrimage_name}}</strong>. Você está recebendo este aviso porque entrou na lista de espera, e esta mensagem só é enviada quando há disponibilidade real.')}
        ${emailFeatureBlock({ image: '{{pilgrimage_image_url}}', eyebrow: '{{pilgrimage_vacancies}} vagas restantes', title: 'Talvez este seja o sinal que você esperava', desc: 'Imagine chegar às montanhas, rezar com o grupo, caminhar pelos lugares de Garabandal e entregar a Deus alguns dias verdadeiramente separados para a fé. Se essa peregrinação tocou seu coração, não deixe para depois: com tão poucas vagas, elas desaparecem rápido.' })}
        ${emailNotePanel('Por que agir agora', 'Este não é um email genérico. É um aviso direto de disponibilidade para a peregrinação pela qual você demonstrou interesse — {{vacancies_phrase}}. Abrir a página agora é a forma mais segura de garantir a sua.')}
        ${emailSteps('O que fazer agora', ['Abra a página da peregrinação e veja programa, datas e detalhes práticos.', 'Se a data fizer sentido para você, confirme a inscrição enquanto ainda há vagas.', 'Se precisar de ajuda, fale conosco pelo WhatsApp antes que a oportunidade feche.'])}
        ${testimonialCard(locale, 3)}
        ${Text('Se este não for o momento certo, tudo bem. Mas se seu coração se moveu ao ler este aviso, talvez valha a pena dar o passo hoje.')}`;
  }

  return isEn
    ? `${Text('<strong>{{greeting}}</strong>,')}${Text('Your interest has been registered. We will only contact you about this path again when there is something relevant: a new date, a real opening, or information that helps you decide.')}
      ${emailNotePanel('No false urgency', 'Being on the waiting list does not mean you will receive pressure emails. It means we keep your interest organised and contact you when there is something useful.')}
      ${emailFeatureBlock({ image: BENEFIT_IMG.archive, eyebrow: 'While you wait', title: 'You can still view open pilgrimages', desc: 'If another date or group works better for you, the pilgrimage page shows what is currently available.' })}
      ${Text(supportSentence(locale))}`
    : `${Text('<strong>{{greeting}}</strong>,')}${Text('Seu interesse ficou registrado. Só voltaremos a entrar em contato com você sobre este caminho quando houver algo relevante: uma nova data, uma vaga real, ou informação que ajude você a decidir.')}
      ${emailNotePanel('Sem falsa urgência', 'Estar em lista de espera não significa receber pressão. Significa que guardamos seu interesse de forma organizada e só avisamos quando há algo útil.')}
      ${emailFeatureBlock({ image: BENEFIT_IMG.archive, eyebrow: 'Enquanto espera', title: 'Veja peregrinações abertas', desc: 'Se outra data ou outro grupo fizer mais sentido para você, a página de peregrinações mostra o que está disponível neste momento.' })}
      ${Text(supportSentence(locale))}`;
};

const donationContent = (locale: EmailLocale, variant: 'thank_you' | 'story') => {
  const isEn = locale === 'en';
  if (variant === 'story') {
    return isEn
      ? `${Text('<strong>{{greeting}}</strong>,')}${Text('Your support is helping a very concrete project: the House of Welcome of the Garabandal Apostolate. It is a house in the mountains, acquired by the grace of God, to serve pilgrims and the mission.')}
        ${emailFeatureBlock({ image: BENEFIT_IMG.houseAfter, eyebrow: 'House of Welcome', title: 'A home for prayer, service and refuge', desc: 'The house needs restoration and renovation so it can welcome the Apostolate, support pilgrims and, in the future, serve as a safe refuge according to the mission entrusted to Garabandal.' })}
        ${emailFeatureBlock({ image: BENEFIT_IMG.houseBefore, eyebrow: 'Current need', title: 'From ruins to a place of welcome', desc: 'Much of the property is still deteriorated. Every donation helps with structural works, materials, infrastructure, local labour and welcoming spaces.' })}
        ${benefitChecklist('Your donation helps rebuild', ['Foundations, walls and roof for safety', 'Water, electricity and sanitation systems', 'Rooms, kitchen and shared spaces for welcome', 'The future presence of the Apostolate in Garabandal'])}
        ${emailNotePanel('A simple way to multiply the help', 'If this project touched your heart, please share it with one family member or friend who may want to help rebuild this house. One forwarded message can become concrete help.')}
        ${Text('If you wish to continue supporting the House of Welcome, the button below gives you a simple and secure way to do it. God reward you.')}`
      : `${Text('<strong>{{greeting}}</strong>,')}${Text('A sua ajuda está contribuindo para um projeto muito concreto: a Casa de Acolhimento do Apostolado de Garabandal. É uma casa nas montanhas, adquirida pela graça de Deus, para servir os peregrinos e a missão.')}
        ${emailFeatureBlock({ image: BENEFIT_IMG.houseAfter, eyebrow: 'Casa de Acolhimento', title: 'Uma casa para oração, serviço e acolhimento', desc: 'A casa precisa de obras e requalificação para acolher o Apostolado, apoiar peregrinos e, no futuro, servir como refúgio seguro dentro da missão confiada a Garabandal.' })}
        ${emailFeatureBlock({ image: BENEFIT_IMG.houseBefore, eyebrow: 'Necessidade real', title: 'Das ruínas a um lugar de acolhimento', desc: 'Grande parte do imóvel ainda está degradada. Cada doação ajuda em obras estruturais, materiais, infraestrutura, mão de obra local e espaços preparados para acolher.' })}
        ${benefitChecklist('A sua doação ajuda a reconstruir', ['Fundações, paredes e telhado com segurança', 'Redes de água, eletricidade e saneamento', 'Quartos, cozinha e áreas de convivência', 'A presença futura do Apostolado em Garabandal'])}
        ${emailNotePanel('Uma forma simples de multiplicar a ajuda', 'Se este projeto tocou o seu coração, compartilhe com um familiar ou amigo que talvez queira ajudar a reconstruir esta casa. Uma mensagem encaminhada pode se transformar em ajuda concreta.')}
        ${Text('Se desejar continuar apoiando a Casa de Acolhimento, o botão abaixo oferece uma forma simples e segura de contribuir. Deus lhe pague.')}`;
  }

  // Gratidão intemporal: este passo pode chegar dias ou meses depois da doação
  // (o funil inscreve também doadores antigos), por isso nunca diz "chegou agora".
  return isEn
    ? `${Text('<strong>{{greeting}}</strong>,')}${Text('At some point you supported the Apostolate with a donation — and we want you to know that it was not just a transaction. It was a concrete act of faith that keeps helping the message of Garabandal reach more hearts.')}
      ${emailFeatureBlock({ image: BENEFIT_IMG.archive, eyebrow: 'Thank you', title: 'Your gesture became mission', desc: 'It helps sustain pilgrimages, prayer initiatives, spiritual content and the daily work of the Apostolate.' })}
      ${emailNotePanel('We pray for you', 'May Our Lady of Garabandal intercede for you and your family. Your generosity is remembered with gratitude.')}
      ${Text('You can learn more about the mission and the work your support makes possible through the button below.')}`
    : `${Text('<strong>{{greeting}}</strong>,')}${Text('Em algum momento você apoiou o Apostolado com uma doação — e queremos que saiba que não foi apenas uma transação. Foi um ato concreto de fé que continua ajudando a mensagem de Garabandal a chegar a mais corações.')}
      ${emailFeatureBlock({ image: BENEFIT_IMG.archive, eyebrow: 'Obrigado', title: 'Seu gesto se transformou em missão', desc: 'Ajuda a sustentar peregrinações, iniciativas de oração, conteúdo espiritual e o trabalho diário do Apostolado.' })}
      ${emailNotePanel('Rezamos por você', 'Que Nossa Senhora de Garabandal interceda por você e pela sua família. Sua generosidade fica lembrada com gratidão.')}
      ${Text('Você pode conhecer melhor a missão e o trabalho que seu apoio torna possível pelo botão abaixo.')}`;
};

const memberInvitationContent = (locale: EmailLocale, variant: 'donor' | 'general') => {
  const isEn = locale === 'en';
  const intro = variant === 'donor'
    ? (isEn
      ? 'You have already supported the Apostolate with generosity. Today we would like to invite you to take a deeper and more stable step: becoming a member of this living mission.'
      : 'Você já apoiou o Apostolado com generosidade. Hoje queremos convidar você a dar um passo mais profundo e estável: tornar-se membro desta missão viva.')
    : (isEn
      ? 'We would like to invite you to become a member of the Garabandal Apostolate: not only to support once, but to belong continuously to this mission.'
      : 'Queremos convidar você a tornar-se membro do Apostolado de Garabandal: não apenas apoiar uma vez, mas fazer parte continuamente desta missão.');

  return isEn
    ? `${Text('<strong>{{greeting}}</strong>,')}${Text(intro)}
      ${emailFeatureBlock({ image: BENEFIT_IMG.association, eyebrow: 'Member area', title: 'Belong to the Apostolate, not only to a mailing list', desc: 'Membership opens a real spiritual area: private documentation, exclusive videos, prayer resources, intentions, discounts and a more direct participation in the life of the Apostolate.' })}
      ${benefitChecklist('What you receive as a member', ['Access to the private Garabandal documentation archive', 'Exclusive videos, documentaries and formation content', 'Altar of Intentions and annual Masses for members', '€50 discount on annual pilgrimages', '5% off books, conferences and Apostolate events', 'Community life with voice and voting rights'])}
      ${emailNotePanel('Annual membership: €25/year', 'This is a small annual commitment with immediate digital access. It sustains content production, pilgrim support, the headquarters and the spiritual life offered through the member area.')}
      ${Text(supportSentence(locale))}`
    : `${Text('<strong>{{greeting}}</strong>,')}${Text(intro)}
      ${emailFeatureBlock({ image: BENEFIT_IMG.association, eyebrow: 'Área de membro', title: 'Pertencer ao Apostolado, não apenas receber emails', desc: 'A adesão abre uma área espiritual real: documentação privada, vídeos exclusivos, recursos de oração, intenções, descontos e uma participação mais próxima na vida do Apostolado.' })}
      ${benefitChecklist('O que você recebe como membro', ['Acesso ao arquivo privado de documentação de Garabandal', 'Vídeos exclusivos, documentários e conteúdos de formação', 'Altar de Intenções e Missas anuais pelos membros', 'Desconto de 50€ nas peregrinações anuais', '5% nos livros, conferências e eventos do Apostolado', 'Vida comunitária com voz e direito de voto'])}
      ${emailNotePanel('Anuidade: 25€/ano', 'É um compromisso anual simples, com acesso digital imediato. Ele sustenta a produção de conteúdos, o apoio aos peregrinos, a sede e a vida espiritual oferecida na área de membro.')}
      ${Text(supportSentence(locale))}`;
};

const referralContent = (locale: EmailLocale, variant: 'member' | 'general' | 'share') => {
  const isEn = locale === 'en';
  if (variant === 'share') {
    return isEn
      ? `${Text('<strong>{{greeting}}</strong>,')}${Text('Your personal invitation is active in the member area. Many people discover Garabandal because someone close to them shares a simple, thoughtful invitation.')}
        ${emailFeatureBlock({ image: BENEFIT_IMG.association, eyebrow: 'Referral credit', title: 'Credit is only applied after a confirmed membership', desc: 'If someone becomes a member through your invitation, both of you receive {{referral_reward}} store credit. The credit can be used for books, items or donations.' })}
        ${emailSteps('Share when it feels right', ['Open your member area.', 'Copy your invitation link.', 'Send it personally to someone who may need peace, faith or hope.'])}`
      : `${Text('<strong>{{greeting}}</strong>,')}${Text('Seu convite pessoal está ativo na área de membro. Muitas pessoas descobrem Garabandal porque alguém próximo compartilha um convite simples, com cuidado e no momento certo.')}
        ${emailFeatureBlock({ image: BENEFIT_IMG.association, eyebrow: 'Saldo por convite', title: 'O saldo só entra quando uma adesão é confirmada', desc: 'Se alguém se tornar membro através do seu convite, ambos recebem {{referral_reward}} de saldo na Loja. Esse saldo pode ser usado em livros, artigos ou donativos.' })}
        ${emailSteps('Compartilhe quando fizer sentido', ['Abra sua área de membro.', 'Copie seu link de convite.', 'Envie pessoalmente a alguém que possa precisar de paz, fé ou esperança.'])}`;
  }

  return isEn
    ? `${Text('<strong>{{greeting}}</strong>,')}${Text(variant === 'member' ? 'Think of one person: a family member, a friend, someone searching for peace or going through a difficult moment.' : 'If you know someone looking for something deeper, the message of Garabandal may be exactly what that person needs to discover.')}
      ${emailFeatureBlock({ image: BENEFIT_IMG.archive, eyebrow: 'A personal invitation', title: 'A simple link can open a real path', desc: 'You do not need to explain everything. Share your invitation with care and let the person discover the Apostolate at their own pace.' })}
      ${emailSteps('How it works', ['Share your personal invitation link.', 'Your friend discovers the mission and may become a member.', 'When that happens, both receive {{referral_reward}} store credit as a thank-you.'])}`
    : `${Text('<strong>{{greeting}}</strong>,')}${Text(variant === 'member' ? 'Pense numa pessoa: um familiar, um amigo, alguém que procura paz ou atravessa um momento difícil.' : 'Se você conhece alguém que busca algo mais profundo, a mensagem de Garabandal pode ser exatamente o que essa pessoa precisa encontrar.')}
      ${emailFeatureBlock({ image: BENEFIT_IMG.association, eyebrow: 'Convite pessoal', title: 'Um link simples pode abrir um caminho real', desc: 'Não precisa explicar tudo. Compartilhe seu convite com cuidado e deixe a pessoa conhecer o Apostolado no próprio ritmo.' })}
      ${emailSteps('Como funciona', ['Compartilhe seu link pessoal de convite.', 'Seu amigo conhece a missão e pode se tornar membro.', 'Quando isso acontece, ambos recebem {{referral_reward}} de saldo na Loja como agradecimento.'])}`;
};

const referralRewardContent = (locale: EmailLocale, variant: 'inviter' | 'invitee') => {
  const isEn = locale === 'en';

  if (variant === 'inviter') {
    return isEn
      ? `${Text('<strong>{{greeting}}</strong>,')}${Text('<strong>{{invitee_name}}</strong> has become a member through your invitation. Thank you: your personal share helped someone take a real step into the Apostolate.')}
        ${emailFeatureBlock({ image: BENEFIT_IMG.association, eyebrow: 'Confirmed invitation', title: '{{referral_reward}} has been added to your store credit', desc: 'The credit is available in your member area and can be used for official books, items or donations. {{invitee_name}} also received the same credit as a welcome gift.' })}
        ${emailSteps('Keep the invitation alive', ['Open your member area and check your credit.', 'Copy your personal invitation link again.', 'Share it with one person who may need peace, faith or hope.'])}`
      : `${Text('<strong>{{greeting}}</strong>,')}${Text('<strong>{{invitee_name}}</strong> se tornou membro através do seu convite. Obrigado: sua indicação pessoal ajudou alguém a dar um passo real dentro do Apostolado.')}
        ${emailFeatureBlock({ image: BENEFIT_IMG.association, eyebrow: 'Convite confirmado', title: '{{referral_reward}} foram adicionados ao seu saldo da Loja', desc: 'O saldo está disponível na sua área de membro e pode ser usado em livros oficiais, artigos ou donativos. {{invitee_name}} também recebeu o mesmo saldo como presente de boas-vindas.' })}
        ${emailSteps('Mantenha o convite vivo', ['Abra sua área de membro e veja o saldo.', 'Copie novamente seu link pessoal de convite.', 'Compartilhe com uma pessoa que possa precisar de paz, fé ou esperança.'])}`;
  }

  return isEn
    ? `${Text('<strong>{{greeting}}</strong>,')}${Text('You became a member through the invitation of <strong>{{inviter_name}}</strong>. As a welcome thank-you, <strong>{{referral_reward}}</strong> has been added to your store credit.')}
      ${emailFeatureBlock({ image: BENEFIT_IMG.association, eyebrow: 'Welcome credit', title: 'Your credit is ready in the member area', desc: 'You can use it for official books, items or donations. Your own invitation link is also ready, so you can invite someone else when the time feels right.' })}
      ${emailSteps('What you can do now', ['Open your member area and check your credit.', 'Use the credit in the Online Store when you wish.', 'Share your own invitation with someone who may benefit from the mission.'])}`
    : `${Text('<strong>{{greeting}}</strong>,')}${Text('Você se tornou membro através do convite de <strong>{{inviter_name}}</strong>. Como gesto de boas-vindas, <strong>{{referral_reward}}</strong> foram adicionados ao seu saldo da Loja.')}
      ${emailFeatureBlock({ image: BENEFIT_IMG.association, eyebrow: 'Saldo de boas-vindas', title: 'Seu saldo está pronto na área de membro', desc: 'Você pode usá-lo em livros oficiais, artigos ou donativos. Seu próprio link de convite também já está pronto, para compartilhar com alguém quando fizer sentido.' })}
      ${emailSteps('O que você pode fazer agora', ['Abrir a área de membro e ver o saldo.', 'Usar o saldo na Loja Online quando desejar.', 'Compartilhar seu próprio convite com alguém que possa se beneficiar da missão.'])}`;
};

const storeBookRecommendationContent = (locale: EmailLocale) => {
  const isEn = locale === 'en';
  return isEn
    ? `${Text('<strong>{{greeting}}</strong>,')}${Text('If Garabandal has been speaking to your heart, one of the best next steps is to read with calm and depth. The official store has books and digital guides prepared precisely for that: to help you understand, pray and share the message at home.')}
      ${emailNotePanel('Official store recommendation', 'Below are active products from the Apostolate store. This is not a membership email: it is a direct recommendation for those who want to keep discovering Garabandal through reliable material.')}
      ${benefitChecklist('Why these books help', ['They give context to the apparitions and messages', 'They are easy to read at home or share with family', 'Digital editions are available immediately after purchase', 'Every purchase also supports the mission of the Apostolate'])}`
    : `${Text('<strong>{{greeting}}</strong>,')}${Text('Se Garabandal tem falado ao seu coração, um dos melhores próximos passos é ler com calma e profundidade. A Loja oficial reúne livros e guias digitais preparados justamente para isso: ajudar você a compreender, rezar e compartilhar a mensagem em casa.')}
      ${emailNotePanel('Recomendação da Loja oficial', 'Abaixo estão produtos ativos da Loja do Apostolado. Este não é um email de adesão como membro: é uma recomendação direta para quem deseja continuar conhecendo Garabandal com material confiável.')}
      ${benefitChecklist('Por que estes livros ajudam', ['Dão contexto às aparições e mensagens', 'São fáceis de ler em casa ou compartilhar com a família', 'As edições digitais ficam disponíveis rapidamente após a compra', 'Cada compra também apoia a missão do Apostolado'])}`;
};

const storeBookFlashSaleContent = (locale: EmailLocale) => {
  const isEn = locale === 'en';
  const discount = `${Math.round(STORE_BOOK_PROMO.discountRate * 100)}%`;

  return isEn
    ? `${Text('<strong>{{greeting}}</strong>,')}${Text(`Today is the day of the first apparition of Our Lady in Garabandal, and we prepared a special edition campaign for the official bookstore: <strong>${discount} off all Garabandal books, today only</strong>.`)}
      ${storeBookPromoCountdownBlock(locale)}
      ${emailNotePanel('A real one-day campaign', 'The discount is available only until midnight in Brazil. If there is a book you have been meaning to read, gift or keep at home for prayer, today is the right moment to get it before the price returns to normal.')}
      ${benefitChecklist('Why choose one today', ['Official material to understand the apparitions with depth', 'Digital books available quickly after purchase', 'A meaningful gift for family or friends who need faith and hope', 'Every purchase supports the mission of the Apostolate'])}`
    : `${Text('<strong>{{greeting}}</strong>,')}${Text(`Hoje é o dia da primeira aparição de Nossa Senhora em Garabandal. Por isso, abrimos uma campanha especial da Loja oficial: <strong>${discount} de desconto em todos os livros de Garabandal, só hoje</strong>.`)}
      ${storeBookPromoCountdownBlock(locale)}
      ${emailNotePanel('Uma campanha real de um dia', 'O desconto fica disponível apenas até a meia-noite no Brasil. Se havia um livro que você queria ler, oferecer ou ter em casa para rezar e aprofundar a mensagem, este é o momento de adquirir antes que o preço volte ao normal.')}
      ${benefitChecklist('Por que escolher hoje', ['Material oficial para compreender as aparições com profundidade', 'Livros digitais disponíveis rapidamente após a compra', 'Um presente com sentido para familiares ou amigos que precisam de fé e esperança', 'Cada compra também apoia a missão do Apostolado'])}`;
};

/* -------------------------------------------------------------------------- */
/*                              RENDER FUNCTIONS                              */
/* -------------------------------------------------------------------------- */

export const renderMembershipEmail = (payload: MembershipNotificationInput) => {
  // Admin-facing label (subject), so a neutral fallback is fine.
  const memberLabel = payload.memberName || payload.memberEmail || 'novo membro';
  const amountText = formatCurrency(payload.amount, payload.currency || "EUR");
  const isRenewal = payload.kind === "renewal";

  return {
    subject: `Nova ${isRenewal ? "Renovação" : "Inscrição"} - ${memberLabel}`,
    html: Layout({
      title: isRenewal ? "Renovação de Anuidade" : "Nova Inscrição de Membro",
      children: `
                ${Header({
        title: isRenewal
          ? "Anuidade Renovada"
          : "Novo Membro Registado",
        subtitle: memberLabel,
      })}
                ${Section({
        children: `
                        ${Text("Foi processado com sucesso um pagamento de anuidade.")}
                        ${Card({
          children: `
                                ${InfoRow({ label: "Membro", value: memberLabel })}
                                ${InfoRow({ label: "Email", value: payload.memberEmail || "-" })}
                                ${InfoRow({ label: "Nº Associado", value: payload.memberNumber || "Pendente" })}
                                ${InfoRow({ label: "Valor", value: amountText })}
                                ${InfoRow({ label: "Método", value: payload.paymentMethod })}
                                ${InfoRow({ label: "Próximo Vencimento", value: formatDate(payload.nextQuotaDate) })}
                                ${InfoRow({ label: "Data Pagamento", value: formatDate(payload.paidAt), isLast: true })}
                            `,
        })}
                    `,
      })}
            `,
    }),
  };
};

export const renderMemberReceiptEmail = (payload: MemberReceiptInput) => {
  const locale = payload.locale === "en" ? "en" : "pt";
  const isEn = locale === "en";
  const memberLabel = payload.memberName || (isEn ? "Dear Member" : "Estimado Membro");
  const amountText = formatCurrency(payload.amount, payload.currency || "EUR", locale);

  return {
    subject: isEn ? `Your membership is confirmed — receipt` : `A sua anuidade está confirmada — recibo`,
    html: Layout({
      title: isEn ? "Payment Receipt" : "Recibo de Pagamento",
      preview: isEn ? `Confirmation of your annual membership payment.` : `Confirmação do pagamento da sua anuidade.`,
      locale,
      children: `
                ${Header({
        title: isEn ? "Payment Confirmed" : "Pagamento Confirmado",
        subtitle: isEn ? "Thank you for walking with us." : "Obrigado por caminhar com a gente.",
      })}
                ${Section({
        children: `
                        ${Text(isEn ? `Hello <strong>${memberLabel}</strong>,` : `Olá <strong>${memberLabel}</strong>,`)}
                        ${Text(isEn ? "We confirm your annual membership. You are a member of the Apostolate of Garabandal — and your contribution directly sustains the spread of Our Lady's message: every pilgrimage, every book, every soul that reaches Garabandal." : "Confirmamos a sua anuidade. É membro do Apostolado de Garabandal — e a sua contribuição sustenta diretamente a difusão da mensagem de Nossa Senhora: cada peregrinação, cada livro, cada alma que chega a Garabandal.")}
                        
                        ${payload.hasDiploma
            ? `
                            <div style="background:${COLORS.primaryLight};border:1px solid ${COLORS.primary};border-radius:12px;padding:16px;margin-bottom:24px;text-align:center;">
                                <strong style="color:${COLORS.primary};display:block;margin-bottom:4px;">${isEn ? "Member Certificate" : "Diploma de Membro"}</strong>
                                <span style="font-size:14px;">${isEn ? "Your digital member certificate is attached to this email." : "O seu diploma digital segue em anexo a este email."}</span>
                            </div>
                        `
            : ""
          }

                        ${HeadingSmall(isEn ? "Transaction Details" : "Detalhes da Transação")}
                        ${Card({
            children: `
                                ${InfoRow({ label: isEn ? "Member No." : "Nº de Membro", value: payload.memberNumber || "-" })}
                                ${InfoRow({ label: isEn ? "Amount" : "Valor", value: amountText })}
                                ${InfoRow({ label: isEn ? "Method" : "Método", value: payload.paymentMethod })}
                                ${InfoRow({ label: isEn ? "Reference" : "Referência", value: payload.paymentReference || "-" })}
                                ${InfoRow({ label: isEn ? "Date" : "Data", value: formatDate(payload.paidAt, locale), isLast: true })}
                            `,
          })}
                        
                        ${Button({ label: isEn ? "Go to Member Area" : "Aceder à Área de Membro", url: isEn ? `${APP_URL}/en/member` : `${APP_URL}/member` })}
                        ${Text(isEn ? "May Our Lady of Garabandal bless you." : "Que Nossa Senhora de Garabandal o abençoe.", "text-align:center;font-style:italic;margin-top:24px;color:" + COLORS.textLight)}
                    `,
      })}
            `,
    }),
  };
};

export const renderWelcomeEmail = (payload: {
  name: string;
  email: string;
}) => {
  return {
    subject: `${payload.name.split(' ')[0]}, bem-vindo ao Apostolado de Garabandal`,
    html: Layout({
      title: "Bem-vindo",
      preview: "A sua conta está ativa. Tudo pronto para começar.",
      children: `
                ${Header({
        title: "Bem-vindo à família",
        subtitle: "Apostolado de Garabandal em Língua Portuguesa",
      })}
                ${Section({
        children: `
                        ${Text(`Olá <strong>${payload.name.split(' ')[0]}</strong>,`)}
                        ${Text("É com alegria que acolhemos você. A sua conta está ativa — e, a partir de hoje, faz parte de uma comunidade que mantém viva a mensagem que Nossa Senhora confiou às crianças de Garabandal.")}
                        ${Text("Veja o que você pode fazer a partir de agora:")}

                        <div style="display:grid;gap:12px;margin:24px 0;">
                            <div style="background:${COLORS.bg};padding:12px 16px;border-radius:8px;border-left:3px solid ${COLORS.primary};">✦ <strong>Peregrine a Garabandal</strong> — inscreva-se em minutos</div>
                            <div style="background:${COLORS.bg};padding:12px 16px;border-radius:8px;border-left:3px solid ${COLORS.primary};">✦ <strong>Aprofunde a sua fé</strong> — loja e Biblioteca Digital</div>
                            <div style="background:${COLORS.bg};padding:12px 16px;border-radius:8px;border-left:3px solid ${COLORS.primary};">✦ <strong>Torne-se membro</strong> — sustente a missão e receba o seu diploma</div>
                        </div>

                        ${Button({ label: "Explorar a Minha Conta", url: `${APP_URL}/login` })}
                        ${Text("Que Nossa Senhora de Garabandal o abençoe e acompanhe neste caminho.", "text-align:center;font-style:italic;margin-top:24px;color:" + COLORS.textLight)}
                    `,
      })}
            `,
    }),
  };
};

export const renderBookingConfirmationEmail = (payload: {
  bookingId: string;
  email: string;
  pilgrimageName: string;
  amount: number;
  totalAmount: number;
  paymentMethod: string;
  magicLink: string;
  locale?: 'pt' | 'en';
}) => {
  const registrationFee = Number(payload.amount) || 0;
  const totalAmount = Number(payload.totalAmount) || 0;
  const remainingAmount = Math.max(0, totalAmount - registrationFee);
  const isEn = payload.locale === 'en';

  const t = {
    subject: isEn ? `Registration received: ${payload.pilgrimageName}` : `Inscrição recebida: ${payload.pilgrimageName}`,
    title: isEn ? 'Registration Received' : 'Inscrição Recebida',
    intro: isEn ? 'Your registration has been successfully recorded.' : 'A sua inscrição foi registada com sucesso.',
    summary: isEn ? 'Here is a direct summary of the amounts:' : 'Para facilitar, deixamos o resumo de valores de forma direta:',
    pilgrimage: isEn ? 'Pilgrimage' : 'Peregrinação',
    regFee: isEn ? 'Registration Fee' : 'Taxa de Inscrição',
    remaining: isEn ? 'Remaining Amount' : 'Valor Restante',
    total: isEn ? 'Total (Registration Fee + Remaining Amount)' : 'Total (Taxa de Inscrição + Valor Restante)',
    warning: isEn ? 'Attention: if the Registration Fee is not paid, the place is not confirmed and you may lose the spot.' : 'Atenção: se a Taxa de Inscrição não for paga, o lugar não fica confirmado e pode perder a vaga.',
    cta: isEn ? 'To follow your registration and complete the next payment steps, use the button below:' : 'Para acompanhar a sua inscrição e concluir os próximos passos de pagamento, use o botão abaixo:',
    ctaButton: isEn ? 'Manage Registration' : 'Gerir Inscrição',
  };

  return {
    subject: t.subject,
    html: Layout({
      title: t.title,
      children: `
                ${Header({
        title: t.title,
        subtitle: payload.pilgrimageName,
      })}
                ${Section({
        children: `
                        ${Text(t.intro)}
                        ${Text(t.summary)}
                        ${Card({
          children: `
                                ${InfoRow({ label: t.pilgrimage, value: payload.pilgrimageName })}
                                ${InfoRow({ label: t.regFee, value: formatCurrency(registrationFee) })}
                                ${InfoRow({ label: t.remaining, value: formatCurrency(remainingAmount) })}
                                ${InfoRow({ label: t.total, value: formatCurrency(totalAmount), isLast: true })}
                            `,
        })}
                        ${Card({
          children: `
                                <p style="margin:0;color:${COLORS.error};font-weight:700;">
                                    ${t.warning}
                                </p>
                            `,
        })}
                        ${Text(t.cta)}
                        ${Button({ label: t.ctaButton, url: payload.magicLink })}
                    `,
      })}
            `,
    }),
  };
};

export const renderQuotaReminderEmail = (payload: QuotaReminderInput) => {
  const locale: EmailLocale = payload.locale === 'en' ? 'en' : 'pt';
  const isEn = locale === 'en';
  const isOverdue = (payload.daysOverdue || 0) > 0;
  const daysText = isOverdue
    ? isEn
      ? `${payload.daysOverdue} days overdue`
      : `${payload.daysOverdue} dias em atraso`
    : isEn
      ? `${payload.daysUntilDue} days until due`
      : `${payload.daysUntilDue} dias para vencer`;

  const greetingName = payload.memberName
    || (isEn ? 'Apostolate member' : 'membro(a) do Apostolado');
  const firstName = payload.memberName ? payload.memberName.split(' ')[0] : '';
  const namePrefix = firstName ? `${firstName}, ` : '';

  return {
    subject: isOverdue
      ? isEn
        ? `${namePrefix}we miss you — renew your membership`
        : `${namePrefix}sentimos sua falta — renove sua anuidade 🕊️`
      : isEn
        ? `${namePrefix}your membership is due soon`
        : `${namePrefix}sua anuidade vence em breve 🕊️`,
    html: Layout({
      title: isEn ? 'Membership Annuity Status' : 'Estado da Anuidade',
      locale,
      children: `
                ${Header({
        title: isOverdue
          ? isEn ? 'Annuity Overdue' : 'Anuidade em Atraso'
          : isEn ? 'Annuity Renewal' : 'Renovação de Anuidade',
        subtitle: isOverdue
          ? isEn ? 'Come back to the mission' : 'Volte a fazer parte da missão'
          : isEn ? 'Stay with us on this mission' : 'Continue conosco nesta missão',
      })}
                ${Section({
        children: `
                        ${Text(`${isEn ? 'Hello' : 'Olá'} <strong>${greetingName}</strong>,`)}
                        ${Text(
          isOverdue
            ? isEn
              ? 'We noticed your membership is pending. We know life gets busy — but your presence is missed. In just a few clicks you can renew and keep sustaining the message of Garabandal.'
              : 'Notamos que sua anuidade está pendente. Sabemos que a vida corre — mas sua presença faz falta. Em poucos cliques você regulariza e continua sustentando a mensagem de Garabandal.'
            : isEn
              ? 'Your membership is approaching its renewal date. By renewing, you keep the message of Garabandal alive — and remain part of this family that prays and works for Our Lady.'
              : 'Sua anuidade está próxima do vencimento. Renovando, você mantém viva a difusão da mensagem de Garabandal — e continua fazendo parte desta família que reza e trabalha por Nossa Senhora.',
        )}

                        ${Card({
          children: `
                                ${InfoRow({ label: isEn ? 'Member No.' : 'Nº de Membro', value: payload.memberNumber || '-' })}
                                ${InfoRow({ label: isEn ? 'Due date' : 'Vencimento', value: formatDate(payload.nextQuotaDate, locale) })}
                                ${InfoRow({ label: 'Status', value: `<span style="color:${isOverdue ? COLORS.error : COLORS.primary};font-weight:bold;">${daysText}</span>`, isLast: true })}
                            `,
        })}

                        ${Button({ label: isEn ? 'Renew My Membership' : 'Renovar Minha Anuidade', url: payload.membershipUrl || `${APP_URL}/member` })}
                    `,
      })}
            `,
    }),
  };
};

export const renderPilgrimagePaymentReminderEmail = (
  payload: PilgrimagePaymentReminderInput,
) => {
  const locale: EmailLocale = payload.locale === 'en' ? 'en' : 'pt';
  const isEn = locale === 'en';
  const isShortDeadline =
    payload.stage === 'upcoming_3d' ||
    payload.stage === 'upcoming_1d' ||
    payload.stage === 'overdue_2d' ||
    payload.stage === 'overdue_5d';

  const subtitleMap: Record<PilgrimagePaymentReminderInput['stage'], string> = isEn
    ? {
        upcoming_3d: '3 days left to pay the registration deposit',
        upcoming_1d: '1 day left to pay the registration deposit',
        upcoming_7d: '7 days until the due date',
        upcoming_2d: '2 days until the due date',
        due_today: 'Payment is due today',
        overdue_2d: 'The registration deposit is overdue',
        overdue_5d: 'The registration deposit is still pending',
        overdue_3d: 'The payment is overdue',
        overdue_10d: 'This amount remains pending',
      }
    : {
        upcoming_3d: 'Faltam 3 dias para pagar o sinal de inscrição',
        upcoming_1d: 'Falta 1 dia para pagar o sinal de inscrição',
        upcoming_7d: 'Faltam 7 dias para o vencimento',
        upcoming_2d: 'Faltam 2 dias para o vencimento',
        due_today: 'O pagamento vence hoje',
        overdue_2d: 'O sinal de inscrição está em atraso',
        overdue_5d: 'O sinal de inscrição continua por regularizar',
        overdue_3d: 'O pagamento está em atraso',
        overdue_10d: 'Continua pendente regularizar este valor',
      };

  const introMap: Record<PilgrimagePaymentReminderInput['stage'], string> = isEn
    ? {
        upcoming_3d:
          'The registration deposit has a 5-day deadline after booking. 3 days remain until the due date.',
        upcoming_1d:
          'The deadline for the registration deposit ends tomorrow. If you have not yet regularised it, we recommend completing it today.',
        upcoming_7d:
          'We are sending an early reminder so you can organise the payment without last-minute pressure.',
        upcoming_2d:
          'The due date is very close. If you have not yet regularised, this is a good moment to complete the payment.',
        due_today:
          'Just a reminder that this payment is due today and remains pending.',
        overdue_2d:
          'The 5-day deadline for the registration deposit has passed. If you have already made the transfer, you can upload the receipt in your booking.',
        overdue_5d:
          'The registration deposit remains pending after the initial deadline. Please regularise this amount so your spot is not compromised.',
        overdue_3d:
          'We have noticed that this amount has not yet been recorded. If you have already paid, you can access your booking and upload the receipt.',
        overdue_10d:
          'This amount remains open. Please regularise it as soon as possible to keep your booking in good standing.',
      }
    : {
        upcoming_3d:
          'O sinal de inscrição tem prazo de 5 dias após a reserva. Faltam 3 dias para o vencimento.',
        upcoming_1d:
          'O prazo do sinal de inscrição termina amanhã. Se ainda não regularizou, recomendamos concluir hoje.',
        upcoming_7d:
          'Queremos lembrar com antecedência para que consiga organizar o pagamento sem pressão de última hora.',
        upcoming_2d:
          'O vencimento está muito próximo. Se ainda não regularizou, este é um bom momento para concluir o pagamento.',
        due_today:
          'Passamos só para recordar que este pagamento vence hoje e continua pendente.',
        overdue_2d:
          'O prazo de 5 dias para pagamento do sinal já passou. Se já efetuou a transferência, pode enviar o comprovativo na sua inscrição.',
        overdue_5d:
          'O sinal de inscrição continua pendente após o prazo inicial. Pedimos, por favor, que regularize este valor para não comprometer a sua vaga.',
        overdue_3d:
          'Verificámos que este valor ainda não foi registrado. Se já efetuou o pagamento, pode entrar na sua inscrição e enviar o comprovativo.',
        overdue_10d:
          'Este valor continua em aberto. Pedimos, por favor, que regularize a situação assim que possível para manter a sua inscrição sem pendências.',
      };

  const overdueStages: PilgrimagePaymentReminderInput['stage'][] = [
    'overdue_2d',
    'overdue_5d',
    'overdue_3d',
    'overdue_10d',
  ];
  const effectiveIsOverdue = overdueStages.includes(payload.stage);
  const heading = effectiveIsOverdue
    ? isEn ? 'Outstanding Payment' : 'Pagamento em Falta'
    : isEn ? 'Payment Reminder' : 'Lembrete de Pagamento';

  const greetingName = payload.recipientName
    || (isEn ? 'pilgrim' : 'peregrino(a)');
  const greetingPrefix = isEn ? 'Dear' : 'Estimado(a)';

  return {
    subject: effectiveIsOverdue
      ? isEn
        ? `Pilgrimage payment pending: ${payload.pilgrimageName}`
        : `Pagamento pendente da peregrinação: ${payload.pilgrimageName}`
      : isEn
        ? `Pilgrimage payment reminder: ${payload.pilgrimageName}`
        : `Lembrete de pagamento da peregrinação: ${payload.pilgrimageName}`,
    html: Layout({
      title: heading,
      locale,
      children: `
                ${Header({
        title: heading,
        subtitle: payload.pilgrimageName,
      })}
                ${Section({
        children: `
                        ${Text(`${isEn ? 'Hello' : 'Olá'} <strong>${greetingPrefix} ${greetingName}</strong>,`)}
                        ${Text(introMap[payload.stage])}
                        ${Card({
          children: `
                                ${InfoRow({ label: isEn ? 'Concerning' : 'Referente a', value: payload.obligationLabel })}
                                ${InfoRow({ label: isEn ? 'Due date' : 'Vencimento', value: formatDate(payload.dueDate, locale) })}
                                ${InfoRow({ label: isEn ? 'Amount for this stage' : 'Valor desta fase', value: formatCurrency(payload.amountDue, 'EUR', locale) })}
                                ${InfoRow({ label: isEn ? 'Total still outstanding' : 'Total ainda em falta', value: formatCurrency(payload.totalRemaining, 'EUR', locale), isLast: true })}
                            `,
        })}
                        ${Card({
          children: `
                                <p style="margin:0;color:${effectiveIsOverdue ? COLORS.error : COLORS.heading};font-weight:700;">
                                    ${subtitleMap[payload.stage]}
                                </p>
                                <p style="margin:12px 0 0;color:${COLORS.textLight};">
                                    ${isEn
                                      ? 'You can access your booking to pay now, or upload the receipt if you have already made the transfer.'
                                      : 'Pode entrar na sua inscrição para pagar agora ou enviar o comprovativo, caso já tenha feito a transferência.'}
                                </p>
                            `,
        })}
                        ${Button({ label: isEn ? 'Manage Booking' : 'Gerir Inscrição', url: payload.bookingUrl })}
                        ${Text(
                          isShortDeadline
                            ? isEn
                              ? 'This notice refers to the short deadline of the registration deposit. If you have recently regularised this amount, you may disregard this email.'
                              : 'Este aviso refere-se ao prazo curto do sinal de inscrição. Se já regularizou este valor recentemente, pode desconsiderar este email.'
                            : isEn
                              ? 'If you have recently regularised this amount, you may disregard this notice.'
                              : 'Se já regularizou este valor recentemente, pode desconsiderar este aviso.',
                        )}
                    `,
      })}
            `,
    }),
  };
};

export const renderPaymentReceiptAdminNotification = (
  payload: PaymentReceiptAdminNotificationInput,
) => {
  return {
    subject: `Novo Comprovativo Recebido: ${payload.pilgrimageName}`,
    html: Layout({
      title: "Novo Comprovativo de Pagamento",
      preview: "Foi recebido um novo comprovativo para validação.",
      children: `
                ${Header({
        title: "Comprovativo de Transferência",
        subtitle: payload.pilgrimageName,
      })}
                ${Section({
        children: `
                        ${Text("Foi enviado um novo comprovativo de transferência bancária que necessita de validação.")}
                        ${Card({
          children: `
                                ${InfoRow({ label: "Reserva", value: `Ref. ${payload.bookingId.slice(0, 8).toUpperCase()}` })}
                                ${InfoRow({ label: "Titular", value: payload.customerName })}
                                ${InfoRow({ label: "Email", value: payload.customerEmail })}
                                ${InfoRow({ label: "Referente a", value: payload.installmentLabel, isLast: true })}
                            `,
        })}
                        ${Text("Pode consultar e validar o comprovativo no painel de administração.")}
                        ${Button({ label: "Verificar nas Reservas", url: `${APP_URL}/admin/peregrinacoes` })}
                        ${Text("O comprovativo também está referenciado a este email (link direto abaixo).")}
                        <div style="text-align: center; margin-top: 16px;">
                            <a href="${payload.receiptUrl}" style="color:${COLORS.primary};font-weight:bold;text-decoration:none;font-size:14px;">📄 Ver Ficheiro do Comprovativo</a>
                        </div>
                    `,
      })}
            `,
    }),
  };
};

export const renderDonationReceiptEmail = (payload: DonationReceiptInput) => {
  const locale = payload.locale === "en" ? "en" : "pt";
  const isEn = locale === "en";
  const amountText = formatCurrency(payload.amount, payload.currency || "EUR", locale);
  return {
    subject: isEn ? `Donation successfully registered - ${amountText}` : `Doação registada com sucesso - ${amountText}`,
    html: Layout({
      title: isEn ? "Donation Registered" : "Doação Registada",
      locale,
      children: `
                ${Header({ title: isEn ? "Thank you for your generosity" : "Obrigado pela sua generosidade", subtitle: isEn ? "Donation confirmed" : "Doação confirmada" })}
                ${Section({
        children: `
                        ${Text(isEn ? `Thank you, <strong>${payload.donorName || "Benefactor"}</strong>. Your support is essential to the Apostolate's mission.` : `Obrigado, <strong>${payload.donorName || "Benfeitor"}</strong>. O seu apoio é fundamental para a missão do Apostolado.`)}
                        ${Card({
          children: `
                                ${InfoRow({ label: isEn ? "Amount" : "Valor", value: amountText })}
                                ${InfoRow({ label: isEn ? "Method" : "Método", value: payload.method })}
                                ${InfoRow({ label: isEn ? "Reference" : "Referência", value: payload.paymentReference || "-", isLast: true })}
                            `,
        })}
                        ${Text(isEn ? "We will keep this record for administrative and tax purposes, when applicable." : "Guardaremos este registro para efeitos administrativos e fiscais, quando aplicável.")}
                    `,
      })}
            `,
    }),
  };
};

export const renderGeneralLeadEmail = (payload: GeneralLeadInput) => {
  const locale = payload.locale === 'en' ? 'en' : 'pt';
  const isEn = locale === 'en';
  const trimmedName = (payload.name || '').trim();
  const firstName = trimmedName.split(' ')[0] || (isEn ? 'friend' : 'amigo(a)');
  const greetingPrefix = trimmedName ? '' : (isEn ? 'Dear ' : 'Estimado(a) ');
  return {
    subject: isEn ? `${firstName}, we received your interest — we are watching` : `${firstName}, recebemos o seu interesse — ficamos atentos`,
    html: Layout({
      title: isEn ? "Interest Registered" : "Interesse Registado",
      preview: isEn ? "You will be among the first to know about new dates and places." : "Será dos primeiros a saber sobre novas datas e vagas.",
      locale,
      children: `
                ${Header({ title: isEn ? "Your interest has been noted" : "O seu interesse foi registrado", subtitle: "Apostolado de Garabandal" })}
                ${Section({
        children: `
                        ${Text(isEn ? `Hello <strong>${greetingPrefix}${firstName}</strong>,` : `Olá <strong>${greetingPrefix}${firstName}</strong>,`)}
                        ${Text(isEn
          ? "Your contact has been registered. When there are new dates, places or relevant opportunities, we will reach out to you directly — before the public announcement."
          : "O seu contacto foi registrado. Quando existirem novas datas, vagas ou oportunidades relevantes, entraremos diretamente em contato com você — antes de anunciarmos ao público."
        )}
                        ${Text(isEn
          ? `In the meantime, you can browse the pilgrimages we currently have open. If you have any questions, message us on ${contactWa} or email ${contactMail}.`
          : `Entretanto, pode ver as peregrinações que estão abertas. Se tiver alguma questão, fale com a gente pelo ${contactWa} ou por ${contactMail}.`
        )}
                        ${Button({ label: isEn ? "View Pilgrimages" : "Ver Peregrinações", url: isEn ? `${APP_URL}/en/pilgrimages` : `${APP_URL}/peregrinacoes` })}
                    `,
      })}
            `,
    }),
  };
};

// Default exports for backward compatibility or less critical emails
// Using a generic wrapper for the existing logic if needed, or simple implementation
export const renderStoreOwnerEmail = (payload: any) => ({
  subject: `Nova encomenda recebida (${payload.orderRef})`,
  html: Layout({
    title: "Nova Encomenda",
    children: `
            ${Header({ title: "Nova encomenda na loja", subtitle: `Ref. ${payload.orderRef}` })}
            ${Section({
      children: `
                    ${Text("Foi registada uma nova encomenda no site.")}
                    ${Card({
        children: `
                            ${InfoRow({ label: "Referência", value: payload.orderRef || "-" })}
                            ${InfoRow({ label: "Cliente", value: payload.buyerName || "-" })}
                            ${InfoRow({ label: "Email", value: payload.buyerEmail || "-" })}
                            ${InfoRow({ label: "Total", value: payload.total || "-", isLast: true })}
                        `,
      })}
                    ${Button({ label: "Abrir Admin", url: `${APP_URL}/admin/encomendas` })}
                `,
    })}
    `,
  }),
});

export const renderStoreBuyerEmail = (payload: any) => ({
  subject: `Encomenda confirmada (${payload.orderRef})`,
  html: Layout({
    title: "Encomenda Confirmada",
    children: `
            ${Header({ title: "Recebemos a sua encomenda", subtitle: `Ref. ${payload.orderRef}` })}
            ${Section({
      children: `
                    ${Text(`Olá <strong>${payload.buyerName || "cliente"}</strong>,`)}
                    ${Text("Obrigado pela sua compra. A encomenda foi registada com sucesso.")}
                    ${Card({
        children: `
                            ${InfoRow({ label: "Referência", value: payload.orderRef || "-" })}
                            ${InfoRow({ label: "Subtotal", value: payload.subtotal || "-" })}
                            ${payload.shippingCost ? InfoRow({ label: "Envio", value: payload.shippingCost }) : ""}
                            ${InfoRow({ label: "IVA", value: payload.vat || "-" })}
                            ${InfoRow({ label: "Total", value: payload.total || "-", isLast: true })}
                        `,
      })}
                    ${Array.isArray(payload.items) && payload.items.length > 0
          ? Card({
            children: `
                          ${HeadingSmall("Produtos comprados")}
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:8px;">
                            ${payload.items
                .map(
                  (item: any) => `
                              <tr>
                                <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-size:14px;color:${COLORS.heading};">
                                  ${item.name || "Produto"}<br>
                                  <span style="font-size:12px;color:${COLORS.textLight};">Qtd: ${item.qty || 1}</span>
                                </td>
                                <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-size:14px;color:${COLORS.heading};text-align:right;font-weight:600;">
                                  ${formatCurrency(Number(item.unit_price || 0) * Number(item.qty || 1))}
                                </td>
                              </tr>
                            `,
                )
                .join("")}
                          </table>
                        `,
          })
          : ""
        }
                    ${Card({
          children: `
                          ${HeadingSmall("Próximos passos")}
                          <p style="margin:0 0 8px;font-size:14px;color:${COLORS.text};">1. Guarde a referência da encomenda: <strong>${payload.orderRef || "-"}</strong>.</p>
                          ${Array.isArray(payload.downloadLinks) &&
              payload.downloadLinks.length > 0
              ? `<p style="margin:0 0 8px;font-size:14px;color:${COLORS.text};">2. Clique nos botões abaixo para descarregar os seus ficheiros digitais.</p>
                               <p style="margin:0;font-size:14px;color:${COLORS.text};">3. Se o link expirar, aceda a <strong>Biblioteca Digital</strong> na sua área pessoal.</p>`
              : payload.hasDigital
                ? `<p style="margin:0 0 8px;font-size:14px;color:${COLORS.text};">2. Aceda à <strong>Biblioteca Digital</strong> na sua área pessoal para descarregar os seus produtos.</p>`
                : ""
            }
                          ${payload.shipping
              ? `<p style="margin:8px 0 0;font-size:14px;color:${COLORS.text};">${payload.hasDigital ? "4" : "2"}. Produtos físicos: receberá outro email quando a encomenda for expedida.</p>`
              : ""
            }
                        `,
        })}
                    ${Array.isArray(payload.downloadLinks) &&
          payload.downloadLinks.length > 0
          ? `
                      ${Text("Os seus produtos digitais estão disponíveis abaixo:")}
                      ${payload.downloadLinks
            .map((link: any) =>
              Button({
                label: `Descarregar: ${link.name || "Produto digital"}`,
                url: link.url,
              }),
            )
            .join("")}
                      ${Text(`Também pode aceder mais tarde em <a href="${APP_URL}/biblioteca" style="color:#1f2937;font-weight:700;">Biblioteca Digital</a>.`)}
                    `
          : payload.hasDigital
            ? `
                      ${Text(`Tem produtos digitais nesta encomenda. Pode aceder em <a href="${APP_URL}/biblioteca" style="color:#1f2937;font-weight:700;">Biblioteca Digital</a>.`)}
                    `
            : ""
        }
                    ${payload.shipping ? Text("Esta encomenda inclui produtos físicos. Enviaremos novo email quando a expedição for iniciada.") : ""}
                    ${(payload.showClaimCta ?? true) && payload.claimUrl
          ? `
                        ${Text("Se ainda não tem conta, clique no botão abaixo para criar acesso com este mesmo email e ligar esta encomenda ao seu perfil. Se já tem conta, basta iniciar sessão para concluir a associação.")}
                        ${Button({ label: "Associar Encomenda à Conta", url: payload.claimUrl })}
                      `
          : ""
        }
                `,
    })}
`,
  }),
});

export const renderStoreShippingEmail = (payload: any) => {
  const tracking = payload.tracking as string | null;
  const carrierName = payload.carrierName as string | null;
  const carrierId = payload.carrierId as string | null;

  // Build tracking URL for known carriers
  const carrierTrackingUrls: Record<string, (code: string) => string> = {
    ctt: (code) => `https://appserver.ctt.pt/CustomerArea/PublicArea_Detail?ObjectCodeInput=${code}&SearchInput=${code}`,
    ctt_registado: (code) => `https://appserver.ctt.pt/CustomerArea/PublicArea_Detail?ObjectCodeInput=${code}&SearchInput=${code}`,
    ctt_expresso: (code) => `https://appserver.ctt.pt/CustomerArea/PublicArea_Detail?ObjectCodeInput=${code}&SearchInput=${code}`,
    dpd_pt: (code) => `https://tracking.dpd.de/status/pt_PT/parcel/${code}`,
    gls_pt: (code) => `https://gls-group.eu/PT/pt/seguimento-de-encomendas.html?match=${code}`,
    seur_pt: (code) => `https://www.seur.com/pt/pt/ferramentas-online/track-tracing/localizacao-de-envio.shtml?ref=${code}`,
    chronopost_pt: (code) => `https://www.chronopost.pt/tracking-no-cms/suivi-page?listeNumerosLT=${code}`,
    nacex_pt: (code) => `https://www.nacex.pt/seguimientoDetalle.do?agencia_origen=&numero_albaran=${code}`,
    mrw_pt: (code) => `https://www.mrw.pt/cliente/seguimiento_envios/resultado_resumen/?AgencyCode=&Expedicion=${code}&Action=10`,
    correios_sedex: () => `https://rastreamento.correios.com.br/app/index.php`,
    correios_pac: () => `https://rastreamento.correios.com.br/app/index.php`,
    correios_registrada: () => `https://rastreamento.correios.com.br/app/index.php`,
    correios_encomenda: () => `https://rastreamento.correios.com.br/app/index.php`,
    jadlog_br: (code) => `https://jadlog.com.br/jadlog/tracking.jad?cte=${code}`,
    total_express_br: (code) => `https://totalexpress.com.br/rastrear?ids=${code}`,
    braspress_br: (code) => `https://www.braspress.com/rastrear/?numeroNota=${code}`,
    melhor_envio_br: (code) => `https://melhorrastreio.com.br/rastreio/${code}`,
    loggi_br: (code) => `https://www.loggi.com/rastreio/${code}`,
    dhl: (code) => `https://www.dhl.com/pt-pt/home/tracking.html?tracking-id=${code}`,
    fedex: (code) => `https://www.fedex.com/pt-pt/tracking.html?trknbr=${code}`,
    ups: (code) => `https://www.ups.com/track?tracknum=${code}`,
    tnt: (code) => `https://www.tnt.com/express/en_gc/site/shipping-tools/tracking.html?searchType=con&cons=${code}`,
  };

  const trackingUrl = tracking && carrierId && carrierTrackingUrls[carrierId]
    ? carrierTrackingUrls[carrierId](tracking)
    : null;

  const items: Array<{ name: string; qty: number; unit_price: number }> = payload.items || [];
  const currency = payload.currency || 'EUR';
  const totalAmount = payload.totalAmount ?? null;
  const shippingAddress: string = payload.shippingAddress || '';

  const formatCurrencyInline = (amount: number) =>
    new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(amount);

  const itemsHtml = items.length > 0 ? `
    <div style="background:#f8fafc;border-radius:12px;padding:16px 20px;margin-top:16px;">
      <p style="font-size:11px;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:1.5px;margin:0 0 12px;">Itens Encomendados</p>
      ${items.map(item => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #e2e8f0;">
          <span style="font-size:14px;color:#334155;">${item.qty}x ${item.name}</span>
          <span style="font-size:14px;font-weight:600;color:#1e293b;">${formatCurrencyInline(item.unit_price * item.qty)}</span>
        </div>
      `).join('')}
      ${totalAmount !== null ? `
        <div style="display:flex;justify-content:space-between;padding-top:12px;">
          <span style="font-size:14px;font-weight:700;color:#1e293b;">Total</span>
          <span style="font-size:16px;font-weight:800;color:#1e293b;">${formatCurrencyInline(totalAmount)}</span>
        </div>
      ` : ''}
    </div>
  ` : '';

  const addressHtml = shippingAddress ? `
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:16px 20px;margin-top:16px;">
      <p style="font-size:11px;font-weight:700;text-transform:uppercase;color:#0369a1;letter-spacing:1.5px;margin:0 0 8px;">Morada de Entrega</p>
      <p style="font-size:14px;color:#334155;white-space:pre-line;margin:0;">${shippingAddress}</p>
    </div>
  ` : '';

  return {
    subject: `📦 Encomenda enviada! — Ref. ${payload.orderRef}`,
    html: Layout({
      title: 'Encomenda Enviada',
      children: `
        ${Header({ title: 'A sua encomenda foi enviada! 📦', subtitle: `Ref. ${payload.orderRef}` })}
        ${Section({
        children: `
            ${Text(`Olá <strong>${payload.buyerName || 'cliente'}</strong>,`)}
            ${Text('Óptimas notícias! A sua encomenda foi processada e está a caminho.')}
            ${Card({
          children: `
                ${carrierName ? InfoRow({ label: 'Transportador', value: carrierName }) : ''}
                ${InfoRow({ label: 'Código de Rastreio', value: tracking ? `<span style="font-family:monospace;font-size:15px;font-weight:700;color:#1e40af;">${tracking}</span>` : 'Disponível em breve' })}
                ${InfoRow({ label: 'Data de Envio', value: formatDate(payload.shippedAt), isLast: !trackingUrl })}
                ${trackingUrl ? `
                  <div style="padding-top:16px;">
                    <a href="${trackingUrl}" target="_blank" rel="noopener noreferrer"
                      style="display:block;background:#1d4ed8;color:#ffffff;text-align:center;padding:14px 24px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;">
                      🔍 Rastrear Encomenda
                    </a>
                  </div>
                ` : ''}
              `,
        })}
            ${addressHtml}
            ${itemsHtml}
          `,
      })}
      `,
    }),
  };
};

export const renderStorePreparingEmail = (payload: any) => ({
  subject: `Estamos a preparar a sua encomenda(${payload.orderRef})`,
  html: Layout({
    title: "Encomenda em Preparação",
    children: `
            ${Header({ title: "Estamos a preparar a sua encomenda", subtitle: `Ref. ${payload.orderRef}` })}
            ${Section({
      children: `
                    ${Text(`Olá <strong>${payload.buyerName || "cliente"}</strong>,`)}
                    ${Text("A sua encomenda está em preparação. Assim que for enviada, receberá nova atualização por email.")}
                `,
    })}
`,
  }),
});

export const renderAbandonmentRecoveryEmail = (
  payload: AbandonmentRecoveryInput,
) => {
  const firstName = (payload.name || '').split(' ')[0] || 'peregrino';
  return {
  subject: `${firstName}, a sua vaga em ${payload.pilgrimageName} ficou por confirmar`,
  html: Layout({
    title: "Inscrição por Concluir",
    preview: "As vagas são limitadas — pode retomar onde ficou com um clique.",
    children: `
            ${Header({ title: "Sua inscrição ficou quase pronta", subtitle: payload.pilgrimageName })}
            ${Section({
      children: `
                    ${Text(`Olá <strong>${firstName}</strong>,`)}
                    ${Text(`Você iniciou a inscrição para <strong>${payload.pilgrimageName}</strong>, mas o processo ficou por concluir. As vagas são limitadas — e a sua pode ainda ser garantida.`)}
                    ${Text(`Pode retomar exatamente onde ficou com um clique. Se encontrou alguma dificuldade, fale com a gente pelo ${contactWa} ou por ${contactMail} e ajudamos.`)}
                    ${Button({ label: "Retomar e Confirmar a Minha Vaga", url: payload.recoveryLink })}
                `,
    })}
`,
  }),
};
};

export const renderDonationNotification = (payload: any) => ({
  subject: `Nova doação registada(${formatCurrency(payload.amount)})`,
  html: Layout({
    title: "Nova Doação",
    children: Section({
      children: `
                ${Text("Foi registada uma nova doação no sistema.")}
                ${Card({
        children: `
                        ${InfoRow({ label: "Doador", value: payload.donorName || "-" })}
                        ${InfoRow({ label: "Email", value: payload.donorEmail || "-" })}
                        ${InfoRow({ label: "Valor", value: formatCurrency(payload.amount) })}
                        ${InfoRow({ label: "Método", value: payload.paymentMethod || "-", isLast: true })}
                    `,
      })}
`,
    }),
  }),
});

export const renderBrochureEmail = (payload: BrochureEmailInput) => {
  const locale = payload.locale === 'en' ? 'en' : 'pt';
  const isEn = locale === 'en';
  const firstName = payload.name.split(' ')[0] || payload.name;
  return {
  subject: isEn
    ? `${firstName}, your brochure for ${payload.pilgrimageName} is here`
    : `${firstName}, o roteiro de ${payload.pilgrimageName} está aqui`,
  html: Layout({
    title: isEn ? "Pilgrimage Brochure" : "Roteiro da Peregrinação",
    preview: isEn
      ? `${payload.pilgrimageName} — dates, programme and how to register.`
      : `${payload.pilgrimageName} — datas, programa e como se inscrever.`,
    locale,
    children: Section({
      children: `
                ${Text(isEn ? `Hello <strong>${firstName}</strong>,` : `Olá <strong>${firstName}</strong>,`)}
                ${Text(isEn
        ? `Here is the brochure you requested for <strong>${payload.pilgrimageName}</strong>. Take your time reviewing the programme, dates and what is included.`
        : `Segue o roteiro que pediu para <strong>${payload.pilgrimageName}</strong>. Leia com calma — o programa, as datas e o que está incluído.`
      )}
                ${Text(isEn
        ? `If you have any questions or feel ready to take the next step, message us on ${contactWa} or email ${contactMail}. We are here.`
        : `Se tiver dúvidas ou sentir que está pronto para dar o próximo passo, fale com a gente pelo ${contactWa} ou por ${contactMail}. Estamos aqui.`
      )}
                ${Button({ label: isEn ? "Open and Download PDF" : "Abrir e Descarregar PDF", url: payload.pdfUrl })}
`,
    }),
  }),
};
};

export type MarketingTemplateKey =
  | 'brochure_followup_1'
  | 'pilgrimage_testimony'
  | 'pilgrimage_faq_objections'
  | 'italy_medjugorje_launch'
  | 'italy_medjugorje_story'
  | 'italy_medjugorje_value'
  | 'italy_medjugorje_last_call'
  | 'abandoned_registration_1'
  | 'abandoned_registration_faq'
  | 'abandoned_registration_final'
  | 'waitlist_welcome'
  | 'waitlist_open_spot'
  | 'waitlist_more_spots'
  | 'waitlist_garabandal_story'
  | 'waitlist_book_recommendation'
  | 'waitlist_mission_support'
  | 'waitlist_member_invitation'
  | 'payment_support'
  | 'donation_thank_you'
  | 'donation_thank_you_story'
  | 'donor_to_member'
  | 'member_invitation'
  | 'store_book_recommendation'
  | 'store_book_flash_sale'
  | 'membership_renewal'
  | 'member_referral_activation'
  | 'referral_activation'
  | 'share_mission'
  | 'referral_reward_inviter'
  | 'referral_reward_invitee'
  | 'member_welcome'
  | 'member_pray_intentions'
  | 'member_novena_invite'
  | 'member_learn_garabandal'
  | 'lead_to_member_welcome'
  | 'lead_to_member_followup'
  | 'newsletter_monthly';

export type MarketingTemplateProduct = {
  title?: string | null;
  price?: string | null;
  imageUrl?: string | null;
  url?: string | null;
  label?: string | null;
};

// Artigo real do site (tabela `posts`/`wp_pages`) para a newsletter mensal.
// A regra editorial é que `url` aponte sempre para conteúdo publicado — nunca
// para histórias inventadas.
export type MarketingTemplateArticle = {
  title: string;
  url: string;
  excerpt?: string | null;
  imageUrl?: string | null;
  tag?: string | null;
};

export type MarketingTemplatePayload = {
  templateKey: string;
  name?: string | null;
  email?: string | null;
  language?: EmailLocale;
  pilgrimageName?: string | null;
  pilgrimageUrl?: string | null;
  pilgrimageImageUrl?: string | null;
  pilgrimageDates?: string | null;
  pilgrimageStatus?: 'open' | 'waitlist' | null;
  pilgrimageVacancies?: number | null;
  bookingResumeUrl?: string | null;
  brochureUrl?: string | null;
  memberUrl?: string | null;
  donationUrl?: string | null;
  referralUrl?: string | null;
  referralCode?: string | null;
  inviteeName?: string | null;
  inviterName?: string | null;
  storeCredit?: string | null;
  products?: MarketingTemplateProduct[];
  articles?: MarketingTemplateArticle[];
  productTitle?: string | null;
  productPrice?: string | null;
  productImageUrl?: string | null;
  productUrl?: string | null;
  recommendation?: string | null;
  // Conversão de moeda para emails com preços: o público brasileiro lê em BRL e
  // o inglês em USD, mas o valor em EUR fica sempre ao lado (é o valor cobrado).
  // A taxa é obtida no envio; sem ela, os preços mostram só EUR.
  localCurrency?: { code: string; rate: number } | null;
  subjectOverride?: string | null;
  bodyOverride?: string | null;
  unsubscribeUrl?: string | null;
};

type MarketingTemplateDefinition = {
  key: MarketingTemplateKey;
  name: string;
  category: 'Peregrinações' | 'Doações' | 'Membros' | 'Indicações' | 'Vida Espiritual' | 'Loja';
  goal: string;
  defaultSubject: string;
  previewText: string;
  ctaLabel: string;
  ctaUrl: (payload: MarketingTemplatePayload) => string;
  title: string;
  subtitle: string;
  paragraphs: string[];
  requiredVariables: string[];
  // Optional rich HTML body (image cards, etc.). When present it replaces the
  // generic paragraph rendering. Locale-aware via the email's language.
  contentHtml?: (locale: EmailLocale, payload: MarketingTemplatePayload) => string;
  // Quando true, o cabeçalho usa a capa real da peregrinação
  // (`payload.pilgrimageImageUrl`) em vez da imagem genérica do Apostolado.
  useHeroImage?: boolean;
};

type MarketingTemplateLocalizedContent = Pick<
  MarketingTemplateDefinition,
  'goal' | 'defaultSubject' | 'previewText' | 'ctaLabel' | 'title' | 'subtitle' | 'paragraphs'
>;

const localizeMarketingPath = (path: string, locale: EmailLocale) => {
  if (locale !== 'en') return path;
  const map: Record<string, string> = {
    '/peregrinacoes': '/en/pilgrimages',
    '/tornar-membro': '/en/become-member',
    '/sobre-nos': '/en/about',
    '/donations': '/en/donations',
    '/loja': '/en/store',
    '/member': '/en/member',
    '/member/quota': '/en/member/quota',
    '/member/velas': '/en/member/candles',
    '/member/novenas': '/en/member/novenas',
    '/member/live': '/en/member/live',
    '/member/academy': '/en/member/academy',
  };
  return map[path] || (path.startsWith('/en/') ? path : path);
};

const marketingUrl = (path: string, payload: MarketingTemplatePayload) =>
  `${APP_URL}${localizeMarketingPath(path, payload.language === 'en' ? 'en' : 'pt')}`;

const WAITLIST_RECOMMENDED_PRODUCTS: MarketingTemplateProduct[] = [
  {
    title: 'Livro - Garabandal, Um Chamamento Urgente à Conversão',
    price: '16,50 EUR',
    imageUrl: 'https://pntzzuxzjnzksubbjfvj.supabase.co/storage/v1/object/public/store-products/products/200000048/1766876268448.webp',
    url: `${APP_URL}/loja/200000048-livro-garabandal-um-chamamento-urgente-a-conversao`,
    label: 'Livro físico',
  },
  {
    title: 'Diário de Conchita - Versão digital em Português',
    price: '19,99 EUR',
    imageUrl: 'https://pntzzuxzjnzksubbjfvj.supabase.co/storage/v1/object/public/store-products/products/978-989-33-8094--9/1766876383807.webp',
    url: `${APP_URL}/loja/978-989-33-8094--9-diario-de-conchita-versao-digital-em-portugues`,
    label: 'Livro digital',
  },
  {
    title: 'Guia do Peregrino - Garabandal (Português / Espanhol) - PDF',
    price: '9,99 EUR',
    imageUrl: 'https://pntzzuxzjnzksubbjfvj.supabase.co/storage/v1/object/public/store-products/products/200000057/1766876326970.webp',
    url: `${APP_URL}/loja/200000057-guia-do-peregrino-garabandal-portugues-espanhol-pdf`,
    label: 'Guia digital',
  },
];

const localizeMarketingUrl = (url: string, locale: EmailLocale) => {
  if (locale !== 'en') return url;
  return url
    .replace(`${APP_URL}/peregrinacoes`, `${APP_URL}/en/pilgrimages`)
    .replace(`${APP_URL}/tornar-membro`, `${APP_URL}/en/become-member`)
    .replace(`${APP_URL}/sobre-nos`, `${APP_URL}/en/about`)
    .replace(`${APP_URL}/donations`, `${APP_URL}/en/donations`)
    .replace(`${APP_URL}/loja`, `${APP_URL}/en/store`)
    .replace(`${APP_URL}/member`, `${APP_URL}/en/member`);
};

const fillMarketingVariables = (value: string, payload: MarketingTemplatePayload) => {
  const locale = payload.language === 'en' ? 'en' : 'pt';
  // When there is no real name, fall back to a respectful generic form.
  // `greeting` is the full salutation (e.g. "Olá João" / "Estimado(a) amigo(a)")
  // and is what templates use in the body. `first_name` is still used in
  // subjects but takes a graceful fallback like "amigo(a)" / "friend".
  const fallbackFirstName = locale === 'en' ? 'friend' : 'amigo(a)';
  const fallbackFullName = locale === 'en' ? 'friend of Garabandal' : 'amigo(a) de Garabandal';
  const trimmedName = (payload.name || '').trim();
  const firstName = trimmedName.split(/\s+/)[0] || fallbackFirstName;
  const greeting = trimmedName
    ? (locale === 'en' ? `Hello ${firstName}` : `Olá ${firstName}`)
    : (locale === 'en' ? `Dear ${fallbackFirstName}` : `Estimado(a) ${fallbackFirstName}`);
  const isWaitlist = payload.pilgrimageStatus === 'waitlist';
  // Nº de vagas explícito (pedido do operador): "restam apenas 5 vagas" em vez
  // de "vaga aberta" genérico. Com fallback honesto quando não há contagem.
  const vacancies = Number(payload.pilgrimageVacancies || 0);
  const vacanciesPhrase = vacancies > 0
    ? locale === 'en'
      ? (vacancies === 1 ? 'there is only 1 place left' : `there are only ${vacancies} places left`)
      : (vacancies === 1 ? 'resta apenas 1 vaga' : `restam apenas ${vacancies} vagas`)
    : (locale === 'en' ? 'there are places open' : 'há vagas abertas');
  const statusBadge = payload.pilgrimageStatus
    ? isWaitlist
      ? `<span style="display:inline-block;font-size:11px;font-weight:800;letter-spacing:0.6px;text-transform:uppercase;color:#92400e;background:#fef3c7;border:1px solid #fcd34d;border-radius:999px;padding:4px 12px;">${locale === 'en' ? '🕊️ Waiting list open' : '🕊️ Lista de espera aberta'}</span>`
      : `<span style="display:inline-block;font-size:11px;font-weight:800;letter-spacing:0.6px;text-transform:uppercase;color:#166534;background:#dcfce7;border:1px solid #86efac;border-radius:999px;padding:4px 12px;">${locale === 'en' ? '🟢 Places open' : '🟢 Vagas abertas'}</span>`
    : '';
  const variables: Record<string, string> = {
    name: trimmedName || fallbackFullName,
    first_name: trimmedName ? firstName : fallbackFirstName,
    greeting,
    pilgrimage_name: payload.pilgrimageName || 'Garabandal',
    pilgrimage_url: payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    pilgrimage_image_url: payload.pilgrimageImageUrl || BENEFIT_IMG.archive,
    pilgrimage_dates: payload.pilgrimageDates || '',
    pilgrimage_dates_row: payload.pilgrimageDates
      ? `<div style="font-size:14px;font-weight:700;color:${COLORS.primary};margin:8px 0 0;">📅 ${payload.pilgrimageDates}</div>`
      : '',
    pilgrimage_status_badge: statusBadge,
    pilgrimage_vacancies: vacancies > 0 ? String(vacancies) : '',
    vacancies_phrase: vacanciesPhrase,
    booking_resume_url: payload.bookingResumeUrl || payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    brochure_url: payload.brochureUrl || payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    member_url: payload.memberUrl || marketingUrl('/tornar-membro', payload),
    donation_url: payload.donationUrl || marketingUrl('/donations', payload),
    referral_url: payload.referralUrl || marketingUrl('/member', payload),
    referral_code: payload.referralCode || '',
    invitee_name: payload.inviteeName || (locale === 'en' ? 'your friend' : 'a pessoa convidada'),
    inviter_name: payload.inviterName || (locale === 'en' ? 'your inviter' : 'quem convidou você'),
    store_credit: payload.storeCredit || (locale === 'en' ? '€2.50' : '€2,50'),
    product_title: payload.productTitle || '',
    product_price: payload.productPrice || '',
    product_url: payload.productUrl || '',
    product_image_url: payload.productImageUrl || '',
    member_area_url: marketingUrl('/member', payload),
    candles_url: marketingUrl('/member/velas', payload),
    novenas_url: marketingUrl('/member/novenas', payload),
    live_url: marketingUrl('/member/live', payload),
    learn_url: marketingUrl('/member/academy', payload),
    referral_reward: locale === 'en' ? '€2.50' : '€2,50',
    recommendation: payload.recommendation || '',
    app_url: APP_URL,
  };

  return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => variables[key] || '');
};

export const MARKETING_EMAIL_TEMPLATES: Record<MarketingTemplateKey, MarketingTemplateDefinition> = {
  brochure_followup_1: {
    key: 'brochure_followup_1',
    name: 'Brochure follow-up',
    category: 'Peregrinações',
    goal: 'Converter pedido de roteiro em inscrição.',
    defaultSubject: '{{first_name}}, você tem o roteiro — falta só um passo',
    previewText: 'Muitos peregrinos começaram exatamente aqui. Veja datas e disponibilidade.',
    ctaLabel: 'Ver Datas e Reservar',
    ctaUrl: (payload) => payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    title: 'Uma peregrinação que pode mudar muito',
    subtitle: '{{pilgrimage_name}} — próximas datas',
    requiredVariables: ['name', 'pilgrimage_name', 'pilgrimage_url'],
    contentHtml: (locale) => brochureFollowupContent(locale),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Você pediu o roteiro de <strong>{{pilgrimage_name}}</strong> — e isso já diz muito.',
      'Muita gente que hoje viaja com a gente começou exatamente assim: com uma curiosidade simples que foi crescendo. Se você sente que é o seu momento, ver as datas é o próximo passo natural.',
    ],
  },
  pilgrimage_testimony: {
    key: 'pilgrimage_testimony',
    name: 'Testemunho da peregrinação',
    category: 'Peregrinações',
    goal: 'Aumentar confiança e desejo espiritual.',
    defaultSubject: 'Garabandal não é uma viagem — é um encontro',
    previewText: 'Veja o que peregrinos brasileiros viveram em Garabandal.',
    ctaLabel: 'Ver Peregrinações Disponíveis',
    ctaUrl: (payload) => payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    title: 'Uma experiência que transforma',
    subtitle: 'O que peregrinos viveram em Garabandal',
    requiredVariables: ['name', 'pilgrimage_url'],
    contentHtml: (locale) => pilgrimageTestimonyContent(locale),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Garabandal é um lugarejo pequeno e escondido. E, ainda assim, a mensagem de Nossa Senhora aqui tocou milhões.',
      'Quem vai, dificilmente volta o mesmo. Se você sente que esse caminho pode ser o seu, veja o programa com calma.',
    ],
  },
  pilgrimage_faq_objections: {
    key: 'pilgrimage_faq_objections',
    name: 'Dúvidas comuns da peregrinação',
    category: 'Peregrinações',
    goal: 'Remover objeções antes da inscrição.',
    defaultSubject: '"Adoraria ir, mas..." — {{first_name}}, vamos falar disso',
    previewText: 'Custo, hospedagem, viagem, pagamento parcelado — tudo respondido.',
    ctaLabel: 'Ver Detalhes e Tirar Dúvidas',
    ctaUrl: (payload) => payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    title: 'As dúvidas mais comuns antes de partir',
    subtitle: '{{pilgrimage_name}}',
    requiredVariables: ['name', 'pilgrimage_name', 'pilgrimage_url'],
    contentHtml: (locale) => pilgrimageFaqContent(locale),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      '"Adoraria ir, mas não sei se consigo..." — reconhece esse pensamento? É completamente normal querer ter tudo claro antes de decidir.',
      'As dúvidas mais frequentes — valor total, quartos individuais ou compartilhados, viagem incluída, pagamento parcelado, cancelamento, quem acompanha o grupo — têm resposta na página da peregrinação.',
      `Se algo continuar em aberto, fale com a gente pelo ${contactWa} ou por ${contactMail}. Queremos que você decida com clareza, confiança e paz. Sem pressão de nenhum tipo.`,
    ],
  },
  italy_medjugorje_launch: {
    key: 'italy_medjugorje_launch',
    name: 'Itália + Medjugorje · 1. Lançamento',
    category: 'Peregrinações',
    goal: 'Apresentar a peregrinação de Itália e Medjugorje e criar urgência com as vagas restantes.',
    defaultSubject: 'Itália e Medjugorje 2027: 75% das vagas já foram',
    previewText: '13 dias, 10 santuários, do túmulo do Padre Pio a Medjugorje. Veja o roteiro.',
    ctaLabel: 'Ver Roteiro e Garantir a Minha Vaga',
    ctaUrl: (payload) => payload.pilgrimageUrl || italyUrl(payload.language === 'en' ? 'en' : 'pt'),
    title: 'Itália e Medjugorje',
    subtitle: '5 a 17 de abril de 2027 · 13 dias · 10 santuários',
    requiredVariables: ['name', 'pilgrimage_url'],
    useHeroImage: true,
    contentHtml: (locale) => italyLaunchContent(locale),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Em abril de 2027 o Apostolado de Garabandal leva um grupo à <strong>Itália e a Medjugorje</strong> — 13 dias, 10 santuários, do túmulo do Padre Pio à colina das aparições.',
      'As vagas estão saindo rápido: 75% já foram. Veja o programa completo, dia a dia, sem compromisso.',
    ],
  },
  italy_medjugorje_story: {
    key: 'italy_medjugorje_story',
    name: 'Itália + Medjugorje · 2. Padre Pio e Garabandal',
    category: 'Peregrinações',
    goal: 'Construir desejo espiritual ligando Garabandal, Padre Pio e Medjugorje.',
    defaultSubject: 'O Padre Pio viu Garabandal antes de morrer',
    previewText: 'Existe um motivo para esta peregrinação passar pela Itália — e não é turismo.',
    ctaLabel: 'Ver a Peregrinação Completa',
    ctaUrl: (payload) => payload.pilgrimageUrl || italyUrl(payload.language === 'en' ? 'en' : 'pt'),
    title: 'Onde Garabandal e o Padre Pio se encontram',
    subtitle: 'Itália e Medjugorje · abril de 2027',
    requiredVariables: ['name', 'pilgrimage_url'],
    useHeroImage: true,
    contentHtml: (locale) => italyStoryContent(locale),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Quando Conchita foi a San Giovanni Rotondo, o <strong>Padre Pio</strong> já tinha morrido — e ainda assim entregaram a ela o véu dele e a mensagem que havia deixado.',
      'A história de Garabandal e a da Itália estão amarradas. E Medjugorje continua o mesmo chamado à oração e à conversão.',
    ],
  },
  italy_medjugorje_value: {
    key: 'italy_medjugorje_value',
    name: 'Itália + Medjugorje · 3. Preço e parcelamento',
    category: 'Peregrinações',
    goal: 'Remover a objeção financeira: preço claro, 10x sem juros, o que está incluído.',
    defaultSubject: '1.850 € com tudo incluído — e dá para parcelar em 10x',
    previewText: 'Hotel, alimentação, bebidas e transporte incluídos, em até 10x sem juros.',
    ctaLabel: 'Ver Valores e Fazer a Minha Inscrição',
    ctaUrl: (payload) => payload.pilgrimageUrl || italyUrl(payload.language === 'en' ? 'en' : 'pt'),
    title: 'Quanto custa, de verdade',
    subtitle: 'Itália e Medjugorje · 5 a 17 de abril de 2027',
    requiredVariables: ['name', 'pilgrimage_url'],
    useHeroImage: true,
    contentHtml: (locale, payload) => italyValueContent(locale, payload),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'A pergunta que mais recebemos é sempre a mesma: "quanto custa, de verdade?"',
      'São 1.850 € no terrestre, com hotel, alimentação completa, bebidas e transporte incluídos — em até 10x sem juros.',
    ],
  },
  italy_medjugorje_last_call: {
    key: 'italy_medjugorje_last_call',
    name: 'Itália + Medjugorje · 4. Última chamada',
    category: 'Peregrinações',
    goal: 'Fechar as últimas vagas antes do prazo de inscrição.',
    defaultSubject: 'Últimas vagas para Itália e Medjugorje',
    previewText: 'As inscrições fecham a 30 de novembro. Depois disso o grupo é fechado.',
    ctaLabel: 'Garantir a Última Vaga',
    ctaUrl: (payload) => payload.pilgrimageUrl || italyUrl(payload.language === 'en' ? 'en' : 'pt'),
    title: 'Últimas vagas',
    subtitle: 'Itália e Medjugorje · inscrições até 30 de novembro de 2026',
    requiredVariables: ['name', 'pilgrimage_url'],
    useHeroImage: true,
    contentHtml: (locale, payload) => italyLastCallContent(locale, payload),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Este é o último email que enviamos sobre a <strong>Itália e Medjugorje 2027</strong>. Se o momento não for o certo, ficamos por aqui com respeito.',
      'As inscrições fecham a 30 de novembro de 2026 — depois disso o grupo é fechado junto da agência e não é possível acrescentar mais ninguém.',
    ],
  },
  abandoned_registration_1: {
    key: 'abandoned_registration_1',
    name: 'Recuperação de inscrição',
    category: 'Peregrinações',
    goal: 'Recuperar inscrição iniciada e não concluída.',
    defaultSubject: '{{first_name}}, sua vaga em {{pilgrimage_name}} está quase garantida',
    previewText: 'As vagas são limitadas — você ainda pode retomar de onde parou.',
    ctaLabel: 'Retomar e Confirmar a Minha Vaga',
    ctaUrl: (payload) => payload.bookingResumeUrl || payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    title: 'Sua inscrição ficou quase pronta',
    subtitle: '{{pilgrimage_name}}',
    requiredVariables: ['name', 'booking_resume_url'],
    contentHtml: (locale) => pilgrimageRecoveryContent(locale, 'start'),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Você iniciou a inscrição para <strong>{{pilgrimage_name}}</strong>, mas o processo ficou por concluir. As vagas são limitadas — e a sua pode ainda ser garantida.',
      `Se foi uma simples interrupção, pode retomar exatamente onde ficou com um clique. Se encontrou alguma dificuldade com o pagamento, os dados ou a disponibilidade, fale com a gente pelo ${contactWa} ou por ${contactMail} e ajudamos a resolver.`,
    ],
  },
  abandoned_registration_faq: {
    key: 'abandoned_registration_faq',
    name: 'Recuperação com esclarecimento',
    category: 'Peregrinações',
    goal: 'Ajudar leads bloqueados por dúvidas.',
    defaultSubject: '{{first_name}}, ficou com alguma dúvida na inscrição?',
    previewText: 'Pagamento, quartos, viagem, documentos — estamos aqui para ajudar.',
    ctaLabel: 'Retomar a Inscrição',
    ctaUrl: (payload) => payload.bookingResumeUrl || payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    title: 'Pode ser mais simples do que parece',
    subtitle: 'Estamos aqui para ajudar',
    requiredVariables: ['name', 'booking_resume_url'],
    contentHtml: (locale) => pilgrimageRecoveryContent(locale, 'faq'),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Quando uma inscrição fica a meio, quase sempre é por uma dúvida concreta: como pagar em prestações, quarto individual ou compartilhado, viajar sozinho ou acompanhado, ou simplesmente dados em falta.',
      `Você não precisa resolver tudo sozinho. Pode falar com a gente pelo ${contactWa} ou por ${contactMail} com a sua dúvida — temos toda a disponibilidade para ajudar. Se já está pronto para continuar, o botão abaixo leva você de volta ao processo em segundos.`,
    ],
  },
  abandoned_registration_final: {
    key: 'abandoned_registration_final',
    name: 'Último lembrete de inscrição',
    category: 'Peregrinações',
    goal: 'Criar urgência moderada antes de encerrar follow-up.',
    defaultSubject: '{{first_name}}, um último convite sobre sua inscrição',
    previewText: 'Se esse caminho ainda faz sentido para você, este é o momento.',
    ctaLabel: 'Concluir a Minha Inscrição',
    ctaUrl: (payload) => payload.bookingResumeUrl || payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    title: 'Um último convite, com todo o respeito',
    subtitle: '{{pilgrimage_name}}',
    requiredVariables: ['name', 'booking_resume_url'],
    contentHtml: (locale) => pilgrimageRecoveryContent(locale, 'final'),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Este é o último email que enviamos sobre sua inscrição em <strong>{{pilgrimage_name}}</strong>. Se este não for o momento certo, ficamos por aqui com todo o respeito pela sua escolha — e estaremos sempre disponíveis quando quiser.',
      'Mas se este caminho ainda faz sentido para você — e muitas vezes é quando menos esperamos que estas portas se abrem — pode concluir a inscrição com um clique. As vagas são limitadas e a equipe fica no aguardo, com alegria, a sua confirmação.',
    ],
  },
  waitlist_welcome: {
    key: 'waitlist_welcome',
    name: 'Boas-vindas à lista de espera',
    category: 'Peregrinações',
    goal: 'Confirmar interesse e manter contacto quente.',
    defaultSubject: '{{first_name}}, você está na lista — avisamos assim que abrir vaga',
    previewText: 'Você será um dos primeiros a saber quando abrir data ou vaga.',
    ctaLabel: 'Ver Peregrinações Disponíveis',
    ctaUrl: (payload) => marketingUrl('/peregrinacoes', payload),
    title: 'Está na lista — avisamos quando houver vagas',
    subtitle: 'Apostolado de Garabandal',
    requiredVariables: ['name'],
    contentHtml: (locale) => waitlistContent(locale, 'welcome'),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Confirmamos que o seu interesse ficou registrado. Quando existirem novas datas, vagas ou peregrinações relacionadas, entraremos diretamente em contato com você — antes de anunciarmos ao público em geral.',
      `Entretanto, pode ver as peregrinações que estão abertas. E se tiver questões antes de qualquer vaga abrir, fale com a gente pelo ${contactWa} ou por ${contactMail}.`,
    ],
  },
  waitlist_open_spot: {
    key: 'waitlist_open_spot',
    name: 'Vaga disponível',
    category: 'Peregrinações',
    goal: 'Converter lista de espera quando há disponibilidade — sempre com o número real de vagas.',
    defaultSubject: '{{first_name}}, {{vacancies_phrase}} na peregrinação a Garabandal 🕊️',
    previewText: 'Boa notícia: {{vacancies_phrase}} em {{pilgrimage_name}}.',
    ctaLabel: 'Garantir a Minha Vaga',
    ctaUrl: (payload) => payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    title: 'Há vagas na sua peregrinação',
    subtitle: '{{pilgrimage_name}}',
    requiredVariables: ['name', 'pilgrimage_url'],
    contentHtml: (locale) => waitlistContent(locale, 'open_spot'),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Estamos entrando em contato com você porque entrou na lista de espera — e neste momento {{vacancies_phrase}} na peregrinação <strong>{{pilgrimage_name}}</strong>.',
      'As vagas preenchem rapidamente. Se esta data faz sentido para você, recomendamos ver os detalhes agora e avançar com a inscrição. Ficamos à sua disposição para qualquer ajuda necessária.',
    ],
  },
  waitlist_more_spots: {
    key: 'waitlist_more_spots',
    name: 'Lista de espera — possibilidade de mais lugares (urgente)',
    category: 'Peregrinações',
    goal: 'Ativar a lista de espera com urgência honesta quando pode haver abertura de mais lugares.',
    defaultSubject: '{{first_name}}, podem abrir mais lugares em novembro 🕊️',
    previewText: 'A procura foi enorme. O Apostolado pode abrir mais lugares — mas só alguns serão escolhidos.',
    ctaLabel: 'Falar já no WhatsApp',
    ctaUrl: (payload) => {
      const isEn = payload.language === 'en';
      const name = payload.pilgrimageName || (isEn ? 'the November pilgrimage to Garabandal' : 'a peregrinação de novembro a Garabandal');
      const msg = isEn
        ? `Hello 🙏 I'm on the waiting list for ${name} and I'm really interested in going. I understand only a limited number will be selected — I'd love to be considered. Is there a possibility?`
        : `Olá 🙏 Estou na lista de espera da ${name} e estou muito interessado(a) em ir. Sei que só um número limitado será selecionado — gostaria muito de ser considerado(a). Há possibilidade?`;
      return `${WHATSAPP_CONTACT_URL}?text=${encodeURIComponent(msg)}`;
    },
    title: 'Pode haver mais lugares — e você está na frente',
    subtitle: '{{pilgrimage_name}}',
    requiredVariables: ['name'],
    contentHtml: (locale) => waitlistContent(locale, 'more_spots'),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'A procura pela <strong>{{pilgrimage_name}}</strong> foi tão grande que as vagas esgotaram. Justamente por isso, o Apostolado está avaliando a possibilidade de disponibilizar mais alguns lugares — e só um número limitado de pessoas poderá ser escolhido.',
      `Você está na lista de espera, por isso tem prioridade para ser considerado. Se sente este chamado, fale conosco com urgência pelo ${contactWa}: quem mostra interesse primeiro entra na frente da seleção.`,
    ],
  },
  waitlist_garabandal_story: {
    key: 'waitlist_garabandal_story',
    name: 'Lista de espera — conhecer Garabandal',
    category: 'Vida Espiritual',
    goal: 'Nutrir a lista de espera com valor espiritual antes de qualquer pedido comercial.',
    defaultSubject: '{{first_name}}, enquanto a sua vaga não abre, conheça melhor Garabandal',
    previewText: 'Uma breve história para viver este tempo de espera com mais sentido.',
    ctaLabel: 'Conhecer a História de Garabandal',
    ctaUrl: (payload) => marketingUrl('/historia', payload),
    title: 'Enquanto espera, aproxime-se da mensagem',
    subtitle: 'Garabandal começa no coração',
    requiredVariables: ['name'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Você entrou na lista de espera porque, de alguma forma, Garabandal já tocou o seu coração. Enquanto aguardamos uma vaga real, queremos que este tempo não seja vazio: pode ser um tempo de preparação, oração e descoberta.',
      'Garabandal não é apenas um lugar no mapa. É uma mensagem simples e exigente: conversão, oração, Eucaristia e confiança em Nossa Senhora. Muitos peregrinos chegam antes pelo desejo, pela leitura, por uma pergunta interior — e só depois pelo caminho físico até a aldeia.',
      `Por isso, hoje deixamos um convite simples: conheça melhor a história das aparições e reze com calma por este possível chamado. Se quiser falar conosco, estamos disponíveis pelo ${contactWa} ou por ${contactMail}.`,
    ],
  },
  waitlist_book_recommendation: {
    key: 'waitlist_book_recommendation',
    name: 'Lista de espera — livros para preparar',
    category: 'Loja',
    goal: 'Recomendar livros oficiais a contactos em lista de espera, sem pressão de inscrição.',
    defaultSubject: '{{first_name}}, um livro para viver Garabandal enquanto espera',
    previewText: 'Leituras oficiais para conhecer melhor a mensagem antes da peregrinação.',
    ctaLabel: 'Ver Livros na Loja Oficial',
    ctaUrl: (payload) => marketingUrl('/loja', payload),
    title: 'Prepare o coração com uma boa leitura',
    subtitle: 'Livros oficiais de Garabandal',
    requiredVariables: ['name'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Enquanto espera por uma vaga, há uma forma muito concreta de se aproximar de Garabandal: ler, rezar e conhecer melhor a mensagem de Nossa Senhora.',
      'Selecionamos alguns livros e guias da Loja Oficial que ajudam a entender o contexto, os testemunhos e o chamado espiritual de Garabandal. Não é uma compra por impulso; é uma preparação para viver este caminho com mais profundidade.',
      'Se algum destes títulos fizer sentido para você, pode ver os detalhes com calma. E se tiver dúvidas sobre qual escolher, fale conosco pelo WhatsApp.',
    ],
  },
  waitlist_mission_support: {
    key: 'waitlist_mission_support',
    name: 'Lista de espera — apoiar a missão',
    category: 'Doações',
    goal: 'Apresentar a missão e a Casa de Acolhimento a contactos em lista de espera.',
    defaultSubject: '{{first_name}}, a sua espera também pode ajudar esta missão',
    previewText: 'Enquanto aguardamos uma vaga, veja como a missão em Garabandal continua todos os dias.',
    ctaLabel: 'Apoiar a Missão',
    ctaUrl: (payload) => payload.donationUrl || marketingUrl('/donations', payload),
    title: 'A missão continua antes da viagem',
    subtitle: 'Casa de Acolhimento e Apostolado',
    requiredVariables: ['name', 'donation_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Nem todos conseguem ir a Garabandal no momento em que desejam. Mas a missão continua todos os dias: acolher peregrinos, preparar grupos, manter conteúdos de formação, rezar por intenções e tornar a mensagem de Nossa Senhora mais conhecida.',
      'A Casa de Acolhimento nasce precisamente para isso: ser um lugar de apoio, oração e presença concreta em Garabandal. Cada ajuda, grande ou pequena, contribui para que mais pessoas encontrem este caminho com serenidade.',
      'Se este trabalho fala ao seu coração, pode apoiar a missão de forma simples e segura. E, se este não for o momento, fique em paz: continuamos rezando por você e avisaremos quando houver vaga.',
    ],
  },
  waitlist_member_invitation: {
    key: 'waitlist_member_invitation',
    name: 'Lista de espera — convite para membro',
    category: 'Membros',
    goal: 'Convidar contactos em lista de espera a pertencer ao Apostolado antes da peregrinação.',
    defaultSubject: '{{first_name}}, mesmo antes de peregrinar, você pode fazer parte',
    previewText: 'Ser membro é caminhar com o Apostolado, rezar conosco e sustentar esta missão.',
    ctaLabel: 'Ver Como Ser Membro',
    ctaUrl: (payload) => payload.memberUrl || marketingUrl('/tornar-membro', payload),
    title: 'Você não precisa esperar para fazer parte',
    subtitle: 'Um convite do Apostolado',
    requiredVariables: ['name', 'member_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Estar na lista de espera já mostra que existe em você um desejo de se aproximar de Garabandal. Mas pertencer ao Apostolado não começa apenas quando a viagem acontece. Pode começar agora, pela oração, pela formação e pelo apoio contínuo à missão.',
      'Como membro, você passa a caminhar conosco de forma mais próxima: recebe acesso a conteúdos exclusivos, novenas, velas pelas suas intenções, transmissão da Santa Missa e a alegria de sustentar concretamente este trabalho.',
      'A anuidade é simples e acessível. Veja com calma como funciona. Se fizer sentido para você, será uma alegria acolhê-lo como membro desta família espiritual.',
    ],
  },
  payment_support: {
    key: 'payment_support',
    name: 'Apoio ao pagamento',
    category: 'Peregrinações',
    goal: 'Ajudar reservas com pagamentos pendentes.',
    defaultSubject: '{{first_name}}, vamos concluir seu pagamento juntos',
    previewText: 'Um pagamento pendente — mas é simples de resolver. A gente ajuda.',
    ctaLabel: 'Gerenciar Minha Inscrição',
    ctaUrl: (payload) => payload.bookingResumeUrl || payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    title: 'Falta pouco para garantir sua vaga',
    subtitle: '{{pilgrimage_name}}',
    requiredVariables: ['name', 'booking_resume_url'],
    contentHtml: (locale) => paymentSupportContent(locale),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Estamos acompanhando sua inscrição e notamos que um pagamento pode estar pendente. Não queremos que você perca a vaga por um detalhe.',
      'Você gerencia tudo pela sua inscrição em um clique. Já pagou por transferência? É só enviar o comprovante e nossa equipe cuida do resto.',
    ],
  },
  donation_thank_you: {
    key: 'donation_thank_you',
    name: 'Obrigado pela doação',
    category: 'Doações',
    // Copy intemporal: o passo do funil pode chegar meses depois da doação
    // (doadores antigos também entram) — nunca dizer "a sua doação chegou agora".
    goal: 'Agradecer com verdade (a qualquer distância da doação) e abrir relação futura.',
    defaultSubject: '{{first_name}}, sua doação fez — e ainda faz — diferença real',
    previewText: 'Obrigado. Veja o que seu apoio torna concretamente possível.',
    ctaLabel: 'Conhecer a Missão',
    ctaUrl: (payload) => marketingUrl('/sobre-nos', payload),
    title: 'Seu apoio faz parte desta missão',
    subtitle: 'Apostolado de Garabandal',
    requiredVariables: ['name'],
    contentHtml: (locale) => donationContent(locale, 'thank_you'),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Em algum momento você apoiou o Apostolado com uma doação — e queremos que saiba que não foi apenas um número numa conta. É o que torna possível manter este apostolado ativo: peregrinações a Garabandal, conteúdos espirituais, acolhimento e a presença viva da mensagem de Nossa Senhora na língua portuguesa.',
      'Rezamos para que Nossa Senhora de Garabandal interceda por você e pela sua família. Seu gesto é um ato de fé concreto — e faz parte desta missão.',
    ],
  },
  donation_thank_you_story: {
    key: 'donation_thank_you_story',
    name: 'Impacto da doação',
    category: 'Doações',
    goal: 'Mostrar impacto e preparar próximo pedido.',
    defaultSubject: 'A Casa de Acolhimento precisa continuar crescendo',
    previewText: 'Sua ajuda contribui para reerguer uma casa a serviço dos peregrinos.',
    ctaLabel: 'Apoiar a Casa de Acolhimento',
    ctaUrl: (payload) => payload.donationUrl || marketingUrl('/donations', payload),
    title: 'Uma casa para acolher peregrinos',
    subtitle: 'Presente e futuro em Garabandal',
    requiredVariables: ['name', 'donation_url'],
    contentHtml: (locale) => donationContent(locale, 'story'),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Seu apoio ajuda a sustentar o que muitas vezes não se vê: a preparação de peregrinações, a criação de conteúdo espiritual, o acompanhamento de novos peregrinos e a manutenção desta presença digital a serviço da mensagem de Garabandal.',
      'Se desejar continuar apoiando esta missão — sabendo que cada contribuição tem um impacto real e concreto — deixamos abaixo uma forma simples e segura de fazer isso. Deus lhe pague.',
    ],
  },
  donor_to_member: {
    key: 'donor_to_member',
    name: 'Doador para membro',
    category: 'Membros',
    goal: 'Converter doador em membro.',
    defaultSubject: '{{first_name}}, dê o próximo passo nesta missão',
    previewText: 'Apoiar foi um gesto; tornar-se membro é pertencer de forma contínua.',
    ctaLabel: 'Ver Benefícios de Membro',
    ctaUrl: (payload) => payload.memberUrl || marketingUrl('/tornar-membro', payload),
    title: 'Faça parte da missão por dentro',
    subtitle: 'Convite especial para membro',
    requiredVariables: ['name', 'member_url'],
    contentHtml: (locale) => memberInvitationContent(locale, 'donor'),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Você já demonstrou generosidade com o Apostolado — e isso significa muito para toda a nossa comunidade. Queremos apresentar a você um caminho ainda mais próximo: tornar-se membro.',
      'Como membro, sua ligação com a missão se torna estável e regular, com acesso a conteúdos exclusivos e ao acompanhamento espiritual do Apostolado. É uma forma concreta de dizer "estou aqui" — não uma vez, mas continuamente, ao lado de todos os que compartilham este amor por Garabandal.',
    ],
  },
  member_invitation: {
    key: 'member_invitation',
    name: 'Convite para membro',
    category: 'Membros',
    goal: 'Convidar contacto quente a aderir.',
    defaultSubject: '{{first_name}}, tem um convite especial do Apostolado',
    previewText: 'Uma forma de fazer parte desta missão de modo contínuo.',
    ctaLabel: 'Ver Como Funciona',
    ctaUrl: (payload) => payload.memberUrl || marketingUrl('/tornar-membro', payload),
    title: 'Um convite para fazer parte',
    subtitle: 'Apostolado de Garabandal',
    requiredVariables: ['name', 'member_url'],
    contentHtml: (locale) => memberInvitationContent(locale, 'general'),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Queremos convidar você a tornar-se membro do Apostolado — não apenas apoiar pontualmente, mas fazer parte de forma contínua desta missão ao serviço da mensagem de Garabandal.',
      `Como membro, recebe o diploma digital, acesso a conteúdos exclusivos e a satisfação de saber que a sua contribuição sustenta concretamente este trabalho. Pode ver como funciona com calma. Se tiver dúvidas, fale com a gente pelo ${contactWa} ou por ${contactMail}.`,
    ],
  },
  store_book_recommendation: {
    key: 'store_book_recommendation',
    name: 'Livro recomendado',
    category: 'Loja',
    goal: 'Recomendar livro ou produto relevante sem misturar com convite de membro.',
    defaultSubject: '{{first_name}}, livros oficiais para aprofundar Garabandal',
    previewText: 'Produtos ativos da Loja oficial para ler, rezar e compartilhar em família.',
    ctaLabel: 'Ver Loja Oficial',
    ctaUrl: (payload) => payload.productUrl || marketingUrl('/loja', payload),
    title: 'Livros oficiais de Garabandal',
    subtitle: 'Recomendação da Loja',
    requiredVariables: ['name', 'product_title', 'product_url'],
    contentHtml: (locale) => storeBookRecommendationContent(locale),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Se deseja continuar a conhecer a mensagem de Garabandal com calma, um bom livro pode ajudar a rezar, compreender o contexto e voltar ao essencial sem pressa.',
      'Escolhemos esta recomendação para pessoas que já demonstraram interesse por Garabandal e talvez procurem um próximo passo concreto em casa.',
    ],
  },
  store_book_flash_sale: {
    key: 'store_book_flash_sale',
    name: 'Campanha livros — 15% só hoje',
    category: 'Loja',
    goal: 'Criar urgência para compra de livros na campanha especial de um dia.',
    defaultSubject: '{{first_name}}, só hoje: 15% nos livros de Garabandal',
    previewText: 'A campanha especial termina à meia-noite no Brasil. Depois os preços voltam ao normal.',
    ctaLabel: 'Comprar com 15% Agora',
    ctaUrl: (payload) => payload.productUrl || marketingUrl('/loja', payload),
    title: 'Só hoje: 15% nos livros oficiais',
    subtitle: 'Campanha especial no dia da primeira aparição de Nossa Senhora em Garabandal',
    requiredVariables: ['name', 'products'],
    contentHtml: (locale) => storeBookFlashSaleContent(locale),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Hoje é o dia da primeira aparição de Nossa Senhora em Garabandal. Por isso, todos os livros da Loja oficial estão com 15% de desconto só até a meia-noite no Brasil.',
      'Escolha agora o livro que deseja ler, oferecer ou guardar em casa para aprofundar a mensagem.',
    ],
  },
  lead_to_member_welcome: {
    key: 'lead_to_member_welcome',
    name: 'Convite a membro — boas-vindas',
    category: 'Membros',
    goal: 'Converter leads, peregrinos antigos e doadores em membros.',
    defaultSubject: '{{first_name}}, há um lugar guardado para você nesta missão',
    previewText: 'Fazer parte do Apostolado de Garabandal, de forma contínua.',
    ctaLabel: 'Tornar-me Membro',
    ctaUrl: (payload) => payload.memberUrl || marketingUrl('/tornar-membro', payload),
    title: 'Há um lugar guardado para você',
    subtitle: 'Apostolado de Garabandal',
    requiredVariables: ['name', 'member_url'],
    contentHtml: (locale) => membershipWelcomeContent(locale),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Em algum momento o seu coração aproximou-se de Garabandal — talvez por uma peregrinação, um pedido de oração, um donativo, ou simplesmente pela mensagem de Nossa Senhora. Acreditamos que não foi por acaso. Há caminhos que se abrem quando menos esperamos.',
      'Hoje queremos convidar você a dar um passo a mais: <strong>tornar-se membro do Apostolado de Garabandal</strong>. Não é apenas apoiar pontualmente — é fazer parte, de forma contínua, de uma família que reza e trabalha ao serviço desta mensagem.',
      '<strong>Como membro, você passa a ter:</strong><br>🕊️&nbsp; A Santa Missa <strong>ao vivo</strong> desde Garabandal<br>📿&nbsp; As novenas e as <strong>velas acesas pelas suas intenções</strong><br>📖&nbsp; Conteúdos exclusivos e a Academia espiritual<br>🎓&nbsp; Seu diploma digital de membro<br>❤️&nbsp; A certeza de que sua contribuição sustenta esta missão',
      'A anuidade é de apenas <strong>25€/ano</strong> — e sustenta concretamente esta missão viva.',
      '<em>"É preciso rezar muito, rezar com fé e fervor."</em> — Mensagem de Garabandal',
      `Se tiver qualquer dúvida, fale com a gente pelo ${contactWa} ou por ${contactMail}. Estamos aqui — e rezamos por você.`,
    ],
  },
  lead_to_member_followup: {
    key: 'lead_to_member_followup',
    name: 'Convite a membro — follow-up (intenção)',
    category: 'Membros',
    goal: 'Recuperar leads que não aderiram, com apelo à intenção de oração.',
    defaultSubject: '{{first_name}}, pense numa intenção que gostaria de ver rezada',
    previewText: 'Como membro, suas intenções são levadas às velas e novenas de Garabandal.',
    ctaLabel: 'Fazer Parte Agora',
    ctaUrl: (payload) => payload.memberUrl || marketingUrl('/tornar-membro', payload),
    title: 'Pense numa intenção',
    subtitle: 'Um convite que fica de pé',
    requiredVariables: ['name', 'member_url'],
    contentHtml: (locale) => leadToMemberFollowupContent(locale),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Há poucos dias convidamos você a fazer parte do Apostolado. Talvez o momento não tenha sido o certo — a gente entende.',
      'Mas deixe eu pedir só isto: <strong>pense numa intenção</strong> que você traz no coração — um familiar doente, uma decisão difícil, uma graça que espera. Como membro, essa intenção passa a ser levada às <strong>velas acesas em Garabandal</strong> e às <strong>novenas</strong> da nossa comunidade. Você não caminha sozinho.',
      'Seja qual for a sua decisão, você fica na nossa oração.',
    ],
  },
  membership_renewal: {
    key: 'membership_renewal',
    name: 'Renovação de membro',
    category: 'Membros',
    // Segmento 'expired-members' = quota JÁ expirada. A copy fala de renovação
    // pós-vencimento (sem urgência falsa) — nunca de "faltam poucos dias".
    goal: 'Convidar membros com anuidade já expirada a renovar.',
    defaultSubject: '{{first_name}}, seu lugar nesta missão continua guardado',
    previewText: 'Sua anuidade venceu, mas nada se perdeu — renovar leva menos de um minuto.',
    ctaLabel: 'Renovar Minha Anuidade',
    ctaUrl: (payload) => payload.memberUrl || marketingUrl('/member/quota', payload),
    title: 'Seu lugar continua guardado',
    subtitle: 'Área de membro',
    requiredVariables: ['name', 'member_url'],
    contentHtml: (locale) => membershipRenewalContent(locale),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Sua anuidade de membro venceu — e queremos que saiba que nada se perdeu: seu lugar nesta missão continua guardado, e você continua presente nas nossas orações.',
      'Quando desejar voltar, renovar leva menos de um minuto. A Missa ao vivo de Garabandal, as novenas, as velas pelas suas intenções e todo o conteúdo espiritual da sua área voltam a ficar ativos no mesmo instante.',
      'E se este não for o momento certo, fique em paz: você continua fazendo parte desta família espiritual, e estaremos aqui quando for a hora.',
    ],
  },
  member_referral_activation: {
    key: 'member_referral_activation',
    name: 'Ativar indicação de membro',
    category: 'Indicações',
    goal: 'Estimular o membro a convidar uma pessoa concreta que tem em mente.',
    defaultSubject: '{{first_name}}, tem alguém que veio à sua mente agora?',
    previewText: 'Pense numa pessoa que precisa de paz e fé. Seu convite pode chegar até ela.',
    ctaLabel: 'Convidar essa Pessoa',
    ctaUrl: (payload) => payload.referralUrl || marketingUrl('/member', payload),
    title: 'Pense numa pessoa',
    subtitle: 'Um convite pessoal',
    requiredVariables: ['name', 'referral_url'],
    contentHtml: (locale) => referralContent(locale, 'member'),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Pare um instante e pense numa pessoa — um familiar, um amigo, alguém que busca paz ou atravessa um momento difícil. Muitas vezes já sabemos exatamente quem é.',
      'Seu convite pode ser justamente o que falta para essa pessoa se aproximar de Nossa Senhora de Garabandal. E há um sinal de gratidão: quando ela se torna membro pelo seu convite, <strong>vocês dois recebem {{referral_reward}} de saldo</strong> na Loja Online.',
      'Seu código de convite já está pronto na sua área de membro. Convide hoje essa pessoa em quem você pensou — pode mudar a vida dela.',
    ],
  },
  referral_activation: {
    key: 'referral_activation',
    name: 'Ativar convites',
    category: 'Indicações',
    goal: 'Estimular indicação através de convite.',
    defaultSubject: '{{first_name}}, convide um amigo e vocês dois recebem {{referral_reward}}',
    previewText: 'Uma indicação simples pode aproximar alguém da fé — e gerar saldo para os dois.',
    ctaLabel: 'Abrir e Compartilhar o Convite',
    ctaUrl: (payload) => payload.referralUrl || marketingUrl('/member', payload),
    title: 'Um convite simples — com um presente para os dois',
    subtitle: 'Levar Garabandal a mais pessoas',
    requiredVariables: ['name', 'referral_url'],
    contentHtml: (locale) => referralContent(locale, 'general'),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Se você conhece alguém que busca algo mais profundo — paz, fé, esperança, um caminho espiritual — a mensagem de Garabandal pode ser exatamente o que essa pessoa precisa encontrar.',
      'Quando essa pessoa se torna membro pelo seu convite, <strong>vocês dois recebem {{referral_reward}} de saldo</strong> na Loja Online. O saldo entra só depois da adesão confirmada; é a nossa forma de agradecer a quem ajuda a missão a crescer.',
      'Não precisa explicar tudo — basta compartilhar seu link de convite e deixar a missão falar por si.',
    ],
  },
  share_mission: {
    key: 'share_mission',
    name: 'Compartilhar missão',
    category: 'Indicações',
    goal: 'Reforçar a indicação depois do primeiro convite.',
    defaultSubject: '{{first_name}}, seu convite está ativo para levar a missão adiante',
    previewText: 'Se alguém se tornar membro pelo seu convite, vocês dois recebem {{referral_reward}} de saldo.',
    ctaLabel: 'Compartilhar Novamente',
    ctaUrl: (payload) => payload.referralUrl || marketingUrl('/member', payload),
    title: 'Seu convite está pronto para compartilhar',
    subtitle: 'Um convite simples, sem pressão',
    requiredVariables: ['name', 'referral_url'],
    contentHtml: (locale) => referralContent(locale, 'share'),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Seu convite pessoal está ativo na área de membro. Se houver alguém a quem a mensagem de Garabandal possa fazer bem, você pode compartilhar esse link com calma, no momento certo.',
      'Quando alguém se torna membro pelo seu convite, <strong>vocês dois recebem {{referral_reward}} de saldo</strong> na Loja Online. O saldo entra depois da adesão confirmada, e pode ser usado em livros, artigos ou donativos.',
      'Não precisa explicar tudo nem pressionar ninguém. Uma indicação pessoal, feita com fé e respeito, já é um ato concreto de apostolado.',
    ],
  },
  referral_reward_inviter: {
    key: 'referral_reward_inviter',
    name: 'Convite convertido — quem convidou',
    category: 'Indicações',
    goal: 'Avisar quem convidou que uma pessoa aderiu, explicar o saldo e incentivar novo compartilhamento.',
    defaultSubject: '{{first_name}}, {{invitee_name}} aderiu pelo seu convite',
    previewText: '{{referral_reward}} foram adicionados ao seu saldo da Loja.',
    ctaLabel: 'Ver Saldo e Compartilhar de Novo',
    ctaUrl: (payload) => payload.referralUrl || marketingUrl('/member', payload),
    title: 'Seu convite deu fruto',
    subtitle: 'Saldo confirmado na Loja',
    requiredVariables: ['name', 'invitee_name', 'referral_url'],
    contentHtml: (locale) => referralRewardContent(locale, 'inviter'),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      '{{invitee_name}} se tornou membro pelo seu convite. Obrigado por ajudar a missão a crescer.',
      'Como agradecimento, {{referral_reward}} foram adicionados ao seu saldo da Loja. {{invitee_name}} também recebeu o mesmo saldo como presente de boas-vindas.',
      'Seu link continua ativo. Se houver outra pessoa a quem Garabandal possa fazer bem, compartilhe quando sentir que é o momento certo.',
    ],
  },
  referral_reward_invitee: {
    key: 'referral_reward_invitee',
    name: 'Convite aceite — novo membro',
    category: 'Indicações',
    goal: 'Explicar ao novo membro o saldo recebido pelo convite e abrir o próximo ciclo de compartilhamento.',
    defaultSubject: '{{first_name}}, seu saldo de boas-vindas está disponível',
    previewText: 'Você entrou pelo convite de {{inviter_name}} e recebeu {{referral_reward}} de saldo.',
    ctaLabel: 'Ver Meu Saldo',
    ctaUrl: (payload) => payload.referralUrl || marketingUrl('/member', payload),
    title: 'Seu saldo de boas-vindas está pronto',
    subtitle: 'Bem-vindo ao Apostolado',
    requiredVariables: ['name', 'inviter_name', 'referral_url'],
    contentHtml: (locale) => referralRewardContent(locale, 'invitee'),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Você se tornou membro pelo convite de {{inviter_name}}. Como gesto de boas-vindas, {{referral_reward}} foram adicionados ao seu saldo da Loja.',
      'Você pode usar esse saldo em livros oficiais, artigos ou donativos. Seu próprio link de convite também já está pronto na área de membro.',
      'Quando fizer sentido, compartilhe com alguém que possa precisar de paz, fé ou esperança.',
    ],
  },
  member_welcome: {
    key: 'member_welcome',
    name: 'Acolhimento de novo membro',
    category: 'Vida Espiritual',
    goal: 'Acolher o novo membro e apresentar a área como lugar de oração.',
    defaultSubject: '{{first_name}}, seja bem-vindo a esta missão de oração',
    previewText: 'Seu lugar de oração e recolhimento já está pronto.',
    ctaLabel: 'Entrar na Minha Área',
    ctaUrl: (payload) => marketingUrl('/member', payload),
    title: 'Bem-vindo ao Apostolado de Garabandal',
    subtitle: 'Sua área de membro está pronta',
    requiredVariables: ['name', 'member_area_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'É com alegria que acolhemos você no Apostolado de Garabandal. A partir de hoje, você faz parte de uma comunidade unida pela oração e pela mensagem de Nossa Senhora.',
      'Na sua área de membro você encontra um lugar de recolhimento: para rezar, entregar suas intenções e aprofundar sua fé — incluindo a Santa Missa transmitida ao vivo da igreja de Garabandal.',
      `Que Nossa Senhora de Garabandal acompanhe você neste caminho. Estamos aqui para o que precisar — fale com a gente pelo ${contactWa} ou por ${contactMail}.`,
    ],
  },
  member_pray_intentions: {
    key: 'member_pray_intentions',
    name: 'Entregar intenções',
    category: 'Vida Espiritual',
    goal: 'Convidar o membro a rezar e entregar as suas intenções.',
    defaultSubject: 'Entregue suas intenções a Nossa Senhora',
    previewText: 'Acenda uma vela e reze pelas suas intenções, na sua área.',
    ctaLabel: 'Acender uma Vela e Rezar',
    ctaUrl: (payload) => marketingUrl('/member/velas', payload),
    title: 'Suas intenções nas mãos de Nossa Senhora',
    subtitle: 'Um momento de oração',
    requiredVariables: ['name', 'candles_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Todos carregamos intenções no coração — por quem amamos, por uma graça, por uma cura. Em Garabandal, Nossa Senhora nos pediu que rezássemos com confiança.',
      'Na sua área de membro você pode <strong>acender uma vela</strong> que fica acesa pelas suas intenções, e rezar com as orações que encontra ali. É um gesto simples, mas cheio de fé.',
      'Reserve um momento de silêncio e entregue a Nossa Senhora aquilo que você traz no coração.',
    ],
  },
  member_novena_invite: {
    key: 'member_novena_invite',
    name: 'Convite a novena',
    category: 'Vida Espiritual',
    goal: 'Convidar o membro a começar uma novena.',
    defaultSubject: '{{first_name}}, reze uma novena pelas suas intenções',
    previewText: 'Nove dias de oração para confiar suas intenções a Nossa Senhora.',
    ctaLabel: 'Começar uma Novena',
    ctaUrl: (payload) => marketingUrl('/member/novenas', payload),
    title: 'Nove dias de oração perseverante',
    subtitle: 'Comece uma novena',
    requiredVariables: ['name', 'novenas_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Uma novena são nove dias de oração perseverante — um caminho simples e poderoso para confiar suas intenções a Nossa Senhora de Garabandal.',
      'Você pode começar hoje, no seu ritmo, a partir da sua área de membro. Cada dia, uma oração; cada dia, um passo mais perto.',
      'Deixe que estes nove dias sejam um tempo de paz e de entrega. Nossa Senhora sempre escuta.',
    ],
  },
  newsletter_monthly: {
    key: 'newsletter_monthly',
    name: 'Newsletter mensal de artigos',
    category: 'Vida Espiritual',
    goal: 'Dar conteúdo real do site à lista da newsletter — artigos, testemunhos e vida da missão, sem pedido comercial como foco.',
    defaultSubject: '{{first_name}}, as leituras deste mês do Apostolado',
    previewText: 'Artigos, testemunhos e a vida da missão de Garabandal — para ler com calma.',
    ctaLabel: 'Visitar o Site do Apostolado',
    ctaUrl: (payload) => `${APP_URL}${payload.language === 'en' ? '/en' : ''}`,
    title: 'As leituras deste mês',
    subtitle: 'Apostolado de Garabandal',
    requiredVariables: ['name', 'articles'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Todos os meses escolhemos algumas leituras do nosso site — artigos, testemunhos e notícias da missão — para você ler com calma, rezar e, se quiser, compartilhar com quem ama.',
    ],
  },
  member_learn_garabandal: {
    key: 'member_learn_garabandal',
    name: 'Conhecer Garabandal',
    category: 'Vida Espiritual',
    goal: 'Convidar o membro a aprofundar a mensagem e, se quiser, compartilhar.',
    defaultSubject: 'Venha conhecer Garabandal mais de perto',
    previewText: 'Vídeos, cursos e a história das aparições, na sua área de membro.',
    ctaLabel: 'Aprender sobre Garabandal',
    ctaUrl: (payload) => marketingUrl('/member/academy', payload),
    title: 'A mensagem de Garabandal, mais perto de você',
    subtitle: 'Aprofunde sua fé',
    requiredVariables: ['name', 'learn_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'A mensagem de Garabandal é profunda e ainda pouco conhecida. Na sua área de membro você tem <strong>vídeos, cursos e a história das aparições</strong> para aprofundar tudo o que Nossa Senhora veio dizer.',
      'Você assiste no seu ritmo, um pouco de cada vez. Cada vídeo, cada testemunho, cada documento é um convite a conhecer melhor este lugar e sua mensagem.',
      'Que cada passo aproxime você mais do coração da mensagem — e de Nossa Senhora.',
    ],
  },
};

const MARKETING_EMAIL_TEMPLATE_EN: Record<MarketingTemplateKey, MarketingTemplateLocalizedContent> = {
  brochure_followup_1: {
    goal: 'Convert brochure request into a pilgrimage registration.',
    defaultSubject: '{{first_name}}, you have the brochure — one step left',
    previewText: 'Many of our pilgrims started exactly here. View dates and availability.',
    ctaLabel: 'View Dates and Book',
    title: 'A pilgrimage that can change much',
    subtitle: '{{pilgrimage_name}} — upcoming dates',
    paragraphs: [
      'Hello <strong>{{first_name}}</strong>,',
      'You requested the brochure for <strong>{{pilgrimage_name}}</strong> — and that already says something. Many of the people who travel with us today started exactly here, with a simple curiosity that slowly grew.',
      'Places are limited and accompanied by our team to ensure an experience of prayer, community and faith. If you feel this may be your moment, checking dates and availability is the most natural next step.',
      `If you have any questions before deciding — about the programme, costs, accommodation, or simply whether this path is right for you — message us on ${contactWa} or email ${contactMail}. We are here.`,
    ],
  },
  pilgrimage_testimony: {
    goal: 'Build trust and spiritual desire.',
    defaultSubject: 'Garabandal is not a trip — it is an encounter',
    previewText: 'Many pilgrims return with a peace hard to explain. See the pilgrimage.',
    ctaLabel: 'Discover the Pilgrimage',
    title: 'An experience that transforms',
    subtitle: 'What many experience in Garabandal',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Many pilgrims share that they arrive in Garabandal with a heavy heart and return with a peace that is hard to explain. It is a small and hidden village — and yet Our Lady\'s message here has touched millions of souls.',
      'People arrive carrying questions they cannot quite formulate. They find silence, prayer, sharing among brothers and sisters in faith — and a presence that so many describe as unmistakable.',
      `If you feel this path may be for you, review the programme at your own pace. And if you need to understand more before deciding, message us on ${contactWa} or email ${contactMail}.`,
    ],
  },
  pilgrimage_faq_objections: {
    goal: 'Answer common questions before registration.',
    defaultSubject: '"I\'d love to go, but..." — {{first_name}}, let\'s talk about it',
    previewText: 'Cost, accommodation, travel, payment plans — all answered.',
    ctaLabel: 'View Details and Get Answers',
    title: 'The most common questions before departing',
    subtitle: '{{pilgrimage_name}}',
    paragraphs: [
      'Hello <strong>{{first_name}}</strong>,',
      '"I\'d really love to go, but I\'m not sure if..." — do you recognise this thought? It is completely normal to want clarity before moving forward.',
      'The most common questions — total cost, single or shared rooms, travel included, instalment payments, cancellation, who accompanies the group — are all answered on the pilgrimage page.',
      `If anything is still unclear, message us on ${contactWa} or email ${contactMail}. We want you to decide with clarity, confidence and peace. No pressure of any kind.`,
    ],
  },
  italy_medjugorje_launch: {
    goal: 'Introduce the Italy and Medjugorje pilgrimage and create urgency around the remaining places.',
    defaultSubject: 'Italy and Medjugorje 2027: 75% of the places are gone',
    previewText: '13 days, 10 shrines, from the tomb of Padre Pio to Medjugorje. See the route.',
    ctaLabel: 'See the Route and Secure My Place',
    title: 'Italy and Medjugorje',
    subtitle: '5–17 April 2027 · 13 days · 10 shrines',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'In April 2027 the Garabandal Apostolate is taking a group to <strong>Italy and Medjugorje</strong> — 13 days, 10 shrines, from the tomb of Padre Pio to the hill of the apparitions.',
      'Places are going quickly: 75% are already taken. Take a look at the full day-by-day programme, with no commitment.',
    ],
  },
  italy_medjugorje_story: {
    goal: 'Build spiritual desire by connecting Garabandal, Padre Pio and Medjugorje.',
    defaultSubject: 'Padre Pio saw Garabandal before he died',
    previewText: 'There is a reason this pilgrimage goes to Italy — and it is not tourism.',
    ctaLabel: 'See the Full Pilgrimage',
    title: 'Where Garabandal and Padre Pio meet',
    subtitle: 'Italy and Medjugorje · April 2027',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'When Conchita reached San Giovanni Rotondo, <strong>Padre Pio</strong> had already died — and still she was given his veil and the message he had left for her.',
      'The story of Garabandal and the story of Italy are tied together. And Medjugorje carries on the same call to prayer and conversion.',
    ],
  },
  italy_medjugorje_value: {
    goal: 'Remove the financial objection: clear price, interest-free instalments, what is included.',
    defaultSubject: '€1,850 all-in — and you can split it into 10',
    previewText: 'Hotel, all meals, drinks and travel included, in up to 10 interest-free instalments.',
    ctaLabel: 'See the Full Cost and Register',
    title: 'What it really costs',
    subtitle: 'Italy and Medjugorje · 5–17 April 2027',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'The question we are asked most is always the same: "how much is it, really?"',
      'It is €1,850 for the land package, with hotel, all meals, drinks and travel included — payable in up to 10 interest-free instalments.',
    ],
  },
  italy_medjugorje_last_call: {
    goal: 'Close the final places before the registration deadline.',
    defaultSubject: 'Final places for Italy and Medjugorje',
    previewText: 'Registrations close on 30 November. After that the group is closed.',
    ctaLabel: 'Secure the Last Place',
    title: 'Final places',
    subtitle: 'Italy and Medjugorje · registrations until 30 November 2026',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'This is the last email we will send you about <strong>Italy and Medjugorje 2027</strong>. If the timing is not right, we leave it here with respect.',
      'Registrations close on 30 November 2026 — after that the group is closed with the agency and no one else can be added.',
    ],
  },
  abandoned_registration_1: {
    goal: 'Recover a started but unfinished pilgrimage registration.',
    defaultSubject: '{{first_name}}, your spot in {{pilgrimage_name}} is almost secured',
    previewText: 'Places are limited — you can still pick up right where you left off.',
    ctaLabel: 'Resume and Confirm My Spot',
    title: 'Your registration was left unfinished',
    subtitle: '{{pilgrimage_name}}',
    paragraphs: [
      'Hello <strong>{{first_name}}</strong>,',
      'You started registering for <strong>{{pilgrimage_name}}</strong>, but the process was not completed. Places are limited — and yours can still be secured.',
      `If you were simply interrupted, you can resume exactly where you left off with one click. If you ran into any difficulty with payment, details or availability, message us on ${contactWa} or email ${contactMail} and we will help resolve it.`,
    ],
  },
  abandoned_registration_faq: {
    goal: 'Help leads blocked by questions.',
    defaultSubject: 'Did something stop you during registration, {{first_name}}?',
    previewText: 'Payment, rooms, travel, documents — we are here to help.',
    ctaLabel: 'Resume My Registration',
    title: 'It may be simpler than it seems',
    subtitle: 'We are here to help',
    paragraphs: [
      'Hello <strong>{{first_name}}</strong>,',
      'When a registration is left unfinished, it is almost always because of a specific question: instalment payment, single or shared room, travelling alone or in a group, or simply missing details.',
      `You do not need to work it out alone. Message us on ${contactWa} or email ${contactMail} with your question — we are fully available to help. If you are already ready to continue, the button below takes you back to the process in seconds.`,
    ],
  },
  abandoned_registration_final: {
    goal: 'Create moderate urgency before ending follow-up.',
    defaultSubject: '{{first_name}}, a final invitation about your registration',
    previewText: 'If this path still makes sense for you, this is a good moment.',
    ctaLabel: 'Complete My Registration',
    title: 'A final invitation, with all respect',
    subtitle: '{{pilgrimage_name}}',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'This is the last email we will send about the registration for <strong>{{pilgrimage_name}}</strong>. If this is not the right time, we leave it here with full respect for your decision — and we will always be available whenever you wish.',
      'But if this path still makes sense to you — and it is often when we least expect it that these doors open — you can complete your registration with one click. Places are limited and the team will be glad to confirm your booking.',
    ],
  },
  waitlist_welcome: {
    goal: 'Confirm interest and keep the contact warm.',
    defaultSubject: '{{first_name}}, you are on the list — we will alert you the moment a place opens',
    previewText: 'You will be among the first to know when a date or place opens.',
    ctaLabel: 'View Available Pilgrimages',
    title: 'You are on the list — we will alert you when places open',
    subtitle: 'Apostolate of Garabandal',
    paragraphs: [
      'Hello <strong>{{first_name}}</strong>,',
      'We confirm that your interest has been registered. When there are new dates, places or related pilgrimages, we will contact you directly — before we announce to the general public.',
      `In the meantime, you can view the pilgrimages that are currently open. And if you have questions before any place becomes available, message us on ${contactWa} or email ${contactMail}.`,
    ],
  },
  waitlist_open_spot: {
    goal: 'Convert waiting-list contacts when availability opens — always with the real number of places.',
    defaultSubject: '{{first_name}}, {{vacancies_phrase}} on the pilgrimage to Garabandal 🕊️',
    previewText: 'Good news: {{vacancies_phrase}} on {{pilgrimage_name}}.',
    ctaLabel: 'Secure My Place',
    title: 'There are places on your pilgrimage',
    subtitle: '{{pilgrimage_name}}',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'We are contacting you because you joined the waiting list — and right now {{vacancies_phrase}} on the pilgrimage <strong>{{pilgrimage_name}}</strong>.',
      'Places fill quickly. If this date makes sense for you, we recommend viewing the details now and moving forward with registration. We are here for any help you may need.',
    ],
  },
  waitlist_more_spots: {
    goal: 'Activate the waiting list with honest urgency when more places may open.',
    defaultSubject: '{{first_name}}, more places may open in November 🕊️',
    previewText: 'Demand was enormous. The Apostolate may open more places — but only a few will be chosen.',
    ctaLabel: 'Message us now on WhatsApp',
    title: 'There may be more places — and you are first in line',
    subtitle: '{{pilgrimage_name}}',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Demand for <strong>{{pilgrimage_name}}</strong> was so great that the places sold out. Precisely for that reason, the Apostolate is studying the possibility of releasing a few more places — and only a limited number of people can be chosen.',
      `You are on the waiting list, so you have priority to be considered. If you feel this call, contact us urgently on ${contactWa}: those who show interest first move to the front of the selection.`,
    ],
  },
  waitlist_garabandal_story: {
    goal: 'Nurture waiting-list contacts with spiritual value before any commercial ask.',
    defaultSubject: '{{first_name}}, while your place has not opened yet, discover Garabandal more deeply',
    previewText: 'A short reflection to live this waiting time with more meaning.',
    ctaLabel: 'Discover the History of Garabandal',
    title: 'While you wait, draw closer to the message',
    subtitle: 'Garabandal begins in the heart',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'You joined the waiting list because, in some way, Garabandal has already touched your heart. While we wait for real availability, we would like this time not to be empty: it can be a time of preparation, prayer and discovery.',
      'Garabandal is not only a place on the map. It is a simple and demanding message: conversion, prayer, the Eucharist and trust in Our Lady.',
      `So today we leave a simple invitation: learn more about the history of the apparitions and pray calmly about this possible call. If you would like to speak with us, message us on ${contactWa} or email ${contactMail}.`,
    ],
  },
  waitlist_book_recommendation: {
    goal: 'Recommend official books to waiting-list contacts without pressure to register.',
    defaultSubject: '{{first_name}}, a book to live Garabandal while you wait',
    previewText: 'Official readings to understand the message before the pilgrimage.',
    ctaLabel: 'View Books in the Official Store',
    title: 'Prepare your heart with a good reading',
    subtitle: 'Official books of Garabandal',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'While you wait for a place, there is a very concrete way to draw closer to Garabandal: read, pray and understand Our Lady\'s message more deeply.',
      'We selected a few books and guides from the Official Store that help explain the context, testimonies and spiritual call of Garabandal. It is not an impulse purchase; it is preparation to live this path more deeply.',
      'If any of these titles speaks to you, you can review the details calmly. And if you have questions about which one to choose, message us on WhatsApp.',
    ],
  },
  waitlist_mission_support: {
    goal: 'Present the mission and House of Welcome to waiting-list contacts.',
    defaultSubject: '{{first_name}}, your waiting time can also support this mission',
    previewText: 'While we wait for a place, see how the mission in Garabandal continues every day.',
    ctaLabel: 'Support the Mission',
    title: 'The mission continues before the journey',
    subtitle: 'House of Welcome and Apostolate',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Not everyone can go to Garabandal at the moment they wish. But the mission continues every day: welcoming pilgrims, preparing groups, maintaining formation content, praying for intentions and making Our Lady\'s message better known.',
      'The House of Welcome exists precisely for this: to be a place of support, prayer and concrete presence in Garabandal. Every gift, large or small, helps more people find this path with peace.',
      'If this work speaks to your heart, you can support the mission simply and securely. And if this is not the moment, be at peace: we continue to pray for you and will alert you when a place opens.',
    ],
  },
  waitlist_member_invitation: {
    goal: 'Invite waiting-list contacts to belong to the Apostolate before the pilgrimage.',
    defaultSubject: '{{first_name}}, even before you travel, you can belong',
    previewText: 'Being a member means walking with the Apostolate, praying with us and supporting this mission.',
    ctaLabel: 'See How to Become a Member',
    title: 'You do not need to wait to belong',
    subtitle: 'An invitation from the Apostolate',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Being on the waiting list already shows that there is in you a desire to draw closer to Garabandal. But belonging to the Apostolate does not begin only when the journey happens. It can begin now, through prayer, formation and ongoing support for the mission.',
      'As a member, you walk with us more closely: you receive access to exclusive content, novenas, candles for your intentions, the Holy Mass stream and the joy of sustaining this work concretely.',
      'Membership is simple and accessible. Review how it works calmly. If it makes sense for you, it will be a joy to welcome you as a member of this spiritual family.',
    ],
  },
  payment_support: {
    goal: 'Support bookings with pending payments.',
    defaultSubject: '{{first_name}}, we can help you complete the payment',
    previewText: 'A pending payment — but simple to resolve. We can help.',
    ctaLabel: 'Manage My Registration',
    title: 'Payment still pending',
    subtitle: '{{pilgrimage_name}}',
    paragraphs: [
      'Hello <strong>{{first_name}}</strong>,',
      'We are following your registration and noticed there may still be a pending payment or proof of payment to register. We do not want you to lose your place over a technical matter.',
      `You can manage everything from your registration with one click. If you have already made the bank transfer, simply send the proof and the team will take care of the rest. If you have any difficulty, message us on ${contactWa} or email ${contactMail}.`,
    ],
  },
  donation_thank_you: {
    goal: 'Thank the donor and open a future relationship.',
    defaultSubject: '{{first_name}}, your donation arrived — and it makes a real difference',
    previewText: 'Thank you. Here is what your support makes concretely possible.',
    ctaLabel: 'Learn About the Mission',
    title: 'Your support arrived — thank you',
    subtitle: 'Apostolate of Garabandal',
    paragraphs: [
      'Hello <strong>{{first_name}}</strong>,',
      'Your donation has been received — and we want you to know it is not just a number in an account. It is what makes it possible to keep this apostolate alive: pilgrimages to Garabandal, spiritual content, welcome and the living presence of Our Lady\'s message.',
      'We pray that Our Lady of Garabandal intercedes for you and your family. Your gesture is a concrete act of faith — and it is part of this mission.',
    ],
  },
  donation_thank_you_story: {
    goal: 'Show impact and prepare a future ask.',
    defaultSubject: 'The House of Welcome still needs to grow',
    previewText: 'Your help contributes to rebuilding a house in service of pilgrims.',
    ctaLabel: 'Support the House of Welcome',
    title: 'A house to welcome pilgrims',
    subtitle: 'Present and future in Garabandal',
    paragraphs: [
      'Hello <strong>{{first_name}}</strong>,',
      'Your support helps sustain what is often unseen: the preparation of pilgrimages, the creation of spiritual content, the accompaniment of new pilgrims, and the ongoing digital presence serving the message of Garabandal.',
      'If you would like to continue supporting this mission — knowing that every contribution has a real and concrete impact — below is a simple and secure way to do so. God reward you.',
    ],
  },
  donor_to_member: {
    goal: 'Convert a donor into a member.',
    defaultSubject: '{{first_name}}, take the next step in this mission',
    previewText: 'Supporting was a gesture; becoming a member is belonging continuously.',
    ctaLabel: 'View Member Benefits',
    title: 'Belong to the mission from within',
    subtitle: 'Special invitation to become a member',
    paragraphs: [
      'Hello <strong>{{first_name}}</strong>,',
      'You have already shown generosity towards the Apostolate — and that means a great deal to our entire community. We would like to present a path that is even closer: becoming a member.',
      'As a member, your connection to the mission becomes stable and regular, with access to exclusive content and spiritual accompaniment. It is a concrete way of saying "I am here" — not once, but continuously, alongside all those who share this love for Garabandal.',
    ],
  },
  member_invitation: {
    goal: 'Invite a warm contact to become a member.',
    defaultSubject: '{{first_name}}, you have a special invitation from the Apostolate',
    previewText: 'A way to be part of this mission on an ongoing basis.',
    ctaLabel: 'See How It Works',
    title: 'An invitation to be part of it',
    subtitle: 'Apostolate of Garabandal',
    paragraphs: [
      'Hello <strong>{{first_name}}</strong>,',
      'We would like to invite you to become a member of the Apostolate — not just to support occasionally, but to be part of this mission continuously, in the service of Our Lady\'s message of Garabandal.',
      `As a member, you receive the digital certificate, access to exclusive content, and the knowledge that your regular contribution sustains this work concretely. You can review everything at your own pace. If you have any questions, message us on ${contactWa} or email ${contactMail}.`,
    ],
  },
  store_book_recommendation: {
    goal: 'Recommend a relevant book or product without mixing it with a membership invitation.',
    defaultSubject: '{{first_name}}, official books to deepen Garabandal',
    previewText: 'Active products from the official store to read, pray and share with family.',
    ctaLabel: 'View Official Store',
    title: 'Official books of Garabandal',
    subtitle: 'Store recommendation',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'If you want to continue discovering the message of Garabandal calmly, a good book can help you pray, understand the context and return to the essentials without rushing.',
      'We selected this recommendation for people who already showed interest in Garabandal and may want a concrete next step at home.',
    ],
  },
  store_book_flash_sale: {
    goal: 'Create urgency for book purchases in the one-day special campaign.',
    defaultSubject: '{{first_name}}, today only: 15% off Garabandal books',
    previewText: 'The special campaign ends at midnight in Brazil. After that, prices return to normal.',
    ctaLabel: 'Buy with 15% Off Now',
    title: 'Today only: 15% off official books',
    subtitle: 'Special campaign on the day of the first apparition of Our Lady in Garabandal',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Today is the day of the first apparition of Our Lady in Garabandal. For this reason, all official bookstore books are 15% off only until midnight in Brazil.',
      'Choose now the book you want to read, gift or keep at home to deepen the message.',
    ],
  },
  lead_to_member_welcome: {
    goal: 'Convert leads, past pilgrims and donors into members.',
    defaultSubject: '{{first_name}}, there is a place kept for you in this mission',
    previewText: 'Become part of the Garabandal Apostolate, continuously.',
    ctaLabel: 'Become a Member',
    title: 'There is a place kept for you',
    subtitle: 'Garabandal Apostolate',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'At some point your heart drew close to Garabandal — perhaps through a pilgrimage, a prayer request, a donation, or simply through Our Lady\'s message. We believe it was not by chance. Some paths open when we least expect them.',
      'Today we would like to invite you to take one step further: to <strong>become a member of the Garabandal Apostolate</strong>. It is not only about giving once — it is about belonging, continuously, to a family that prays and works in the service of this message.',
      '<strong>As a member, you receive:</strong><br>🕊️&nbsp; The <strong>live</strong> Holy Mass from Garabandal<br>📿&nbsp; The novenas and <strong>candles lit for your intentions</strong><br>📖&nbsp; Exclusive content and the spiritual Academy<br>🎓&nbsp; Your digital membership diploma<br>❤️&nbsp; The assurance that your contribution sustains this mission',
      'Annual membership is just <strong>€25/year</strong> — and it concretely sustains this living mission.',
      '<em>"You must pray much, pray with faith and fervour."</em> — Message of Garabandal',
      `If you have any questions, message us on ${contactWa} or email ${contactMail}. We are here — and we pray for you.`,
    ],
  },
  lead_to_member_followup: {
    goal: 'Recover leads who did not join, appealing to a prayer intention.',
    defaultSubject: '{{first_name}}, think of one intention you would like to see prayed for',
    previewText: 'As a member, your intentions are taken to the candles and novenas of Garabandal.',
    ctaLabel: 'Join Now',
    title: 'Think of one intention',
    subtitle: 'An invitation that still stands',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'A few days ago we invited you to become part of the Apostolate. Perhaps the timing was not right — we completely understand.',
      'But let me ask you just this: <strong>think of one intention</strong> you carry in your heart — a sick relative, a difficult decision, a grace you are hoping for. As a member, that intention is brought to the <strong>candles lit in Garabandal</strong> and the <strong>novenas</strong> prayed by our community. You do not walk alone.',
      'Whatever you decide, you remain in our prayers.',
    ],
  },
  membership_renewal: {
    goal: 'Invite members whose membership has already expired to renew.',
    defaultSubject: '{{first_name}}, your place in this mission is still yours',
    previewText: 'Your membership has expired, but nothing was lost — renewing takes less than a minute.',
    ctaLabel: 'Renew My Membership',
    title: 'Your place is still yours',
    subtitle: 'Member area',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Your membership has expired — and we want you to know that nothing was lost: your place in this mission is still yours, and you remain in our prayers.',
      'Whenever you wish to return, renewing takes less than a minute. The live Mass from Garabandal, the novenas, the candles for your intentions and all the spiritual content in your area become active again right away.',
      `And if this is not the right moment, be at peace: you remain part of this spiritual family. If you have any difficulty, message us on ${contactWa} or email ${contactMail} — we are here to help.`,
    ],
  },
  member_referral_activation: {
    goal: 'Encourage the member to invite one specific person they have in mind.',
    defaultSubject: '{{first_name}}, is there someone who comes to mind?',
    previewText: 'Think of just one person who needs peace and faith. Your invitation can reach them.',
    ctaLabel: 'Invite that Person',
    title: 'Think of one person',
    subtitle: 'A personal invitation',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Pause for a moment and think of just one person — a family member, a friend, someone searching for peace or going through a hard time. Often we already know exactly who it is.',
      'Your invitation may be precisely what that person needs to draw closer to Our Lady of Garabandal. And there is a token of gratitude: when they become a member through your invite, <strong>you both receive {{referral_reward}} in store credit</strong> for the Online Store.',
      'Your invite code is ready in your member area. Invite today the person you thought of — it may change their life.',
    ],
  },
  referral_activation: {
    goal: 'Encourage sharing through an invitation.',
    defaultSubject: '{{first_name}}, invite a friend and you can both receive {{referral_reward}}',
    previewText: 'A simple share can bring someone closer to faith — and generate credit for both of you.',
    ctaLabel: 'Open and Share the Invitation',
    title: 'A simple invitation — with a gift for both',
    subtitle: 'Bringing Garabandal to more people',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'If you know someone searching for something deeper — peace, faith, hope, a spiritual path — the message of Garabandal may be exactly what they need to find.',
      'When that person becomes a member through your invitation, <strong>you both receive {{referral_reward}} in store credit</strong> for the Online Store. Credit is applied only after the membership is confirmed; it is our way of thanking those who help the mission grow.',
      'There is no need to explain everything — just share your invite link and let the mission speak for itself.',
    ],
  },
  share_mission: {
    goal: 'Reinforce sharing after the first invitation.',
    defaultSubject: '{{first_name}}, your invitation is active to share the mission',
    previewText: 'If someone becomes a member through your invitation, both of you receive {{referral_reward}} in credit.',
    ctaLabel: 'Share Again',
    title: 'Your invitation is ready to be shared',
    subtitle: 'A simple invitation, without pressure',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Your personal invitation is active in the member area. If there is someone who may benefit from the message of Garabandal, you can share that link calmly, at the right moment.',
      'When someone becomes a member through your invitation, <strong>both of you receive {{referral_reward}} in store credit</strong> for the Online Store. Credit is applied only after the membership is confirmed, and can be used for books, items or donations.',
      'There is no need to explain everything or pressure anyone. A personal share, made with faith and respect, is already a concrete act of apostolate.',
    ],
  },
  referral_reward_inviter: {
    goal: 'Notify the inviter that someone joined, explain the credit and encourage another thoughtful share.',
    defaultSubject: '{{first_name}}, {{invitee_name}} joined through your invitation',
    previewText: '{{referral_reward}} has been added to your store credit.',
    ctaLabel: 'See Credit and Share Again',
    title: 'Your invitation bore fruit',
    subtitle: 'Store credit confirmed',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      '{{invitee_name}} became a member through your invitation. Thank you for helping the mission grow.',
      'As a thank-you, {{referral_reward}} has been added to your store credit. {{invitee_name}} also received the same credit as a welcome gift.',
      'Your link remains active. If there is another person who may benefit from Garabandal, share it when the moment feels right.',
    ],
  },
  referral_reward_invitee: {
    goal: 'Explain the welcome credit to the new member and open the next sharing loop.',
    defaultSubject: '{{first_name}}, your welcome credit is available',
    previewText: 'You joined through {{inviter_name}}’s invitation and received {{referral_reward}} in credit.',
    ctaLabel: 'See My Credit',
    title: 'Your welcome credit is ready',
    subtitle: 'Welcome to the Apostolate',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'You became a member through {{inviter_name}}’s invitation. As a welcome thank-you, {{referral_reward}} has been added to your store credit.',
      'You can use this credit for official books, items or donations. Your own invitation link is also ready in the member area.',
      'When it feels right, share it with someone who may need peace, faith or hope.',
    ],
  },
  member_welcome: {
    goal: 'Welcome the new member and present the area as a place of prayer.',
    defaultSubject: '{{first_name}}, welcome to this mission of prayer',
    previewText: 'Your place of prayer and recollection is ready.',
    ctaLabel: 'Enter My Area',
    title: 'Welcome to the Apostolate of Garabandal',
    subtitle: 'Your member area is ready',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'It is with joy that we welcome you to the Apostolate of Garabandal. From today, you are part of a community united in prayer and in the message of Our Lady.',
      'In your member area you will find a place of recollection: to pray, to offer your intentions and to deepen your faith — including the Holy Mass streamed live from the church of Garabandal.',
      `May Our Lady of Garabandal accompany you on this path. We are here for whatever you need — message us on ${contactWa} or email ${contactMail}.`,
    ],
  },
  member_pray_intentions: {
    goal: 'Invite the member to pray and offer their intentions.',
    defaultSubject: 'Offer your intentions to Our Lady',
    previewText: 'Light a candle and pray for your intentions, from your area.',
    ctaLabel: 'Light a Candle and Pray',
    title: 'Your intentions in the hands of Our Lady',
    subtitle: 'A moment of prayer',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'We all carry intentions in our hearts — for those we love, for a grace, for a healing. At Garabandal, Our Lady asked us to pray with confidence.',
      'In your member area you can <strong>light a candle</strong> that burns for your intentions, and pray with the prayers you find there. It is a simple gesture, yet full of faith.',
      'Set aside a quiet moment and entrust to Our Lady what you carry in your heart.',
    ],
  },
  member_novena_invite: {
    goal: 'Invite the member to begin a novena.',
    defaultSubject: '{{first_name}}, pray a novena for your intentions',
    previewText: 'Nine days of prayer to entrust your intentions to Our Lady.',
    ctaLabel: 'Begin a Novena',
    title: 'Nine days of persevering prayer',
    subtitle: 'Begin a novena',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'A novena is nine days of persevering prayer — a simple and powerful way to entrust your intentions to Our Lady of Garabandal.',
      'You can begin today, at your own pace, from your member area. Each day, a prayer; each day, a step closer.',
      'Let these nine days be a time of peace and surrender. Our Lady always listens.',
    ],
  },
  member_learn_garabandal: {
    goal: 'Invite the member to go deeper and, if they wish, to share.',
    defaultSubject: 'Come to know Garabandal more closely',
    previewText: 'Videos, courses and the history of the apparitions, in your area.',
    ctaLabel: 'Learn about Garabandal',
    title: 'The message of Garabandal, closer to you',
    subtitle: 'Deepen your faith',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'The message of Garabandal is profound and still little known. In your member area you have <strong>videos, courses and the history of the apparitions</strong> to deepen everything Our Lady came to say.',
      'You can watch at your own pace, a little at a time. Each video, each testimony, each document is an invitation to know this place and its message more deeply.',
      'May each step bring you closer to the heart of the message — and to Our Lady.',
    ],
  },
  newsletter_monthly: {
    goal: 'Give real site content to the newsletter list — articles, testimonies and the life of the mission.',
    defaultSubject: '{{first_name}}, this month\'s readings from the Apostolate',
    previewText: 'Articles, testimonies and the life of the Garabandal mission — to read calmly.',
    ctaLabel: 'Visit the Apostolate Website',
    title: 'This month\'s readings',
    subtitle: 'Apostolate of Garabandal',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Every month we choose a few readings from our website — articles, testimonies and news of the mission — for you to read calmly, pray with, and share with those you love.',
    ],
  },
};

// Cartão de artigo da newsletter — sempre conteúdo real publicado no site.
const NewsletterArticleCard = (article: MarketingTemplateArticle, locale: EmailLocale) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="margin:18px 0;border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;background:#ffffff;background-color:#ffffff;">
  ${article.imageUrl ? `<tr><td style="padding:0;line-height:0;"><a href="${article.url}" style="text-decoration:none;"><img src="${article.imageUrl}" width="552" alt="" style="display:block;width:100%;max-width:552px;height:auto;border:0;" /></a></td></tr>` : ''}
  <tr><td style="padding:18px 22px;">
    ${article.tag ? `<div style="font-size:11px;line-height:16px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:${COLORS.primary};margin:0 0 6px;">${article.tag}</div>` : ''}
    <div style="font-size:19px;line-height:25px;font-weight:900;color:${COLORS.heading};font-family:${FONTS.serif};margin:0 0 8px;">
      <a href="${article.url}" style="color:${COLORS.heading};text-decoration:none;">${article.title}</a>
    </div>
    ${article.excerpt ? `<div class="email-text" style="font-size:15px;line-height:24px;color:${COLORS.text};margin:0 0 10px;">${article.excerpt}</div>` : ''}
    <a href="${article.url}" style="font-size:14px;font-weight:800;color:${COLORS.primaryDark};text-decoration:underline;">${locale === 'en' ? 'Read the article →' : 'Ler o artigo →'}</a>
  </td></tr>
</table>`;

// Atribuição: todos os links do site em emails de marketing levam UTM
// (utm_campaign = template_key). Links de unsubscribe ficam limpos.
const MARKETING_UTM_SKIP = /unsubscribe|cancelar-subscricao/i;
const addMarketingUtm = (html: string, templateKey: string) =>
  html.replace(/href="([^"]+)"/g, (match, url: string) => {
    if (!url.startsWith(APP_URL)) return match;
    if (MARKETING_UTM_SKIP.test(url) || url.includes('utm_')) return match;
    const separator = url.includes('?') ? '&' : '?';
    return `href="${url}${separator}utm_source=email&utm_medium=marketing&utm_campaign=${encodeURIComponent(templateKey)}"`;
  });

export const renderMarketingTemplateEmail = (payload: MarketingTemplatePayload) => {
  const baseTemplate =
    MARKETING_EMAIL_TEMPLATES[payload.templateKey as MarketingTemplateKey] ||
    MARKETING_EMAIL_TEMPLATES.brochure_followup_1;
  const locale = payload.language === 'en' ? 'en' : 'pt';
  const template =
    locale === 'en'
      ? { ...baseTemplate, ...MARKETING_EMAIL_TEMPLATE_EN[baseTemplate.key] }
      : baseTemplate;
  const subject = fillMarketingVariables(payload.subjectOverride || template.defaultSubject, payload);
  const bodyParagraphs = payload.bodyOverride
    ? payload.bodyOverride.split('\n').filter(Boolean)
    : template.paragraphs;
  const ctaUrl = localizeMarketingUrl(fillMarketingVariables(baseTemplate.ctaUrl(payload), payload), locale);
  // For pilgrimage-recommendation emails, adapt the main CTA to the pilgrimage state:
  // when the pilgrimage is on a waiting list, invite the reader to join the list.
  const RECOMMENDATION_KEYS = new Set(['brochure_followup_1', 'pilgrimage_testimony', 'pilgrimage_faq_objections']);
  const ctaLabel =
    RECOMMENDATION_KEYS.has(baseTemplate.key) && payload.pilgrimageStatus === 'waitlist'
      ? (locale === 'en' ? 'Join the Waiting List' : 'Entrar na Lista de Espera')
      : template.ctaLabel;
  const richContent =
    !payload.bodyOverride && baseTemplate.contentHtml
      ? fillMarketingVariables(baseTemplate.contentHtml(locale, payload), payload)
      : null;
  const productItems =
    Array.isArray(payload.products) && payload.products.length
      ? payload.products
      : baseTemplate.key === 'waitlist_book_recommendation' || baseTemplate.key === 'store_book_flash_sale'
        ? WAITLIST_RECOMMENDED_PRODUCTS
      : payload.productTitle || payload.productUrl
        ? [{
            title: payload.productTitle || null,
            price: payload.productPrice || null,
            imageUrl: payload.productImageUrl || null,
            url: payload.productUrl || null,
          }]
        : [];
  const productCard =
    baseTemplate.category === 'Loja'
      ? productItems
          .map((product) => (baseTemplate.key === 'store_book_flash_sale' ? PromoProductCard : ProductCard)({
            title: product.title || null,
            price: product.price || null,
            imageUrl: product.imageUrl || null,
            url: product.url || null,
            label: product.label || null,
            locale,
          }))
          .join('')
      : "";
  const articleCards =
    Array.isArray(payload.articles) && payload.articles.length
      ? payload.articles.map((article) => NewsletterArticleCard(article, locale)).join('')
      : '';

  return {
    subject,
    html: addMarketingUtm(Layout({
      title: fillMarketingVariables(template.title, payload),
      preview: fillMarketingVariables(template.previewText, payload),
      locale,
      unsubscribeUrl: payload.unsubscribeUrl || null,
      children: `
        ${Header({
          title: fillMarketingVariables(template.title, payload),
          subtitle: fillMarketingVariables(template.subtitle, payload),
          category: template.category,
          ...(baseTemplate.useHeroImage && payload.pilgrimageImageUrl ? { image: payload.pilgrimageImageUrl } : {}),
        })}
        ${Section({
          children: `
            ${richContent ?? bodyParagraphs.map((paragraph) => Text(fillMarketingVariables(paragraph, payload))).join('')}
            ${articleCards}
            ${productCard}
            ${Button({ label: ctaLabel, url: ctaUrl })}
          `,
        })}
      `,
    }), template.key),
    templateKey: template.key,
  };
};

export const renderQuotaWarningEmail = (payload: any) => ({
  subject: "Lembrete: anuidade prestes a vencer",
  html: Layout({
    title: "Lembrete de Anuidade",
    children: Section({
      children: `
                ${Text(`Olá <strong>${payload.name || "membro"}</strong>,`)}
                ${Text(`A sua anuidade vence em ${payload.daysRemaining} dia(s). Para manter o acesso ativo, regularize atempadamente.`)}
                ${Button({ label: "Regularizar Pagamento", url: payload.payLink })}
`,
    }),
  }),
});

export const renderQuotaOverdueEmail = (payload: any) => ({
  subject: "Anuidade em atraso",
  html: Layout({
    title: "Anuidade em Atraso",
    children: Section({
      children: `
                ${Text(`Olá <strong>${payload.name || "membro"}</strong>,`)}
                ${Text("A sua anuidade encontra-se em atraso. Regularize para manter os benefícios de membro ativos.")}
                ${Button({ label: "Regularizar Agora", url: payload.payLink })}
`,
    }),
  }),
});

export const renderMembershipRevokedEmail = (payload: { name?: string | null; payLink?: string | null; locale?: EmailLocale }) => {
  const locale: EmailLocale = payload.locale === 'en' ? 'en' : 'pt';
  const isEn = locale === 'en';
  const greetingName = payload.name && payload.name.trim()
    ? payload.name.trim()
    : isEn ? 'Apostolate member' : 'membro(a) do Apostolado';
  const firstName = payload.name && payload.name.trim() ? payload.name.trim().split(' ')[0] : '';
  const namePrefix = firstName ? `${firstName}, ` : '';

  return {
    subject: isEn
      ? `${namePrefix}your place in the mission is still saved`
      : `${namePrefix}sua vaga na missão ainda está guardada 🕊️`,
    html: Layout({
      title: isEn ? 'We miss you' : 'Sentimos sua falta',
      locale,
      children: Section({
        children: `
                ${Header({
        title: isEn ? 'We miss you' : 'Sentimos sua falta',
        subtitle: isEn ? 'Your place is still here' : 'Sua vaga continua aqui',
      })}
                ${Text(`${isEn ? 'Hello' : 'Olá'} <strong>${greetingName}</strong>,`)}
                ${Text(
                  isEn
                    ? 'We noticed your membership was not renewed, so your member access is currently paused. But we want you to know: your place in this family is still saved. The message of Garabandal needs people like you — and it takes just one click to come back.'
                    : 'Percebemos que sua anuidade não foi renovada e, por isso, seu acesso de membro ficou pausado. Mas queremos que você saiba: seu lugar nesta família continua guardado. A mensagem de Garabandal precisa de pessoas como você — e basta um clique para voltar.'
                )}
                ${payload.payLink ? Button({ label: isEn ? 'Reactivate My Membership' : 'Reativar Minha Anuidade', url: payload.payLink }) : ''}
`,
      }),
    }),
  };
};

export const renderMemberDiplomaEmail = (payload: MemberDiplomaInput) => {
  const locale = payload.locale === "en" ? "en" : "pt";
  const isEn = locale === "en";
  return {
    subject: isEn ? "Your Garabandal member certificate has arrived" : "Seu diploma de membro de Garabandal chegou",
    html: Layout({
      title: isEn ? "Member Certificate" : "Diploma de Membro",
      locale,
      children: Section({
        children: `
                ${Text(isEn ? `Hello <strong>${payload.memberName || "member"}</strong>,` : `Olá <strong>${payload.memberName || "membro"}</strong>,`)}
                ${Text(isEn ? "It is with honour that we send you, attached, your <strong>member certificate of the Apostolate of Garabandal</strong>. More than a document, it is a testament to your commitment to keeping Our Lady's message alive. Keep it with care." : "É com honra que enviamos, em anexo, o seu <strong>diploma de membro do Apostolado de Garabandal</strong>. Mais que um documento, ele é o testemunho do seu compromisso em manter viva a mensagem de Nossa Senhora. Guarde-o com carinho.")}
                ${Text(isEn ? "May Our Lady bless you and keep you." : "Que Nossa Senhora o abençoe e o guarde.", "text-align:center;font-style:italic;margin-top:24px;color:" + COLORS.textLight)}
`,
      }),
    }),
  };
};

/* -------------------------------------------------------------------------- */
/*                             AUCTION EMAILS                                 */
/* -------------------------------------------------------------------------- */

export type AuctionOutbidInput = {
  email: string;
  itemTitle: string;
  yourBid: number;
  newBid: number;
  minIncrement?: number;
  itemUrl: string;
  locale?: EmailLocale;
};

export type AuctionWinnerInput = {
  email: string;
  winnerName?: string | null;
  itemTitle: string;
  winningBid: number;
  paymentDeadlineHours: number;
  itemUrl: string;
};

export type AuctionAdminNotificationInput = {
  itemTitle: string;
  winnerEmail: string;
  winningBid: number;
  totalBids: number;
};

export type AuctionPaymentConfirmedInput = {
  itemTitle: string;
  winnerName?: string | null;
  winningBid: number;
  paymentMethod: string;
  paymentReference?: string | null;
  paidAt?: string | null;
};

export type AuctionAnnouncementInput = {
  recipientName?: string | null;
  itemTitle: string;
  itemDescription?: string | null;
  imageUrl?: string | null;
  currentBid?: number | null; // cents
  startingPrice: number; // cents
  endsAt: string;
  itemUrl: string;
  locale?: EmailLocale;
};

export const renderAuctionAnnouncementEmail = (payload: AuctionAnnouncementInput) => {
  const isEn = payload.locale === "en";
  const cur: EmailLocale = isEn ? "en" : "pt";
  const priceCents = payload.currentBid || payload.startingPrice;
  const endsLabel = formatDate(payload.endsAt, cur);
  const t = isEn
    ? {
        subject: `New charity auction: "${payload.itemTitle}"`,
        title: "A new piece is up for auction",
        preview: `Bid on "${payload.itemTitle}" and support the Apostolate.`,
        greeting: payload.recipientName ? `Hello ${payload.recipientName},` : "Hello,",
        intro: "A new piece is now available in our charity auction. Every bid supports the building of the Apostolate House of Garabandal.",
        startsAt: payload.currentBid ? "Current bid" : "Starting price",
        ends: "Auction ends",
        cta: "View &amp; Bid",
        footer: "If you do not wish to receive these announcements, you can unsubscribe at any time.",
      }
    : {
        subject: `Novo leilão solidário: "${payload.itemTitle}"`,
        title: "Uma nova peça está em leilão",
        preview: `Licite em "${payload.itemTitle}" e apoie o Apostolado.`,
        greeting: payload.recipientName ? `Olá ${payload.recipientName},` : "Olá,",
        intro: "Está disponível uma nova peça no nosso leilão solidário. Cada lance contribui para a construção da Casa do Apostolado de Garabandal.",
        startsAt: payload.currentBid ? "Lance atual" : "Valor mínimo",
        ends: "O leilão termina a",
        cta: "Ver e Licitar",
        footer: "Se não quiser receber estes anúncios, pode cancelar a subscrição a qualquer momento.",
      };

  return {
    subject: t.subject,
    html: Layout({
      title: t.title,
      preview: t.preview,
      locale: cur,
      children: `
            ${Header({ title: t.title, subtitle: payload.itemTitle })}
            ${Section({
        children: `
                    ${Text(t.greeting)}
                    ${Text(t.intro)}
                    ${payload.imageUrl
            ? `<div style="margin:0 0 24px;border-radius:12px;overflow:hidden;border:1px solid ${COLORS.border};"><img src="${payload.imageUrl}" alt="${payload.itemTitle}" style="display:block;width:100%;height:auto;" /></div>`
            : ""}
                    ${Card({
          children: `
                            ${InfoRow({ label: isEn ? "Piece" : "Peça", value: payload.itemTitle })}
                            ${InfoRow({ label: t.startsAt, value: `<span style="color:${COLORS.primary};font-weight:bold;">${formatCurrency(priceCents / 100, "EUR", cur)}</span>` })}
                            ${InfoRow({ label: t.ends, value: endsLabel, isLast: true })}
                        `,
        })}
                    ${Button({ label: t.cta, url: payload.itemUrl })}
                    ${Text(t.footer, `text-align:center;font-size:12px;color:${COLORS.textLight};font-style:italic;`)}
                `,
      })}
`,
    }),
  };
};

export const renderAuctionOutbidEmail = (payload: AuctionOutbidInput) => {
  const isEn = payload.locale === "en";
  const minNext = payload.newBid + (payload.minIncrement ?? 0);
  const t = isEn
    ? {
        subject: `Charity Auction: your bid was outbid — "${payload.itemTitle}"`,
        title: "Your bid was outbid",
        preview: `Your bid of ${formatCurrency(payload.yourBid, "EUR", "en")} has been beaten.`,
        intro: "Someone has placed a higher bid in the charity auction.",
        item: "Item",
        yourBid: "Your bid",
        newHigh: "New highest bid",
        minNow: "Minimum bid now",
        cta: "Bid Again",
        encourage: "There's still time to bid again and secure this piece.",
        footer: "The charity auction goes entirely to the mission of the Apostolate.",
      }
    : {
        subject: `Leilão Solidário: o seu lance foi ultrapassado — "${payload.itemTitle}"`,
        title: "O seu lance foi ultrapassado",
        preview: `O seu lance de ${formatCurrency(payload.yourBid)} foi superado.`,
        intro: "Alguém fez um lance mais alto no leilão solidário.",
        item: "Peça",
        yourBid: "O seu lance",
        newHigh: "Novo lance mais alto",
        minNow: "Lance mínimo agora",
        cta: "Licitar Novamente",
        encourage: "Ainda vai a tempo de voltar a licitar e garantir esta peça!",
        footer: "O leilão solidário reverte integralmente para a missão do Apostolado.",
      };
  const cur = isEn ? "en" : "pt";

  return {
    subject: t.subject,
    html: Layout({
      title: t.title,
      preview: t.preview,
      locale: cur,
      children: `
            ${Header({
        title: t.title,
        subtitle: payload.itemTitle,
      })}
            ${Section({
        children: `
                    ${Text(t.intro)}
                    ${Card({
          children: `
                            ${InfoRow({ label: t.item, value: payload.itemTitle })}
                            ${InfoRow({ label: t.yourBid, value: formatCurrency(payload.yourBid, "EUR", cur) })}
                            ${InfoRow({ label: t.newHigh, value: `<span style="color:${COLORS.error};font-weight:bold;">${formatCurrency(payload.newBid, "EUR", cur)}</span>` })}
                            ${InfoRow({ label: t.minNow, value: formatCurrency(minNext, "EUR", cur), isLast: true })}
                        `,
        })}
                    ${Text(t.encourage)}
                    ${Button({ label: t.cta, url: payload.itemUrl })}
                    ${Text(t.footer, `text-align:center;font-size:13px;color:${COLORS.textLight};font-style:italic;`)}
                `,
      })}
`,
    }),
  };
};

export const renderAuctionWinnerEmail = (payload: AuctionWinnerInput) => ({
  subject: `Parabéns! Ganhou o leilão — "${payload.itemTitle}"`,
  html: Layout({
    title: "Leilão Vencido",
    preview: `Ganhou "${payload.itemTitle}" por ${formatCurrency(payload.winningBid / 100)}.`,
    children: `
            ${Header({
      title: "Parabéns, ganhou o leilão!",
      subtitle: payload.itemTitle,
    })}
            ${Section({
      children: `
                    ${Text(`Olá <strong>${payload.winnerName || "vencedor"}</strong>,`)}
                    ${Text(`O seu lance foi o vencedor no <strong>Leilão Solidário</strong>! A peça <strong>"${payload.itemTitle}"</strong> é sua.`)}
                    ${Card({
        children: `
                            ${InfoRow({ label: "Peça", value: payload.itemTitle })}
                            ${InfoRow({ label: "Lance vencedor", value: `<span style="color:${COLORS.success};font-weight:bold;">${formatCurrency(payload.winningBid / 100)}</span>` })}
                            ${InfoRow({ label: "Prazo para pagamento", value: `${payload.paymentDeadlineHours}h a partir de agora`, isLast: true })}
                        `,
      })}
                    <div style="background:${COLORS.primaryLight};border:1px solid ${COLORS.primary};border-radius:12px;padding:16px;margin-bottom:24px;">
                        <strong style="color:${COLORS.primary};display:block;margin-bottom:4px;">Importante</strong>
                        <span style="font-size:14px;color:${COLORS.text};">Tem <strong>${payload.paymentDeadlineHours} horas</strong> para completar o pagamento. Aceda à página do leilão para escolher o método de pagamento e fornecer a morada de envio.</span>
                    </div>
                    ${Button({ label: "Pagar Agora", url: payload.itemUrl })}
                    ${WhatsAppButton("pt")}
                    ${Text(`Se precisar de ajuda com o pagamento, contacte-nos pelo ${contactWa} ou por ${contactMail}.`, `text-align:center;font-size:13px;color:${COLORS.textLight};`)}
                    ${Text("Obrigado por participar no leilão solidário. A sua contribuição faz a diferença!", `text-align:center;font-size:13px;color:${COLORS.textLight};font-style:italic;`)}
                `,
    })}
`,
  }),
});

export const renderAuctionAdminNotificationEmail = (
  payload: AuctionAdminNotificationInput,
) => ({
  subject: `Leilão terminado: "${payload.itemTitle}" — ${formatCurrency(payload.winningBid)} `,
  html: Layout({
    title: "Leilão Terminado",
    children: `
            ${Header({
      title: "Leilão Solidário Terminado",
      subtitle: payload.itemTitle,
    })}
            ${Section({
      children: `
                    ${Text("Um leilão solidário terminou com sucesso.")}
                    ${Card({
        children: `
                            ${InfoRow({ label: "Peça", value: payload.itemTitle })}
                            ${InfoRow({ label: "Vencedor", value: payload.winnerEmail })}
                            ${InfoRow({ label: "Lance vencedor", value: formatCurrency(payload.winningBid) })}
                            ${InfoRow({ label: "Total de lances", value: payload.totalBids, isLast: true })}
                        `,
      })}
                    ${Button({ label: "Ver no Admin", url: `${APP_URL}/admin/leilao` })}
                `,
    })}
`,
  }),
});

export const renderAuctionPaymentConfirmedEmail = (
  payload: AuctionPaymentConfirmedInput,
) => ({
  subject: `Pagamento Confirmado: "${payload.itemTitle}"`,
  html: Layout({
    title: "Pagamento de Leilão Confirmado",
    preview: `Recebemos o pagamento de ${formatCurrency(payload.winningBid / 100)} referente à peça "${payload.itemTitle}".`,
    children: `
            ${Header({
      title: "Pagamento Confirmado",
      subtitle: payload.itemTitle,
    })}
            ${Section({
      children: `
                    ${Text(`Olá <strong>${payload.winnerName || "vencedor"}</strong>,`)}
                    ${Text(`Confirmamos a receção do seu pagamento para o <strong>Leilão Solidário</strong> da peça <strong>"${payload.itemTitle}"</strong>. O seu envio será preparado em breve.`)}
                    ${Card({
        children: `
                            ${InfoRow({ label: "Referência", value: payload.itemTitle })}
                            ${InfoRow({ label: "Valor Pago", value: `<span style="color:${COLORS.success};font-weight:bold;">${formatCurrency(payload.winningBid / 100)}</span>` })}
                            ${InfoRow({ label: "Data", value: formatDate(payload.paidAt) })}
                            ${payload.paymentReference ? InfoRow({ label: "Ref. Pagamento", value: payload.paymentReference }) : ""}
                            ${InfoRow({ label: "Método / Agente", value: payload.paymentMethod, isLast: true })}
                        `,
      })}
                    ${Text("Em nome do Apostolado de Garabandal, agradecemos a sua generosa contribuição! Entraremos em contacto brevemente, ou receberá o tracking assim que for expedido.", `text-align:center;font-size:13px;color:${COLORS.textLight};font-style:italic;`)}
                `,
    })}
`,
  }),
});

export const renderBookingAdminNotification = (
  payload: BookingAdminNotificationInput,
) => ({
  subject: `Nova inscrição recebida: ${payload.pilgrimageName} (${payload.numberOfPilgrims} peregrinos)`,
  html: Layout({
    title: "Nova Inscrição Recebida",
    children: `
            ${Header({
      title: "Nova Inscrição Registada",
      subtitle: payload.pilgrimageName,
    })}
            ${Section({
      children: `
                    ${Text("Foi registada uma nova inscrição numa peregrinação.")}
                    ${Card({
        children: `
                            ${InfoRow({ label: "Referência da Inscrição", value: payload.bookingId })}
                            ${InfoRow({ label: "Peregrinação", value: payload.pilgrimageName })}
                            ${InfoRow({ label: "Cliente", value: payload.customerName })}
                            ${InfoRow({ label: "Email", value: payload.customerEmail })}
                            ${InfoRow({ label: "Nº de Peregrinos", value: payload.numberOfPilgrims })}
                            ${InfoRow({ label: "Valor Total", value: formatCurrency(payload.totalAmount) })}
                            ${InfoRow({ label: "Método de Pagamento", value: payload.paymentMethod, isLast: true })}
                        `,
      })}
                    ${Button({ label: "Ver Detalhes da Inscrição", url: APP_URL + "/admin/inscricoes" })}
                `,
    })}
`,
  }),
});

export const renderAuthMagicLinkEmail = (payload: { magicLink: string; locale?: EmailLocale }) => {
  const locale: EmailLocale = payload.locale === 'en' ? 'en' : 'pt';
  const isEn = locale === 'en';

  return {
    subject: isEn ? 'Access link to your account' : 'Link de acesso à sua conta',
    html: Layout({
      title: isEn ? 'Secure Account Access' : 'Acesso seguro à sua conta',
      preview: isEn ? 'Use this secure link to sign in.' : 'Use este link seguro para entrar na sua conta.',
      locale,
      children: `
        ${Header({
          title: isEn ? 'Access your account' : 'Aceda à sua conta',
          subtitle: isEn ? 'Secure sign-in link' : 'Link seguro de entrada',
        })}
        ${Section({
          children: `
            ${Text(isEn ? 'Click the button below to sign in securely.' : 'Clique no botão abaixo para entrar em segurança.')}
            ${Button({ label: isEn ? 'Sign In' : 'Entrar na conta', url: payload.magicLink })}
            ${Text(isEn ? 'If you did not request this access, you can ignore this email.' : 'Se não solicitou este acesso, pode ignorar este email.', `font-size:13px;color:${COLORS.textLight};`)}
          `,
        })}
      `,
    }),
  };
};

export const renderMemberAreaMagicLinkEmail = (payload: {
  memberName?: string | null;
  memberNumber?: number | string | null;
  magicLink: string;
  locale?: EmailLocale;
}) => {
  const locale: EmailLocale = payload.locale === 'en' ? 'en' : 'pt';
  const isEn = locale === 'en';
  const memberName = payload.memberName?.trim() || (isEn ? 'member' : 'membro');
  const firstName = memberName.split(/\s+/)[0] || memberName;

  return {
    subject: isEn
      ? `${firstName}, enter your member area`
      : `${firstName}, aceda à sua área de membro`,
    html: Layout({
      title: isEn ? 'Member Area Access' : 'Acesso à Área de Membro',
      preview: isEn
        ? 'Use this secure button to enter your member area directly.'
        : 'Use este botão seguro para entrar diretamente na sua área de membro.',
      locale,
      children: `
        ${Header({
          title: isEn ? 'Your member area is ready' : 'A sua área de membro está pronta',
          subtitle: isEn ? 'A place of prayer, formation and membership' : 'Um lugar de oração, formação e vida de membro',
          category: isEn ? 'Member Area' : 'Área de Membro',
        })}
        ${Section({
          children: `
            ${Text(isEn ? `Hello <strong>${memberName}</strong>,` : `Olá <strong>${memberName}</strong>,`)}
            ${Text(isEn
              ? 'Your membership in the Apostolate of Garabandal is active. We prepared this secure access so you can enter your member area directly and begin using what is available to you.'
              : 'A sua adesão ao Apostolado de Garabandal está ativa. Preparamos este acesso seguro para que você possa entrar diretamente na sua área de membro e começar a usar o que está disponível para você.'
            )}
            ${Card({
              children: `
                ${InfoRow({ label: isEn ? 'Member' : 'Membro', value: memberName })}
                ${InfoRow({ label: isEn ? 'Member No.' : 'Nº de Membro', value: payload.memberNumber || '-', isLast: true })}
              `,
            })}
            ${HeadingSmall(isEn ? 'Inside your member area' : 'Na sua área de membro')}
            ${Text(isEn
              ? 'You can watch the Holy Mass streamed from Garabandal, pray novenas, light a candle for your intentions, access exclusive formation content and documents, and follow your membership details.'
              : 'Pode acompanhar a Santa Missa transmitida de Garabandal, rezar novenas, acender uma vela pelas suas intenções, aceder a conteúdos e documentos exclusivos, e acompanhar os dados da sua adesão.'
            )}
            ${Button({ label: isEn ? 'Enter My Member Area' : 'Entrar na Minha Área de Membro', url: payload.magicLink })}
            ${Text(isEn
              ? 'This button is personal and secure. If it expires or does not open correctly, contact us and we will help you regain access.'
              : 'Este botão é pessoal e seguro. Se expirar ou não abrir corretamente, contacte-nos e ajudamos a recuperar o acesso.'
            , `font-size:13px;color:${COLORS.textLight};text-align:center;`)}
            ${Text(isEn
              ? 'May Our Lady of Garabandal accompany you in this mission of prayer.'
              : 'Que Nossa Senhora de Garabandal o acompanhe nesta missão de oração.'
            , `text-align:center;font-style:italic;margin-top:24px;color:${COLORS.textLight};`)}
          `,
        })}
      `,
    }),
  };
};

export const renderAuthRecoveryEmail = (payload: {
  recoveryLink: string;
  otpCode?: string | null;
  locale?: EmailLocale;
}) => {
  const locale: EmailLocale = payload.locale === 'en' ? 'en' : 'pt';
  const isEn = locale === 'en';
  const codeBlock = payload.otpCode
    ? Card({
        children: `
          ${Text(isEn ? 'If the button does not work, use this code on the recovery page:' : 'Se o botão não funcionar, introduza este código na página de recuperação:', `font-size:13px;color:${COLORS.textLight};margin-bottom:8px;`)}
          <p style="margin:0;font-size:30px;font-weight:800;letter-spacing:8px;color:${COLORS.text};font-family:'Courier New',monospace;text-align:center;">${payload.otpCode}</p>
        `,
      })
    : '';

  return {
    subject: isEn ? 'Recover your account password' : 'Recuperação de password da sua conta',
    html: Layout({
      title: isEn ? 'Password Recovery' : 'Recuperar password',
      preview: isEn ? 'Set a new password securely.' : 'Defina uma nova password em segurança.',
      locale,
      children: `
        ${Header({
          title: isEn ? 'Recover your password' : 'Recuperar password',
          subtitle: isEn ? 'Secure account access' : 'Acesso seguro à conta',
        })}
        ${Section({
          children: `
            ${Text(isEn ? 'Click the button below to set a new password securely.' : 'Clique no botão abaixo para definir uma nova password em segurança.')}
            ${Button({ label: isEn ? 'Set New Password' : 'Definir nova password', url: payload.recoveryLink })}
            ${codeBlock}
            ${Text(isEn ? 'If you did not request this recovery, you can ignore this email.' : 'Se não solicitou esta recuperação, pode ignorar este email.', `font-size:13px;color:${COLORS.textLight};`)}
          `,
        })}
      `,
    }),
  };
};

export const renderBookingAccessLinkEmail = (payload: {
  accessLink: string;
  pilgrimageName?: string | null;
  locale?: EmailLocale;
}) => {
  const locale: EmailLocale = payload.locale === 'en' ? 'en' : 'pt';
  const isEn = locale === 'en';
  const title = payload.pilgrimageName
    ? isEn
      ? `Access your registration - ${payload.pilgrimageName}`
      : `Acesso à sua inscrição - ${payload.pilgrimageName}`
    : isEn
      ? 'Access your registration'
      : 'Acesso à sua inscrição';

  return {
    subject: title,
    html: Layout({
      title,
      preview: isEn ? 'Open your pilgrimage registration securely.' : 'Abra a sua inscrição de peregrinação em segurança.',
      locale,
      children: `
        ${Header({
          title: isEn ? 'Your registration link' : 'O seu link de inscrição',
          subtitle: payload.pilgrimageName || (isEn ? 'Pilgrimage registration' : 'Inscrição de peregrinação'),
        })}
        ${Section({
          children: `
            ${Text(isEn ? 'Use the button below to open your registration with secure access.' : 'Use o botão abaixo para abrir a sua inscrição com acesso seguro.')}
            ${Button({ label: isEn ? 'View My Registration' : 'Ver a minha inscrição', url: payload.accessLink })}
            ${Text(isEn ? 'If you did not request this access, you can ignore this email.' : 'Se não solicitou este acesso, pode ignorar este email.', `font-size:13px;color:${COLORS.textLight};`)}
          `,
        })}
      `,
    }),
  };
};

export const renderAdminBankTransferAlertEmail = (payload: {
  customerName: string;
  customerEmail: string;
  pilgrimageName: string;
  totalAmount: number;
  numberOfPilgrims: number;
  adminUrl: string;
}) => ({
  subject: `Nova transferência bancária — ${payload.customerName} (${payload.pilgrimageName})`,
  html: Layout({
    title: 'Nova Transferência Bancária',
    preview: 'Uma inscrição foi feita por transferência bancária e precisa de validação manual.',
    children: `
      ${Header({
        title: 'Nova transferência bancária',
        subtitle: payload.pilgrimageName,
        category: 'Admin',
      })}
      ${Section({
        children: `
          ${Text('Um peregrino efetuou uma inscrição via <strong>transferência bancária</strong>. Verifique se o dinheiro entrou na conta e confirme o pagamento manualmente no painel.')}
          ${Card({
            children: `
              ${InfoRow({ label: 'Peregrino', value: payload.customerName })}
              ${InfoRow({ label: 'Email', value: payload.customerEmail })}
              ${InfoRow({ label: 'Peregrinação', value: payload.pilgrimageName })}
              ${InfoRow({ label: 'N.º Peregrinos', value: payload.numberOfPilgrims })}
              ${InfoRow({ label: 'Valor Total', value: formatCurrency(payload.totalAmount), isLast: true })}
            `,
          })}
          ${Button({ label: 'Ir para o Painel de Admin', url: payload.adminUrl })}
        `,
      })}
    `,
  }),
});

export const renderVolunteerApplicationEmail = (payload: {
  memberName?: string | null;
  memberEmail?: string | null;
  memberPhone?: string | null;
  numeroSocio?: number | null;
  linguas?: string[];
  disponibilidade?: string | null;
  esteveGarabandal?: string | null;
  condicaoFisica?: string | null;
  motivacao?: string | null;
  adminUrl: string;
}) => ({
  subject: `Nova candidatura de voluntariado — ${payload.memberName || payload.memberEmail || 'membro'}`,
  html: Layout({
    title: 'Nova candidatura de voluntariado',
    preview: 'Um membro candidatou-se para apoio ao peregrino em Garabandal.',
    children: `
      ${Header({
        title: 'Nova candidatura de apoio ao peregrino',
        subtitle: 'Voluntariado em Garabandal',
        category: 'Admin',
      })}
      ${Section({
        children: `
          ${Text('Foi submetida uma nova candidatura para o grupo de voluntariado de apoio ao peregrino em Garabandal.')}
          ${Card({
            children: `
              ${InfoRow({ label: 'Membro', value: payload.memberName || '-' })}
              ${InfoRow({ label: 'N.º de membro', value: payload.numeroSocio || '-' })}
              ${InfoRow({ label: 'Email', value: payload.memberEmail || '-' })}
              ${InfoRow({ label: 'Telefone', value: payload.memberPhone || '-' })}
              ${InfoRow({ label: 'Línguas', value: payload.linguas?.length ? payload.linguas.join(', ') : '-' })}
              ${InfoRow({ label: 'Disponibilidade', value: payload.disponibilidade || '-' })}
              ${InfoRow({ label: 'Já esteve em Garabandal', value: payload.esteveGarabandal || '-' })}
              ${InfoRow({ label: 'Condição física', value: payload.condicaoFisica || '-' })}
              ${InfoRow({ label: 'Motivação', value: (payload.motivacao || '-').replace(/\n/g, '<br/>'), isLast: true })}
            `,
          })}
          ${Text('Comprometeu-se a participar nos dias de formação obrigatória e a usar o colete identificativo do Apostolado.')}
          ${Button({ label: 'Ver candidaturas no Admin', url: payload.adminUrl })}
        `,
      })}
    `,
  }),
});
