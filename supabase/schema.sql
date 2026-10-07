-- Restaurante Doña Paty - Supabase schema
-- Prepared for Supabase Auth + Postgres + private Storage.
-- Run this only after the project exists and after reviewing the business name/data.
-- The app can continue in local/demo mode until then.

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'helper' check (role in ('owner', 'manager', 'helper')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table if not exists public.business_public_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  slug text not null unique,
  display_name text not null,
  slogan text not null default '',
  phone text not null default '',
  bank_name text not null default '',
  bank_account text not null default '',
  account_holder text not null default '',
  public_menu_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text not null default '',
  category text not null check (category in ('soup', 'main', 'drink', 'extra')),
  price numeric(10,2) not null check (price >= 0),
  available boolean not null default true,
  published boolean not null default true,
  image_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  payment_method text not null check (payment_method in ('cash', 'transfer', 'credit')),
  total numeric(10,2) not null check (total >= 0),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0)
);

create table if not exists public.credit_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  sale_id uuid references public.sales(id) on delete set null,
  movement_type text not null check (movement_type in ('charge', 'payment')),
  amount numeric(10,2) not null check (amount > 0),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  storage_path text not null,
  original_name text not null default '',
  created_at timestamptz not null default now(),
  unique (sale_id, storage_path)
);

create index if not exists staff_profiles_user_idx on public.staff_profiles(user_id);
create index if not exists menu_items_business_idx on public.menu_items(business_id, sort_order);
create index if not exists customers_business_name_idx on public.customers(business_id, name);
create index if not exists sales_business_created_idx on public.sales(business_id, created_at desc);
create index if not exists credit_business_customer_idx on public.credit_movements(business_id, customer_id, created_at desc);
create index if not exists receipts_business_sale_idx on public.receipts(business_id, sale_id);

alter table public.businesses enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.business_public_settings enable row level security;
alter table public.menu_items enable row level security;
alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.credit_movements enable row level security;
alter table public.receipts enable row level security;

-- Explicit Data API privileges. RLS still decides which rows are accessible.
grant select, insert, update, delete on public.businesses to authenticated;
grant select, insert, update, delete on public.staff_profiles to authenticated;
grant select, insert, update, delete on public.business_public_settings to authenticated;
grant select, insert, update, delete on public.menu_items to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.sales to authenticated;
grant select, insert, update, delete on public.sale_items to authenticated;
grant select, insert, update, delete on public.credit_movements to authenticated;
grant select, insert, update, delete on public.receipts to authenticated;

grant select on public.business_public_settings to anon;
grant select on public.menu_items to anon;

-- Businesses: an authenticated user can create their own business.
create policy "business creator can insert"
on public.businesses for insert
to authenticated
with check ((select auth.uid()) = created_by);

create policy "business creator or member can read"
on public.businesses for select
to authenticated
using (
  created_by = (select auth.uid())
  or exists (
    select 1 from public.staff_profiles sp
    where sp.business_id = businesses.id
      and sp.user_id = (select auth.uid())
  )
);

create policy "business creator can update"
on public.businesses for update
to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

create policy "business creator can delete"
on public.businesses for delete
to authenticated
using (created_by = (select auth.uid()));

-- Staff: users can always read their own staff membership.
create policy "staff can read own membership"
on public.staff_profiles for select
to authenticated
using (user_id = (select auth.uid()));

-- Creator can add staff to a business they own; users may add their own initial owner profile.
create policy "business creator can add staff"
on public.staff_profiles for insert
to authenticated
with check (
  exists (
    select 1 from public.businesses b
    where b.id = staff_profiles.business_id
      and b.created_by = (select auth.uid())
  )
);

create policy "business creator can update staff"
on public.staff_profiles for update
to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = staff_profiles.business_id
      and b.created_by = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.businesses b
    where b.id = staff_profiles.business_id
      and b.created_by = (select auth.uid())
  )
);

create policy "business creator can remove staff"
on public.staff_profiles for delete
to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = staff_profiles.business_id
      and b.created_by = (select auth.uid())
  )
);

-- Public menu/business details: intentionally readable without login when enabled.
create policy "public settings readable when menu enabled"
on public.business_public_settings for select
to anon, authenticated
using (public_menu_enabled = true);

create policy "members can manage public settings"
on public.business_public_settings for all
to authenticated
using (
  exists (
    select 1 from public.staff_profiles sp
    where sp.business_id = business_public_settings.business_id
      and sp.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.staff_profiles sp
    where sp.business_id = business_public_settings.business_id
      and sp.user_id = (select auth.uid())
  )
);

create policy "published menu is public"
on public.menu_items for select
to anon, authenticated
using (published = true);

create policy "members manage menu"
on public.menu_items for all
to authenticated
using (
  exists (
    select 1 from public.staff_profiles sp
    where sp.business_id = menu_items.business_id
      and sp.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.staff_profiles sp
    where sp.business_id = menu_items.business_id
      and sp.user_id = (select auth.uid())
  )
);

-- Private operational tables.
create policy "members manage customers"
on public.customers for all
to authenticated
using (
  exists (
    select 1 from public.staff_profiles sp
    where sp.business_id = customers.business_id
      and sp.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.staff_profiles sp
    where sp.business_id = customers.business_id
      and sp.user_id = (select auth.uid())
  )
);

create policy "members manage sales"
on public.sales for all
to authenticated
using (
  exists (
    select 1 from public.staff_profiles sp
    where sp.business_id = sales.business_id
      and sp.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.staff_profiles sp
    where sp.business_id = sales.business_id
      and sp.user_id = (select auth.uid())
  )
);

create policy "members manage sale items"
on public.sale_items for all
to authenticated
using (
  exists (
    select 1 from public.staff_profiles sp
    where sp.business_id = sale_items.business_id
      and sp.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.staff_profiles sp
    where sp.business_id = sale_items.business_id
      and sp.user_id = (select auth.uid())
  )
);

create policy "members manage credit movements"
on public.credit_movements for all
to authenticated
using (
  exists (
    select 1 from public.staff_profiles sp
    where sp.business_id = credit_movements.business_id
      and sp.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.staff_profiles sp
    where sp.business_id = credit_movements.business_id
      and sp.user_id = (select auth.uid())
  )
);

create policy "members manage receipt metadata"
on public.receipts for all
to authenticated
using (
  exists (
    select 1 from public.staff_profiles sp
    where sp.business_id = receipts.business_id
      and sp.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.staff_profiles sp
    where sp.business_id = receipts.business_id
      and sp.user_id = (select auth.uid())
  )
);

-- STORAGE
-- Create a PRIVATE bucket named "receipts" in the Supabase Dashboard.
-- Object paths should be: <business_id>/<sale_id>/<filename>
-- Storage metadata is managed by the Storage API, not by direct SQL inserts/deletes.

create policy "members can read receipt files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'receipts'
  and exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = (select auth.uid())
      and sp.business_id::text = (storage.foldername(name))[1]
  )
);

create policy "members can upload receipt files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'receipts'
  and exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = (select auth.uid())
      and sp.business_id::text = (storage.foldername(name))[1]
  )
);

create policy "members can update receipt files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'receipts'
  and exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = (select auth.uid())
      and sp.business_id::text = (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'receipts'
  and exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = (select auth.uid())
      and sp.business_id::text = (storage.foldername(name))[1]
  )
);

create policy "members can delete receipt files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'receipts'
  and exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = (select auth.uid())
      and sp.business_id::text = (storage.foldername(name))[1]
  )
);
