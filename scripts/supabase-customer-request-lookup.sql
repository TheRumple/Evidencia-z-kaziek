-- Run this in Supabase SQL Editor to enable the public "Moje požiadavky" page.
-- The app does not expose table SELECT access to visitors. Anonymous users can only call
-- this function with company/person name + a 4 digit portal PIN and receive matching rows.

alter table public.customers
  add column if not exists portal_code text;

alter table public.orders
  add column if not exists public_message text;

create table if not exists public.customer_order_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  message text not null,
  attachment_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.customer_order_updates enable row level security;

drop policy if exists "Users can read own customer order updates" on public.customer_order_updates;
create policy "Users can read own customer order updates"
on public.customer_order_updates
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can delete own customer order updates" on public.customer_order_updates;
create policy "Users can delete own customer order updates"
on public.customer_order_updates
for delete
to authenticated
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-request-files',
  'customer-request-files',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can upload customer request files" on storage.objects;
create policy "Public can upload customer request files"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'customer-request-files');

drop policy if exists "Public can read customer request files" on storage.objects;
create policy "Public can read customer request files"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'customer-request-files');

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
      next_code := lpad((floor(random() * 9000 + 1000))::int::text, 4, '0');
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

  if length(new.portal_code) <> 4 then
    raise exception 'portal_code must contain exactly 4 digits';
  end if;

  if exists (
    select 1
    from public.customers c
    where c.portal_code = new.portal_code
      and c.id is distinct from new.id
  )
  or exists (
    select 1
    from public.customer_contacts cc
    where cc.portal_code = new.portal_code
  ) then
    raise exception 'PIN uz existuje. Zadajte iny 4-miestny PIN.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_customer_portal_code on public.customers;
create trigger trg_set_customer_portal_code
before insert or update of portal_code on public.customers
for each row
execute function public.set_customer_portal_code();

update public.customers
set portal_code = null
where portal_code is null
  or portal_code !~ '^[0-9]{4}$';

create or replace function public.normalize_customer_lookup_name(p_name text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(coalesce(p_name, '')),
          '\m(s\.?\s*r\.?\s*o\.?|spol\.?\s*s\.?\s*r\.?\s*o\.?|a\.?\s*s\.?|sro|as)\M',
          '',
          'gi'
        ),
        '[^[:alnum:]]+',
        '',
        'g'
      ),
      '\s+',
      '',
      'g'
    )
  );
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
      lower(trim(coalesce(p_customer_name, ''))) as customer_name,
      public.normalize_customer_lookup_name(p_customer_name) as normalized_customer_name,
      regexp_replace(coalesce(p_portal_code, ''), '[^0-9]', '', 'g') as portal_code
  ),
  matched_customer as (
    select c.*
    from public.customers c
    cross join lookup_input i
    where i.customer_name <> ''
      and length(i.portal_code) = 4
      and upper(trim(coalesce(c.portal_code, ''))) = i.portal_code
      and (
        lower(trim(c.nazov)) = i.customer_name
        or lower(trim(c.kontakt)) = i.customer_name
        or public.normalize_customer_lookup_name(c.nazov) = i.normalized_customer_name
        or public.normalize_customer_lookup_name(c.kontakt) = i.normalized_customer_name
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
      c.nazov as customer_name,
      null::text as public_message
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
      c.nazov as customer_name,
      o.public_message
    from public.orders o
    join matched_customer c on c.id = o.customer_id
    where o.stav in ('nova', 'rozpracovana', 'cenova_ponuka', 'obhliadka', 'caka', 'cakame', 'hotova')
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
  join public.customers c on c.id = o.customer_id
  where o.id = p_order_id
    and c.portal_code = clean_code
    and o.stav in ('nova', 'rozpracovana', 'cenova_ponuka', 'obhliadka', 'caka', 'cakame', 'hotova')
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
