-- Little Keeps: exact pickup appointments and unified linked-order fulfilment.
-- Run once in Supabase SQL Editor after the existing scheduling/add-on files.

alter table public.shop_settings
  add column if not exists pickup_time_options jsonb not null default
  '{"weekday":["7:00 PM","7:30 PM","8:00 PM"],"weekend":["10:00 AM","2:00 PM","7:00 PM"]}'::jsonb;

create or replace function public.order_can_accept_add_on(p_status text)
returns boolean language sql immutable as $$
  select coalesce(p_status, '') not in (
    'Printing', 'Assembly Complete', 'Ready for Pickup/Delivery',
    'Pending Pickup', 'Pending Delivery', 'Out for Delivery', 'Completed',
    'Refunded', 'Cancelled', 'Rejected', 'Payment Failed', 'Payment Expired'
  );
$$;

create or replace function public.validate_website_order_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_date date;
  v_lock_date date;
  v_pickup_day integer;
  v_pickup_options jsonb;
  v_slot_group text;
begin
  if coalesce(new.order_source, 'Website') <> 'Website' then return new; end if;
  v_date := coalesce(new.requested_completion_date, new.needed_by)::date;

  if new.order_type = 'bulk' then
    for v_lock_date in select day_value::date from generate_series(v_date - 1, v_date + 1, interval '1 day') day_value
    loop
      perform pg_advisory_xact_lock(hashtext('little-keeps-booking-' || v_lock_date::text));
    end loop;
    v_result := public.check_bulk_order_date(v_date);
  elsif new.order_type = 'rush' then
    perform pg_advisory_xact_lock(hashtext('little-keeps-booking-' || v_date::text));
    v_result := public.check_rush_order_date(v_date);
  else
    perform pg_advisory_xact_lock(hashtext('little-keeps-booking-' || v_date::text));
    v_result := public.check_needed_by_date(v_date);
  end if;

  if not coalesce((v_result ->> 'allowed')::boolean, false) then
    raise exception '%', coalesce(v_result ->> 'reason', 'This booking date is no longer available.');
  end if;

  if coalesce(new.collection_method, '') <> 'delivery' and new.linked_order_ref is null then
    if new.pickup_scheduled_date is null or nullif(trim(new.pickup_time_range), '') is null then
      raise exception 'Please choose a pickup date and exact time.';
    end if;
    if new.pickup_scheduled_date < v_date then
      raise exception 'Pickup must be on or after the estimated completion date.';
    end if;
    v_pickup_day := extract(isodow from new.pickup_scheduled_date);
    if v_pickup_day not in (3, 5, 6, 7) then
      raise exception 'Pickup is available on Wednesdays, Fridays, and weekends.';
    end if;
    select pickup_time_options into v_pickup_options from public.shop_settings where id = 1;
    v_slot_group := case when v_pickup_day in (6, 7) then 'weekend' else 'weekday' end;
    if not exists (
      select 1 from jsonb_array_elements_text(coalesce(v_pickup_options -> v_slot_group, '[]'::jsonb)) slot
      where slot = new.pickup_time_range
    ) then
      raise exception 'Please choose an available pickup time.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.prepare_linked_order_add_on()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.orders%rowtype;
  v_root_ref text;
begin
  new.original_needed_by := coalesce(new.original_needed_by, new.needed_by::date);
  new.original_estimated_ready_to := coalesce(new.original_estimated_ready_to, new.estimated_ready_to::date);
  if nullif(trim(new.linked_order_ref), '') is null then return new; end if;

  select * into v_parent from public.orders
  where upper(order_ref) = upper(trim(new.linked_order_ref))
    and lower(customer_email) = lower(trim(new.customer_email)) and archived_at is null
  for update;
  if not found then raise exception 'The original order ID and email could not be matched.'; end if;
  v_root_ref := coalesce(nullif(v_parent.linked_order_ref, ''), v_parent.order_ref);
  if upper(v_root_ref) <> upper(v_parent.order_ref) then
    select * into v_parent from public.orders where upper(order_ref) = upper(v_root_ref) for update;
  end if;
  if not public.order_can_accept_add_on(v_parent.status) then
    raise exception 'This order has already entered printing and cannot accept add-ons.';
  end if;

  new.linked_order_ref := v_root_ref;
  new.linked_at := now();
  new.collection_method := v_parent.collection_method;
  new.delivery_address := v_parent.delivery_address;
  new.pickup_scheduled_date := v_parent.pickup_scheduled_date;
  new.pickup_time_range := v_parent.pickup_time_range;
  new.delivery_fee := 0;
  return new;
end;
$$;

notify pgrst, 'reload schema';
