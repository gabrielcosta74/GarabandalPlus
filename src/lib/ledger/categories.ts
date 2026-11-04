import type { CategoryCode, ParsedKind } from './classify';
import { CATEGORIES_REQUIRING_DOCUMENT, CATEGORIES_REQUIRING_INVOICE } from './classify';

/** Mirrors the ledger_categories seed. Safe to import in client components. */
export type LedgerCategory = {
  code: CategoryCode;
  label: string;
  direction: 'in' | 'out' | 'both';
};

export const LEDGER_CATEGORIES: LedgerCategory[] = [
  { code: 'doacao', label: 'Doação', direction: 'in' },
  { code: 'quota', label: 'Quota', direction: 'in' },
  { code: 'peregrinacao', label: 'Peregrinação', direction: 'in' },
  { code: 'loja', label: 'Loja', direction: 'in' },
  { code: 'liquidacao_reduniq', label: 'Liquidação Reduniq', direction: 'in' },
  { code: 'liquidacao_stripe', label: 'Liquidação Stripe', direction: 'in' },
  { code: 'fecho_tpa', label: 'Fecho TPA / MB Way', direction: 'in' },
  { code: 'outra_entrada', label: 'Outra entrada', direction: 'in' },
  { code: 'comissao_reduniq', label: 'Comissão Reduniq', direction: 'out' },
  { code: 'comissao_bancaria', label: 'Comissão bancária', direction: 'out' },
  { code: 'imposto_selo', label: 'Imposto do selo', direction: 'out' },
  { code: 'software', label: 'Software e serviços', direction: 'out' },
  { code: 'comunicacoes', label: 'Comunicações', direction: 'out' },
  { code: 'contabilidade', label: 'Contabilidade', direction: 'out' },
  { code: 'viagem', label: 'Viagem e transportes', direction: 'out' },
  { code: 'alojamento', label: 'Alojamento e refeições', direction: 'out' },
  { code: 'remuneracao', label: 'Remuneração', direction: 'out' },
  { code: 'recibos_verdes', label: 'Recibos verdes', direction: 'out' },
  { code: 'fornecedores', label: 'Fornecedores', direction: 'out' },
  { code: 'devolucao', label: 'Devolução', direction: 'both' },
  { code: 'outra_despesa', label: 'Outra despesa', direction: 'out' },
  { code: 'transferencia_interna', label: 'Transferência interna', direction: 'both' },
];

const LABELS = new Map(LEDGER_CATEGORIES.map(category => [category.code, category.label]));

export function categoryLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return LABELS.get(code as CategoryCode) || code;
}

export function categoriesFor(amount: number): LedgerCategory[] {
  const direction = amount > 0 ? 'in' : 'out';
  return LEDGER_CATEGORIES.filter(category => category.direction === direction || category.direction === 'both');
}

export function requiresInvoice(code: string | null | undefined): boolean {
  return !!code && CATEGORIES_REQUIRING_INVOICE.has(code as CategoryCode);
}

export function requiresDocument(code: string | null | undefined): boolean {
  return !!code && CATEGORIES_REQUIRING_DOCUMENT.has(code as CategoryCode);
}

export const KIND_LABELS: Record<ParsedKind, string> = {
  incoming_transfer: 'Transferência recebida',
  reduniq_payout: 'Liquidação Reduniq',
  stripe_payout: 'Liquidação Stripe',
  tpa_close: 'Fecho do terminal',
  gateway_fee: 'Comissão de pagamentos',
  bank_fee: 'Comissão bancária',
  stamp_duty: 'Imposto do selo',
  card_purchase: 'Compra com cartão',
  direct_debit: 'Débito direto',
  outgoing_transfer: 'Transferência enviada',
  refund: 'Devolução',
  other: 'Outro movimento',
};

/**
 * Where a movement sits in the "Por tratar" inbox.
 *  - income:   money in that will need a fatura-recibo (donation, quota…): confirm one by one.
 *  - safe:     the system is sure and nothing fiscal happens (fees, stamp duty, payouts).
 *  - document: an expense that still needs its invoice or receipt.
 *  - review:   the system only has a guess.
 */
export type InboxGroup = 'income' | 'safe' | 'document' | 'review';

export function inboxGroup(input: {
  amount: number;
  categoryCode: string | null;
  suggestedCategoryCode: string | null;
  needsDocument: boolean;
  hasDocument?: boolean;
}): InboxGroup {
  const effective = input.categoryCode || input.suggestedCategoryCode;
  if (input.amount > 0 && requiresInvoice(effective)) return 'income';
  if (input.needsDocument && !input.hasDocument) return 'document';
  if (input.categoryCode) return 'safe';
  return 'review';
}

export const INBOX_GROUPS: { key: InboxGroup; title: string; hint: string }[] = [
  { key: 'income', title: 'Entradas por confirmar', hint: 'Doações e quotas recebidas por transferência. Ao aprovar, é emitida a fatura-recibo.' },
  { key: 'review', title: 'Precisam de decisão', hint: 'O sistema não tem certeza da categoria.' },
  { key: 'document', title: 'Despesas sem documento', hint: 'Anexe a fatura ou marque “fatura em papel”.' },
  { key: 'safe', title: 'Classificadas automaticamente', hint: 'Comissões, imposto do selo e liquidações. Nenhuma fatura é emitida.' },
];
