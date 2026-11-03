-- Add private entries to the ITspot work calendar.
-- Run once in the Supabase SQL Editor before using the private toggle.

alter table public.calendar_plans
  add column if not exists is_private boolean not null default false;
