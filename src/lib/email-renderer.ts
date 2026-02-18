import { Resend } from 'resend';
import { APP_URL, ASSETS_URL } from './config';

/* -------------------------------------------------------------------------- */
/*                                    TYPES                                   */
/* -------------------------------------------------------------------------- */

export type MembershipNotificationInput = {
    kind: 'new' | 'renewal';
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
    kind: 'new' | 'renewal';
    attachments?: EmailAttachment[];
    hasDiploma?: boolean;
};

export type MemberDiplomaInput = {
    toEmail: string;
    memberName?: string | null;
    memberNumber: number;
    issuedAt?: string | null;
    attachments: EmailAttachment[];
};

export type DonationReceiptInput = {
    toEmail: string;
    donorName?: string | null;
    amount: number;
    currency?: string;
    paymentReference?: string | null;
    paidAt?: string | null;
    method: string;
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

/* -------------------------------------------------------------------------- */
/*                                   THEME                                    */
/* -------------------------------------------------------------------------- */

const COLORS = {
    bg: '#F8FAFC',
    white: '#FFFFFF',
    text: '#334155',
    textLight: '#64748B',
    heading: '#0F172A',
    primary: '#CA8A04', // Garabandal Gold
    primaryLight: '#FEFCE8',
    border: '#E2E8F0',
    success: '#16A34A',
    successBg: '#F0FDF4',
    error: '#DC2626',
    errorBg: '#FEF2F2',
    link: '#CA8A04',
};

const FONTS = {
    serif: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

export const formatCurrency = (value: number, currency = 'EUR') =>
    new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(value);

export const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('pt-PT');
};

/* -------------------------------------------------------------------------- */
/*                                 COMPONENTS                                 */
/* -------------------------------------------------------------------------- */

const Layout = ({ title, preview, children }: { title: string; preview?: string; children: string }) => `
<!DOCTYPE html>
<html lang="pt-BR">
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
        <p style="margin:0;font-weight:600;color:${COLORS.heading};">Unindo FÉ e ESPERANÇA.</p>
        <p style="margin:12px 0 0;font-size:11px;opacity:0.7;">Se precisar de ajuda, basta responder a este email.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

const Header = ({ title, subtitle, image = `${APP_URL}/images/nossasenhoragarabandal.jpg` }: { title: string; subtitle?: string; image?: string }) => `
<div style="background:linear-gradient(rgba(15,23,42,0.9), rgba(15,23,42,0.9)), url('${image}');background-size:cover;background-position:center;padding:48px 40px;text-align:center;">
    <div style="width:64px;height:64px;border-radius:9999px;margin:0 auto 24px;background:#ffffff;background-image:url('${APP_URL}/images/nossasenhoragarabandal.jpg');background-size:cover;background-position:center;box-shadow:0 4px 6px rgba(0,0,0,0.2);border:2px solid rgba(255,255,255,0.9);"></div>
    <h1 style="color:white;margin:0;font-family:${FONTS.serif};font-size:28px;line-height:1.3;letter-spacing:-0.5px;">${title}</h1>
    ${subtitle ? `<p style="color:#CBD5E1;margin:12px 0 0;font-size:16px;font-weight:400;">${subtitle}</p>` : ''}
</div>
`;

const Section = ({ children, style = '' }: { children: string; style?: string }) => `
<div style="padding:40px;font-size:16px;line-height:1.6;${style}">
    ${children}
</div>
`;

const Card = ({ children, icon }: { children: string; icon?: string }) => `
<div style="background:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:12px;padding:24px;margin:24px 0;">
    ${icon ? `<div style="font-size:24px;margin-bottom:16px;">${icon}</div>` : ''}
    ${children}
</div>
`;

const InfoRow = ({ label, value, isLast = false }: { label: string; value: string | number; isLast?: boolean }) => `
<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:${isLast ? 'none' : `1px solid ${COLORS.border}`};">
    <span style="color:${COLORS.textLight};font-size:14px;font-weight:500;">${label}</span>
    <span style="color:${COLORS.heading};font-weight:600;text-align:right;">${value}</span>
</div>
`;

const Button = ({ label, url, variant = 'primary' }: { label: string; url: string; variant?: 'primary' | 'secondary' | 'outline' }) => {
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

const Text = (text: string, style = '') => `
<p style="margin:0 0 16px;${style}">${text}</p>
`;

/* -------------------------------------------------------------------------- */
/*                              RENDER FUNCTIONS                              */
/* -------------------------------------------------------------------------- */

export const renderMembershipEmail = (payload: MembershipNotificationInput) => {
    const memberLabel = payload.memberName || payload.memberEmail || 'Membro';
    const amountText = formatCurrency(payload.amount, payload.currency || 'EUR');
    const isRenewal = payload.kind === 'renewal';

    return {
        subject: `Nova ${isRenewal ? 'Renovação' : 'Inscrição'} - ${memberLabel}`,
        html: Layout({
            title: isRenewal ? 'Renovação de Anuidade' : 'Nova Inscrição de Membro',
            children: `
                ${Header({
                title: isRenewal ? 'Anuidade Renovada' : 'Novo Membro Registado',
                subtitle: memberLabel
            })}
                ${Section({
                children: `
                        ${Text('Foi processado com sucesso um pagamento de anuidade.')}
                        ${Card({
                    children: `
                                ${InfoRow({ label: 'Membro', value: memberLabel })}
                                ${InfoRow({ label: 'Email', value: payload.memberEmail || '-' })}
                                ${InfoRow({ label: 'Nº Associado', value: payload.memberNumber || 'Pendente' })}
                                ${InfoRow({ label: 'Valor', value: amountText })}
                                ${InfoRow({ label: 'Método', value: payload.paymentMethod })}
                                ${InfoRow({ label: 'Próximo Vencimento', value: formatDate(payload.nextQuotaDate) })}
                                ${InfoRow({ label: 'Data Pagamento', value: formatDate(payload.paidAt), isLast: true })}
                            `
                })}
                    `
            })}
            `
        })
    };
};

export const renderMemberReceiptEmail = (payload: MemberReceiptInput) => {
    const memberLabel = payload.memberName || 'Estimado Membro';
    const amountText = formatCurrency(payload.amount, payload.currency || 'EUR');

    return {
        subject: `Recibo Apostolado - ${amountText}`,
        html: Layout({
            title: 'Recibo de Pagamento',
            preview: `Confirmação do pagamento da sua anuidade.`,
            children: `
                ${Header({
                title: 'Pagamento Confirmado',
                subtitle: 'Obrigado pelo seu apoio contínuo.'
            })}
                ${Section({
                children: `
                        ${Text(`Olá <strong>${memberLabel}</strong>,`)}
                        ${Text('Confirmamos a receção do pagamento da sua anuidade. A sua contribuição é essencial para manter viva a missão de Garabandal.')}
                        
                        ${payload.hasDiploma ? `
                            <div style="background:${COLORS.primaryLight};border:1px solid ${COLORS.primary};border-radius:12px;padding:16px;margin-bottom:24px;text-align:center;">
                                <strong style="color:${COLORS.primary};display:block;margin-bottom:4px;">🎓 Diploma de Membro</strong>
                                <span style="font-size:14px;">O seu diploma digital segue em anexo a este email.</span>
                            </div>
                        ` : ''}

                        ${HeadingSmall('Detalhes da Transação')}
                        ${Card({
                    children: `
                                ${InfoRow({ label: 'Nº Associado', value: payload.memberNumber || '-' })}
                                ${InfoRow({ label: 'Valor', value: amountText })}
                                ${InfoRow({ label: 'Método', value: payload.paymentMethod })}
                                ${InfoRow({ label: 'Referência', value: payload.paymentReference || '-' })}
                                ${InfoRow({ label: 'Data', value: formatDate(payload.paidAt), isLast: true })}
                            `
                })}
                        
                        ${Button({ label: 'Acessar Área de Membro', url: `${APP_URL}/member` })}
                    `
            })}
            `
        })
    };
};

export const renderWelcomeEmail = (payload: { name: string; email: string }) => {
    return {
        subject: 'Bem-vindo ao Apostolado de Garabandal',
        html: Layout({
            title: 'Bem-vindo',
            preview: 'A sua conta foi criada com sucesso.',
            children: `
                ${Header({
                title: 'Bem-vindo à Família',
                subtitle: 'Apostolado de Garabandal em Língua Portuguesa'
            })}
                ${Section({
                children: `
                        ${Text(`Olá <strong>${payload.name}</strong>,`)}
                        ${Text('É com alegria que o acolhemos na nossa comunidade digital. A sua conta foi ativada com sucesso.')}
                        ${Text('Agora tem acesso direto a:')}
                        
                        <div style="display:grid;gap:12px;margin:24px 0;">
                            <div style="background:${COLORS.bg};padding:12px 16px;border-radius:8px;">✅ Inscrição facilitada em peregrinações</div>
                            <div style="background:${COLORS.bg};padding:12px 16px;border-radius:8px;">✅ Acesso à loja oficial</div>
                            <div style="background:${COLORS.bg};padding:12px 16px;border-radius:8px;">✅ Conteúdos exclusivos (para membros)</div>
                        </div>

                        ${Button({ label: 'Aceder à Minha Conta', url: `${APP_URL}/login` })}
                        ${Text('Que Nossa Senhora do Carmo o abençoe.', 'text-align:center;font-style:italic;margin-top:24px;color:' + COLORS.textLight)}
                    `
            })}
            `
        })
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
            title: 'Inscrição Recebida',
            children: `
                ${Header({
                title: 'Inscrição Recebida',
                subtitle: payload.pilgrimageName
            })}
                ${Section({
                children: `
                        ${Text('A sua inscrição foi registada com sucesso.')}
                        ${Text('Para facilitar, deixamos o resumo de valores de forma direta:')}
                        ${Card({
                    children: `
                                ${InfoRow({ label: 'Peregrinação', value: payload.pilgrimageName })}
                                ${InfoRow({ label: 'Taxa de Inscrição', value: formatCurrency(registrationFee) })}
                                ${InfoRow({ label: 'Valor Restante', value: formatCurrency(remainingAmount) })}
                                ${InfoRow({ label: 'Total (Taxa de Inscrição + Valor Restante)', value: formatCurrency(totalAmount), isLast: true })}
                            `
                })}
                        ${Card({
                    children: `
                                <p style="margin:0;color:${COLORS.error};font-weight:700;">
                                    Atenção: se a Taxa de Inscrição não for paga, o lugar não fica confirmado e pode perder a vaga.
                                </p>
                            `
                })}
                        ${Text('Para acompanhar a sua inscrição e concluir os próximos passos de pagamento, use o botão abaixo:')}
                        ${Button({ label: 'Gerir Inscrição', url: payload.magicLink })}
                    `
            })}
            `
        })
    };
};

export const renderQuotaReminderEmail = (payload: QuotaReminderInput) => {
    const isOverdue = (payload.daysOverdue || 0) > 0;
    const daysText = isOverdue ? `${payload.daysOverdue} dias em atraso` : `${payload.daysUntilDue} dias para vencer`;

    return {
        subject: isOverdue ? `Ação necessária: anuidade em atraso` : `Lembrete: renovação da anuidade`,
        html: Layout({
            title: 'Estado da Anuidade',
            children: `
                ${Header({
                title: isOverdue ? 'Anuidade em Atraso' : 'Renovação de Anuidade',
                subtitle: isOverdue ? 'Regularize a sua situação' : 'Mantenha os seus benefícios ativos'
            })}
                ${Section({
                children: `
                        ${Text(`Olá <strong>${payload.memberName || 'Membro'}</strong>,`)}
                        ${Text(isOverdue
                    ? 'A sua anuidade encontra-se pendente. Para manter o acesso ativo, pedimos a regularização do pagamento.'
                    : 'Este é um lembrete amigável de que a sua anuidade anual vence em breve.')}
                        
                        ${Card({
                        children: `
                                ${InfoRow({ label: 'Nº Associado', value: payload.memberNumber || '-' })}
                                ${InfoRow({ label: 'Vencimento', value: formatDate(payload.nextQuotaDate) })}
                                ${InfoRow({ label: 'Status', value: `<span style="color:${isOverdue ? COLORS.error : COLORS.primary};font-weight:bold;">${daysText}</span>`, isLast: true })}
                            `
                    })}

                        ${Button({ label: 'Renovar Agora', url: payload.membershipUrl || `${APP_URL}/member` })}
                    `
            })}
            `
        })
    };
};

// ... (Other renderers would follow similar pattern, kept brief for this targeted update)
// Legacy/Placeholder exports for functions not fully refactored in this pass but enabling the file to work:

export const renderDonationReceiptEmail = (payload: DonationReceiptInput) => {
    const amountText = formatCurrency(payload.amount, payload.currency || 'EUR');
    return {
        subject: `Doação registada com sucesso - ${amountText}`,
        html: Layout({
            title: 'Doação Registada',
            children: `
                ${Header({ title: 'Obrigado pela sua generosidade', subtitle: 'Doação confirmada' })}
                ${Section({
                children: `
                        ${Text(`Obrigado, <strong>${payload.donorName || 'Benfeitor'}</strong>. O seu apoio é fundamental para a missão do Apostolado.`)}
                        ${Card({
                    children: `
                                ${InfoRow({ label: 'Valor', value: amountText })}
                                ${InfoRow({ label: 'Método', value: payload.method })}
                                ${InfoRow({ label: 'Referência', value: payload.paymentReference || '-', isLast: true })}
                            `
                })}
                        ${Text('Guardaremos este registo para efeitos administrativos e fiscais, quando aplicável.')}
                    `
            })}
            `
        })
    };
};

export const renderGeneralLeadEmail = (payload: GeneralLeadInput) => {
    return {
        subject: 'Recebemos o seu interesse',
        html: Layout({
            title: 'Interesse Registado',
            children: `
                ${Header({ title: 'Obrigado pelo seu interesse', subtitle: 'Apostolado de Garabandal' })}
                ${Section({
                children: `
                        ${Text(`Olá <strong>${payload.name || 'Peregrino'}</strong>,`)}
                        ${Text('Recebemos o seu contacto com sucesso. Assim que existirem novidades ou novas vagas, entraremos em contacto por email.')}
                        ${Button({ label: 'Ver Peregrinações', url: `${APP_URL}/peregrinacoes` })}
                    `
            })}
            `
        })
    };
};

// Default exports for backward compatibility or less critical emails
// Using a generic wrapper for the existing logic if needed, or simple implementation
export const renderStoreOwnerEmail = (payload: any) => ({
    subject: `Nova encomenda recebida (${payload.orderRef})`,
    html: Layout({
        title: 'Nova Encomenda',
        children: `
            ${Header({ title: 'Nova encomenda na loja', subtitle: `Ref. ${payload.orderRef}` })}
            ${Section({
                children: `
                    ${Text('Foi registada uma nova encomenda no site.')}
                    ${Card({
                        children: `
                            ${InfoRow({ label: 'Referência', value: payload.orderRef || '-' })}
                            ${InfoRow({ label: 'Cliente', value: payload.buyerName || '-' })}
                            ${InfoRow({ label: 'Email', value: payload.buyerEmail || '-' })}
                            ${InfoRow({ label: 'Total', value: payload.total || '-', isLast: true })}
                        `
                    })}
                    ${Button({ label: 'Abrir Admin', url: `${APP_URL}/admin/encomendas` })}
                `
            })}
        `
    })
});

export const renderStoreBuyerEmail = (payload: any) => ({
    subject: `Encomenda confirmada (${payload.orderRef})`,
    html: Layout({
        title: 'Encomenda Confirmada',
        children: `
            ${Header({ title: 'Recebemos a sua encomenda', subtitle: `Ref. ${payload.orderRef}` })}
            ${Section({
                children: `
                    ${Text(`Olá <strong>${payload.buyerName || 'cliente'}</strong>,`)}
                    ${Text('Obrigado pela sua compra. A encomenda foi registada com sucesso.')}
                    ${Card({
                        children: `
                            ${InfoRow({ label: 'Referência', value: payload.orderRef || '-' })}
                            ${InfoRow({ label: 'Subtotal', value: payload.subtotal || '-' })}
                            ${InfoRow({ label: 'IVA', value: payload.vat || '-' })}
                            ${InfoRow({ label: 'Total', value: payload.total || '-', isLast: true })}
                        `
                    })}
                    ${payload.claimUrl ? Button({ label: 'Associar Encomenda à Conta', url: payload.claimUrl }) : ''}
                `
            })}
        `
    })
});

export const renderStoreShippingEmail = (payload: any) => ({
    subject: `Encomenda enviada (${payload.orderRef})`,
    html: Layout({
        title: 'Encomenda Enviada',
        children: `
            ${Header({ title: 'A sua encomenda foi enviada', subtitle: `Ref. ${payload.orderRef}` })}
            ${Section({
                children: `
                    ${Text(`Olá <strong>${payload.buyerName || 'cliente'}</strong>,`)}
                    ${Text('A sua encomenda já saiu para entrega.')}
                    ${Card({
                        children: `
                            ${InfoRow({ label: 'Referência', value: payload.orderRef || '-' })}
                            ${InfoRow({ label: 'Tracking', value: payload.tracking || 'Será atualizado em breve' })}
                            ${InfoRow({ label: 'Data de envio', value: formatDate(payload.shippedAt), isLast: true })}
                        `
                    })}
                `
            })}
        `
    })
});

export const renderStorePreparingEmail = (payload: any) => ({
    subject: `Estamos a preparar a sua encomenda (${payload.orderRef})`,
    html: Layout({
        title: 'Encomenda em Preparação',
        children: `
            ${Header({ title: 'Estamos a preparar a sua encomenda', subtitle: `Ref. ${payload.orderRef}` })}
            ${Section({
                children: `
                    ${Text(`Olá <strong>${payload.buyerName || 'cliente'}</strong>,`)}
                    ${Text('A sua encomenda está em preparação. Assim que for enviada, receberá nova atualização por email.')}
                `
            })}
        `
    })
});

export const renderAbandonmentRecoveryEmail = (payload: AbandonmentRecoveryInput) => ({
    subject: 'Continue a sua inscrição',
    html: Layout({
        title: 'Inscrição por Concluir',
        children: `
            ${Header({ title: 'Ainda vai a tempo de concluir', subtitle: payload.pilgrimageName })}
            ${Section({
                children: `
                    ${Text(`Olá <strong>${payload.name || 'peregrino'}</strong>,`)}
                    ${Text('A sua inscrição ficou pendente. Pode retomar exatamente no ponto onde ficou através do botão abaixo.')}
                    ${Button({ label: 'Retomar Inscrição', url: payload.recoveryLink })}
                `
            })}
        `
    })
});

export const renderDonationNotification = (payload: any) => ({
    subject: `Nova doação registada (${formatCurrency(payload.amount)})`,
    html: Layout({
        title: 'Nova Doação',
        children: Section({
            children: `
                ${Text('Foi registada uma nova doação no sistema.')}
                ${Card({
                    children: `
                        ${InfoRow({ label: 'Doador', value: payload.donorName || '-' })}
                        ${InfoRow({ label: 'Email', value: payload.donorEmail || '-' })}
                        ${InfoRow({ label: 'Valor', value: formatCurrency(payload.amount) })}
                        ${InfoRow({ label: 'Método', value: payload.paymentMethod || '-', isLast: true })}
                    `
                })}
            `
        })
    })
});

export const renderBrochureEmail = (payload: BrochureEmailInput) => ({
    subject: `Roteiro solicitado: ${payload.pilgrimageName}`,
    html: Layout({
        title: 'Roteiro da Peregrinação',
        children: Section({
            children: `
                ${Text(`Olá <strong>${payload.name}</strong>,`)}
                ${Text(`Segue o roteiro solicitado para <strong>${payload.pilgrimageName}</strong>.`)}
                ${Button({ label: 'Baixar PDF', url: payload.pdfUrl })}
            `
        })
    })
});

export const renderQuotaWarningEmail = (payload: any) => ({
    subject: 'Lembrete: anuidade prestes a vencer',
    html: Layout({
        title: 'Lembrete de Anuidade',
        children: Section({
            children: `
                ${Text(`Olá <strong>${payload.name || 'membro'}</strong>,`)}
                ${Text(`A sua anuidade vence em ${payload.daysRemaining} dia(s). Para manter o acesso ativo, regularize atempadamente.`)}
                ${Button({ label: 'Regularizar Pagamento', url: payload.payLink })}
            `
        })
    })
});

export const renderQuotaOverdueEmail = (payload: any) => ({
    subject: 'Anuidade em atraso',
    html: Layout({
        title: 'Anuidade em Atraso',
        children: Section({
            children: `
                ${Text(`Olá <strong>${payload.name || 'membro'}</strong>,`)}
                ${Text('A sua anuidade encontra-se em atraso. Regularize para manter os benefícios de membro ativos.')}
                ${Button({ label: 'Regularizar Agora', url: payload.payLink })}
            `
        })
    })
});

export const renderMembershipRevokedEmail = (payload: any) => ({
    subject: 'Estado de membro suspenso',
    html: Layout({
        title: 'Suspensão de Membro',
        children: Section({
            children: `
                ${Text(`Olá <strong>${payload.name || 'membro'}</strong>,`)}
                ${Text('O seu estado de membro foi suspenso por falta de pagamento da anuidade. Pode reativar o acesso assim que regularizar o valor em dívida.')}
                ${payload.payLink ? Button({ label: 'Reativar Membro', url: payload.payLink }) : ''}
            `
        })
    })
});

export const renderMemberDiplomaEmail = (payload: MemberDiplomaInput) => ({
    subject: 'O seu diploma de membro',
    html: Layout({
        title: 'Diploma de Membro',
        children: Section({
            children: `
                ${Text(`Olá <strong>${payload.memberName || 'membro'}</strong>,`)}
                ${Text('Enviamos em anexo o seu diploma digital de membro do Apostolado de Garabandal.')}
            `
        })
    })
});
