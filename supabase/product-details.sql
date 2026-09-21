-- Product detail attributes shown in the accordion on the product page.
-- Run once in the Supabase SQL editor. All columns are optional: a product
-- without data simply hides the matching section on the site.

alter table public.products
  add column if not exists notes_top   text[]   not null default '{}',
  add column if not exists notes_heart text[]   not null default '{}',
  add column if not exists notes_base  text[]   not null default '{}',
  add column if not exists longevity   smallint check (longevity between 1 and 10),
  add column if not exists seasons     text[]   not null default '{}',
  add column if not exists occasions   text[]   not null default '{}';

comment on column public.products.notes_top   is 'Vrchní složky, e.g. {Bergamot,Zázvor}';
comment on column public.products.notes_heart is 'Srdcové složky';
comment on column public.products.notes_base  is 'Základní složky';
comment on column public.products.longevity   is 'Výdrž 1 (slabá) – 10 (silná)';
comment on column public.products.seasons     is 'Allowed: jaro, leto, podzim, zima';
comment on column public.products.occasions   is 'Allowed: kazdodenni, prace, vecer, rande, sport, party';

-- Example of filling one product (adjust id and values):
-- update public.products set
--   notes_top   = '{Kardamom,Iris,Fialka}',
--   notes_heart = '{Ambroxan,Cedr}',
--   notes_base  = '{Santalové dřevo,Papyrus,Kůže}',
--   longevity   = 7,
--   seasons     = '{jaro,podzim}',
--   occasions   = '{kazdodenni,vecer,rande}'
-- where id = 'santal-33';
