export type FactptEnvironment = 'production' | 'sandbox';

export type FactptStatus =
  | 'awaiting_approval'
  | 'pending'
  | 'needs_data'
  | 'processing'
  | 'issued'
  | 'failed'
  | 'email_failed';

export type FactptSourceType = 'quota' | 'store' | 'donation' | 'pilgrimage';

export type FactptCustomer = {
  name: string | null;
  email: string | null;
  nif: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
};

export type FactptLine = {
  reference?: string | null;
  description?: string | null;
  quantity?: number | null;
  unitPriceNet?: number | null;
  taxRate?: number | null;
};

export type FactptDocument = {
  id: string;
  environment: FactptEnvironment;
  status: FactptStatus;
  sourceType: FactptSourceType;
  sourceTable: string | null;
  sourceId: string | null;
  sourceReference: string | null;
  /** Detalhe da origem (ex.: peregrinação concreta), quando disponível. */
  sourceLabel: string | null;
  seriesCode: string | null;
  documentType: string | null;
  factptNumber: string | null;
  factptDocumentId: string | null;
  amount: number | null;
  currency: string;
  paymentMethod: string | null;
  paymentConfirmedAt: string | null;
  emailTo: string | null;
  emailSentAt: string | null;
  issuedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  reviewPreparedAt: string | null;
  approvedAt: string | null;
  clientAction: string | null;
  clientMatchReason: string | null;
  comments: string | null;
  lastError: string | null;
  emailLastError: string | null;
  permanentUrl: string | null;
  detailsLink: string | null;
  customer: FactptCustomer;
  fiscalTotal: number | null;
  fiscalCurrency: string;
  fiscalReference: string | null;
  fiscalLines: FactptLine[];
};

export type FactptAttentionItem = {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  description: string | null;
  documentId: string | null;
  sourceType: FactptSourceType | null;
  sourceId: string | null;
  amount: number | null;
  expectedAmount: number | null;
  factptAmount: number | null;
  customerName: string | null;
  createdAt: string | null;
};

export type FactptOverview = {
  generatedAt: string | null;
  environment: FactptEnvironment;
  kpis: {
    totalDocuments: number;
    awaitingApproval: number;
    needsData: number;
    pending: number;
    processing: number;
    failures: number;
    emailFailures: number;
    issued: number;
    emailed: number;
  };
  reconciliation: {
    reduniqConfirmedAmount: number;
    factptIssuedAmount: number;
    difference: number;
    confirmedPayments: number;
    matchedDocuments: number;
    issuedDocuments: number;
    unissuedDocuments: number;
    unmatchedPayments: number;
    mismatchedPayments: number;
    status: string;
    otherMethods: {
      confirmedAmount: number;
      factptIssuedAmount: number;
      difference: number;
      confirmedPayments: number;
      issuedDocuments: number;
      status: string;
    };
  };
  attention: FactptAttentionItem[];
  documents: FactptDocument[];
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const asNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = asNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
};

const pick = (record: UnknownRecord, ...keys: string[]): unknown => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const sourceType = (value: unknown): FactptSourceType => {
  const normalized = asString(value);
  if (
    normalized === 'quota'
    || normalized === 'store'
    || normalized === 'donation'
    || normalized === 'pilgrimage'
  ) {
    return normalized;
  }
  return 'donation';
};

const optionalSourceType = (value: unknown): FactptSourceType | null => {
  const normalized = asString(value);
  if (
    normalized === 'quota'
    || normalized === 'store'
    || normalized === 'donation'
    || normalized === 'pilgrimage'
  ) {
    return normalized;
  }
  return null;
};

const status = (value: unknown): FactptStatus => {
  const normalized = asString(value);
  if (
    normalized === 'awaiting_approval'
    || normalized === 'pending'
    || normalized === 'needs_data'
    || normalized === 'processing'
    || normalized === 'issued'
    || normalized === 'failed'
    || normalized === 'email_failed'
  ) {
    return normalized;
  }
  return 'pending';
};

