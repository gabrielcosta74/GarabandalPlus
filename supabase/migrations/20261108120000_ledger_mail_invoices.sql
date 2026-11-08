-- Faturas das subscrições (Railway, Resend, Supabase, Mobbin, Vodafone,
-- Tranquilidade…) recebidas na caixa geral@. A lista de fornecedores vive no
-- código (mail-invoices-parse.ts), não aqui.
--
-- A fatura chega por email uns dias antes de o pagamento aparecer no banco, por
-- isso fica aqui à espera; quando o movimento entra, os PDFs passam a
-- expense_documents desse movimento. Os ficheiros vivem no bucket privado
-- ledger-documents, em email/<fornecedor>/<n.º da fatura>/.

create table if not exists public.ledger_mail_invoices (
  id uuid primary key default gen_random_uuid(),
  supplier text not null,
  doc_number text not null check (length(doc_number) between 3 and 80),
  message_id text,
  mail_folder text,
  mail_uid integer,
  sender text,
  subject text,
  received_at timestamptz not null,
  paid_on date,
  amount numeric(12, 2),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  -- [{ kind: 'invoice' | 'receipt', number, file_name, storage_path, sha256, size_bytes }]
  files jsonb not null default '[]'::jsonb check (jsonb_typeof(files) = 'array'),
  -- waiting = à espera do movimento; attached = PDFs no movimento;
  -- outside = anterior ao início do histórico do banco, nunca terá movimento.
  status text not null default 'waiting' check (status in ('waiting', 'attached', 'outside')),
  bank_transaction_id uuid references public.bank_transactions(id) on delete set null,
  attached_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ledger_mail_invoices_doc_once unique (supplier, doc_number),
  constraint ledger_mail_invoices_attached_has_tx
    check (status <> 'attached' or bank_transaction_id is not null)
);

-- A primeira versão fixava três fornecedores; agora só o formato da chave.
alter table public.ledger_mail_invoices drop constraint if exists ledger_mail_invoices_supplier_check;
alter table public.ledger_mail_invoices drop constraint if exists ledger_mail_invoices_supplier_format;
alter table public.ledger_mail_invoices add constraint ledger_mail_invoices_supplier_format
  check (supplier ~ '^[a-z0-9-]{2,30}$');

create index if not exists ledger_mail_invoices_status_idx
  on public.ledger_mail_invoices(status, paid_on);
create index if not exists ledger_mail_invoices_message_idx
  on public.ledger_mail_invoices(message_id);
-- Um movimento do banco recebe no máximo uma fatura de fornecedor.
create unique index if not exists ledger_mail_invoices_tx_once
  on public.ledger_mail_invoices(bank_transaction_id)
  where bank_transaction_id is not null;

alter table public.ledger_mail_invoices enable row level security;
revoke all on public.ledger_mail_invoices from anon, authenticated;
grant select, insert, update on public.ledger_mail_invoices to service_role;
