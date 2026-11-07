import type { CategoryCode, ParsedKind } from '../../../lib/ledger/classify';

/** Client copy of LedgerMovement (src/lib/ledger/server.ts), kept free of server imports. */
export type LedgerMovement = {
  id: string;
  period: string;
  bookingDate: string;
  valueDate: string | null;
  description: string;
  amount: number;
  balanceAfter: number | null;
  kind: ParsedKind;
  categoryCode: CategoryCode | null;
  suggestedCategoryCode: CategoryCode | null;
  counterpartyName: string | null;
  needsDocument: boolean;
  paperDocument: boolean;
  documentCount: number;
  invoiceRefs: string[];
  invoiceFromApp?: boolean;
  linkedPaymentId?: string | null;
  linkedPaymentLabel?: string | null;
  linkedPaymentKind?: 'pilgrimage' | 'donation' | null;
  /** The supplier agreement (proforma) this expense pays off. */
  agreementId?: string | null;
  agreementLabel?: string | null;
  /** FR already issued by the app for the linked pilgrimage payment. */
  appInvoiceRef?: string | null;
  appInvoiceState?: 'issued' | 'processing' | 'failed' | null;
  /** What the cross-check with the site's invoices found (see lib/ledger/enrich.ts). */
  suggestion?: { confidence: string; reason: string; invoiceRef: string | null; invoiceRefs: string[] } | null;
  status: 'unreviewed' | 'suggested' | 'reconciled' | 'ignored';
  ignoreReason: string | null;
  notes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

export type StatementWarning = {
  sourceRow: number;
  code: 'balance_gap' | 'unreadable_row' | 'missing_balance';
  message: string;
};

export type PreviewRow = {
  sourceRow: number;
  bookingDate: string;
  valueDate: string | null;
  description: string;
  amount: number;
  balanceAfter: number | null;
  kind: ParsedKind;
  categoryCode: CategoryCode | null;
  suggestedCategoryCode: CategoryCode | null;
  counterpartyName: string | null;
  needsDocument: boolean;
  fingerprint: string;
  duplicate: boolean;
};

export type StatementPreview = {
  fileName: string;
  fileSha256: string;
  source: 'xlsx' | 'csv';
  sheetName: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  balanceOk: boolean | null;
  warnings: StatementWarning[];
  rows: PreviewRow[];
  counts: { total: number; new: number; duplicate: number };
};

export function previewRowToMovement(row: PreviewRow): LedgerMovement {
  return {
    id: row.fingerprint,
    period: row.bookingDate.slice(0, 7),
    bookingDate: row.bookingDate,
    valueDate: row.valueDate,
    description: row.description,
    amount: row.amount,
    balanceAfter: row.balanceAfter,
    kind: row.kind,
    categoryCode: row.categoryCode,
    suggestedCategoryCode: row.suggestedCategoryCode,
    counterpartyName: row.counterpartyName,
    needsDocument: row.needsDocument,
    paperDocument: false,
    documentCount: 0,
    invoiceRefs: [],
    status: row.categoryCode ? 'suggested' : 'unreviewed',
    ignoreReason: null,
    notes: null,
    reviewedBy: null,
    reviewedAt: null,
  };
}
