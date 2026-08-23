-- Little Keeps: allow products to be hidden from the storefront.
-- Safe to run more than once in the Supabase SQL Editor.

alter table public.product_catalog
  drop constraint if exists product_catalog_status_check;

alter table public.product_catalog
  add constraint product_catalog_status_check
  check (status in ('active', 'coming_soon', 'hidden'));
