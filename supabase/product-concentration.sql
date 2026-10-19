-- Concentration of a scent (Eau de Toilette, Eau de Parfum …), shown on the product page.
-- Run once in the Supabase SQL editor. Optional per product; empty = not shown.
alter table public.products
  add column if not exists concentration text
  check (concentration in ('parfum', 'edp', 'edt', 'edc', 'oil'));

comment on column public.products.concentration is 'parfum | edp | edt | edc | oil (parfémový olej)';
