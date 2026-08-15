import { createClient } from "npm:@supabase/supabase-js@2";

function redirect(message: string, ok = false) {
  const url = new URL("https://little-keeps.vercel.app/admin.html");
  url.searchParams.set("easyparcel", ok ? "connected" : "error");
  url.searchParams.set("message", message);
  return Response.redirect(url.toString(), 302);
}

Deno.serve(async request => {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  if (!code || !state) return redirect("EasyParcel did not return an authorization code.");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = Deno.env.get("EASYPARCEL_CLIENT_ID");
  const clientSecret = Deno.env.get("EASYPARCEL_CLIENT_SECRET");
  const redirectUri = Deno.env.get("EASYPARCEL_REDIRECT_URI");
  if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret || !redirectUri) {
    return redirect("EasyParcel server settings are incomplete.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: connection } = await supabase
    .from("easyparcel_connections")
    .select("oauth_state, oauth_state_expires_at")
    .eq("id", "primary")
    .maybeSingle();
  const stateExpired = !connection?.oauth_state_expires_at ||
    new Date(connection.oauth_state_expires_at).getTime() < Date.now();
  if (!connection || connection.oauth_state !== state || stateExpired) {
    return redirect("The EasyParcel connection request expired. Please try again.");
  }

  const tokenResponse = await fetch("https://api.easyparcel.com/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
      state
    })
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) {
    console.error("EasyParcel token exchange failed", tokenResponse.status, tokenData?.message);
    return redirect("EasyParcel could not finish connecting.");
  }

  const now = Date.now();
  const { error } = await supabase.from("easyparcel_connections").upsert({
    id: "primary",
    environment: Deno.env.get("EASYPARCEL_ENVIRONMENT") || "sandbox",
    oauth_state: null,
    oauth_state_expires_at: null,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    access_token_expires_at: new Date(now + Number(tokenData.expires_in || 36000) * 1000).toISOString(),
    refresh_token_expires_at: new Date(now + Number(tokenData.refresh_token_expires_in || 31557600) * 1000).toISOString(),
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  if (error) return redirect("EasyParcel connected, but the tokens could not be saved.");
  return redirect("EasyParcel sandbox connected successfully.", true);
});

