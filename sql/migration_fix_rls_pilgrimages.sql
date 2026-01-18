-- Fix RLS Policies for Pilgrimages
-- Problem: Only SELECT was allowed. Admins couldn't save.
-- Solution: Enable full access for authenticated users (Admins).

create policy "Admins can insert pilgrimages"
  on public.pilgrimages for insert
  with check (auth.role() = 'authenticated');

create policy "Admins can update pilgrimages"
  on public.pilgrimages for update
  using (auth.role() = 'authenticated');

create policy "Admins can delete pilgrimages"
  on public.pilgrimages for delete
  using (auth.role() = 'authenticated');
