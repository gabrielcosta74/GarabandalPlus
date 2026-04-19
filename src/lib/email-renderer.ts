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
};

export type GeneralLeadInput = {
  email: string;
  name?: string;
};

export type BrochureEmailInput = {
  email: string;
  name: string;
  pilgrimageName: string;
  pdfUrl: string;
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
}: {
  title: string;
  preview?: string;
  children: string;
  locale?: EmailLocale;
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
/*                              RENDER FUNCTIONS                              */
/* -------------------------------------------------------------------------- */

export const renderMembershipEmail = (payload: MembershipNotificationInput) => {
  const memberLabel = payload.memberName || payload.memberEmail || "Membro";
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
    subject: "Bem-vindo ao Apostolado de Garabandal",
    html: Layout({
      title: "Bem-vindo",
      preview: "A sua conta foi criada com sucesso.",
      children: `
                ${Header({
        title: "Bem-vindo à Família",
        subtitle: "Apostolado de Garabandal em Língua Portuguesa",
      })}
                ${Section({
        children: `
                        ${Text(`Olá <strong>${payload.name}</strong>,`)}
                        ${Text("É com alegria que o acolhemos na nossa comunidade digital. A sua conta foi ativada com sucesso.")}
                        ${Text("Agora tem acesso direto a:")}
                        
                        <div style="display:grid;gap:12px;margin:24px 0;">
                            <div style="background:${COLORS.bg};padding:12px 16px;border-radius:8px;">✅ Inscrição facilitada em peregrinações</div>
                            <div style="background:${COLORS.bg};padding:12px 16px;border-radius:8px;">✅ Acesso à loja oficial</div>
                            <div style="background:${COLORS.bg};padding:12px 16px;border-radius:8px;">✅ Conteúdos exclusivos (para membros)</div>
                        </div>

                        ${Button({ label: "Aceder à Minha Conta", url: `${APP_URL}/login` })}
                        ${Text("Que Nossa Senhora do Carmo o abençoe.", "text-align:center;font-style:italic;margin-top:24px;color:" + COLORS.textLight)}
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
}) => {
  const registrationFee = Number(payload.amount) || 0;
  const totalAmount = Number(payload.totalAmount) || 0;
  const remainingAmount = Math.max(0, totalAmount - registrationFee);

  return {
    subject: `Inscrição recebida: ${payload.pilgrimageName}`,
    html: Layout({
      title: "Inscrição Recebida",
      children: `
                ${Header({
        title: "Inscrição Recebida",
        subtitle: payload.pilgrimageName,
      })}
                ${Section({
        children: `
                        ${Text("A sua inscrição foi registada com sucesso.")}
                        ${Text("Para facilitar, deixamos o resumo de valores de forma direta:")}
                        ${Card({
          children: `
                                ${InfoRow({ label: "Peregrinação", value: payload.pilgrimageName })}
                                ${InfoRow({ label: "Taxa de Inscrição", value: formatCurrency(registrationFee) })}
                                ${InfoRow({ label: "Valor Restante", value: formatCurrency(remainingAmount) })}
                                ${InfoRow({ label: "Total (Taxa de Inscrição + Valor Restante)", value: formatCurrency(totalAmount), isLast: true })}
                            `,
        })}
                        ${Card({
          children: `
                                <p style="margin:0;color:${COLORS.error};font-weight:700;">
                                    Atenção: se a Taxa de Inscrição não for paga, o lugar não fica confirmado e pode perder a vaga.
                                </p>
                            `,
        })}
                        ${Text("Para acompanhar a sua inscrição e concluir os próximos passos de pagamento, use o botão abaixo:")}
                        ${Button({ label: "Gerir Inscrição", url: payload.magicLink })}
                    `,
      })}
            `,
    }),
  };
};

export const renderQuotaReminderEmail = (payload: QuotaReminderInput) => {
  const isOverdue = (payload.daysOverdue || 0) > 0;
  const daysText = isOverdue
    ? `${payload.daysOverdue} dias em atraso`
    : `${payload.daysUntilDue} dias para vencer`;

  return {
    subject: isOverdue
      ? `Ação necessária: anuidade em atraso`
      : `Lembrete: renovação da anuidade`,
    html: Layout({
      title: "Estado da Anuidade",
      children: `
                ${Header({
        title: isOverdue
          ? "Anuidade em Atraso"
          : "Renovação de Anuidade",
        subtitle: isOverdue
          ? "Regularize a sua situação"
          : "Mantenha os seus benefícios ativos",
      })}
                ${Section({
        children: `
                        ${Text(`Olá <strong>${payload.memberName || "Membro"}</strong>,`)}
                        ${Text(
          isOverdue
            ? "A sua anuidade encontra-se pendente. Para manter o acesso ativo, pedimos a regularização do pagamento."
            : "Este é um lembrete amigável de que a sua anuidade anual vence em breve.",
        )}
                        
                        ${Card({
          children: `
                                ${InfoRow({ label: "Nº Associado", value: payload.memberNumber || "-" })}
                                ${InfoRow({ label: "Vencimento", value: formatDate(payload.nextQuotaDate) })}
                                ${InfoRow({ label: "Status", value: `<span style="color:${isOverdue ? COLORS.error : COLORS.primary};font-weight:bold;">${daysText}</span>`, isLast: true })}
                            `,
        })}

                        ${Button({ label: "Renovar Agora", url: payload.membershipUrl || `${APP_URL}/member` })}
                    `,
      })}
            `,
    }),
  };
};

export const renderPilgrimagePaymentReminderEmail = (
  payload: PilgrimagePaymentReminderInput,
) => {
  const isShortDeadline =
    payload.stage === 'upcoming_3d' ||
    payload.stage === 'upcoming_1d' ||
    payload.stage === 'overdue_2d' ||
    payload.stage === 'overdue_5d';
  const subtitleMap: Record<PilgrimagePaymentReminderInput['stage'], string> = {
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

  const introMap: Record<PilgrimagePaymentReminderInput['stage'], string> = {
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
  const heading = effectiveIsOverdue ? 'Pagamento em Falta' : 'Lembrete de Pagamento';

  return {
    subject: effectiveIsOverdue
      ? `Pagamento pendente da peregrinação: ${payload.pilgrimageName}`
      : `Lembrete de pagamento da peregrinação: ${payload.pilgrimageName}`,
    html: Layout({
      title: heading,
      children: `
                ${Header({
        title: heading,
        subtitle: payload.pilgrimageName,
      })}
                ${Section({
        children: `
                        ${Text(`Olá <strong>${payload.recipientName || 'Peregrino'}</strong>,`)}
                        ${Text(introMap[payload.stage])}
                        ${Card({
          children: `
                                ${InfoRow({ label: 'Referente a', value: payload.obligationLabel })}
                                ${InfoRow({ label: 'Vencimento', value: formatDate(payload.dueDate) })}
                                ${InfoRow({ label: 'Valor desta fase', value: formatCurrency(payload.amountDue) })}
                                ${InfoRow({ label: 'Total ainda em falta', value: formatCurrency(payload.totalRemaining), isLast: true })}
                            `,
        })}
                        ${Card({
          children: `
                                <p style="margin:0;color:${effectiveIsOverdue ? COLORS.error : COLORS.heading};font-weight:700;">
                                    ${subtitleMap[payload.stage]}
                                </p>
                                <p style="margin:12px 0 0;color:${COLORS.textLight};">
                                    Pode entrar na sua inscrição para pagar agora ou enviar o comprovativo, caso já tenha feito a transferência.
                                </p>
                            `,
        })}
                        ${Button({ label: 'Gerir Inscrição', url: payload.bookingUrl })}
                        ${Text(
                          isShortDeadline
                            ? 'Este aviso refere-se ao prazo curto do sinal de inscrição. Se já regularizou este valor recentemente, pode desconsiderar este email.'
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
  return {
    subject: "Recebemos o seu interesse",
    html: Layout({
      title: "Interesse Registado",
      children: `
                ${Header({ title: "Obrigado pelo seu interesse", subtitle: "Apostolado de Garabandal" })}
                ${Section({
        children: `
                        ${Text(`Olá <strong>${payload.name || "Peregrino"}</strong>,`)}
                        ${Text("Recebemos o seu contacto com sucesso. Assim que existirem novidades ou novas vagas, entraremos em contacto por email.")}
                        ${Button({ label: "Ver Peregrinações", url: `${APP_URL}/peregrinacoes` })}
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
) => ({
  subject: "Continue a sua inscrição",
  html: Layout({
    title: "Inscrição por Concluir",
    children: `
            ${Header({ title: "Ainda vai a tempo de concluir", subtitle: payload.pilgrimageName })}
            ${Section({
      children: `
                    ${Text(`Olá <strong>${payload.name || "peregrino"}</strong>,`)}
                    ${Text("A sua inscrição ficou pendente. Pode retomar exatamente no ponto onde ficou através do botão abaixo.")}
                    ${Button({ label: "Retomar Inscrição", url: payload.recoveryLink })}
                `,
    })}
`,
  }),
});

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

export const renderBrochureEmail = (payload: BrochureEmailInput) => ({
  subject: `Roteiro solicitado: ${payload.pilgrimageName} `,
  html: Layout({
    title: "Roteiro da Peregrinação",
    children: Section({
      children: `
                ${Text(`Olá <strong>${payload.name}</strong>,`)}
                ${Text(`Segue o roteiro solicitado para <strong>${payload.pilgrimageName}</strong>.`)}
                ${Button({ label: "Baixar PDF", url: payload.pdfUrl })}
`,
    }),
  }),
});

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

export const renderMembershipRevokedEmail = (payload: any) => ({
  subject: "Estado de membro suspenso",
  html: Layout({
    title: "Suspensão de Membro",
    children: Section({
      children: `
                ${Text(`Olá <strong>${payload.name || "membro"}</strong>,`)}
                ${Text("O seu estado de membro foi suspenso por falta de pagamento da anuidade. Pode reativar o acesso assim que regularizar o valor em dívida.")}
                ${payload.payLink ? Button({ label: "Reativar Membro", url: payload.payLink }) : ""}
`,
    }),
  }),
});

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
  itemUrl: string;
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

export const renderAuctionOutbidEmail = (payload: AuctionOutbidInput) => ({
  subject: `Leilão Solidário: o seu lance foi ultrapassado — "${payload.itemTitle}"`,
  html: Layout({
    title: "Lance Ultrapassado",
    preview: `O seu lance de ${formatCurrency(payload.yourBid)} foi superado.`,
    children: `
            ${Header({
      title: "⚡ O seu lance foi ultrapassado",
      subtitle: payload.itemTitle,
    })}
            ${Section({
      children: `
                    ${Text("Alguém fez um lance mais alto no leilão solidário.")}
                    ${Card({
        icon: "🏷️",
        children: `
                            ${InfoRow({ label: "Peça", value: payload.itemTitle })}
                            ${InfoRow({ label: "O seu lance", value: formatCurrency(payload.yourBid) })}
                            ${InfoRow({ label: "Novo lance mais alto", value: `<span style="color:${COLORS.error};font-weight:bold;">${formatCurrency(payload.newBid)}</span>` })}
                            ${InfoRow({ label: "Lance mínimo agora", value: formatCurrency(payload.newBid + 1), isLast: true })}
                        `,
      })}
                    ${Text("Ainda vai a tempo de voltar a licitar e garantir esta peça!")}
                    ${Button({ label: "Licitar Novamente", url: payload.itemUrl })}
                    ${Text("O leilão solidário reverte integralmente para a missão do Apostolado.", `text-align:center;font-size:13px;color:${COLORS.textLight};font-style:italic;`)}
                `,
    })}
`,
  }),
});

export const renderAuctionWinnerEmail = (payload: AuctionWinnerInput) => ({
  subject: `🏆 Parabéns! Ganhou o leilão — "${payload.itemTitle}"`,
  html: Layout({
    title: "Leilão Vencido",
    preview: `Ganhou "${payload.itemTitle}" por ${formatCurrency(payload.winningBid / 100)}.`,
    children: `
            ${Header({
      title: "🏆 Parabéns, ganhou o leilão!",
      subtitle: payload.itemTitle,
    })}
            ${Section({
      children: `
                    ${Text(`Olá <strong>${payload.winnerName || "vencedor"}</strong>,`)}
                    ${Text(`O seu lance foi o vencedor no <strong>Leilão Solidário</strong>! A peça <strong>"${payload.itemTitle}"</strong> é sua.`)}
                    ${Card({
        icon: "🎉",
        children: `
                            ${InfoRow({ label: "Peça", value: payload.itemTitle })}
                            ${InfoRow({ label: "Lance vencedor", value: `<span style="color:${COLORS.success};font-weight:bold;">${formatCurrency(payload.winningBid / 100)}</span>` })}
                            ${InfoRow({ label: "Prazo para pagamento", value: `${payload.paymentDeadlineHours}h a partir de agora`, isLast: true })}
                        `,
      })}
                    <div style="background:${COLORS.primaryLight};border:1px solid ${COLORS.primary};border-radius:12px;padding:16px;margin-bottom:24px;">
                        <strong style="color:${COLORS.primary};display:block;margin-bottom:4px;">⏰ Importante</strong>
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
      title: "✅ Pagamento Confirmado",
      subtitle: payload.itemTitle,
    })}
            ${Section({
      children: `
                    ${Text(`Olá <strong>${payload.winnerName || "vencedor"}</strong>,`)}
                    ${Text(`Confirmamos a receção do seu pagamento para o <strong>Leilão Solidário</strong> da peça <strong>"${payload.itemTitle}"</strong>. O seu envio será preparado em breve.`)}
                    ${Card({
        icon: "🧾",
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
