-- Productivity upgrades: note ordering and recoverable trash.
-- Run once in the Supabase SQL Editor.

alter table public.personal_notes
  add column if not exists content_runs jsonb;

alter table public.personal_notes
  add column if not exists note_scope text not null default 'company';

alter table public.personal_notes
  add column if not exists is_pinned boolean not null default false;

alter table public.personal_notes
  add column if not exists sort_order bigint not null default 0;

alter table public.personal_notes
  add column if not exists deleted_at timestamptz;

alter table public.quotes
  add column if not exists deleted_at timestamptz;

alter table public.inspections
  add column if not exists deleted_at timestamptz;

alter table public.delivery_protocols
  add column if not exists deleted_at timestamptz;

update public.personal_notes
set sort_order = (extract(epoch from created_at) * 1000)::bigint
where sort_order = 0;

create index if not exists personal_notes_user_order_idx
  on public.personal_notes (user_id, deleted_at, is_pinned desc, sort_order desc);

create index if not exists quotes_user_deleted_idx
  on public.quotes (user_id, deleted_at, updated_at desc);

create index if not exists inspections_user_deleted_idx
  on public.inspections (user_id, deleted_at, updated_at desc);

create index if not exists delivery_protocols_user_deleted_idx
  on public.delivery_protocols (user_id, deleted_at, updated_at desc);
