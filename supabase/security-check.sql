-- Read-only security check of the live database. Changes nothing.
-- Run in the Supabase SQL editor; every query should return NO rows.
-- Anything listed is a problem (see the comment above the query).

-- 1) Tables reachable through the API without row level security
--    (anyone with the public anon key could read and change them).
select 'table without RLS' as problem, tablename as name
from pg_tables
where schemaname = 'public' and not rowsecurity

union all

-- 2) Policies open to everyone or to any logged-in customer that do more than read
--    products (customers can sign up, so "authenticated" is not "admin").
select 'policy too open: ' || cmd || ' ' || tablename, policyname
from pg_policies
where schemaname = 'public'
  and (roles && array['anon', 'public', 'authenticated']::name[])
  and coalesce(qual, '') not like '%is_admin()%'
  and coalesce(with_check, '') not like '%is_admin()%'
  and not (tablename = 'products' and cmd = 'SELECT')
  and not (tablename = 'orders' and cmd = 'SELECT' and qual like '%auth.uid()%')

union all

-- 3) Storage policies on the photo bucket that do not check for the admin.
select 'storage policy too open: ' || cmd, policyname
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and coalesce(qual, '') || coalesce(with_check, '') like '%product-images%'
  and coalesce(qual, '') || coalesce(with_check, '') not like '%is_admin()%'
  and cmd <> 'SELECT'

union all

-- 4) Security-definer functions the public anon key may call, other than the
--    checkout ones that are meant for it.
select 'function callable by anon', p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and p.prorettype <> 'trigger'::regtype
  and has_function_privilege('anon', p.oid, 'execute')
  and p.proname not in ('place_order', 'check_discount')

union all

-- 5) Allow-listed admins. Expect exactly your own e-mail(s) — shown, not a problem.
select 'admin (check it is you)', email from public.admins;
