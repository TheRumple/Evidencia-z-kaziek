-- Run this in Supabase SQL Editor to add customer portal contacts.
-- Model:
-- - customer_contacts = real people with their own PIN
-- - customer_contact_customers = which companies they can access and whether they are owner/user
-- Owner sees all company requests/orders. User sees only requests/orders where they are the requester.
-- Existing customer.portal_code still works as a fallback during the transition.

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  portal_code text,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_contact_customers (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.customer_contacts(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  role text not null default 'user' check (role in ('owner', 'user')),
  created_at timestamptz not null default now(),
  unique (contact_id, customer_id)
);

alter table public.customer_contacts enable row level security;
alter table public.customer_contact_customers enable row level security;

drop policy if exists "Users can read own customer contacts" on public.customer_contacts;
create policy "Users can read own customer contacts"
on public.customer_contacts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own customer contacts" on public.customer_contacts;
create policy "Users can insert own customer contacts"
on public.customer_contacts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own customer contacts" on public.customer_contacts;
create policy "Users can update own customer contacts"
on public.customer_contacts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own customer contacts" on public.customer_contacts;
create policy "Users can delete own customer contacts"
on public.customer_contacts
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own customer contact links" on public.customer_contact_customers;
create policy "Users can read own customer contact links"
on public.customer_contact_customers
for select
to authenticated
using (
  exists (
    select 1 from public.customer_contacts cc
    where cc.id = customer_contact_customers.contact_id
      and cc.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own customer contact links" on public.customer_contact_customers;
create policy "Users can insert own customer contact links"
on public.customer_contact_customers
for insert
to authenticated
with check (
  exists (
    select 1 from public.customer_contacts cc
    join public.customers c on c.id = customer_contact_customers.customer_id
    where cc.id = customer_contact_customers.contact_id
      and cc.user_id = auth.uid()
      and c.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own customer contact links" on public.customer_contact_customers;
create policy "Users can delete own customer contact links"
on public.customer_contact_customers
for delete
to authenticated
using (
  exists (
    select 1 from public.customer_contacts cc
    where cc.id = customer_contact_customers.contact_id
      and cc.user_id = auth.uid()
  )
);

create unique index if not exists customer_contacts_portal_code_unique
on public.customer_contacts (portal_code)
where portal_code is not null;

create index if not exists customer_contact_customers_customer_idx
on public.customer_contact_customers (customer_id);

create or replace function public.set_customer_contact_portal_code()
returns trigger
language plpgsql
as $$
declare
  next_code text;
begin
  if new.portal_code is null or length(trim(new.portal_code)) = 0 then
    loop
      next_code := lpad((floor(random() * 9000 + 1000))::int::text, 4, '0');
      exit when not exists (
        select 1
        from public.customer_contacts cc
        where cc.portal_code = next_code
          and cc.id is distinct from new.id
      )
      and not exists (
        select 1
        from public.customers c
        where c.portal_code = next_code
      );
    end loop;

    new.portal_code := next_code;
  else
    new.portal_code := regexp_replace(new.portal_code, '[^0-9]', '', 'g');
  end if;

  if length(new.portal_code) <> 4 then
    raise exception 'portal_code must contain exactly 4 digits';
  end if;

  if exists (
    select 1
    from public.customer_contacts cc
    where cc.portal_code = new.portal_code
      and cc.id is distinct from new.id
  )
  or exists (
    select 1
    from public.customers c
    where c.portal_code = new.portal_code
  ) then
    raise exception 'PIN už existuje. Zadajte iný 4-miestny PIN.';
  end if;

  new.name := trim(new.name);
  new.email := nullif(trim(coalesce(new.email, '')), '');
  new.phone := nullif(trim(coalesce(new.phone, '')), '');

  return new;
end;
$$;

drop trigger if exists trg_set_customer_contact_portal_code on public.customer_contacts;
create trigger trg_set_customer_contact_portal_code
before insert or update of portal_code, name, email, phone on public.customer_contacts
for each row
execute function public.set_customer_contact_portal_code();

insert into public.customer_contacts (user_id, name, email, phone, portal_code)
select
  c.user_id,
  coalesce(nullif(trim(c.kontakt), ''), c.nazov),
  nullif(trim(coalesce(c.email, '')), ''),
  nullif(trim(coalesce(c.telefon, '')), ''),
  c.portal_code
from public.customers c
where c.portal_code is not null
  and c.user_id is not null
  and not exists (
    select 1
    from public.customer_contacts cc
    where cc.user_id = c.user_id
      and cc.portal_code = c.portal_code
  );

insert into public.customer_contact_customers (contact_id, customer_id, role)
select cc.id, c.id, 'owner'
from public.customers c
join public.customer_contacts cc
  on cc.user_id = c.user_id
  and cc.portal_code = c.portal_code
where c.portal_code is not null
  and c.user_id is not null
on conflict (contact_id, customer_id) do nothing;

create or replace function public.portal_text_matches_contact(
  p_text text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text
)
returns boolean
language sql
immutable
as $$
  select
    lower(coalesce(p_text, '')) like '%žiadateľ: ' || lower(trim(coalesce(p_contact_name, ''))) || '%'
    or lower(coalesce(p_text, '')) like '%meno: ' || lower(trim(coalesce(p_contact_name, ''))) || '%'
    or (coalesce(p_contact_email, '') <> '' and lower(coalesce(p_text, '')) like '%' || lower(trim(p_contact_email)) || '%')
    or (coalesce(p_contact_phone, '') <> '' and regexp_replace(coalesce(p_text, ''), '[^0-9]', '', 'g') like '%' || regexp_replace(p_contact_phone, '[^0-9]', '', 'g') || '%');
$$;

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
  public_message text
)
language sql
security definer
set search_path = public
as $$
  with lookup_input as (
    select
      lower(trim(coalesce(p_customer_name, ''))) as lookup_name,
      public.normalize_customer_lookup_name(p_customer_name) as normalized_lookup_name,
      regexp_replace(coalesce(p_portal_code, ''), '[^0-9]', '', 'g') as portal_code
  ),
  contact_access as (
    select
      cc.id as contact_id,
      c.id as customer_id,
      c.nazov as customer_name,
      c.portal_code as legacy_portal_code,
      ccc.role,
      cc.name as contact_name,
      cc.email as contact_email,
      cc.phone as contact_phone
    from public.customer_contacts cc
    join public.customer_contact_customers ccc on ccc.contact_id = cc.id
    join public.customers c on c.id = ccc.customer_id
    cross join lookup_input i
    where i.lookup_name <> ''
      and length(i.portal_code) = 4
      and cc.portal_code = i.portal_code
      and (
        lower(trim(cc.name)) = i.lookup_name
        or lower(trim(coalesce(cc.email, ''))) = i.lookup_name
        or regexp_replace(coalesce(cc.phone, ''), '[^0-9]', '', 'g') = regexp_replace(i.lookup_name, '[^0-9]', '', 'g')
        or lower(trim(c.nazov)) = i.lookup_name
        or public.normalize_customer_lookup_name(c.nazov) = i.normalized_lookup_name
      )
  ),
  legacy_access as (
    select
      null::uuid as contact_id,
      c.id as customer_id,
      c.nazov as customer_name,
      c.portal_code as legacy_portal_code,
      'owner'::text as role,
      c.kontakt as contact_name,
      c.email as contact_email,
      c.telefon as contact_phone
    from public.customers c
    cross join lookup_input i
    where i.lookup_name <> ''
      and length(i.portal_code) = 4
      and c.portal_code = i.portal_code
      and (
        lower(trim(c.nazov)) = i.lookup_name
        or lower(trim(coalesce(c.kontakt, ''))) = i.lookup_name
        or public.normalize_customer_lookup_name(c.nazov) = i.normalized_lookup_name
        or public.normalize_customer_lookup_name(c.kontakt) = i.normalized_lookup_name
      )
  ),
  access as (
    select * from contact_access
    union all
    select * from legacy_access
    where not exists (select 1 from contact_access)
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
      null::text as public_message
    from public.customer_requests cr
    join access a on (
      cr.customer_id = a.customer_id
      or lower(cr.popis) like '%firma: ' || lower(a.customer_name) || '%'
      or lower(cr.nazov) like '%' || lower(a.customer_name) || '%'
    )
    where a.role = 'owner'
      or public.portal_text_matches_contact(cr.popis, a.contact_name, a.contact_email, a.contact_phone)
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
      o.public_message
    from public.orders o
    join access a on a.customer_id = o.customer_id
    where o.stav in ('nova', 'rozpracovana', 'obhliadka', 'caka', 'cakame', 'hotova')
      and (
        a.role = 'owner'
        or public.portal_text_matches_contact(coalesce(o.popis, '') || E'\n' || coalesce(o.praca, ''), a.contact_name, a.contact_email, a.contact_phone)
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

create or replace function public.add_customer_order_update(
  p_order_id uuid,
  p_portal_code text,
  p_message text,
  p_attachment_urls text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order public.orders%rowtype;
  clean_code text;
  inserted_id uuid;
begin
  clean_code := regexp_replace(coalesce(p_portal_code, ''), '[^0-9]', '', 'g');

  if length(clean_code) <> 4 then
    raise exception 'invalid portal code';
  end if;

  if length(trim(coalesce(p_message, ''))) < 3 then
    raise exception 'message is too short';
  end if;

  select o.*
  into target_order
  from public.orders o
  where o.id = p_order_id
    and o.stav in ('nova', 'rozpracovana', 'obhliadka', 'caka', 'cakame', 'hotova')
    and (
      exists (
        select 1
        from public.customers c
        where c.id = o.customer_id
          and c.portal_code = clean_code
      )
      or exists (
        select 1
        from public.customer_contacts cc
        join public.customer_contact_customers ccc on ccc.contact_id = cc.id
        where cc.portal_code = clean_code
          and ccc.customer_id = o.customer_id
          and (
            ccc.role = 'owner'
            or public.portal_text_matches_contact(coalesce(o.popis, '') || E'\n' || coalesce(o.praca, ''), cc.name, cc.email, cc.phone)
          )
      )
    )
  limit 1;

  if not found then
    raise exception 'order not found';
  end if;

  insert into public.customer_order_updates (
    user_id,
    order_id,
    customer_id,
    message,
    attachment_urls
  )
  values (
    target_order.user_id,
    target_order.id,
    target_order.customer_id,
    trim(p_message),
    coalesce(p_attachment_urls, '{}')
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

revoke all on function public.add_customer_order_update(uuid, text, text, text[]) from public;
grant execute on function public.add_customer_order_update(uuid, text, text, text[]) to anon;
grant execute on function public.add_customer_order_update(uuid, text, text, text[]) to authenticated;
