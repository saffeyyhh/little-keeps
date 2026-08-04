-- Little Keeps: revised checkout fulfilment and rush capacity.
-- Run this file once in the Supabase SQL Editor after the earlier scheduling files.

alter table public.orders
  add column if not exists pickup_scheduled_date date,
  add column if not exists pickup_time_range text;

create or replace function public.check_rush_order_date(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_count integer := 0;
  v_rush_count integer := 0;
begin
  if p_date is null or p_date <= current_date then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'Please choose a future date.'
    );
  end if;

  if exists (
    select 1
    from public.shop_closures
    where p_date between start_date and end_date
  ) then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'The shop is closed on this date.'
    );
  end if;

  if exists (
    select 1
    from public.orders
    where archived_at is null
      and order_type = 'bulk'
      and coalesce(status, '') not in (
        'Cancelled',
        'Rejected',
        'Payment Failed',
        'Payment Expired'
      )
      and p_date between
        (coalesce(requested_completion_date, needed_by)::date - 1)
        and
        (coalesce(requested_completion_date, needed_by)::date + 1)
  ) then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'This date is reserved for a bulk production window.'
    );
  end if;

  select
    count(*),
    count(*) filter (where order_type = 'rush')
  into v_order_count, v_rush_count
  from public.orders
  where archived_at is null
    and coalesce(status, '') not in (
      'Cancelled',
      'Rejected',
      'Payment Failed',
      'Payment Expired'
    )
    and coalesce(requested_completion_date, needed_by)::date = p_date;

  if v_rush_count > 0 then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'The rush slot for this date is already booked.',
      'orders', v_order_count,
      'rush_orders', v_rush_count
    );
  end if;

  return jsonb_build_object(
    'allowed', v_order_count <= 2,
    'reason',
      case
        when v_order_count = 2 then 'The additional rush slot is available.'
        when v_order_count < 2 then 'Rush capacity is available.'
        else 'Rush capacity is full for this date.'
      end,
    'orders', v_order_count,
    'rush_orders', v_rush_count
  );
end;
$$;

create or replace function public.assess_rush_order(
  p_requested_date date,
  p_keychain_count integer,
  p_character_count integer,
  p_needs jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_fee numeric := 0;
begin
  v_result := public.check_rush_order_date(p_requested_date);

  select case
    when greatest(1, coalesce(p_keychain_count, 1)) <= 4
      then coalesce(rush_fee_small, 5)
    else coalesce(rush_fee_large, 8)
  end
  into v_fee
  from public.shop_settings
  where id = 1;

  v_fee := coalesce(v_fee, case when coalesce(p_keychain_count, 1) <= 4 then 5 else 8 end);

  return v_result || jsonb_build_object(
    'status', case
      when coalesce((v_result ->> 'allowed')::boolean, false) then 'available'
      else 'unavailable'
    end,
    'fee', v_fee
  );
end;
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
begin
  if coalesce(new.order_source, 'Website') <> 'Website' then
    return new;
  end if;

  v_date := coalesce(
    new.requested_completion_date,
    new.needed_by
  )::date;

  if new.order_type = 'bulk' then
    for v_lock_date in
      select day_value::date
      from generate_series(v_date - 1, v_date + 1, interval '1 day') day_value
      order by day_value
    loop
      perform pg_advisory_xact_lock(
        hashtext('little-keeps-booking-' || v_lock_date::text)
      );
    end loop;

    v_result := public.check_bulk_order_date(v_date);
  elsif new.order_type = 'rush' then
    perform pg_advisory_xact_lock(
      hashtext('little-keeps-booking-' || v_date::text)
    );

    v_result := public.check_rush_order_date(v_date);
  else
    perform pg_advisory_xact_lock(
      hashtext('little-keeps-booking-' || v_date::text)
    );

    v_result := public.check_needed_by_date(v_date);
  end if;

  if not coalesce((v_result ->> 'allowed')::boolean, false) then
    raise exception '%', coalesce(
      v_result ->> 'reason',
      'This booking date is no longer available.'
    );
  end if;

  if coalesce(new.collection_method, '') <> 'delivery'
    and new.linked_order_ref is null then
    if new.pickup_scheduled_date is null or nullif(trim(new.pickup_time_range), '') is null then
      raise exception 'Please choose a pickup date and time.';
    end if;

    if new.pickup_scheduled_date < v_date then
      raise exception 'Pickup must be on or after the estimated completion date.';
    end if;

    v_pickup_day := extract(isodow from new.pickup_scheduled_date);
    if v_pickup_day not in (3, 5, 6, 7) then
      raise exception 'Pickup is available on Wednesdays, Fridays, and weekends.';
    end if;

    if v_pickup_day in (3, 5) and new.pickup_time_range not in (
      '7:00 PM - 7:30 PM',
      '7:30 PM - 8:00 PM',
      '8:00 PM - 8:30 PM'
    ) then
      raise exception 'Wednesday and Friday pickup is available after 7pm.';
    end if;

    if v_pickup_day in (6, 7) and new.pickup_time_range not in (
      '10:00 AM - 12:00 PM',
      '2:00 PM - 4:00 PM',
      '7:00 PM - 8:00 PM'
    ) then
      raise exception 'Please choose an available weekend pickup time.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_website_order_booking_trigger
on public.orders;

create trigger validate_website_order_booking_trigger
before insert on public.orders
for each row
execute function public.validate_website_order_booking();

grant execute on function public.check_rush_order_date(date)
to anon, authenticated;

grant execute on function public.assess_rush_order(date, integer, integer, jsonb)
to anon, authenticated;
