-- Locks the admin down to allow-listed accounts only.
-- Run once in the Supabase SQL editor (replaces the policies from
-- product-form.sql and product-images.sql, so it is safe to run after them).
--
-- Before you run it:
--   1. Create your admin user in Authentication > Users.
--   2. Turn off public sign-ups (Authentication > Providers > Email).
-- The statement below then allow-lists every existing auth user, i.e. just you.
-- To add someone later:  insert into public.admins values ('name@example.com');

create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security; -- no policies: unreadable through the API

insert into public.admins (email)
select lower(email) from auth.users where email is not null
on conflict do nothing;

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
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Helper: drop every existing policy on a table (optionally keeping INSERT ones).
create or replace function pg_temp.drop_policies(tbl text, keep_insert boolean default false)
returns void language plpgsql as $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = tbl
      and not (keep_insert and cmd = 'INSERT')
  loop
    execute format('drop policy %I on public.%I', p.policyname, tbl);
  end loop;
end $$;

-- products: the shop sees active products, the admin sees and edits everything.
select pg_temp.drop_policies('products');
create policy "Public reads active products" on public.products
  for select to anon, authenticated using (active);
create policy "Admin reads all products" on public.products
  for select to authenticated using (public.is_admin());
create policy "Admin inserts products" on public.products
  for insert to authenticated with check (public.is_admin());
create policy "Admin updates products" on public.products
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin deletes products" on public.products
  for delete to authenticated using (public.is_admin());

-- inventory holds stock and purchase costs: admin only (no public access at all).
select pg_temp.drop_policies('inventory');
create policy "Admin manages inventory" on public.inventory
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- orders: only the admin can read or change them. INSERT policies are kept so a
-- future checkout can still create orders.
select pg_temp.drop_policies('orders', true);
create policy "Admin reads orders" on public.orders
  for select to authenticated using (public.is_admin());
create policy "Admin updates orders" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- product photos: everyone may view them (public bucket), only the admin writes.
drop policy if exists "Admin can upload product images" on storage.objects;
drop policy if exists "Admin can replace product images" on storage.objects;
drop policy if exists "Admin can delete product images" on storage.objects;
drop policy if exists "Admin uploads product images" on storage.objects;
drop policy if exists "Admin replaces product images" on storage.objects;
drop policy if exists "Admin deletes product images" on storage.objects;

create policy "Admin uploads product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "Admin replaces product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "Admin deletes product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
