-- Price quotes for ITspot service app.
-- Run this in Supabase SQL Editor.

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  quote_number text not null,
  quote_date date not null default current_date,
  valid_until date,
  status text not null default 'draft',
  title text not null,
  customer_name text,
  contact_name text,
  contact_email text,
  realization_note text,
  note text,
  discount_type text not null default 'none',
  discount_value numeric not null default 0,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotes_status_check check (status in ('draft', 'sent', 'approved', 'rejected')),
  constraint quotes_discount_type_check check (discount_type in ('none', 'percent', 'amount'))
);

alter table public.quotes
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table public.quotes
  add column if not exists quote_number text;

alter table public.quotes
  add column if not exists quote_date date not null default current_date;

alter table public.quotes
  add column if not exists valid_until date;

alter table public.quotes
  add column if not exists status text not null default 'draft';

alter table public.quotes
  add column if not exists title text;

alter table public.quotes
  add column if not exists customer_name text;

alter table public.quotes
  add column if not exists contact_name text;

alter table public.quotes
  add column if not exists contact_email text;

alter table public.quotes
  add column if not exists realization_note text;

alter table public.quotes
  add column if not exists note text;

alter table public.quotes
  add column if not exists discount_type text not null default 'none';

alter table public.quotes
  add column if not exists discount_value numeric not null default 0;

alter table public.quotes
  add column if not exists items jsonb not null default '[]'::jsonb;

alter table public.quotes
  add column if not exists updated_at timestamptz not null default now();

alter table public.quotes enable row level security;

drop policy if exists "Users can read own quotes" on public.quotes;
drop policy if exists "Users can insert own quotes" on public.quotes;
drop policy if exists "Users can update own quotes" on public.quotes;
drop policy if exists "Users can delete own quotes" on public.quotes;

create policy "Users can read own quotes"
on public.quotes
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own quotes"
on public.quotes
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own quotes"
on public.quotes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own quotes"
on public.quotes
for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists quotes_user_updated_idx
on public.quotes (user_id, updated_at desc);

create index if not exists quotes_customer_idx
on public.quotes (customer_id);

create unique index if not exists quotes_user_number_unique
on public.quotes (user_id, quote_number);
