-- Cover the FACT.pt document-to-client cache foreign key on databases where
-- the main sandbox migration has already been applied.
create index if not exists factpt_documents_client_cache_id_idx
  on public.factpt_documents (client_cache_id)
  where client_cache_id is not null;
