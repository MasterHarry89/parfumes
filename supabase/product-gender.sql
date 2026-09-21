-- "Pro koho" (who the scent is for) on products.
-- Run once in the Supabase SQL editor.
alter table public.products
  add column if not exists gender text check (gender in ('women', 'men', 'unisex'));

comment on column public.products.gender is 'women | men | unisex';

-- Existing products stay empty until they are edited. To fill one in by hand:
-- update public.products set gender = 'men' where id = 'santal-33';
