import 'server-only';

import { classifyMovement } from './classify';
import { loadManualInvoices } from './factpt-mirror';
import { categoryForInvoice, matchManualInvoice } from './factpt-mirror-rules';
import { addDays, pickSamePayerInvoice, samePerson } from './invoice-safety';
import { db, loadCustomRules } from './server';

/*
 * Uses what the site already knows (FACT.pt documents issued by the app and
 * the payments behind them) to tell what each incoming bank transfer is.
 *
 * Safety rules — this never creates a payment, never changes a payment's
 * status and never issues an invoice:
 *   - certain (exactly one app FR with this amount and date window AND the
 *     payer's name matches the FR customer): the movement is LINKED to that
 *     existing pilgrimage payment (link only), so the admin just confirms;
 *   - likely (exactly one app FR with this amount and date, different payer,
 *     e.g. paid by Wise or a spouse): only a suggestion, nothing is linked;
 *   - several possible FRs: only the category is suggested; the admin picks.
 * With no app FR, the read-only copy of FACT.pt is searched for an invoice the
 * admin issued by hand. That is always a suggestion: nothing is linked.
 */

type Movement = { id: string; booking_date: string; amount: number; counterparty_name: string | null; raw: Record<string, unknown> | null };
type AppInvoice = {
  id: string; number: string; amount: number; date: string; customer: string | null;
  sourceType: 'pilgrimage' | 'donation'; sourceId: string;
};

export type EnrichResult = { examined: number; linked: number; likely: number; ambiguous: number; plan?: string[] };

const CATEGORY_FOR: Record<AppInvoice['sourceType'], string> = { pilgrimage: 'peregrinacao', donation: 'doacao' };

function customerName(snapshot: unknown): string | null {
  const name = (snapshot as { customer?: { name?: unknown } } | null)?.customer?.name;
  return typeof name === 'string' ? name : null;
}

