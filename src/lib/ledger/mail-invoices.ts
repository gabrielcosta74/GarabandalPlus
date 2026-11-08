import 'server-only';

import { createHash } from 'node:crypto';
import { simpleParser, type AddressObject } from 'mailparser';

import { getRawMessage, listFolders, mailboxAddress, searchMessages } from '../mailbox';
import {
  MAIL_SEARCH_TERMS,
  MAX_WINDOW_DAYS,
  chooseBankMovement,
  dkimDomainsFromHeaderLines,
  recognizeInvoiceMail,
  supplierName,
  windowDaysFor,
  type BankCandidate,
  type MailFileKind,
  type MailSupplier,
} from './mail-invoices-parse';
import { db, isMissingTableError } from './server';

/**
 * Faturas das subscrições (Railway, Resend, Supabase, Mobbin, Vodafone,
 * Tranquilidade) que chegam à caixa geral@ passam sozinhas para os
 * documentos da contabilidade.
 *
 * 1. importMailInvoices: lê a caixa (só leitura, não marca nada como lido),
 *    guarda os PDFs no bucket privado e uma linha em ledger_mail_invoices.
 * 2. matchMailInvoices: quando o débito entra no banco (2–3 dias depois),
 *    anexa os PDFs a esse movimento em expense_documents.
 */

/** Como cada PDF aparece na área de documentos. */
const DOC_KIND: Record<MailFileKind, 'fatura' | 'recibo' | 'outro'> = {
  invoice: 'fatura',
  receipt: 'recibo',
  detail: 'outro',
};

export const LEDGER_DOCUMENTS_BUCKET = 'ledger-documents';
const DEFAULT_LOOKBACK_DAYS = 45;
const MIN_SCAN_INTERVAL_MS = 20 * 60_000;

type StoredFile = {
  kind: MailFileKind;
  number: string;
  file_name: string;
  storage_path: string;
  sha256: string;
  size_bytes: number;
};

export type MailInvoiceImport = {
  status: 'done' | 'skipped' | 'not_configured' | 'not_ready';
  scanned: number;
  imported: number;
  errors: string[];
};

export type MailInvoiceMatch = {
  status: 'done' | 'not_ready';
  attached: number;
  waiting: number;
  outside: number;
  errors: string[];
};

const globalState = globalThis as typeof globalThis & { __ledgerMailScanAt?: number };

const firstAddress = (value?: AddressObject | AddressObject[]) =>
  (Array.isArray(value) ? value[0] : value)?.value?.[0]?.address?.toLowerCase() || null;

/**
 * Quem pode reencaminhar faturas para geral@: os administradores e quem
 * estiver em LEDGER_INVOICE_FORWARDERS (ex.: o Gmail onde chega a da Supabase).
 */
async function trustedForwarders(): Promise<Set<string>> {
  const emails = [
    process.env.ADMIN_EMAIL,
    ...(process.env.ADMIN_EMAILS || '').split(','),
    ...(process.env.LEDGER_INVOICE_FORWARDERS || '').split(','),
  ];
  const { data, error } = await db().from('admin_users').select('email');
  if (!error) emails.push(...(data || []).map(row => String(row.email || '')));
  return new Set(emails.map(email => (email || '').trim().toLowerCase()).filter(Boolean));
}

async function scanFolders(): Promise<string[]> {
  try {
    const folders = await listFolders();
    const wanted = folders.filter(folder => folder.specialUse === '\\Inbox' || folder.specialUse === '\\Archive').map(folder => folder.path);
    return wanted.length ? wanted : ['INBOX'];
  } catch {
    return ['INBOX'];
  }
}

async function upload(path: string, content: Buffer) {
  const { error } = await db().storage.from(LEDGER_DOCUMENTS_BUCKET)
    .upload(path, content, { contentType: 'application/pdf', upsert: false });
  // Já lá estava (outra execução ou a mesma fatura reencaminhada): serve.
  if (error && !/already exists|duplicate/i.test(error.message)) throw new Error(`Storage: ${error.message}`);
}

