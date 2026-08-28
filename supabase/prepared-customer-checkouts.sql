-- Little Keeps: admin-prepared customer checkout links.
-- Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.prepared_checkouts (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cart_data jsonb not null,
  discount_type text not null default 'none',
  discount_value numeric(10,2) not null default 0,
  discount_label text not null default '',
  expires_at timestamptz not null default (now() + interval '7 days'),
  claimed_at timestamptz,
  claimed_order_ref text,
  created_at timestamptz not null default now(),
  constraint prepared_checkouts_discount_type_check
    check (discount_type in ('none', 'percent', 'fixed')),
  constraint prepared_checkouts_discount_value_check
    check (discount_value >= 0 and (discount_type <> 'percent' or discount_value <= 100))
);

alter table public.prepared_checkouts add column if not exists claimed_at timestamptz;
alter table public.prepared_checkouts add column if not exists claimed_order_ref text;

alter table public.prepared_checkouts enable row level security;

revoke all on table public.prepared_checkouts from anon;
grant insert, select on table public.prepared_checkouts to authenticated;

drop policy if exists "Admins create prepared checkouts" on public.prepared_checkouts;
create policy "Admins create prepared checkouts"
  on public.prepared_checkouts for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Admins view their prepared checkouts" on public.prepared_checkouts;
create policy "Admins view their prepared checkouts"
  on public.prepared_checkouts for select
  to authenticated
  using (created_by = auth.uid());

create or replace function public.get_prepared_checkout(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'cart_data', cart_data,
    'discount_type', discount_type,
    'discount_value', discount_value,
    'discount_label', discount_label,
    'expires_at', expires_at
  )
  from public.prepared_checkouts
  where token = p_token
    and expires_at > now()
    and claimed_at is null
  limit 1;
$$;

revoke all on function public.get_prepared_checkout(uuid) from public;
grant execute on function public.get_prepared_checkout(uuid) to anon, authenticated;

create or replace function public.claim_prepared_checkout(p_token uuid, p_order_ref text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.prepared_checkouts
  set claimed_at = now(), claimed_order_ref = upper(trim(p_order_ref))
  where token = p_token
    and expires_at > now()
    and claimed_at is null;
  return found;
end;
$$;

revoke all on function public.claim_prepared_checkout(uuid, text) from public;
grant execute on function public.claim_prepared_checkout(uuid, text) to anon, authenticated;

create index if not exists prepared_checkouts_expires_at_idx
  on public.prepared_checkouts (expires_at);
