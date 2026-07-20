-- Run this in Supabase SQL Editor before or immediately after deploying the new app.
-- Goal: public visitors can only submit a request, not read customers/orders.

alter table public.customer_requests
  alter column customer_id drop not null;

alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_subtasks enable row level security;
alter table public.customer_requests enable row level security;

revoke select on table public.customers from anon;
revoke select on table public.orders from anon;
revoke select on table public.order_subtasks from anon;
revoke select on table public.work_logs from anon;

grant insert on table public.customer_requests to anon;

drop policy if exists "Public can insert customer requests" on public.customer_requests;

create policy "Public can insert customer requests"
on public.customer_requests
for insert
to anon
with check (
  stav = 'na_schvalenie'
  and nazov is not null
  and length(trim(nazov)) > 0
  and popis is not null
  and length(trim(popis)) > 0
);
