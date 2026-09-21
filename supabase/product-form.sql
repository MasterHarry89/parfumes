-- Support for the admin "Nový produkt" form (/admin/produkty/novy).
-- Run once in the Supabase SQL editor, after product-details.sql.

-- 1) New product columns: multiple fragrance families + a long description.
alter table public.products
  add column if not exists families    text[] not null default '{}',
  add column if not exists description text;

comment on column public.products.families is 'Parfémové rodiny, e.g. {Dřevité,Kořeněné}. products.family keeps them joined by ", " for search.';

-- 2) Writes are blocked for the public anon key (row level security). Let
--    signed-in users (the admin) create and edit products and stock.
--    IMPORTANT: create your admin user in Authentication > Users, then turn
--    off public sign-ups (Authentication > Providers > Email > "Allow new
--    users to sign up"). Otherwise anyone could register and pass this check.
drop policy if exists "Admin can insert products" on public.products;
drop policy if exists "Admin can update products" on public.products;
drop policy if exists "Admin can insert inventory" on public.inventory;
drop policy if exists "Admin can update inventory" on public.inventory;

create policy "Admin can insert products" on public.products
  for insert to authenticated with check (true);
create policy "Admin can update products" on public.products
  for update to authenticated using (true) with check (true);
create policy "Admin can insert inventory" on public.inventory
  for insert to authenticated with check (true);
create policy "Admin can update inventory" on public.inventory
  for update to authenticated using (true) with check (true);

-- Products that are not active are hidden from the shop by the app
-- (products?active=eq.true), but the admin needs to see them too once the
-- product list page exists. Nothing to do for that yet.
