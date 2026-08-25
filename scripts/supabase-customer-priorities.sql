-- Customer-controlled priority for active orders.
-- Run this in Supabase SQL Editor.

alter table public.orders
  add column if not exists customer_priority integer;

alter table public.orders
  add column if not exists customer_priority_updated_at timestamptz;

alter table public.orders
  add column if not exists customer_priority_seen_at timestamptz;

create index if not exists orders_customer_priority_idx
on public.orders (customer_id, customer_priority nulls last, created_at desc);

with ranked_orders as (
  select
    id,
    row_number() over (
      partition by customer_id
      order by coalesce(customer_priority, 999999), coalesce(created_at, prijatie_zakazky::timestamptz) desc nulls last
    ) as new_priority
  from public.orders
  where customer_id is not null
    and stav in ('nova', 'rozpracovana', 'cenova_ponuka', 'obhliadka', 'caka', 'cakame', 'hotova')
)
update public.orders o
set customer_priority = ranked_orders.new_priority
from ranked_orders
where o.id = ranked_orders.id;

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
  progress_percent integer,
  customer_priority integer,
  customer_priority_updated_at timestamptz,
  customer_priority_seen_at timestamptz
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
      0::integer as progress_percent,
      null::integer as customer_priority,
      null::timestamptz as customer_priority_updated_at,
      null::timestamptz as customer_priority_seen_at
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
      coalesce(o.progress_percent, 0)::integer as progress_percent,
      row_number() over (
        partition by o.customer_id
        order by coalesce(o.customer_priority, 999999), coalesce(o.created_at, o.prijatie_zakazky::timestamptz) desc nulls last
      )::integer as customer_priority,
      o.customer_priority_updated_at,
      o.customer_priority_seen_at
    from public.orders o
    join contact_access a on a.customer_id = o.customer_id
    where o.stav in ('nova', 'rozpracovana', 'cenova_ponuka', 'obhliadka', 'caka', 'cakame', 'hotova')
      and (
        a.role = 'owner'
        or lower(coalesce(o.requester_email, '')) = lower(a.contact_email)
        or public.portal_text_matches_contact(coalesce(o.popis, '') || E'\n' || coalesce(o.praca, ''), a.contact_email)
      )
    order by o.id, coalesce(o.customer_priority, 999999), coalesce(o.created_at, o.prijatie_zakazky::timestamptz) desc nulls last
  )
  select *
  from (
    select * from pending_requests
    union all
    select * from customer_orders
  ) combined
  order by
    case when combined.customer_priority is null then 1 else 0 end,
    combined.customer_priority asc nulls last,
    combined.created_at desc nulls last;
$$;

revoke all on function public.lookup_customer_requests(text, text) from public;
grant execute on function public.lookup_customer_requests(text, text) to anon;
grant execute on function public.lookup_customer_requests(text, text) to authenticated;

create or replace function public.move_customer_order_priority(
  p_order_id uuid,
  p_customer_name text,
  p_portal_code text,
  p_direction text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_code text;
  login_email text;
  target_customer_id uuid;
  contact_role text;
  contact_email text;
  order_ids uuid[];
  current_index integer;
  swap_id uuid;
  i integer;
begin
  clean_code := regexp_replace(coalesce(p_portal_code, ''), '[^0-9]', '', 'g');
  login_email := lower(trim(coalesce(p_customer_name, '')));

  if login_email = '' or length(clean_code) <> 4 then
    raise exception 'invalid customer access';
  end if;

  select o.customer_id, ccc.role, cc.email
  into target_customer_id, contact_role, contact_email
  from public.orders o
  join public.customer_contact_customers ccc on ccc.customer_id = o.customer_id
  join public.customer_contacts cc on cc.id = ccc.contact_id
  where o.id = p_order_id
    and cc.portal_code = clean_code
    and lower(trim(cc.email)) = login_email
    and o.stav in ('nova', 'rozpracovana', 'cenova_ponuka', 'obhliadka', 'caka', 'cakame', 'hotova')
    and (
      ccc.role = 'owner'
      or lower(coalesce(o.requester_email, '')) = lower(cc.email)
      or public.portal_text_matches_contact(coalesce(o.popis, '') || E'\n' || coalesce(o.praca, ''), cc.email)
    )
  limit 1;

  if target_customer_id is null then
    raise exception 'order not found';
  end if;

  select array_agg(id order by coalesce(customer_priority, 999999), coalesce(created_at, prijatie_zakazky::timestamptz) desc nulls last)
  into order_ids
  from public.orders o
  where o.customer_id = target_customer_id
    and o.stav in ('nova', 'rozpracovana', 'cenova_ponuka', 'obhliadka', 'caka', 'cakame', 'hotova')
    and (
      contact_role = 'owner'
      or lower(coalesce(o.requester_email, '')) = lower(contact_email)
      or public.portal_text_matches_contact(coalesce(o.popis, '') || E'\n' || coalesce(o.praca, ''), contact_email)
    );

  if order_ids is null or array_length(order_ids, 1) is null then
    return;
  end if;

  current_index := array_position(order_ids, p_order_id);
  if current_index is null then
    return;
  end if;

  if p_direction = 'top' and current_index > 1 then
    order_ids := array_prepend(p_order_id, array_remove(order_ids, p_order_id));
  elsif p_direction = 'up' and current_index > 1 then
    swap_id := order_ids[current_index - 1];
    order_ids[current_index - 1] := p_order_id;
    order_ids[current_index] := swap_id;
  elsif p_direction = 'down' and current_index < array_length(order_ids, 1) then
    swap_id := order_ids[current_index + 1];
    order_ids[current_index + 1] := p_order_id;
    order_ids[current_index] := swap_id;
  else
    return;
  end if;

  for i in 1..array_length(order_ids, 1) loop
    update public.orders
    set
      customer_priority = i,
      customer_priority_updated_at = case
        when id = p_order_id then now()
        else customer_priority_updated_at
      end,
      customer_priority_seen_at = case
        when id = p_order_id then null
        else customer_priority_seen_at
      end
    where id = order_ids[i];
  end loop;
end;
$$;

revoke all on function public.move_customer_order_priority(uuid, text, text, text) from public;
grant execute on function public.move_customer_order_priority(uuid, text, text, text) to anon;
grant execute on function public.move_customer_order_priority(uuid, text, text, text) to authenticated;
