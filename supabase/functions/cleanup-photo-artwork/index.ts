import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async request => {
  const expectedSecret = Deno.env.get("PHOTO_CLEANUP_SECRET");
  const suppliedSecret = request.headers.get("x-cleanup-secret");
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorised" }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: expired, error } = await supabase
    .from("photo_artwork_requests")
    .select("id, original_path, artwork_path")
    .neq("status", "deleted")
    .lt("expires_at", new Date().toISOString())
    .limit(100);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let deleted = 0;
  for (const row of expired || []) {
    const paths = [row.original_path, row.artwork_path].filter(Boolean);
    const { error: storageError } = await supabase.storage
      .from("customer-artwork")
      .remove(paths);
    if (storageError) continue;
    await supabase
      .from("photo_artwork_requests")
      .update({ status: "deleted" })
      .eq("id", row.id);
    deleted += 1;
  }

  return new Response(JSON.stringify({ deleted }), {
    headers: { "Content-Type": "application/json" }
  });
});