/** dryRun: decide everything but write nothing (used to check against real data). */
export async function enrichIncomingMovements(options: { sinceDays?: number; dryRun?: boolean } = {}): Promise<EnrichResult> {
  const since = addDays(new Date().toISOString().slice(0, 10), -(options.sinceDays ?? 120));

  const { data: movements, error: movementsError } = await db().from('bank_transactions')
    .select('id, booking_date, amount, counterparty_name, raw')
    .gt('amount', 0)
    .in('parsed_kind', ['incoming_transfer'])
    .in('status', ['unreviewed', 'suggested'])
    .gte('booking_date', since)
    .order('booking_date', { ascending: true });
  if (movementsError) throw movementsError;
  const rows = (movements || []).map(row => ({ ...row, amount: Number(row.amount) })) as Movement[];
  if (rows.length === 0) return { examined: 0, linked: 0, likely: 0, ambiguous: 0 };

  // Movements and payments/FRs already tied to something are left alone.
  const { data: links, error: linksError } = await db().from('bank_transaction_links')
    .select('bank_transaction_id, target_type, target_id');
  if (linksError) throw linksError;
  const linkedMovements = new Set((links || []).map(link => link.bank_transaction_id as string));
  const takenTargets = new Set((links || []).map(link => `${link.target_type}:${link.target_id}`));

  const { data: documents, error: documentsError } = await db().from('factpt_documents')
    .select('id, factpt_number, amount, payment_confirmed_at, fiscal_snapshot, source_type, source_id, status, payment_method')
    .eq('environment', 'production')
    .in('status', ['issued', 'email_failed'])
    .eq('payment_method', 'bank_transfer')
    .in('source_type', ['pilgrimage', 'donation'])
    .gte('payment_confirmed_at', addDays(rows[0].booking_date, -2));
  if (documentsError) throw documentsError;
  const invoices: AppInvoice[] = (documents || [])
    .filter(doc => doc.factpt_number && doc.payment_confirmed_at)
    .filter(doc => !takenTargets.has(`factpt_document:${doc.factpt_number}`)
      && !takenTargets.has(`pilgrimage_payment:${doc.source_id}`)
      && !takenTargets.has(`donation:${doc.source_id}`))
    .map(doc => ({
      id: doc.id, number: doc.factpt_number as string, amount: Number(doc.amount),
      date: String(doc.payment_confirmed_at).slice(0, 10), customer: customerName(doc.fiscal_snapshot),
      sourceType: doc.source_type as AppInvoice['sourceType'], sourceId: doc.source_id as string,
    }));

  const takenRefs = new Set((links || []).filter(link => link.target_type === 'factpt_document').map(link => String(link.target_id)));
  const appNumbers = new Set((documents || []).map(doc => doc.factpt_number as string | null).filter(Boolean));
  const manualInvoices = (await loadManualInvoices(addDays(rows[0].booking_date, -2), takenRefs))
    .filter(invoice => !appNumbers.has(invoice.number));
  const usedManual = new Set<string>();

  const used = new Set<string>();
  const result: EnrichResult = { examined: 0, linked: 0, likely: 0, ambiguous: 0, plan: options.dryRun ? [] : undefined };

  for (const movement of rows) {
    if (linkedMovements.has(movement.id)) continue;
    result.examined += 1;
    // The money reaches the bank before (or on) the day the admin registers it.
    const candidates = invoices.filter(invoice => !used.has(invoice.id)
      && Math.round(invoice.amount * 100) === Math.round(movement.amount * 100)
      && invoice.date >= addDays(movement.booking_date, -2)
      && invoice.date <= addDays(movement.booking_date, 30));
    const named = candidates.filter(invoice => samePerson(movement.counterparty_name, invoice.customer));
    const manual = named.length > 0 ? null : matchManualInvoice(
      { amount: movement.amount, bookingDate: movement.booking_date, counterpartyName: movement.counterparty_name },
      manualInvoices.filter(invoice => !usedManual.has(invoice.number)),
    );
    // A hand-issued FR with the payer's name beats an app FR in someone else's.
    if (candidates.length === 0 || manual?.confidence === 'manual') {
      if (!manual) continue;
      if (manual.confidence !== 'ambiguous') usedManual.add(manual.invoiceRefs[0]);
      if (manual.confidence === 'ambiguous') result.ambiguous += 1; else result.likely += 1;
      const found = manual.confidence === 'ambiguous'
        ? { confidence: 'ambiguous', invoiceRefs: manual.invoiceRefs, reason: `${manual.invoiceRefs.length} FRs manuais na FACT.pt com este valor e data próxima — escolha a certa` }
        : {
            confidence: manual.confidence,
            invoiceRef: manual.invoiceRefs[0],
            reason: manual.confidence === 'manual'
              ? 'FR emitida à mão na FACT.pt com o mesmo valor e o nome do pagador'
              : `FR emitida à mão em nome de ${manualInvoices.find(invoice => invoice.number === manual.invoiceRefs[0])?.customer || 'outro cliente'}, com o mesmo valor; quem pagou foi outra pessoa`,
          };
      if (options.dryRun) result.plan?.push(`${manual.confidence.toUpperCase()} ${movement.booking_date} ${movement.amount} ${movement.counterparty_name} -> ${manual.invoiceRefs.join('/')}`);
      else {
        // With candidates from different series only the admin can say which it is.
        const categories = new Set(manual.invoiceRefs.map(categoryForInvoice));
        const suggested = categories.size === 1 ? [...categories][0] : null;
        await saveSuggestion(movement, { suggested_category: suggested ?? movement.raw?.suggested_category ?? null, suggestion: found });
      }
      continue;
    }

    const category = CATEGORY_FOR[candidates[0].sourceType];
    const sameKind = candidates.every(invoice => invoice.sourceType === candidates[0].sourceType);
    let suggestion: Record<string, unknown>;

    const invoice = pickSamePayerInvoice(named);
    if (invoice) {
      used.add(invoice.id);
      if (invoice.sourceType === 'pilgrimage') {
        const { data: payment, error: paymentError } = await db().from('pilgrimage_payments')
          .select('id, booking_id, status, method, deleted').eq('id', invoice.sourceId).maybeSingle();
        if (paymentError) throw paymentError;
        const linkable = payment && !payment.deleted && payment.method === 'bank_transfer'
          && ['verified', 'manual', 'succeeded', 'paid'].includes(payment.status);
        if (linkable && options.dryRun) {
          result.linked += 1;
          result.plan?.push(`LIGAR ${movement.booking_date} ${movement.amount} ${movement.counterparty_name} -> ${invoice.number} (${invoice.customer})`);
          continue;
        }
        if (linkable) {
          // Link only: the RPC refuses to create or verify anything on this path.
          const { error: linkError } = await db().rpc('ledger_register_pilgrimage_transfer', {
            p_transaction_id: movement.id,
            p_booking_id: payment.booking_id,
            p_payment_id: payment.id,
            p_admin_user_id: null,
            p_actor: 'sistema',
          });
          if (!linkError) {
            result.linked += 1;
            await saveSuggestion(movement, {
              suggested_category: 'peregrinacao',
              suggestion: { confidence: 'certain', invoiceRef: invoice.number, reason: 'FR da app com o mesmo valor e o nome do pagador' },
            });
            continue;
          }
        }
      }
      suggestion = { confidence: 'certain', invoiceRef: invoice.number, reason: 'FR da app com o mesmo valor e o nome do pagador' };
      result.likely += 1;
    } else if (candidates.length === 1) {
      used.add(candidates[0].id);
      suggestion = { confidence: 'likely', invoiceRef: candidates[0].number, reason: `FR da app em nome de ${candidates[0].customer || 'outra pessoa'}, com o mesmo valor; quem pagou foi outra pessoa` };
      result.likely += 1;
    } else {
      suggestion = {
        confidence: 'ambiguous',
        invoiceRefs: candidates.map(invoice => invoice.number),
        reason: `${candidates.length} FRs da app com este valor e data próxima — escolha a certa`,
      };
      result.ambiguous += 1;
    }
    if (options.dryRun) {
      result.plan?.push(`${String(suggestion.confidence).toUpperCase()} ${movement.booking_date} ${movement.amount} ${movement.counterparty_name} -> ${suggestion.invoiceRef || (suggestion.invoiceRefs as string[] | undefined)?.join('/')}`);
      continue;
    }
    await saveSuggestion(movement, { suggested_category: sameKind ? category : movement.raw?.suggested_category ?? null, suggestion });
  }
  return result;
}

