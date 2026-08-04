-- Little Keeps gifting-bag inventory item.
-- Run this once in the Supabase SQL editor, then enter the current stock in Admin.

update public.inventory_items
set
  category = 'Packaging',
  updated_at = now()
where item_name = 'Gifting Bag';

insert into public.inventory_items (
  item_name,
  qty,
  category,
  updated_at
)
select
  'Gifting Bag',
  0,
  'Packaging',
  now()
where not exists (
  select 1
  from public.inventory_items
  where item_name = 'Gifting Bag'
);

create or replace function public.get_gifting_bag_stock()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, coalesce((
    select qty
    from public.inventory_items
    where item_name = 'Gifting Bag'
    limit 1
  ), 0))::integer;
$$;

revoke all on function public.get_gifting_bag_stock() from public;
grant execute on function public.get_gifting_bag_stock() to anon, authenticated;
