import { getFactPtSourceConfig } from './config';
import type {
  FactPtClientCreateInput,
  FactPtDocumentDecision,
  FactPtFiscalLine,
  FactPtFiscalSnapshot,
  FactPtPaymentMethod,
  FactPtPaymentTypeCode,
  FactPtTax,
} from './types';

export const FACTPT_DONATION_COMMENT = 'Doação sem contrapartidas';
export const FACTPT_SIMPLIFIED_PRODUCT_LIMIT = 1_000;
export const FACTPT_SIMPLIFIED_SERVICE_LIMIT = 100;

const IDENTIFIER_ALLOWED = /[^a-zA-Z0-9:{}-]/g;

function stableIdentifierHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function normalizeFactPtTin(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.replace(/[\s.-]/g, '');
  return /^\d{5,15}$/.test(normalized) ? normalized : null;
}

export function buildFactPtClientInput(
  customer: FactPtFiscalSnapshot['customer'],
): FactPtClientCreateInput {
  if (!hasCompleteFactPtBillingIdentity(customer)) {
    throw new Error(
      'Não existem dados suficientes para criar o cliente FACT.pt.',
    );
  }
  const tin = normalizeFactPtTin(customer.nif);

  return {
    name: customer.name.trim().slice(0, 100),
    ...(tin ? { tin } : {}),
    address: customer.address!.trim().slice(0, 100),
    zip: customer.postalCode!.trim(),
    city: customer.city!.trim().slice(0, 50),
    country: customer.country!.trim().slice(0, 2).toLowerCase(),
    email: customer.email.trim().toLowerCase(),
    phone: customer.phone?.trim() || undefined,
    finalConsumer: !tin,
  };
}

export function resolveFactPtTaxId(
  taxes: FactPtTax[],
  taxRate: number,
  preferredId?: string | number | null,
): FactPtTax['id'] {
  const matches = taxes.filter((tax) => {
    const value = Number.parseFloat(tax.value);
    return Number.isFinite(value) && Math.abs(value - taxRate) < 0.001;
  });
  if (matches.length === 0) {
    throw new Error(
      `A taxa de ${taxRate}% não existe na configuração FACT.pt da série.`,
    );
  }
  if (preferredId !== undefined && preferredId !== null && preferredId !== '') {
    const preferred = matches.find(
      (tax) => String(tax.id) === String(preferredId),
    );
    if (!preferred) {
      throw new Error(
        `O imposto FACT.pt ${preferredId} não corresponde à taxa de ${taxRate}%.`,
      );
    }
    return preferred.id;
  }
  if (matches.length > 1) {
    throw new Error(
      `Existem vários impostos FACT.pt com taxa de ${taxRate}%; configure explicitamente o motivo fiscal correto.`,
    );
  }
  return matches[0].id;
}

export function buildFactPtIdentifier(
  sourceType: FactPtFiscalSnapshot['sourceType'],
  sourceId: string,
): string {
  const prefix = `gp:${sourceType}:`;
  const normalizedId = sourceId
    .trim()
    .replace(IDENTIFIER_ALLOWED, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!normalizedId) {
    throw new Error('O ID de origem é obrigatório para criar o identifierId.');
  }

  const fullIdentifier = `${prefix}${normalizedId}`;
  if (fullIdentifier.length <= 50) return fullIdentifier;

  const compactUuid = normalizedId.replace(/-/g, '');
  if (/^[a-fA-F0-9]{32}$/.test(compactUuid)) {
    const compactIdentifier = `${prefix}${compactUuid}`;
    if (compactIdentifier.length <= 50) return compactIdentifier;
  }

  const suffix = `:${stableIdentifierHash(fullIdentifier)}`;
  return `${fullIdentifier.slice(0, 50 - suffix.length)}${suffix}`;
}

export function resolveFactPtPaymentType(
  method: FactPtPaymentMethod,
): FactPtPaymentTypeCode {
  const mapping: Record<FactPtPaymentMethod, FactPtPaymentTypeCode> = {
    // The Reduniq virtual terminal does not confirm the underlying rail to
    // this application. FACT.pt code 9 is officially "Outros", so never
    // infer card, MB WAY, PIX or Multibanco from the checkout option.
    reduniq_other: 9,
    reduniq_debit_card: 9,
    reduniq_credit_card: 9,
    reduniq_multibanco: 9,
    reduniq_mbway: 9,
    reduniq_pix: 9,
    bank_transfer: 11,
  };
  return mapping[method];
}

export function parseFactPtPaymentMethod(value: unknown): FactPtPaymentMethod {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    normalized === 'reduniq'
    || normalized.startsWith('reduniq_')
    || ['card', 'credit_card', 'debit_card', 'multibanco', 'mbway', 'pix']
      .includes(normalized)
  ) {
    return 'reduniq_other';
  }

  switch (normalized) {
    case 'bank_transfer':
      return 'bank_transfer';
    default:
      throw new Error(
        `Método de pagamento sem mapeamento explícito para FACT.pt: ${String(value || '')}.`,
      );
  }
}

export function calculateFactPtLineGross(line: FactPtFiscalLine): number {
  const discount = line.discount ?? 0;
  const discountedNet =
    line.unitPriceNet * line.quantity * (1 - discount / 100);
  return Math.round(discountedNet * (1 + line.taxRate / 100) * 100) / 100;
}

