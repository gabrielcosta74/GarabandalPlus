import { Resend } from 'resend';
import {
  renderMembershipEmail,
  renderMemberReceiptEmail,
  renderMemberDiplomaEmail,
  renderDonationReceiptEmail,
  renderQuotaReminderEmail,
  renderPilgrimagePaymentReminderEmail,
  renderStoreOwnerEmail,
  renderStoreBuyerEmail,
  renderStoreShippingEmail,
  renderStorePreparingEmail,
  renderGeneralLeadEmail,
  renderAbandonmentRecoveryEmail,
  renderBookingConfirmationEmail,
  renderDonationNotification,
  renderBrochureEmail,
  renderQuotaWarningEmail,
  renderQuotaOverdueEmail,
  renderMembershipRevokedEmail,
  renderWelcomeEmail,
  renderAuctionOutbidEmail,
  renderAuctionWinnerEmail,
  renderAuctionAdminNotificationEmail,
  renderAuctionPaymentConfirmedEmail,
  renderBookingAdminNotification,
  // Types
  MembershipNotificationInput,
  MemberReceiptInput,
  MemberDiplomaInput,
  DonationReceiptInput,
  QuotaReminderInput,
  PilgrimagePaymentReminderInput,
  StoreItem,
  GeneralLeadInput,
  AbandonmentRecoveryInput,
  DonationNotificationInput,
  BrochureEmailInput,
  AuctionOutbidInput,
  AuctionWinnerInput,
  AuctionAdminNotificationInput,
  AuctionPaymentConfirmedInput,
  BookingAdminNotificationInput,
} from './email-renderer';

// Re-export specific types if needed by other files (though best to import from renderer)
// But for compatibility let's export them here for now if other files use them
export type {
  MembershipNotificationInput,
  MemberReceiptInput,
  MemberDiplomaInput,
  DonationReceiptInput,
  QuotaReminderInput,
  PilgrimagePaymentReminderInput,
  StoreItem,
  GeneralLeadInput,
  AbandonmentRecoveryInput,
  DonationNotificationInput,
  AuctionOutbidInput,
  AuctionWinnerInput,
  AuctionAdminNotificationInput,
  AuctionPaymentConfirmedInput,
  BookingAdminNotificationInput,
} from './email-renderer';

// Re-export renderers for use in server-side contexts if needed (legacy support)
export {
  renderMembershipEmail,
  renderMemberReceiptEmail,
  renderMemberDiplomaEmail,
  renderDonationReceiptEmail,
  renderQuotaReminderEmail,
  renderPilgrimagePaymentReminderEmail,
  renderStoreOwnerEmail,
  renderStoreBuyerEmail,
  renderStoreShippingEmail,
  renderStorePreparingEmail,
  renderGeneralLeadEmail,
  renderAbandonmentRecoveryEmail,
  renderBookingConfirmationEmail,
  renderDonationNotification,
  renderBrochureEmail,
  renderBookingAdminNotification,
} from './email-renderer';


const resendApiKey = process.env.RESEND_API_KEY;
const notifyTo = process.env.NOTIFY_EMAIL_TO || 'geral@apostoladodegarabandal.com';
const formatFromWithBrand = (raw?: string | null) => {
  const value = (raw || '').trim();
  if (!value) return 'Apostolado de Garabandal <no-reply@apostoladodegarabandal.com>';

  const hasDisplayName = value.includes('<') && value.includes('>');
  if (hasDisplayName) {
    // Ensure the visible sender name is always branded.
    const match = value.match(/<([^>]+)>/);
    const address = match?.[1]?.trim();
    if (address) return `Apostolado de Garabandal <${address}>`;
  }

  // Raw email in env (without display name)
  return `Apostolado de Garabandal <${value}>`;
};
const notifyFrom = formatFromWithBrand(process.env.NOTIFY_EMAIL_FROM);
const storeOwnerEmail = process.env.STORE_OWNER_EMAIL || notifyTo;

const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

// Sending Functions that use the Renderers

