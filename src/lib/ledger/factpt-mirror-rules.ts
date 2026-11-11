import { normalizeForMatch } from './classify';
import { addDays, payerNameMatch, pickSamePayerInvoice, samePerson } from './invoice-safety';

/*
 * Rules for the read-only copy of FACT.pt documents. The copy lets the system
 * see invoices the admin issued by hand there, which the app otherwise cannot.
 */

export type RemoteDocument = {
  id: string | number;
  clientId?: string | number | null;
  number?: string | null;
  type?: string | null;
  date?: string | null;
  paymentStatus?: string | null;
  gross?: string | number | null;
  permanentUrl?: string | null;
  identifierId?: string | null;
};

export type MirrorRow = {
  remote_id: string;
  number: string;
  doc_type: string;
  doc_date: string;
  gross: number;
  payment_status: string | null;
  client_id: string | null;
  identifier_id: string | null;
  permanent_url: string | null;
};

export type ManualInvoice = { number: string; amount: number; date: string; customer: string | null };

export type ManualMatch = {
  confidence: 'manual' | 'manual_likely' | 'ambiguous';
  invoiceRefs: string[];
};

// Refunded FRs were paid back through a credit note: they no longer justify money.
const CANCELLED = /cancel|anul|void|refund/i;

const CATEGORY_BY_SERIES: Record<string, string> = { D: 'doacao', Q: 'quota', L: 'loja' };

