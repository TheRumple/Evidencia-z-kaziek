-- Work planning calendar for internal ITspot app.
-- Run in Supabase SQL Editor.

create table if not exists public.calendar_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  title text,
  plan_date date not null,
  start_time time,
  end_time time,
  note text,
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.calendar_plans
  alter column order_id drop not null;

alter table public.calendar_plans
  add column if not exists title text;

alter table public.calendar_plans
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table public.calendar_plans
  add column if not exists is_private boolean not null default false;

alter table public.calendar_plans enable row level security;

drop policy if exists "Users can read own calendar plans" on public.calendar_plans;
drop policy if exists "Users can insert own calendar plans" on public.calendar_plans;
drop policy if exists "Users can update own calendar plans" on public.calendar_plans;
drop policy if exists "Users can delete own calendar plans" on public.calendar_plans;

create policy "Users can read own calendar plans"
on public.calendar_plans
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own calendar plans"
on public.calendar_plans
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own calendar plans"
on public.calendar_plans
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own calendar plans"
on public.calendar_plans
for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists calendar_plans_user_date_idx
on public.calendar_plans (user_id, plan_date, start_time);

create index if not exists calendar_plans_customer_idx
on public.calendar_plans (customer_id);
