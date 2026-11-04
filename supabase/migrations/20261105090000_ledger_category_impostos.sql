-- Payments to the State: Finanças (DUC, IRS withheld) and Segurança Social (TSU).
insert into public.ledger_categories (code, label, direction, requires_invoice, requires_document, sort)
values ('impostos', 'Impostos e Segurança Social', 'out', false, true, 165)
on conflict (code) do nothing;
