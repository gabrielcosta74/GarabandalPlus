import { Resend } from 'resend';
import { APP_URL, ASSETS_URL } from './config';

// Helper types
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

// Helper Functions
export const formatCurrency = (value: number, currency = 'EUR') =>
    new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(value);

export const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('pt-PT');
};

export const renderEmailShell = (input: {
    title: string;
    subtitle?: string;
    bodyHtml: string;
    footer?: string;
}) => {
    return `
    <!DOCTYPE html>
    <html lang="pt">
    <head>
      <meta charset="utf-8">
      <title>${input.title}</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:sans-serif;color:#334155;">
      <div style="background:#f1f5f9;width:100%;padding:40px 0;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
          
          <!-- Header -->
          <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 40px;text-align:center;">
             <div style="margin-bottom:24px;">
               <img src="${APP_URL}/images/nossasenhoragarabandal.jpg" alt="Apostolado" style="height:150px;width:auto;border-radius:8px;margin:0 auto;display:block;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
             </div>
             <h1 style="color:#ffffff;margin:0;font-family:serif;font-size:24px;line-height:1.4;">${input.title}</h1>
             <p style="color:#94a3b8;margin:12px 0 0;font-size:18px;">${input.subtitle || 'Notificação oficial'}</p>
          </div>

          <!-- Body -->
          <div style="padding:40px;color:#334155;font-size:17px;line-height:1.6;">
            ${input.bodyHtml}
          </div>

          <!-- Footer -->
          <div style="background:#f1f5f9;padding:32px 40px;text-align:center;color:#64748b;font-size:14px;">
            <p style="margin:0 0 12px;">${input.footer || ''}</p>
            <p style="margin:0;font-weight:600;color:#0f172a;">Associação do Apostolado de Garabandal</p>
          </div>

        </div>
      </div>
    </body>
    </html>
  `;
};

// Render Functions
export const renderMembershipEmail = (payload: MembershipNotificationInput) => {
    const memberLabel = payload.memberName || payload.memberEmail || 'Membro';
    const subjectType = payload.kind === 'renewal' ? 'Renovação de quota' : 'Nova inscrição de quota';
    const amountText = formatCurrency(payload.amount, payload.currency || 'EUR');
    const memberNumber = payload.memberNumber ? `Sócio n.º ${payload.memberNumber}` : 'Sócio sem número';

    return {
        subject: `${subjectType} - ${memberLabel}`,
        html: renderEmailShell({
            title: subjectType,
            subtitle: 'Gestão de quotas',
            bodyHtml: `
        <p style="margin:0 0 16px;">Recebemos uma ${payload.kind === 'renewal' ? 'renovação' : 'inscrição'}.</p>
        <div style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#f8fafc;">
          <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
            <tr><td style="padding: 6px 0; font-weight: 600;">Membro</td><td style="padding: 6px 0;">${memberLabel}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Email</td><td style="padding: 6px 0;">${payload.memberEmail || '-'}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Número de sócio</td><td style="padding: 6px 0;">${memberNumber}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Valor</td><td style="padding: 6px 0;">${amountText}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Método</td><td style="padding: 6px 0;">${payload.paymentMethod}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Referência</td><td style="padding: 6px 0;">${payload.paymentReference || '-'}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Próxima quota</td><td style="padding: 6px 0;">${formatDate(payload.nextQuotaDate)}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Pago em</td><td style="padding: 6px 0;">${formatDate(payload.paidAt)}</td></tr>
          </table>
        </div>
      `,
            footer: 'Mensagem enviada automaticamente pelo sistema de quotas.',
        }),
    };
};

