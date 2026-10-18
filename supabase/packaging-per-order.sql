-- Packaging used once per ORDER (boxes, filler, business cards …) instead of per sample.
-- Run once in the Supabase SQL editor, after pricing.sql.
--   unit = 'sample': per_sample pieces go into every sample of the chosen sizes
--                    (part of the sample cost in pricing);
--   unit = 'order':  per_sample pieces go into every order, whatever is in it
--                    (sizes are ignored).
alter table public.packaging_materials
  add column if not exists unit text not null default 'sample' check (unit in ('sample', 'order'));
