-- Run this in Supabase SQL Editor to enable the public "Moje požiadavky" page.
-- The app does not expose table SELECT access to visitors. Anonymous users can only call
-- this function with email + phone and receive matching request/order status rows.

create or replace function public.lookup_customer_requests(
  p_email text,
  p_phone text
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
      lower(trim(coalesce(p_email, ''))) as email,
      regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as phone_digits
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
      null::text as customer_name
    from public.customer_requests cr
    cross join lookup_input i
    where i.email <> ''
      and length(i.phone_digits) >= 7
      and lower(cr.popis) like '%' || i.email || '%'
      and regexp_replace(cr.popis, '[^0-9]', '', 'g') like '%' || i.phone_digits || '%'
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
    join public.customers c on c.id = o.customer_id
    cross join lookup_input i
    where i.email <> ''
      and length(i.phone_digits) >= 7
      and lower(coalesce(c.email, '')) = i.email
      and regexp_replace(coalesce(c.telefon, ''), '[^0-9]', '', 'g') like '%' || i.phone_digits || '%'
  )
  select * from pending_requests
  union all
  select * from customer_orders
  order by created_at desc nulls last;
$$;

revoke all on function public.lookup_customer_requests(text, text) from public;
grant execute on function public.lookup_customer_requests(text, text) to anon;
grant execute on function public.lookup_customer_requests(text, text) to authenticated;
