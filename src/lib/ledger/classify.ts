/**
 * Deterministic first pass over a Montepio statement line.
 *
 * Rules come from the 2026 workbook kept by the administrator (the "Tipo"
 * column). They only suggest; the admin confirms in /admin/contabilidade.
 */

export type ParsedKind =
  | 'incoming_transfer'
  | 'reduniq_payout'
  | 'stripe_payout'
  | 'tpa_close'
  | 'gateway_fee'
  | 'bank_fee'
  | 'stamp_duty'
  | 'card_purchase'
  | 'direct_debit'
  | 'outgoing_transfer'
  | 'refund'
  | 'other';

export type CategoryCode =
  | 'doacao' | 'quota' | 'peregrinacao' | 'loja'
  | 'liquidacao_reduniq' | 'liquidacao_stripe' | 'fecho_tpa' | 'outra_entrada'
  | 'comissao_reduniq' | 'comissao_bancaria' | 'imposto_selo' | 'software'
  | 'comunicacoes' | 'contabilidade' | 'viagem' | 'alojamento' | 'remuneracao'
  | 'recibos_verdes' | 'fornecedores' | 'devolucao' | 'outra_despesa'
  | 'transferencia_interna';

/** Mirrors ledger_categories.requires_document in the migration. */
export const CATEGORIES_REQUIRING_DOCUMENT: ReadonlySet<CategoryCode> = new Set<CategoryCode>([
  'software', 'comunicacoes', 'contabilidade', 'viagem', 'alojamento',
  'remuneracao', 'recibos_verdes', 'fornecedores', 'outra_despesa',
]);

/** Mirrors ledger_categories.requires_invoice: income that needs a fatura-recibo. */
export const CATEGORIES_REQUIRING_INVOICE: ReadonlySet<CategoryCode> = new Set<CategoryCode>([
  'doacao', 'quota', 'peregrinacao', 'loja',
]);

export type Classification = {
  kind: ParsedKind;
  /** Category the system is confident about (no decision needed). */
  categoryCode: CategoryCode | null;
  /** Best guess the admin still has to confirm. */
  suggestedCategoryCode: CategoryCode | null;
  counterpartyName: string | null;
  needsDocument: boolean;
};

export type CustomRule = {
  pattern: string;
  matchType: 'prefix' | 'contains';
  direction: 'in' | 'out' | null;
  categoryCode: CategoryCode;
  priority: number;
};

/**
 * The bank API appends a reference number to each description
 * ("TR-IPS-Marilde Mafra 0221463232"). Drop trailing groups of 6+ digits.
 */
export function stripReference(description: string): string {
  return description.replace(/\s+/g, ' ').trim().replace(/(\s+[A-Z]?\d{6,})+$/i, '').trim();
}

/**
 * Identifies the same bank movement whether it came from a Montepio Net file
 * or from the bank API (which appends a reference and may pad the text).
 * Used with booking date + amount to avoid duplicates across sources.
 */
export function movementMatchKey(description: string): string {
  return normalizeForMatch(stripReference(description)).replace(/[^A-Z0-9]+/g, ' ').trim().slice(0, 24);
}

const SOFTWARE_VENDORS = /\b(RAILWAY|RESEND|SUPABASE|VERCEL|GOOGLE|OPENAI|ANTHROPIC|CLOUDFLARE|GITHUB|APPLE\.COM|WEBNODE|SENDER|CANVA|ADOBE|MICROSOFT|ZOOM|NOTION|DEEPL|POSTHOG)\b/;
const FUEL = /\b(E\.?S\.|GALP|REPSOL|PRIO|CEPSA|BP |SHELL|MOEVE|INTERMARCHE COMB)/;
const TOLLS_AND_TRANSPORT = /\b(A\d{1,2}\b|BRISA|VIA VERDE|ASCENDI|CP |COMBOIOS|RENFE|FLIXBUS|RYANAIR|TAP |EASYJET|UBER|BOLT|PARQUE|PARKING)/;
const LODGING = /\b(HOTEL|HOSTAL|POSADA|RESTAURANTE|BOOKING\.COM)/;
const TELECOM = /\b(VODAFONE|MEO|NOS COMUNICA|NOWO|DIGI)\b/;

