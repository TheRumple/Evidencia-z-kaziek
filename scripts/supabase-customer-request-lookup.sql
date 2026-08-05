-- Run this in Supabase SQL Editor to enable the public "Moje požiadavky" page.
-- The app does not expose table SELECT access to visitors. Anonymous users can only call
-- this function with company/person name + a 6 digit portal code and receive matching rows.

alter table public.customers
  add column if not exists portal_code text;

with numbered_customers as (
  select
    id,
    lpad((100000 + row_number() over (order by created_at nulls last, id))::text, 6, '0') as next_portal_code
  from public.customers
  where portal_code is null
    or portal_code !~ '^[0-9]{6}$'
)
update public.customers c
set portal_code = n.next_portal_code
from numbered_customers n
where c.id = n.id;

alter table public.customers
  alter column portal_code drop default;

create unique index if not exists customers_portal_code_unique
on public.customers (portal_code)
where portal_code is not null;

create or replace function public.set_customer_portal_code()
returns trigger
language plpgsql
as $$
declare
  next_code text;
begin
  if new.portal_code is null or length(trim(new.portal_code)) = 0 then
    loop
      next_code := lpad((floor(random() * 900000 + 100000))::int::text, 6, '0');
      exit when not exists (
        select 1
        from public.customers
        where portal_code = next_code
          and id is distinct from new.id
      );
    end loop;

    new.portal_code := next_code;
  else
    new.portal_code := regexp_replace(new.portal_code, '[^0-9]', '', 'g');
  end if;

  if length(new.portal_code) <> 6 then
    raise exception 'portal_code must contain exactly 6 digits';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_customer_portal_code on public.customers;
create trigger trg_set_customer_portal_code
before insert or update of portal_code on public.customers
for each row
execute function public.set_customer_portal_code();

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
      regexp_replace(coalesce(p_portal_code, ''), '[^0-9]', '', 'g') as portal_code
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
