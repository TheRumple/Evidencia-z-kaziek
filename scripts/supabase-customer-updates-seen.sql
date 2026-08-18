-- Run this in Supabase SQL Editor once.
-- It makes "Úpravy od zákazníkov" seen/unseen shared across all your devices.

alter table public.customer_order_updates
  add column if not exists seen_at timestamptz;

-- Existing historical customer updates should not suddenly appear as new
-- on every device after enabling this feature.
update public.customer_order_updates
set seen_at = coalesce(seen_at, now())
where seen_at is null;

drop policy if exists "Users can update own customer order updates" on public.customer_order_updates;
create policy "Users can update own customer order updates"
on public.customer_order_updates
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

