-- Information required for cosmetics (Regulation (EC) 1223/2009, Art. 19) and for
-- online sale (GPSR 2023/988, Art. 19). Copied from the original box of each scent.
-- Run once in the Supabase SQL editor. All columns are optional; empty = not shown.

alter table public.products
  add column if not exists ingredients  text,
  add column if not exists manufacturer text,
  add column if not exists pao_months   smallint check (pao_months between 1 and 120);

comment on column public.products.ingredients  is 'Složení (INCI) přesně podle krabičky, včetně alergenů (Linalool, Limonene …)';
comment on column public.products.manufacturer is 'Výrobce / odpovědná osoba originálu: název a adresa z krabičky';
comment on column public.products.pao_months   is 'Doba použitelnosti po otevření v měsících (symbol otevřené dózy, např. 36M)';

-- Batch (šarže / LOT) of the bottle the samples are currently filled from, for
-- traceability. Admin only: inventory is not readable by the public.
alter table public.inventory
  add column if not exists batch_code text;

comment on column public.inventory.batch_code is 'Šarže (LOT) flakonu, ze kterého se právě plní vzorky';

-- Printed leaflets: which batch each scent of the order was filled from (saved
-- when the leaflet is printed for the first time) and when that happened.
alter table public.orders
  add column if not exists batches            jsonb not null default '{}',
  add column if not exists leaflet_printed_at timestamptz;

comment on column public.orders.batches            is 'product_id -> šarže, ze které se plnilo (z tisku příbalového listu)';
comment on column public.orders.leaflet_printed_at is 'Kdy byl vytištěn příbalový list';
