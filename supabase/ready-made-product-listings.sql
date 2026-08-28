-- Little Keeps: ready-made product listings, variants and product images.
-- Safe to run more than once.

alter table public.product_catalog
  add column if not exists product_type text not null default 'custom';
alter table public.product_catalog
  add column if not exists sku text not null default '';
alter table public.product_catalog
  add column if not exists stock_quantity integer not null default 0;
alter table public.product_catalog
  add column if not exists options jsonb not null default '[]'::jsonb;
alter table public.product_catalog
  add column if not exists gallery_paths jsonb not null default '[]'::jsonb;
alter table public.product_catalog
  add column if not exists featured boolean not null default false;

alter table public.product_catalog
  drop constraint if exists product_catalog_product_type_check;
alter table public.product_catalog
  add constraint product_catalog_product_type_check
  check (product_type in ('custom', 'ready_made'));

alter table public.product_catalog
  drop constraint if exists product_catalog_stock_quantity_check;
alter table public.product_catalog
  add constraint product_catalog_stock_quantity_check
  check (stock_quantity >= 0);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
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
