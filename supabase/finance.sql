-- Finance, expenses and labour tracking.
-- Run once in the Supabase SQL editor (after admin-lockdown.sql and pricing.sql).

-- 1) Every money going out: perfume purchases, packaging, platform fees, ...
--    amount is in tenths of CZK, like prices everywhere else.
--    Purchases made in the admin (new product, restocking, packaging) are added
--    here automatically; fees and other costs are entered by hand.
create table if not exists public.expenses (
  id          bigint generated always as identity primary key,
  spent_on    date          not null default current_date,
  category    text          not null check (category in ('perfume', 'packaging', 'platform', 'other')),
  label       text          not null,
  amount      numeric(14,2) not null check (amount >= 0),
  product_id  text,
  material_id bigint,
  created_at  timestamptz   not null default now()
);
create index if not exists expenses_spent_on_idx on public.expenses (spent_on);

-- 2) Labour: measured tasks. unit = 'sample' (per filled vial) or 'order' (per order).
create table if not exists public.labor_tasks (
  id          bigint generated always as identity primary key,
  name        text          not null,
  minutes     numeric(8,2)  not null default 0 check (minutes >= 0),
  unit        text          not null default 'sample' check (unit in ('sample', 'order')),
  created_at  timestamptz   not null default now()
);

-- 3) Small key/value settings, e.g. hourly_rate = {"kc": 250}.
create table if not exists public.admin_settings (
  key   text primary key,
  value jsonb not null
);

alter table public.expenses       enable row level security;
alter table public.labor_tasks    enable row level security;
alter table public.admin_settings enable row level security;

drop policy if exists "Admin manages expenses"  on public.expenses;
drop policy if exists "Admin manages labour"    on public.labor_tasks;
drop policy if exists "Admin manages settings"  on public.admin_settings;

create policy "Admin manages expenses" on public.expenses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin manages labour" on public.labor_tasks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin manages settings" on public.admin_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
