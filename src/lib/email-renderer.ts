import { Resend } from "resend";
import { APP_URL, ASSETS_URL } from "./config";

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
  bg: "#F8FAFC",
  white: "#FFFFFF",
  text: "#334155",
  textLight: "#64748B",
  heading: "#0F172A",
  primary: "#CA8A04", // Garabandal Gold
  primaryLight: "#FEFCE8",
  border: "#E2E8F0",
  success: "#16A34A",
  successBg: "#F0FDF4",
  error: "#DC2626",
  errorBg: "#FEF2F2",
  link: "#CA8A04",
};

const FONTS = {
  serif:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

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
<html lang="${locale === "en" ? "en" : "pt-BR"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.bg};font-family:${FONTS.sans};color:${COLORS.text};-webkit-font-smoothing:antialiased;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preview || title}
  </div>
  <div style="background:${COLORS.bg};width:100%;padding:40px 0;">
    <div style="max-width:600px;margin:0 auto;background:${COLORS.white};border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
      ${children}
      <div style="background:${COLORS.bg};padding:32px;text-align:center;color:${COLORS.textLight};font-size:13px;">
        <p style="margin:0 0 12px;">${title} • Apostolado de Garabandal</p>
        <p style="margin:0;font-weight:600;color:${COLORS.heading};">${locale === "en" ? "Uniting FAITH and HOPE." : "Unindo FÉ e ESPERANÇA."}</p>
        <p style="margin:12px 0 0;font-size:11px;opacity:0.7;">${locale === "en" ? "If you need help, simply reply to this email." : "Se precisar de ajuda, basta responder a este email."}</p>
        ${unsubscribeUrl ? `<p style="margin:16px 0 0;font-size:11px;opacity:0.7;">${locale === "en" ? `If you no longer wish to receive these emails, you can <a href="${unsubscribeUrl}" style="color:${COLORS.textLight};text-decoration:underline;">unsubscribe here</a>.` : `Se já não deseja receber estes emails, pode <a href="${unsubscribeUrl}" style="color:${COLORS.textLight};text-decoration:underline;">cancelar a subscrição aqui</a>.`}</p>` : ""}
      </div>
    </div>
  </div>
</body>
</html>
`;

const Header = ({
  title,
  subtitle,
  image = `${APP_URL}/images/nossasenhoragarabandal.jpg`,
}: {
  title: string;
  subtitle?: string;
  image?: string;
}) => `
<div style="background:linear-gradient(rgba(15,23,42,0.9), rgba(15,23,42,0.9)), url('${image}');background-size:cover;background-position:center;padding:48px 40px;text-align:center;">
    <div style="width:64px;height:64px;border-radius:9999px;margin:0 auto 24px;background:#ffffff;background-image:url('${APP_URL}/images/nossasenhoragarabandal.jpg');background-size:cover;background-position:center;box-shadow:0 4px 6px rgba(0,0,0,0.2);border:2px solid rgba(255,255,255,0.9);"></div>
    <h1 style="color:white;margin:0;font-family:${FONTS.serif};font-size:28px;line-height:1.3;letter-spacing:-0.5px;">${title}</h1>
    ${subtitle ? `<p style="color:#CBD5E1;margin:12px 0 0;font-size:16px;font-weight:400;">${subtitle}</p>` : ""}
</div>
`;

const Section = ({
  children,
  style = "",
}: {
  children: string;
  style?: string;
}) => `
<div style="padding:40px;font-size:16px;line-height:1.6;${style}">
    ${children}
</div>
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
    primary: `background:${COLORS.primary};color:${COLORS.white};border:none;`,
    secondary: `background:${COLORS.heading};color:${COLORS.white};border:none;`,
    outline: `background:transparent;color:${COLORS.primary};border:1px solid ${COLORS.primary};`,
  };
  return `
    <div style="text-align:center;margin:32px 0;">
        <a href="${url}" style="${styles[variant]}display:inline-block;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:bold;font-size:14px;text-transform:uppercase;letter-spacing:1px;transition:all 0.2s;">
            ${label}
        </a>
    </div>
    `;
};

const HeadingSmall = (text: string) => `
<h3 style="color:${COLORS.heading};font-size:18px;font-weight:700;margin:0 0 16px;font-family:${FONTS.serif};">${text}</h3>
`;

const Text = (text: string, style = "") => `
<p style="margin:0 0 16px;${style}">${text}</p>
`;

/* -------------------------------------------------------------------------- */
/*           MEMBERSHIP BENEFITS BLOCK (rich, image cards — email-safe)        */
/* -------------------------------------------------------------------------- */

