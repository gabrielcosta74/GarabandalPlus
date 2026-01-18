insert into storage.buckets (id, name, public)
values ('store-products', 'store-products', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read store products" on storage.objects;
create policy "Public read store products"
on storage.objects for select
using (bucket_id = 'store-products');

drop policy if exists "Authenticated upload store products" on storage.objects;
create policy "Authenticated upload store products"
on storage.objects for insert
to authenticated
with check (bucket_id = 'store-products');

drop policy if exists "Authenticated update store products" on storage.objects;
create policy "Authenticated update store products"
on storage.objects for update
to authenticated
using (bucket_id = 'store-products')
with check (bucket_id = 'store-products');

drop policy if exists "Authenticated delete store products" on storage.objects;
create policy "Authenticated delete store products"
on storage.objects for delete
to authenticated
using (bucket_id = 'store-products');
