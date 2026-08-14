-- Little Keeps: rename the original modular product for consistency.
-- Safe to run more than once in the Supabase SQL Editor.

update public.product_catalog
set
  name = 'Chunky Clicky Keychain',
  updated_at = now()
where product_key = 'modular-clicky-keychain'
  and name = 'Modular Clicky Keychain';

notify pgrst, 'reload schema';
