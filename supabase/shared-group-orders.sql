-- Little Keeps: organiser-paid shared group orders.
-- Friends submit designs to a private share link. The organiser reviews the
-- combined basket and creates one normal paid order under one order reference.

create extension if not exists pgcrypto;

create table if not exists public.shared_group_orders (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique,
  title text not null,
  organiser_name text not null,
  organiser_email text not null,
  product_key text not null,
  share_token uuid not null unique,
  owner_token uuid not null unique,
  status text not null default 'open' check (status in ('open', 'finalised', 'cancelled')),
  final_order_ref text,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_group_contributions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.shared_group_orders(id) on delete cascade,
  contributor_name text not null,
  contribution_token uuid not null unique,
  items jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shared_group_contributions
  add column if not exists is_organiser boolean not null default false;

-- Older group orders were created before organiser contributions were labelled.
-- Their first contribution is the organiser's original basket.
with first_contribution as (
  select distinct on (group_id) id
  from public.shared_group_contributions
  order by group_id, created_at, id
)
update public.shared_group_contributions contribution
set is_organiser = true
from first_contribution
where contribution.id = first_contribution.id
  and not exists (
    select 1
    from public.shared_group_contributions existing
    where existing.group_id = contribution.group_id
      and existing.is_organiser
  );

create unique index if not exists shared_group_organiser_contribution_idx
  on public.shared_group_contributions (group_id)
  where is_organiser;

create index if not exists shared_group_contributions_group_idx
  on public.shared_group_contributions (group_id, created_at);

alter table public.shared_group_orders enable row level security;
alter table public.shared_group_contributions enable row level security;

revoke all on public.shared_group_orders from anon, authenticated;
revoke all on public.shared_group_contributions from anon, authenticated;

alter table public.orders
  add column if not exists group_order_code text;

create index if not exists orders_group_order_code_idx
  on public.orders (group_order_code)
  where group_order_code is not null;

create or replace function public.validate_shared_group_items(p_items jsonb)
returns boolean
language sql
immutable
as $$
  select case
    when jsonb_typeof(p_items) is distinct from 'array' then false
    else
      jsonb_array_length(p_items) between 1 and 50
      and octet_length(p_items::text) <= 150000
      and not exists (
        select 1
        from jsonb_array_elements(p_items) item
        where nullif(trim(item->>'name'), '') is null
           or length(item->>'name') > 80
           or jsonb_typeof(item->'design') is distinct from 'object'
           or not case
             when coalesce(item->>'quantity', '1') ~ '^[0-9]+$'
               then coalesce((item->>'quantity')::integer, 1) between 1 and 250
             else false
           end
      )
  end;
$$;

create or replace function public.create_shared_group_order(
  p_title text,
  p_organiser_name text,
  p_organiser_email text,
  p_product_key text,
  p_share_token uuid,
  p_owner_token uuid,
  p_contribution_token uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.shared_group_orders%rowtype;
  v_code text;
begin
  if nullif(trim(p_title), '') is null
     or nullif(trim(p_organiser_name), '') is null
     or p_organiser_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or nullif(trim(p_product_key), '') is null
     or not public.validate_shared_group_items(p_items)
     or exists (
       select 1 from jsonb_array_elements(p_items) item
       where item->>'product_key' <> p_product_key
     ) then
    raise exception 'Please provide valid group details and at least one design.';
  end if;

  v_code := 'LKG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.shared_group_orders (
    public_code, title, organiser_name, organiser_email, product_key,
    share_token, owner_token
  ) values (
    v_code,
    left(trim(p_title), 80),
    left(trim(p_organiser_name), 100),
    lower(trim(p_organiser_email)),
    left(trim(p_product_key), 80),
    p_share_token,
    p_owner_token
  ) returning * into v_group;

  insert into public.shared_group_contributions (
    group_id, contributor_name, contribution_token, items, is_organiser
  ) values (
    v_group.id,
    left(trim(p_organiser_name), 100),
    p_contribution_token,
    p_items,
    true
  );

  return jsonb_build_object(
    'ok', true,
    'public_code', v_group.public_code,
    'title', v_group.title,
    'share_token', v_group.share_token,
    'owner_token', v_group.owner_token,
    'status', v_group.status
  );
end;
$$;

create or replace function public.get_shared_group_order(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.shared_group_orders%rowtype;
  v_is_owner boolean;
  v_contributions jsonb;
begin
  select *
  into v_group
  from public.shared_group_orders
  where share_token = p_token or owner_token = p_token
  limit 1;

  if not found then return null; end if;
  v_is_owner := v_group.owner_token = p_token;

  if v_is_owner then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', contribution.id,
      'contributor_name', contribution.contributor_name,
      'is_organiser', contribution.is_organiser,
      'items', contribution.items,
      'created_at', contribution.created_at
    ) order by contribution.created_at), '[]'::jsonb)
    into v_contributions
    from public.shared_group_contributions contribution
    where contribution.group_id = v_group.id;
  end if;

  return jsonb_build_object(
    'public_code', v_group.public_code,
    'title', v_group.title,
    'organiser_name', v_group.organiser_name,
    'organiser_email', case when v_is_owner then v_group.organiser_email else null end,
    'product_key', v_group.product_key,
    'status', v_group.status,
    'final_order_ref', v_group.final_order_ref,
    'expires_at', v_group.expires_at,
    'is_owner', v_is_owner,
    'share_token', case when v_is_owner then v_group.share_token else null end,
    'contribution_count', (
      select count(*) from public.shared_group_contributions
      where group_id = v_group.id
    ),
    'item_count', (
      select coalesce(sum(jsonb_array_length(items)), 0)
      from public.shared_group_contributions
      where group_id = v_group.id
    ),
    'contributions', case when v_is_owner then v_contributions else null end
  );
