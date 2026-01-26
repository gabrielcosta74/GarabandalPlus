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
  BrochureEmailInput
} from './email-renderer';
import type { FactPtSourceType } from './factpt';

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
  DonationNotificationInput
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
  renderBrochureEmail
} from './email-renderer';


const resendApiKey = process.env.RESEND_API_KEY;
const notifyTo = process.env.NOTIFY_EMAIL_TO || 'geral@apostoladodegarabandal.com';
const notifyFrom = process.env.NOTIFY_EMAIL_FROM || 'Apostolado <no-reply@apostoladodegarabandal.com>';
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
  hasDigital?: boolean;
  libraryUrl?: string | null;
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

type FactPtEmailPayload = {
  recipientName?: string | null;
  documentId: string;
  documentUrl?: string | null;
  sourceType: FactPtSourceType;
  sourceRef: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
};

const formatFactPtSource = (sourceType: FactPtSourceType) => {
  switch (sourceType) {
    case 'store':
      return 'Loja';
    case 'donation':
      return 'Doacao';
    case 'membership':
      return 'Quota';
    default:
      return sourceType;
  }
};

const buildFactPtEmailHtml = (payload: FactPtEmailPayload) => {
  const recipient = payload.recipientName || 'Cliente';
  const sourceLabel = formatFactPtSource(payload.sourceType);
  const documentLink = payload.documentUrl
    ? `<p style="margin: 8px 0;">Link do documento: <a href="${payload.documentUrl}" style="color:#1e63f0;font-weight:600;">${payload.documentUrl}</a></p>`
    : '';

  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #111827;">
      <p style="margin: 0 0 8px;">Ola ${recipient},</p>
      <p style="margin: 0 0 8px;">Segue em anexo o documento de faturacao emitido no fact.pt.</p>
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin: 12px 0;">
        <p style="margin: 0 0 6px;"><strong>Documento:</strong> ${payload.documentId}</p>
        <p style="margin: 0 0 6px;"><strong>Origem:</strong> ${sourceLabel} (${payload.sourceRef})</p>
      </div>
      ${documentLink}
      <p style="margin: 16px 0 0; color: #6b7280; font-size: 12px;">Se tiver duvidas, responda a este email.</p>
    </div>
  `;
};

export const sendFactPtClientDocumentEmail = async (
  payload: FactPtEmailPayload & { toEmail: string },
) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  await resendClient.emails.send({
    from: notifyFrom,
    to: [payload.toEmail],
    subject: `Documento de faturacao - ${payload.documentId}`,
    html: buildFactPtEmailHtml(payload),
    attachments: payload.attachments,
  });
  return true;
};

export const sendFactPtAdminDocumentEmail = async (payload: FactPtEmailPayload) => {
  if (!resendClient) {
    console.warn('Resend nao configurado. Ignorar envio de email.');
    return false;
  }

  await resendClient.emails.send({
    from: notifyFrom,
    to: [notifyTo],
    subject: `fact.pt emitido - ${payload.documentId}`,
    html: buildFactPtEmailHtml(payload),
    attachments: payload.attachments,
  });
  return true;
};
