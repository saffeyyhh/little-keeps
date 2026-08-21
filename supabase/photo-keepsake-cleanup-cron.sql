-- Little Keeps: schedule private photo-artwork cleanup once per day.
-- Prerequisite: store PHOTO_CLEANUP_SECRET in Vault as photo_cleanup_secret.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'photo-artwork-daily-cleanup';

select cron.schedule(
  'photo-artwork-daily-cleanup',
  '15 3 * * *',
  'select net.http_post(
     url := ''https://jetamtthfenjyzcdklqm.supabase.co/functions/v1/cleanup-photo-artwork'',
     headers := jsonb_build_object(
       ''Content-Type'', ''application/json'',
       ''x-cleanup-secret'', (
         select decrypted_secret
         from vault.decrypted_secrets
         where name = ''photo_cleanup_secret''
         limit 1
       )
     ),
     body := ''{}''::jsonb
   );'
);
