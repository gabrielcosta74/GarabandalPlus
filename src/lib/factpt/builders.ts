import { getFactPtSourceConfig } from './config';
import {
  buildFactPtIdentifier,
  decideFactPtDocument,
  FACTPT_DONATION_COMMENT,
  resolveFactPtPaymentType,
} from './rules';
import type {
  FactPtBuiltDocument,
  FactPtDocumentItem,
  FactPtFiscalSnapshot,
} from './types';

function isoDate(value: string): string {
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('A data de pagamento tem de estar no formato ISO.');
  }
  return date;
}

function documentItems(snapshot: FactPtFiscalSnapshot): FactPtDocumentItem[] {
  return snapshot.lines.map((line) => ({
    ...(line.productId === undefined ? {} : { id: line.productId }),
    description: line.description.trim(),
    price: line.unitPriceNet,
    reference: line.reference.trim(),
    retention: line.retention ?? false,
    type: line.type,
    unitId: line.unitId,
    taxId: line.taxId,
    quantity: line.quantity,
    ...(line.discount === undefined
      ? {}
      : { discount: line.discount }),
  }));
}

function donationComments(snapshot: FactPtFiscalSnapshot) {
  return snapshot.sourceType === 'donation' ||
    snapshot.sourceType === 'pilgrimage'
    ? FACTPT_DONATION_COMMENT
    : undefined;
}

function normalizedReference(reference?: string) {
  const value = reference?.trim();
  return value ? value.slice(0, 26) : undefined;
}

export function buildFactPtDocument(
  snapshot: FactPtFiscalSnapshot,
  clientId?: string | number,
): FactPtBuiltDocument {
  const decision = decideFactPtDocument(snapshot);
  if (decision.type === 'needs_data') {
    throw new Error(
      `O snapshot fiscal não está pronto para emissão: ${decision.reason}${
        decision.missingFields?.length
          ? ` (${decision.missingFields.join(', ')})`
          : ''
      }.`,
    );
  }

  const sourceConfig = getFactPtSourceConfig(snapshot.sourceType);
  const identifierId = buildFactPtIdentifier(
    snapshot.sourceType,
    snapshot.sourceId,
  );
  const date = isoDate(snapshot.paidAt);
  const commonDocument = {
    date,
    paymentType: resolveFactPtPaymentType(snapshot.paymentMethod),
    comments: donationComments(snapshot),
    reference: normalizedReference(snapshot.reference),
    download: false as const,
    allowRound: true as const,
    identifierId,
    language: snapshot.language?.trim().slice(0, 2) || 'pt',
  };

  if (decision.type === 'invoice_receipt') {
    if (clientId === undefined || clientId === '') {
      throw new Error(
        'O ID do cliente FACT.pt é obrigatório para uma Fatura-Recibo.',
      );
    }
    return {
      type: 'invoice_receipt',
      series: sourceConfig.series,
      credentialSlot: sourceConfig.credentialSlot,
      identifierId,
      payload: {
        client: { id: clientId },
        document: {
          ...commonDocument,
          markPaid: true,
          duePayment: date,
        },
        items: documentItems(snapshot),
      },
    };
  }

  return {
    type: 'simplified_invoice',
    series: sourceConfig.series,
    credentialSlot: sourceConfig.credentialSlot,
    identifierId,
    payload: {
      document: {
        ...commonDocument,
        paymentTerm: 0,
      },
      items: documentItems(snapshot),
    },
  };
}
