-- Real stock: orders take ml off the inventory, cancelling gives them back, and
-- the shop shows what is available (never costs or exact amounts).
-- Run once in the Supabase SQL editor, after discounts.sql and security-hardening.sql.
-- From now on the stock goes down by itself with every order: do not lower it by hand
-- for orders placed after this file was run.
--
-- A product without an inventory row is "not tracked" and always available.
-- One inventory row per product is assumed (the admin creates exactly one).

-- Orders placed from now on carry this flag; only they move stock on cancel / un-cancel.
alter table public.orders add column if not exists stock_reserved boolean not null default false;

-- What the shop may know: ml left per active product, capped at 100 so the exact
-- stock is not public. null for products that are not tracked.
create or replace function public.product_availability()
returns table (product_id text, ml_left int)
language sql
stable
security definer
set search_path = public
as $$
  select p.id::text,
         (select least(floor(greatest(i.stock_ml, 0)), 100)::int
          from public.inventory i
          where i.product_id::text = p.id::text
          order by i.id
          limit 1)
  from public.products p
  where p.active;
$$;

revoke all on function public.product_availability() from public;
grant execute on function public.product_availability() to anon, authenticated;

-- Adds (sign = 1) or removes (sign = -1) the ml of an order's items. Internal.
create or replace function public.order_stock_apply(p_items jsonb, p_sign int)
returns void
language sql
security definer
set search_path = public
as $$
  update public.inventory i
  set stock_ml = greatest(0, i.stock_ml + p_sign * x.ml)
  from (
    select line ->> 'product_id' as pid,
           sum((line ->> 'quantity')::int * split_part(line ->> 'volume', ' ', 1)::int) as ml
    from jsonb_array_elements(p_items) as line
    group by 1
  ) x
  where i.id = (
    select id from public.inventory where product_id::text = x.pid order by id limit 1
  );
$$;

revoke all on function public.order_stock_apply(jsonb, int) from public, anon, authenticated;

-- Cancelling an order returns its ml; taking the cancel back removes them again.
create or replace function public.orders_stock_on_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  was_cancelled boolean := lower(coalesce(old.status, '')) in ('cancelled', 'canceled', 'zrušeno');
  is_cancelled  boolean := lower(coalesce(new.status, '')) in ('cancelled', 'canceled', 'zrušeno');
begin
  if new.stock_reserved then
    if is_cancelled and not was_cancelled then
      perform public.order_stock_apply(new.items, 1);
    elsif was_cancelled and not is_cancelled then
      perform public.order_stock_apply(new.items, -1);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists orders_stock_on_status on public.orders;
create trigger orders_stock_on_status
  before update of status on public.orders
  for each row execute function public.orders_stock_on_status();

-- place_order() from discounts.sql plus the stock check. Returns
-- { id, order_number, total, discount_amount }; raises "out_of_stock <name>".
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
  needs jsonb := '{}'::jsonb; -- product id -> ml for the whole order
  need record;
  have numeric;
  subtotal numeric := 0;
  shipping text := payload ->> 'shipping_method';
  payment text := payload ->> 'payment_method';
  code text := upper(trim(coalesce(payload ->> 'discount_code', '')));
  quote jsonb;
  discount numeric := 0;
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
    needs := jsonb_set(
      needs, array[product.id::text],
      to_jsonb(coalesce((needs ->> product.id::text)::int, 0) + vol * qty)
    );
  end loop;

  -- Enough perfume for the whole order? Rows are locked, so two orders cannot
  -- both take the last ml. Untracked products (no inventory row) are skipped.
  for need in select key as pid, value::int as ml from jsonb_each_text(needs) loop
    perform 1 from public.inventory where product_id::text = need.pid for update;
    select stock_ml into have from public.inventory where product_id::text = need.pid order by id limit 1;
    if have is not null and have < need.ml then
      raise exception 'out_of_stock %', (select name from public.products where id::text = need.pid);
    end if;
  end loop;

  if code <> '' then
    quote := public.discount_quote(code, subtotal, payload ->> 'email');
    if not (quote ->> 'ok')::boolean then raise exception 'discount_%', quote ->> 'error'; end if;
    discount := (quote ->> 'amount')::numeric;
  end if;

  ship_price := case shipping when 'packeta_point' then 790 when 'packeta_home' then 1090 end;
  if ship_price is null then raise exception 'invalid_shipping'; end if;
  if subtotal - discount >= 15000 then ship_price := 0; end if; -- free shipping from 1 500 Kč after discount

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
    shipping_method, shipping_point, shipping_address, shipping_price, payment_method, payment_fee,
    discount_id, discount_code, discount_amount, stock_reserved
  ) values (
    auth.uid(), 'pending', trim(payload ->> 'customer_name'), lower(trim(payload ->> 'email')),
    nullif(trim(payload ->> 'phone'), ''), nullif(trim(payload ->> 'note'), ''), lines,
    subtotal - discount + ship_price + pay_fee,
    shipping,
    case when shipping = 'packeta_point' then payload -> 'shipping_point' end,
    case when shipping = 'packeta_home' then payload -> 'shipping_address' end,
    ship_price, payment, pay_fee,
    (quote ->> 'id')::bigint, quote ->> 'code', discount, true
  )
  returning id, order_number, total into placed;

  -- Take the ml off only once the order row exists (same transaction).
  perform public.order_stock_apply(lines, -1);

  return jsonb_build_object(
    'id', placed.id, 'order_number', placed.order_number, 'total', placed.total,
    'discount_amount', discount
  );
end $$;

revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;
