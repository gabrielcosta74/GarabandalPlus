import { db } from './server';

const SOURCES: Record<string, { table: string; category: string }> = {
  donation: { table: 'donations', category: 'doacao' },
  pilgrimage_payment: { table: 'pilgrimage_payments', category: 'peregrinacao' },
};

/**
 * The admin already decided when they issued the FR or chose the booking, so
 * asking them to approve the same movement again would be a step with no
 * meaning. Marked movements close by themselves once their FR exists.
 */
export async function closeWhenInvoiced(movementId: string) {
  const { data, error } = await db().from('bank_transactions').select('raw').eq('id', movementId).maybeSingle();
  if (error) throw error;
  const { error: saveError } = await db().from('bank_transactions')
    .update({ raw: { ...(data?.raw || {}), close_when_invoiced: true } }).eq('id', movementId);
  if (saveError) throw saveError;
}

/** Reopening is a decision to look again: the movement must not close by itself. */
export async function stopClosingWhenInvoiced(movementId: string) {
  const { data, error } = await db().from('bank_transactions').select('raw').eq('id', movementId).maybeSingle();
  if (error) throw error;
  if (!data?.raw?.close_when_invoiced) return;
  const raw = { ...data.raw };
  delete raw.close_when_invoiced;
  const { error: saveError } = await db().from('bank_transactions').update({ raw }).eq('id', movementId);
  if (saveError) throw saveError;
}

export async function closeInvoicedMovements(onlyId?: string): Promise<{ closed: number }> {
  let query = db().from('bank_transactions').select('id, raw, reviewed_by')
    .eq('status', 'suggested').eq('raw->>close_when_invoiced', 'true');
  if (onlyId) query = query.eq('id', onlyId);
  const { data: movements, error } = await query;
  if (error) throw error;

  let closed = 0;
  for (const movement of movements || []) {
    const { data: links, error: linksError } = await db().from('bank_transaction_links')
      .select('target_type, target_id').eq('bank_transaction_id', movement.id)
      .in('target_type', Object.keys(SOURCES));
    if (linksError) throw linksError;
    const link = links?.[0];
    const source = link ? SOURCES[link.target_type] : null;
    if (!link || !source) continue;

    const { data: document, error: documentError } = await db().from('factpt_documents')
      .select('factpt_number, status').eq('environment', 'production')
      .eq('source_table', source.table).eq('source_id', link.target_id).maybeSingle();
    if (documentError) throw documentError;
    if (!document?.factpt_number || !['issued', 'email_failed'].includes(document.status)) continue;

    const { error: approveError } = await db().rpc('ledger_approve_movement', {
      p_transaction_id: movement.id,
      p_category_code: source.category,
      p_invoice_ref: document.factpt_number,
      p_invoice_method: 'rule',
      p_actor: movement.reviewed_by || 'sistema',
    });
    if (approveError) throw approveError;

    const raw = { ...(movement.raw || {}) };
    delete raw.close_when_invoiced;
    const { error: saveError } = await db().from('bank_transactions').update({ raw }).eq('id', movement.id);
    if (saveError) throw saveError;
    closed += 1;
  }
  return { closed };
}
