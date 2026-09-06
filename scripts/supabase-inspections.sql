-- Inspection notes with tablet sketch support for ITspot app.
-- Run this in Supabase SQL Editor.

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  inspection_date date not null default current_date,
  inspection_type text not null default 'vseobecna',
  site_address text,
  customer_name text,
  contact_name text,
  contact_phone text,
  contact_email text,
  request_summary text,
  current_state text,
  verification_notes text,
  quote_note text,
  sketch_data_url text,
  materials jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'done', 'quoted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inspections
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table public.inspections
  add column if not exists inspection_date date not null default current_date;

alter table public.inspections
  add column if not exists inspection_type text not null default 'vseobecna';

alter table public.inspections
  add column if not exists site_address text;

alter table public.inspections
  add column if not exists customer_name text;

alter table public.inspections
  add column if not exists contact_name text;

alter table public.inspections
  add column if not exists contact_phone text;

alter table public.inspections
  add column if not exists contact_email text;

alter table public.inspections
  add column if not exists request_summary text;

alter table public.inspections
  add column if not exists current_state text;

alter table public.inspections
  add column if not exists verification_notes text;

alter table public.inspections
  add column if not exists quote_note text;

alter table public.inspections
  add column if not exists sketch_data_url text;

alter table public.inspections
  add column if not exists materials jsonb not null default '[]'::jsonb;

alter table public.inspections
  add column if not exists status text not null default 'draft';

alter table public.inspections enable row level security;

drop policy if exists "Users can read own inspections" on public.inspections;
drop policy if exists "Users can insert own inspections" on public.inspections;
drop policy if exists "Users can update own inspections" on public.inspections;
drop policy if exists "Users can delete own inspections" on public.inspections;

create policy "Users can read own inspections"
on public.inspections
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own inspections"
on public.inspections
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own inspections"
on public.inspections
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own inspections"
on public.inspections
for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists inspections_user_updated_idx
on public.inspections (user_id, updated_at desc);

create index if not exists inspections_user_customer_idx
on public.inspections (user_id, customer_id);
