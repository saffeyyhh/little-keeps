-- Little Keeps hardware and packaging inventory additions.
-- Safe to run more than once: starting quantities are inserted only when
-- an item does not already exist, so later stock adjustments are preserved.

update public.inventory_items
set
  item_name = 'Metal Large D Ring',
  category = 'Hardware',
  updated_at = now()
where item_name = 'Key Ring'
  and not exists (
    select 1
    from public.inventory_items existing
    where existing.item_name = 'Metal Large D Ring'
  );

-- Remove the two legacy inventory labels. Metal Large D Ring is the only
-- ring stock tracked by the current workflow.
delete from public.inventory_items
where item_name in ('Key Ring', 'Jump Ring');

with new_items(item_name, qty, category) as (
  values
    ('NTAG215 NFC Wet Label (25 mm)', 50, 'Hardware'),
    ('White Thickened Courier Bag (28 × 40 cm)', 100, 'Packaging'),
    ('White Thickened Courier Bag (17 × 30 cm)', 100, 'Packaging'),
    ('Pink Bubble Packing Bag (25 × 30 + 5 cm)', 48, 'Packaging'),
    ('Self-Adhesive Transparent Bag (15 × 21 cm)', 500, 'Packaging')
)
insert into public.inventory_items (
  item_name,
  qty,
  category,
  updated_at
)
select
  new_items.item_name,
  new_items.qty,
  new_items.category,
  now()
from new_items
where not exists (
  select 1
  from public.inventory_items existing
  where existing.item_name = new_items.item_name
);