export function calculateFactPtSnapshotTotal(
  snapshot: Pick<FactPtFiscalSnapshot, 'lines'>,
): number {
  const totalCents = snapshot.lines.reduce(
    (sum, line) => sum + Math.round(calculateFactPtLineGross(line) * 100),
    0,
  );
  return totalCents / 100;
}

export function validateFactPtSnapshot(snapshot: FactPtFiscalSnapshot): string[] {
  const errors: string[] = [];

  if (!snapshot.sourceId.trim()) errors.push('sourceId');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(snapshot.customer.email.trim())) {
    errors.push('customer.email');
  }
  const paymentDate = snapshot.paidAt.slice(0, 10);
  const parsedPaymentDate = new Date(`${paymentDate}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) ||
    Number.isNaN(parsedPaymentDate.getTime()) ||
    parsedPaymentDate.toISOString().slice(0, 10) !== paymentDate
  ) {
    errors.push('paidAt');
  }
  if (snapshot.currency !== 'EUR') errors.push('currency');
  if (!Number.isFinite(snapshot.total) || snapshot.total <= 0) errors.push('total');
  if (snapshot.lines.length === 0) errors.push('lines');

  snapshot.lines.forEach((line, index) => {
    const prefix = `lines.${index}`;
    if (!line.reference.trim() || line.reference.length > 20) {
      errors.push(`${prefix}.reference`);
    }
    if (!line.description.trim() || line.description.length > 150) {
      errors.push(`${prefix}.description`);
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      errors.push(`${prefix}.quantity`);
    }
    if (!Number.isFinite(line.unitPriceNet) || line.unitPriceNet <= 0) {
      errors.push(`${prefix}.unitPriceNet`);
    }
    if (!Number.isFinite(line.taxRate) || line.taxRate < 0) {
      errors.push(`${prefix}.taxRate`);
    }
    const discount = line.discount ?? 0;
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      errors.push(`${prefix}.discount`);
    }
    if (line.taxId === '' || line.unitId === '') {
      errors.push(`${prefix}.factPtMapping`);
    }
  });

  const calculatedTotal = calculateFactPtSnapshotTotal(snapshot);
  if (Math.abs(calculatedTotal - snapshot.total) > 0.009) {
    errors.push('totalMismatch');
  }

  return errors;
}

export function hasCompleteFactPtBillingData(
  customer: FactPtFiscalSnapshot['customer'],
): boolean {
  return Boolean(
    normalizeFactPtTin(customer.nif)
      && hasCompleteFactPtBillingIdentity(customer),
  );
}

export function factPtBillingIdentityMissingFields(
  customer: FactPtFiscalSnapshot['customer'],
): string[] {
  return [
    !customer.name.trim() ? 'customer.name' : null,
    !customer.address?.trim() ? 'customer.address' : null,
    !customer.postalCode?.trim() ? 'customer.postalCode' : null,
    !customer.city?.trim() ? 'customer.city' : null,
    !/^[a-z]{2}$/i.test(customer.country?.trim() || '')
      ? 'customer.country'
      : null,
  ].filter((field): field is string => Boolean(field));
}

export function hasCompleteFactPtBillingIdentity(
  customer: FactPtFiscalSnapshot['customer'],
): boolean {
  return Boolean(
    customer.name.trim() &&
      customer.email.trim() &&
      customer.address?.trim() &&
      customer.postalCode?.trim() &&
      customer.city?.trim() &&
      /^[a-z]{2}$/i.test(customer.country?.trim() || ''),
  );
}

function simplifiedInvoiceLimit(
  sourceType: FactPtFiscalSnapshot['sourceType'],
): number {
  return sourceType === 'store'
    ? FACTPT_SIMPLIFIED_PRODUCT_LIMIT
    : FACTPT_SIMPLIFIED_SERVICE_LIMIT;
}

export function decideFactPtDocument(
  snapshot: FactPtFiscalSnapshot,
): FactPtDocumentDecision {
  const snapshotErrors = validateFactPtSnapshot(snapshot);
  if (snapshotErrors.includes('customer.email')) {
    return {
      type: 'needs_data',
      reason: 'missing_email',
      missingFields: ['customer.email'],
    };
  }
  if (snapshotErrors.length > 0) {
    return {
      type: 'needs_data',
      reason: 'invalid_snapshot',
      missingFields: snapshotErrors,
    };
  }

  if (hasCompleteFactPtBillingData(snapshot.customer)) {
    return {
      type: 'invoice_receipt',
      reason: 'complete_billing_data',
    };
  }

  if (snapshot.sourceType === 'pilgrimage') {
    const missingFields = factPtBillingIdentityMissingFields(snapshot.customer);
    if (missingFields.length > 0) {
      return {
        type: 'needs_data',
        reason: 'missing_pilgrimage_holder_data',
        missingFields,
      };
    }
    return {
      type: 'invoice_receipt',
      reason: 'pilgrimage_final_consumer',
    };
  }

  const missingFields = [
    !normalizeFactPtTin(snapshot.customer.nif) ? 'customer.nif' : null,
    ...factPtBillingIdentityMissingFields(snapshot.customer),
  ].filter((field): field is string => Boolean(field));

  if (snapshot.total <= simplifiedInvoiceLimit(snapshot.sourceType)) {
    return {
      type: 'simplified_invoice',
      reason: 'missing_billing_data_within_limit',
    };
  }

  return {
    type: 'needs_data',
    reason: 'missing_billing_data_above_simplified_limit',
    missingFields,
  };
}

export function getFactPtSeries(sourceType: FactPtFiscalSnapshot['sourceType']) {
  return getFactPtSourceConfig(sourceType);
}
