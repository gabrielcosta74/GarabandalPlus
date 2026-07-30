import { chargedAmountFromNotes } from './source-snapshots';

export type FactPtAdminEnvironment = 'sandbox' | 'production';

export type FactPtAdminDocumentRow = {
  id: string;
  environment: FactPtAdminEnvironment;
  source_type: string;
  source_table: string;
  source_id: string;
  source_reference?: string | null;
  series_code: string;
  document_type?: string | null;
  status: string;
  identifier_id: string;
  amount?: number | string | null;
  currency?: string | null;
  payment_method?: string | null;
  payment_confirmed_at: string;
  email_to?: string | null;
  comments?: string | null;
  source_snapshot?: Record<string, unknown> | null;
  fiscal_snapshot?: Record<string, unknown> | null;
  client_action?: string | null;
  factpt_document_id?: string | null;
  factpt_number?: string | null;
  permanent_url?: string | null;
  pdf_url?: string | null;
  attempt_count?: number | null;
  email_attempt_count?: number | null;
  next_attempt_at?: string | null;
  processing_started_at?: string | null;
  last_error_code?: string | null;
  last_error?: string | null;
  email_last_error?: string | null;
  issued_at?: string | null;
  email_sent_at?: string | null;
  review_prepared_at?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type FactPtAdminPayment = {
  sourceType: 'donation' | 'pilgrimage' | 'store' | 'quota';
  sourceTable:
    | 'donations'
    | 'pilgrimage_payments'
    | 'store_orders'
    | 'pagamentos_quotas';
  sourceId: string;
  reference: string | null;
  amount: number;
  currency: string;
  method: string | null;
  provider: 'reduniq' | 'other';
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  occurredAt: string;
};

export type FactPtAdminSettings = {
  environment: FactPtAdminEnvironment;
  auto_enabled?: boolean | null;
  go_live_at?: string | null;
  production_pilgrimages_only?: boolean | null;
  production_donations_enabled?: boolean | null;
  donations_go_live_at?: string | null;
  auto_issue_reconciled_reduniq?: boolean | null;
};

export type FactPtAdminPeriod = {
  from: string;
  to: string;
  label: string;
  timezone: 'Europe/Lisbon';
  endExclusive: true;
};

type FactPtAdminSources = {
  donations: Array<Record<string, unknown>>;
  pilgrimagePayments: Array<Record<string, unknown>>;
  storeOrders: Array<Record<string, unknown>>;
  quotaPayments: Array<Record<string, unknown>>;
  members?: Array<Record<string, unknown>>;
};

const FINAL_PILGRIMAGE_STATUSES = new Set([
  'verified',
  'succeeded',
  'paid',
  'manual',
]);
const FACTPT_ISSUED_STATUSES = new Set(['issued', 'email_failed']);

const clean = (value: unknown): string | null => {
  const result = typeof value === 'string' ? value.trim() : '';
  return result || null;
};

const positiveMoney = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.round(numeric * 100) / 100;
};

const toCents = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
};

const fromCents = (value: number): number => Math.round(value) / 100;

const lower = (value: unknown): string =>
  String(value || '').trim().toLowerCase();

const isReduniqMethod = (value: unknown): boolean => {
  const method = lower(value);
  return method === 'reduniq' || method.startsWith('reduniq_');
};

const isInsidePeriod = (value: string, period: FactPtAdminPeriod): boolean => {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp)
    && timestamp >= new Date(period.from).getTime()
    && timestamp < new Date(period.to).getTime();
};

/**
 * Rótulo da origem já preparado pelos snapshots (para peregrinações traz o
 * título da viagem, ex.: "Itália e Medjugorje 2027 — sinal"). Cai para a
 * descrição da primeira linha fiscal quando o rótulo não foi gravado.
 */
const sourceLabelFromSnapshots = (
  document: Pick<FactPtAdminDocumentRow, 'fiscal_snapshot' | 'source_snapshot'>,
): string | null => {
  const fiscal = document.fiscal_snapshot || {};
  const source = document.source_snapshot || {};
  const explicit = clean(fiscal.emailSourceLabel) || clean(source.emailSourceLabel);
  if (explicit) return explicit;

  const lines = Array.isArray(fiscal.lines)
    ? fiscal.lines
    : Array.isArray((source as { items?: unknown }).items)
      ? (source as { items: unknown[] }).items
      : [];
  const first = lines[0];
  if (first && typeof first === 'object') {
    return clean((first as Record<string, unknown>).description);
  }
  return null;
};

