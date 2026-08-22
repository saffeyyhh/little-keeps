-- Public-safe storefront sales count. Returns only aggregate product units,
-- never customer or order details.

create or replace function public.get_product_units_sold(
  p_product_key text default 'modular-clicky-keychain'
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case
      when coalesce(item.value ->> 'product_key', 'modular-clicky-keychain') = p_product_key
      then greatest(
        1,
        case
          when coalesce(item.value ->> 'quantity', '') ~ '^[0-9]+$'
          then (item.value ->> 'quantity')::integer
          else 1
        end
      )
      else 0
    end
  ), 0)::bigint
  from public.orders as order_row
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(coalesce(order_row.order_data::jsonb, '[]'::jsonb)) = 'array'
      then coalesce(order_row.order_data::jsonb, '[]'::jsonb)
      else '[]'::jsonb
    end
  ) as item(value)
  where (
    order_row.payment_type = 'Paid'
    or order_row.online_payment_status = 'completed'
  )
  and coalesce(order_row.status, '') not in (
    'Cancelled',
    'Rejected',
    'Payment Failed',
    'Payment Expired',
    'Refunded'
  );
$$;

revoke all on function public.get_product_units_sold(text) from public;
grant execute on function public.get_product_units_sold(text) to anon, authenticated;

comment on function public.get_product_units_sold(text) is
  'Returns a public-safe aggregate count of paid, non-refunded product units.';
