-- Reproduces the private bucket created for the administrator's accounting archive.
-- Object paths use reversible ASCII encoding; the originals are shown only by
-- the authenticated admin API. Direct Storage access is reserved for the
-- server's service role, even if another permissive Storage policy is added.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'accounting-archive', 'accounting-archive', false, 20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists accounting_archive_service_only on storage.objects;
create policy accounting_archive_service_only on storage.objects
  as restrictive for all to public
  using (bucket_id <> 'accounting-archive')
  with check (bucket_id <> 'accounting-archive');
