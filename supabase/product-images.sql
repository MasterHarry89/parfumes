-- Photo storage for the admin "Nový produkt" form.
-- Run once in the Supabase SQL editor.

-- Public bucket: product photos are shown on the storefront, so anyone may
-- read them by URL. Only signed-in users (the admin) may write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB; the form shrinks photos to a few hundred KB before upload
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admin can upload product images" on storage.objects;
drop policy if exists "Admin can replace product images" on storage.objects;
drop policy if exists "Admin can delete product images" on storage.objects;

create policy "Admin can upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images');

create policy "Admin can replace product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

create policy "Admin can delete product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images');
