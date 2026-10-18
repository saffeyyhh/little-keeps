-- Little Keeps: editable K-pop 3MF model library.
-- Safe to run more than once.

alter table public.product_catalog
  add column if not exists kpop_models jsonb not null default '[]'::jsonb;

update public.product_catalog
set
  name = 'K-pop Clicker',
  eyebrow = 'Your favourite group, one satisfying click.',
  description = 'Choose a ready-made K-pop design, customise the colours and preview it in 3D.',
  kpop_models = jsonb_build_array(
  jsonb_build_object('key', 'babymonster', 'name', 'BABYMONSTER', 'accent', '#f383a0', 'modelUrl', '/models/kpop/babymonster.3mf', 'thumbnail', '/images/kpop-models/babymonster/thumbnail_3mf.png'),
  jsonb_build_object('key', 'bts', 'name', 'BTS', 'accent', '#8a5cd6', 'modelUrl', '/models/kpop/bts.3mf', 'thumbnail', '/images/kpop-models/bts/thumbnail_3mf.png'),
  jsonb_build_object('key', 'exo', 'name', 'EXO', 'accent', '#bfc6ce', 'modelUrl', '/models/kpop/exo.3mf', 'thumbnail', '/images/kpop-models/exo/thumbnail_3mf.png'),
  jsonb_build_object('key', 'girls-generation', 'name', 'Girls’ Generation', 'accent', '#f38fbd', 'modelUrl', '/models/kpop/girls-generation.3mf', 'thumbnail', '/images/kpop-models/girls-generation/thumbnail_3mf.png'),
  jsonb_build_object('key', 'cortis', 'name', 'CORTIS', 'accent', '#759a62', 'modelUrl', '/models/kpop/cortis.3mf', 'thumbnail', '/images/kpop-models/cortis/thumbnail_3mf.png'),
  jsonb_build_object('key', 'enhypen', 'name', 'ENHYPEN', 'accent', '#d5d1c7', 'modelUrl', '/models/kpop/enhypen.3mf', 'thumbnail', '/images/kpop-models/enhypen/thumbnail_3mf.png'),
  jsonb_build_object('key', 'kpop-collection', 'name', 'K-pop Collection', 'accent', '#f1cb65', 'modelUrl', '/models/kpop/kpop-collection.3mf', 'thumbnail', '/images/kpop-models/kpop-collection/thumbnail_3mf.png'),
  jsonb_build_object('key', 'stray-kids-collection', 'name', 'Stray Kids Collection', 'accent', '#e84f57', 'modelUrl', '/models/kpop/stray-kids-collection.3mf', 'thumbnail', '/images/kpop-models/stray-kids-collection/thumbnail_3mf.png'),
  jsonb_build_object('key', 'stray-kids', 'name', 'Stray Kids', 'accent', '#e84f57', 'modelUrl', '/models/kpop/stray-kids.3mf', 'thumbnail', '/images/kpop-models/stray-kids/thumbnail_3mf.png')
)
where product_key = 'custom-image-clicker'
  and kpop_models = '[]'::jsonb;

update storage.buckets
set
  file_size_limit = greatest(coalesce(file_size_limit, 0), 52428800),
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime',
    'model/3mf', 'application/octet-stream',
    'application/vnd.ms-package.3dmanufacturing-3dmodel+xml'
  ]
where id = 'product-images';

grant select on public.product_catalog to anon, authenticated;
grant update on public.product_catalog to authenticated;

notify pgrst, 'reload schema';
