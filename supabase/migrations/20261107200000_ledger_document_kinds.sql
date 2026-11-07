-- What each expense file is: the invoice, a payment receipt, a proforma…
alter table public.expense_documents
  add column if not exists doc_kind text not null default 'fatura'
  check (doc_kind in ('fatura', 'comprovativo', 'proforma', 'recibo', 'outro'));
