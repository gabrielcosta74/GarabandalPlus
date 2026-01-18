insert into storage.buckets (id, name, public)
values ('store-reports', 'store-reports', false)
on conflict (id) do update set public = false;
