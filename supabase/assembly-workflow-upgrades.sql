-- Little Keeps: partial base assembly tracking.
-- Run once in Supabase SQL Editor.

create or replace function public.complete_keychain_base_assembly(
  p_order_id text,
  p_item_index integer,
  p_needs jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_need record;
  v_quantity integer;
  v_now timestamptz := now();
begin
  if p_item_index < 0 then raise exception 'Invalid keychain index'; end if;

  select * into v_order
  from public.orders
  where id::text = p_order_id
  for update;
  if not found then raise exception 'Order not found'; end if;

  if jsonb_typeof(v_order.order_data::jsonb) <> 'array'
    or jsonb_array_length(v_order.order_data::jsonb) <= p_item_index then
    raise exception 'Keychain not found';
  end if;

  v_item := v_order.order_data::jsonb -> p_item_index;
  if coalesce((v_item ->> 'assembly_completed')::boolean, false) then
    raise exception 'Keychain is already complete';
  end if;
  if coalesce((v_item ->> 'base_assembled')::boolean, false) then
    raise exception 'Base is already assembled';
  end if;

  for v_need in select key, value from jsonb_each_text(coalesce(p_needs, '{}'::jsonb))
  loop
    v_quantity := greatest(0, v_need.value::integer);
    if v_quantity = 0 then continue; end if;

    update public.inventory_items
    set qty = qty - v_quantity, updated_at = v_now
    where item_name = v_need.key and qty >= v_quantity;

    if not found then
      raise exception 'Not enough inventory for %', v_need.key;
    end if;
  end loop;

  update public.orders
  set
    order_data = jsonb_set(
      v_order.order_data::jsonb,
      array[p_item_index::text],
      v_item || jsonb_build_object(
        'base_assembled', true,
        'base_assembled_at', v_now
      ),
      false
    ),
    assembly_progress = coalesce(v_order.assembly_progress, '{}'::jsonb) ||
      '{"base_connected":true}'::jsonb,
    status_updated_at = v_now
  where id::text = p_order_id;
end;
$$;

revoke all on function public.complete_keychain_base_assembly(text, integer, jsonb) from public;
grant execute on function public.complete_keychain_base_assembly(text, integer, jsonb) to authenticated;

notify pgrst, 'reload schema';