// Uses .png/.jpg (not .webp) so cards render in Outlook too.
const BENEFIT_IMG = {
  archive: `${APP_URL}/images/igrejagarabandal.jpg`,
  videos: `${APP_URL}/images/multimedia_background.png`,
  books: `${APP_URL}/images/descontoslivros.png`,
  masses: `${APP_URL}/images/padrerezar.png`,
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
        'Hoje queremos convidá-lo a dar um passo a mais: <strong>tornar-se membro do Apostolado de Garabandal</strong> — fazer parte, de forma contínua, de uma família que reza e trabalha ao serviço desta mensagem. Eis um pouco do que o espera:',
      ];

  const cards = locale === 'en'
    ? benefitFeaturedCard({ img: BENEFIT_IMG.archive, badge: 'Golden Archive', title: 'Access to the Private Documentation', desc: 'Our most precious treasure: reserved access to the private Garabandal archive — documents, testimonies and historical records not shared publicly.' })
      + benefitImageCard({ img: BENEFIT_IMG.videos, eyebrow: 'Exclusive Content', title: 'Exclusive Videos', desc: 'Unlimited access to video content, documentaries and in-depth study materials on the Apparitions and Marian spirituality.' })
      + benefitImageCard({ img: BENEFIT_IMG.books, eyebrow: 'Online Store', title: '5% off Books', desc: 'A permanent direct discount across the entire official bookstore, to deepen your faith.' })
    : benefitFeaturedCard({ img: BENEFIT_IMG.archive, badge: 'Acervo de Ouro', title: 'Acesso à Documentação Privada', desc: 'O nosso tesouro mais precioso: acesso reservado ao arquivo privado de Garabandal — documentos, testemunhos e registos históricos que não são partilhados publicamente.' })
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
    ? offerHighlight({ eyebrow: 'Welcome gift · until 15 July', title: 'Become a member and receive €5 of store credit', sub: 'Annual membership is just €25/year' })
    : offerHighlight({ eyebrow: 'Oferta de boas-vindas · até 15 de julho', title: 'Torne-se membro e receba 5€ de saldo na Loja', sub: 'Anuidade de apenas 25€/ano' });

  const quote = locale === 'en'
    ? '<p style="margin:24px 0 0;font-size:15px;font-style:italic;color:#64748B;text-align:center;">"You must pray much, pray with faith and fervour." — Message of Garabandal</p>'
    : '<p style="margin:24px 0 0;font-size:15px;font-style:italic;color:#64748B;text-align:center;">"É preciso rezar muito, rezar com fé e fervor." — Mensagem de Garabandal</p>';

  return `${intro.map((p) => Text(p)).join('')}${cards}${checklist}${offer}${quote}`;
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
    subject: isEn ? `Apostolate Receipt - ${amountText}` : `Recibo Apostolado - ${amountText}`,
    html: Layout({
      title: isEn ? "Payment Receipt" : "Recibo de Pagamento",
      preview: isEn ? `Confirmation of your annual membership payment.` : `Confirmação do pagamento da sua anuidade.`,
      locale,
      children: `
                ${Header({
        title: isEn ? "Payment Confirmed" : "Pagamento Confirmado",
        subtitle: isEn ? "Thank you for your continued support." : "Obrigado pelo seu apoio contínuo.",
      })}
                ${Section({
        children: `
                        ${Text(isEn ? `Hello <strong>${memberLabel}</strong>,` : `Olá <strong>${memberLabel}</strong>,`)}
                        ${Text(isEn ? "We confirm receipt of your annual membership payment. Your contribution is essential to keeping the mission of Garabandal alive." : "Confirmamos a receção do pagamento da sua anuidade. A sua contribuição é essencial para manter viva a missão de Garabandal.")}
                        
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
                                ${InfoRow({ label: isEn ? "Member No." : "Nº Associado", value: payload.memberNumber || "-" })}
                                ${InfoRow({ label: isEn ? "Amount" : "Valor", value: amountText })}
                                ${InfoRow({ label: isEn ? "Method" : "Método", value: payload.paymentMethod })}
                                ${InfoRow({ label: isEn ? "Reference" : "Referência", value: payload.paymentReference || "-" })}
                                ${InfoRow({ label: isEn ? "Date" : "Data", value: formatDate(payload.paidAt, locale), isLast: true })}
                            `,
          })}
                        
                        ${Button({ label: isEn ? "Go to Member Area" : "Acessar Área de Membro", url: isEn ? `${APP_URL}/en/member` : `${APP_URL}/member` })}
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
                        ${Text("É com alegria que o acolhemos. A sua conta foi ativada com sucesso — está agora dentro de uma comunidade que partilha o amor por Nossa Senhora de Garabandal e pela sua mensagem.")}
                        ${Text("Com a sua conta pode:")}

                        <div style="display:grid;gap:12px;margin:24px 0;">
                            <div style="background:${COLORS.bg};padding:12px 16px;border-radius:8px;border-left:3px solid ${COLORS.primary};">✦ Inscrever-se facilmente em peregrinações</div>
                            <div style="background:${COLORS.bg};padding:12px 16px;border-radius:8px;border-left:3px solid ${COLORS.primary};">✦ Aceder à loja e à Biblioteca Digital</div>
                            <div style="background:${COLORS.bg};padding:12px 16px;border-radius:8px;border-left:3px solid ${COLORS.primary};">✦ Tornar-se membro e apoiar a missão</div>
                        </div>

                        ${Button({ label: "Aceder à Minha Conta", url: `${APP_URL}/login` })}
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
  const greetingPrefix = isEn ? 'Dear' : 'Estimado(a)';

  return {
    subject: isOverdue
      ? isEn ? 'Action required: membership annuity overdue' : 'Ação necessária: anuidade em atraso'
      : isEn ? 'Reminder: membership annuity renewal' : 'Lembrete: renovação da anuidade',
    html: Layout({
      title: isEn ? 'Membership Annuity Status' : 'Estado da Anuidade',
      locale,
      children: `
                ${Header({
        title: isOverdue
          ? isEn ? 'Annuity Overdue' : 'Anuidade em Atraso'
          : isEn ? 'Annuity Renewal' : 'Renovação de Anuidade',
        subtitle: isOverdue
          ? isEn ? 'Please regularise your status' : 'Regularize a sua situação'
          : isEn ? 'Keep your benefits active' : 'Mantenha os seus benefícios ativos',
      })}
                ${Section({
        children: `
                        ${Text(`${isEn ? 'Hello' : 'Olá'} <strong>${greetingPrefix} ${greetingName}</strong>,`)}
                        ${Text(
          isOverdue
            ? isEn
              ? 'Your annuity is pending. To keep your access active, we kindly ask you to regularise the payment.'
              : 'A sua anuidade encontra-se pendente. Para manter o acesso ativo, pedimos a regularização do pagamento.'
            : isEn
              ? 'This is a friendly reminder that your annual membership is due soon.'
              : 'Este é um lembrete amigável de que a sua anuidade anual vence em breve.',
        )}

                        ${Card({
          children: `
                                ${InfoRow({ label: isEn ? 'Member No.' : 'Nº Associado', value: payload.memberNumber || '-' })}
                                ${InfoRow({ label: isEn ? 'Due date' : 'Vencimento', value: formatDate(payload.nextQuotaDate, locale) })}
                                ${InfoRow({ label: 'Status', value: `<span style="color:${isOverdue ? COLORS.error : COLORS.primary};font-weight:bold;">${daysText}</span>`, isLast: true })}
                            `,
        })}

                        ${Button({ label: isEn ? 'Renew Now' : 'Renovar Agora', url: payload.membershipUrl || `${APP_URL}/member` })}
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
          'Verificámos que este valor ainda não foi registado. Se já efetuou o pagamento, pode entrar na sua inscrição e enviar o comprovativo.',
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
                        ${Text(isEn ? "We will keep this record for administrative and tax purposes, when applicable." : "Guardaremos este registo para efeitos administrativos e fiscais, quando aplicável.")}
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
                ${Header({ title: isEn ? "Your interest has been noted" : "O seu interesse foi registado", subtitle: "Apostolado de Garabandal" })}
                ${Section({
        children: `
                        ${Text(isEn ? `Hello <strong>${greetingPrefix}${firstName}</strong>,` : `Olá <strong>${greetingPrefix}${firstName}</strong>,`)}
                        ${Text(isEn
          ? "Your contact has been registered. When there are new dates, places or relevant opportunities, we will reach out to you directly — before the public announcement."
          : "O seu contacto foi registado. Quando existirem novas datas, vagas ou oportunidades relevantes, entraremos diretamente em contacto consigo — antes de anunciarmos ao público."
        )}
                        ${Text(isEn
          ? "In the meantime, you can browse the pilgrimages we currently have open. If you have any questions, simply reply to this email."
          : "Entretanto, pode ver as peregrinações que estão abertas. Se tiver alguma questão, basta responder a este email."
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
            ${Header({ title: "A sua inscrição ficou incompleta", subtitle: payload.pilgrimageName })}
            ${Section({
      children: `
                    ${Text(`Olá <strong>${firstName}</strong>,`)}
                    ${Text(`Iniciou a inscrição para <strong>${payload.pilgrimageName}</strong>, mas o processo ficou por concluir. As vagas são limitadas — e a sua pode ainda ser garantida.`)}
                    ${Text("Pode retomar exatamente onde ficou com um clique. Se encontrou alguma dificuldade, responda a este email e ajudamos.")}
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
        ? 'If you have any questions or feel ready to take the next step, simply reply to this email. We are here.'
        : 'Se tiver dúvidas ou sentir que está pronto para dar o próximo passo, basta responder a este email. Estamos aqui.'
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
  | 'abandoned_registration_1'
  | 'abandoned_registration_faq'
  | 'abandoned_registration_final'
  | 'waitlist_welcome'
  | 'waitlist_open_spot'
  | 'payment_support'
  | 'donation_thank_you'
  | 'donation_thank_you_story'
  | 'donor_to_member'
  | 'member_invitation'
  | 'membership_renewal'
  | 'member_referral_activation'
  | 'referral_activation'
  | 'share_mission'
  | 'member_welcome'
  | 'member_pray_intentions'
  | 'member_novena_invite'
  | 'member_learn_garabandal'
  | 'lead_to_member_welcome'
  | 'lead_to_member_followup';

export type MarketingTemplatePayload = {
  templateKey: string;
  name?: string | null;
  email?: string | null;
  language?: EmailLocale;
  pilgrimageName?: string | null;
  pilgrimageUrl?: string | null;
  bookingResumeUrl?: string | null;
  brochureUrl?: string | null;
  memberUrl?: string | null;
  donationUrl?: string | null;
  referralUrl?: string | null;
  recommendation?: string | null;
  subjectOverride?: string | null;
  bodyOverride?: string | null;
  unsubscribeUrl?: string | null;
};

type MarketingTemplateDefinition = {
  key: MarketingTemplateKey;
  name: string;
  category: 'Peregrinações' | 'Doações' | 'Membros' | 'Partilha' | 'Vida Espiritual';
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
  contentHtml?: (locale: EmailLocale) => string;
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

const localizeMarketingUrl = (url: string, locale: EmailLocale) => {
  if (locale !== 'en') return url;
  return url
    .replace(`${APP_URL}/peregrinacoes`, `${APP_URL}/en/pilgrimages`)
    .replace(`${APP_URL}/tornar-membro`, `${APP_URL}/en/become-member`)
    .replace(`${APP_URL}/sobre-nos`, `${APP_URL}/en/about`)
    .replace(`${APP_URL}/donations`, `${APP_URL}/en/donations`)
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
  const variables: Record<string, string> = {
    name: trimmedName || fallbackFullName,
    first_name: trimmedName ? firstName : fallbackFirstName,
    greeting,
    pilgrimage_name: payload.pilgrimageName || 'Garabandal',
    pilgrimage_url: payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    booking_resume_url: payload.bookingResumeUrl || payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    brochure_url: payload.brochureUrl || payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    member_url: payload.memberUrl || marketingUrl('/tornar-membro', payload),
    donation_url: payload.donationUrl || marketingUrl('/donations', payload),
    referral_url: payload.referralUrl || marketingUrl('/member', payload),
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
    defaultSubject: '{{first_name}}, o roteiro está consigo — falta um passo',
    previewText: 'Muitos dos nossos peregrinos começaram exatamente aqui. Veja datas e disponibilidade.',
    ctaLabel: 'Ver Datas e Reservar',
    ctaUrl: (payload) => payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    title: 'Uma peregrinação que pode mudar muito',
    subtitle: '{{pilgrimage_name}} — próximas datas',
    requiredVariables: ['name', 'pilgrimage_name', 'pilgrimage_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Pediu o roteiro de <strong>{{pilgrimage_name}}</strong> — e isso já diz algo. Muitas das pessoas que hoje viajam connosco começaram exatamente assim, com uma simples curiosidade que foi crescendo.',
      'As vagas são limitadas e acompanhadas pela nossa equipa para garantir uma experiência com espírito de oração, grupo e fé. Se sentiu que este pode ser o momento, ver as datas e disponibilidade é o passo mais natural agora.',
      'Se tiver alguma dúvida antes de decidir — sobre o programa, os valores, o alojamento, ou simplesmente se este caminho é para si — basta responder a este email. Estamos aqui.',
    ],
  },
  pilgrimage_testimony: {
    key: 'pilgrimage_testimony',
    name: 'Testemunho da peregrinação',
    category: 'Peregrinações',
    goal: 'Aumentar confiança e desejo espiritual.',
    defaultSubject: 'Garabandal não é uma viagem — é um encontro',
    previewText: 'Muitos peregrinos regressam com uma paz difícil de explicar. Veja a peregrinação.',
    ctaLabel: 'Descobrir a Peregrinação',
    ctaUrl: (payload) => payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    title: 'Uma experiência que transforma',
    subtitle: 'O que muitos vivem em Garabandal',
    requiredVariables: ['name', 'pilgrimage_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Muitos peregrinos partilham que chegam a Garabandal com o coração pesado e regressam com uma paz difícil de explicar. É um lugar pequeno e escondido — e, ainda assim, a mensagem de Nossa Senhora aqui tocou milhões de almas.',
      'As pessoas chegam com perguntas que nem conseguem formular. Encontram silêncio, oração, partilha entre irmãos na fé — e uma presença que tantos descrevem como inconfundível.',
      'Se sentiu que este caminho pode ser para si, veja o programa com calma. E se precisar de perceber melhor como tudo funciona antes de decidir, basta responder a este email.',
    ],
  },
  pilgrimage_faq_objections: {
    key: 'pilgrimage_faq_objections',
    name: 'Dúvidas comuns da peregrinação',
    category: 'Peregrinações',
    goal: 'Remover objeções antes da inscrição.',
    defaultSubject: '"Seria lindo ir, mas..." — vamos falar disso',
    previewText: 'Custo, alojamento, viagem, pagamento faseado — tudo respondido.',
    ctaLabel: 'Ver Detalhes e Esclarecer Dúvidas',
    ctaUrl: (payload) => payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    title: 'As dúvidas mais comuns antes de partir',
    subtitle: '{{pilgrimage_name}}',
    requiredVariables: ['name', 'pilgrimage_name', 'pilgrimage_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      '"Gostava muito de ir, mas não sei se consigo..." — reconhece este pensamento? É completamente normal querer ter tudo claro antes de avançar.',
      'As dúvidas mais frequentes — valor total, quartos individuais ou partilhados, viagem incluída, pagamento em prestações, cancelamento, quem acompanha o grupo — têm resposta na página da peregrinação.',
      'Se algo continuar em aberto, responda diretamente a este email. Queremos que decida com clareza, confiança e paz. Sem pressão de nenhum tipo.',
    ],
  },
  abandoned_registration_1: {
    key: 'abandoned_registration_1',
    name: 'Recuperação de inscrição',
    category: 'Peregrinações',
    goal: 'Recuperar inscrição iniciada e não concluída.',
    defaultSubject: '{{first_name}}, a sua vaga em {{pilgrimage_name}} ficou por confirmar',
    previewText: 'As vagas são limitadas — pode ainda retomar onde ficou.',
    ctaLabel: 'Retomar e Confirmar a Minha Vaga',
    ctaUrl: (payload) => payload.bookingResumeUrl || payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    title: 'A sua inscrição ficou incompleta',
    subtitle: '{{pilgrimage_name}}',
    requiredVariables: ['name', 'booking_resume_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Iniciou a inscrição para <strong>{{pilgrimage_name}}</strong>, mas o processo ficou por concluir. As vagas são limitadas — e a sua pode ainda ser garantida.',
      'Se foi uma simples interrupção, pode retomar exatamente onde ficou com um clique. Se encontrou alguma dificuldade com o pagamento, os dados ou a disponibilidade, responda a este email e ajudamos a resolver.',
    ],
  },
  abandoned_registration_faq: {
    key: 'abandoned_registration_faq',
    name: 'Recuperação com esclarecimento',
    category: 'Peregrinações',
    goal: 'Ajudar leads bloqueados por dúvidas.',
    defaultSubject: 'Ficou com alguma dúvida na inscrição, {{first_name}}?',
    previewText: 'Pagamento, quartos, viagem, documentos — estamos aqui para ajudar.',
    ctaLabel: 'Retomar a Inscrição',
    ctaUrl: (payload) => payload.bookingResumeUrl || payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    title: 'Pode ser mais simples do que parece',
    subtitle: 'Estamos aqui para ajudar',
    requiredVariables: ['name', 'booking_resume_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Quando uma inscrição fica a meio, quase sempre é por uma dúvida concreta: como pagar em prestações, quarto individual ou partilhado, viajar sozinho ou acompanhado, ou simplesmente dados em falta.',
      'Não precisa de resolver tudo sozinho. Pode responder diretamente a este email com a sua questão — temos toda a disponibilidade para ajudar. Se já está pronto para continuar, o botão abaixo leva-o de volta ao processo em segundos.',
    ],
  },
  abandoned_registration_final: {
    key: 'abandoned_registration_final',
    name: 'Último lembrete de inscrição',
    category: 'Peregrinações',
    goal: 'Criar urgência moderada antes de encerrar follow-up.',
    defaultSubject: '{{first_name}}, um último convite sobre a sua inscrição',
    previewText: 'Se este caminho ainda faz sentido para si, este é um bom momento.',
    ctaLabel: 'Concluir a Minha Inscrição',
    ctaUrl: (payload) => payload.bookingResumeUrl || payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    title: 'Um último convite, com todo o respeito',
    subtitle: '{{pilgrimage_name}}',
    requiredVariables: ['name', 'booking_resume_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Este é o último email que enviamos sobre a inscrição em <strong>{{pilgrimage_name}}</strong>. Se este não for o momento certo, ficamos por aqui com todo o respeito pela sua decisão — e estaremos sempre disponíveis quando quiser.',
      'Mas se este caminho ainda lhe faz sentido — e muitas vezes é quando menos esperamos que estas portas se abrem — pode concluir a inscrição com um clique. As vagas são limitadas e a equipa fica a aguardar, com alegria, a sua confirmação.',
    ],
  },
  waitlist_welcome: {
    key: 'waitlist_welcome',
    name: 'Boas-vindas à lista de espera',
    category: 'Peregrinações',
    goal: 'Confirmar interesse e manter contacto quente.',
    defaultSubject: '{{first_name}}, o seu interesse foi registado — ficamos atentos',
    previewText: 'Será dos primeiros a saber quando houver novas datas ou vagas.',
    ctaLabel: 'Ver Peregrinações Disponíveis',
    ctaUrl: (payload) => marketingUrl('/peregrinacoes', payload),
    title: 'Está na lista — avisamos quando houver vagas',
    subtitle: 'Apostolado de Garabandal',
    requiredVariables: ['name'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Confirmamos que o seu interesse ficou registado. Quando existirem novas datas, vagas ou peregrinações relacionadas, entraremos diretamente em contacto consigo — antes de anunciarmos ao público em geral.',
      'Entretanto, pode ver as peregrinações que estão abertas. E se tiver questões antes de qualquer vaga abrir, basta responder a este email.',
    ],
  },
  waitlist_open_spot: {
    key: 'waitlist_open_spot',
    name: 'Vaga disponível',
    category: 'Peregrinações',
    goal: 'Converter lista de espera quando há disponibilidade.',
    defaultSubject: '{{first_name}}, abriu uma vaga — veja antes que feche',
    previewText: 'Disponibilidade em {{pilgrimage_name}}. As vagas são muito limitadas.',
    ctaLabel: 'Ver Disponibilidade Agora',
    ctaUrl: (payload) => payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    title: 'Abriu uma vaga',
    subtitle: '{{pilgrimage_name}} — disponibilidade limitada',
    requiredVariables: ['name', 'pilgrimage_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Estamos a contactá-lo porque demonstrou interesse em peregrinações do Apostolado — e abriu agora uma vaga em <strong>{{pilgrimage_name}}</strong>.',
      'As vagas são poucas e preenchem rapidamente. Se esta data faz sentido para si, recomendamos ver os detalhes agora e avançar com a inscrição. Ficamos à sua disposição para qualquer ajuda necessária.',
    ],
  },
  payment_support: {
    key: 'payment_support',
    name: 'Apoio ao pagamento',
    category: 'Peregrinações',
    goal: 'Ajudar reservas com pagamentos pendentes.',
    defaultSubject: '{{first_name}}, podemos ajudar a concluir o pagamento',
    previewText: 'Um pagamento pendente — mas é simples de resolver. Ajudamos.',
    ctaLabel: 'Gerir a Minha Inscrição',
    ctaUrl: (payload) => payload.bookingResumeUrl || payload.pilgrimageUrl || marketingUrl('/peregrinacoes', payload),
    title: 'Pagamento por concluir',
    subtitle: '{{pilgrimage_name}}',
    requiredVariables: ['name', 'booking_resume_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Estamos a acompanhar a sua inscrição e notámos que ainda pode existir um pagamento ou comprovativo por registar. Não queremos que perca a vaga por uma questão técnica.',
      'Pode gerir tudo pela sua inscrição com um clique. Se já fez a transferência bancária, basta enviar o comprovativo e a equipa trata do resto. Se tiver qualquer dificuldade, responda diretamente a este email.',
    ],
  },
  donation_thank_you: {
    key: 'donation_thank_you',
    name: 'Obrigado pela doação',
    category: 'Doações',
    goal: 'Agradecer e abrir relação futura.',
    defaultSubject: '{{first_name}}, a sua doação chegou — e faz diferença real',
    previewText: 'Obrigado. Aqui fica o que o seu apoio torna concretamente possível.',
    ctaLabel: 'Conhecer a Missão',
    ctaUrl: (payload) => marketingUrl('/sobre-nos', payload),
    title: 'O seu apoio chegou — obrigado',
    subtitle: 'Apostolado de Garabandal',
    requiredVariables: ['name'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'A sua doação foi recebida — e queremos que saiba que não é apenas um número numa conta. É o que torna possível manter este apostolado ativo: peregrinações a Garabandal, conteúdos espirituais, acolhimento e a presença viva da mensagem de Nossa Senhora na língua portuguesa.',
      'Rezamos para que Nossa Senhora de Garabandal interceda por si e pela sua família. O seu gesto é um ato de fé concreto — e faz parte desta missão.',
    ],
  },
  donation_thank_you_story: {
    key: 'donation_thank_you_story',
    name: 'Impacto da doação',
    category: 'Doações',
    goal: 'Mostrar impacto e preparar próximo pedido.',
    defaultSubject: 'O que o seu apoio tornou possível',
    previewText: 'A sua generosidade tem um impacto concreto — veja aqui.',
    ctaLabel: 'Apoiar a Missão',
    ctaUrl: (payload) => payload.donationUrl || marketingUrl('/donations', payload),
    title: 'O seu apoio dá fruto visível',
    subtitle: 'Obrigado por caminhar connosco',
    requiredVariables: ['name', 'donation_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'O seu apoio ajuda a sustentar o que muitas vezes não se vê: a preparação de peregrinações, a criação de conteúdo espiritual, o acompanhamento de novos peregrinos e a manutenção desta presença digital ao serviço da mensagem de Garabandal.',
      'Se desejar continuar a apoiar esta missão — sabendo que cada contribuição tem um impacto real e concreto — deixamos abaixo uma forma simples e segura de o fazer. Deus lhe pague.',
    ],
  },
  donor_to_member: {
    key: 'donor_to_member',
    name: 'Doador para membro',
    category: 'Membros',
    goal: 'Converter doador em membro.',
    defaultSubject: '{{first_name}}, há um próximo passo para si nesta missão',
    previewText: 'Ser membro é mais do que apoiar — é fazer parte continuamente.',
    ctaLabel: 'Descobrir Como Ser Membro',
    ctaUrl: (payload) => payload.memberUrl || marketingUrl('/tornar-membro', payload),
    title: 'Caminhe mais perto da missão',
    subtitle: 'Convite especial para membro',
    requiredVariables: ['name', 'member_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Já demonstrou generosidade para com o Apostolado — e isso significa muito para toda a nossa comunidade. Gostaríamos de lhe apresentar um caminho ainda mais próximo: tornar-se membro.',
      'Como membro, a sua ligação à missão torna-se estável e regular, com acesso a conteúdos exclusivos e ao acompanhamento espiritual do Apostolado. É uma forma concreta de dizer "estou aqui" — não uma vez, mas continuamente, ao lado de todos os que partilham este amor por Garabandal.',
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
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Queremos convidá-lo a tornar-se membro do Apostolado — não apenas apoiar pontualmente, mas fazer parte de forma contínua desta missão ao serviço da mensagem de Garabandal.',
      'Como membro, recebe o diploma digital, acesso a conteúdos exclusivos e a satisfação de saber que a sua contribuição sustenta concretamente este trabalho. Pode ver como funciona com calma. Se tiver dúvidas, basta responder a este email.',
    ],
  },
  lead_to_member_welcome: {
    key: 'lead_to_member_welcome',
    name: 'Convite a membro — bónus de boas-vindas (5€)',
    category: 'Membros',
    goal: 'Converter leads, peregrinos antigos e doadores em membros, com bónus de 5€.',
    defaultSubject: '{{first_name}}, há um lugar guardado para si nesta missão',
    previewText: 'Fazer parte do Apostolado de Garabandal — com um gesto de gratidão até 15 de julho.',
    ctaLabel: 'Tornar-me Membro',
    ctaUrl: (payload) => payload.memberUrl || marketingUrl('/tornar-membro', payload),
    title: 'Há um lugar guardado para si',
    subtitle: 'Apostolado de Garabandal',
    requiredVariables: ['name', 'member_url'],
    contentHtml: (locale) => membershipWelcomeContent(locale),
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Em algum momento o seu coração aproximou-se de Garabandal — talvez por uma peregrinação, um pedido de oração, um donativo, ou simplesmente pela mensagem de Nossa Senhora. Acreditamos que não foi por acaso. Há caminhos que se abrem quando menos esperamos.',
      'Hoje queremos convidá-lo a dar um passo a mais: <strong>tornar-se membro do Apostolado de Garabandal</strong>. Não é apenas apoiar pontualmente — é fazer parte, de forma contínua, de uma família que reza e trabalha ao serviço desta mensagem.',
      '<strong>Como membro, passa a ter:</strong><br>🕊️&nbsp; A Santa Missa <strong>ao vivo</strong> desde Garabandal<br>📿&nbsp; As novenas e as <strong>velas acesas pelas suas intenções</strong><br>📖&nbsp; Conteúdos exclusivos e a Academia espiritual<br>🎓&nbsp; O seu diploma digital de membro<br>❤️&nbsp; A certeza de que a sua contribuição sustenta esta missão',
      'A anuidade é de apenas <strong>25€/ano</strong>. E, como sinal de gratidão, <strong>quem se tornar membro até 15 de julho recebe 5€ de saldo</strong> na nossa Loja Online — para um livro que alimente a sua fé.',
      '<em>"É preciso rezar muito, rezar com fé e fervor."</em> — Mensagem de Garabandal',
      'Se tiver qualquer dúvida, basta responder a este email. Estamos aqui — e rezamos por si.',
    ],
  },
  lead_to_member_followup: {
    key: 'lead_to_member_followup',
    name: 'Convite a membro — follow-up (intenção + prazo)',
    category: 'Membros',
    goal: 'Recuperar leads que não aderiram, com apelo à intenção e ao prazo do bónus.',
    defaultSubject: '{{first_name}}, pense numa só intenção que gostaria de ver rezada',
    previewText: 'Faltam poucos dias para o gesto de boas-vindas de 5€.',
    ctaLabel: 'Fazer Parte Agora',
    ctaUrl: (payload) => payload.memberUrl || marketingUrl('/tornar-membro', payload),
    title: 'Pense numa só intenção',
    subtitle: 'Um convite que fica de pé',
    requiredVariables: ['name', 'member_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Há poucos dias convidámo-lo a fazer parte do Apostolado. Talvez o momento não tenha sido o certo — compreendemos perfeitamente.',
      'Mas deixe-me pedir-lhe apenas isto: <strong>pense numa intenção</strong> que traz no coração — um familiar doente, uma decisão difícil, uma graça que espera. Como membro, essa intenção passa a ser levada às <strong>velas acesas em Garabandal</strong> e às <strong>novenas</strong> rezadas pela nossa comunidade. Não caminha sozinho.',
      'O gesto de boas-vindas — <strong>5€ de saldo na Loja</strong> ao tornar-se membro — termina a <strong>15 de julho</strong>. Quisemos avisá-lo a tempo.',
      'Seja qual for a sua decisão, fica na nossa oração.',
    ],
  },
  membership_renewal: {
    key: 'membership_renewal',
    name: 'Renovação de membro',
    category: 'Membros',
    goal: 'Recuperar membros pendentes ou expirados.',
    defaultSubject: '{{first_name}}, faltam poucos dias para manter o seu lugar',
    previewText: 'Renove a sua anuidade e continue a rezar e a caminhar connosco.',
    ctaLabel: 'Renovar a Minha Anuidade',
    ctaUrl: (payload) => payload.memberUrl || marketingUrl('/member/quota', payload),
    title: 'Mantenha o seu lugar nesta missão de oração',
    subtitle: 'Área de membro',
    requiredVariables: ['name', 'member_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'A sua anuidade de membro está prestes a vencer. Enquanto membro, tem acesso à Missa ao vivo de Garabandal, às novenas, às velas pelas suas intenções e a todo o conteúdo espiritual da sua área — e o seu apoio sustenta concretamente esta missão.',
      'Renovar leva menos de um minuto e mantém tudo isso ativo. É um gesto simples que diz muito: "continuo aqui, continuo a rezar, continuo a apoiar".',
      'Se já regularizou, ou se tiver qualquer dificuldade, basta responder a este email — estamos aqui para ajudar.',
    ],
  },
  member_referral_activation: {
    key: 'member_referral_activation',
    name: 'Ativar partilha de membro',
    category: 'Partilha',
    goal: 'Estimular o membro a convidar uma pessoa concreta que tem em mente.',
    defaultSubject: '{{first_name}}, há alguém que lhe vem ao pensamento?',
    previewText: 'Pense numa só pessoa que precisa de paz e fé. O seu convite pode chegar-lhe.',
    ctaLabel: 'Convidar essa Pessoa',
    ctaUrl: (payload) => payload.referralUrl || marketingUrl('/member', payload),
    title: 'Pense numa pessoa',
    subtitle: 'Um convite pessoal',
    requiredVariables: ['name', 'referral_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Pare por um instante e pense numa só pessoa — um familiar, um amigo, alguém que anda em busca de paz ou que atravessa um momento difícil. Muitas vezes já sabemos exatamente de quem se trata.',
      'O seu convite pode ser precisamente o que falta a essa pessoa para se aproximar de Nossa Senhora de Garabandal. E há um sinal de gratidão: quando ela se torna membro pelo seu convite, <strong>recebem ambos {{referral_reward}} de saldo</strong> para a Loja Online.',
      'O seu código de convite está pronto na sua área de membro. Convide hoje essa pessoa em quem pensou — pode mudar a vida dela.',
    ],
  },
  referral_activation: {
    key: 'referral_activation',
    name: 'Ativar convites',
    category: 'Partilha',
    goal: 'Estimular partilha através de convite.',
    defaultSubject: '{{first_name}}, convide um amigo e ganham ambos {{referral_reward}}',
    previewText: 'Uma partilha simples aproxima alguém da fé — e dá saldo aos dois.',
    ctaLabel: 'Abrir e Partilhar o Convite',
    ctaUrl: (payload) => payload.referralUrl || marketingUrl('/member', payload),
    title: 'Um convite simples — com um presente para os dois',
    subtitle: 'Levar Garabandal a mais pessoas',
    requiredVariables: ['name', 'referral_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Se conhece alguém que esteja à procura de algo mais profundo — paz, fé, esperança, um caminho espiritual — a mensagem de Garabandal pode ser exatamente o que essa pessoa precisa de encontrar.',
      'Quando essa pessoa se torna membro através do seu convite, <strong>recebem ambos {{referral_reward}} de saldo</strong> para a Loja Online. É a nossa forma de agradecer a quem ajuda a missão a crescer — e quanto mais convidar, mais saldo acumula.',
      'Não é necessário explicar tudo — basta partilhar o seu link de convite e deixar que a missão fale por si.',
    ],
  },
  share_mission: {
    key: 'share_mission',
    name: 'Partilhar missão',
    category: 'Partilha',
    goal: 'Reforçar partilha depois do primeiro convite.',
    defaultSubject: 'Obrigado, {{first_name}} — continue a convidar e a ganhar saldo',
    previewText: 'Cada amigo que se torna membro dá {{referral_reward}} de saldo a ambos.',
    ctaLabel: 'Partilhar Novamente',
    ctaUrl: (payload) => payload.referralUrl || marketingUrl('/member', payload),
    title: 'A missão cresce porque partilhou',
    subtitle: 'Obrigado por caminhar connosco',
    requiredVariables: ['name', 'referral_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Obrigado por partilhar o Apostolado. Muitas pessoas chegam ao Garabandal porque alguém — como você — teve a generosidade e a coragem de dizer "isto pode ser para ti".',
      'O seu convite continua ativo: por <strong>cada amigo que se torne membro, recebem ambos {{referral_reward}} de saldo</strong> para a Loja Online. O saldo acumula a cada convite aceite — e pode ser trocado por livros, artigos ou doações.',
      'Se sentir novamente vontade de partilhar, o seu código está à espera na área de membro. Cada partilha é um ato de apostolado concreto — com um valor que vai muito além do que podemos medir.',
    ],
  },
  member_welcome: {
    key: 'member_welcome',
    name: 'Acolhimento de novo membro',
    category: 'Vida Espiritual',
    goal: 'Acolher o novo membro e apresentar a área como lugar de oração.',
    defaultSubject: '{{first_name}}, seja bem-vindo a esta missão de oração',
    previewText: 'O seu lugar de oração e recolhimento já está pronto.',
    ctaLabel: 'Entrar na Minha Área',
    ctaUrl: (payload) => marketingUrl('/member', payload),
    title: 'Bem-vindo ao Apostolado de Garabandal',
    subtitle: 'A sua área de membro está pronta',
    requiredVariables: ['name', 'member_area_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'É com alegria que o acolhemos no Apostolado de Garabandal. A partir de hoje, faz parte de uma comunidade unida pela oração e pela mensagem de Nossa Senhora.',
      'Na sua área de membro encontra um lugar de recolhimento: para rezar, entregar as suas intenções e aprofundar a sua fé — incluindo a Santa Missa transmitida ao vivo da igreja de Garabandal.',
      'Que Nossa Senhora de Garabandal o acompanhe neste caminho. Estamos aqui para o que precisar — basta responder a este email.',
    ],
  },
  member_pray_intentions: {
    key: 'member_pray_intentions',
    name: 'Entregar intenções',
    category: 'Vida Espiritual',
    goal: 'Convidar o membro a rezar e entregar as suas intenções.',
    defaultSubject: 'Entregue as suas intenções a Nossa Senhora',
    previewText: 'Acenda uma vela e reze pelas suas intenções, a partir da sua área.',
    ctaLabel: 'Acender uma Vela e Rezar',
    ctaUrl: (payload) => marketingUrl('/member/velas', payload),
    title: 'As suas intenções nas mãos de Nossa Senhora',
    subtitle: 'Um momento de oração',
    requiredVariables: ['name', 'candles_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Todos carregamos intenções no coração — por quem amamos, por uma graça, por uma cura. Em Garabandal, Nossa Senhora pediu-nos que rezássemos com confiança.',
      'Na sua área de membro pode <strong>acender uma vela</strong> que fica a arder pelas suas intenções, e rezar com as orações que ali encontra. É um gesto simples, mas cheio de fé.',
      'Reserve um momento de silêncio e entregue a Nossa Senhora aquilo que traz no coração.',
    ],
  },
  member_novena_invite: {
    key: 'member_novena_invite',
    name: 'Convite a novena',
    category: 'Vida Espiritual',
    goal: 'Convidar o membro a começar uma novena.',
    defaultSubject: '{{first_name}}, reze uma novena pelas suas intenções',
    previewText: 'Nove dias de oração para confiar as suas intenções a Nossa Senhora.',
    ctaLabel: 'Começar uma Novena',
    ctaUrl: (payload) => marketingUrl('/member/novenas', payload),
    title: 'Nove dias de oração perseverante',
    subtitle: 'Comece uma novena',
    requiredVariables: ['name', 'novenas_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Uma novena são nove dias de oração perseverante — um caminho simples e poderoso para confiar as suas intenções a Nossa Senhora de Garabandal.',
      'Pode começar hoje, ao seu ritmo, a partir da sua área de membro. Cada dia, uma oração; cada dia, um passo mais perto.',
      'Deixe que estes nove dias sejam um tempo de paz e de entrega. Nossa Senhora escuta sempre.',
    ],
  },
  member_learn_garabandal: {
    key: 'member_learn_garabandal',
    name: 'Conhecer Garabandal',
    category: 'Vida Espiritual',
    goal: 'Convidar o membro a aprofundar a mensagem e, se quiser, partilhar.',
    defaultSubject: 'Venha conhecer Garabandal mais de perto',
    previewText: 'Vídeos, cursos e a história das aparições, na sua área de membro.',
    ctaLabel: 'Aprender sobre Garabandal',
    ctaUrl: (payload) => marketingUrl('/member/academy', payload),
    title: 'A mensagem de Garabandal, mais perto de si',
    subtitle: 'Aprofunde a sua fé',
    requiredVariables: ['name', 'learn_url'],
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'A mensagem de Garabandal é profunda e ainda pouco conhecida. Na sua área de membro tem <strong>vídeos, cursos e a história das aparições</strong> para aprofundar tudo o que Nossa Senhora veio dizer.',
      'Pode ver ao seu ritmo, um pouco de cada vez. Cada vídeo, cada testemunho, cada documento é um convite a conhecer melhor este lugar e a sua mensagem.',
      'Que cada passo o aproxime mais do coração da mensagem — e de Nossa Senhora.',
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
      'If you have any questions before deciding — about the programme, costs, accommodation, or simply whether this path is right for you — just reply to this email. We are here.',
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
      'If you feel this path may be for you, review the programme at your own pace. And if you need to understand more before deciding, simply reply to this email.',
    ],
  },
  pilgrimage_faq_objections: {
    goal: 'Answer common questions before registration.',
    defaultSubject: '"I\'d love to go, but..." — let\'s talk about it',
    previewText: 'Cost, accommodation, travel, payment plans — all answered.',
    ctaLabel: 'View Details and Get Answers',
    title: 'The most common questions before departing',
    subtitle: '{{pilgrimage_name}}',
    paragraphs: [
      'Hello <strong>{{first_name}}</strong>,',
      '"I\'d really love to go, but I\'m not sure if..." — do you recognise this thought? It is completely normal to want clarity before moving forward.',
      'The most common questions — total cost, single or shared rooms, travel included, instalment payments, cancellation, who accompanies the group — are all answered on the pilgrimage page.',
      'If anything is still unclear, reply directly to this email. We want you to decide with clarity, confidence and peace. No pressure of any kind.',
    ],
  },
  abandoned_registration_1: {
    goal: 'Recover a started but unfinished pilgrimage registration.',
    defaultSubject: '{{first_name}}, your spot in {{pilgrimage_name}} is not yet confirmed',
    previewText: 'Places are limited — you can still resume where you left off.',
    ctaLabel: 'Resume and Confirm My Spot',
    title: 'Your registration was left unfinished',
    subtitle: '{{pilgrimage_name}}',
    paragraphs: [
      'Hello <strong>{{first_name}}</strong>,',
      'You started registering for <strong>{{pilgrimage_name}}</strong>, but the process was not completed. Places are limited — and yours can still be secured.',
      'If you were simply interrupted, you can resume exactly where you left off with one click. If you ran into any difficulty with payment, details or availability, reply to this email and we will help resolve it.',
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
      'You do not need to work it out alone. Reply directly to this email with your question — we are fully available to help. If you are already ready to continue, the button below takes you back to the process in seconds.',
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
    defaultSubject: '{{first_name}}, your interest has been registered — we are watching',
    previewText: 'You will be among the first to know when new dates or places open.',
    ctaLabel: 'View Available Pilgrimages',
    title: 'You are on the list — we will alert you when places open',
    subtitle: 'Apostolate of Garabandal',
    paragraphs: [
      'Hello <strong>{{first_name}}</strong>,',
      'We confirm that your interest has been registered. When there are new dates, places or related pilgrimages, we will contact you directly — before we announce to the general public.',
      'In the meantime, you can view the pilgrimages that are currently open. And if you have questions before any place becomes available, simply reply to this email.',
    ],
  },
  waitlist_open_spot: {
    goal: 'Convert waiting-list contacts when availability opens.',
    defaultSubject: '{{first_name}}, a place just opened — see it before it closes',
    previewText: 'Availability in {{pilgrimage_name}}. Places are very limited.',
    ctaLabel: 'View Availability Now',
    title: 'A place has opened',
    subtitle: '{{pilgrimage_name}} — limited availability',
    paragraphs: [
      'Hello <strong>{{first_name}}</strong>,',
      'We are contacting you because you showed interest in Apostolate pilgrimages — and a place has now opened in <strong>{{pilgrimage_name}}</strong>.',
      'Places are few and fill quickly. If this date makes sense for you, we recommend viewing the details now and moving forward with registration. We are here for any help you may need.',
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
      'You can manage everything from your registration with one click. If you have already made the bank transfer, simply send the proof and the team will take care of the rest. If you have any difficulty, reply directly to this email.',
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
    defaultSubject: 'What your support made possible',
    previewText: 'Your generosity has a concrete impact — see it here.',
    ctaLabel: 'Support the Mission',
    title: 'Your support bears visible fruit',
    subtitle: 'Thank you for walking with us',
    paragraphs: [
      'Hello <strong>{{first_name}}</strong>,',
      'Your support helps sustain what is often unseen: the preparation of pilgrimages, the creation of spiritual content, the accompaniment of new pilgrims, and the ongoing digital presence serving the message of Garabandal.',
      'If you would like to continue supporting this mission — knowing that every contribution has a real and concrete impact — below is a simple and secure way to do so. God reward you.',
    ],
  },
  donor_to_member: {
    goal: 'Convert a donor into a member.',
    defaultSubject: '{{first_name}}, there is a next step for you in this mission',
    previewText: 'Being a member is more than supporting — it is belonging.',
    ctaLabel: 'Discover How to Become a Member',
    title: 'Walk closer to the mission',
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
      'As a member, you receive the digital certificate, access to exclusive content, and the knowledge that your regular contribution sustains this work concretely. You can review everything at your own pace. If you have any questions, simply reply to this email.',
    ],
  },
  lead_to_member_welcome: {
    goal: 'Convert leads, past pilgrims and donors into members, with a €5 welcome bonus.',
    defaultSubject: '{{first_name}}, there is a place kept for you in this mission',
    previewText: 'Become part of the Garabandal Apostolate — with a token of gratitude until 15 July.',
    ctaLabel: 'Become a Member',
    title: 'There is a place kept for you',
    subtitle: 'Garabandal Apostolate',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'At some point your heart drew close to Garabandal — perhaps through a pilgrimage, a prayer request, a donation, or simply through Our Lady\'s message. We believe it was not by chance. Some paths open when we least expect them.',
      'Today we would like to invite you to take one step further: to <strong>become a member of the Garabandal Apostolate</strong>. It is not only about giving once — it is about belonging, continuously, to a family that prays and works in the service of this message.',
      '<strong>As a member, you receive:</strong><br>🕊️&nbsp; The <strong>live</strong> Holy Mass from Garabandal<br>📿&nbsp; The novenas and <strong>candles lit for your intentions</strong><br>📖&nbsp; Exclusive content and the spiritual Academy<br>🎓&nbsp; Your digital membership diploma<br>❤️&nbsp; The assurance that your contribution sustains this mission',
      'Annual membership is just <strong>€25/year</strong>. And as a token of gratitude, <strong>everyone who becomes a member by 15 July receives €5 of store credit</strong> in our Online Store — for a book to nourish your faith.',
      '<em>"You must pray much, pray with faith and fervour."</em> — Message of Garabandal',
      'If you have any questions, simply reply to this email. We are here — and we pray for you.',
    ],
  },
  lead_to_member_followup: {
    goal: 'Recover leads who did not join, appealing to a prayer intention and the bonus deadline.',
    defaultSubject: '{{first_name}}, think of one intention you would like to see prayed for',
    previewText: 'Only a few days left for the €5 welcome gift.',
    ctaLabel: 'Join Now',
    title: 'Think of one intention',
    subtitle: 'An invitation that still stands',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'A few days ago we invited you to become part of the Apostolate. Perhaps the timing was not right — we completely understand.',
      'But let me ask you just this: <strong>think of one intention</strong> you carry in your heart — a sick relative, a difficult decision, a grace you are hoping for. As a member, that intention is brought to the <strong>candles lit in Garabandal</strong> and the <strong>novenas</strong> prayed by our community. You do not walk alone.',
      'The welcome gift — <strong>€5 store credit</strong> when you become a member — ends on <strong>15 July</strong>. We wanted to let you know in time.',
      'Whatever you decide, you remain in our prayers.',
    ],
  },
  membership_renewal: {
    goal: 'Recover pending or expired members.',
    defaultSubject: '{{first_name}}, just a few days left to keep your place',
    previewText: 'Renew your membership and keep praying and walking with us.',
    ctaLabel: 'Renew My Membership',
    title: 'Keep your place in this mission of prayer',
    subtitle: 'Member area',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Your membership is about to expire. As a member, you have access to the live Mass from Garabandal, the novenas, candles for your intentions and all the spiritual content in your area — and your support sustains this mission in a very concrete way.',
      'Renewing takes less than a minute and keeps all of this active. It is a simple gesture that says a great deal: "I am still here, I am still praying, I am still supporting".',
      'If you have already renewed, or if you have any difficulty, simply reply to this email — we are here to help.',
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
    defaultSubject: '{{first_name}}, invite a friend and you both get {{referral_reward}}',
    previewText: 'A simple share brings someone closer to faith — and rewards you both.',
    ctaLabel: 'Open and Share the Invitation',
    title: 'A simple invitation — with a gift for both',
    subtitle: 'Bringing Garabandal to more people',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'If you know someone searching for something deeper — peace, faith, hope, a spiritual path — the message of Garabandal may be exactly what they need to find.',
      'When that person becomes a member through your invitation, <strong>you both receive {{referral_reward}} in store credit</strong> for the Online Store. It is our way of thanking those who help the mission grow — and the more you invite, the more credit you build up.',
      'There is no need to explain everything — just share your invite link and let the mission speak for itself.',
    ],
  },
  share_mission: {
    goal: 'Reinforce sharing after the first invitation.',
    defaultSubject: 'Thank you, {{first_name}} — keep inviting and earning credit',
    previewText: 'Every friend who becomes a member gives {{referral_reward}} in credit to both of you.',
    ctaLabel: 'Share Again',
    title: 'The mission grows because you shared',
    subtitle: 'Thank you for walking with us',
    paragraphs: [
      '<strong>{{greeting}}</strong>,',
      'Thank you for sharing the Apostolate. Many people arrive at Garabandal because someone — like you — had the generosity and courage to say "this might be for you".',
      'Your invitation remains active: for <strong>every friend who becomes a member, you both receive {{referral_reward}} in store credit</strong> for the Online Store. The credit adds up with each accepted invite — and can be exchanged for books, items or donations.',
      'If you feel moved to share again, your code is waiting in your member area. Each share is a concrete act of apostolate — with a value that reaches far beyond what we can measure.',
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
      'May Our Lady of Garabandal accompany you on this path. We are here for whatever you need — simply reply to this email.',
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
};

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
  const richContent =
    !payload.bodyOverride && baseTemplate.contentHtml
      ? fillMarketingVariables(baseTemplate.contentHtml(locale), payload)
      : null;

  return {
    subject,
    html: Layout({
      title: fillMarketingVariables(template.title, payload),
      preview: fillMarketingVariables(template.previewText, payload),
      locale,
      unsubscribeUrl: payload.unsubscribeUrl || null,
      children: `
        ${Header({
          title: fillMarketingVariables(template.title, payload),
          subtitle: fillMarketingVariables(template.subtitle, payload),
        })}
        ${Section({
          children: `
            ${richContent ?? bodyParagraphs.map((paragraph) => Text(fillMarketingVariables(paragraph, payload))).join('')}
            ${Button({ label: template.ctaLabel, url: ctaUrl })}
          `,
        })}
      `,
    }),
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
  const greetingPrefix = isEn ? 'Dear' : 'Estimado(a)';

  return {
    subject: isEn ? 'Membership status suspended' : 'Estado de membro suspenso',
    html: Layout({
      title: isEn ? 'Membership Suspended' : 'Suspensão de Membro',
      locale,
      children: Section({
        children: `
                ${Text(`${isEn ? 'Hello' : 'Olá'} <strong>${greetingPrefix} ${greetingName}</strong>,`)}
                ${Text(
                  isEn
                    ? 'Your membership status has been suspended due to a missing annual fee. You can reactivate access as soon as the outstanding amount is regularised.'
                    : 'O seu estado de membro foi suspenso por falta de pagamento da anuidade. Pode reativar o acesso assim que regularizar o valor em dívida.'
                )}
                ${payload.payLink ? Button({ label: isEn ? 'Reactivate Membership' : 'Reativar Membro', url: payload.payLink }) : ''}
`,
      }),
    }),
  };
};

export const renderMemberDiplomaEmail = (payload: MemberDiplomaInput) => {
  const locale = payload.locale === "en" ? "en" : "pt";
  const isEn = locale === "en";
  return {
    subject: isEn ? "Your member certificate" : "O seu diploma de membro",
    html: Layout({
      title: isEn ? "Member Certificate" : "Diploma de Membro",
      locale,
      children: Section({
        children: `
                ${Text(isEn ? `Hello <strong>${payload.memberName || "member"}</strong>,` : `Olá <strong>${payload.memberName || "membro"}</strong>,`)}
                ${Text(isEn ? "Attached is your digital member certificate from the Apostolate of Garabandal." : "Enviamos em anexo o seu diploma digital de membro do Apostolado de Garabandal.")}
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
