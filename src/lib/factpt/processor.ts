import { createHash } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { sendFactPtFiscalDocumentEmail } from '../email';
import { supabaseServer } from '../supabase';
import {
  buildFactPtClientInput,
  calculateFactPtSnapshotTotal,
  decideFactPtDocument,
  hasCompleteFactPtBillingData,
  hasCompleteFactPtBillingIdentity,
  normalizeFactPtTin,
  parseFactPtPaymentMethod,
  resolveFactPtTaxId,
} from './rules';
import { buildFactPtDocument } from './builders';
import { FactPtClient, FactPtError } from './client';
import {
  getFactPtConfig,
  getFactPtUnitId,
  isFactPtProductionEnabled,
} from './config';
import type {
  FactPtCreatedResource,
  FactPtDocumentDecision,
  FactPtDocumentType,
  FactPtEnvironment,
  FactPtFiscalLine,
  FactPtFiscalSnapshot,
  FactPtRemoteClient,
  FactPtSourceType,
} from './types';
import {
  loadFactPtSourceSnapshot,
  type FactPtSourceSnapshot,
} from './source-snapshots';

type FactPtJob = {
  id: string;
  environment: FactPtEnvironment;
  source_type: FactPtSourceType;
  source_table: string;
  source_id: string;
  source_reference: string | null;
  series_code: '2026Q' | '2026L' | '2026D';
  document_type: FactPtDocumentType | null;
  status: string;
  attempt_count: number;
  source_snapshot: Record<string, unknown> | null;
  fiscal_snapshot: Record<string, unknown> | null;
  factpt_document_id: string | null;
  factpt_number: string | null;
  permanent_url: string | null;
  issued_at: string | null;
  approved_at: string | null;
  approved_snapshot_hash: string | null;
  email_attempt_count: number;
};

export type FactPtQueueResult = {
  claimed: number;
  issued: number;
  emailed: number;
  needsData: number;
  failed: number;
  deferred: number;
};

