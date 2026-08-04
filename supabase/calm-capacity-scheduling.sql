-- Little Keeps: calm production capacity.
-- Two orders per production day, followed by one protected buffer/rest day.
-- The repeating cycle begins on Monday, 3 August 2026.

update public.shop_settings
set
  max_orders_per_date = 2,
  large_order_quantity = 7,
  standard_min_working_days = 2,
  standard_max_working_days = 3,
  large_min_working_days = 4,
  large_max_working_days = 5
where id = 1;

create or replace function public.check_needed_by_date(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := 2;
  v_order_count integer := 0;
begin
  if p_date is null then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'Please choose a date.'
    );
  end if;

  if mod(p_date - date '2026-08-03', 2) <> 0 then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'This is a protected rest and production buffer day.'
    );
  end if;

  if extract(isodow from p_date) in (6, 7) then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'Website production slots are available on weekdays.'
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
        when v_order_count < v_limit then 'Production slot available.'
        else 'Both production slots are already booked.'
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

grant execute on function public.check_needed_by_date(date)
to anon, authenticated;

grant execute on function public.get_unavailable_needed_by_dates(date, date)
to anon, authenticated;
