alter table public.pilgrimage_payments
  add column if not exists billing_name text,
  add column if not exists billing_email text,
  add column if not exists billing_address text,
  add column if not exists billing_postal_code text,
  add column if not exists billing_city text,
  add column if not exists billing_country text,
  add column if not exists billing_nif text,
  add column if not exists billing_tax_id_requested boolean not null default false;

comment on column public.pilgrimage_payments.billing_name is
  'Immutable account-holder name captured before this payment.';
comment on column public.pilgrimage_payments.billing_email is
  'Immutable account-holder email captured before this payment.';
comment on column public.pilgrimage_payments.billing_address is
  'Immutable billing street captured before this payment.';
comment on column public.pilgrimage_payments.billing_postal_code is
  'Immutable billing postal code captured before this payment.';
comment on column public.pilgrimage_payments.billing_city is
  'Immutable billing city captured before this payment.';
comment on column public.pilgrimage_payments.billing_country is
  'Immutable ISO 3166-1 alpha-2 billing country captured before this payment.';
comment on column public.pilgrimage_payments.billing_nif is
  'Tax identifier captured only when the account holder requested it on the invoice.';
comment on column public.pilgrimage_payments.billing_tax_id_requested is
  'True only when the account holder explicitly requested NIF/CPF on this invoice.';

alter table public.pilgrimage_payments
  drop constraint if exists pilgrimage_payments_billing_snapshot_complete,
  add constraint pilgrimage_payments_billing_snapshot_complete
    check (
      num_nonnulls(
        nullif(btrim(billing_name), ''),
        nullif(btrim(billing_email), ''),
        nullif(btrim(billing_address), ''),
        nullif(btrim(billing_postal_code), ''),
        nullif(btrim(billing_city), ''),
        nullif(btrim(billing_country), '')
      ) in (0, 6)
    ),
  drop constraint if exists pilgrimage_payments_billing_country_iso2,
  add constraint pilgrimage_payments_billing_country_iso2
    check (
      billing_country is null
      or billing_country ~ '^[A-Z]{2}$'
    ),
  drop constraint if exists pilgrimage_payments_requested_tax_id_present,
  add constraint pilgrimage_payments_requested_tax_id_present
    check (
      (
        billing_tax_id_requested
        and nullif(btrim(billing_nif), '') is not null
      )
      or (
        not billing_tax_id_requested
        and nullif(btrim(billing_nif), '') is null
      )
    );

alter table public.factpt_settings
  add column if not exists auto_issue_reconciled_reduniq boolean not null default false;

comment on column public.factpt_settings.auto_issue_reconciled_reduniq is
  'When enabled, terminal Reduniq confirmations recovered by reconciliation enter the normal automatic FACT.pt queue.';