export const renderMemberReceiptEmail = (payload: MemberReceiptInput) => {
    const memberLabel = payload.memberName || payload.toEmail;
    const subjectType = payload.kind === 'renewal' ? 'Renovação de quota confirmada' : 'Inscrição confirmada';
    const amountText = formatCurrency(payload.amount, payload.currency || 'EUR');
    const memberNumber = payload.memberNumber ? `Sócio n.º ${payload.memberNumber}` : 'Sócio sem número';
    const diplomaNote =
        payload.kind === 'new' && payload.hasDiploma
            ? '<p style="margin: 8px 0 16px;">Segue em anexo o seu diploma de membro.</p>'
            : '';

    return {
        subject: `${subjectType} - ${memberLabel}`,
        html: renderEmailShell({
            title: subjectType,
            subtitle: 'Área de membros',
            bodyHtml: `
        <p style="margin:0 0 16px;">Obrigado pelo seu apoio ao Apostolado de Garabandal.</p>
        ${diplomaNote}
        <div style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#f8fafc;">
          <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
            <tr><td style="padding: 6px 0; font-weight: 600;">Membro</td><td style="padding: 6px 0;">${memberLabel}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Número de sócio</td><td style="padding: 6px 0;">${memberNumber}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Valor</td><td style="padding: 6px 0;">${amountText}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Método</td><td style="padding: 6px 0;">${payload.paymentMethod}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Referência</td><td style="padding: 6px 0;">${payload.paymentReference || '-'}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Próxima quota</td><td style="padding: 6px 0;">${formatDate(payload.nextQuotaDate)}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Pago em</td><td style="padding: 6px 0;">${formatDate(payload.paidAt)}</td></tr>
          </table>
        </div>
      `,
            footer: 'Guarde este email para referência futura.',
        }),
    };
};

export const renderMemberDiplomaEmail = (payload: MemberDiplomaInput) => {
    const memberLabel = payload.memberName || payload.toEmail;
    const issuedAt = formatDate(payload.issuedAt);

    return {
        subject: `Diploma de membro - ${memberLabel}`,
        html: renderEmailShell({
            title: 'Diploma de membro',
            subtitle: 'Parabéns',
            bodyHtml: `
        <p style="margin:0 0 12px;">Parabéns, ${memberLabel}! Segue em anexo o seu diploma.</p>
        <div style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#f8fafc;">
          <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
            <tr><td style="padding: 6px 0; font-weight: 600;">Número de sócio</td><td style="padding: 6px 0;">${payload.memberNumber}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Data de emissão</td><td style="padding: 6px 0;">${issuedAt}</td></tr>
          </table>
        </div>
      `,
            footer: 'Guarde este diploma para referência futura.',
        }),
    };
};

export const renderDonationReceiptEmail = (payload: DonationReceiptInput) => {
    const donorLabel = payload.donorName || payload.toEmail;
    const amountText = formatCurrency(payload.amount, payload.currency || 'EUR');

    return {
        subject: `Doação confirmada - ${donorLabel}`,
        html: renderEmailShell({
            title: 'Doação confirmada',
            subtitle: 'Obrigado pela sua generosidade',
            bodyHtml: `
        <p style="margin:0 0 16px;">Obrigado pela sua generosidade.</p>
        <div style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#f8fafc;">
          <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
            <tr><td style="padding: 6px 0; font-weight: 600;">Doador</td><td style="padding: 6px 0;">${donorLabel}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Valor</td><td style="padding: 6px 0;">${amountText}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Método</td><td style="padding: 6px 0;">${payload.method}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Referência</td><td style="padding: 6px 0;">${payload.paymentReference || '-'}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Pago em</td><td style="padding: 6px 0;">${formatDate(payload.paidAt)}</td></tr>
          </table>
        </div>
      `,
            footer: 'Se precisar de ajuda, responda a este email.',
        }),
    };
};


