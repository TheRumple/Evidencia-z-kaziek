-- Adds a small progress percentage to orders and exposes it in the customer portal.
-- Safe to run multiple times.

alter table public.orders
  add column if not exists progress_percent integer not null default 0;

update public.orders
set progress_percent = 0
where progress_percent is null;

alter table public.orders
  alter column progress_percent set default 0,
  alter column progress_percent set not null;

alter table public.orders
  drop constraint if exists orders_progress_percent_range;

alter table public.orders
  add constraint orders_progress_percent_range
  check (progress_percent between 0 and 100 and progress_percent % 10 = 0);

drop function if exists public.lookup_customer_requests(text, text);

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
  customer_name text,
  public_message text,
  requester_email text,
  progress_percent integer
)
language sql
security definer
set search_path = public
as $$
  with lookup_input as (
    select
      lower(trim(coalesce(p_customer_name, ''))) as login_email,
      regexp_replace(coalesce(p_portal_code, ''), '[^0-9]', '', 'g') as portal_code
  ),
  contact_access as (
    select
      cc.id as contact_id,
      c.id as customer_id,
      c.nazov as customer_name,
      ccc.role,
      cc.name as contact_name,
      cc.email as contact_email
    from public.customer_contacts cc
    join public.customer_contact_customers ccc on ccc.contact_id = cc.id
    join public.customers c on c.id = ccc.customer_id
    cross join lookup_input i
    where i.login_email <> ''
      and length(i.portal_code) = 4
      and cc.portal_code = i.portal_code
      and lower(trim(cc.email)) = i.login_email
  ),
  pending_requests as (
    select distinct on (cr.id)
      'poziadavka'::text as item_type,
      cr.id,
      cr.nazov,
      cr.popis,
      cr.stav,
      cr.termin,
      cr.created_at,
      a.customer_name,
      null::text as public_message,
      lower((regexp_match(cr.popis, '(?im)^Email:\s*([^[:space:]]+@[^[:space:]]+)'))[1]) as requester_email,
      0::integer as progress_percent
    from public.customer_requests cr
    join contact_access a on (
      cr.customer_id = a.customer_id
      or lower(cr.popis) like '%firma: ' || lower(a.customer_name) || '%'
      or lower(cr.nazov) like '%' || lower(a.customer_name) || '%'
    )
    where a.role = 'owner'
      or public.portal_text_matches_contact(cr.popis, a.contact_email)
    order by cr.id, cr.created_at desc nulls last
  ),
  customer_orders as (
    select distinct on (o.id)
      'zakazka'::text as item_type,
      o.id,
      o.nazov,
      coalesce(o.popis, o.praca, '') as popis,
      o.stav,
      o.termin,
      coalesce(o.created_at, o.prijatie_zakazky::timestamptz) as created_at,
      a.customer_name,
      o.public_message,
      o.requester_email,
      coalesce(o.progress_percent, 0)::integer as progress_percent
    from public.orders o
    join contact_access a on a.customer_id = o.customer_id
    where o.stav in ('nova', 'rozpracovana', 'obhliadka', 'caka', 'cakame', 'hotova')
      and (
        a.role = 'owner'
        or lower(coalesce(o.requester_email, '')) = lower(a.contact_email)
        or public.portal_text_matches_contact(coalesce(o.popis, '') || E'\n' || coalesce(o.praca, ''), a.contact_email)
      )
    order by o.id, coalesce(o.created_at, o.prijatie_zakazky::timestamptz) desc nulls last
  )
  select * from pending_requests
  union all
  select * from customer_orders
  order by created_at desc nulls last;
$$;

revoke all on function public.lookup_customer_requests(text, text) from public;
grant execute on function public.lookup_customer_requests(text, text) to anon;
grant execute on function public.lookup_customer_requests(text, text) to authenticated;
