-- Little Keeps: prevent one checkout tap/retry from creating duplicate orders.
-- Run once in Supabase SQL Editor.

alter table public.orders
  add column if not exists client_submission_id uuid;

create unique index if not exists orders_client_submission_id_unique_idx
  on public.orders (client_submission_id)
  where client_submission_id is not null;

notify pgrst, 'reload schema';
