-- Run this in Supabase SQL Editor to enable the public "Moje požiadavky" page.
-- The app does not expose table SELECT access to visitors. Anonymous users can only call
-- this function with company/person name + portal code and receive matching rows.

create extension if not exists pgcrypto;

alter table public.customers
  add column if not exists portal_code text;

update public.customers
set portal_code = upper(left(regexp_replace(nazov, '[^[:alnum:]]', '', 'g'), 8)) || '-' || upper(substr(replace(id::text, '-', ''), 1, 4))
where portal_code is null or length(trim(portal_code)) = 0;

alter table public.customers
  alter column portal_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

create unique index if not exists customers_portal_code_unique
on public.customers (portal_code)
where portal_code is not null;

create or replace function public.lookup_customer_requests(
  p_customer_name text,
  p_portal_code text
)
returns table (
  item_type text,
  id uuid,
  nazov text,
  popis text,
  stav text,
  termin date,
  created_at timestamptz,
  customer_name text
)
language sql
security definer
set search_path = public
as $$
  with lookup_input as (
    select
      lower(trim(coalesce(p_customer_name, ''))) as customer_name,
      upper(trim(coalesce(p_portal_code, ''))) as portal_code
  ),
  matched_customer as (
    select c.*
    from public.customers c
    cross join lookup_input i
    where i.customer_name <> ''
      and length(i.portal_code) >= 6
      and upper(trim(coalesce(c.portal_code, ''))) = i.portal_code
      and (
        lower(trim(c.nazov)) = i.customer_name
        or lower(trim(c.kontakt)) = i.customer_name
      )
    limit 1
  ),
  pending_requests as (
    select
      'poziadavka'::text as item_type,
      cr.id,
      cr.nazov,
      cr.popis,
      cr.stav,
      cr.termin,
      cr.created_at,
      c.nazov as customer_name
    from public.customer_requests cr
    join matched_customer c on (
      cr.customer_id = c.id
      or lower(cr.popis) like '%firma: ' || lower(c.nazov) || '%'
      or lower(cr.nazov) like '%' || lower(c.nazov) || '%'
    )
  ),
  customer_orders as (
    select
      'zakazka'::text as item_type,
      o.id,
      o.nazov,
      coalesce(o.popis, o.praca, '') as popis,
      o.stav,
      o.termin,
      coalesce(o.created_at, o.prijatie_zakazky::timestamptz) as created_at,
      c.nazov as customer_name
    from public.orders o
    join matched_customer c on c.id = o.customer_id
  )
  select * from pending_requests
  union all
  select * from customer_orders
  order by created_at desc nulls last;
$$;

revoke all on function public.lookup_customer_requests(text, text) from public;
grant execute on function public.lookup_customer_requests(text, text) to anon;
grant execute on function public.lookup_customer_requests(text, text) to authenticated;