export const sendMembershipNotification = async (payload: MembershipNotificationInput) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const content = renderMembershipEmail(payload);
  await resendClient.emails.send({
    from: notifyFrom,
    to: [notifyTo],
    subject: content.subject,
    html: content.html,
  });
  return true;
};

export const sendMemberReceiptEmail = async (payload: MemberReceiptInput) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const attachmentsInfo = payload.attachments?.map((attachment) => ({
    filename: attachment.filename,
    size: typeof attachment.content === 'string' ? attachment.content.length : attachment.content?.length,
    contentType: attachment.contentType,
  }));
  console.log('Enviar email inscricao confirmada:', {
    to: payload.toEmail,
    hasDiploma: payload.hasDiploma,
    attachments: attachmentsInfo,
  });

  const content = renderMemberReceiptEmail(payload);
  await resendClient.emails.send({
    from: notifyFrom,
    to: [payload.toEmail],
    subject: content.subject,
    html: content.html,
    attachments: payload.attachments,
  });
  return true;
};

export const sendMemberDiplomaEmail = async (payload: MemberDiplomaInput) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const content = renderMemberDiplomaEmail(payload);
  await resendClient.emails.send({
    from: notifyFrom,
    to: [payload.toEmail],
    subject: content.subject,
    html: content.html,
    attachments: payload.attachments,
  });
  return true;
};

export const sendDonationReceiptEmail = async (payload: DonationReceiptInput) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const content = renderDonationReceiptEmail(payload);
  await resendClient.emails.send({
    from: notifyFrom,
    to: [payload.toEmail],
    subject: content.subject,
    html: content.html,
  });
  return true;
};


export const sendQuotaReminderEmail = async (payload: QuotaReminderInput) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const content = renderQuotaReminderEmail(payload);
  await resendClient.emails.send({
    from: notifyFrom,
    to: [payload.toEmail],
    subject: content.subject,
    html: content.html,
    attachments: [], // Fix: ensure attachments is passed or undefined, but rendering doesn't need it.
  });
  return true;
};

export const sendPilgrimagePaymentReminderEmail = async (payload: PilgrimagePaymentReminderInput) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const content = renderPilgrimagePaymentReminderEmail(payload);
  await resendClient.emails.send({
    from: notifyFrom,
    to: [payload.toEmail],
    subject: content.subject,
    html: content.html,
  });
  return true;
};

export const sendStoreOwnerEmail = async (payload: {
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
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const content = renderStoreOwnerEmail(payload);
  await resendClient.emails.send({
    from: notifyFrom,
    to: [storeOwnerEmail],
    subject: content.subject,
    html: content.html,
  });
  return true;
};

export const sendStoreBuyerEmail = async (payload: {
  orderRef: string;
  buyerEmail: string;
  buyerName?: string | null;
  buyerNif?: string | null;
  subtotal: string;
  vat: string;
  shippingCost?: string | null;
  total: string;
  items?: StoreItem[];
  hasDigital?: boolean;
  claimUrl?: string | null;
  downloadLinks?: Array<{ name: string; url: string }>;
  accountExists?: boolean | null;
  showClaimCta?: boolean;
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
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const content = renderStoreBuyerEmail(payload);
  await resendClient.emails.send({
    from: notifyFrom,
    to: [payload.buyerEmail],
    subject: content.subject,
    html: content.html,
  });
  return true;
};

export const sendStoreShippingEmail = async (payload: {
  orderRef: string;
  buyerEmail: string;
  buyerName?: string | null;
  tracking?: string | null;
  carrierName?: string | null;
  carrierId?: string | null;
  shippedAt?: string | null;
  shippingAddress?: string | null;
  items?: Array<{ name: string; qty: number; unit_price: number }>;
  totalAmount?: number;
  currency?: string;
}) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const content = renderStoreShippingEmail(payload);
  await resendClient.emails.send({
    from: notifyFrom,
    to: [payload.buyerEmail],
    subject: content.subject,
    html: content.html,
  });
  return true;
};


export const sendStorePreparingEmail = async (payload: {
  orderRef: string;
  buyerEmail: string;
  buyerName?: string | null;
}) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const content = renderStorePreparingEmail(payload);
  await resendClient.emails.send({
    from: notifyFrom,
    to: [payload.buyerEmail],
    subject: content.subject,
    html: content.html,
  });
  return true;
};

