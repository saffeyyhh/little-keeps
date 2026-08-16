import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async request => {
  if (request.method !== "POST") return new Response("ok", { status: 200 });
  const expectedSecret = Deno.env.get("EASYPARCEL_WEBHOOK_SECRET");
  const suppliedSecret = new URL(request.url).searchParams.get("secret");
  if (!expectedSecret || suppliedSecret !== expectedSecret) return new Response("unauthorized", { status: 401 });

  const payload = await request.json().catch(() => null);
  const topic = String(payload?.topic || "");
  const supportedTopics = new Set([
    "shipment.status.update",
    "shipment.awb.update",
    "shipment.tracking.update",
    "shipment.created"
  ]);
  if (topic && !supportedTopics.has(topic)) return new Response("ok", { status: 200 });
  const shipmentNumber = String(payload?.shipment_number || "");
  if (!shipmentNumber) return new Response("ok", { status: 200 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return new Response("server error", { status: 500 });
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const statusCode = Number(payload.latest_shipment_status_code ?? payload.shipment_status_code ?? -1);
  const easyparcelStatus = String(
    payload.latest_tracking_status || payload.shipment_status || payload.status || "Updated"
  );
  const update: Record<string, unknown> = {
    easyparcel_status: easyparcelStatus,
    easyparcel_last_event_at: new Date().toISOString()
  };
  if (payload.awb_number) update.tracking_number = String(payload.awb_number);
  if (payload.tracking_url) update.tracking_url = String(payload.tracking_url);
  if (payload.awb_url) update.easyparcel_awb_url = String(payload.awb_url);
  if (statusCode === 4) {
    update.status = "Out for Delivery";
    update.status_updated_at = new Date().toISOString();
  }
  if (statusCode === 5) {
    update.status = "Completed";
    update.status_updated_at = new Date().toISOString();
  }

  const { error } = await supabase.from("orders")
    .update(update)
    .eq("easyparcel_shipment_number", shipmentNumber);
  if (error) {
    console.error("Unable to save EasyParcel webhook", error);
    return new Response("server error", { status: 500 });
  }
  return new Response("ok", { status: 200 });
});