/** Lê a caixa e guarda as faturas novas. `force` ignora o intervalo mínimo. */
export async function importMailInvoices(options: { since?: Date; force?: boolean } = {}): Promise<MailInvoiceImport> {
  const result: MailInvoiceImport = { status: 'done', scanned: 0, imported: 0, errors: [] };
  const mailbox = mailboxAddress();
  if (!mailbox) return { ...result, status: 'not_configured' };

  const lastScan = globalState.__ledgerMailScanAt || 0;
  if (!options.force && !options.since && Date.now() - lastScan < MIN_SCAN_INTERVAL_MS) return { ...result, status: 'skipped' };

  const probe = await db().from('ledger_mail_invoices').select('id').limit(1);
  if (probe.error) {
    if (isMissingTableError(probe.error)) return { ...result, status: 'not_ready' };
    throw probe.error;
  }
  globalState.__ledgerMailScanAt = Date.now();

  const since = options.since || new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 86_400_000);
  const forwarders = await trustedForwarders();

  for (const folder of await scanFolders()) {
    const found = await searchMessages(folder, {
      since,
      or: MAIL_SEARCH_TERMS.map(term => ({ subject: term })),
    }, 500);
    const candidates = found.filter(message => message.hasPdf);
    if (!candidates.length) continue;

    const { data: known, error: knownError } = await db().from('ledger_mail_invoices')
      .select('mail_uid, paid_on').eq('mail_folder', folder).in('mail_uid', candidates.map(message => message.uid));
    if (knownError) throw knownError;
    // Sem data de pagamento volta a ler-se: um parser melhor pode encontrá-la.
    const knownUids = new Set((known || []).filter(row => row.paid_on).map(row => Number(row.mail_uid)));

    for (const message of candidates) {
      if (knownUids.has(message.uid)) continue;
      result.scanned += 1;
      try {
        const raw = await getRawMessage(folder, message.uid);
        const parsed = await simpleParser(raw);
        const recognized = recognizeInvoiceMail({
          from: firstAddress(parsed.from),
          subject: parsed.subject || '',
          text: parsed.text || '',
          date: parsed.date || null,
          dkimDomains: dkimDomainsFromHeaderLines([...(parsed.headerLines || [])]),
          attachments: parsed.attachments.map(att => ({ filename: att.filename || null, contentType: att.contentType, content: att.content })),
        }, forwarders);
        if (!recognized) continue;

        const { data: existing, error: existingError } = await db().from('ledger_mail_invoices')
          .select('id, paid_on, status').eq('supplier', recognized.supplier).eq('doc_number', recognized.docNumber).maybeSingle();
        if (existingError) throw existingError;
        if (existing) {
          if (!existing.paid_on && recognized.paidOn && existing.status !== 'attached') {
            const { error: fixError } = await db().from('ledger_mail_invoices').update({
              paid_on: recognized.paidOn,
              amount: recognized.amount,
              currency: recognized.currency,
              status: 'waiting',
              last_error: null,
              updated_at: new Date().toISOString(),
            }).eq('id', existing.id).is('paid_on', null);
            if (fixError) throw fixError;
            result.imported += 1;
          }
          continue;
        }

        const files: StoredFile[] = [];
        for (const file of recognized.files) {
          const storagePath = `email/${recognized.supplier}/${recognized.docNumber}/${file.fileName}`;
          await upload(storagePath, file.content);
          files.push({
            kind: file.kind,
            number: file.number,
            file_name: file.fileName,
            storage_path: storagePath,
            sha256: createHash('sha256').update(file.content).digest('hex'),
            size_bytes: file.content.length,
          });
        }

        const { data: inserted, error: insertError } = await db().from('ledger_mail_invoices').upsert({
          supplier: recognized.supplier,
          doc_number: recognized.docNumber,
          message_id: parsed.messageId || null,
          mail_folder: folder,
          mail_uid: message.uid,
          sender: firstAddress(parsed.from),
          subject: (parsed.subject || '').slice(0, 300),
          received_at: (parsed.date || new Date()).toISOString(),
          paid_on: recognized.paidOn,
          amount: recognized.amount,
          currency: recognized.currency,
          files,
        }, { onConflict: 'supplier,doc_number', ignoreDuplicates: true }).select('id');
        if (insertError) throw insertError;
        if (inserted?.length) result.imported += 1;
      } catch (error) {
        result.errors.push(`${folder}#${message.uid}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return result;
}

type WaitingRow = {
  id: string;
  supplier: MailSupplier;
  doc_number: string;
  paid_on: string | null;
  received_at: string;
  amount: number | null;
  currency: string | null;
  files: StoredFile[];
  last_error: string | null;
};

const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** Liga as faturas à espera aos débitos que já entraram no banco. */
export async function matchMailInvoices(actor: string | null = null): Promise<MailInvoiceMatch> {
  const result: MailInvoiceMatch = { status: 'done', attached: 0, waiting: 0, outside: 0, errors: [] };
  const { data: waitingData, error: waitingError } = await db().from('ledger_mail_invoices')
    .select('id, supplier, doc_number, paid_on, received_at, amount, currency, files, last_error')
    .eq('status', 'waiting');
  if (waitingError) {
    if (isMissingTableError(waitingError)) return { ...result, status: 'not_ready' };
    throw waitingError;
  }
  const setError = async (id: string, message: string | null, previous: string | null) => {
    if (message === previous) return;
    await db().from('ledger_mail_invoices').update({ last_error: message, updated_at: new Date().toISOString() })
      .eq('id', id).eq('status', 'waiting');
  };

  const rows = (waitingData || []) as WaitingRow[];
  // Sem data de pagamento (reencaminhamento sem data legível) não se adivinha: fica à espera.
  for (const row of rows.filter(item => !item.paid_on)) {
    result.waiting += 1;
    await setError(row.id, 'Sem data de pagamento no email. Anexe à mão.', row.last_error);
  }
  const waiting = rows
    .filter(row => row.paid_on)
    .map(row => ({ ...row, anchor: row.paid_on as string, amount: row.amount === null ? null : Number(row.amount) }))
    .sort((a, b) => a.anchor.localeCompare(b.anchor) || a.doc_number.localeCompare(b.doc_number));
  if (!waiting.length) return result;

  const { data: first, error: firstError } = await db().from('bank_transactions')
    .select('booking_date').order('booking_date', { ascending: true }).limit(1).maybeSingle();
  if (firstError) throw firstError;
  const bankStart = first?.booking_date as string | undefined;

  const from = waiting[0].anchor;
  const to = addDays(waiting[waiting.length - 1].anchor, MAX_WINDOW_DAYS);
  const { data: txData, error: txError } = await db().from('bank_transactions')
    .select('id, booking_date, amount, description_raw, status')
    .lt('amount', 0).neq('status', 'ignored')
    .gte('booking_date', from).lte('booking_date', to);
  if (txError) throw txError;
  const candidates: BankCandidate[] = (txData || []).map(tx => ({
    id: tx.id as string,
    bookingDate: tx.booking_date as string,
    amount: Number(tx.amount),
    description: String(tx.description_raw || ''),
  }));

  const taken = new Set<string>();
  if (candidates.length) {
    const ids = candidates.map(tx => tx.id);
    const [docs, claimed] = await Promise.all([
      db().from('expense_documents').select('bank_transaction_id').in('bank_transaction_id', ids),
      db().from('ledger_mail_invoices').select('bank_transaction_id').in('bank_transaction_id', ids),
    ]);
    if (docs.error) throw docs.error;
    if (claimed.error) throw claimed.error;
    [...(docs.data || []), ...(claimed.data || [])].forEach(row => taken.add(row.bank_transaction_id as string));
  }

  for (const invoice of waiting) {
    // O banco só tem histórico a partir de bankStart: faturas anteriores nunca terão movimento.
    if (bankStart && addDays(invoice.anchor, windowDaysFor(invoice.supplier)) < bankStart) {
      const { error } = await db().from('ledger_mail_invoices')
        .update({ status: 'outside', last_error: null, updated_at: new Date().toISOString() })
        .eq('id', invoice.id).eq('status', 'waiting');
      if (error) result.errors.push(`${invoice.doc_number}: ${error.message}`);
      else result.outside += 1;
      continue;
    }

    const decision = chooseBankMovement({ ...invoice, paidOn: invoice.anchor }, candidates, taken);
    if (decision.kind !== 'match') {
      result.waiting += 1;
      await setError(invoice.id, decision.reason, invoice.last_error);
      continue;
    }

    const now = new Date().toISOString();
    // Reserva primeiro: o índice único impede que duas faturas fiquem no mesmo movimento.
    const { data: claimedRow, error: claimError } = await db().from('ledger_mail_invoices')
      .update({ status: 'attached', bank_transaction_id: decision.transactionId, attached_at: now, last_error: null, updated_at: now })
      .eq('id', invoice.id).eq('status', 'waiting').select('id').maybeSingle();
    if (claimError || !claimedRow) {
      if (claimError) result.errors.push(`${invoice.doc_number}: ${claimError.message}`);
      taken.add(decision.transactionId);
      result.waiting += 1;
      continue;
    }

    const { error: docsError } = await db().from('expense_documents').insert(invoice.files.map(file => ({
      bank_transaction_id: decision.transactionId,
      storage_path: file.storage_path,
      file_name: file.file_name,
      mime_type: 'application/pdf',
      size_bytes: file.size_bytes,
      sha256: file.sha256,
      supplier: supplierName(invoice.supplier),
      doc_number: file.number,
      doc_date: invoice.paid_on,
      doc_kind: DOC_KIND[file.kind] || 'outro',
      uploaded_by: actor || `email:${mailboxAddress() || 'geral'}`,
    })));
    if (docsError) {
      const closed = docsError.code === 'P0001';
      await db().from('ledger_mail_invoices').update({
        status: 'waiting', bank_transaction_id: null, attached_at: null, updated_at: new Date().toISOString(),
        last_error: closed ? 'O mês do movimento está fechado. Reabra-o para anexar a fatura.' : docsError.message.slice(0, 300),
      }).eq('id', invoice.id);
      result.errors.push(`${invoice.doc_number}: ${docsError.message}`);
      result.waiting += 1;
      continue;
    }
    taken.add(decision.transactionId);
    result.attached += 1;
  }
  return result;
}

/** Cron e botão de sincronizar: importar e ligar, sem nunca deitar abaixo quem chama. */
export async function runMailInvoices(options: { force?: boolean; since?: Date; actor?: string | null } = {}) {
  let imported: MailInvoiceImport | { status: 'failed'; error: string };
  try {
    imported = await importMailInvoices(options);
  } catch (error) {
    imported = { status: 'failed', error: error instanceof Error ? error.message : String(error) };
  }
  let matched: MailInvoiceMatch | { status: 'failed'; error: string };
  try {
    matched = await matchMailInvoices(options.actor ?? null);
  } catch (error) {
    matched = { status: 'failed', error: error instanceof Error ? error.message : String(error) };
  }
  if (imported.status === 'failed' || matched.status === 'failed') console.warn('[ledger] faturas do email', { imported, matched });
  return { imported, matched };
}
