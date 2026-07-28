-- Little Keeps automatic bulk scheduling
-- Run this entire file once in the Supabase SQL Editor.

drop function if exists public.get_unavailable_needed_by_dates(date, date);
drop function if exists public.get_unavailable_bulk_dates(date, date);
drop function if exists public.check_needed_by_date(date);
drop function if exists public.check_bulk_order_date(date);

create or replace function public.check_needed_by_date(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := 5;
  v_order_count integer := 0;
begin
  if p_date is null then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'Please choose a date.'
    );
  end if;

  select greatest(
    1,
    coalesce(
      (
        select max_orders_per_date
        from public.shop_settings
        where id = 1
      ),
      5
    )
  )
  into v_limit;

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

  -- A confirmed or pending bulk booking protects its completion date
  -- and one day on either side from normal website orders.
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
      'reason', 'This date is reserved around a bulk order.'
    );
  end if;

  select count(*)
  into v_order_count
  from public.orders
  where archived_at is null
    and coalesce(status, '') not in (
      'Cancelled',
      'Rejected',
      'Payment Failed',
      'Payment Expired'
    )
    and coalesce(requested_completion_date, needed_by)::date = p_date;

  return jsonb_build_object(
    'allowed', v_order_count < v_limit,
    'reason',
      case
        when v_order_count < v_limit then 'Date available.'
        else 'This date is fully booked.'
      end,
    'orders', v_order_count,
    'limit', v_limit
  );
end;
$$;

create or replace function public.get_unavailable_needed_by_dates(
  p_start date,
  p_end date
)
returns table (unavailable_date date)
language sql
security definer
set search_path = public
as $$
  select day_value::date
  from generate_series(p_start, p_end, interval '1 day') as day_value
  where not coalesce(
    (public.check_needed_by_date(day_value::date) ->> 'allowed')::boolean,
    false
  );
$$;

create or replace function public.check_bulk_order_date(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_date is null then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'Please choose a date.'
    );
  end if;

  if p_date < current_date + 7 then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'Bulk dates must be at least 7 days away.'
    );
  end if;

  if exists (
    select 1
    from public.shop_closures
    where daterange(start_date, end_date, '[]')
      && daterange(p_date - 1, p_date + 1, '[]')
  ) then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'This production window overlaps a shop closure.'
    );
  end if;

  if exists (
    select 1
    from public.orders
    where archived_at is null
      and coalesce(status, '') not in (
        'Cancelled',
        'Rejected',
        'Payment Failed',
        'Payment Expired'
      )
      and coalesce(requested_completion_date, needed_by)::date
        between p_date - 1 and p_date + 1
  ) then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'The day before, selected date, or day after already has an order.'
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'reason', 'Bulk date available.'
  );
end;
$$;

create or replace function public.get_unavailable_bulk_dates(
  p_start date,
  p_end date
)
returns table (unavailable_date date)
language sql
security definer
set search_path = public
as $$
  select day_value::date
  from generate_series(p_start, p_end, interval '1 day') as day_value
  where not coalesce(
    (public.check_bulk_order_date(day_value::date) ->> 'allowed')::boolean,
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
  v_lock_date date;
begin
  if coalesce(new.order_source, 'Website') <> 'Website' then
    return new;
  end if;

  v_date := coalesce(
    new.requested_completion_date,
    new.needed_by
  )::date;

  if new.order_type = 'bulk' then
    -- Lock all three protected dates so overlapping checkouts cannot
    -- reserve the same production window simultaneously.
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

  return new;
end;
$$;

drop trigger if exists validate_website_order_booking_trigger
on public.orders;

create trigger validate_website_order_booking_trigger
before insert on public.orders
for each row
execute function public.validate_website_order_booking();

grant execute on function public.check_needed_by_date(date)
to anon, authenticated;

grant execute on function public.get_unavailable_needed_by_dates(date, date)
to anon, authenticated;

grant execute on function public.check_bulk_order_date(date)
to anon, authenticated;

grant execute on function public.get_unavailable_bulk_dates(date, date)
to anon, authenticated;
