-- Índices de suporte para as chaves estrangeiras das tabelas de gestão push.
-- Evitam scans completos quando um utilizador de Auth é removido.

create index if not exists push_campaigns_created_by_idx
  on public.push_campaigns(created_by);

create index if not exists push_automation_settings_updated_by_idx
  on public.push_automation_settings(updated_by);
