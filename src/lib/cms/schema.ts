import 'server-only';

/**
 * Runtime guard for the optional `mt_unreviewed` column (added by migration
 * 20260621120000_add_mt_unreviewed.sql). Until that migration is applied the CMS
 * must keep working — so the first query/write that hits the missing column
 * flips this flag and every later statement skips the column instead of erroring
 * (which would otherwise 404 the editor / fail saves). The "review badge" feature
 * simply stays off until the column exists. The flag resets on process restart,
 * so once the migration is applied a redeploy re-enables the column.
 */
let mtUnreviewedMissing = false;

export function mtUnreviewedAvailable(): boolean {
  return !mtUnreviewedMissing;
}

export function markMtUnreviewedMissing(): void {
  if (!mtUnreviewedMissing) {
    mtUnreviewedMissing = true;
    console.warn(
      '[cms] column mt_unreviewed not found — apply migration 20260621120000_add_mt_unreviewed.sql. ' +
        'Translation review badges are disabled until then.',
    );
  }
}

/** True when a Supabase/Postgres error is "undefined column" for mt_unreviewed. */
export function isMissingMtColumn(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { code?: string; message?: string };
  return err.code === '42703' && /mt_unreviewed/.test(err.message ?? '');
}
