-- Little Keeps: K-pop gallery and customer-uploaded image clicker.
-- Run once in the Supabase SQL editor, then deploy generate-photo-keepsake.

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
  'custom-image-clicker',
  'K-pop & Custom Image Clicker',
  'One image. One satisfying click.',
  'Choose a Little Keeps K-pop design or upload your own image for a personalised clicker keychain.',
  'coming_soon', false,
  6.90, 6.90, false,
  1, 0,
  1, 1, 0,
  0, 0, 0,
  1, 1,
  25, 0, 20, 5,
  'Print one clicker body and one image keycap. Check the chosen artwork, crop and body colour before printing.',
  22
)
on conflict (product_key) do update set
  name = excluded.name,
  eyebrow = excluded.eyebrow,
  description = excluded.description,
  production_notes = excluded.production_notes,
  sort_order = excluded.sort_order;

notify pgrst, 'reload schema';