function normalizeDocument(value: unknown): FactptDocument | null {
  const raw = asRecord(value);
  const id = asString(raw.id);
  if (!id) return null;

  const fiscal = asRecord(pick(raw, 'fiscal_snapshot', 'fiscalSnapshot'));
  const rawCustomer = asRecord(raw.customer);
  const fiscalCustomer = asRecord(fiscal.customer);
  const customer = Object.keys(rawCustomer).length ? rawCustomer : fiscalCustomer;
  const rawLines = pick(fiscal, 'lines');

  return {
    id,
    environment: pick(raw, 'environment') === 'sandbox' ? 'sandbox' : 'production',
    status: status(raw.status),
    sourceType: sourceType(pick(raw, 'source_type', 'sourceType')),
    sourceTable: asString(pick(raw, 'source_table', 'sourceTable')),
    sourceId: asString(pick(raw, 'source_id', 'sourceId')),
    sourceReference: asString(pick(raw, 'source_reference', 'sourceReference')),
    sourceLabel: asString(pick(raw, 'sourceLabel', 'source_label')),
    seriesCode: asString(pick(raw, 'series_code', 'seriesCode')),
    documentType: asString(pick(raw, 'document_type', 'documentType')),
    factptNumber: asString(pick(raw, 'factpt_number', 'factptNumber')),
    factptDocumentId: asString(pick(raw, 'factpt_document_id', 'factptDocumentId')),
    amount: asNullableNumber(raw.amount),
    currency: asString(raw.currency) || 'EUR',
    paymentMethod:
      asString(pick(raw, 'payment_method', 'paymentMethod'))
      || asString(fiscal.paymentMethod),
    paymentConfirmedAt: asString(pick(raw, 'payment_confirmed_at', 'paymentConfirmedAt')),
    emailTo:
      asString(pick(raw, 'email_to', 'emailTo'))
      || asString(customer.email),
    emailSentAt: asString(pick(raw, 'email_sent_at', 'emailSentAt')),
    issuedAt: asString(pick(raw, 'issued_at', 'issuedAt')),
    createdAt: asString(pick(raw, 'created_at', 'createdAt')),
    updatedAt: asString(pick(raw, 'updated_at', 'updatedAt')),
    reviewPreparedAt: asString(pick(raw, 'review_prepared_at', 'reviewPreparedAt')),
    approvedAt: asString(pick(raw, 'approved_at', 'approvedAt')),
    clientAction: asString(pick(raw, 'client_action', 'clientAction')),
    clientMatchReason: asString(pick(raw, 'client_match_reason', 'clientMatchReason')),
    comments: asString(raw.comments),
    lastError: asString(pick(raw, 'last_error', 'lastError')),
    emailLastError: asString(pick(raw, 'email_last_error', 'emailLastError')),
    permanentUrl: asString(pick(raw, 'permanent_url', 'permanentUrl')),
    detailsLink: asString(pick(raw, 'details_link', 'detailsLink')),
    customer: {
      name: asString(pick(customer, 'name')),
      email: asString(pick(customer, 'email')),
      nif: asString(pick(customer, 'nif', 'tin')),
      address: asString(pick(customer, 'address')),
      postalCode: asString(pick(customer, 'postalCode', 'postal_code', 'zip')),
      city: asString(pick(customer, 'city')),
      country: asString(pick(customer, 'country')),
      phone: asString(pick(customer, 'phone')),
    },
    fiscalTotal:
      asNullableNumber(fiscal.total)
      ?? asNullableNumber(raw.amount),
    fiscalCurrency: asString(fiscal.currency) || asString(raw.currency) || 'EUR',
    fiscalReference: asString(fiscal.reference),
    fiscalLines: Array.isArray(rawLines)
      ? rawLines.map((line) => {
        const item = asRecord(line);
        return {
          reference: asString(item.reference),
          description: asString(item.description),
          quantity: asNullableNumber(item.quantity),
          unitPriceNet: asNullableNumber(pick(item, 'unitPriceNet', 'unit_price_net')),
          taxRate: asNullableNumber(pick(item, 'taxRate', 'tax_rate')),
        };
      })
      : [],
  };
}

function normalizeAttention(value: unknown): FactptAttentionItem | null {
  const raw = asRecord(value);
  const id = asString(raw.id);
  const title = asString(raw.title);
  if (!id || !title) return null;
  const severityValue = asString(raw.severity);
  const severity =
    severityValue === 'error' || severityValue === 'warning'
      ? severityValue
      : 'info';

  return {
    id,
    type: asString(raw.type) || 'attention',
    severity,
    title,
    description: asString(raw.description),
    documentId: asString(pick(raw, 'documentId', 'document_id')),
    sourceType: optionalSourceType(pick(raw, 'sourceType', 'source_type')),
    sourceId: asString(pick(raw, 'sourceId', 'source_id')),
    amount: asNullableNumber(raw.amount),
    expectedAmount: asNullableNumber(pick(raw, 'expectedAmount', 'expected_amount')),
    factptAmount: asNullableNumber(pick(raw, 'factptAmount', 'factpt_amount', 'documentAmount')),
    customerName: asString(pick(raw, 'customerName', 'customer_name')),
    createdAt: asString(pick(raw, 'createdAt', 'created_at', 'occurredAt')),
  };
}