export const sendGeneralLeadEmail = async (payload: GeneralLeadInput) => {
  if (!resendClient) {
    console.warn('Resend nao configurado.');
    return false;
  }

  const content = renderGeneralLeadEmail(payload);
  await resendClient.emails.send({
    from: notifyFrom,
    to: [payload.email],
    subject: content.subject,
    html: content.html,
  });
  return true;

};

export const sendWelcomeEmail = async (payload: { name: string; email: string }) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const content = renderWelcomeEmail(payload);
  await resendClient.emails.send({
    from: notifyFrom,
    to: [payload.email],
    subject: content.subject,
    html: content.html,
  });
  return true;
};

export const sendBrochureEmail = async (payload: BrochureEmailInput) => {
  if (!resendClient) {
    console.warn('Resend nao configurado.');
    return false;
  }

  const content = renderBrochureEmail(payload);
  await resendClient.emails.send({
    from: notifyFrom,
    to: [payload.email],
    subject: content.subject,
    html: content.html,
  });
  return true;
};

export const sendAbandonmentRecoveryEmail = async (payload: AbandonmentRecoveryInput) => {
  if (!resendClient) {
    console.warn('Resend nao configurado.');
    return false;
  }

  console.log(`[Email] Sending abandonment recovery to ${payload.email} for ${payload.pilgrimageName}`);
  const content = renderAbandonmentRecoveryEmail(payload);

  try {
    await resendClient.emails.send({
      from: notifyFrom,
      to: [payload.email],
      subject: content.subject,
      html: content.html,
    });
    console.log(`[Email] Successfully sent abandonment recovery to ${payload.email}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send abandonment recovery:`, error);
    throw error;
  }
};


export const sendBookingConfirmationEmail = async (payload: {
  bookingId: string;
  email: string;
  pilgrimageName: string;
  amount: number;
  totalAmount: number;
  paymentMethod: string;
  magicLink: string;
}) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const content = renderBookingConfirmationEmail(payload);
  await resendClient.emails.send({
    from: notifyFrom,
    to: [payload.email],
    subject: content.subject,
    html: content.html,
  });
  return true;
};

export const sendDonationNotification = async (payload: DonationNotificationInput) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const content = renderDonationNotification(payload);
  await resendClient.emails.send({
    from: notifyFrom,
    to: [notifyTo],
    subject: content.subject,
    html: content.html,
  });
  return true;
};

export const sendQuotaWarningEmail = async (payload: { name: string; email: string; daysRemaining: number; payLink: string }) => {
  if (!resendClient) return false;
  const content = renderQuotaWarningEmail(payload);
  await resendClient.emails.send({ from: notifyFrom, to: [payload.email], subject: content.subject, html: content.html });
  return true;
};

export const sendQuotaOverdueEmail = async (payload: { name: string; email: string; payLink: string }) => {
  if (!resendClient) return false;
  const content = renderQuotaOverdueEmail(payload);
  await resendClient.emails.send({ from: notifyFrom, to: [payload.email], subject: content.subject, html: content.html });
  return true;
};

export const sendMembershipRevokedEmail = async (payload: { name: string; email: string; payLink: string }) => {
  if (!resendClient) return false;
  const content = renderMembershipRevokedEmail(payload);
  await resendClient.emails.send({ from: notifyFrom, to: [payload.email], subject: content.subject, html: content.html });
  return true;
};

