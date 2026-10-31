-- Little Keeps: launch the photographed Critter trio.
-- Safe to run more than once.

insert into public.product_catalog (
  product_key,
  product_type,
  name,
  sku,
  eyebrow,
  description,
  status,
  price_visible,
  usual_base_price,
  launch_base_price,
  launch_price_enabled,
  included_characters,
  included_base_colours,
  included_cap_colours,
  included_letter_colours,
  minimum_characters,
  maximum_characters,
  base_print_minutes_fixed,
  keycap_print_minutes_per_character,
  assembly_minutes_per_item,
  stock_quantity,
  options,
  featured,
  sort_order,
  image_path,
  gallery_paths,
  production_notes,
  kpop_models
)
values
  (
    'critter-chonky-cat', 'ready_made', 'Chonky Cat Clicker', 'CRITTER-CHONKY-CAT',
    'Licensed CritterCRAFT collection',
    'A satisfying Chonky Cat character clicker, made in the original fixed colours shown. Launch special: one for $5.90 or any three Critters for $15.',
    'active', true, 6.90, 5.90, true, 1, 1, 1, 0, 1, 1, 25, 20, 5, 250,
    '[]'::jsonb, true, 65,
    '/images/critter-clickers/chonky-cat.jpg',
    '["/images/critter-clickers/chonky-cat.jpg"]'::jsonb,
    'Licensed CritterCRAFT Chonky Cat. Print only the fixed-colour keychain variant shown.',
    '[{"key":"chonky-cat","name":"Chonky Cat","accent":"#f0a65a","modelUrl":"/models/critter-clickers/chonky-cat.3mf","thumbnail":"/images/critter-clickers/chonky-cat.jpg","previewMode":"3d"}]'::jsonb
  ),
  (
    'critter-baby-sunflower', 'ready_made', 'Baby Sunflower Clicker', 'CRITTER-BABY-SUNFLOWER',
    'Licensed CritterCRAFT collection',
    'A satisfying Baby Sunflower character clicker, made in the original fixed colours shown. Launch special: one for $5.90 or any three Critters for $15.',
    'active', true, 6.90, 5.90, true, 1, 1, 1, 0, 1, 1, 25, 20, 5, 250,
    '[]'::jsonb, false, 62,
    '/images/critter-clickers/baby-sunflower.jpg',
    '["/images/critter-clickers/baby-sunflower.jpg"]'::jsonb,
    'Licensed CritterCRAFT Baby Sunflower. Print only the fixed-colour keychain variant shown.',
    '[{"key":"baby-sunflower","name":"Baby Sunflower","accent":"#ffc400","modelUrl":"/models/critter-clickers/baby-sunflower.3mf","thumbnail":"/images/critter-clickers/baby-sunflower.jpg","previewMode":"3d"}]'::jsonb
  ),
  (
    'critter-ghost', 'ready_made', 'Ghost Clicker', 'CRITTER-GHOST',
    'Licensed CritterCRAFT collection',
    'A satisfying Ghost character clicker, made in the original fixed colours shown. Launch special: one for $5.90 or any three Critters for $15.',
    'active', true, 6.90, 5.90, true, 1, 1, 1, 0, 1, 1, 25, 20, 5, 250,
    '[]'::jsonb, false, 68,
    '/images/critter-clickers/ghost.jpg',
    '["/images/critter-clickers/ghost.jpg"]'::jsonb,
    'Licensed CritterCRAFT Ghost. Print only the fixed-colour keychain variant shown.',
    '[{"key":"ghost","name":"Ghost","accent":"#e9e6df","modelUrl":"/models/critter-clickers/ghost.3mf","thumbnail":"/images/critter-clickers/ghost.jpg","previewMode":"3d"}]'::jsonb
  )
on conflict (product_key) do update set
  name = excluded.name,
  sku = excluded.sku,
  description = excluded.description,
  status = 'active',
  price_visible = true,
  usual_base_price = 6.90,
  launch_base_price = 5.90,
  launch_price_enabled = true,
  stock_quantity = greatest(public.product_catalog.stock_quantity, 250),
  featured = excluded.featured,
  image_path = excluded.image_path,
  gallery_paths = excluded.gallery_paths,
  production_notes = excluded.production_notes,
  kpop_models = excluded.kpop_models,
  updated_at = now();

update public.shop_settings
set pickup_time_options = jsonb_set(
  coalesce(pickup_time_options, '{}'::jsonb),
  '{product_statuses}',
  coalesce(pickup_time_options -> 'product_statuses', '{}'::jsonb) || jsonb_build_object(
    'critter-chonky-cat', 'active',
    'critter-baby-sunflower', 'active',
    'critter-ghost', 'active'
  ),
  true
)
where id = 1;

notify pgrst, 'reload schema';
