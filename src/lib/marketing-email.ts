import { Resend } from 'resend';
import {
  MARKETING_EMAIL_TEMPLATES,
  renderMarketingTemplateEmail,
  type MarketingTemplatePayload,
} from './email-renderer';
import type { MarketingContact } from './marketing-core';
import { isInternalMemberEmail } from './marketing-core';
import { APP_URL } from './config';
import { createUnsubscribeToken } from './unsubscribe-token';

const buildUnsubscribeUrl = (email: string, language?: string | null) => {
  const { e, t } = createUnsubscribeToken(email);
  const path = language === 'en' ? '/en/unsubscribe' : '/cancelar-subscricao';
  return `${APP_URL}${path}?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`;
};

const resendApiKey = process.env.RESEND_API_KEY;
const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

const formatFromWithBrand = (raw?: string | null) => {
  const value = (raw || '').trim();
  if (!value) return 'Apostolado de Garabandal <no-reply@apostoladodegarabandal.com>';
  const match = value.match(/<([^>]+)>/);
  if (match?.[1]) return `Apostolado de Garabandal <${match[1].trim()}>`;
  return `Apostolado de Garabandal <${value}>`;
};

const notifyFrom = formatFromWithBrand(process.env.NOTIFY_EMAIL_FROM);

export type MarketingEmailInput = {
  contact: Pick<
    MarketingContact,
    'display_name' | 'normalized_email' | 'language' | 'recommendation'
  >;
  subject?: string | null;
  body?: string | null;
  templateKey?: string | null;
  context?: Partial<MarketingTemplatePayload>;
};

export const listMarketingEmailTemplates = () =>
  Object.values(MARKETING_EMAIL_TEMPLATES).map((template) => ({
    key: template.key,
    name: template.name,
    category: template.category,
    goal: template.goal,
    description: template.goal,
    defaultSubject: template.defaultSubject,
    previewText: template.previewText,
    requiredVariables: template.requiredVariables,
  }));

export const buildMarketingTemplatePayload = (input: MarketingEmailInput): MarketingTemplatePayload => ({
  templateKey: input.templateKey || 'brochure_followup_1',
  name: input.contact.display_name,
  email: input.contact.normalized_email,
  language: input.contact.language,
  recommendation: input.contact.recommendation,
  subjectOverride: input.subject || null,
  bodyOverride: input.body || null,
  unsubscribeUrl: input.contact.normalized_email
    ? buildUnsubscribeUrl(input.contact.normalized_email, input.contact.language)
    : null,
  ...input.context,
});

export const renderMarketingEmail = (input: MarketingEmailInput) =>
  renderMarketingTemplateEmail(buildMarketingTemplatePayload(input));

export const sendMarketingEmail = async (input: MarketingEmailInput) => {
  if (!input.contact.normalized_email) {
    return { sent: false, error: 'Contacto sem email.' };
  }
  if (isInternalMemberEmail(input.contact.normalized_email)) {
    return { sent: false, error: 'Email técnico interno; envio bloqueado.' };
  }
  if (!resendClient) {
    return { sent: false, error: 'RESEND_API_KEY não configurada.' };
  }

  const rendered = renderMarketingEmail(input);
  const { e, t } = createUnsubscribeToken(input.contact.normalized_email);
  const oneClickUrl = `${APP_URL}/api/marketing/unsubscribe?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`;
  const result = await resendClient.emails.send({
    from: notifyFrom,
    to: [input.contact.normalized_email],
    subject: rendered.subject,
    html: rendered.html,
    headers: {
      // RFC 8058 one-click unsubscribe — improves deliverability (Gmail/Outlook).
      'List-Unsubscribe': `<${oneClickUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });

  const providerError =
    typeof result === 'object' && result && 'error' in result && result.error
      ? String((result.error as { message?: string })?.message || result.error)
      : null;
  if (providerError) {
    return { sent: false, error: providerError, subject: rendered.subject, templateKey: rendered.templateKey };
  }

  const providerId =
    typeof result === 'object' && result && 'data' in result && result.data && typeof result.data === 'object'
      ? (result.data as { id?: string }).id
      : undefined;

  return { sent: true, providerId: providerId || null, subject: rendered.subject, templateKey: rendered.templateKey };
};