export const sendAuthMagicLinkEmail = async (payload: { email: string; magicLink: string }) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  await resendClient.emails.send({
    from: notifyFrom,
    to: [payload.email],
    subject: 'Link de acesso à sua conta',
    html: `
      <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <h2 style="margin: 0 0 12px;">Acesso à sua conta</h2>
        <p style="margin: 0 0 16px;">Clique no botão abaixo para entrar em segurança.</p>
        <p style="margin: 0 0 24px;">
          <a href="${payload.magicLink}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#ca8a04;color:#fff;text-decoration:none;font-weight:700;">
            Entrar na conta
          </a>
        </p>
        <p style="margin: 0; color: #475569; font-size: 13px;">
          Se não solicitou este acesso, pode ignorar este email.
        </p>
      </div>
    `,
  });

  return true;
};

export const sendAuthRecoveryEmail = async (payload: { email: string; recoveryLink: string }) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  await resendClient.emails.send({
    from: notifyFrom,
    to: [payload.email],
    subject: 'Recuperação de password da sua conta',
    html: `
      <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <h2 style="margin: 0 0 12px;">Recuperar password</h2>
        <p style="margin: 0 0 16px;">Clique no botão abaixo para definir uma nova password em segurança.</p>
        <p style="margin: 0 0 24px;">
          <a href="${payload.recoveryLink}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#ca8a04;color:#fff;text-decoration:none;font-weight:700;">
            Definir nova password
          </a>
        </p>
        <p style="margin: 0; color: #475569; font-size: 13px;">
          Se não solicitou esta recuperação, pode ignorar este email.
        </p>
      </div>
    `,
  });

  return true;
};

