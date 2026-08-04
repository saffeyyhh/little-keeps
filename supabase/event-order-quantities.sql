-- Event-order quantity policy used by the storefront.
-- The storefront keeps one design line and expands it into individual
-- production items when the order is saved, so existing admin workflows
-- continue to count every physical keychain correctly.

update public.shop_settings
set
  bulk_order_quantity = 15,
  updated_at = now()
where id = 1;