const customerFromFiscalSnapshot = (
  fiscalSnapshot: Record<string, unknown> | null | undefined,
) => {
  const customer =
    fiscalSnapshot?.customer && typeof fiscalSnapshot.customer === 'object'
      ? fiscalSnapshot.customer as Record<string, unknown>
      : {};
  return {
    name: clean(customer.name),
    email: clean(customer.email),
    nif: clean(customer.nif),
    address: clean(customer.address),
    postalCode: clean(customer.postalCode),
    city: clean(customer.city),
    country: clean(customer.country),
    phone: clean(customer.phone),
  };
};

const isFactPtIssued = (document: FactPtAdminDocumentRow): boolean =>
  Boolean(
    document.issued_at
      || document.factpt_document_id
      || document.factpt_number
      || FACTPT_ISSUED_STATUSES.has(document.status),
  );

const paymentKey = (
  payment: Pick<FactPtAdminPayment, 'sourceTable' | 'sourceId'>,
) => `${payment.sourceTable}:${payment.sourceId}`;

const documentKey = (
  document: Pick<FactPtAdminDocumentRow, 'source_table' | 'source_id'>,
) => `${document.source_table}:${document.source_id}`;

/**
 * Convert a local wall-clock timestamp into UTC without relying on the
 * Railway process timezone. Two offset passes cover DST boundaries.
 */
const lisbonWallClockToUtc = (
  year: number,
  monthIndex: number,
  day: number,
): Date => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const wallClockMs = Date.UTC(year, monthIndex, day, 0, 0, 0);

  const offsetAt = (instant: Date): number => {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(instant)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)]),
    );
    return Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - instant.getTime();
  };

  const first = new Date(wallClockMs - offsetAt(new Date(wallClockMs)));
  return new Date(wallClockMs - offsetAt(first));
};

export function currentLisbonCivilMonthPeriod(
  now: Date = new Date(),
): FactPtAdminPeriod {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Lisbon',
      year: 'numeric',
      month: '2-digit',
    })
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  const year = parts.year;
  const monthIndex = parts.month - 1;
  const nextMonth = monthIndex === 11
    ? { year: year + 1, monthIndex: 0 }
    : { year, monthIndex: monthIndex + 1 };

  return {
    from: lisbonWallClockToUtc(year, monthIndex, 1).toISOString(),
    to: lisbonWallClockToUtc(
      nextMonth.year,
      nextMonth.monthIndex,
      1,
    ).toISOString(),
    label: new Intl.DateTimeFormat('pt-PT', {
      timeZone: 'Europe/Lisbon',
      month: 'long',
      year: 'numeric',
    }).format(now),
    timezone: 'Europe/Lisbon',
    endExclusive: true,
  };
}

