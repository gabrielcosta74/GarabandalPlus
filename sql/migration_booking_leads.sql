
-- Create booking_leads table to capture abandoned checkouts
create table if not exists booking_leads (
  id uuid default uuid_generate_v4() primary key,
  pilgrimage_id uuid references pilgrimages(id),
  email text not null,
  phone text,
  name text,
  status text default 'draft', -- draft, recovered, converted
  step_reached int default 1,
  data jsonb default '{}'::jsonb, -- Store form state dump
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  last_notified_at timestamp with time zone
);

-- Index for faster cron queries
create index if not exists idx_booking_leads_status_created on booking_leads(status, created_at);
create index if not exists idx_booking_leads_email_pilgrimage on booking_leads(email, pilgrimage_id);

-- RLS Policies (Open API for Insert, Admin for Read)
alter table booking_leads enable row level security;

create policy "Anon can insert leads"
  on booking_leads for insert
  with check (true);

create policy "Anon can update own lead (via API with ID/Email match - logic in API)"
  on booking_leads for update
  using (true); 

create policy "Admins can view all leads"
  on booking_leads for select
  using (auth.role() = 'service_role' or auth.jwt() ->> 'email' = 'admin@apostoladodegarabandal.com');
