-- Little Keeps: licensed CritterCRAFT clicker collection.
-- Safe to run more than once.

alter table public.product_catalog
  add column if not exists kpop_models jsonb not null default '[]'::jsonb;

update public.product_catalog
set
  name = 'Critter Clickers',
  eyebrow = 'Cute little characters with a satisfying click.',
  description = 'Choose a licensed CritterCRAFT design, see the real finished look and mix your colours.',
  status = 'active',
  price_visible = true,
  usual_base_price = 6.90,
  launch_base_price = 6.90,
  image_path = '/images/critter-clickers/baby-dragon.jpg',
  gallery_paths = jsonb_build_array(
    '/images/critter-clickers/baby-dragon.jpg',
    '/images/critter-clickers/chonky-cat.jpg',
    '/images/critter-clickers/mini-dumpling.jpg'
  ),
  production_notes = 'Licensed CritterCRAFT design. Print the selected 3MF clicker body and cap, then confirm all chosen colours before slicing.',
  kpop_models = jsonb_build_array(
    jsonb_build_object('key', 'baby-dragon', 'name', 'Baby Dragon', 'accent', '#f383a0', 'modelUrl', '/models/critter-clickers/baby-dragon.3mf', 'thumbnail', '/images/critter-clickers/baby-dragon.jpg'),
    jsonb_build_object('key', 'baby-mushroom', 'name', 'Baby Mushroom', 'accent', '#f15b5b', 'modelUrl', '/models/critter-clickers/baby-mushroom.3mf', 'thumbnail', '/images/critter-clickers/baby-mushroom.jpg'),
    jsonb_build_object('key', 'baby-sunflower', 'name', 'Baby Sunflower', 'accent', '#ffc400', 'modelUrl', '/models/critter-clickers/baby-sunflower.3mf', 'thumbnail', '/images/critter-clickers/baby-sunflower.jpg'),
    jsonb_build_object('key', 'cactus-cat', 'name', 'Cactus Cat', 'accent', '#43a047', 'modelUrl', '/models/critter-clickers/cactus-cat.3mf', 'thumbnail', '/images/critter-clickers/cactus-cat.jpg'),
    jsonb_build_object('key', 'mini-cauldron', 'name', 'Mini Cauldron', 'accent', '#6742a6', 'modelUrl', '/models/critter-clickers/mini-cauldron.3mf', 'thumbnail', '/images/critter-clickers/mini-cauldron.jpg'),
    jsonb_build_object('key', 'chonky-cat', 'name', 'Chonky Cat', 'accent', '#f0a65a', 'modelUrl', '/models/critter-clickers/chonky-cat.3mf', 'thumbnail', '/images/critter-clickers/chonky-cat.jpg'),
    jsonb_build_object('key', 'mini-dumpling', 'name', 'Mini Dumpling', 'accent', '#f3d7a4', 'modelUrl', '/models/critter-clickers/mini-dumpling.3mf', 'thumbnail', '/images/critter-clickers/mini-dumpling.jpg'),
    jsonb_build_object('key', 'fruit-turtle', 'name', 'Fruit Turtle', 'accent', '#4aa36b', 'modelUrl', '/models/critter-clickers/fruit-turtle.3mf', 'thumbnail', '/images/critter-clickers/fruit-turtle.jpg'),
    jsonb_build_object('key', 'ghost', 'name', 'Ghost', 'accent', '#e9e6df', 'modelUrl', '/models/critter-clickers/ghost.3mf', 'thumbnail', '/images/critter-clickers/ghost.jpg'),
    jsonb_build_object('key', 'jack-o-lantern', 'name', 'Jack-O’-Lantern', 'accent', '#ff781f', 'modelUrl', '/models/critter-clickers/jack-o-lantern.3mf', 'thumbnail', '/images/critter-clickers/jack-o-lantern.jpg'),
    jsonb_build_object('key', 'mothman', 'name', 'Mothman', 'accent', '#38343b', 'modelUrl', '/models/critter-clickers/mothman.3mf', 'thumbnail', '/images/critter-clickers/mothman.jpg'),
    jsonb_build_object('key', 'potion', 'name', 'Potion', 'accent', '#8752bd', 'modelUrl', '/models/critter-clickers/potion.3mf', 'thumbnail', '/images/critter-clickers/potion.jpg')
  )
where product_key = 'custom-image-clicker';

notify pgrst, 'reload schema';