async function saveSuggestion(movement: Movement, patch: Record<string, unknown>) {
  const raw = { ...(movement.raw || {}), ...patch };
  const { error } = await db().from('bank_transactions').update({ raw }).eq('id', movement.id);
  if (error) throw error;
}

/**
 * Re-applies the current categorisation rules to movements nobody has handled
 * yet (rules improve over time). Never touches reviewed, ignored or linked
 * movements, and never changes the bank facts.
 */
export async function reclassifyOpenMovements(options: { dryRun?: boolean } = {}): Promise<{ changed: number }> {
  const [{ data: movements, error }, { data: links, error: linksError }, rules] = await Promise.all([
    db().from('bank_transactions')
      .select('id, description_raw, amount, category_code, needs_document, raw, status, reviewed_by')
      .in('status', ['unreviewed', 'suggested'])
      .is('reviewed_by', null),
    db().from('bank_transaction_links').select('bank_transaction_id'),
    loadCustomRules(),
  ]);
  if (error) throw error;
  if (linksError) throw linksError;
  const linked = new Set((links || []).map(link => link.bank_transaction_id as string));
  let changed = 0;
  for (const movement of movements || []) {
    if (linked.has(movement.id)) continue;
    const guess = classifyMovement(movement.description_raw, Number(movement.amount), rules);
    const raw = (movement.raw || {}) as Record<string, unknown>;
    const nextSuggested = raw.suggestion ? raw.suggested_category : guess.suggestedCategoryCode;
    if (guess.categoryCode === movement.category_code && nextSuggested === raw.suggested_category) continue;
    changed += 1;
    if (options.dryRun) continue;
    const { error: updateError } = await db().from('bank_transactions').update({
      category_code: guess.categoryCode,
      status: guess.categoryCode ? 'suggested' : 'unreviewed',
      needs_document: guess.needsDocument,
      raw: { ...raw, suggested_category: nextSuggested ?? null },
    }).eq('id', movement.id);
    if (updateError) throw updateError;
  }
  return { changed };
}
