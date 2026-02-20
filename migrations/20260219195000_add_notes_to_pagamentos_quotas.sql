-- Some admin/member payment flows persist operational notes for quota payments.
-- Keep this idempotent to be safe across environments.

alter table public.pagamentos_quotas
  add column if not exists notes text null;