export function normalizeFactPtAdminPayments(
  sources: FactPtAdminSources,
): FactPtAdminPayment[] {
  const members = new Map(
    (sources.members || [])
      .filter((member) => clean(member.id))
      .map((member) => [String(member.id), member]),
  );
  const payments: FactPtAdminPayment[] = [];

  for (const row of sources.donations) {
    if (lower(row.status) !== 'succeeded') continue;
    const metadata = row.metadata && typeof row.metadata === 'object'
      ? row.metadata as Record<string, unknown>
      : {};
    const amount = typeof row.amount_cents === 'number'
      ? positiveMoney(row.amount_cents / 100)
      : positiveMoney(row.amount);
    const occurredAt = clean(row.updated_at) || clean(row.created_at);
    if (!amount || !occurredAt || !clean(row.id)) continue;

    payments.push({
      sourceType: 'donation',
      sourceTable: 'donations',
      sourceId: String(row.id),
      reference: clean(row.external_reference) || clean(row.payment_intent_id),
      amount,
      currency: clean(row.currency)?.toUpperCase() || 'EUR',
      method: clean(row.method),
      // The donation enum cannot represent Reduniq. Its provider metadata is
      // authoritative and deliberately not inferred from method.
      provider: lower(metadata.provider) === 'reduniq' ? 'reduniq' : 'other',
      status: lower(row.status),
      customerName: clean(row.donor_name),
      customerEmail: clean(row.donor_email),
      occurredAt,
    });
  }

  for (const row of sources.pilgrimagePayments) {
    if (!FINAL_PILGRIMAGE_STATUSES.has(lower(row.status)) || row.deleted === true) {
      continue;
    }
    const baseAmount = positiveMoney(row.amount);
    const legacyChargedAmount = chargedAmountFromNotes(row.notes);
    const amount =
      legacyChargedAmount && legacyChargedAmount > (baseAmount || 0)
        ? legacyChargedAmount
        : positiveMoney(row.charged_amount) || baseAmount;
    const occurredAt = clean(row.verified_at) || clean(row.created_at);
    if (!amount || !occurredAt || !clean(row.id)) continue;
    const member = members.get(String(row.user_id || ''));

    payments.push({
      sourceType: 'pilgrimage',
      sourceTable: 'pilgrimage_payments',
      sourceId: String(row.id),
      reference:
        clean(row.external_reference)
        || clean(row.transaction_id)
        || clean(row.payment_intent_id),
      amount,
      currency: 'EUR',
      method: clean(row.method),
      provider: isReduniqMethod(row.method) ? 'reduniq' : 'other',
      status: lower(row.status),
      customerName: clean(member?.nome),
      customerEmail: clean(member?.email),
      occurredAt,
    });
  }

  for (const row of sources.storeOrders) {
    if (lower(row.status) !== 'paid') continue;
    const amount = positiveMoney(row.total_amount);
    const occurredAt = clean(row.created_at);
    if (!amount || !occurredAt || !clean(row.id)) continue;

    payments.push({
      sourceType: 'store',
      sourceTable: 'store_orders',
      sourceId: String(row.id),
      reference: clean(row.order_ref) || clean(row.payment_reference),
      amount,
      currency: clean(row.currency)?.toUpperCase() || 'EUR',
      method: clean(row.payment_method),
      provider: (
        lower(row.payment_provider) === 'reduniq'
        || isReduniqMethod(row.payment_method)
      ) ? 'reduniq' : 'other',
      status: lower(row.status),
      customerName: clean(row.buyer_name),
      customerEmail: clean(row.buyer_email),
      occurredAt,
    });
  }

  for (const row of sources.quotaPayments) {
    if (!['pago', 'paid'].includes(lower(row.estado))) continue;
    const amount = positiveMoney(row.valor);
    const date = clean(row.data_pagamento);
    if (!amount || !date || !clean(row.id)) continue;
    const member = members.get(String(row.user_id || ''));

    payments.push({
      sourceType:
        /\[TYPE:DONATION\]/i.test(String(row.notes || ''))
          ? 'donation'
          : 'quota',
      sourceTable: 'pagamentos_quotas',
      sourceId: String(row.id),
      reference: clean(row.external_reference) || clean(row.payment_intent_id),
      amount,
      currency: 'EUR',
      method: clean(row.metodo_pagamento),
      provider: isReduniqMethod(row.metodo_pagamento) ? 'reduniq' : 'other',
      status: lower(row.estado),
      customerName: clean(member?.nome),
      customerEmail: clean(member?.email),
      occurredAt: `${date.slice(0, 10)}T12:00:00.000Z`,
    });
  }

  return payments;
}

const isPaymentInAutomaticCoverage = (
  payment: FactPtAdminPayment,
  settings: FactPtAdminSettings | null,
): boolean => {
  if (!settings?.auto_enabled) return false;
  const occurredAt = new Date(payment.occurredAt).getTime();

  if (settings.environment === 'production') {
    if (
      payment.sourceTable === 'pilgrimage_payments'
      && settings.production_pilgrimages_only
      && settings.go_live_at
    ) {
      return occurredAt >= new Date(settings.go_live_at).getTime();
    }
    if (
      payment.sourceTable === 'donations'
      && settings.production_donations_enabled
      && settings.donations_go_live_at
    ) {
      return occurredAt >= new Date(settings.donations_go_live_at).getTime();
    }
    return false;
  }

  return Boolean(
    settings.go_live_at
      && occurredAt >= new Date(settings.go_live_at).getTime(),
  );
};

