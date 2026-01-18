-- Tables for Novena Tracking

-- 1. Progress (Current active state)
create table if not exists novena_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  novena_id text not null,
  current_day int not null default 1,
  start_date timestamptz default now(),
  last_completed_date timestamptz,
  is_complete boolean default false,
  updated_at timestamptz default now(),
  primary key (user_id, novena_id)
);

-- 2. History (Past completions)
create table if not exists novena_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  novena_id text not null,
  title text not null,
  completed_at timestamptz default now()
);

-- Enable RLS
alter table novena_progress enable row level security;
alter table novena_history enable row level security;

-- Policies
create policy "Users can view own progress" 
  on novena_progress for select 
  using (auth.uid() = user_id);

create policy "Users can insert own progress" 
  on novena_progress for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own progress" 
  on novena_progress for update 
  using (auth.uid() = user_id);
  
create policy "Users can delete own progress" 
  on novena_progress for delete 
  using (auth.uid() = user_id);

create policy "Users can view own history" 
  on novena_history for select 
  using (auth.uid() = user_id);

create policy "Users can insert own history" 
  on novena_history for insert 
  with check (auth.uid() = user_id);