end;
$$;

create or replace function public.save_shared_group_owner_contribution(
  p_owner_token uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.shared_group_orders%rowtype;
begin
  select * into v_group
  from public.shared_group_orders
  where owner_token = p_owner_token
  for update;

  if not found then raise exception 'This group order could not be found.'; end if;
  if v_group.status <> 'open' or v_group.expires_at <= now() then
    raise exception 'This group order can no longer be edited.';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Please provide a valid basket.';
  end if;

  if jsonb_array_length(p_items) = 0 then
    delete from public.shared_group_contributions
    where group_id = v_group.id and is_organiser;
  else
    if not public.validate_shared_group_items(p_items)
       or exists (
         select 1 from jsonb_array_elements(p_items) item
         where item->>'product_key' <> v_group.product_key
       ) then
      raise exception 'Please provide at least one valid design for this group.';
    end if;

    insert into public.shared_group_contributions (
      group_id, contributor_name, contribution_token, items, is_organiser
    ) values (
      v_group.id,
      v_group.organiser_name,
      gen_random_uuid(),
      p_items,
      true
    )
    on conflict (group_id) where is_organiser do update
    set contributor_name = excluded.contributor_name,
        items = excluded.items,
        updated_at = now();
  end if;

  update public.shared_group_orders
  set updated_at = now()
  where id = v_group.id;

  return jsonb_build_object(
    'ok', true,
    'public_code', v_group.public_code,
    'contribution_count', (
      select count(*) from public.shared_group_contributions where group_id = v_group.id
    ),
    'item_count', (
      select coalesce(sum(jsonb_array_length(items)), 0)
      from public.shared_group_contributions where group_id = v_group.id
    )
  );
end;
$$;

create or replace function public.save_shared_group_contribution(
  p_share_token uuid,
  p_contributor_name text,
  p_contribution_token uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.shared_group_orders%rowtype;
  v_contribution_id uuid;
begin
  select * into v_group
  from public.shared_group_orders
  where share_token = p_share_token
  for update;

  if not found then raise exception 'This shared order link is invalid.'; end if;
  if v_group.status <> 'open' or v_group.expires_at <= now() then
    raise exception 'This shared order is no longer accepting designs.';
  end if;
  if nullif(trim(p_contributor_name), '') is null
     or not public.validate_shared_group_items(p_items)
     or exists (
       select 1 from jsonb_array_elements(p_items) item
       where item->>'product_key' <> v_group.product_key
     ) then
    raise exception 'Please provide your name and at least one valid design.';
  end if;

  insert into public.shared_group_contributions (
    group_id, contributor_name, contribution_token, items
  ) values (
    v_group.id,
    left(trim(p_contributor_name), 100),
    p_contribution_token,
    p_items
  )
  on conflict (contribution_token) do update
  set contributor_name = excluded.contributor_name,
      items = excluded.items,
      updated_at = now()
  where public.shared_group_contributions.group_id = v_group.id
  returning id into v_contribution_id;

  if v_contribution_id is null then
    raise exception 'This contribution belongs to another shared order.';
  end if;

  update public.shared_group_orders set updated_at = now() where id = v_group.id;

  return jsonb_build_object(
    'ok', true,
    'public_code', v_group.public_code,
    'contribution_id', v_contribution_id,
    'contribution_count', (
      select count(*) from public.shared_group_contributions where group_id = v_group.id
    )
  );
end;
$$;

create or replace function public.remove_shared_group_contribution(
  p_owner_token uuid,
  p_contribution_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  select id into v_group_id
  from public.shared_group_orders
  where owner_token = p_owner_token and status = 'open';

  if v_group_id is null then raise exception 'The shared order cannot be edited.'; end if;

  delete from public.shared_group_contributions
  where id = p_contribution_id and group_id = v_group_id;

  return jsonb_build_object('ok', found);
end;
$$;

create or replace function public.finalise_shared_group_order(
  p_owner_token uuid,
  p_order_ref text,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.shared_group_orders%rowtype;
  v_order_exists boolean;
begin
  select * into v_group
  from public.shared_group_orders
  where owner_token = p_owner_token
  for update;

  if not found then raise exception 'The shared order could not be found.'; end if;
  if v_group.status <> 'open' then
    return jsonb_build_object('ok', true, 'already_finalised', true, 'order_ref', v_group.final_order_ref);
  end if;

  select exists(
    select 1 from public.orders
    where upper(order_ref) = upper(trim(p_order_ref))
      and lower(customer_email) = lower(trim(p_email))
      and group_order_code = v_group.public_code
  ) into v_order_exists;

  if not v_order_exists then raise exception 'The combined order could not be verified.'; end if;

  update public.shared_group_orders
  set status = 'finalised', final_order_ref = upper(trim(p_order_ref)), updated_at = now()
  where id = v_group.id;

  return jsonb_build_object('ok', true, 'order_ref', upper(trim(p_order_ref)));
end;
$$;

create or replace function public.cancel_shared_group_order(p_owner_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.shared_group_orders%rowtype;
begin
  select * into v_group
  from public.shared_group_orders
  where owner_token = p_owner_token
  for update;

  if not found then raise exception 'The group order could not be found.'; end if;
  if v_group.status = 'finalised' then
    raise exception 'This group has already been checked out and cannot be cancelled here.';
  end if;

  update public.shared_group_orders
  set status = 'cancelled', updated_at = now()
  where id = v_group.id;

  return jsonb_build_object(
    'ok', true,
    'public_code', v_group.public_code,
    'status', 'cancelled'
  );
end;
$$;

revoke all on function public.validate_shared_group_items(jsonb) from public;
revoke all on function public.create_shared_group_order(text, text, text, text, uuid, uuid, uuid, jsonb) from public;
revoke all on function public.get_shared_group_order(uuid) from public;
revoke all on function public.save_shared_group_contribution(uuid, text, uuid, jsonb) from public;
revoke all on function public.save_shared_group_owner_contribution(uuid, jsonb) from public;
revoke all on function public.remove_shared_group_contribution(uuid, uuid) from public;
revoke all on function public.finalise_shared_group_order(uuid, text, text) from public;
revoke all on function public.cancel_shared_group_order(uuid) from public;

grant execute on function public.create_shared_group_order(text, text, text, text, uuid, uuid, uuid, jsonb) to anon, authenticated;
grant execute on function public.get_shared_group_order(uuid) to anon, authenticated;
grant execute on function public.save_shared_group_contribution(uuid, text, uuid, jsonb) to anon, authenticated;
grant execute on function public.save_shared_group_owner_contribution(uuid, jsonb) to anon, authenticated;
grant execute on function public.remove_shared_group_contribution(uuid, uuid) to anon, authenticated;
grant execute on function public.finalise_shared_group_order(uuid, text, text) to anon, authenticated;
grant execute on function public.cancel_shared_group_order(uuid) to anon, authenticated;