const buildReconciliation = (
  payments: FactPtAdminPayment[],
  documentsByPayment: Map<string, FactPtAdminDocumentRow>,
) => {
  let paymentCents = 0;
  let issuedCents = 0;
  let matchedDocuments = 0;
  let issuedDocuments = 0;
  let unmatchedPayments = 0;
  let mismatchedPayments = 0;
  let unissuedDocuments = 0;

  for (const payment of payments) {
    paymentCents += toCents(payment.amount);
    const document = documentsByPayment.get(paymentKey(payment));
    if (!document) {
      unmatchedPayments += 1;
      continue;
    }
    matchedDocuments += 1;
    const documentCents = toCents(document.amount);
    if (documentCents !== toCents(payment.amount)) mismatchedPayments += 1;

    if (isFactPtIssued(document)) {
      issuedDocuments += 1;
      issuedCents += documentCents;
    } else {
      unissuedDocuments += 1;
    }
  }

  const differenceCents = paymentCents - issuedCents;
  const status = payments.length === 0
    ? 'empty'
    : differenceCents === 0
      && unmatchedPayments === 0
      && mismatchedPayments === 0
      && unissuedDocuments === 0
      ? 'reconciled'
      : 'attention';

  return {
    confirmedAmount: fromCents(paymentCents),
    factptIssuedAmount: fromCents(issuedCents),
    difference: fromCents(differenceCents),
    confirmedPayments: payments.length,
    matchedDocuments,
    issuedDocuments,
    unissuedDocuments,
    unmatchedPayments,
    mismatchedPayments,
    status,
  };
};

const sourceLabel: Record<string, string> = {
  donation: 'donativo',
  pilgrimage: 'pagamento de peregrinação',
  store: 'encomenda',
  quota: 'quota',
};