export const sendBookingAccessLinkEmail = async (payload: {
  email: string;
  accessLink: string;
  pilgrimageName?: string | null;
}) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const title = payload.pilgrimageName
    ? `Acesso à sua inscrição - ${payload.pilgrimageName}`
    : 'Acesso à sua inscrição';

  await resendClient.emails.send({
    from: notifyFrom,
    to: [payload.email],
    subject: title,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <h2 style="margin: 0 0 12px;">${title}</h2>
        <p style="margin: 0 0 16px;">Use o botão abaixo para abrir a sua inscrição com acesso seguro.</p>
        <p style="margin: 0 0 24px;">
          <a href="${payload.accessLink}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#ca8a04;color:#fff;text-decoration:none;font-weight:700;">
            Ver minha inscrição
          </a>
        </p>
        <p style="margin: 0; color: #475569; font-size: 13px;">
          Se não solicitou este acesso, pode ignorar este email.
        </p>
      </div>
    `,
  });

  return true;
};

// ── Auction Emails ──

export const sendAuctionOutbidEmail = async (payload: AuctionOutbidInput) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const content = renderAuctionOutbidEmail(payload);
  try {
    await resendClient.emails.send({
      from: notifyFrom,
      to: [payload.email],
      subject: content.subject,
      html: content.html,
    });
    console.log(`[Auction Email] Outbid notification sent to ${payload.email}`);
    return true;
  } catch (error) {
    console.error('[Auction Email] Failed to send outbid email:', error);
    return false;
  }
};

export const sendAuctionWinnerEmail = async (payload: AuctionWinnerInput) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const content = renderAuctionWinnerEmail(payload);
  try {
    await resendClient.emails.send({
      from: notifyFrom,
      to: [payload.email],
      subject: content.subject,
      html: content.html,
    });
    console.log(`[Auction Email] Winner notification sent to ${payload.email}`);
    return true;
  } catch (error) {
    console.error('[Auction Email] Failed to send winner email:', error);
    return false;
  }
};

export const sendAuctionAdminNotification = async (payload: AuctionAdminNotificationInput) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const content = renderAuctionAdminNotificationEmail(payload);
  try {
    await resendClient.emails.send({
      from: notifyFrom,
      to: [notifyTo],
      subject: content.subject,
      html: content.html,
    });
    console.log(`[Auction Email] Admin notification sent for "${payload.itemTitle}"`);
    return true;
  } catch (error) {
    console.error('[Auction Email] Failed to send admin notification:', error);
    return false;
  }
};

export const sendAuctionPaymentConfirmedEmail = async (payload: AuctionPaymentConfirmedInput & { toEmail: string }) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const content = renderAuctionPaymentConfirmedEmail(payload);
  await resendClient.emails.send({
    from: notifyFrom,
    to: [payload.toEmail],
    subject: content.subject,
    html: content.html,
  });
  return true;
};

export const sendBookingAdminNotification = async (payload: BookingAdminNotificationInput) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const content = renderBookingAdminNotification(payload);
  await resendClient.emails.send({
    from: notifyFrom,
    to: [notifyTo],
    subject: content.subject,
    html: content.html,
  });
  return true;
};

// ─── Admin Bank Transfer Alert ────────────────────────────────────────────────

export interface AdminBankTransferAlertInput {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  pilgrimageName: string;
  totalAmount: number;
  numberOfPilgrims: number;
  bookingDate: string;
}

export const sendAdminBankTransferAlert = async (payload: AdminBankTransferAlertInput) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  const formattedAmount = new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(payload.totalAmount);

  const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.apostoladodegarabandal.com'}/admin/peregrinacoes`;

  const html = `
    <!DOCTYPE html>
    <html lang="pt">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f1f5f9; margin:0; padding:20px;">
      <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 6px rgba(0,0,0,0.07);">
        <div style="background:#b45309; padding:28px 32px;">
          <p style="color:#fef3c7; font-size:13px; font-weight:700; letter-spacing:2px; text-transform:uppercase; margin:0 0 6px;">Apostolado de Garabandal</p>
          <h1 style="color:#fff; font-size:22px; font-weight:800; margin:0;">🏦 Nova Transferência Bancária</h1>
        </div>
        <div style="padding:28px 32px;">
          <p style="color:#475569; font-size:15px; margin:0 0 20px;">Um peregrino efetuou uma inscrição via <strong>Transferência Bancária</strong>. <strong>Por favor, verifique se o dinheiro entrou na conta bancária</strong> e confirme o pagamento manualmente no painel.</p>
          <div style="background:#fffbeb; border:1px solid #fcd34d; border-radius:12px; padding:20px; margin-bottom:20px;">
            <table style="width:100%; border-collapse:collapse;">
              <tr><td style="padding:6px 0; color:#92400e; font-size:13px; font-weight:600;">Peregrino</td><td style="padding:6px 0; color:#1e293b; font-size:14px; font-weight:700; text-align:right;">${payload.customerName}</td></tr>
              <tr><td style="padding:6px 0; color:#92400e; font-size:13px; font-weight:600;">Email</td><td style="padding:6px 0; color:#1e293b; font-size:14px; text-align:right;">${payload.customerEmail}</td></tr>
              <tr><td style="padding:6px 0; color:#92400e; font-size:13px; font-weight:600;">Peregrinação</td><td style="padding:6px 0; color:#1e293b; font-size:14px; text-align:right;">${payload.pilgrimageName}</td></tr>
              <tr><td style="padding:6px 0; color:#92400e; font-size:13px; font-weight:600;">N.º Peregrinos</td><td style="padding:6px 0; color:#1e293b; font-size:14px; text-align:right;">${payload.numberOfPilgrims}</td></tr>
              <tr><td style="padding:6px 0; color:#92400e; font-size:13px; font-weight:600;">Valor Total</td><td style="padding:6px 0; color:#b45309; font-size:18px; font-weight:800; text-align:right;">${formattedAmount}</td></tr>
            </table>
          </div>
          <a href="${adminUrl}" style="display:block; background:#b45309; color:#fff; text-align:center; padding:14px 24px; border-radius:10px; font-weight:700; font-size:15px; text-decoration:none;">Ir para o Painel de Admin</a>
        </div>
        <div style="padding:16px 32px; background:#f8fafc; border-top:1px solid #e2e8f0; text-align:center;">
          <p style="color:#94a3b8; font-size:12px; margin:0;">Apostolado de Garabandal · app.apostoladodegarabandal.com</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await resendClient.emails.send({
    from: notifyFrom,
    to: [notifyTo],
    subject: `🏦 Nova Transferência Bancária — ${payload.customerName} (${payload.pilgrimageName})`,
    html,
  });
  return true;
};
