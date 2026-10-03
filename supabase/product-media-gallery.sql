-- Little Keeps: editable product photo galleries and click videos.
-- Safe to run more than once.

alter table public.product_catalog
  add column if not exists gallery_paths jsonb not null default '[]'::jsonb;
alter table public.product_catalog
  add column if not exists video_path text not null default '';

update public.product_catalog
set
  gallery_paths = case
    when gallery_paths = '[]'::jsonb and coalesce(image_path, '') <> ''
      then jsonb_build_array(image_path)
    else gallery_paths
  end,
  video_path = case
    when product_key = 'modular-clicky-keychain' and video_path = ''
      then '/media/modular-clicker-demo.mp4'
    when product_key = 'solid-clicky-keychain' and video_path = ''
      then '/media/compact-clicker-demo.mp4'
    else video_path
  end;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view product images" on storage.objects;
create policy "Anyone can view product images"
  on storage.objects for select
  to public
  using (bucket_id = 'product-images');

drop policy if exists "Authenticated users can upload product images" on storage.objects;
create policy "Authenticated users can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "Authenticated users can update product images" on storage.objects;
create policy "Authenticated users can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

drop policy if exists "Authenticated users can delete product images" on storage.objects;
create policy "Authenticated users can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');

grant select on public.product_catalog to anon, authenticated;
grant insert, update, delete on public.product_catalog to authenticated;
