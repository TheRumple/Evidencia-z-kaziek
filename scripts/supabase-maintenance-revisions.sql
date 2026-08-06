-- Maintenance and revision reminders for ITspot service app.
-- Run this in Supabase SQL Editor.

create table if not exists public.maintenance_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  system_type text not null,
  title text not null,
  contact_name text,
  last_check_date date,
  interval_months integer not null default 12,
  next_due_date date not null,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.maintenance_revisions
  add column if not exists contact_name text;

alter table public.maintenance_revisions
  add column if not exists active boolean not null default true;

alter table public.maintenance_revisions
  add column if not exists updated_at timestamptz not null default now();

alter table public.maintenance_revisions enable row level security;

drop policy if exists "Users can read own maintenance revisions" on public.maintenance_revisions;
drop policy if exists "Users can insert own maintenance revisions" on public.maintenance_revisions;
drop policy if exists "Users can update own maintenance revisions" on public.maintenance_revisions;
drop policy if exists "Users can delete own maintenance revisions" on public.maintenance_revisions;

create policy "Users can read own maintenance revisions"
on public.maintenance_revisions
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own maintenance revisions"
on public.maintenance_revisions
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own maintenance revisions"
on public.maintenance_revisions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own maintenance revisions"
on public.maintenance_revisions
for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists maintenance_revisions_user_due_idx
on public.maintenance_revisions (user_id, active, next_due_date);

create index if not exists maintenance_revisions_customer_idx
on public.maintenance_revisions (customer_id);
