import 'server-only';

import { afterConfirmation, afterUndo, aliasKey, isLearned, type AliasCounts } from './alias-rules';
import { categoriesFor, categoryLabel } from './categories';
import { db, isMissingTableError } from './server';

async function loadAlias(key: string) {
  const { data, error } = await db().from('counterparty_aliases')
    .select('id, default_category_code, times_confirmed').eq('alias_normalized', key).maybeSingle();
  if (error) throw error;
  return data as (AliasCounts & { id: string }) | null;
}

/** Remembers what a human decided. Only people teach the system, never its own guesses. */
export async function learnCounterparty(name: string | null, categoryCode: string) {
  const key = aliasKey(name);
  if (!key || !name) return;
  const existing = await loadAlias(key);
  const next = afterConfirmation(existing, categoryCode);
  const now = new Date().toISOString();
  const { error } = existing
    ? await db().from('counterparty_aliases').update({ ...next, last_seen_at: now, updated_at: now }).eq('id', existing.id)
    : await db().from('counterparty_aliases').insert({ ...next, alias_normalized: key, display_name: name, last_seen_at: now });
  if (error) throw error;
}

export async function forgetConfirmation(name: string | null, categoryCode: string | null) {
  const key = aliasKey(name);
  if (!key || !categoryCode) return;
  const existing = await loadAlias(key);
  if (!existing) return;
  const { error } = await db().from('counterparty_aliases')
    .update({ ...afterUndo(existing, categoryCode), updated_at: new Date().toISOString() }).eq('id', existing.id);
  if (error) throw error;
}

/**
 * Suggests the category a payer always had. A suggestion only: nothing is
 * approved, and invoice matches found by enrich.ts take priority.
 */
export async function applyLearnedCategories(options: { dryRun?: boolean } = {}): Promise<{ suggested: number }> {
  const [{ data: aliases, error: aliasError }, { data: movements, error: movementError }, { data: links, error: linkError }] = await Promise.all([
    db().from('counterparty_aliases').select('alias_normalized, default_category_code, times_confirmed').gte('times_confirmed', 1),
    db().from('bank_transactions').select('id, amount, counterparty_name, raw')
      .in('status', ['unreviewed', 'suggested']).is('category_code', null).is('reviewed_by', null)
      .not('counterparty_name', 'is', null),
    db().from('bank_transaction_links').select('bank_transaction_id'),
  ]);
  if (aliasError || movementError || linkError) {
    const failure = aliasError || movementError || linkError;
    if (isMissingTableError(failure)) return { suggested: 0 };
    throw failure;
  }
  const known = new Map((aliases || []).map(alias => [alias.alias_normalized as string, alias as AliasCounts]));
  const linked = new Set((links || []).map(link => link.bank_transaction_id as string));
  let suggested = 0;

  for (const movement of movements || []) {
    const raw = (movement.raw || {}) as Record<string, unknown>;
    const current = raw.suggestion as { confidence?: string } | undefined;
    if (linked.has(movement.id) || (current && current.confidence !== 'learned')) continue;
    const alias = known.get(aliasKey(movement.counterparty_name) || '');
    if (!isLearned(alias) || !alias?.default_category_code) continue;
    const code = alias.default_category_code;
    if (!categoriesFor(Number(movement.amount)).some(category => category.code === code)) continue;
    const reason = `Confirmado ${alias.times_confirmed} vezes como ${categoryLabel(code)}`;
    if (raw.suggested_category === code && (raw.suggestion as { reason?: string } | undefined)?.reason === reason) continue;
    suggested += 1;
    if (options.dryRun) continue;
    const { error } = await db().from('bank_transactions').update({
      raw: { ...raw, suggested_category: code, suggestion: { confidence: 'learned', reason } },
    }).eq('id', movement.id);
    if (error) throw error;
  }
  return { suggested };
}
