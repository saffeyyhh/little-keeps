-- Little Keeps: launch the customised name keychain and NFC add-on.
-- Run once in the Supabase SQL editor.

alter table public.shop_settings
  add column if not exists nfc_addon_price numeric(10, 2) not null
  default 2.50 check (nfc_addon_price >= 0);

update public.product_catalog
set
  name = 'Customised Name Keychain',
  eyebrow = 'Classic personalised design',
  description = 'A one-piece name keychain with your choice of letter size and colours.',
  status = 'active',
  price_visible = true,
  production_notes = 'Print the order-specific background and raised-name STL files. Confirm the selected 18 mm, 24 mm or 30 mm letter size before printing.',
  updated_at = now()
where product_key = 'standard-name-keychain';

insert into public.inventory_items (item_name, qty, category, updated_at)
values ('NTAG215 NFC Wet Label (25 mm)', 0, 'Hardware', now())
on conflict (item_name) do nothing;

notify pgrst, 'reload schema';