export const renderQuotaReminderEmail = (payload: QuotaReminderInput) => {
    const memberLabel = payload.memberName || payload.toEmail;
    const memberNumber = payload.memberNumber ? `Sócio n.º ${payload.memberNumber}` : 'Sócio sem número';
    const isOverdue = typeof payload.daysOverdue === 'number' && payload.daysOverdue > 0;
    const daysText = isOverdue
        ? `${payload.daysOverdue} dias em atraso`
        : typeof payload.daysUntilDue === 'number'
            ? `${payload.daysUntilDue} dias`
            : '';
    const subject = isOverdue
        ? `Quota em atraso - ${memberLabel}`
        : `Lembrete de quota - vence em ${daysText}`;

    return {
        subject,
        html: renderEmailShell({
            title: isOverdue ? 'Quota em atraso' : 'Lembrete de quota',
            subtitle: 'Quota anual',
            bodyHtml: `
        <p style="margin:0 0 12px;">
          ${isOverdue ? 'A sua quota está em atraso.' : 'A sua quota vence em breve.'}
        </p>
        <div style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#f8fafc;">
          <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
            <tr><td style="padding: 6px 0; font-weight: 600;">Membro</td><td style="padding: 6px 0;">${memberLabel}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Número de sócio</td><td style="padding: 6px 0;">${memberNumber}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Próxima quota</td><td style="padding: 6px 0;">${formatDate(payload.nextQuotaDate)}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Estado</td><td style="padding: 6px 0;">${daysText || '-'}</td></tr>
          </table>
        </div>
        ${payload.membershipUrl
                    ? `<p style="margin-top: 16px;"><a href="${payload.membershipUrl}" style="color: #1e63f0; font-weight: 700;">Renovar quota</a></p>`
                    : ''
                }
      `,
            footer: 'Se tiver alguma dúvida, responda a este email.',
        }),
    };
};

export const renderStoreOwnerEmail = (payload: {
    orderRef: string;
    buyerName?: string | null;
    buyerEmail?: string | null;
    buyerPhone?: string | null;
    buyerNif?: string | null;
    subtotal: string;
    vat: string;
    shippingCost?: string | null;
    total: string;
    items: StoreItem[];
    shipping?: {
        address1?: string | null;
        address2?: string | null;
        city?: string | null;
        postalCode?: string | null;
        country?: string | null;
    } | null;
    billing?: {
        address1?: string | null;
        city?: string | null;
        postalCode?: string | null;
        country?: string | null;
    } | null;
}) => {
    const itemsRows = payload.items
        .map(
            (item) =>
                `<tr><td style="padding: 6px 0;">${item.name}</td><td style="padding: 6px 0;">${item.qty}</td><td style="padding: 6px 0;">${formatCurrency(item.unit_price)}</td></tr>`,
        )
        .join('');

    const shippingBlock = payload.shipping
        ? `
        <table style="border-collapse: collapse; width: 100%; max-width: 520px; margin-top: 12px;">
          <tr><td style="padding: 6px 0; font-weight: 600;">Morada</td><td style="padding: 6px 0;">${payload.shipping.address1 || '-'}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Complemento</td><td style="padding: 6px 0;">${payload.shipping.address2 || '-'}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Cidade</td><td style="padding: 6px 0;">${payload.shipping.city || '-'}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Código postal</td><td style="padding: 6px 0;">${payload.shipping.postalCode || '-'}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">País</td><td style="padding: 6px 0;">${payload.shipping.country || '-'}</td></tr>
        </table>
      `
        : '';

    const billingBlock = payload.billing
        ? `
        <table style="border-collapse: collapse; width: 100%; max-width: 520px; margin-top: 12px; border-top: 1px solid #e2e8f0; pt-3;">
          <tr><td colspan="2" style="padding: 6px 0; font-weight: bold; color: #475569;">Dados de Faturação</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Morada</td><td style="padding: 6px 0;">${payload.billing.address1 || '-'}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Cidade</td><td style="padding: 6px 0;">${payload.billing.city || '-'}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Código postal</td><td style="padding: 6px 0;">${payload.billing.postalCode || '-'}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">País</td><td style="padding: 6px 0;">${payload.billing.country || '-'}</td></tr>
        </table>
      `
        : '';


    return {
        subject: `Nova encomenda loja - ${payload.orderRef}`,
        html: renderEmailShell({
            title: `Nova encomenda - ${payload.orderRef}`,
            subtitle: 'Painel da loja',
            bodyHtml: `
        <p style="margin:0 0 12px;">Nova encomenda confirmada. Rever dados e preparar envio.</p>
        <div style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#f8fafc;">
          <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
            <tr><td style="padding: 6px 0; font-weight: 600;">Cliente</td><td style="padding: 6px 0;">${payload.buyerName || payload.buyerEmail || 'Cliente'}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Email</td><td style="padding: 6px 0;">${payload.buyerEmail || '-'}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Telefone</td><td style="padding: 6px 0;">${payload.buyerPhone || '-'}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">NIF</td><td style="padding: 6px 0;">${payload.buyerNif || '-'}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Subtotal</td><td style="padding: 6px 0;">${payload.subtotal}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">IVA</td><td style="padding: 6px 0;">${payload.vat}</td></tr>
            ${payload.shippingCost
                    ? `<tr><td style="padding: 6px 0; font-weight: 600;">Portes</td><td style="padding: 6px 0;">${payload.shippingCost}</td></tr>`
                    : ''
                }
            <tr><td style="padding: 6px 0; font-weight: 600;">Total</td><td style="padding: 6px 0;">${payload.total}</td></tr>
          </table>
        </div>
        <div style="margin-top:14px;">
          <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
            <tr><th align="left">Produto</th><th align="left">Qtd</th><th align="left">Preço</th></tr>
            ${itemsRows || '<tr><td colspan="3">Sem itens</td></tr>'}
          </table>
        </div>
        ${shippingBlock}
        ${billingBlock}
      `,
            footer: 'Recebeu este email por ser administrador da loja.',
        }),
    };
};

