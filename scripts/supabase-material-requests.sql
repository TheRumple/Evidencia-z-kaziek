-- Material purchase list for ITspot app.
-- Run this in Supabase SQL Editor.

create table if not exists public.material_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  target_type text not null default 'internal' check (target_type in ('customer', 'internal')),
  name text not null,
  quantity text,
  unit text,
  supplier text,
  status text not null default 'to_order' check (status in ('to_order', 'ordered', 'delivered', 'used', 'cancelled')),
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  needed_by date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.material_requests
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table public.material_requests
  add column if not exists target_type text not null default 'internal';

alter table public.material_requests
  add column if not exists supplier text;

alter table public.material_requests
  add column if not exists priority text not null default 'normal';

alter table public.material_requests
  add column if not exists updated_at timestamptz not null default now();

alter table public.material_requests enable row level security;

drop policy if exists "Users can read own material requests" on public.material_requests;
drop policy if exists "Users can insert own material requests" on public.material_requests;
drop policy if exists "Users can update own material requests" on public.material_requests;
drop policy if exists "Users can delete own material requests" on public.material_requests;

create policy "Users can read own material requests"
on public.material_requests
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own material requests"
on public.material_requests
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own material requests"
on public.material_requests
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own material requests"
on public.material_requests
for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists material_requests_user_status_idx
on public.material_requests (user_id, status, priority, needed_by);

create index if not exists material_requests_user_customer_idx
on public.material_requests (user_id, customer_id);
