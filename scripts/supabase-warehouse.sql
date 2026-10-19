-- Warehouse, stock movements, imports and inventories for ITspot app.
-- Run this whole script in Supabase SQL Editor.

create table if not exists public.warehouse_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sku text,
  name text not null,
  category text,
  unit text not null default 'ks',
  minimum_quantity numeric(14,3) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.warehouse_import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_name text not null,
  supplier_name text,
  invoice_number text,
  invoice_date date,
  source_files jsonb not null default '[]'::jsonb,
  imported_lines jsonb not null default '[]'::jsonb,
  status text not null default 'posted' check (status in ('draft', 'posted', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.warehouse_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.warehouse_items(id) on delete restrict,
  import_batch_id uuid references public.warehouse_import_batches(id) on delete set null,
  movement_date date not null default current_date,
  direction text not null check (direction in ('in', 'out')),
  purpose text not null default 'stock' check (purpose in ('stock', 'sale', 'job', 'internal', 'inventory', 'return', 'writeoff', 'opening')),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(14,4) not null default 0 check (unit_cost >= 0),
  supplier_name text,
  source_invoice text,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  order_id uuid references public.orders(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.warehouse_tools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_batch_id uuid references public.warehouse_import_batches(id) on delete set null,
  name text not null,
  category text,
  serial_number text,
  quantity numeric(14,3) not null default 1 check (quantity > 0),
  unit text not null default 'ks',
  purchase_date date,
  purchase_price numeric(14,4) not null default 0 check (purchase_price >= 0),
  status text not null default 'active' check (status in ('active', 'loaned', 'service', 'retired')),
  location text,
  assigned_to text,
  supplier_name text,
  source_invoice text,
  next_check_date date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.warehouse_inventories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_date date not null default current_date,
  location text not null default 'ITspot sklad',
  responsible_name text,
  note text,
  status text not null default 'draft' check (status in ('draft', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.warehouse_inventory_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_id uuid not null references public.warehouse_inventories(id) on delete cascade,
  item_id uuid not null references public.warehouse_items(id) on delete restrict,
  system_quantity numeric(14,3) not null default 0,
  physical_quantity numeric(14,3) not null default 0,
  unit_cost numeric(14,4) not null default 0,
  created_at timestamptz not null default now(),
  unique (inventory_id, item_id)
);

alter table public.warehouse_items enable row level security;
alter table public.warehouse_import_batches enable row level security;
alter table public.warehouse_movements enable row level security;
alter table public.warehouse_tools enable row level security;
alter table public.warehouse_inventories enable row level security;
alter table public.warehouse_inventory_lines enable row level security;

drop policy if exists "Users manage own warehouse items" on public.warehouse_items;
create policy "Users manage own warehouse items" on public.warehouse_items
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own warehouse imports" on public.warehouse_import_batches;
create policy "Users manage own warehouse imports" on public.warehouse_import_batches
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own warehouse movements" on public.warehouse_movements;
create policy "Users manage own warehouse movements" on public.warehouse_movements
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own warehouse tools" on public.warehouse_tools;
create policy "Users manage own warehouse tools" on public.warehouse_tools
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own warehouse inventories" on public.warehouse_inventories;
create policy "Users manage own warehouse inventories" on public.warehouse_inventories
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own warehouse inventory lines" on public.warehouse_inventory_lines;
create policy "Users manage own warehouse inventory lines" on public.warehouse_inventory_lines
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists warehouse_items_user_name_idx on public.warehouse_items (user_id, name);
create index if not exists warehouse_items_user_sku_idx on public.warehouse_items (user_id, sku);
create index if not exists warehouse_movements_user_date_idx on public.warehouse_movements (user_id, movement_date desc);
create index if not exists warehouse_movements_user_item_idx on public.warehouse_movements (user_id, item_id, movement_date);
create index if not exists warehouse_tools_user_name_idx on public.warehouse_tools (user_id, name);
create index if not exists warehouse_tools_user_status_idx on public.warehouse_tools (user_id, status);
create index if not exists warehouse_imports_user_created_idx on public.warehouse_import_batches (user_id, created_at desc);
create index if not exists warehouse_inventories_user_date_idx on public.warehouse_inventories (user_id, inventory_date desc);

notify pgrst, 'reload schema';