export const renderStoreBuyerEmail = (payload: {
    orderRef: string;
    buyerName?: string | null;
    buyerEmail: string;
    buyerNif?: string | null;
    subtotal: string;
    vat: string;
    shippingCost?: string | null;
    total: string;
    hasDigital?: boolean;
    claimUrl?: string | null;
    downloadLinks?: Array<{ name: string; url: string }>;
    accountExists?: boolean | null;
    shipping?: {
        address1?: string | null;
        address2?: string | null;
        city?: string | null;
        postalCode?: string | null;
        country?: string | null;
    } | null;
    billing?: {
        address1?: string | null;
        city?: string | null;
        postalCode?: string | null;
        country?: string | null;
    } | null;
}) => {
    const hasDigital = !!payload.hasDigital || (payload.downloadLinks || []).length > 0;
    const digitalNote = hasDigital
        ? `<p style="margin: 0 0 12px;">
         Os seus ficheiros digitais estão disponíveis. Pode aceder com a sua conta ou usar o link abaixo (válido por 7 dias).
       </p>`
        : '';

    const downloadLinks = (payload.downloadLinks || [])
        .map(
            (item) =>
                `<li style="margin: 6px 0;"><a href="${item.url}" style="color: #1e63f0; font-weight: 700;">Download ${item.name}</a></li>`,
        )
        .join('');

    const nifBlock = payload.buyerNif
        ? `<tr><td style="padding: 6px 0; font-weight: 600;">NIF</td><td style="padding: 6px 0;">${payload.buyerNif}</td></tr>`
        : '';

    const downloadSection = downloadLinks
        ? `<ul style="padding-left: 18px; margin: 0 0 16px;">${downloadLinks}</ul>`
        : '';

    const shippingBlock = payload.shipping
        ? `
        <table style="border-collapse: collapse; width: 100%; max-width: 520px; margin-top: 12px;">
          <tr><td style="padding: 6px 0; font-weight: 600;">Morada</td><td style="padding: 6px 0;">${payload.shipping.address1 || '-'}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Complemento</td><td style="padding: 6px 0;">${payload.shipping.address2 || '-'}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Cidade</td><td style="padding: 6px 0;">${payload.shipping.city || '-'}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Código postal</td><td style="padding: 6px 0;">${payload.shipping.postalCode || '-'}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">País</td><td style="padding: 6px 0;">${payload.shipping.country || '-'}</td></tr>
        </table>
      `
        : '';

    const billingBlock = payload.billing
        ? `
        <table style="border-collapse: collapse; width: 100%; max-width: 520px; margin-top: 12px; border-top: 1px solid #e2e8f0; pt-3;">
          <tr><td colspan="2" style="padding: 6px 0; font-weight: bold; color: #475569;">Dados de Faturação</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Morada</td><td style="padding: 6px 0;">${payload.billing.address1 || '-'}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Cidade</td><td style="padding: 6px 0;">${payload.billing.city || '-'}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Código postal</td><td style="padding: 6px 0;">${payload.billing.postalCode || '-'}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">País</td><td style="padding: 6px 0;">${payload.billing.country || '-'}</td></tr>
          ${nifBlock}
        </table>
      `
        : '';

    const accessBlock = hasDigital
        ? `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <h3 style="margin: 0 0 12px; color: #166534; font-size: 18px;">Como guardar na sua Biblioteca?</h3>
            <p style="margin: 0 0 12px; color: #15803d;">Para não perder o acesso aos seus livros, siga estes passos simples:</p>
            <ol style="margin: 0; padding-left: 20px; color: #14532d; line-height: 1.6;">
                <li style="margin-bottom: 8px;">Aceda à sua área pessoal no nosso site.</li>
                ${payload.accountExists
            ? '<li style="margin-bottom: 8px;">Como já tem conta, basta <strong>entrar com o seu email e password</strong>.</li>'
            : '<li style="margin-bottom: 8px;">Como é a sua primeira vez, <strong>crie uma senha</strong> usando este mesmo email.</li>'
        }
                <li>Vá ao menu <strong>"Biblioteca"</strong> para ver os seus livros sempre que quiser.</li>
            </ol>
            <div style="margin-top: 16px; text-align: center;">
             ${payload.claimUrl
            ? `<a href="${payload.claimUrl}" style="background:#16a34a;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">ACEDER AGORA</a>`
            : `<a href="${APP_URL}/login" style="background:#16a34a;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">ENTRAR NA MINHA CONTA</a>`
        }
            </div>
        </div>
      `
        : `
        <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <h3 style="margin: 0 0 12px; color: #1d4ed8; font-size: 18px;">Acompanhar encomenda</h3>
            <p style="margin: 0 0 12px; color: #1e40af;">Pode acompanhar o estado da sua encomenda na sua área pessoal.</p>
            <ol style="margin: 0; padding-left: 20px; color: #1e3a8a; line-height: 1.6;">
                <li style="margin-bottom: 8px;">Aceda à sua área pessoal no nosso site.</li>
                <li>Se for a primeira vez, crie uma senha com este email.</li>
            </ol>
            <div style="margin-top: 16px; text-align: center;">
             ${payload.claimUrl
            ? `<a href="${payload.claimUrl}" style="background:#2563eb;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">ACOMPANHAR ENCOMENDA</a>`
            : `<a href="${APP_URL}/login" style="background:#2563eb;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">ENTRAR NA MINHA CONTA</a>`
        }
            </div>
        </div>
      `;

    return {
        subject: `Confirmação da encomenda ${payload.orderRef}`,
        html: renderEmailShell({
            title: 'Compra confirmada',
            subtitle: 'Loja do Apostolado',
            bodyHtml: `
        <p style="margin:0 0 6px;">Obrigado pela sua encomenda.</p>
        <p style="margin:0 0 16px;">Referência: ${payload.orderRef}</p>

        <div style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#f8fafc;margin:16px 0;">
          <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
            <tr><td style="padding: 6px 0; font-weight: 600;">Total Pago</td><td style="padding: 6px 0;">${payload.total}</td></tr>
          </table>
        </div>

        ${digitalNote}
        ${downloadSection}
        ${accessBlock}

        ${shippingBlock}
        ${billingBlock}
      `,
            footer: 'Se tiver alguma dificuldade, responda a este email que nós ajudamos.',
        }),
    };
};

