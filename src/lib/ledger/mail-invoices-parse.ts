/**
 * Reconhece os emails de fatura das subscrições (Railway, Resend, Supabase,
 * Mobbin, Vodafone, Tranquilidade) e escolhe o movimento do banco a que
 * pertencem. Sem I/O: o IMAP, o storage e a BD ficam em mail-invoices.ts.
 *
 * As faturas em dólares são debitadas em euros com câmbio, por isso a ligação
 * faz-se pelo fornecedor e pela data, com o valor só como travão.
 */

export type MailFileKind = 'invoice' | 'receipt' | 'detail';

type FileRule = { pattern: RegExp; kind: MailFileKind };

type SupplierRule = {
  key: string;
  name: string;
  /** Remetente direto do fornecedor. */
  sender: RegExp;
  /** Domínio da assinatura DKIM do remetente direto. */
  dkimDomain: string;
  /** Assunto do email com o documento fiscal (pago ou a debitar). */
  subject: RegExp;
  /** Como aparece no extrato do Montepio. */
  bank: RegExp;
  /** PDFs aceites; o grupo 1 é o número do documento. */
  files: FileRule[];
  /** Data do pagamento ou do débito escrita no email. */
  paidOn: (flat: string) => string | null;
  /** Sem data no email: estimativa a partir do número do documento (antes da data do email). */
  estimatePaidOn?: (docNumber: string) => string | null;
  /** Dias entre essa data e o movimento aparecer no Montepio. */
  windowDays: number;
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const iso = (year: number | string, month: number, day: number) =>
  month >= 1 && month <= 12 && day >= 1 && day <= 31
    ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    : null;

/** "Paid on October 14, 2026" / "Paid on Jun 14, 2026" → 2026-10-14 (Stripe e Orb). */
export function parsePaidOn(text: string): string | null {
  const match = text.match(/\bPaid on ([A-Za-z]{3,9})\.? (\d{1,2}), (\d{4})\b/);
  if (!match) return null;
  const month = MONTHS[match[1].slice(0, 3).toLowerCase()];
  return month ? iso(match[3], month, Number(match[2])) : null;
}

/** "Débito a partir de 21-08-2026" (Vodafone). */
export function parseDebitFrom(text: string): string | null {
  const match = text.match(/D[ée]bito a partir de (\d{1,2})[-/](\d{1,2})[-/](\d{4})/i);
  return match ? iso(match[3], Number(match[2]), Number(match[1])) : null;
}

const STRIPE_FILES: FileRule[] = [
  { pattern: /^Invoice-([A-Z0-9]+-\d+)\.pdf$/i, kind: 'invoice' },
  { pattern: /^Receipt-([A-Z0-9]+(?:-[A-Z0-9]+)*)\.pdf$/i, kind: 'receipt' },
];

const stripeReceipt = (key: string, name: string, account: string, bank: RegExp): SupplierRule => ({
  key,
  name,
  sender: new RegExp(`^invoice\\+statements\\+${account}@stripe\\.com$`, 'i'),
  dkimDomain: 'stripe.com',
  subject: new RegExp(`\\breceipt from ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
  bank,
  files: STRIPE_FILES,
  paidOn: parsePaidOn,
  windowDays: 10,
});

export const MAIL_SUPPLIERS: SupplierRule[] = [
  stripeReceipt('railway', 'Railway Corporation', 'acct_1HNrvlCJoPsRzQsd', /\bRAILWAY\b/i),
  stripeReceipt('mobbin', 'Mobbin', 'acct_1C0qvSFJtgAcXTXh', /\bMOBBIN\b/i),
  {
    key: 'resend',
    name: 'Resend',
    sender: /^invoice\+statements@invoicing\.resend\.com$/i,
    dkimDomain: 'invoicing.resend.com',
    subject: /\breceipt from Resend\b/i,
    bank: /\bRESEND\b/i,
    files: STRIPE_FILES,
    paidOn: parsePaidOn,
    windowDays: 10,
  },
  {
    key: 'supabase',
    name: 'Supabase Pte. Ltd.',
    sender: /^invoice\+statements@supabase\.com$/i,
    dkimDomain: 'supabase.com',
    // O email de "nova fatura" ainda não foi pago; o de pagamento traz fatura e recibo.
    subject: /\bPayment received for Supabase\b/i,
    bank: /\bSUPABASE\b/i,
    files: STRIPE_FILES,
    paidOn: parsePaidOn,
    windowDays: 10,
  },
  {
    key: 'vodafone',
    name: 'Vodafone Portugal',
    sender: /^apoiocliente@vodafone\.pt$/i,
    dkimDomain: 'vodafone.pt',
    subject: /\bFatura[çc][ãa]o Vodafone\b/i,
    bank: /\bVODAFONE\b/i,
    files: [
      { pattern: /^fatura_(\d{8})\.pdf$/i, kind: 'invoice' },
      { pattern: /^detalhe_fatura_(\d{8})\.pdf$/i, kind: 'detail' },
    ],
    paidOn: parseDebitFrom,
    // Os emails antigos não dizem quando debita; a Vodafone debita ~20 dias depois da fatura.
    estimatePaidOn: docNumber => {
      const match = docNumber.match(/^(\d{4})(\d{2})(\d{2})$/);
      if (!match) return null;
      const at = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) + 20 * 86_400_000;
      return Number.isFinite(at) ? new Date(at).toISOString().slice(0, 10) : null;
    },
    windowDays: 10,
  },
  {
    key: 'tranquilidade',
    name: 'Tranquilidade',
    sender: /^clienteverde@seguros\.tranquilidade\.pt$/i,
    dkimDomain: 'seguros.tranquilidade.pt',
    subject: /\bfatura-recibo do seu seguro\b/i,
    bank: /\b(TRANQUILIDADE|GENERALI)\b/i,
    files: [{ pattern: /^Fatura_Recibo_(\d+_\d{8})\.pdf$/i, kind: 'invoice' }],
    // O email não diz quando debita: conta a partir da data do email, com folga.
    paidOn: () => null,
    windowDays: 30,
  },
];

export type MailSupplier = string;

export const supplierRule = (key: string) => MAIL_SUPPLIERS.find(rule => rule.key === key);
export const supplierName = (key: string) => supplierRule(key)?.name || key;

/** Critério IMAP largo (assunto); quem decide é recognizeInvoiceMail. */
export const MAIL_SEARCH_TERMS = ['Railway Corporation', 'Resend', 'Supabase', 'Mobbin', 'Vodafone', 'seguro'];

export type MailAttachmentIn = { filename: string | null; contentType: string; content: Buffer };

export type IncomingMail = {
  from: string | null;
  subject: string;
  text: string;
  date: Date | null;
  /** Domínios `d=` das assinaturas DKIM presentes. */
  dkimDomains: string[];
  attachments: MailAttachmentIn[];
};

export type InvoiceFile = { kind: MailFileKind; number: string; fileName: string; content: Buffer };

export type RecognizedInvoice = {
  supplier: string;
  docNumber: string;
  paidOn: string | null;
  amount: number | null;
  currency: string | null;
  forwarded: boolean;
  files: InvoiceFile[];
};

export const MAX_INVOICE_PDF_BYTES = 9 * 1024 * 1024;

const isPdf = (content: Buffer) => content.length > 4 && content.subarray(0, 5).toString('latin1') === '%PDF-';

const domainMatches = (domain: string, expected: string) => {
  const d = domain.toLowerCase();
  const e = expected.toLowerCase();
  return d === e || d.endsWith(`.${e}`);
};

const SYMBOL_CURRENCY: Record<string, string> = { $: 'USD', '€': 'EUR' };

/** Valor pago: "Amount paid $17.02" (Stripe) ou "$25.00 has been charged" (Supabase/Orb). */
export function parseAmountPaid(text: string): { amount: number; currency: string } | null {
  const patterns = [
    /\bAmount paid\s*([$€])\s?([\d,]+\.\d{2})/i,
    /([$€])\s?([\d,]+\.\d{2}) has been charged/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const amount = Number(match[2].replace(/,/g, ''));
    if (Number.isFinite(amount) && amount > 0) return { amount, currency: SYMBOL_CURRENCY[match[1]] };
  }
  return null;
}

/**
 * Texto do email numa só linha: tira as citações "> " dos reencaminhamentos e
 * os caracteres invisíveis de preenchimento que a Stripe põe no pré-cabeçalho.
 */
export function flattenMailText(text: string): string {
  return text
    .split(/\r?\n/)
    .map(line => line.replace(/^(\s*>)+\s?/, ''))
    .join(' ')
    .replace(/[­͏​-‍⁠﻿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Data do email original num reencaminhamento ("Date: terça, 14/04/2026" / "escreveu (quarta, 20/05/2026"). */
export function parseForwardedDate(flat: string): string | null {
  const match = flat.match(/(?:\bDate:|\bData:|escreveu \()[^0-9]{0,30}(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  return match ? iso(match[3], Number(match[2]), Number(match[1])) : null;
}

/**
 * Diz se o email é um documento fiscal de uma das subscrições e devolve os
 * PDFs. Aceita o remetente direto (com assinatura DKIM do fornecedor) ou um
 * reencaminhamento feito por alguém de confiança, cujo corpo cite o remetente.
 */
export function recognizeInvoiceMail(mail: IncomingMail, trustedForwarders: Set<string>): RecognizedInvoice | null {
  const from = (mail.from || '').trim().toLowerCase();
  const subject = mail.subject || '';
  const text = flattenMailText(mail.text || '');
  let rule: SupplierRule | undefined;
  let forwarded = false;

  for (const candidate of MAIL_SUPPLIERS) {
    if (!candidate.subject.test(subject)) continue;
    if (candidate.sender.test(from)) {
      if (!mail.dkimDomains.some(domain => domainMatches(domain, candidate.dkimDomain))) continue;
      rule = candidate;
      break;
    }
    if (trustedForwarders.has(from) && /^\s*(fwd?|enc|rv|tr)\s*:/i.test(subject)) {
      const forwarderDomain = from.split('@')[1] || '';
      const quotesSender = (text.match(/[\w.+-]+@[\w.-]+/g) || []).some(address => candidate.sender.test(address));
      if (!quotesSender || !mail.dkimDomains.some(domain => domainMatches(domain, forwarderDomain))) continue;
      rule = candidate;
      forwarded = true;
      break;
    }
  }
  if (!rule) return null;

  const files: InvoiceFile[] = [];
  const seen = new Set<string>();
  for (const attachment of mail.attachments) {
    const fileName = (attachment.filename || '').trim();
    const matched = rule.files.map(fileRule => ({ fileRule, match: fileName.match(fileRule.pattern) })).find(item => item.match);
    if (!matched) continue;
    if (attachment.content.length > MAX_INVOICE_PDF_BYTES || !isPdf(attachment.content)) continue;
    const key = fileName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    files.push({ kind: matched.fileRule.kind, number: matched.match![1].toUpperCase(), fileName, content: attachment.content });
  }
  const invoiceFile = files.find(file => file.kind === 'invoice');
  if (!invoiceFile) return null;

  const paid = parseAmountPaid(text);
  // Num reencaminhamento a data do email é a do reencaminhamento, não a do pagamento.
  const fallbackDate = forwarded ? parseForwardedDate(text) : mail.date ? mail.date.toISOString().slice(0, 10) : null;
  const order: Record<MailFileKind, number> = { invoice: 0, receipt: 1, detail: 2 };
  return {
    supplier: rule.key,
    docNumber: invoiceFile.number,
    paidOn: rule.paidOn(text) || rule.estimatePaidOn?.(invoiceFile.number) || fallbackDate,
    amount: paid?.amount ?? null,
    currency: paid?.currency ?? null,
    forwarded,
    files: files.sort((a, b) => order[a.kind] - order[b.kind]),
  };
}

export type BankCandidate = { id: string; bookingDate: string; amount: number; description: string };

const dayNumber = (value: string) => Math.floor(Date.parse(`${value}T00:00:00Z`) / 86_400_000);

/** Maior janela entre fornecedores: até onde ler movimentos do banco. */
export const MAX_WINDOW_DAYS = Math.max(...MAIL_SUPPLIERS.map(rule => rule.windowDays));

export const windowDaysFor = (key: string) => supplierRule(key)?.windowDays ?? 10;

/**
 * Valor no banco (EUR) plausível para o valor da fatura. Em dólares aceita um
 * câmbio largo; em euros tem de bater quase ao cêntimo.
 */
export function plausibleBankAmount(bankEur: number, amount: number | null, currency: string | null): boolean {
  if (amount === null || !currency) return true;
  const paid = Math.abs(bankEur);
  if (currency === 'EUR') return Math.abs(paid - amount) <= 0.05;
  if (currency === 'USD') return paid >= amount * 0.7 && paid <= amount * 1.05;
  return true;
}

export type MatchDecision =
  | { kind: 'match'; transactionId: string }
  | { kind: 'wait'; reason: string | null }
  | { kind: 'ambiguous'; reason: string };

/**
 * Escolhe o débito do fornecedor entre a data do pagamento e a janela do
 * fornecedor. `taken` são movimentos que já têm documento ou outra fatura.
 */
export function chooseBankMovement(
  invoice: { supplier: string; paidOn: string; amount: number | null; currency: string | null },
  candidates: BankCandidate[],
  taken: Set<string>,
): MatchDecision {
  const rule = supplierRule(invoice.supplier);
  if (!rule) return { kind: 'wait', reason: 'Fornecedor desconhecido.' };
  const start = dayNumber(invoice.paidOn);
  const inWindow = candidates.filter(tx => {
    if (tx.amount >= 0 || !rule.bank.test(tx.description)) return false;
    const day = dayNumber(tx.bookingDate);
    return day >= start && day <= start + rule.windowDays;
  });
  const plausible = inWindow.filter(tx => plausibleBankAmount(tx.amount, invoice.amount, invoice.currency));
  const free = plausible.filter(tx => !taken.has(tx.id));
  if (free.length === 0) {
    if (inWindow.length && !plausible.length) return { kind: 'wait', reason: 'O débito do banco não bate com o valor da fatura.' };
    return { kind: 'wait', reason: null };
  }
  if (free.length === 1) return { kind: 'match', transactionId: free[0].id };
  const sorted = [...free].sort((a, b) => dayNumber(a.bookingDate) - dayNumber(b.bookingDate));
  if (dayNumber(sorted[0].bookingDate) === dayNumber(sorted[1].bookingDate)) {
    return { kind: 'ambiguous', reason: 'Há mais do que um débito possível no mesmo dia. Anexe à mão.' };
  }
  return { kind: 'match', transactionId: sorted[0].id };
}

/** Lê os domínios `d=` das linhas DKIM-Signature de uma mensagem crua. */
export function dkimDomainsFromHeaderLines(lines: readonly { key: string; line: string }[]): string[] {
  return lines
    .filter(header => header.key.toLowerCase() === 'dkim-signature')
    .map(header => header.line.replace(/\r?\n[ \t]+/g, ' ').match(/[;\s]d=([^;\s]+)/i)?.[1]?.toLowerCase())
    .filter((domain): domain is string => !!domain);
}
