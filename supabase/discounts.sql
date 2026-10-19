-- Discount codes: the codes table, the discount stored on orders, the code check
-- for the checkout preview and place_order() with discounts.
-- Run once in the Supabase SQL editor, after checkout.sql.
-- NOTE: stock.sql replaces place_order() with a version that also checks stock.
-- If you ever re-run this file, run stock.sql again afterwards.
--
-- Rules (keep in sync with src/lib/discounts.js, which only formats messages):
--   * the discount applies to the goods only, never to shipping or the COD fee;
--   * free shipping (from 1 500 Kč) is judged on the goods AFTER the discount;
--   * one code per order;
--   * an order uses up the code unless it is cancelled (pending orders count too,
--     so a limited code cannot be over-used while payments are on their way).

create table if not exists public.discount_codes (
  id                bigint generated always as identity primary key,
  code              text          not null check (code ~ '^[A-Z0-9_-]{3,32}$'),
  kind              text          not null check (kind in ('percent', 'fixed')),
  -- percent: 1–100; fixed: tenths of CZK like every other amount.
  value             numeric(14,2) not null check (value > 0),
  valid_from        date,         -- inclusive, Prague time; null = from now
  valid_to          date,         -- inclusive, Prague time; null = no end
  min_order         numeric(14,2) not null default 0 check (min_order >= 0), -- goods, tenths of CZK
  max_uses          int           check (max_uses > 0),                      -- null = unlimited
  once_per_customer boolean       not null default false,
  active            boolean       not null default true, -- false = ended by the admin
  note              text,
  created_at        timestamptz   not null default now(),
  check (kind <> 'percent' or value <= 100),
  check (valid_from is null or valid_to is null or valid_to >= valid_from)
);
create unique index if not exists discount_codes_code_idx on public.discount_codes (code);

alter table public.discount_codes enable row level security;
drop policy if exists "Admin manages discount codes" on public.discount_codes;
create policy "Admin manages discount codes" on public.discount_codes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- What the order got. The code text and amount are a snapshot, so later edits or
-- deleting the code never change past orders.
alter table public.orders add column if not exists discount_id bigint
  references public.discount_codes (id) on delete set null;
alter table public.orders add column if not exists discount_code text;
alter table public.orders add column if not exists discount_amount numeric not null default 0;
create index if not exists orders_discount_id_idx on public.orders (discount_id);

-- Evaluates a code for a goods subtotal (tenths of CZK). Returns
--   { ok: true,  id, code, kind, value, amount }            or
--   { ok: false, error, valid_from?, valid_to?, min_order? }
-- error: unknown | ended | not_started | expired | min_order | used_up | already_used.
-- Locks the code row so two orders cannot both take the last use.
-- Internal: called by check_discount() and place_order(), not from the API.
create or replace function public.discount_quote(p_code text, p_subtotal numeric, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  dc record;
  today date := (now() at time zone 'Europe/Prague')::date;
  used int;
  amount numeric;
begin
  select * into dc from public.discount_codes where code = upper(trim(p_code)) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'unknown'); end if;
  if not dc.active then return jsonb_build_object('ok', false, 'error', 'ended'); end if;
  if dc.valid_from is not null and today < dc.valid_from then
    return jsonb_build_object('ok', false, 'error', 'not_started', 'valid_from', dc.valid_from);
  end if;
  if dc.valid_to is not null and today > dc.valid_to then
    return jsonb_build_object('ok', false, 'error', 'expired', 'valid_to', dc.valid_to);
  end if;
  if p_subtotal < dc.min_order then
    return jsonb_build_object('ok', false, 'error', 'min_order', 'min_order', dc.min_order);
  end if;

  if dc.max_uses is not null then
    select count(*) into used from public.orders
    where discount_id = dc.id and lower(coalesce(status, '')) not in ('cancelled', 'canceled', 'zrušeno');
    if used >= dc.max_uses then return jsonb_build_object('ok', false, 'error', 'used_up'); end if;
  end if;

  -- Checked once the e-mail is known (always at place_order).
  if dc.once_per_customer and coalesce(trim(p_email), '') <> '' and exists (
    select 1 from public.orders
    where discount_id = dc.id
      and lower(coalesce(status, '')) not in ('cancelled', 'canceled', 'zrušeno')
      and (lower(email) = lower(trim(p_email)) or (auth.uid() is not null and user_id = auth.uid()))
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_used');
  end if;

  -- Whole crowns (10 tenths), never more than the goods.
  amount := case dc.kind
    when 'percent' then round(p_subtotal * dc.value / 100 / 10) * 10
    else dc.value
  end;
  amount := least(amount, p_subtotal);

  return jsonb_build_object(
    'ok', true, 'id', dc.id, 'code', dc.code, 'kind', dc.kind, 'value', dc.value, 'amount', amount
  );
end $$;

revoke all on function public.discount_quote(text, numeric, text) from public, anon, authenticated;

-- Checkout preview: is this code valid for the cart? The browser only displays
-- the answer; place_order() evaluates the code again on the real prices.
create or replace function public.check_discount(p_code text, p_subtotal numeric, p_email text default '')
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.discount_quote(p_code, greatest(coalesce(p_subtotal, 0), 0), p_email) - 'id';
$$;

revoke all on function public.check_discount(text, numeric, text) from public;
grant execute on function public.check_discount(text, numeric, text) to anon, authenticated;

-- place_order() from checkout.sql plus the optional payload.discount_code.
-- Returns { id, order_number, total, discount_amount }.
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
    discount_id, discount_code, discount_amount
  ) values (
    auth.uid(), 'pending', trim(payload ->> 'customer_name'), lower(trim(payload ->> 'email')),
    nullif(trim(payload ->> 'phone'), ''), nullif(trim(payload ->> 'note'), ''), lines,
    subtotal - discount + ship_price + pay_fee,
    shipping,
    case when shipping = 'packeta_point' then payload -> 'shipping_point' end,
    case when shipping = 'packeta_home' then payload -> 'shipping_address' end,
    ship_price, payment, pay_fee,
    (quote ->> 'id')::bigint, quote ->> 'code', discount
  )
  returning id, order_number, total into placed;

  return jsonb_build_object(
    'id', placed.id, 'order_number', placed.order_number, 'total', placed.total,
    'discount_amount', discount
  );
end $$;

revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;
