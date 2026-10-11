-- Checkout: delivery / payment details on orders and the place_order() function.
-- Run once in the Supabase SQL editor, after customer-accounts.sql.

alter table public.orders add column if not exists order_number bigint generated always as identity;
alter table public.orders add column if not exists email text;
alter table public.orders add column if not exists phone text;
alter table public.orders add column if not exists note text;
alter table public.orders add column if not exists shipping_method text;
alter table public.orders add column if not exists shipping_point jsonb;   -- Zásilkovna pickup point
alter table public.orders add column if not exists shipping_address jsonb; -- home delivery address
alter table public.orders add column if not exists shipping_price numeric not null default 0;
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists payment_fee numeric not null default 0;

-- Creates an order from the cart and returns { id, order_number, total }.
-- Prices come from the products table, never from the browser, so the total is
-- trustworthy for the bank transfer and for a future payment gateway.
-- Money is in tenths of CZK. Keep the fees in sync with src/lib/checkout.js
-- (that copy is only for display before the order is sent).
create or replace function public.place_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  product record;
  vol int;
  qty int;
  unit numeric;
  lines jsonb := '[]'::jsonb;
  subtotal numeric := 0;
  shipping text := payload ->> 'shipping_method';
  payment text := payload ->> 'payment_method';
  ship_price numeric;
  pay_fee numeric;
  placed record;
begin
  if coalesce(trim(payload ->> 'customer_name'), '') = '' then raise exception 'missing_name'; end if;
  if coalesce(payload ->> 'email', '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if jsonb_typeof(payload -> 'items') <> 'array' or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'empty_cart';
  end if;

  for item in select * from jsonb_array_elements(payload -> 'items') loop
    vol := (item ->> 'volume')::int;
    qty := (item ->> 'quantity')::int;
    if vol not in (1, 2, 3) or qty is null or qty < 1 or qty > 20 then raise exception 'invalid_item'; end if;

    select * into product from public.products where id::text = item ->> 'product_id' and active;
    if not found then raise exception 'unknown_product'; end if;

    -- Same rule as priceFor() in src/lib/catalog.js: the stored price for the size,
    -- otherwise the 1 ml price plus a fixed surcharge.
    unit := case
      when coalesce(product.prices ->> vol::text, '') ~ '^[0-9]+(\.[0-9]+)?$'
        and (product.prices ->> vol::text)::numeric > 0
        then (product.prices ->> vol::text)::numeric
      else coalesce(product.price, 0) + case vol when 2 then 30 when 3 then 55 else 0 end
    end;
    subtotal := subtotal + unit * qty;
    lines := lines || jsonb_build_object(
      'product_id', product.id, 'name', product.name, 'brand', product.brand,
      'volume', vol || ' ml', 'quantity', qty, 'price', unit
    );
  end loop;

  ship_price := case shipping when 'packeta_point' then 790 when 'packeta_home' then 1090 end;
  if ship_price is null then raise exception 'invalid_shipping'; end if;
  if subtotal >= 15000 then ship_price := 0; end if; -- free shipping from 1 500 Kč

  pay_fee := case payment when 'transfer' then 0 when 'card' then 0 when 'cod' then 290 end;
  if pay_fee is null then raise exception 'invalid_payment'; end if;

  if shipping = 'packeta_point' and coalesce(payload -> 'shipping_point' ->> 'name', '') = '' then
    raise exception 'missing_point';
  end if;
  if shipping = 'packeta_home' and (
    coalesce(payload -> 'shipping_address' ->> 'street', '') = ''
    or coalesce(payload -> 'shipping_address' ->> 'city', '') = ''
    or coalesce(payload -> 'shipping_address' ->> 'zip', '') = ''
  ) then
    raise exception 'missing_address';
  end if;

  insert into public.orders (
    user_id, status, customer_name, email, phone, note, items, total,
    shipping_method, shipping_point, shipping_address, shipping_price, payment_method, payment_fee
  ) values (
    auth.uid(), 'pending', trim(payload ->> 'customer_name'), lower(trim(payload ->> 'email')),
    nullif(trim(payload ->> 'phone'), ''), nullif(trim(payload ->> 'note'), ''), lines,
    subtotal + ship_price + pay_fee,
    shipping,
    case when shipping = 'packeta_point' then payload -> 'shipping_point' end,
    case when shipping = 'packeta_home' then payload -> 'shipping_address' end,
    ship_price, payment, pay_fee
  )
  returning id, order_number, total into placed;

  return jsonb_build_object('id', placed.id, 'order_number', placed.order_number, 'total', placed.total);
end $$;

revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;
