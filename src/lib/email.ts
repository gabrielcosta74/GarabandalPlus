import { Resend } from 'resend';
import {
  renderMembershipEmail,
  renderMemberReceiptEmail,
  renderMemberDiplomaEmail,
  renderDonationReceiptEmail,
  renderQuotaReminderEmail,
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
  shippedAt?: string | null;
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
