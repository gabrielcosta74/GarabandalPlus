import 'server-only';

import { FactPtClient } from '../factpt/client';
import { getFactPtConfig } from '../factpt/config';
import { findRepeatedInvoices, isAppDocument, pagesNewestFirst, toMirrorRow, usableManualInvoice, type ManualInvoice, type MirrorRow, type RepeatedInvoice } from './factpt-mirror-rules';
import { addDays } from './invoice-safety';
import { db, isMissingTableError } from './server';

/*
 * A read-only copy of the FACT.pt documents, so the system can see invoices
 * issued by hand there. Every call here is a GET: nothing is ever created,
 * changed or sent to FACT.pt from this file.
 */

const KEEP_DAYS = 130;
/** A manual FR older than this copy could be missed, so issuing refuses to trust it. */
export const MIRROR_FRESH_HOURS = 26;

export type MirrorResult = { pages: number; documents: number; clients: number };

export function factptReadClient() {
  return new FactPtClient(getFactPtConfig('donation', 'production'));
}

export async function syncFactptMirror(options: { maxPages?: number; maxClients?: number } = {}): Promise<MirrorResult> {
  const maxPages = options.maxPages ?? 30;
  const maxClients = options.maxClients ?? 25;
  const client = factptReadClient();
  const cutoff = addDays(new Date().toISOString().slice(0, 10), -KEEP_DAYS);

  const { data: oldest, error: oldestError } = await db().from('factpt_remote_documents')
    .select('doc_date').order('doc_date', { ascending: true }).limit(1).maybeSingle();
  if (oldestError) throw oldestError;
  // Only stop early once the copy reaches back far enough; an interrupted first
  // run must not leave a hole behind the newest pages.
  const covered = !!oldest && oldest.doc_date <= cutoff;

  const first = await client.listDocuments(1);
  const total = Math.max(1, Number(first.totalPages || 1));
  const last = total > 1 ? await client.listDocuments(total) : first;
  const firstDate = String(first.data?.[0]?.date || '');
  const lastDate = String(last.data?.[last.data.length - 1]?.date || '');

  const result: MirrorResult = { pages: 0, documents: 0, clients: 0 };
  for (const page of pagesNewestFirst(total, firstDate, lastDate).slice(0, maxPages)) {
    const listing = page === 1 ? first : page === total ? last : await client.listDocuments(page);
    const rows = (listing.data || []).map(toMirrorRow).filter((row): row is MirrorRow => !!row);
    result.pages += 1;
    if (rows.length === 0) continue;

    const ids = rows.map(row => row.remote_id);
    const { data: known, error: knownError } = await db().from('factpt_remote_documents').select('remote_id').in('remote_id', ids);
    if (knownError) throw knownError;
    const { error } = await db().from('factpt_remote_documents')
      .upsert(rows.map(row => ({ ...row, updated_at: new Date().toISOString() })), { onConflict: 'remote_id' });
    if (error) throw error;
    result.documents += rows.length;

    const allKnown = (known || []).length === ids.length;
    const allOld = rows.every(row => row.doc_date < cutoff);
    if (allOld || (covered && allKnown && result.pages >= 2)) break;
  }

  // The list only has the client's id; manual invoices need the name to match.
  const { data: unnamed, error: unnamedError } = await db().from('factpt_remote_documents')
    .select('client_id, identifier_id').is('client_name', null).not('client_id', 'is', null)
    .gte('doc_date', cutoff).order('doc_date', { ascending: false }).limit(500);
  if (unnamedError) throw unnamedError;
  const clientIds = [...new Set((unnamed || [])
    .filter(row => !isAppDocument(row.identifier_id))
    .map(row => row.client_id as string))].slice(0, maxClients);
  for (const clientId of clientIds) {
    const remote = await client.getClient(clientId);
    const { error } = await db().from('factpt_remote_documents').update({
      client_name: remote.name || 'Sem nome',
      client_snapshot: {
        // A final consumer carries the generic tax number, never theirs.
        name: remote.name ?? null, nif: remote.isFinalConsumer ? null : remote.tin ?? null, email: remote.email ?? null,
        address: remote.address ?? null, zip: remote.zip ?? null, city: remote.city ?? null, country: remote.country ?? null,
      },
    }).eq('client_id', clientId);
    if (error) throw error;
    result.clients += 1;
  }
  return result;
}

/** Hand-issued FRs available to match, leaving out those already tied to a movement. */
export async function loadManualInvoices(since: string, takenRefs: Set<string>): Promise<ManualInvoice[]> {
  const { data, error } = await db().from('factpt_remote_documents')
    .select('doc_type, number, gross, doc_date, payment_status, identifier_id, client_name')
    .gte('doc_date', since);
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return (data || [])
    .map(usableManualInvoice)
    .filter((invoice): invoice is ManualInvoice => !!invoice && !takenRefs.has(invoice.number));
}

/** Null while the copy does not exist yet: callers must then treat it as unknown. */
export async function mirrorFreshness(): Promise<{ fresh: boolean; updatedAt: string | null } | null> {
  const { data, error } = await db().from('factpt_remote_documents')
    .select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  const updatedAt = (data?.updated_at as string | undefined) ?? null;
  return { updatedAt, fresh: !!updatedAt && Date.now() - Date.parse(updatedAt) < MIRROR_FRESH_HOURS * 3600000 };
}

export async function loadRepeatedInvoices(): Promise<RepeatedInvoice[]> {
  const { data, error } = await db().from('factpt_remote_documents')
    .select('number, doc_type, gross, doc_date, payment_status, client_id, client_name');
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return findRepeatedInvoices(data || []);
}

export async function findMirrorAmount(invoiceRef: string): Promise<number | null> {
  const number = invoiceRef.replace(/^FR\s+/, '');
  const { data, error } = await db().from('factpt_remote_documents')
    .select('gross').eq('number', number).eq('doc_type', 'invoicereceipt').limit(1).maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return data ? Number(data.gross) : null;
}