export function buildFactPtAdminOverview(input: {
  environment: FactPtAdminEnvironment;
  period: FactPtAdminPeriod;
  settings: FactPtAdminSettings | null;
  documents: FactPtAdminDocumentRow[];
  payments: FactPtAdminPayment[];
}) {
  const documents = input.documents.filter(
    (document) =>
      document.environment === input.environment
      && isInsidePeriod(document.payment_confirmed_at, input.period),
  );
  const allPaymentsByKey = new Map(
    input.payments.map((payment) => [paymentKey(payment), payment]),
  );
  const documentsByPayment = new Map(
    documents.map((document) => [documentKey(document), document]),
  );

  // A payment is part of the Phase 1 financial coverage when the production
  // trigger is explicitly enabled for that source/cutoff, or when a local job
  // already proves that it entered the FACT.pt workflow.
  const coveredPayments = input.payments.filter(
    (payment) =>
      isInsidePeriod(payment.occurredAt, input.period)
      && (
        documentsByPayment.has(paymentKey(payment))
        || isPaymentInAutomaticCoverage(payment, input.settings)
      ),
  );
  const reduniqPayments = coveredPayments.filter(
    (payment) => payment.provider === 'reduniq',
  );
  const otherPayments = coveredPayments.filter(
    (payment) => payment.provider === 'other',
  );
  const reduniq = buildReconciliation(reduniqPayments, documentsByPayment);
  const otherMethods = buildReconciliation(otherPayments, documentsByPayment);

  const attention: Array<Record<string, unknown>> = [];
  for (const payment of coveredPayments) {
    const document = documentsByPayment.get(paymentKey(payment));
    if (!document) {
      attention.push({
        id: `payment_without_document:${payment.sourceTable}:${payment.sourceId}`,
        type: 'payment_without_document',
        severity: 'error',
        title: 'Pagamento confirmado sem documento fiscal',
        description:
          `O ${sourceLabel[payment.sourceType] || 'pagamento'} de `
          + `${payment.amount.toFixed(2)} € ainda não tem registo FACT.pt.`,
        sourceType: payment.sourceType,
        sourceId: payment.sourceId,
        amount: payment.amount,
        expectedAmount: payment.amount,
        customerName: payment.customerName,
        createdAt: payment.occurredAt,
      });
      continue;
    }
    if (toCents(document.amount) !== toCents(payment.amount)) {
      attention.push({
        id: `amount_mismatch:${document.id}`,
        type: 'amount_mismatch',
        severity: 'error',
        title: 'Valor fiscal diferente do pagamento',
        description:
          `Pagamento: ${payment.amount.toFixed(2)} €. `
          + `Documento: ${Number(document.amount || 0).toFixed(2)} €.`,
        documentId: document.id,
        sourceType: payment.sourceType,
        sourceId: payment.sourceId,
        amount: payment.amount,
        expectedAmount: payment.amount,
        factptAmount: fromCents(toCents(document.amount)),
        customerName: payment.customerName,
        createdAt: document.updated_at,
      });
    }
  }

  const actionableStatus: Record<
    string,
    { type: string; severity: string; title: string; description: string }
  > = {
    awaiting_approval: {
      type: 'awaiting_approval',
      severity: 'warning',
      title: 'Fatura por aprovar',
      description: 'Os dados fiscais devem ser confirmados antes da emissão.',
    },
    needs_data: {
      type: 'needs_data',
      severity: 'warning',
      title: 'Dados fiscais em falta',
      description: 'É necessária intervenção do admin para completar a fatura.',
    },
    failed: {
      type: 'failed',
      severity: 'error',
      title: 'Falha na emissão',
      description: 'A FACT.pt não confirmou a emissão deste documento.',
    },
    email_failed: {
      type: 'email_failed',
      severity: 'error',
      title: 'Fatura emitida, email falhou',
      description: 'Repetir apenas o envio do email; não voltar a emitir.',
    },
  };
  for (const document of documents) {
    const config = actionableStatus[document.status];
    if (!config) continue;
    const payment = allPaymentsByKey.get(documentKey(document));
    attention.push({
      id: `${config.type}:${document.id}`,
      type: config.type,
      severity: config.severity,
      title: config.title,
      description: document.last_error || document.email_last_error || config.description,
      documentId: document.id,
      sourceType: document.source_type,
      sourceId: document.source_id,
      amount: Number(document.amount || 0),
      expectedAmount: payment?.amount,
      factptAmount: Number(document.amount || 0),
      customerName:
        customerFromFiscalSnapshot(document.fiscal_snapshot).name
        || payment?.customerName
        || null,
      createdAt: document.updated_at,
    });
  }

  const severityOrder: Record<string, number> = {
    error: 0,
    warning: 1,
    info: 2,
  };
  attention.sort((left, right) => {
    const severity =
      (severityOrder[String(left.severity)] ?? 99)
      - (severityOrder[String(right.severity)] ?? 99);
    if (severity !== 0) return severity;
    return String(right.createdAt || '').localeCompare(
      String(left.createdAt || ''),
    );
  });

  const operationalDocuments = documents
    .map((document) => {
      const payment = allPaymentsByKey.get(documentKey(document));
      const customer = customerFromFiscalSnapshot(document.fiscal_snapshot);
      const existingClientMatchReason = clean(
        document.fiscal_snapshot?.existingClientMatchReason,
      );
      const clientMatchReason = existingClientMatchReason
        || (
          document.review_prepared_at
            ? document.document_type === 'simplified_invoice'
              ? 'simplified_final_consumer'
              : document.fiscal_snapshot?.existingClientId
                ? 'existing_client'
                : 'new_client'
            : null
        );
      return {
        id: document.id,
        environment: document.environment,
        sourceType: document.source_type,
        sourceTable: document.source_table,
        sourceId: document.source_id,
        sourceReference: document.source_reference || payment?.reference || null,
        // Detalhe legível da origem (ex.: a peregrinação concreta) para o admin
        // distinguir documentos sem abrir cada um.
        sourceLabel: sourceLabelFromSnapshots(document),
        seriesCode: document.series_code,
        documentType: document.document_type || null,
        status: document.status,
        identifierId: document.identifier_id,
        amount: Number(document.amount || 0),
        expectedAmount: payment?.amount ?? null,
        amountMatches:
          payment ? toCents(document.amount) === toCents(payment.amount) : null,
        currency: document.currency || 'EUR',
        paymentMethod: document.payment_method || payment?.method || null,
        provider: payment?.provider || null,
        paymentConfirmedAt: document.payment_confirmed_at,
        customer: {
          name: customer.name || payment?.customerName || null,
          email: customer.email || payment?.customerEmail || document.email_to || null,
          nif: customer.nif,
          address: customer.address,
          postalCode: customer.postalCode,
          city: customer.city,
          country: customer.country,
          phone: customer.phone,
        },
        fiscalSnapshot: document.fiscal_snapshot || {},
        emailTo: document.email_to || customer.email || payment?.customerEmail || null,
        clientAction: document.client_action || null,
        clientMatchReason,
        factptDocumentId: document.factpt_document_id || null,
        factptNumber: document.factpt_number || null,
        permanentUrl: document.permanent_url || null,
        pdfUrl: document.pdf_url || null,
        comments: document.comments || null,
        errors: {
          code: document.last_error_code || null,
          document: document.last_error || null,
          email: document.email_last_error || null,
        },
        attempts: {
          document: document.attempt_count || 0,
          email: document.email_attempt_count || 0,
        },
        nextAttemptAt: document.next_attempt_at || null,
        processingStartedAt: document.processing_started_at || null,
        reviewPreparedAt: document.review_prepared_at || null,
        approvedAt: document.approved_at || null,
        issuedAt: document.issued_at || null,
        emailSentAt: document.email_sent_at || null,
        createdAt: document.created_at,
        updatedAt: document.updated_at,
      };
    })
    .sort(
      (left, right) =>
        new Date(right.paymentConfirmedAt).getTime()
        - new Date(left.paymentConfirmedAt).getTime(),
    );

  return {
    environment: input.environment,
    period: input.period,
    coverage: {
      autoIssueReconciledReduniq: Boolean(
        input.settings?.auto_issue_reconciled_reduniq,
      ),
      automaticSources:
        input.environment === 'production'
          ? {
              pilgrimages: Boolean(
                input.settings?.production_pilgrimages_only
                && input.settings.go_live_at,
              ),
              pilgrimageFrom: input.settings?.go_live_at || null,
              donations: Boolean(
                input.settings?.production_donations_enabled
                && input.settings.donations_go_live_at,
              ),
              donationsFrom: input.settings?.donations_go_live_at || null,
              store: false,
              quotas: false,
            }
          : {
              sandbox: Boolean(
                input.settings?.auto_enabled && input.settings.go_live_at,
              ),
              from: input.settings?.go_live_at || null,
            },
      note:
        'Pagamentos anteriores aos cutoffs só entram quando já existe um '
        + 'documento fiscal local associado.',
    },
    kpis: {
      totalDocuments: documents.length,
      awaitingApproval: documents.filter(
        (document) => document.status === 'awaiting_approval',
      ).length,
      needsData: documents.filter(
        (document) => document.status === 'needs_data',
      ).length,
      pending: documents.filter(
        (document) => document.status === 'pending',
      ).length,
      processing: documents.filter(
        (document) => document.status === 'processing',
      ).length,
      failures: documents.filter(
        (document) => document.status === 'failed',
      ).length,
      emailFailures: documents.filter(
        (document) => document.status === 'email_failed',
      ).length,
      issued: documents.filter(isFactPtIssued).length,
      emailed: documents.filter(
        (document) => Boolean(document.email_sent_at),
      ).length,
    },
    reconciliation: {
      reduniqConfirmedAmount: reduniq.confirmedAmount,
      factptIssuedAmount: reduniq.factptIssuedAmount,
      difference: reduniq.difference,
      confirmedPayments: reduniq.confirmedPayments,
      matchedDocuments: reduniq.matchedDocuments,
      issuedDocuments: reduniq.issuedDocuments,
      unissuedDocuments: reduniq.unissuedDocuments,
      unmatchedPayments: reduniq.unmatchedPayments,
      mismatchedPayments: reduniq.mismatchedPayments,
      status: reduniq.status,
      otherMethods,
    },
    attention,
    documents: operationalDocuments,
  };
}
