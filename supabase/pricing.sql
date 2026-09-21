-- Pricing per sample size + packaging materials.
-- Run once in the Supabase SQL editor (after admin-lockdown.sql).

-- 1) Selling price per sample size, in tenths of CZK, e.g. {"1":990,"2":1790,"3":2490}.
--    products.price stays the 1 ml price ("od ..." on the shop). Products without
--    this column filled keep using price + the old fixed surcharges.
alter table public.products
  add column if not exists prices jsonb not null default '{}';

-- 2) Packaging materials (vials, boxes, filler, labels ...).
--    unit_cost is in tenths of CZK per piece, stock_qty in pieces.
--    per_sample = how many pieces one sample uses, sizes = which sample sizes
--    (in ml) use this material.
create table if not exists public.packaging_materials (
  id          bigint generated always as identity primary key,
  name        text          not null,
  stock_qty   numeric(12,2) not null default 0 check (stock_qty >= 0),
  unit_cost   numeric(12,4) not null default 0 check (unit_cost >= 0),
  per_sample  numeric(8,3)  not null default 1 check (per_sample >= 0),
  sizes       int[]         not null default '{1,2,3}',
  created_at  timestamptz   not null default now()
);

alter table public.packaging_materials enable row level security;

drop policy if exists "Admin manages packaging" on public.packaging_materials;
create policy "Admin manages packaging" on public.packaging_materials
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
