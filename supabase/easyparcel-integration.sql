-- EasyParcel OAuth, fulfilment settings and shipment tracking.

alter table public.shop_settings
  add column if not exists easyparcel_settings jsonb not null default '{
    "sender_name": "",
    "sender_company": "Little Keeps",
    "sender_phone": "",
    "sender_email": "",
    "sender_address_1": "",
    "sender_address_2": "",
    "sender_postcode": "",
    "sender_city": "Singapore",
    "default_weight": 0.5,
    "default_length": 20,
    "default_width": 15,
    "default_height": 8
  }'::jsonb;

alter table public.orders
  add column if not exists easyparcel_order_number text,
  add column if not exists easyparcel_shipment_number text,
  add column if not exists easyparcel_service_id text,
  add column if not exists easyparcel_courier_name text,
  add column if not exists easyparcel_amount numeric(10,2),
  add column if not exists easyparcel_currency text,
  add column if not exists easyparcel_awb_url text,
  add column if not exists easyparcel_status text,
  add column if not exists easyparcel_booked_at timestamptz,
  add column if not exists easyparcel_last_event_at timestamptz;

create index if not exists orders_easyparcel_shipment_number_idx
  on public.orders (easyparcel_shipment_number)
  where easyparcel_shipment_number is not null;

create table if not exists public.easyparcel_connections (
  id text primary key default 'primary',
  environment text not null default 'sandbox',
  oauth_state text,
  oauth_state_expires_at timestamptz,
  access_token text,
  refresh_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.easyparcel_connections enable row level security;
revoke all on public.easyparcel_connections from anon, authenticated;

