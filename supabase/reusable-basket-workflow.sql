-- Reusable workshop baskets for paper-free assembly sorting.
-- Run once in the Supabase SQL editor.

alter table public.orders
  add column if not exists basket_number integer,
  add column if not exists basket_assigned_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_basket_number_range'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_basket_number_range
      check (basket_number is null or basket_number between 1 and 20);
  end if;
end $$;

-- A physical basket can hold only one order at a time.
create unique index if not exists orders_active_basket_number_unique
  on public.orders (basket_number)
  where basket_number is not null;

comment on column public.orders.basket_number is
  'Reusable physical workshop basket number assigned during assembly.';

comment on column public.orders.basket_assigned_at is
  'Time the order was placed in its reusable physical workshop basket.';
