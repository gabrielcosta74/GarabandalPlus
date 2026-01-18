-- Fix RLS for Stages and Detailed Itinerary
-- Problem: Missing write policies (Insert/Update/Delete) for authenticated users.

-- 1. Pilgrimage Stages
create policy "Admins can insert stages"
  on public.pilgrimage_stages for insert
  with check (auth.role() = 'authenticated');

create policy "Admins can update stages"
  on public.pilgrimage_stages for update
  using (auth.role() = 'authenticated');

create policy "Admins can delete stages"
  on public.pilgrimage_stages for delete
  using (auth.role() = 'authenticated');

-- 2. Pilgrimage Itinerary Items (Detailed)
create policy "Admins can insert itinerary items"
  on public.pilgrimage_itinerary_items for insert
  with check (auth.role() = 'authenticated');

create policy "Admins can update itinerary items"
  on public.pilgrimage_itinerary_items for update
  using (auth.role() = 'authenticated');

create policy "Admins can delete itinerary items"
  on public.pilgrimage_itinerary_items for delete
  using (auth.role() = 'authenticated');
