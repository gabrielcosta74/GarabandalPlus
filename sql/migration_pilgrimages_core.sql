-- Migration: Pilgrimages Module Core Tables
-- Description: Creates the foundation for the Pilgrimages module including events, bookings, pilgrims, installments, and payments.

-- 1. Create table for Pilgrimages (The Events)
create table if not exists pilgrimages (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  slug text not null unique,
  description text,
  cover_image text,
  start_date timestamp with time zone not null,
  end_date timestamp with time zone not null,
  total_vacancies integer not null default 50,
  current_vacancies integer not null default 50,
  base_price decimal(10,2) not null, -- The minimum donation required
  status text not null default 'draft' check (status in ('draft', 'open', 'waitlist', 'closed')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2. Create table for Installment Plans (The Payment Rules per Pilgrimage)
-- Defines how the payment is split (e.g., 30% Signal, 30% Reinforcement, 40% Final)
create table if not exists installment_plans (
  id uuid default gen_random_uuid() primary key,
  pilgrimage_id uuid references pilgrimages(id) on delete cascade not null,
  title text not null, -- e.g., "Sinal de Reserva"
  percentage decimal(5,2) not null check (percentage > 0 and percentage <= 100),
  due_days_before_start integer not null, -- e.g., 90 days before start
  is_deposit boolean default false, -- Marks if this is the initial deposit required to book
  created_at timestamp with time zone default now()
);

-- 3. Create table for Bookings (The "Contract" between User and Pilgrimage)
create table if not exists bookings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  pilgrimage_id uuid references pilgrimages(id) not null,
  booking_date timestamp with time zone default now(),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'canceled', 'completed')),
  total_amount decimal(10,2) not null, -- Cached total amount due
  paid_amount decimal(10,2) default 0.00, -- Cached amount paid
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 4. Create table for Pilgrims (The Individuals traveling)
create table if not exists pilgrims (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references bookings(id) on delete cascade not null,
  full_name text not null,
  email text, -- Optional, for contact
  phone text,
  birth_date date,
  passport_number text,
  room_type text default 'double' check (room_type in ('single', 'double', 'triple')),
  dietary_restrictions text,
  health_notes text,
  created_at timestamp with time zone default now()
);

-- 5. Create table for Pilgrimage Payments (The Financial Transactions)
create table if not exists pilgrimage_payments (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references bookings(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null, -- Who made the payment
  amount decimal(10,2) not null,
  method text not null check (method in ('reduniq', 'wise', 'bank_transfer', 'mbway', 'manual')),
  status text not null default 'pending_verification' check (status in ('pending_verification', 'verified', 'failed')),
  proof_url text, -- URL to the uploaded receipt (for manual methods)
  transaction_id text, -- External ID from Reduniq/Stripe
  verified_at timestamp with time zone,
  verified_by uuid references auth.users(id), -- Admin who verified it
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table pilgrimages enable row level security;
alter table installment_plans enable row level security;
alter table bookings enable row level security;
alter table pilgrims enable row level security;
alter table pilgrimage_payments enable row level security;

-- Policies

-- Pilgrimages: Public Read, Admin Write
create policy "Public can view open pilgrimages"
  on pilgrimages for select
  using (true);

-- Installment Plans: Public Read
create policy "Public can view installment plans"
  on installment_plans for select
  using (true);

-- Bookings: Users can see their own, Admins see all
create policy "Users can view own bookings"
  on bookings for select
  using (auth.uid() = user_id);

create policy "Users can create own bookings"
  on bookings for insert
  with check (auth.uid() = user_id);

-- Pilgrims: Users can manage pilgrims in their bookings
create policy "Users can manage own pilgrims"
  on pilgrims for all
  using (
    exists (
      select 1 from bookings
      where bookings.id = pilgrims.booking_id
      and bookings.user_id = auth.uid()
    )
  );

-- Payments: Users can see own, insert own.
create policy "Users can view own payments"
  on pilgrimage_payments for select
  using (auth.uid() = user_id);

create policy "Users can submit payments"
  on pilgrimage_payments for insert
  with check (auth.uid() = user_id);

-- Storage bucket for Payment Proofs
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

create policy "Users can upload payment proofs"
  on storage.objects for insert
  with check (
    bucket_id = 'payment-proofs' and
    auth.role() = 'authenticated'
  );
