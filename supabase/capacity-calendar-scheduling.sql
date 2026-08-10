-- Little Keeps capacity-based scheduling
-- Run this entire file once in the Supabase SQL Editor.
-- Normal orders use a daily order limit. The adjustable buffer is
-- reserved around event orders only; there is no every-other-day restriction.

drop trigger if exists validate_website_order_booking_trigger on public.orders;
drop function if exists public.validate_website_order_booking();
drop function if exists public.get_unavailable_needed_by_dates(date, date);
drop function if exists public.get_unavailable_needed_by_dates(date, date, integer);
drop function if exists public.get_unavailable_bulk_dates(date, date);
drop function if exists public.get_unavailable_bulk_dates(date, date, integer);
drop function if exists public.check_needed_by_date(date);
drop function if exists public.check_needed_by_date(date, integer);
drop function if exists public.check_bulk_order_date(date);
drop function if exists public.check_bulk_order_date(date, integer);

create or replace function public.check_needed_by_date(
  p_date date,
  p_quantity integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_limit integer := 2;
  v_bulk_buffer integer := 1;
  v_order_count integer := 0;
  v_keychain_count integer := 0;
begin
  if p_date is null then
    return jsonb_build_object('allowed', false, 'reason', 'Please choose a date.');
  end if;

  if extract(isodow from p_date) in (6, 7) then
    return jsonb_build_object('allowed', false, 'reason', 'Production dates are available on weekdays.');
  end if;

  select
    greatest(1, coalesce(max_orders_per_date, 2)),
    greatest(0, coalesce((pickup_time_options ->> 'bulk_buffer_days')::integer, 1))
  into v_order_limit, v_bulk_buffer
  from public.shop_settings
  where id = 1;

  if exists (
    select 1 from public.shop_closures
    where p_date between start_date and end_date
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'The shop is closed on this date.');
  end if;

  if exists (
    select 1
    from public.orders
    where archived_at is null
      and order_type = 'bulk'
      and coalesce(status, '') not in ('Cancelled', 'Rejected', 'Payment Failed', 'Payment Expired', 'Refunded')
      and p_date between
        coalesce(requested_completion_date, needed_by)::date - v_bulk_buffer
        and coalesce(requested_completion_date, needed_by)::date + v_bulk_buffer
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'This date is protected around an event order.');
  end if;

  select
    count(*),
    coalesce(sum(jsonb_array_length(coalesce(order_data, '[]'::jsonb))), 0)
  into v_order_count, v_keychain_count
  from public.orders
  where archived_at is null
    and coalesce(status, '') not in ('Cancelled', 'Rejected', 'Payment Failed', 'Payment Expired', 'Refunded')
    and (
      case
        when order_type in ('rush', 'bulk') then coalesce(requested_completion_date, needed_by)::date
        else coalesce(estimated_ready_to, needed_by)::date
      end
    ) = p_date;

  return jsonb_build_object(
    'allowed',
      v_order_count + 1 <= v_order_limit,
    'reason', case
      when v_order_count + 1 > v_order_limit then 'The order slots for this date are full.'
      else 'Production slot available.'
    end,
    'orders', v_order_count,
    'order_limit', v_order_limit,
    'keychains', v_keychain_count
  );
end;
$$;

create or replace function public.get_unavailable_needed_by_dates(
  p_start date,
  p_end date,
  p_quantity integer default 1
)
returns table (unavailable_date date)
language sql
security definer
set search_path = public
as $$
  select day_value::date
  from generate_series(p_start, p_end, interval '1 day') day_value
  where not coalesce(
    (public.check_needed_by_date(day_value::date, p_quantity) ->> 'allowed')::boolean,
    false
  );
$$;

create or replace function public.check_bulk_order_date(
  p_date date,
  p_quantity integer default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buffer integer := 1;
  v_min_days integer := 7;
begin
  if p_date is null then
    return jsonb_build_object('allowed', false, 'reason', 'Please choose a date.');
  end if;

  v_min_days := case
    when p_quantity >= 151 then 30
    when p_quantity >= 101 then 20
    when p_quantity >= 76 then 15
    when p_quantity >= 30 then 10
    else 7
  end;

  select greatest(0, coalesce((pickup_time_options ->> 'bulk_buffer_days')::integer, 1))
  into v_buffer
  from public.shop_settings
  where id = 1;

  if p_date < current_date + v_min_days then
    return jsonb_build_object('allowed', false, 'reason', format('This event order needs at least %s days of lead time.', v_min_days));
  end if;

  if extract(isodow from p_date) in (6, 7) then
    return jsonb_build_object('allowed', false, 'reason', 'Event production dates are available on weekdays.');
  end if;

  if exists (
    select 1 from public.shop_closures
    where daterange(start_date, end_date, '[]')
      && daterange(p_date - v_buffer, p_date + v_buffer, '[]')
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'This event production window overlaps a shop closure.');
  end if;

  if exists (
    select 1 from public.orders
    where archived_at is null
      and coalesce(status, '') not in ('Cancelled', 'Rejected', 'Payment Failed', 'Payment Expired', 'Refunded')
      and (
        case
          when order_type in ('rush', 'bulk') then coalesce(requested_completion_date, needed_by)::date
          else coalesce(estimated_ready_to, needed_by)::date
        end
      ) between p_date - v_buffer and p_date + v_buffer
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'This event production window already contains an order.');
  end if;

  return jsonb_build_object('allowed', true, 'reason', 'Event date available.', 'buffer_days', v_buffer);
end;
$$;

create or replace function public.get_unavailable_bulk_dates(
  p_start date,
  p_end date,
  p_quantity integer default 15
)
returns table (unavailable_date date)
language sql
security definer
set search_path = public
as $$
  select day_value::date
  from generate_series(p_start, p_end, interval '1 day') day_value
  where not coalesce(
    (public.check_bulk_order_date(day_value::date, p_quantity) ->> 'allowed')::boolean,
    false
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
  v_quantity integer;
  v_buffer integer := 1;
  v_lock_date date;
begin
  if coalesce(new.order_source, 'Website') <> 'Website' then return new; end if;

  v_date := case
    when new.order_type in ('rush', 'bulk') then
      coalesce(new.requested_completion_date, new.needed_by)::date
    else
      coalesce(new.estimated_ready_to, new.needed_by)::date
  end;
  v_quantity := greatest(1, jsonb_array_length(coalesce(new.order_data, '[]'::jsonb)));

  if new.order_type = 'bulk' then
    select greatest(0, coalesce((pickup_time_options ->> 'bulk_buffer_days')::integer, 1))
    into v_buffer from public.shop_settings where id = 1;
    for v_lock_date in
      select day_value::date
      from generate_series(v_date - v_buffer, v_date + v_buffer, interval '1 day') day_value
      order by day_value
    loop
      perform pg_advisory_xact_lock(hashtext('little-keeps-booking-' || v_lock_date::text));
    end loop;
    v_result := public.check_bulk_order_date(v_date, v_quantity);
  else
    perform pg_advisory_xact_lock(hashtext('little-keeps-booking-' || v_date::text));
    v_result := public.check_needed_by_date(v_date, v_quantity);
  end if;

  if not coalesce((v_result ->> 'allowed')::boolean, false) then
    raise exception '%', coalesce(v_result ->> 'reason', 'This booking date is no longer available.');
  end if;
  return new;
end;
$$;

create trigger validate_website_order_booking_trigger
before insert on public.orders
for each row execute function public.validate_website_order_booking();

grant execute on function public.check_needed_by_date(date, integer) to anon, authenticated;
grant execute on function public.get_unavailable_needed_by_dates(date, date, integer) to anon, authenticated;
grant execute on function public.check_bulk_order_date(date, integer) to anon, authenticated;
grant execute on function public.get_unavailable_bulk_dates(date, date, integer) to anon, authenticated;