export type FactPtReviewPreview = {
  id: string;
  environment: FactPtEnvironment;
  status: 'awaiting_approval' | 'needs_data';
  seriesCode: '2026Q' | '2026L' | '2026D';
  documentType: 'invoice_receipt' | 'simplified_invoice' | null;
  decision: FactPtDocumentDecision;
  customer: FactPtFiscalSnapshot['customer'] & {
    taxpayerLabel: string;
  };
  total: number;
  currency: 'EUR';
  paymentMethod: FactPtFiscalSnapshot['paymentMethod'];
  reference?: string;
  comments?: string;
  lines: FactPtFiscalLine[];
  preparedAt: string | null;
};

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function round(value: number, decimals = 8) {
  const multiplier = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function fiscalReference(value: string, index: number) {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (normalized || `ITEM-${index + 1}`).slice(0, 20);
}

function countryCode(value: string | null) {
  const normalized = value?.trim().toLowerCase() || '';
  const known: Record<string, string> = {
    portugal: 'pt',
    português: 'pt',
    brasil: 'br',
    brazil: 'br',
    espanha: 'es',
    spain: 'es',
    frança: 'fr',
    france: 'fr',
    itália: 'it',
    italy: 'it',
  };
  return /^[a-z]{2}$/.test(normalized) ? normalized : known[normalized] || null;
}

export function hydrateFactPtFiscalSnapshotFromClient(
  fiscal: FactPtFiscalSnapshot,
  remoteClient: FactPtRemoteClient,
): FactPtFiscalSnapshot {
  const tin = String(remoteClient.tin || '').replace(/\D/g, '');
  const country = countryCode(remoteClient.country || null);
  if (
    !remoteClient.id
    || !remoteClient.name?.trim()
    || !remoteClient.email?.trim()
    || !/^\d{5,15}$/.test(tin)
    || !remoteClient.address?.trim()
    || !remoteClient.zip?.trim()
    || !remoteClient.city?.trim()
    || !country
  ) {
    return fiscal;
  }

  return {
    ...fiscal,
    existingClientId: String(remoteClient.id),
    customer: {
      name: remoteClient.name.trim(),
      email: remoteClient.email.trim().toLowerCase(),
      nif: tin,
      address: remoteClient.address.trim(),
      postalCode: remoteClient.zip.trim(),
      city: remoteClient.city.trim(),
      country,
      phone: remoteClient.phone?.trim() || fiscal.customer.phone || null,
    },
  };
}

async function enrichFiscalFromExistingFactPtClient(
  fiscal: FactPtFiscalSnapshot,
  client: FactPtClient,
): Promise<FactPtFiscalSnapshot> {
  const shouldSearch =
    (
      fiscal.sourceType === 'donation'
      && !hasCompleteFactPtBillingData(fiscal.customer)
    )
    || (
      fiscal.sourceType === 'pilgrimage'
      && !hasCompleteFactPtBillingIdentity(fiscal.customer)
    );
  if (!shouldSearch) return fiscal;

  const existingClient = await client.findExistingBillingClient({
    name: fiscal.customer.name,
    email: fiscal.customer.email,
  });
  return existingClient
    ? hydrateFactPtFiscalSnapshotFromClient(fiscal, existingClient)
    : fiscal;
}

export function factPtEmailSourceLabel(fiscal: FactPtFiscalSnapshot): string {
  const explicitLabel = fiscal.emailSourceLabel?.trim();
  if (explicitLabel) return explicitLabel;

  const labels: Record<Exclude<FactPtSourceType, 'pilgrimage'>, string> = {
    quota: 'Pagamento da quota',
    store: 'Compra na loja online',
    donation: 'Donativo',
  };
  if (fiscal.sourceType !== 'pilgrimage') {
    return labels[fiscal.sourceType];
  }

  const description = fiscal.lines[0]?.description?.trim() || 'Peregrinação';
  const parts = description
    .split(/\s+—\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts[0]?.toLowerCase() === 'donativo' && parts.length >= 2) {
    return parts.slice(1).join(' — ');
  }
  return description;
}

function serializeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function factPtReconciliationErrorCode(
  error: unknown,
  emissionAttempted: boolean,
  documentIssued: boolean,
) {
  if (documentIssued) return 'issued_persistence_reconciliation_required';
  if (!emissionAttempted || !(error instanceof FactPtError)) return null;
  if (!['timeout', 'network', 'invalid_response'].includes(error.kind)) {
    return null;
  }
  return `${error.kind}_reconciliation_required`;
}

function hasStoredFiscalSnapshot(
  value: unknown,
): value is FactPtFiscalSnapshot {
  return Boolean(
    value
      && Array.isArray((value as { lines?: unknown }).lines)
      && (value as { customer?: unknown }).customer,
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) =>
        `${JSON.stringify(key)}:${canonicalJson(entryValue)}`,
      );
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function fiscalSnapshotHash(snapshot: FactPtFiscalSnapshot): string {
  return createHash('sha256').update(canonicalJson(snapshot)).digest('hex');
}

function factPtClientLookupKey(
  customer: FactPtFiscalSnapshot['customer'],
): string {
  const tin = normalizeFactPtTin(customer.nif);
  if (tin) return `tin:${tin}`;

  const identity = [
    customer.email,
    customer.name,
    customer.address,
    customer.postalCode,
    customer.city,
    customer.country,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .join('\u001f');
  return `final:${createHash('sha256').update(identity).digest('hex')}`;
}

export function buildInitialFactPtFiscalSnapshot(
  source: FactPtSourceSnapshot,
  unitId: string | number,
): FactPtFiscalSnapshot {
  const lines: FactPtFiscalLine[] = source.items.map((item, index) => {
    const taxMultiplier = 1 + item.taxRate / 100;
    return {
      reference: fiscalReference(item.reference, index),
      description: item.description.trim().slice(0, 150),
      type: item.type,
      quantity: Number(item.quantity),
      unitPriceNet: round(Number(item.price) / taxMultiplier),
      taxRate: Number(item.taxRate),
      taxId: '',
      unitId,
      ...(item.discount === undefined ? {} : { discount: Number(item.discount) }),
    };
  });

  return {
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    paidAt: source.paymentDate,
    total: Math.round(source.amount * 100) / 100,
    currency: 'EUR',
    paymentMethod: parseFactPtPaymentMethod(source.paymentMethod),
    customer: {
      name: source.customer.name.trim(),
      email: source.customer.email.trim().toLowerCase(),
      nif: normalizeFactPtTin(source.customer.nif),
      address: source.customer.address,
      postalCode: source.customer.zip,
      city: source.customer.city,
      country: countryCode(source.customer.country),
      phone: source.customer.phone,
    },
    lines,
    language: source.language,
    reference: source.sourceReference,
    emailSourceLabel: source.emailSourceLabel,
  };
}

function reconcileCent(snapshot: FactPtFiscalSnapshot): FactPtFiscalSnapshot {
  const difference = round(snapshot.total - calculateFactPtSnapshotTotal(snapshot), 2);
  if (Math.abs(difference) < 0.009) return snapshot;
  if (Math.abs(difference) > 0.02 || snapshot.lines.length === 0) return snapshot;

  const lines = snapshot.lines.map((line) => ({ ...line }));
  const line = lines[lines.length - 1];
  const discountedQuantity =
    line.quantity * (1 - (line.discount ?? 0) / 100);
  const grossMultiplier = discountedQuantity * (1 + line.taxRate / 100);
  if (grossMultiplier <= 0) return snapshot;
  line.unitPriceNet = round(line.unitPriceNet + difference / grossMultiplier);
  return { ...snapshot, lines };
}

async function resolveFiscalSnapshot(
  db: SupabaseClient,
  job: FactPtJob,
  client: FactPtClient,
): Promise<FactPtFiscalSnapshot> {
  const storedFiscal = hasStoredFiscalSnapshot(job.fiscal_snapshot)
    ? job.fiscal_snapshot
    : null;
  const storedSnapshot = storedFiscal !== null;
  if (storedFiscal && job.approved_at) {
    if (
      !job.approved_snapshot_hash
      || fiscalSnapshotHash(storedFiscal) !== job.approved_snapshot_hash
    ) {
      throw new Error(
        'O snapshot fiscal foi alterado depois da aprovação; é necessária nova validação.',
      );
    }
    return storedFiscal;
  }

  let fiscal: FactPtFiscalSnapshot =
    storedFiscal ??
    buildInitialFactPtFiscalSnapshot(
      await loadFactPtSourceSnapshot(
        db as never,
        job.source_type,
        job.source_id,
        job.source_table,
      ),
      getFactPtUnitId(job.environment),
    );

  fiscal = await enrichFiscalFromExistingFactPtClient(fiscal, client);

  if (!storedSnapshot) {
    const { error } = await db
      .from('factpt_documents')
      .update({
        fiscal_snapshot: fiscal,
        email_to: fiscal.customer.email,
        payment_method: fiscal.paymentMethod,
      })
      .eq('id', job.id);
    if (error) throw error;
  }

  const taxes = await client.listTaxes();
  const zeroTaxId =
    job.series_code === '2026D'
      ? (
          job.environment === 'production'
            ? process.env.FACTPT_PRODUCTION_ZERO_TAX_ID_2026D
            : process.env.FACTPT_ZERO_TAX_ID_2026D
        )?.trim()
      : undefined;
  const lines: FactPtFiscalLine[] = [];
  for (const line of fiscal.lines) {
    lines.push({
      ...line,
      taxId: resolveFactPtTaxId(
        taxes,
        line.taxRate,
        line.taxRate === 0 ? zeroTaxId : undefined,
      ),
    });
  }

  fiscal = reconcileCent({ ...fiscal, lines });
  await db
    .from('factpt_documents')
    .update({
      fiscal_snapshot: fiscal,
      email_to: fiscal.customer.email,
      payment_method: fiscal.paymentMethod,
    })
    .eq('id', job.id);
  return fiscal;
}

async function resolveRemoteClient(
  db: SupabaseClient,
  job: FactPtJob,
  fiscal: FactPtFiscalSnapshot,
  client: FactPtClient,
) {
  const tin = normalizeFactPtTin(fiscal.customer.nif);
  const input = buildFactPtClientInput(fiscal.customer);
  const lookupKey = factPtClientLookupKey(fiscal.customer);

  const { data: cached, error: cacheError } = await db
    .from('factpt_clients')
    .select('id, factpt_client_id')
    .eq('environment', job.environment)
    .eq('credential_alias', job.series_code)
    .eq('lookup_key', lookupKey)
    .maybeSingle();
  if (cacheError) throw cacheError;
  if (cached?.factpt_client_id) {
    return {
      remoteId: String(cached.factpt_client_id),
      cacheId: String(cached.id),
      action: 'reused' as const,
    };
  }

  const resolved = fiscal.existingClientId
    ? {
        client: {
          id: fiscal.existingClientId,
          name: fiscal.customer.name,
          tin: fiscal.customer.nif || undefined,
          email: fiscal.customer.email,
          address: fiscal.customer.address || undefined,
          zip: fiscal.customer.postalCode || undefined,
          city: fiscal.customer.city || undefined,
          country: fiscal.customer.country || undefined,
        },
        created: false,
        updated: false,
      }
    : await client.findOrCreateClient(input);
  const { data: cachedRemote, error: cachedRemoteError } = await db
    .from('factpt_clients')
    .select('id')
    .eq('environment', job.environment)
    .eq('credential_alias', job.series_code)
    .eq('factpt_client_id', String(resolved.client.id))
    .maybeSingle();
  if (cachedRemoteError) throw cachedRemoteError;

  const cacheValues = {
    environment: job.environment,
    credential_alias: job.series_code,
    lookup_key: lookupKey,
    tin,
    factpt_client_id: String(resolved.client.id),
    name: fiscal.customer.name,
    email: fiscal.customer.email,
    last_confirmed_at: new Date().toISOString(),
  };
  const cacheWrite = cachedRemote?.id
    ? db
      .from('factpt_clients')
      .update(cacheValues)
      .eq('id', cachedRemote.id)
      .select('id')
      .single()
    : db
      .from('factpt_clients')
      .upsert(
      {
        ...cacheValues,
      },
      { onConflict: 'environment,credential_alias,lookup_key' },
    )
    .select('id')
    .single();
  const { data: stored, error: storeError } = await cacheWrite;
  if (storeError) throw storeError;

  return {
    remoteId: String(resolved.client.id),
    cacheId: String(stored.id),
    action: resolved.created
      ? 'created' as const
      : resolved.updated
        ? 'updated' as const
        : 'reused' as const,
  };
}

function createdDocumentData(response: FactPtCreatedResource) {
  const data = response.data as {
    id?: string | number;
    number?: string | number;
    documentNumber?: string | number;
  };
  if (data?.id === undefined || data.id === null || data.id === '') {
    throw new Error('A FACT.pt não devolveu o ID do documento emitido.');
  }
  const number = data.number ?? data.documentNumber ?? data.id;
  return {
    id: String(data.id),
    number: String(number),
    permanentUrl: response.permanentUrl || response.link || null,
  };
}

export function factPtDocumentNumberFromFilename(
  filename: string | null | undefined,
): string | null {
  if (!filename) return null;
  const normalized = filename.trim().replace(/\.pdf$/i, '');
  const match = normalized.match(
    /_(FR|FS)_\d{8}_([A-Z0-9-]+)_(\d+)$/i,
  );
  if (!match) return null;
  return `${match[1].toUpperCase()} ${match[2].toUpperCase()}/${match[3]}`;
}

function reviewPreview(
  job: FactPtJob,
  fiscal: FactPtFiscalSnapshot,
  decision: FactPtDocumentDecision,
  preparedAt: string | null,
): FactPtReviewPreview {
  return {
    id: job.id,
    environment: job.environment,
    status:
      decision.type === 'needs_data' ? 'needs_data' : 'awaiting_approval',
    seriesCode: job.series_code,
    documentType:
      decision.type === 'needs_data' ? null : decision.type,
    decision,
    customer: {
      ...fiscal.customer,
      taxpayerLabel:
        normalizeFactPtTin(fiscal.customer.nif) || 'Consumidor final',
    },
    total: fiscal.total,
    currency: fiscal.currency,
    paymentMethod: fiscal.paymentMethod,
    reference: fiscal.reference,
    comments:
      fiscal.sourceType === 'donation' || fiscal.sourceType === 'pilgrimage'
        ? 'Doação sem contrapartidas'
        : undefined,
    lines: fiscal.lines,
    preparedAt,
  };
}

async function sandboxEmailTarget(db: SupabaseClient) {
  const environmentOverride =
    process.env.FACTPT_SANDBOX_EMAIL_OVERRIDE?.trim().toLowerCase();
  if (environmentOverride && VALID_EMAIL.test(environmentOverride)) {
    return environmentOverride;
  }

  const { data } = await db
    .from('factpt_settings')
    .select('test_email')
    .eq('environment', 'sandbox')
    .maybeSingle();
  const settingEmail = String(data?.test_email || '').trim().toLowerCase();
  if (VALID_EMAIL.test(settingEmail)) return settingEmail;
  throw new Error(
    'Email de teste FACT.pt não configurado. Defina FACTPT_SANDBOX_EMAIL_OVERRIDE ou factpt_settings.test_email.',
  );
}

async function sendIssuedDocumentEmail(
  db: SupabaseClient,
  job: FactPtJob,
  fiscal: FactPtFiscalSnapshot,
  client: FactPtClient,
  document: {
    id: string;
    number: string;
    permanentUrl: string | null;
    type: FactPtDocumentType;
  },
  downloadedPdf?: Uint8Array,
) {
  const recipient =
    job.environment === 'sandbox'
      ? await sandboxEmailTarget(db)
      : fiscal.customer.email.trim().toLowerCase();
  if (!VALID_EMAIL.test(recipient)) {
    throw new Error('O email fiscal do titular é inválido.');
  }
  const pdf = downloadedPdf || await client.downloadDocumentPdf(document.id);
  const result = await sendFactPtFiscalDocumentEmail({
    toEmail: recipient,
    sandbox: job.environment === 'sandbox',
    recipientName: fiscal.customer.name,
    documentNumber: document.number,
    documentLabel:
      document.type === 'invoice_receipt'
        ? 'Fatura-Recibo'
        : 'Fatura Simplificada',
    sourceLabel: factPtEmailSourceLabel(fiscal),
    attachment: {
      filename: `${document.number.replace(/[^a-z0-9_-]+/gi, '-')}.pdf`,
      content: Buffer.from(pdf),
      contentType: 'application/pdf',
    },
    idempotencyKey: `factpt-${job.id}`,
  });

  const { error } = await db
    .from('factpt_documents')
    .update({
      status: 'issued',
      email_sent_at: new Date().toISOString(),
      email_last_error: null,
      last_error: null,
      last_error_code: null,
      processing_started_at: null,
      factpt_response: {
        documentId: document.id,
        documentNumber: document.number,
        emailMessageId: result.messageId,
        recipient,
        environment: job.environment,
      },
    })
    .eq('id', job.id);
  if (error) throw error;
  return result.sent;
}

async function updateFailure(
  db: SupabaseClient,
  job: FactPtJob,
  error: unknown,
  state: {
    emissionAttempted: boolean;
    documentIssued: boolean;
    documentPersisted: boolean;
  },
) {
  const message = serializeError(error);
  const factError = error instanceof FactPtError ? error : null;

  if (state.documentPersisted) {
    const emailAttemptCount = Number(job.email_attempt_count || 0) + 1;
    const delayMinutes = Math.min(60, 2 ** Math.max(0, emailAttemptCount - 1));
    const { error: updateError } = await db
      .from('factpt_documents')
      .update({
        status: 'email_failed',
        email_attempt_count: emailAttemptCount,
        email_last_error: message,
        next_attempt_at: new Date(
          Date.now() + delayMinutes * 60_000,
        ).toISOString(),
        processing_started_at: null,
      })
      .eq('id', job.id);
    if (updateError) throw updateError;
    return 'failed';
  }

  const reconciliationCode = factPtReconciliationErrorCode(
    error,
    state.emissionAttempted,
    state.documentIssued,
  );
  if (reconciliationCode) {
    const { error: updateError } = await db
      .from('factpt_documents')
      .update({
        status: 'failed',
        last_error_code: reconciliationCode,
        last_error:
          `${message} A emissão pode ter sido aceite; reconciliar na FACT.pt antes de repetir.`,
        processing_started_at: null,
      })
      .eq('id', job.id);
    if (updateError) throw updateError;
    return 'failed';
  }

  const shouldRetry = Boolean(factError?.retryable) && job.attempt_count < 5;
  const delayMinutes = Math.min(60, 2 ** Math.max(0, job.attempt_count - 1));
  const { error: updateError } = await db
    .from('factpt_documents')
    .update({
      status: shouldRetry ? 'pending' : 'failed',
      next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
      last_error_code: factError?.kind || 'processing_error',
      last_error: message,
      processing_started_at: null,
    })
    .eq('id', job.id);
  if (updateError) throw updateError;
  return shouldRetry ? 'deferred' : 'failed';
}

async function processJob(db: SupabaseClient, job: FactPtJob) {
  let emissionAttempted = false;
  let documentIssued = false;
  let documentPersisted = false;

  try {
    if (job.factpt_document_id && job.factpt_number && job.issued_at) {
      documentPersisted = true;
      if (!hasStoredFiscalSnapshot(job.fiscal_snapshot)) {
        throw new Error('Snapshot fiscal indisponível para reenviar o documento.');
      }
      const client = new FactPtClient(
        getFactPtConfig(job.source_type, job.environment),
      );
      await sendIssuedDocumentEmail(
        db,
        job,
        job.fiscal_snapshot,
        client,
        {
          id: job.factpt_document_id,
          number: job.factpt_number,
          permanentUrl: job.permanent_url,
          type: job.document_type || 'invoice_receipt',
        },
      );
      return 'resent' as const;
    }

    const config = getFactPtConfig(job.source_type, job.environment);
    if (config.series !== job.series_code) {
      throw new Error('A série da fila não coincide com a origem do pagamento.');
    }
    const client = new FactPtClient(config);
    const fiscal = await resolveFiscalSnapshot(db, job, client);
    const decision = decideFactPtDocument(fiscal);
    if (decision.type === 'needs_data') {
      const { error: needsDataError } = await db
        .from('factpt_documents')
        .update({
          status: 'needs_data',
          last_error_code: decision.reason,
          last_error: decision.missingFields?.join(', ') || decision.reason,
          processing_started_at: null,
        })
        .eq('id', job.id);
      if (needsDataError) throw needsDataError;
      return 'needs_data' as const;
    }

    const remoteClient = decision.type === 'invoice_receipt'
      ? await resolveRemoteClient(db, job, fiscal, client)
      : null;
    const built = buildFactPtDocument(fiscal, remoteClient?.remoteId);
    const { error: payloadError } = await db
      .from('factpt_documents')
      .update({
        document_type: built.type,
        document_payload: built.payload,
        client_cache_id: remoteClient?.cacheId || null,
        client_action: remoteClient?.action || 'final_consumer',
      })
      .eq('id', job.id);
    if (payloadError) throw payloadError;

    emissionAttempted = true;
    const response = built.type === 'invoice_receipt'
      ? await client.createInvoiceReceipt(built.payload)
      : await client.createSimplifiedInvoice(built.payload);
    const document = createdDocumentData(response);
    documentIssued = true;

    const { error: issuedError } = await db
      .from('factpt_documents')
      .update({
        status: 'issued',
        factpt_document_id: document.id,
        factpt_number: document.number,
        permanent_url: document.permanentUrl,
        factpt_response: response,
        issued_at: new Date().toISOString(),
        last_error: null,
        last_error_code: null,
        processing_started_at: null,
      })
      .eq('id', job.id);
    if (issuedError) throw issuedError;
    documentPersisted = true;

    const downloadedPdf = await client.downloadDocumentPdfResource(document.id);
    const officialNumber = factPtDocumentNumberFromFilename(
      downloadedPdf.filename,
    );
    if (officialNumber && officialNumber !== document.number) {
      document.number = officialNumber;
      const { error: numberError } = await db
        .from('factpt_documents')
        .update({ factpt_number: officialNumber })
        .eq('id', job.id);
      if (numberError) throw numberError;
    }

    await sendIssuedDocumentEmail(
      db,
      job,
      fiscal,
      client,
      { ...document, type: built.type },
      downloadedPdf.bytes,
    );
    return 'emailed' as const;
  } catch (error) {
    return updateFailure(db, job, error, {
      emissionAttempted,
      documentIssued,
      documentPersisted,
    });
  }
}

export async function prepareFactPtDocumentForReview(
  documentId: string,
  db: SupabaseClient | null = supabaseServer,
): Promise<FactPtReviewPreview> {
  if (!db) throw new Error('Supabase service role não configurado.');

  const { data, error } = await db
    .from('factpt_documents')
    .select('*')
    .eq('id', documentId)
    .single();
  if (error || !data) {
    throw error || new Error('Documento fiscal não encontrado.');
  }
  const job = data as FactPtJob;
  if (!['awaiting_approval', 'needs_data'].includes(job.status)) {
    throw new Error(
      'Apenas documentos por validar ou com dados em falta podem ser preparados.',
    );
  }

  const config = getFactPtConfig(job.source_type, job.environment);
  if (config.series !== job.series_code) {
    throw new Error('A série da fila não coincide com a origem do pagamento.');
  }

  const client = new FactPtClient(config);
  const fiscal = await resolveFiscalSnapshot(db, job, client);
  const decision = decideFactPtDocument(fiscal);
  if (decision.type === 'needs_data') {
    const { error: updateError } = await db
      .from('factpt_documents')
      .update({
        status: 'needs_data',
        document_type: null,
        review_prepared_at: null,
        last_error_code: decision.reason,
        last_error: decision.missingFields?.join(', ') || decision.reason,
        processing_started_at: null,
      })
      .eq('id', job.id);
    if (updateError) throw updateError;
    return reviewPreview(job, fiscal, decision, null);
  }

  const preparedAt = new Date().toISOString();
  const { error: updateError } = await db
    .from('factpt_documents')
    .update({
      status: 'awaiting_approval',
      document_type: decision.type,
      review_prepared_at: preparedAt,
      approved_at: null,
      approved_by: null,
      approved_snapshot_hash: null,
      last_error_code: null,
      last_error: null,
      processing_started_at: null,
    })
    .eq('id', job.id);
  if (updateError) throw updateError;
  return reviewPreview(job, fiscal, decision, preparedAt);
}

export async function approveFactPtDocument(
  documentId: string,
  approvedBy: string,
  confirmProduction = false,
  db: SupabaseClient | null = supabaseServer,
) {
  if (!db) throw new Error('Supabase service role não configurado.');
  if (!approvedBy.trim()) throw new Error('O administrador aprovador é obrigatório.');

  const { data, error } = await db
    .from('factpt_documents')
    .select('id, environment, source_type, status, review_prepared_at, fiscal_snapshot')
    .eq('id', documentId)
    .single();
  if (error || !data) {
    throw error || new Error('Documento fiscal não encontrado.');
  }
  if (data.status !== 'awaiting_approval') {
    throw new Error('O documento não está a aguardar aprovação.');
  }
  if (!data.review_prepared_at || !hasStoredFiscalSnapshot(data.fiscal_snapshot)) {
    throw new Error('Prepare e valide os dados da fatura antes de aprovar.');
  }
  if (
    data.environment === 'production'
    && (
      !['pilgrimage', 'donation'].includes(data.source_type)
      || !isFactPtProductionEnabled()
    )
  ) {
    throw new Error('A origem não está autorizada na FACT.pt de produção.');
  }
  if (data.environment === 'production' && !confirmProduction) {
    throw new Error(
      'A aprovação de produção exige confirmação explícita da emissão real.',
    );
  }

  const decision = decideFactPtDocument(data.fiscal_snapshot);
  if (decision.type === 'needs_data') {
    throw new Error(
      `Os dados fiscais deixaram de estar válidos: ${
        decision.missingFields?.join(', ') || decision.reason
      }.`,
    );
  }

  const approvedAt = new Date().toISOString();
  const approvedSnapshotHash = fiscalSnapshotHash(data.fiscal_snapshot);
  const { data: approved, error: updateError } = await db
    .from('factpt_documents')
    .update({
      status: 'pending',
      approved_at: approvedAt,
      approved_by: approvedBy,
      approved_snapshot_hash: approvedSnapshotHash,
      next_attempt_at: approvedAt,
      processing_started_at: null,
      last_error_code: null,
      last_error: null,
    })
    .eq('id', documentId)
    .eq('status', 'awaiting_approval')
    .select('id, status, approved_at, approved_snapshot_hash')
    .single();
  if (updateError || !approved) {
    throw updateError || new Error('O documento já não aguarda aprovação.');
  }
  return approved;
}

export async function processFactPtQueue(
  environment: FactPtEnvironment = 'sandbox',
  limit = 5,
  db: SupabaseClient | null = supabaseServer,
): Promise<FactPtQueueResult> {
  if (!db) throw new Error('Supabase service role não configurado.');
  if (environment === 'production') {
    if (!isFactPtProductionEnabled()) {
      return {
        claimed: 0,
        issued: 0,
        emailed: 0,
        needsData: 0,
        failed: 0,
        deferred: 0,
      };
    }
    const { data: settings, error: settingsError } = await db
      .from('factpt_settings')
      .select('auto_enabled, production_pilgrimages_only, production_donations_enabled')
      .eq('environment', 'production')
      .maybeSingle();
    if (settingsError) throw settingsError;
    if (
      !settings?.auto_enabled
      || (
        !settings.production_pilgrimages_only
        && !settings.production_donations_enabled
      )
    ) {
      return {
        claimed: 0,
        issued: 0,
        emailed: 0,
        needsData: 0,
        failed: 0,
        deferred: 0,
      };
    }
  }

  const safeLimit = Math.max(1, Math.min(10, Math.floor(limit)));
  const { data, error } = await db.rpc('claim_factpt_documents', {
    p_limit: safeLimit,
    p_stale_after_seconds: 900,
    p_environment: environment,
  });
  if (error) throw error;

  const jobs = (data || []) as FactPtJob[];
  const result: FactPtQueueResult = {
    claimed: jobs.length,
    issued: 0,
    emailed: 0,
    needsData: 0,
    failed: 0,
    deferred: 0,
  };
  for (const job of jobs) {
    const outcome = await processJob(db, job);
    if (outcome === 'emailed') {
      result.issued += 1;
      result.emailed += 1;
    } else if (outcome === 'resent') {
      result.emailed += 1;
    } else if (outcome === 'needs_data') {
      result.needsData += 1;
    } else if (outcome === 'deferred') {
      result.deferred += 1;
    } else {
      result.failed += 1;
    }
  }
  return result;
}

export async function resendFactPtDocument(
  documentId: string,
  db: SupabaseClient | null = supabaseServer,
) {
  if (!db) throw new Error('Supabase service role não configurado.');
  const { data, error } = await db
    .from('factpt_documents')
    .select('*')
    .eq('id', documentId)
    .single();
  if (error || !data) throw error || new Error('Documento não encontrado.');
  const job = data as FactPtJob;
  if (!job.factpt_document_id || !job.factpt_number || !job.issued_at) {
    throw new Error('O documento ainda não foi emitido na FACT.pt.');
  }
  if (!hasStoredFiscalSnapshot(job.fiscal_snapshot)) {
    throw new Error('Snapshot fiscal indisponível para reenviar o documento.');
  }

  await db
    .from('factpt_documents')
    .update({
      email_attempt_count: Number(data.email_attempt_count || 0) + 1,
      email_last_error: null,
    })
    .eq('id', documentId);
  const client = new FactPtClient(
    getFactPtConfig(job.source_type, job.environment),
  );
  try {
    await sendIssuedDocumentEmail(db, job, job.fiscal_snapshot, client, {
      id: job.factpt_document_id,
      number: job.factpt_number,
      permanentUrl: job.permanent_url,
      type: job.document_type || 'invoice_receipt',
    });
  } catch (emailError) {
    await db
      .from('factpt_documents')
      .update({
        status: 'email_failed',
        email_last_error: serializeError(emailError),
      })
      .eq('id', documentId);
    throw emailError;
  }
}
