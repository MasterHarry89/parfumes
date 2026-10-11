-- Customer accounts: order history and loyalty points.
-- Run once in the Supabase SQL editor, after admin-lockdown.sql.
--
-- Then in the dashboard: Authentication > Providers > Email > enable "Allow new users to sign up".
-- That is safe: admin access depends on the public.admins allow-list, not on having an account.

-- Who placed the order and what was in it. The checkout fills `items` with
-- [{ "product_id", "name", "brand", "volume", "quantity", "price" }] (price in tenths of CZK).
alter table public.orders add column if not exists user_id uuid references auth.users (id) on delete set null;
alter table public.orders add column if not exists items jsonb not null default '[]'::jsonb;
create index if not exists orders_user_id_idx on public.orders (user_id);

-- Customers see their own orders (the admin still sees all of them).
drop policy if exists "Customer reads own orders" on public.orders;
create policy "Customer reads own orders" on public.orders
  for select to authenticated using (user_id = auth.uid());

-- Points are earned only on paid orders, so a shopper must never be able to create
-- an order that is already paid or that belongs to someone else. Orders created
-- from the browser always start as pending and are tied to the logged-in user;
-- only the admin (or the server-side payment webhook) may set them otherwise.
create or replace function public.orders_guard_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    new.status := 'pending';
    new.user_id := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists orders_guard_insert on public.orders;
create trigger orders_guard_insert
  before insert on public.orders
  for each row execute function public.orders_guard_insert();
