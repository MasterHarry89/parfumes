-- Security hardening after the 2026-10 audit.
-- Run once in the Supabase SQL editor, after discounts.sql. Safe to run again.

-- 1) Row level security on every table the API can reach. Without it a table is
--    readable and writable by anyone holding the public anon key.
alter table public.products            enable row level security;
alter table public.inventory           enable row level security;
alter table public.orders              enable row level security;
alter table public.admins              enable row level security;
alter table public.packaging_materials enable row level security;
alter table public.expenses            enable row level security;
alter table public.labor_tasks         enable row level security;
alter table public.admin_settings      enable row level security;
alter table public.discount_codes      enable row level security;

-- 2) Orders are created only by place_order() (security definer, prices from the
--    database). Any INSERT policy would let a browser write an order directly,
--    with made-up items and totals, so all of them go.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'orders' and cmd = 'INSERT'
  loop
    execute format('drop policy %I on public.orders', p.policyname);
  end loop;
end $$;

-- 3) Old "any logged-in user" policies from before admin-lockdown.sql. Customers
--    can sign up now, so "authenticated" no longer means "admin".
drop policy if exists "Admin can insert products"        on public.products;
drop policy if exists "Admin can update products"        on public.products;
drop policy if exists "Admin can insert inventory"       on public.inventory;
drop policy if exists "Admin can update inventory"       on public.inventory;
drop policy if exists "Admin can upload product images"  on storage.objects;
drop policy if exists "Admin can replace product images" on storage.objects;
drop policy if exists "Admin can delete product images"  on storage.objects;

-- 4) Size limits on what a customer can send, so nobody can fill the database
--    with megabytes of text through the checkout. NOT VALID: checked for new and
--    changed rows only, existing orders are left alone.
alter table public.orders drop constraint if exists orders_input_size;
alter table public.orders add constraint orders_input_size check (
  coalesce(length(customer_name), 0) <= 120
  and coalesce(length(email), 0) <= 254
  and coalesce(length(phone), 0) <= 40
  and coalesce(length(note), 0) <= 1000
  and coalesce(pg_column_size(shipping_point), 0) <= 2000
  and coalesce(pg_column_size(shipping_address), 0) <= 2000
  and jsonb_array_length(items) <= 50
) not valid;

-- 5) Rate limit: at most 5 orders per e-mail per hour from the shop. Stops a
--    script from flooding the admin with fake (e.g. cash-on-delivery) orders.
--    The admin and the server (service role) are not limited.
create or replace function public.orders_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() and (
    select count(*) from public.orders
    where lower(email) = lower(new.email) and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'too_many_orders';
  end if;
  return new;
end $$;

drop trigger if exists orders_rate_limit on public.orders;
create trigger orders_rate_limit
  before insert on public.orders
  for each row execute function public.orders_rate_limit();

-- 6) Two-factor login for the admin. Once an admin has turned on the authenticator
--    app (Admin → Zabezpečení), their password alone is not enough: the admin rights
--    count only in a session confirmed with the 6-digit code (aal2). Admins without
--    the app keep working as before, so nobody is locked out.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  and (
    coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors
      where user_id = auth.uid() and status = 'verified'
    )
  );
$$;

-- 7) is_admin() only makes sense for a logged-in user. (Supabase grants EXECUTE to
--    anon by default.) Trigger functions cannot be called through the API at all.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
