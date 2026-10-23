-- Personal quick notes for ITspot app.
-- Run this whole script in Supabase SQL Editor.

create table if not exists public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  priority text not null default 'normal' check (priority in ('normal', 'important', 'urgent')),
  text_color text not null default 'black',
  content_runs jsonb,
  is_pinned boolean not null default false,
  sort_order bigint not null default 0,
  deleted_at timestamptz,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.personal_notes
  add column if not exists text_color text not null default 'black';

alter table public.personal_notes
  add column if not exists content_runs jsonb;

alter table public.personal_notes
  add column if not exists is_pinned boolean not null default false;

alter table public.personal_notes
  add column if not exists sort_order bigint not null default 0;

alter table public.personal_notes
  add column if not exists deleted_at timestamptz;

create index if not exists personal_notes_user_active_idx
  on public.personal_notes (user_id, completed, priority, created_at desc);

alter table public.personal_notes enable row level security;

drop policy if exists "Users can read own personal notes" on public.personal_notes;
create policy "Users can read own personal notes"
  on public.personal_notes for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own personal notes" on public.personal_notes;
create policy "Users can create own personal notes"
  on public.personal_notes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own personal notes" on public.personal_notes;
create policy "Users can update own personal notes"
  on public.personal_notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own personal notes" on public.personal_notes;
create policy "Users can delete own personal notes"
  on public.personal_notes for delete
  using (auth.uid() = user_id);
