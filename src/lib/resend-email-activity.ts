export type EmailCategoryKey =
  | 'pilgrimages'
  | 'members'
  | 'store'
  | 'donations'
  | 'auctions'
  | 'other';

export type EmailActivityStatusKey =
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'failed'
  | 'complained'
  | 'scheduled'
  | 'delivery_delayed'
  | 'suppressed'
  | 'canceled'
  | 'unknown';

export type ResendEmailActivityItem = {
  id: string;
  to: string[];
  from: string;
  subject: string;
  createdAt: string;
  lastEvent: EmailActivityStatusKey;
  scheduledAt: string | null;
  category: EmailCategoryKey;
  categoryLabel: string;
};

export type ResendEmailActivityDetail = ResendEmailActivityItem & {
  html: string | null;
  text: string | null;
  raw: Record<string, unknown>;
};

const CATEGORY_LABELS: Record<EmailCategoryKey, string> = {
  pilgrimages: 'Peregrinações & Leads',
  members: 'Membros & Quotas',
  store: 'Loja Online',
  donations: 'Doações',
  auctions: 'Leilão',
  other: 'Outros',
};

const normalizeText = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const toArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }

  const single = String(value || '').trim();
  return single ? [single] : [];
};

export const inferEmailCategory = (subject: string, from?: string | null): EmailCategoryKey => {
  const haystack = `${normalizeText(subject)} ${normalizeText(from)}`;

  if (
    /(peregrin|inscric|roteiro|garabandal|lista de espera|espera|lead|retoma|brochura)/.test(
      haystack,
    )
  ) {
    return 'pilgrimages';
  }

  if (/(quota|membro|membros|renov|adesao|diploma|boas vindas|boas-vindas|socio)/.test(haystack)) {
    return 'members';
  }

  if (/(encomenda|loja|tracking|envio|preparac|shipping|order|checkout)/.test(haystack)) {
    return 'store';
  }

  if (/(doa|donativ|benfeit)/.test(haystack)) {
    return 'donations';
  }

  if (/(leilao|auction|licit)/.test(haystack)) {
    return 'auctions';
  }

  return 'other';
};

export const getEmailCategoryLabel = (category: EmailCategoryKey) => CATEGORY_LABELS[category];

export const normalizeEmailActivityStatus = (value: unknown): EmailActivityStatusKey => {
  const normalized = normalizeText(value).replace(/\s+/g, '_');

  switch (normalized) {
    case 'sent':
    case 'delivered':
    case 'opened':
    case 'clicked':
    case 'bounced':
    case 'failed':
    case 'complained':
    case 'scheduled':
    case 'delivery_delayed':
    case 'suppressed':
    case 'canceled':
      return normalized;
    default:
      return 'unknown';
  }
};

export const getEmailStatusLabel = (status: EmailActivityStatusKey) => {
  switch (status) {
    case 'sent':
      return 'Enviado';
    case 'delivered':
      return 'Entregue';
    case 'opened':
      return 'Aberto';
    case 'clicked':
      return 'Clicado';
    case 'bounced':
      return 'Rejeitado';
    case 'failed':
      return 'Falhou';
    case 'complained':
      return 'Spam';
    case 'scheduled':
      return 'Agendado';
    case 'delivery_delayed':
      return 'Atrasado';
    case 'suppressed':
      return 'Suprimido';
    case 'canceled':
      return 'Cancelado';
    default:
      return 'Sem estado';
  }
};

export const normalizeResendEmailActivityItem = (raw: Record<string, unknown>): ResendEmailActivityItem => {
  const subject = String(raw.subject || 'Sem assunto').trim() || 'Sem assunto';
  const from = String(raw.from || '').trim();
  const category = inferEmailCategory(subject, from);

  return {
    id: String(raw.id || '').trim(),
    to: toArray(raw.to),
    from,
    subject,
    createdAt: String(raw.created_at || raw.createdAt || '').trim(),
    lastEvent: normalizeEmailActivityStatus(raw.last_event || raw.lastEvent),
    scheduledAt: raw.scheduled_at ? String(raw.scheduled_at) : raw.scheduledAt ? String(raw.scheduledAt) : null,
    category,
    categoryLabel: getEmailCategoryLabel(category),
  };
};

export const normalizeResendEmailActivityDetail = (
  raw: Record<string, unknown>,
): ResendEmailActivityDetail => {
  const base = normalizeResendEmailActivityItem(raw);
  const html = typeof raw.html === 'string'
    ? raw.html
    : typeof raw.html_content === 'string'
      ? String(raw.html_content)
      : null;
  const text = typeof raw.text === 'string'
    ? raw.text
    : typeof raw.text_content === 'string'
      ? String(raw.text_content)
      : null;

  return {
    ...base,
    html,
    text,
    raw,
  };
};

export const buildEmailActivitySummary = (emails: ResendEmailActivityItem[]) => {
  const systemsMap = new Map<EmailCategoryKey, { key: EmailCategoryKey; label: string; count: number; lastSentAt: string | null }>();

  for (const email of emails) {
    const current = systemsMap.get(email.category) || {
      key: email.category,
      label: email.categoryLabel,
      count: 0,
      lastSentAt: null,
    };

    current.count += 1;
    if (!current.lastSentAt || (email.createdAt && email.createdAt > current.lastSentAt)) {
      current.lastSentAt = email.createdAt || current.lastSentAt;
    }
    systemsMap.set(email.category, current);
  }

  return {
    total: emails.length,
    delivered: emails.filter((email) => email.lastEvent === 'delivered').length,
    opened: emails.filter((email) => email.lastEvent === 'opened').length,
    clicked: emails.filter((email) => email.lastEvent === 'clicked').length,
    failed: emails.filter((email) => email.lastEvent === 'failed').length,
    bounced: emails.filter((email) => email.lastEvent === 'bounced').length,
    systems: Array.from(systemsMap.values()).sort((left, right) => right.count - left.count),
  };
};

export const formatRecipientList = (recipients: string[]) => {
  if (!recipients.length) return 'Sem destinatário';
  if (recipients.length === 1) return recipients[0];
  return `${recipients[0]} +${recipients.length - 1}`;
};

