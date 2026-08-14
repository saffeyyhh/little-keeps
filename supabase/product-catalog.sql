-- Little Keeps: product catalogue and product-specific pricing.
-- Safe to run more than once. Existing product edits are not overwritten.

create table if not exists public.product_catalog (
  product_key text primary key,
  name text not null,
  eyebrow text not null default '',
  description text not null default '',
  status text not null default 'coming_soon'
    check (status in ('active', 'coming_soon', 'hidden')),
  price_visible boolean not null default false,
  usual_base_price numeric(10, 2) not null default 0 check (usual_base_price >= 0),
  launch_base_price numeric(10, 2) not null default 0 check (launch_base_price >= 0),
  launch_price_enabled boolean not null default false,
  launch_price_ends_at timestamptz,
  included_characters integer not null default 1 check (included_characters >= 0),
  extra_character_price numeric(10, 2) not null default 0 check (extra_character_price >= 0),
  included_base_colours integer not null default 1 check (included_base_colours >= 0),
  included_cap_colours integer not null default 1 check (included_cap_colours >= 0),
  included_letter_colours integer not null default 1 check (included_letter_colours >= 0),
  extra_base_colour_price numeric(10, 2) not null default 0 check (extra_base_colour_price >= 0),
  extra_cap_colour_price numeric(10, 2) not null default 0 check (extra_cap_colour_price >= 0),
  extra_letter_colour_price numeric(10, 2) not null default 0 check (extra_letter_colour_price >= 0),
  minimum_characters integer not null default 1 check (minimum_characters >= 1),
  maximum_characters integer not null default 12 check (maximum_characters >= minimum_characters),
  base_print_minutes_fixed numeric(10, 2) not null default 0 check (base_print_minutes_fixed >= 0),
  base_print_minutes_per_character numeric(10, 2) not null default 0 check (base_print_minutes_per_character >= 0),
  keycap_print_minutes_per_character numeric(10, 2) not null default 0 check (keycap_print_minutes_per_character >= 0),
  assembly_minutes_per_item numeric(10, 2) not null default 0 check (assembly_minutes_per_item >= 0),
  image_path text,
  production_notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.product_catalog (
  product_key,
  name,
  eyebrow,
  description,
  status,
  price_visible,
  usual_base_price,
  launch_base_price,
  launch_price_enabled,
  included_characters,
  extra_character_price,
  included_base_colours,
  included_cap_colours,
  included_letter_colours,
  extra_base_colour_price,
  extra_cap_colour_price,
  extra_letter_colour_price,
  minimum_characters,
  maximum_characters,
  base_print_minutes_fixed,
  base_print_minutes_per_character,
  keycap_print_minutes_per_character,
  assembly_minutes_per_item,
  image_path,
  production_notes,
  sort_order
)
values
  (
    'modular-clicky-keychain',
    'Chunky Modular Clicky Keychain',
    'Articulated design',
    'Flexible character blocks that move and click.',
    'active',
    true,
    3.90,
    3.20,
    true,
    6,
    0.20,
    1,
    1,
    1,
    0.50,
    0.30,
    0.20,
    1,
    10,
    0,
    25,
    15,
    0,
    '/images/modular-clicky-keychain.jpg',
    'One modular base and one keycap are printed for every character.',
    10
  ),
  (
    'solid-clicky-keychain',
    'Solid Clicky Keychain',
    'One-piece design',
    'A clean solid base with the same satisfying click.',
    'coming_soon',
    false,
    4.50,
    3.80,
    true,
    6,
    0.30,
    1,
    1,
    1,
    0,
    0.30,
    0.20,
    2,
    12,
    0,
    0,
    15,
    0,
    null,
    'Draft pricing only. Time 2-, 6- and 10-character test prints before launch.',
    20
  )
  ,
(
  'standard-name-keychain',
  'Standard Name Keychain',
  'Classic design',
  'A personalised name keychain without clickable switches.',
  'active',
  true,
  3.50,
  3.50,
  false,
  6,
  0.20,
  1,
  0,
  1,
  0.50,
  0,
  0.20,
  1,
  10,
  0,
  25,
  0,
  0,
  '/images/standard-name-keychain.jpg',
  'One normal name keychain is printed per order. No keycaps are required.',
  30
)
on conflict (product_key) do nothing;

alter table public.orders
  add column if not exists product_key text not null
  default 'modular-clicky-keychain';

create index if not exists orders_product_key_idx
  on public.orders (product_key, created_at desc);

alter table public.product_catalog enable row level security;

drop policy if exists "Anyone can view the product catalogue"
  on public.product_catalog;
create policy "Anyone can view the product catalogue"
  on public.product_catalog
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated users can add products"
  on public.product_catalog;
create policy "Authenticated users can add products"
  on public.product_catalog
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update products"
  on public.product_catalog;
create policy "Authenticated users can update products"
  on public.product_catalog
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete products"
  on public.product_catalog;
create policy "Authenticated users can delete products"
  on public.product_catalog
  for delete
  to authenticated
  using (true);

grant select on public.product_catalog to anon, authenticated;
grant insert, update, delete on public.product_catalog to authenticated;