export function normalizeFactptOverview(value: unknown): FactptOverview {
  const raw = asRecord(value);
  const filters = asRecord(raw.filters);
  const rawKpis = asRecord(raw.kpis);
  const rawReconciliation = asRecord(raw.reconciliation);
  const nestedReduniq = asRecord(rawReconciliation.reduniq);
  const rawOtherMethods = asRecord(rawReconciliation.otherMethods);
  const otherMethods = {
    confirmedAmount: asNumber(
      pick(rawOtherMethods, 'confirmedAmount', 'paymentAmount'),
    ),
    factptIssuedAmount: asNumber(
      pick(rawOtherMethods, 'factptIssuedAmount', 'documentAmount', 'issuedAmount'),
    ),
    difference: asNumber(rawOtherMethods.difference),
    confirmedPayments: asNumber(
      pick(rawOtherMethods, 'confirmedPayments', 'payments'),
    ),
    issuedDocuments: asNumber(
      pick(rawOtherMethods, 'issuedDocuments', 'documents'),
    ),
    status: asString(rawOtherMethods.status) || 'empty',
  };

  const reconciliation = Object.keys(nestedReduniq).length
    ? {
      reduniqConfirmedAmount: asNumber(pick(nestedReduniq, 'paymentAmount', 'confirmedAmount')),
      factptIssuedAmount: asNumber(pick(nestedReduniq, 'documentAmount', 'issuedAmount')),
      difference: asNumber(nestedReduniq.difference),
      confirmedPayments: asNumber(pick(nestedReduniq, 'payments', 'confirmedPayments')),
      matchedDocuments: asNumber(pick(nestedReduniq, 'documents', 'matchedDocuments')),
      issuedDocuments: asNumber(pick(nestedReduniq, 'issuedDocuments', 'documents')),
      unissuedDocuments: asNumber(
        pick(nestedReduniq, 'unissuedDocuments', 'pendingDocuments'),
      ),
      unmatchedPayments: asNumber(pick(nestedReduniq, 'missingDocuments', 'unmatchedPayments')),
      mismatchedPayments: asNumber(pick(nestedReduniq, 'valueMismatches', 'mismatchedPayments')),
      status: asString(nestedReduniq.status)
        || (nestedReduniq.reconciled === true ? 'reconciled' : 'attention'),
      otherMethods,
    }
    : {
      reduniqConfirmedAmount: asNumber(rawReconciliation.reduniqConfirmedAmount),
      factptIssuedAmount: asNumber(rawReconciliation.factptIssuedAmount),
      difference: asNumber(rawReconciliation.difference),
      confirmedPayments: asNumber(rawReconciliation.confirmedPayments),
      matchedDocuments: asNumber(rawReconciliation.matchedDocuments),
      issuedDocuments: asNumber(rawReconciliation.issuedDocuments),
      unissuedDocuments: asNumber(rawReconciliation.unissuedDocuments),
      unmatchedPayments: asNumber(rawReconciliation.unmatchedPayments),
      mismatchedPayments: asNumber(rawReconciliation.mismatchedPayments),
      status: asString(rawReconciliation.status) || 'unknown',
      otherMethods,
    };

  const rawDocuments = Array.isArray(raw.documents) ? raw.documents : [];
  const rawAttention = Array.isArray(raw.attention) ? raw.attention : [];

  return {
    generatedAt: asString(raw.generatedAt),
    environment:
      raw.environment === 'sandbox' || filters.environment === 'sandbox'
        ? 'sandbox'
        : 'production',
    kpis: {
      totalDocuments: asNumber(pick(rawKpis, 'totalDocuments', 'documents')),
      awaitingApproval: asNumber(rawKpis.awaitingApproval),
      needsData: asNumber(rawKpis.needsData),
      pending: asNumber(rawKpis.pending),
      processing: asNumber(rawKpis.processing),
      failures: asNumber(pick(rawKpis, 'failures', 'failed')),
      emailFailures: asNumber(pick(rawKpis, 'emailFailures', 'emailFailed')),
      issued: asNumber(rawKpis.issued),
      emailed: asNumber(pick(rawKpis, 'emailed', 'emailSent')),
    },
    reconciliation,
    attention: rawAttention
      .map(normalizeAttention)
      .filter((item): item is FactptAttentionItem => item !== null),
    documents: rawDocuments
      .map(normalizeDocument)
      .filter((document): document is FactptDocument => document !== null),
  };
}