export const renderStoreShippingEmail = (payload: {
    orderRef: string;
    buyerName?: string | null;
    tracking?: string | null;
    shippedAt?: string | null;
}) => {
    const trackingLine = payload.tracking
        ? `<p style="margin: 0 0 8px;">Tracking: <strong>${payload.tracking}</strong></p>`
        : '';
    const shippedLine = payload.shippedAt
        ? `<p style="margin: 0 0 8px;">Enviado em: ${formatDate(payload.shippedAt)}</p>`
        : '';

    return {
        subject: `Encomenda enviada - ${payload.orderRef}`,
        html: renderEmailShell({
            title: 'Encomenda enviada',
            subtitle: 'Estado do envio',
            bodyHtml: `
        <p style="margin:0 0 8px;">Referência: ${payload.orderRef}</p>
        ${trackingLine}
        ${shippedLine}
        <p style="margin: 12px 0 0;">Obrigado por apoiar o Apostolado de Garabandal.</p>
      `,
            footer: 'Se tiver dúvidas sobre a entrega, responda a este email.',
        }),
    };
};

export const renderStorePreparingEmail = (payload: {
    orderRef: string;
    buyerEmail: string;
    buyerName?: string | null;
}) => {
    const buyerLabel = payload.buyerName || 'Cliente';
    return {
        subject: `Encomenda em preparação - ${payload.orderRef}`,
        html: renderEmailShell({
            title: 'Encomenda em preparação',
            subtitle: 'Estado do envio',
            bodyHtml: `
        <p style="margin:0 0 8px;">Olá ${buyerLabel}, já recebemos o teu pedido.</p>
        <p style="margin:0 0 8px;">Referência: ${payload.orderRef}</p>
        <p style="margin: 12px 0 0;">Estamos a preparar o envio. Vais receber outro email quando for enviada.</p>
      `,
            footer: 'Obrigado pelo seu apoio ao Apostolado.',
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
    return {
        subject: `Confirmação de pré-reserva - ${payload.pilgrimageName}`,
        html: renderEmailShell({
            title: 'Pré-reserva confirmada',
            subtitle: payload.pilgrimageName,
            bodyHtml: `
        <p>A sua inscrição foi registada com sucesso.</p>
        <p>Taxa de inscrição: ${formatCurrency(payload.amount)}</p>
        <p>Total da peregrinação: ${formatCurrency(payload.totalAmount)}</p>
        <p>Para garantir o seu lugar, clique no botão abaixo para concluir o processo e efetuar o pagamento.</p>
        <div style="margin: 24px 0;">
          <a href="${payload.magicLink}" style="background:#d97706;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
            Aceder à Minha Reserva
          </a>
        </div>
      `,
            footer: 'Clique no botão acima para concluir a inscrição.',
        }),
    };
};

export const renderGeneralLeadEmail = (payload: GeneralLeadInput) => {
    return {
        subject: `Bem - vindo à lista de espera - Apostolado de Garabandal`,
        html: renderEmailShell({
            title: 'Bem-vindo(a)!',
            subtitle: 'Lista de Espera',
            bodyHtml: `
        < p > Olá < strong > ${payload.name || 'Peregrino'} </strong>,</p >
            <p>Agradecemos o seu interesse nas nossas peregrinações a Garabandal.</p>
                < p > Assim que tivermos novas datas ou roteiros que correspondam ao seu perfil, entraremos em contacto consigo prioritariamente.</p>

                    < hr style = "border:0; border-top:1px solid #e2e8f0; margin: 32px 0;" >

                        <h3 style="color:#0f172a; margin-bottom:16px;" > Enquanto aguarda...</h3>
                            < p > Convidamo - lo a aprofundar a Mensagem de Garabandal através dos nossos conteúdos exclusivos: </p>

                                < !--Recommended Content Grid-- >
                                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 24px;" >
                                        <a href="${APP_URL}/academia/mensagem-central" style = "text-decoration: none; color: inherit; display: block; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;" >
                                            <img src="https://images.unsplash.com/photo-1507692049790-de58293a4697?w=500&auto=format&fit=crop&q=60" alt = "A Mensagem" style = "width: 100%; height: 120px; object-fit: cover;" >
                                                <div style="padding: 16px;" >
                                                    <strong style="color: #0f172a; display: block; margin-bottom: 4px;" > A Mensagem Central </strong>
                                                        < span style = "font-size: 13px; color: #64748b;" > O que Nossa Senhora nos pediu em Garabandal.</span>
                                                            </div>
                                                            </a>
                                                            </div>

                                                            < div style = "margin-top: 32px; background: #0f172a; border-radius: 16px; padding: 32px; text-align: center; color: white;" >
                                                                <h3 style="margin: 0 0 12px; color: white;" > Visite a nossa Loja Oficial </h3>
                                                                    < p style = "color: #94a3b8; margin-bottom: 24px;" > Livros, terços e sacramentais oficiais do Apostolado.</p>
                                                                        < a href = "${APP_URL}/loja" style = "background: #d97706; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;" >
                                                                            Ver Produtos
                                                                                </a>
                                                                                </div>
                                                                                    `,
            footer: 'Será o primeiro a saber das novidades.'
        })
    };
};

export type AbandonmentRecoveryInput = {
    email: string;
    name: string;
    pilgrimageName: string;
    recoveryLink: string;
};

export const renderAbandonmentRecoveryEmail = (payload: AbandonmentRecoveryInput) => {
    return {
        subject: `A sua vaga para ${payload.pilgrimageName} `,
        html: renderEmailShell({
            title: 'Não deixe esta graça passar',
            subtitle: 'Retomar inscrição',
            bodyHtml: `
        < p style = "margin:0 0 12px;" > Olá ${payload.name}, </p>
            < p style = "margin:0 0 16px;" >
                Notámos que iniciou a sua inscrição para < strong > ${payload.pilgrimageName} </strong>, mas não chegou a finalizar.
                    </p>
                    < p style = "margin:0 0 16px;" >
                        Sabemos que às vezes a internet falha ou o dia a dia nos interrompe.Por isso, <strong>guardámos o seu lugar temporariamente </strong> para que não tenha de preencher tudo de novo.
                            </p>
                            < div style = "text-align:center;margin:32px 0;" >
                                <a href="${payload.recoveryLink}" style = "background-color:#ca8a04;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;" >
                                    RETOMAR INSCRIÇÃO
                                        </a>
                                        </div>
                                        < p style = "margin:0 0 12px;font-size:13px;color:#64748b;" >
                                            Se teve alguma dificuldade técnica, responda a este email e nós ajudamos.
                </p>
                                                    `,
            footer: 'Esperamos por si em Garabandal.',
        }),
    };
};

export const renderDonationNotification = (payload: DonationNotificationInput) => {
    const donorLabel = payload.donorName || payload.donorEmail || 'Doador';
    const amountText = formatCurrency(payload.amount, payload.currency || 'EUR');

    return {
        subject: `Nova doação - ${donorLabel} (${amountText})`,
        html: renderEmailShell({
            title: 'Nova doação recebida',
            subtitle: 'Apoio ao Apostolado',
            bodyHtml: `
        <p style="margin:0 0 16px;">Recebemos uma nova doação.</p>
        <div style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#f8fafc;">
          <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
            <tr><td style="padding: 6px 0; font-weight: 600;">Doador</td><td style="padding: 6px 0;">${donorLabel}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Email</td><td style="padding: 6px 0;">${payload.donorEmail || '-'}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Valor</td><td style="padding: 6px 0;">${amountText}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Método</td><td style="padding: 6px 0;">${payload.paymentMethod}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Estado</td><td style="padding: 6px 0;">${payload.status}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Referência</td><td style="padding: 6px 0;">${payload.paymentReference || '-'}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Descrição</td><td style="padding: 6px 0;">${payload.description || '-'}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Data</td><td style="padding: 6px 0;">${formatDate(payload.paidAt)}</td></tr>
          </table>
        </div>
      `,
            footer: 'Mensagem enviada automaticamente pelo sistema de doações.',
        }),
    };
};

export const renderBrochureEmail = (payload: BrochureEmailInput) => {
    return {
        subject: `O roteiro da sua viagem: ${payload.pilgrimageName}`,
        html: renderEmailShell({
            title: 'Aqui está o seu roteiro',
            subtitle: payload.pilgrimageName,
            bodyHtml: `
        <p>Olá <strong>${payload.name}</strong>,</p>
        <p>Conforme solicitado, enviamos o roteiro detalhado para a <strong>${payload.pilgrimageName}</strong>.</p>
        <p>Este documento contém todas as informações sobre o itinerário espiritual, alojamento e logística da viagem.</p>
        <div style="margin: 32px 0; text-align: center;">
          <a href="${payload.pdfUrl}" style="background:#d97706;color:#ffffff;padding:16px 32px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;box-shadow:0 4px 6px rgba(217,119,6,0.2);">
            DESCARREGAR ROTEIRO (PDF)
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px;">Se não conseguir abrir o botão acima, copie este link para o seu navegador: <br/> ${payload.pdfUrl}</p>
        <p style="margin-top: 24px;">Qualquer dúvida, basta responder a este email. Estamos à sua disposição.</p>
      `,
            footer: 'Apostolado de Garabandal - Uma jornada de fé e transformação.'
        })
    };
};

export const renderWelcomeEmail = (payload: { name: string; email: string }) => {
    return {
        subject: 'Bem-vindo ao Apostolado de Garabandal',
        html: renderEmailShell({
            title: 'Bem-vindo(a)!',
            subtitle: 'Concluiu o seu registo',
            bodyHtml: `
        <p>Olá <strong>${payload.name || 'Peregrino'}</strong>,</p>
        <p>A sua conta foi ativada com sucesso. Agora já pode aceder a todos os conteúdos exclusivos do nosso Apostolado.</p>
        <div style="margin: 32px 0; text-align: center;">
          <a href="${APP_URL}/login" style="background:#0f172a;color:#ffffff;padding:16px 32px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">
            ENTRAR NA MINHA CONTA
          </a>
        </div>
        <p>Que Nossa Senhora o(a) proteja e guie nesta caminhada espiritual.</p>
      `,
            footer: 'Apostolado de Garabandal - Uma jornada de fé e transformação.'
        })
    };
};

// --- Membership Lifecycle Emails ---

export const renderQuotaWarningEmail = (payload: { name: string; email: string; daysRemaining: number; payLink: string }) => {
    return {
        subject: `A sua quota vence em ${payload.daysRemaining} dias`,
        html: renderEmailShell({
            title: 'Aviso de Vencimento',
            subtitle: 'Quota Anual',
            bodyHtml: `
        <p>Olá <strong>${payload.name}</strong>,</p>
        <p>Gostaríamos de lembrar que a validade da sua quota anual termina em <strong>${payload.daysRemaining} dias</strong>.</p>
        <p>Para continuar a usufruir de todos os benefícios de membro e apoiar a nossa missão, por favor renove a sua subscrição.</p>
        <div style="margin: 32px 0; text-align: center;">
          <a href="${payload.payLink}" style="background:#d97706;color:#ffffff;padding:16px 32px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">
            RENOVAR AGORA
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px;">Se já efetuou o pagamento, por favor ignore este email.</p>
      `,
            footer: 'Evite a perda de acesso aos conteúdos exclusivos.'
        })
    };
};

export const renderQuotaOverdueEmail = (payload: { name: string; email: string; payLink: string }) => {
    return {
        subject: 'A sua quota venceu - Regularize a situação',
        html: renderEmailShell({
            title: 'Quota Vencida',
            subtitle: 'Período de Tolerância',
            bodyHtml: `
        <p>Olá <strong>${payload.name}</strong>,</p>
        <p>Informamos que a sua quota anual venceu. Entrou agora no <strong>período de tolerância de 30 dias</strong>.</p>
        <p>Durante este período, mantém o seu estatuto de membro, mas se não regularizar a situação até ao fim do prazo, o seu acesso será suspenso automaticamente.</p>
        <div style="margin: 32px 0; text-align: center;">
          <a href="${payload.payLink}" style="background:#ef4444;color:#ffffff;padding:16px 32px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">
            REGULARIZAR QUOTA
          </a>
        </div>
      `,
            footer: 'Regularize hoje para evitar a suspensão.'
        })
    };
};

export const renderMembershipRevokedEmail = (payload: { name: string; email: string; payLink: string }) => {
    return {
        subject: 'Estatuto de membro suspenso',
        html: renderEmailShell({
            title: 'Conta Suspensa',
            subtitle: 'Quota em Atraso',
            bodyHtml: `
        <p>Olá <strong>${payload.name}</strong>,</p>
        <p>Como não regularizou a sua quota após o período de tolerância, o seu estatuto de membro foi <strong>suspenso</strong>.</p>
        <p>A partir de hoje, perde o acesso aos conteúdos exclusivos e benefícios de membro.</p>
        <p><strong>Mas não se preocupe!</strong> Pode reativar a sua conta instantaneamente a qualquer momento fazendo o pagamento da quota.</p>
        <div style="margin: 32px 0; text-align: center;">
          <a href="${payload.payLink}" style="background:#0f172a;color:#ffffff;padding:16px 32px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">
            REATIVAR CONTA AGORA
          </a>
        </div>
      `,
            footer: 'Esperamos tê-lo de volta em breve.'
        })
    };
};
