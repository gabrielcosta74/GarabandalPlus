-- Admin Access Policies for Academy
-- Since we are building an internal admin panel, we will allow Authenticated users to manage courses.
-- In a stricter production env, we would check for a specific 'admin' role or claim.

-- 1. Academy Courses
create policy "Enable insert for authenticated users only" 
on public.academy_courses for insert 
to authenticated 
with check (true);

create policy "Enable update for authenticated users only" 
on public.academy_courses for update
to authenticated 
using (true)
with check (true);

create policy "Enable delete for authenticated users only" 
on public.academy_courses for delete
to authenticated 
using (true);

-- 2. Academy Episodes
create policy "Enable insert for authenticated users only" 
on public.academy_episodes for insert 
to authenticated 
with check (true);

create policy "Enable update for authenticated users only" 
on public.academy_episodes for update
to authenticated 
using (true)
with check (true);

create policy "Enable delete for authenticated users only" 
on public.academy_episodes for delete
to authenticated 
using (true);
