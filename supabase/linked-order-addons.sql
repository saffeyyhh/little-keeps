-- Little Keeps: securely link customer add-ons to an existing public order.
-- Add-ons keep their own internal payment row while sharing the original
-- public order reference and latest production / dispatch date.

alter table public.orders
  add column if not exists linked_order_ref text,
  add column if not exists linked_at timestamptz,
  add column if not exists link_email_sent_at timestamptz,
  add column if not exists original_needed_by date,
  add column if not exists original_estimated_ready_to date;

create index if not exists orders_linked_order_ref_idx
on public.orders (linked_order_ref);

create or replace function public.order_can_accept_add_on(p_status text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_status, '') not in (
    'Printing',
    'Assembly Complete',
    'Ready for Pickup/Delivery',
    'Out for Delivery',
    'Completed',
    'Refunded',
    'Cancelled',
    'Rejected',
    'Payment Failed',
    'Payment Expired'
  );
$$;

create or replace function public.sync_linked_order_dates(p_root_ref text)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_latest_date date;
begin
  select max(coalesce(original_needed_by, needed_by)::date)
  into v_latest_date
  from public.orders
  where upper(order_ref) = upper(p_root_ref)
     or upper(coalesce(linked_order_ref, '')) = upper(p_root_ref);

  if v_latest_date is null then
    return null;
  end if;

  update public.orders
  set
    needed_by = v_latest_date,
    estimated_ready_to = v_latest_date
  where upper(order_ref) = upper(p_root_ref)
     or upper(coalesce(linked_order_ref, '')) = upper(p_root_ref);

  return v_latest_date;
end;
$$;

create or replace function public.verify_add_on_order(
  p_order_ref text,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_root_ref text;
begin
  select *
  into v_order
  from public.orders
  where upper(order_ref) = upper(trim(p_order_ref))
    and lower(customer_email) = lower(trim(p_email))
    and archived_at is null
  limit 1;

  if not found then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'We could not match that order ID and email.'
    );
  end if;

  v_root_ref := coalesce(nullif(v_order.linked_order_ref, ''), v_order.order_ref);

  select *
  into v_order
  from public.orders
  where upper(order_ref) = upper(v_root_ref)
  limit 1;

  if not public.order_can_accept_add_on(v_order.status) then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'This order has already entered printing and can no longer accept add-ons.'
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'order_ref', v_root_ref,
    'collection_method', v_order.collection_method,
    'latest_date', v_order.needed_by
  );
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
  new.original_estimated_ready_to := coalesce(
    new.original_estimated_ready_to,
    new.estimated_ready_to::date
  );

  if nullif(trim(new.linked_order_ref), '') is null then
    return new;
  end if;

  select *
  into v_parent
  from public.orders
  where upper(order_ref) = upper(trim(new.linked_order_ref))
    and lower(customer_email) = lower(trim(new.customer_email))
    and archived_at is null
  for update;

  if not found then
    raise exception 'The original order ID and email could not be matched.';
  end if;

  v_root_ref := coalesce(nullif(v_parent.linked_order_ref, ''), v_parent.order_ref);

  if upper(v_root_ref) <> upper(v_parent.order_ref) then
    select *
    into v_parent
    from public.orders
    where upper(order_ref) = upper(v_root_ref)
    for update;
  end if;

  if not public.order_can_accept_add_on(v_parent.status) then
    raise exception 'This order has already entered printing and cannot accept add-ons.';
  end if;

  update public.orders
  set
    original_needed_by = coalesce(original_needed_by, needed_by::date),
    original_estimated_ready_to = coalesce(
      original_estimated_ready_to,
      estimated_ready_to::date
    )
  where id = v_parent.id;

  new.linked_order_ref := v_root_ref;
  new.linked_at := now();
  new.collection_method := v_parent.collection_method;
  new.delivery_address := v_parent.delivery_address;

  return new;
end;
$$;

create or replace function public.finish_linked_order_add_on()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(new.linked_order_ref, '') is not null then
    perform public.sync_linked_order_dates(new.linked_order_ref);
  end if;
  return new;
end;
$$;

drop trigger if exists prepare_linked_order_add_on_trigger
on public.orders;
create trigger prepare_linked_order_add_on_trigger
before insert on public.orders
for each row execute function public.prepare_linked_order_add_on();

drop trigger if exists finish_linked_order_add_on_trigger
on public.orders;
create trigger finish_linked_order_add_on_trigger
after insert on public.orders
for each row execute function public.finish_linked_order_add_on();

create or replace function public.admin_link_order_add_on(
  p_child_id text,
  p_parent_order_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_child public.orders%rowtype;
  v_parent public.orders%rowtype;
  v_root_ref text;
  v_latest_date date;
begin
  select * into v_child
  from public.orders
  where id::text = p_child_id
  for update;

  select * into v_parent
  from public.orders
  where upper(order_ref) = upper(trim(p_parent_order_ref))
    and archived_at is null
  for update;

  if v_child.id is null or v_parent.id is null then
    raise exception 'The add-on or original order could not be found.';
  end if;

  if nullif(v_child.linked_order_ref, '') is not null then
    raise exception 'This order is already linked to another order.';
  end if;

  v_root_ref := coalesce(nullif(v_parent.linked_order_ref, ''), v_parent.order_ref);

  if v_child.id = v_parent.id then
    raise exception 'An order cannot be linked to itself.';
  end if;

  if exists (
    select 1
    from public.orders
    where upper(coalesce(linked_order_ref, '')) = upper(v_child.order_ref)
  ) then
    raise exception 'This order already has add-ons. Unlink them before moving the whole order.';
  end if;

  if not public.order_can_accept_add_on(v_child.status)
    or not public.order_can_accept_add_on(v_parent.status)
  then
    raise exception 'Only orders that have not entered printing can be linked.';
  end if;

  update public.orders
  set
    original_needed_by = coalesce(original_needed_by, needed_by::date),
    original_estimated_ready_to = coalesce(original_estimated_ready_to, estimated_ready_to::date)
  where id in (v_child.id, v_parent.id);

  update public.orders
  set
    linked_order_ref = v_root_ref,
    linked_at = now(),
    collection_method = v_parent.collection_method,
    delivery_address = v_parent.delivery_address
  where id = v_child.id;

  v_latest_date := public.sync_linked_order_dates(v_root_ref);

  return jsonb_build_object(
    'ok', true,
    'order_ref', v_root_ref,
    'latest_date', v_latest_date
  );
end;
$$;

create or replace function public.admin_unlink_order_add_on(p_child_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_child public.orders%rowtype;
  v_root_ref text;
begin
  select * into v_child
  from public.orders
  where id::text = p_child_id
  for update;

  if v_child.id is null or nullif(v_child.linked_order_ref, '') is null then
    raise exception 'This order is not currently linked.';
  end if;

  v_root_ref := v_child.linked_order_ref;

  update public.orders
  set
    needed_by = coalesce(original_needed_by, needed_by::date),
    estimated_ready_to = coalesce(original_estimated_ready_to, estimated_ready_to::date),
    linked_order_ref = null,
    linked_at = null,
    link_email_sent_at = null
  where id = v_child.id;

  perform public.sync_linked_order_dates(v_root_ref);

  return jsonb_build_object('ok', true, 'order_ref', v_root_ref);
end;
$$;

grant execute on function public.verify_add_on_order(text, text)
to anon, authenticated;

grant execute on function public.admin_link_order_add_on(text, text)
to authenticated;

grant execute on function public.admin_unlink_order_add_on(text)
to authenticated;
