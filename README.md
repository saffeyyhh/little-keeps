# Little Keeps

Vite storefront and workshop admin for Little Keeps.

## Photo Keepsake launch checklist

The Photo Keepsake card intentionally remains `coming_soon` until the private AI workflow is ready.

1. Run `supabase/photo-keepsake-studio.sql` in the production Supabase project.
2. Add the `OPENAI_API_KEY`, `PHOTO_RATE_LIMIT_SALT`, and `PHOTO_CLEANUP_SECRET` Edge Function secrets. Optionally set `OPENAI_IMAGE_MODEL`; the safe default is `gpt-image-1.5`.
3. Deploy `generate-photo-keepsake` and `cleanup-photo-artwork` with JWT verification enabled.
4. Store the cleanup secret in Supabase Vault as `photo_cleanup_secret`, then run `supabase/photo-keepsake-cleanup-cron.sql`. The scheduled job runs daily at 11:15 a.m. Singapore time.
5. Test a person, pet, and object photo; verify the artwork manually in the slicer and test both classic and clicker samples.
6. Set `ai-photo-keepsake` to `active` and make its price visible in Admin only after the physical samples pass.

Customer uploads are stored in the private `customer-artwork` bucket and expire after 30 days. Never expose the OpenAI or Supabase service-role keys in browser code.