export function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(word => (['de', 'da', 'do', 'dos', 'das', 'e'].includes(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

/** "TR-IPS-Andrea Fonseca de Olive" → "Andrea Fonseca de Olive". */
export function extractCounterparty(description: string): string | null {
  const text = stripReference(description).replace(/^TR-ESTR-/i, 'TR-');
  const patterns = [
    /^TR-IPS-(.+)$/i,
    /^TRF\.?\s*CRED\.?\s+(.+)$/i,
    /^TRF\.?\s+(?!P\/)(.+)$/i,
    /^TR-(?!UNICRE)(.+)$/i,
    /^TRF\.?\s*IPS\s+P\/\s*(.+)$/i,
    /^TRF\.?\s*P\/\s*(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1].replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
      if (!name || /^\d+$/.test(name)) return null;
      return name === name.toUpperCase() ? titleCase(name) : name;
    }
  }
  return null;
}

function result(
  kind: ParsedKind,
  categoryCode: CategoryCode | null,
  suggested: CategoryCode | null,
  counterpartyName: string | null = null,
): Classification {
  const effective = categoryCode || suggested;
  return {
    kind,
    categoryCode,
    suggestedCategoryCode: categoryCode ? categoryCode : suggested,
    counterpartyName,
    needsDocument: effective ? CATEGORIES_REQUIRING_DOCUMENT.has(effective) : false,
  };
}

export function classifyMovement(
  description: string,
  amount: number,
  customRules: CustomRule[] = [],
): Classification {
  const text = normalizeForMatch(stripReference(description));
  const incoming = amount > 0;
  const direction: 'in' | 'out' = incoming ? 'in' : 'out';

  const builtIn = classifyBuiltIn(description, text, incoming);

  // Admin-defined rules win over the built-in category, but keep the movement kind.
  const rule = [...customRules]
    .sort((a, b) => a.priority - b.priority)
    .find(candidate => {
      if (candidate.direction && candidate.direction !== direction) return false;
      const pattern = normalizeForMatch(candidate.pattern);
      if (pattern.length < 3) return false;
      return candidate.matchType === 'prefix' ? text.startsWith(pattern) : text.includes(pattern);
    });
  if (rule) {
    return result(builtIn.kind, rule.categoryCode, null, builtIn.counterpartyName ?? extractCounterparty(description));
  }
  return builtIn;
}

function classifyBuiltIn(description: string, text: string, incoming: boolean): Classification {
  if (/^(TR-|DD-)?UNICRE/.test(text)) {
    return incoming
      ? result('reduniq_payout', 'liquidacao_reduniq', null, 'Unicre (Reduniq)')
      : result('gateway_fee', 'comissao_reduniq', null, 'Unicre (Reduniq)');
  }
  if (/STRIPE/.test(text)) {
    return incoming
      ? result('stripe_payout', 'liquidacao_stripe', null, 'Stripe')
      : result('gateway_fee', 'comissao_reduniq', null, 'Stripe');
  }
  if (/^FECHO (TPA|P\.? ?SERV)/.test(text)) {
    // Card / MB Way terminal batch. In the workbook it is booked as a donation or quota.
    return result('tpa_close', null, 'doacao');
  }
  if (/^COMISS?\.? ?TPA|^COMIS\.? ?P\.? ?SERV/.test(text)) {
    return result('gateway_fee', 'comissao_reduniq', null);
  }
  if (/^I\.? ?SELO|^I\.S\./.test(text)) {
    return result('stamp_duty', 'imposto_selo', null);
  }
  if (/^COM\.? SERV|^COMISSAO|^COMIS\.? |^COM\.? |^SOLUCAO E\.?MPRES|^MANUT/.test(text)) {
    return result('bank_fee', 'comissao_bancaria', null);
  }
  if (/FAC?TOR M\b/.test(text)) {
    return result(incoming ? 'incoming_transfer' : 'outgoing_transfer', 'contabilidade', null, 'Factor M');
  }
  if (/^COMPRA /.test(text)) {
    if (SOFTWARE_VENDORS.test(text)) return result('card_purchase', 'software', null);
    if (FUEL.test(text) || TOLLS_AND_TRANSPORT.test(text)) return result('card_purchase', null, 'viagem');
    if (LODGING.test(text)) return result('card_purchase', null, 'alojamento');
    return result('card_purchase', null, 'outra_despesa');
  }
  if (/^PAGSERV|^PAG\.? ?SERV/.test(text)) {
    return result('direct_debit', null, 'outra_despesa');
  }
  if (/^DD-/.test(text)) {
    if (TELECOM.test(text)) return result('direct_debit', 'comunicacoes', null);
    if (SOFTWARE_VENDORS.test(text)) return result('direct_debit', 'software', null);
    return result('direct_debit', null, 'outra_despesa');
  }
  if (!incoming && /^(ORD\.? ?PAG|TRF\.? ?(IPS )?P\/|TRF P\/|TRF\.? ?SEPA)/.test(text)) {
    const name = extractCounterparty(description);
    if (LODGING.test(text)) return result('outgoing_transfer', null, 'alojamento', name);
    return result('outgoing_transfer', null, 'outra_despesa', name);
  }
  if (incoming && /^DEVOL/.test(text)) {
    // Refund of an earlier purchase (e.g. "DEVOL. CP ESPINHO").
    return result('refund', null, 'devolucao');
  }
  if (incoming && /^(TR-|TRF\.? ?CRED|TRF\.? )/.test(text)) {
    return result('incoming_transfer', null, 'doacao', extractCounterparty(description));
  }
  return result('other', null, incoming ? 'outra_entrada' : 'outra_despesa');
}
