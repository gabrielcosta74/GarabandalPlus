import { normalizeForMatch } from './classify';

/** How many matching confirmations before a payer's category is suggested. */
export const LEARNED_AFTER = 2;

export type AliasCounts = { default_category_code: string | null; times_confirmed: number };

export function aliasKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = normalizeForMatch(name).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return key.length >= 3 ? key : null;
}

/** A different answer restarts the count: the latest human decision wins. */
export function afterConfirmation(existing: AliasCounts | null, categoryCode: string): AliasCounts {
  if (existing?.default_category_code === categoryCode) {
    return { default_category_code: categoryCode, times_confirmed: existing.times_confirmed + 1 };
  }
  return { default_category_code: categoryCode, times_confirmed: 1 };
}

/** Undoing a confirmation takes it back, so a mistake never becomes a habit. */
export function afterUndo(existing: AliasCounts, categoryCode: string): AliasCounts {
  if (existing.default_category_code !== categoryCode) return existing;
  return { ...existing, times_confirmed: Math.max(0, existing.times_confirmed - 1) };
}

export function isLearned(alias: AliasCounts | null | undefined): boolean {
  return !!alias?.default_category_code && alias.times_confirmed >= LEARNED_AFTER;
}
