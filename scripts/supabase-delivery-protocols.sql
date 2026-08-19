-- Saved delivery protocols for ITspot service app.
-- Run this in Supabase SQL Editor.

create table if not exists public.delivery_protocols (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  protocol_number text not null,
  protocol_date date not null default current_date,
  customer_name text,
  delivered_by text,
  received_by text,
  tested boolean not null default true,
  briefed boolean not null default true,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.delivery_protocols
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table public.delivery_protocols
  add column if not exists customer_name text;

alter table public.delivery_protocols
  add column if not exists delivered_by text;

alter table public.delivery_protocols
  add column if not exists received_by text;

alter table public.delivery_protocols
  add column if not exists tested boolean not null default true;

alter table public.delivery_protocols
  add column if not exists briefed boolean not null default true;

alter table public.delivery_protocols
  add column if not exists items jsonb not null default '[]'::jsonb;

alter table public.delivery_protocols
  add column if not exists updated_at timestamptz not null default now();

alter table public.delivery_protocols enable row level security;

drop policy if exists "Users can read own delivery protocols" on public.delivery_protocols;
drop policy if exists "Users can insert own delivery protocols" on public.delivery_protocols;
drop policy if exists "Users can update own delivery protocols" on public.delivery_protocols;
drop policy if exists "Users can delete own delivery protocols" on public.delivery_protocols;

create policy "Users can read own delivery protocols"
on public.delivery_protocols
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own delivery protocols"
on public.delivery_protocols
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own delivery protocols"
on public.delivery_protocols
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own delivery protocols"
on public.delivery_protocols
for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists delivery_protocols_user_updated_idx
on public.delivery_protocols (user_id, updated_at desc);

create index if not exists delivery_protocols_customer_idx
on public.delivery_protocols (customer_id);
