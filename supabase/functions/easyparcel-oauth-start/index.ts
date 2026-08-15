import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = Deno.env.get("EASYPARCEL_CLIENT_ID");
  const redirectUri = Deno.env.get("EASYPARCEL_REDIRECT_URI");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !clientId || !redirectUri) {
    return json({ error: "EasyParcel is not configured yet." }, 503);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: request.headers.get("Authorization") || "" } }
  });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return json({ error: "Admin login required." }, 401);

  const state = crypto.randomUUID() + crypto.randomUUID();
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await serviceClient.from("easyparcel_connections").upsert({
    id: "primary",
    environment: Deno.env.get("EASYPARCEL_ENVIRONMENT") || "sandbox",
    oauth_state: state,
    oauth_state_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString()
  });
  if (error) return json({ error: "Unable to begin EasyParcel connection." }, 500);

  const url = new URL("https://api.easyparcel.com/oauth/login");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return json({ url: url.toString() });
});

