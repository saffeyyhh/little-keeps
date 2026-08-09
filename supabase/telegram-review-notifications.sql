-- Little Keeps: prevent duplicate Telegram alerts for bulk/rush review requests.
-- Run once in Supabase SQL Editor, then redeploy telegram-new-order.

alter table public.orders
  add column if not exists telegram_review_notified_at timestamptz;

create index if not exists orders_pending_telegram_review_idx
  on public.orders (created_at)
  where status in ('Rush Review', 'Bulk Review')
    and telegram_review_notified_at is null;

notify pgrst, 'reload schema';
