-- Little Keeps: private AI photo keepsake storage and request log.
-- Run once in the Supabase SQL editor before deploying generate-photo-keepsake.

alter table public.shop_settings
  add column if not exists photo_clicker_addon_price numeric(10, 2) not null
  default 3.00 check (photo_clicker_addon_price >= 0);

insert into public.product_catalog (
  product_key, name, eyebrow, description, status, price_visible,
  usual_base_price, launch_base_price, launch_price_enabled,
  included_characters, extra_character_price,
  included_base_colours, included_cap_colours, included_letter_colours,
  extra_base_colour_price, extra_cap_colour_price, extra_letter_colour_price,
  minimum_characters, maximum_characters,
  base_print_minutes_fixed, base_print_minutes_per_character,
  keycap_print_minutes_per_character, assembly_minutes_per_item,
  production_notes, sort_order
)
values (
  'ai-photo-keepsake',
  'Photo Keepsake Keychain',
  'Your photo, simplified for 3D printing',
  'Upload a person, pet or meaningful picture and receive a limited-colour illustrated keepsake.',
  'coming_soon', false,
  15.00, 12.00, true,
  50, 0,
  1, 1, 1,
  0, 0, 0,
  1, 50,
  120, 0, 0, 10,
  'AI artwork requires a manual printability check before slicing. Activate only after the OpenAI secret and function are installed.',
  40
)
on conflict (product_key) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-artwork',
  'customer-artwork',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.photo_artwork_requests (
  id uuid primary key default gen_random_uuid(),
  client_token text not null,
  requester_hash text not null,
  subject_type text not null check (subject_type in ('person', 'pet', 'object')),
  variant text not null check (variant in ('classic', 'clicker')),
  colour_count integer not null check (colour_count between 2 and 4),
  original_path text not null,
  artwork_path text not null,
  model text not null,
  status text not null default 'generated' check (status in ('generated', 'ordered', 'rejected', 'deleted')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index if not exists photo_artwork_requests_requester_idx
  on public.photo_artwork_requests (requester_hash, created_at desc);

alter table public.photo_artwork_requests
  add column if not exists expires_at timestamptz not null
  default (now() + interval '30 days');

alter table public.photo_artwork_requests enable row level security;

drop policy if exists "Admins can view photo artwork requests"
  on public.photo_artwork_requests;
create policy "Admins can view photo artwork requests"
  on public.photo_artwork_requests
  for select
  to authenticated
  using (true);

drop policy if exists "Admins can view private customer artwork"
  on storage.objects;
create policy "Admins can view private customer artwork"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'customer-artwork');

grant select on public.photo_artwork_requests to authenticated;

notify pgrst, 'reload schema';
