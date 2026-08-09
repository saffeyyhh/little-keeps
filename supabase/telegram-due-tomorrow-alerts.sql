-- Run once in Supabase SQL Editor, then redeploy telegram-new-order.
-- Prevents repeated due-tomorrow Telegram alerts when Admin refreshes.

alter table public.orders
  add column if not exists telegram_due_tomorrow_notified_at timestamptz;

create index if not exists orders_due_tomorrow_telegram_idx
  on public.orders (needed_by, telegram_due_tomorrow_notified_at)
  where telegram_due_tomorrow_notified_at is null;