/** The FR's series says what it was issued for: FR 2026Q/12 is a quota. */
export function categoryForInvoice(invoiceRef: string): string | null {
  const series = invoiceRef.match(/^FR \d{4}([A-Z]+)\//)?.[1];
  return series ? CATEGORY_BY_SERIES[series] ?? null : null;
}

/** The app stamps its documents with "gp:<source>:<id>"; anything else was made by hand. */
export function isAppDocument(identifierId: string | null | undefined): boolean {
  return !!identifierId && identifierId.startsWith('gp:');
}

/** FACT.pt lists "2026D/1243"; the app and the accountant write "FR 2026D/1243". */
export function invoiceRefFor(docType: string, number: string): string | null {
  if (docType !== 'invoicereceipt') return null;
  const match = number.trim().toUpperCase().match(/^(?:FR\s+)?(\d{4}[A-Z]+)\s*\/\s*0*([1-9]\d*)$/);
  return match ? `FR ${match[1]}/${match[2]}` : null;
}

export function toMirrorRow(document: RemoteDocument): MirrorRow | null {
  const gross = Number(document.gross);
  const date = String(document.date || '').slice(0, 10);
  if (!document.id || !document.number || !document.type
      || !Number.isFinite(gross) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    remote_id: String(document.id),
    number: String(document.number),
    doc_type: String(document.type),
    doc_date: date,
    gross,
    payment_status: document.paymentStatus ? String(document.paymentStatus) : null,
    client_id: document.clientId === null || document.clientId === undefined ? null : String(document.clientId),
    identifier_id: document.identifierId ? String(document.identifierId) : null,
    permanent_url: document.permanentUrl ? String(document.permanentUrl) : null,
  };
}

/** Which end holds the newest documents is read from the data, not assumed. */
export function pagesNewestFirst(totalPages: number, firstPageDate: string, lastPageDate: string): number[] {
  const pages = Array.from({ length: Math.max(1, totalPages) }, (_, index) => index + 1);
  return firstPageDate <= lastPageDate ? pages.reverse() : pages;
}

export function usableManualInvoice(row: {
  doc_type: string; number: string; gross: number | string; doc_date: string;
  payment_status: string | null; identifier_id: string | null; client_name: string | null;
}): ManualInvoice | null {
  if (isAppDocument(row.identifier_id) || CANCELLED.test(row.payment_status || '')) return null;
  const number = invoiceRefFor(row.doc_type, row.number);
  return number ? { number, amount: Number(row.gross), date: row.doc_date, customer: row.client_name } : null;
}

/** Same window as the app's own invoices: the FR comes on or after the money. */
export function matchManualInvoice(
  movement: { amount: number; bookingDate: string; counterpartyName: string | null },
  invoices: ManualInvoice[],
): ManualMatch | null {
  const candidates = invoices.filter(invoice =>
    Math.round(invoice.amount * 100) === Math.round(movement.amount * 100)
    && invoice.date >= addDays(movement.bookingDate, -2)
    && invoice.date <= addDays(movement.bookingDate, 30));
  if (candidates.length === 0) return null;
  const named = candidates.filter(invoice => samePerson(movement.counterpartyName, invoice.customer));
  const samePayer = pickSamePayerInvoice(named);
  if (samePayer) return { confidence: 'manual', invoiceRefs: [samePayer.number] };
  if (named.length > 1) return { confidence: 'ambiguous', invoiceRefs: named.map(invoice => invoice.number) };
  if (candidates.length === 1) return { confidence: 'manual_likely', invoiceRefs: [candidates[0].number] };
  return { confidence: 'ambiguous', invoiceRefs: candidates.map(invoice => invoice.number) };
}

export type RepeatedInvoice = { invoiceRefs: string[]; amount: number; date: string; client: string | null };

/**
 * Two FRs for the same client and amount within days are the footprint of a
 * duplicate. Monthly payers are weeks apart, so they never appear here. It only
 * warns: two people on one booking can be legitimate.
 */
export function findRepeatedInvoices(rows: {
  number: string; doc_type: string; gross: number | string; doc_date: string;
  payment_status: string | null; client_id: string | null; client_name: string | null;
}[], withinDays = 3): RepeatedInvoice[] {
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const generic = /consumidor final/i.test(row.client_name || '');
    if (!row.client_id || generic || CANCELLED.test(row.payment_status || '') || !invoiceRefFor(row.doc_type, row.number)) continue;
    const key = `${row.client_id}:${Math.round(Number(row.gross) * 100)}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  const repeated: RepeatedInvoice[] = [];
  for (const group of groups.values()) {
    const ordered = [...group].sort((a, b) => a.doc_date.localeCompare(b.doc_date));
    let run: typeof rows = [];
    const close = () => {
      if (run.length > 1) {
        repeated.push({
          invoiceRefs: run.map(row => invoiceRefFor(row.doc_type, row.number) as string),
          amount: Number(run[0].gross), date: run[run.length - 1].doc_date,
          client: run.find(row => row.client_name)?.client_name ?? null,
        });
      }
    };
    for (const row of ordered) {
      if (run.length && row.doc_date > addDays(run[run.length - 1].doc_date, withinDays)) {
        close();
        run = [];
      }
      run.push(row);
    }
    close();
  }
  return repeated.sort((a, b) => b.date.localeCompare(a.date));
}

export type DonorIdentity = {
  name: string; email: string; nif: string | null;
  address: string; zip: string; city: string; country: string;
};

const FIELD_LABELS: [keyof DonorIdentity, string][] = [
  ['name', 'nome'], ['email', 'email'], ['address', 'morada'],
  ['zip', 'código postal'], ['city', 'cidade'], ['country', 'país'],
];

/** FACT.pt refuses a donation FR without all of these; say so before trying. */
export function missingDonorFields(donor: Partial<DonorIdentity>): string[] {
  const missing = FIELD_LABELS
    .filter(([field]) => !String(donor[field] || '').trim())
    .map(([, label]) => label);
  if (donor.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donor.email.trim())) missing.push('email válido');
  if (donor.country?.trim() && !/^[a-z]{2}$/i.test(donor.country.trim())) missing.push('país com 2 letras');
  const nif = String(donor.nif || '').replace(/[\s.-]/g, '');
  if (nif && !/^\d{5,15}$/.test(nif)) missing.push('NIF válido');
  return missing;
}

/** One person the donation may belong to, for the admin to pick. */
export type DonorCandidate = DonorIdentity & {
  key: string;
  /** FACT.pt: an existing client there (the fiscal record). Donation: typed on the site. */
  source: 'factpt' | 'donation';
  factptClientId: string | null;
  lastInvoice: string | null;
  lastDate: string | null;
  /** How the bank name compares; "search" when the admin looked the client up. */
  match: 'exact' | 'partial' | 'search';
};

export type PastDonationRow = {
  donor_name: string | null; donor_email: string | null; donor_nif: string | null; donor_address: string | null;
  donor_zip: string | null; donor_city: string | null; donor_country: string | null; created_at: string | null;
};
export type MirrorClientRow = {
  number: string | null; doc_date: string | null; client_id: string | number | null; client_name: string | null;
  client_snapshot: Partial<Record<keyof DonorIdentity, string | null>> | null;
};
export type RemoteClientLike = {
  id: string | number; name?: string; tin?: string; email?: string; address?: string;
  zip?: string; city?: string; country?: string; isFinalConsumer?: boolean;
};

const text = (value: unknown) => String(value ?? '').trim();
const digits = (value: unknown) => String(value ?? '').replace(/\D/g, '');
const better = (a: DonorCandidate['match'], b: 'exact' | 'partial'): 'exact' | 'partial' => (a === 'exact' || b === 'exact' ? 'exact' : 'partial');

/** A FACT.pt client as the donation form needs it. Final consumers carry no tax number of their own. */
export function candidateFromRemoteClient(client: RemoteClientLike, match: DonorCandidate['match'] = 'search'): DonorCandidate {
  return {
    key: `factpt:${client.id}`, source: 'factpt', factptClientId: String(client.id),
    name: text(client.name), email: text(client.email), nif: client.isFinalConsumer ? null : digits(client.tin) || null,
    address: text(client.address), zip: text(client.zip), city: text(client.city), country: text(client.country).toUpperCase(),
    lastInvoice: null, lastDate: null, match,
  };
}

/**
 * Everyone the bank name may belong to, best first. Nothing is chosen for the
 * admin unless exactly one FACT.pt client (or, failing that, one person) has
 * every word of the bank name: two people sharing "Ana Lucia" are never
 * taken for one another.
 */
export function rankDonorCandidates(payer: string | null, sources: {
  donations: PastDonationRow[]; mirror: MirrorClientRow[];
}): { candidates: DonorCandidate[]; suggestedKey: string | null } {
  if (!payer) return { candidates: [], suggestedKey: null };

  const factpt = new Map<string, DonorCandidate>();
  for (const row of sources.mirror) {
    const match = payerNameMatch(payer, row.client_name);
    if (!match || !row.client_snapshot) continue;
    const id = row.client_id === null || row.client_id === undefined ? null : String(row.client_id);
    const key = id ? `factpt:${id}` : `factpt-name:${normalizeForMatch(text(row.client_name))}`;
    const known = factpt.get(key);
    if (known && (known.lastDate || '') >= text(row.doc_date)) { known.match = better(known.match, match); continue; }
    const snapshot = row.client_snapshot;
    factpt.set(key, {
      key, source: 'factpt', factptClientId: id,
      name: text(snapshot.name) || text(row.client_name), email: text(snapshot.email), nif: digits(snapshot.nif) || null,
      address: text(snapshot.address), zip: text(snapshot.zip), city: text(snapshot.city), country: text(snapshot.country).toUpperCase(),
      lastInvoice: row.number ? `FR ${row.number}` : null, lastDate: text(row.doc_date) || null,
      match: known ? better(known.match, match) : match,
    });
  }

  const donations = new Map<string, DonorCandidate>();
  for (const row of sources.donations) {
    const match = payerNameMatch(payer, row.donor_name);
    if (!match) continue;
    const email = text(row.donor_email).toLowerCase();
    const key = `donation:${email || normalizeForMatch(text(row.donor_name))}`;
    const known = donations.get(key);
    const date = text(row.created_at).slice(0, 10);
    if (known && (known.lastDate || '') >= date) { known.match = better(known.match, match); continue; }
    donations.set(key, {
      key, source: 'donation', factptClientId: null,
      name: text(row.donor_name), email: text(row.donor_email), nif: digits(row.donor_nif) || null,
      address: text(row.donor_address), zip: text(row.donor_zip), city: text(row.donor_city), country: (text(row.donor_country) || 'PT').toUpperCase(),
      lastInvoice: null, lastDate: date || null,
      match: known ? better(known.match, match) : match,
    });
  }

  // A site donation already known to FACT.pt is the same person: FACT.pt wins.
  const clients = [...factpt.values()];
  const sameAsClient = (candidate: DonorCandidate) => clients.some(client =>
    (candidate.email && client.email.toLowerCase() === candidate.email.toLowerCase())
    || (candidate.nif && client.nif === candidate.nif)
    || normalizeForMatch(client.name) === normalizeForMatch(candidate.name));
  const rank = (candidate: DonorCandidate) => (candidate.match === 'exact' ? 0 : 2) + (candidate.source === 'factpt' ? 0 : 1);
  const candidates = [...clients, ...[...donations.values()].filter(candidate => !sameAsClient(candidate))]
    .sort((a, b) => rank(a) - rank(b) || (b.lastDate || '').localeCompare(a.lastDate || ''))
    .slice(0, 8);

  const exactClients = candidates.filter(candidate => candidate.match === 'exact' && candidate.source === 'factpt');
  const exact = candidates.filter(candidate => candidate.match === 'exact');
  const suggested = exactClients.length === 1 ? exactClients[0] : exactClients.length === 0 && exact.length === 1 ? exact[0] : null;
  return { candidates, suggestedKey: suggested?.key || null };
}
