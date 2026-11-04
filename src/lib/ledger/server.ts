import 'server-only';

import { verifyAdmin } from '../admin-auth';
import { supabaseServer } from '../supabase';
import { MAX_STATEMENT_BYTES } from './read-statement';
import type { CategoryCode, CustomRule, ParsedKind } from './classify';

/** Shape the admin UI works with, for both stored and preview movements. */
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
  /** FR already issued by the app for the linked pilgrimage payment. */
  appInvoiceRef?: string | null;
  /** What the cross-check with the site's invoices found (see lib/ledger/enrich.ts). */
  suggestion?: { confidence: string; reason: string; invoiceRef: string | null; invoiceRefs: string[] } | null;
  status: 'unreviewed' | 'suggested' | 'reconciled' | 'ignored';
  ignoreReason: string | null;
  notes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

export class LedgerNotReadyError extends Error {
  constructor() {
    super('As tabelas da contabilidade ainda não foram criadas na base de dados.');
  }
}

/** PostgREST / Postgres codes for "relation does not exist". */
export function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || '');
}

export async function requireAdmin(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth.authorized || !auth.user?.email) {
    return { ok: false as const, response: Response.json({ error: auth.error || 'Sem acesso.' }, { status: 401 }) };
  }
  return { ok: true as const, email: String(auth.user.email).toLowerCase(), userId: String(auth.user.id) };
}

export function db() {
  if (!supabaseServer) throw new Error('Configuração do servidor em falta.');
  return supabaseServer;
}

/** The Montepio account row, or null while the migration is not applied. */
export async function getMontepioAccount(): Promise<{ id: string } | null> {
  const { data, error } = await db()
    .from('bank_accounts')
    .select('id')
    .eq('provider', 'montepio')
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return data ? { id: data.id as string } : null;
}

export async function loadCustomRules(): Promise<CustomRule[]> {
  const { data, error } = await db()
    .from('categorization_rules')
    .select('pattern, match_type, direction, category_code, priority')
    .eq('active', true);
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return (data || []).map(rule => ({
    pattern: rule.pattern as string,
    matchType: rule.match_type as CustomRule['matchType'],
    direction: (rule.direction as CustomRule['direction']) || null,
    categoryCode: rule.category_code as CategoryCode,
    priority: Number(rule.priority) || 100,
  }));
}

/** Fingerprints already stored for the period covered by a statement. */
export async function loadExistingFingerprints(from: string | null, to: string | null): Promise<Set<string>> {
  const result = new Set<string>();
  if (!from || !to) return result;
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db()
      .from('bank_transactions')
      .select('fingerprint')
      .gte('booking_date', from)
      .lte('booking_date', to)
      .range(offset, offset + pageSize - 1);
    if (error) {
      if (isMissingTableError(error)) return result;
      throw error;
    }
    (data || []).forEach(row => result.add(row.fingerprint as string));
    if (!data || data.length < pageSize) break;
  }
  return result;
}

export function readFormFile(form: FormData): File {
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new Error('Escolha o ficheiro do extrato.');
  if (file.size > MAX_STATEMENT_BYTES) throw new Error('O ficheiro é demasiado grande (máximo 10 MB).');
  if (file.name.length > 255) throw new Error('O nome do ficheiro é demasiado longo.');
  return file as File;
}

/** Reject oversized uploads before multipart parsing when the browser sends a size. */
export function statementRequestTooLarge(req: Request): boolean {
  const length = Number(req.headers.get('content-length'));
  return Number.isFinite(length) && length > MAX_STATEMENT_BYTES + 1024 * 1024;
}
