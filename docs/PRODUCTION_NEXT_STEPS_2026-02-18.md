# Production Next Steps (2026-02-18)

This document is the execution plan to finish production hardening safely.

## 1) Run the automated pre-production gates

Commands:

```bash
npm run preprod:check
npm run preprod:security
```

Expected result:

1. TypeScript and build pass.
2. Critical endpoint hardening checks pass.
3. Security script fails only while `next@14.2.5` remains (known blocker).

Notes:

1. Project engine is `node >=20 <23`.
2. For local diagnostics only, you can bypass engine check:

```bash
ALLOW_UNSUPPORTED_NODE=1 npm run preprod:check
```

## 2) Enable RLS on `bookings` and `pilgrims` in staging first

Migration:

`migrations/20260218_enable_rls_bookings_pilgrims.sql`

Status (2026-02-18):

1. Migration was applied successfully.
2. `public.bookings` and `public.pilgrims` now have `rls_enabled = true`.
3. Supabase security advisors no longer report `rls_disabled_in_public`/`policy_exists_rls_disabled` for these two tables.

Execution order:

1. Apply migration in staging database.
2. Run smoke tests:
   - Create booking flow.
   - View own booking flow.
   - Admin manual payment registration.
   - Admin booking operations.
3. Re-run Supabase advisors and confirm these errors disappear:
   - `policy_exists_rls_disabled` for `bookings` and `pilgrims`.
   - `rls_disabled_in_public` for `bookings` and `pilgrims`.

Keep the same sequence for future environments before promoting.

## 3) Resolve Next.js security blocker (`next@14.2.5`)

Current status:

1. `next@14.2.35` upgrade compiles but fails at prerender with:
   - `Element type is invalid ... got: undefined`
   - Digest: `2433190501`
2. Because of this, runtime was reverted to stable `14.2.5`.

Execution plan:

1. Create branch dedicated to upgrade debugging.
2. Upgrade only these packages together:
   - `next@14.2.35`
   - `eslint-config-next@14.2.35`
3. Run `npm run build`.
4. Identify the first page that triggers the invalid element and isolate the import/component causing `undefined`.
5. Fix root cause, then re-run:
   - `npm run preprod:check`
   - `npm run preprod:security`

Go-live gate:

1. `npm audit --omit=dev` must report zero `critical` and zero `high`.

## 4) Remaining hardening backlog after the blockers above

1. Apply RLS enablement for other public sensitive tables (`store_orders`, `donations`, `store_order_items`, etc.) in staged batches.
2. Continue replacing weak origin-only guards on public endpoints with real rate limiting (IP + token bucket).
   - Completed on:
   - `POST /api/booking/check-duplicate`
   - `POST /api/members/check-status`
   - `POST /api/leads/capture`
   - `POST /api/pilgrimages/checkout`
   - `POST /api/payments/checkout`
   - `POST /api/store/checkout`
3. Review and tighten permissive RLS policies flagged by Supabase advisors.
4. Remove or archive backup files (`*.bak*`, `*.current*`, `* 2.ts`, `* 3.ts`) from active source paths.
