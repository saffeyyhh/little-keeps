-- Little Keeps: per-day capacity, pickup blackouts and bulk-buffer overrides.
-- Safe to run more than once.

alter table public.product_catalog
  add column if not exists minimum_working_days integer
    check (minimum_working_days is null or minimum_working_days >= 1),
  add column if not exists maximum_working_days integer
    check (maximum_working_days is null or maximum_working_days >= 1);

update public.product_catalog
set minimum_working_days = 4,
    maximum_working_days = 5
where product_key = 'ai-photo-keepsake';

create table if not exists public.schedule_day_overrides (
  date date primary key,
  max_orders integer check (max_orders is null or max_orders >= 0),
  pickup_unavailable boolean not null default false,
  ignore_bulk_buffer boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.schedule_day_overrides enable row level security;

drop policy if exists "Admins can view schedule day overrides"
  on public.schedule_day_overrides;
create policy "Admins can view schedule day overrides"
  on public.schedule_day_overrides for select to authenticated using (true);

drop policy if exists "Admins can add schedule day overrides"
  on public.schedule_day_overrides;
create policy "Admins can add schedule day overrides"
  on public.schedule_day_overrides for insert to authenticated with check (true);

drop policy if exists "Admins can update schedule day overrides"
  on public.schedule_day_overrides;
create policy "Admins can update schedule day overrides"
  on public.schedule_day_overrides for update to authenticated
  using (true) with check (true);

drop policy if exists "Admins can delete schedule day overrides"
  on public.schedule_day_overrides;
create policy "Admins can delete schedule day overrides"
  on public.schedule_day_overrides for delete to authenticated using (true);

grant select, insert, update, delete on public.schedule_day_overrides to authenticated;

create or replace function public.get_pickup_unavailable_dates(
  p_start date,
  p_end date
)
returns table (unavailable_date date)
language sql
security definer
set search_path = public
as $$
  select date
  from public.schedule_day_overrides
  where pickup_unavailable = true
    and date between p_start and p_end
  order by date;
$$;

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
  v_ignore_bulk_buffer boolean := false;
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

  select
    coalesce((select max_orders from public.schedule_day_overrides where date = p_date), v_order_limit),
    coalesce((select ignore_bulk_buffer from public.schedule_day_overrides where date = p_date), false)
  into v_order_limit, v_ignore_bulk_buffer
  ;

  if exists (
    select 1 from public.shop_closures
    where p_date between start_date and end_date
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'The shop is closed on this date.');
  end if;

  if not v_ignore_bulk_buffer and exists (
    select 1
    from public.orders
    where archived_at is null
      and order_type = 'bulk'
      and coalesce(status, '') not in ('Cancelled', 'Rejected', 'Payment Failed', 'Payment Expired', 'Refunded')
      and p_date between
        coalesce(requested_completion_date, needed_by)::date - v_bulk_buffer
        and coalesce(requested_completion_date, needed_by)::date + v_bulk_buffer
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'This date is protected around a bulk order.');
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
    'allowed', v_order_count + 1 <= v_order_limit,
    'reason', case
      when v_order_count + 1 > v_order_limit then 'The order slots for this date are full.'
      else 'Production slot available.'
    end,
    'orders', v_order_count,
    'order_limit', v_order_limit,
    'keychains', v_keychain_count,
    'day_override', exists (
      select 1 from public.schedule_day_overrides where date = p_date
    )
  );
end;
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
  v_ignore_bulk_buffer boolean := false;
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
  into v_buffer from public.shop_settings where id = 1;

  select coalesce((
    select ignore_bulk_buffer
    from public.schedule_day_overrides
    where date = p_date
  ), false)
  into v_ignore_bulk_buffer
  ;

  if p_date < current_date + v_min_days then
    return jsonb_build_object('allowed', false, 'reason', format('This bulk order needs at least %s days of lead time.', v_min_days));
  end if;

  if extract(isodow from p_date) in (6, 7) then
    return jsonb_build_object('allowed', false, 'reason', 'Bulk production dates are available on weekdays.');
  end if;

  if exists (
    select 1 from public.shop_closures
    where daterange(start_date, end_date, '[]')
      && daterange(p_date - v_buffer, p_date + v_buffer, '[]')
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'This bulk production window overlaps a shop closure.');
  end if;

  if not v_ignore_bulk_buffer and exists (
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
    return jsonb_build_object('allowed', false, 'reason', 'This bulk production window already contains an order.');
  end if;

  return jsonb_build_object(
    'allowed', true,
    'reason', case when v_ignore_bulk_buffer
      then 'Bulk date available using the admin override.'
      else 'Bulk date available.' end,
    'buffer_days', v_buffer,
    'day_override', v_ignore_bulk_buffer
  );
end;
$$;

create or replace function public.schedule_order_pickup(
  p_order_ref text,
  p_email text,
  p_pickup_date date,
  p_pickup_time_range text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pickup_options jsonb;
  v_slot_group text;
  v_pickup_day integer;
  v_updated integer := 0;
begin
  if p_pickup_date is null or nullif(trim(p_pickup_time_range), '') is null then
    return jsonb_build_object('ok', false, 'reason', 'Choose a pickup date and exact time.');
  end if;

  if p_pickup_date < current_date or p_pickup_date > current_date + 30 then
    return jsonb_build_object('ok', false, 'reason', 'Choose a pickup date within the next 30 days.');
  end if;

  v_pickup_day := extract(isodow from p_pickup_date);
  if v_pickup_day not in (3, 5, 6, 7) then
    return jsonb_build_object('ok', false, 'reason', 'Pickup is available on Wednesdays, Fridays, and weekends.');
  end if;

  if exists (
    select 1 from public.shop_closures
    where p_pickup_date between start_date and end_date
  ) or exists (
    select 1 from public.schedule_day_overrides
    where date = p_pickup_date and pickup_unavailable = true
  ) then
    return jsonb_build_object('ok', false, 'reason', 'Pickup is unavailable on this date.');
  end if;

  select pickup_time_options into v_pickup_options
  from public.shop_settings where id = 1;
  v_slot_group := case when v_pickup_day in (6, 7) then 'weekend' else 'weekday' end;

  if not exists (
    select 1
    from jsonb_array_elements_text(coalesce(v_pickup_options -> v_slot_group, '[]'::jsonb)) slot
    where slot = trim(p_pickup_time_range)
  ) then
    return jsonb_build_object('ok', false, 'reason', 'Choose one of the available pickup times.');
  end if;

  update public.orders
  set pickup_scheduled_date = p_pickup_date,
      pickup_time_range = trim(p_pickup_time_range),
      needed_by = case
        when p_pickup_date > coalesce(estimated_ready_to, needed_by)::date then p_pickup_date
        else needed_by
      end
  where archived_at is null
    and lower(customer_email) = lower(trim(p_email))
    and collection_method <> 'delivery'
    and (
      upper(order_ref) = upper(trim(p_order_ref))
      or upper(coalesce(linked_order_ref, '')) = upper(trim(p_order_ref))
    );

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'reason', 'This pickup order could not be found.');
  end if;

  return jsonb_build_object('ok', true, 'pickup_date', p_pickup_date,
    'pickup_time_range', trim(p_pickup_time_range));
end;
$$;

grant execute on function public.get_pickup_unavailable_dates(date, date) to anon, authenticated;
grant execute on function public.check_needed_by_date(date, integer) to anon, authenticated;
grant execute on function public.check_bulk_order_date(date, integer) to anon, authenticated;
grant execute on function public.schedule_order_pickup(text, text, date, text) to anon, authenticated;

notify pgrst, 'reload schema';
