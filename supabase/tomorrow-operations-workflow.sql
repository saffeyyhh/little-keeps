-- Little Keeps: focused operations workflow for urgent production days.
-- Run once in the Supabase SQL editor after production-workflow.sql.

create table if not exists public.workshop_notes (
  id integer primary key check (id = 1),
  content text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.workshop_notes (id, content)
values (1, '')
on conflict (id) do nothing;

alter table public.workshop_notes enable row level security;
drop policy if exists "Authenticated users manage workshop notes"
  on public.workshop_notes;
create policy "Authenticated users manage workshop notes"
  on public.workshop_notes
  for all to authenticated
  using (true)
  with check (true);

create table if not exists public.printers (
  id text primary key,
  name text not null,
  status text not null default 'online'
    check (status in ('online', 'offline', 'maintenance')),
  issue_notes text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.printers (id, name, status, issue_notes)
values
  ('a1-mini-1', 'Whimsy Daisy · A1 1', 'online', ''),
  (
    'a1-mini-2',
    'Little Keeps · A1 2',
    'offline',
    'Printer down — inspect print quality before returning it to service.'
  )
on conflict (id) do update
set name = excluded.name;

alter table public.printers enable row level security;
drop policy if exists "Authenticated users manage printers"
  on public.printers;
create policy "Authenticated users manage printers"
  on public.printers
  for all to authenticated
  using (true)
  with check (true);

alter table public.production_jobs
  add column if not exists printer_id text references public.printers(id)
    on update cascade on delete set null,
  add column if not exists quality_status text not null default 'ok',
  add column if not exists issue_notes text not null default '';

alter table public.production_jobs
  drop constraint if exists production_jobs_quality_status_check;
alter table public.production_jobs
  add constraint production_jobs_quality_status_check
  check (quality_status in ('ok', 'failed', 'reprint_needed'));

create index if not exists production_jobs_printer_idx
  on public.production_jobs (printer_id, stage);
create index if not exists production_jobs_quality_idx
  on public.production_jobs (quality_status, stage);

alter table public.orders
  add column if not exists assembly_progress jsonb not null default
    '{"base_connected":false,"letters_caps_assembled":false,"keyring_added":false,"qc_done":false,"packed":false}'::jsonb,
  add column if not exists special_instructions text,
  add column if not exists handoff_name text,
  add column if not exists handoff_relationship text,
  add column if not exists handoff_phone text,
  add column if not exists handoff_notes text,
  add column if not exists production_notes text not null default '',
  add column if not exists rework_required boolean not null default false,
  add column if not exists rework_reason text,
  add column if not exists rework_requested_at timestamptz,
  add column if not exists rework_resolved_at timestamptz,
  add column if not exists revision_number integer not null default 1,
  add column if not exists update_needs_review boolean not null default false,
  add column if not exists update_summary text,
  add column if not exists update_reviewed_at timestamptz;

create or replace function public.order_production_signature(p_order_data jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      item
        - 'assembly_completed'
        - 'assembly_completed_at'
        - 'base_inventory_deducted'
        - 'keycap_inventory_deducted'
        - 'hardware_inventory_deducted'
        - 'rework_required'
        - 'rework_reason'
        - 'rework_requested_at'
      order by ordinal
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(
    case
      when jsonb_typeof(p_order_data) = 'array' then p_order_data
      else '[]'::jsonb
    end
  ) with ordinality as entries(item, ordinal);
$$;

create or replace function public.flag_order_production_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_old_count integer;
  v_new_count integer;
begin
  if public.order_production_signature(old.order_data::jsonb)
    is distinct from public.order_production_signature(new.order_data::jsonb)
  then
    v_old_count := jsonb_array_length(
      public.order_production_signature(old.order_data::jsonb)
    );
    v_new_count := jsonb_array_length(
      public.order_production_signature(new.order_data::jsonb)
    );

    new.revision_number := coalesce(old.revision_number, 1) + 1;
    new.update_needs_review := true;
    new.update_reviewed_at := null;
    new.update_summary := format(
      'Order items changed from %s to %s keychain(s). Production quantities were recalculated from the latest order.',
      v_old_count,
      v_new_count
    );
  end if;

  return new;
end;
$$;

drop trigger if exists flag_order_production_update_trigger
  on public.orders;
create trigger flag_order_production_update_trigger
before update of order_data on public.orders
for each row
execute function public.flag_order_production_update();

create index if not exists orders_update_needs_review_idx
  on public.orders (update_needs_review, needed_by)
  where update_needs_review = true;

create index if not exists orders_rework_required_idx
  on public.orders (rework_required, needed_by)
  where rework_required = true;

create or replace function public.reopen_order_keychain_for_rework(
  p_order_id text,
  p_item_index integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_now timestamptz := now();
  v_reason text := nullif(trim(p_reason), '');
begin
  if p_item_index < 0 then
    raise exception 'Invalid keychain index';
  end if;

  select *
  into v_order
  from public.orders
  where id::text = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if jsonb_typeof(v_order.order_data::jsonb) <> 'array'
    or jsonb_array_length(v_order.order_data::jsonb) <= p_item_index
  then
    raise exception 'Keychain not found';
  end if;

  v_item := v_order.order_data::jsonb -> p_item_index;

  update public.orders
  set
    order_data = jsonb_set(
      v_order.order_data::jsonb,
      array[p_item_index::text],
      v_item || jsonb_build_object(
        'assembly_completed', false,
        'assembly_completed_at', null,
        'rework_required', true,
        'rework_reason', coalesce(v_reason, 'Packing quality check'),
        'rework_requested_at', v_now
      ),
      false
    ),
    assembly_progress =
      coalesce(v_order.assembly_progress, '{}'::jsonb) ||
      '{"qc_done":false,"packed":false}'::jsonb,
    status = 'Printing',
    status_updated_at = v_now,
    rework_required = true,
    rework_reason = coalesce(v_reason, 'Packing quality check'),
    rework_requested_at = v_now,
    rework_resolved_at = null,
    production_notes = concat_ws(
      E'\n',
      nullif(trim(v_order.production_notes), ''),
      format(
        '[%s] Rework: %s — %s',
        to_char(v_now at time zone 'Asia/Singapore', 'DD Mon HH24:MI'),
        coalesce(v_item ->> 'name', 'Keychain'),
        coalesce(v_reason, 'Packing quality check')
      )
    )
  where id::text = p_order_id;
end;
$$;

revoke all
  on function public.reopen_order_keychain_for_rework(text, integer, text)
  from public;
grant execute
  on function public.reopen_order_keychain_for_rework(text, integer, text)
  to authenticated;
