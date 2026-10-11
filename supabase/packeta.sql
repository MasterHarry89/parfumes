-- Zásilkovna API: the packet created for an order and its latest tracking state.
-- Run once in the Supabase SQL editor, after checkout.sql.
-- Written by the Netlify functions in netlify/functions (they use the service role key).

alter table public.orders add column if not exists packeta_packet_id text;
alter table public.orders add column if not exists packeta_barcode text;
alter table public.orders add column if not exists packeta_status text;       -- e.g. "ready for pickup"
alter table public.orders add column if not exists packeta_status_code int;
alter table public.orders add column if not exists packeta_status_at timestamptz;
