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

function digits(value: unknown) {
  const normalized = String(value || "").replace(/\D/g, "");
  return normalized.startsWith("65") && normalized.length === 10
    ? normalized.slice(2)
    : normalized;
}

function postal(value: unknown) {
  return String(value || "").match(/(?:^|\D)(\d{6})(?:\D|$)/)?.[1] || "";
}

async function getAccessToken(supabase: ReturnType<typeof createClient>) {
  const { data: connection, error } = await supabase
    .from("easyparcel_connections")
    .select("*")
    .eq("id", "primary")
    .maybeSingle();
  if (error || !connection?.access_token) throw new Error("EasyParcel is not connected.");
  if (new Date(connection.access_token_expires_at || 0).getTime() > Date.now() + 60_000) {
    return connection.access_token;
  }

  const clientId = Deno.env.get("EASYPARCEL_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("EASYPARCEL_CLIENT_SECRET") || "";
  const redirectUri = Deno.env.get("EASYPARCEL_REDIRECT_URI") || "";
  const response = await fetch("https://api.easyparcel.com/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      redirect_uri: redirectUri,
      refresh_token: connection.refresh_token
    })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("EasyParcel needs to be reconnected.");
  await supabase.from("easyparcel_connections").update({
    access_token: data.access_token,
    refresh_token: data.refresh_token || connection.refresh_token,
    access_token_expires_at: new Date(Date.now() + Number(data.expires_in || 36000) * 1000).toISOString(),
    refresh_token_expires_at: data.refresh_token_expires_in
      ? new Date(Date.now() + Number(data.refresh_token_expires_in) * 1000).toISOString()
      : connection.refresh_token_expires_at,
    updated_at: new Date().toISOString()
  }).eq("id", "primary");
  return data.access_token;
}

async function easyParcelRequest(path: string, accessToken: string, body: unknown) {
  const response = await fetch(`https://api.easyparcel.com/open_api/2026-03/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok || Number(data.status_code || response.status) >= 400) {
    throw new Error(data.message || "EasyParcel request failed.");
  }
  return data;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Server configuration missing." }, 503);

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: request.headers.get("Authorization") || "" } }
  });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return json({ error: "Admin login required." }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const payload = await request.json().catch(() => ({}));
  const action = String(payload.action || "status");

  try {
    if (action === "status") {
      const { data } = await supabase.from("easyparcel_connections")
        .select("environment, connected_at, access_token_expires_at")
        .eq("id", "primary").maybeSingle();
      return json({ connected: Boolean(data?.connected_at), ...data });
    }

    const token = await getAccessToken(supabase);
    if (action === "quote") {
      const receiverPostcode = postal(payload.receiver_postcode || payload.receiver_address);
      if (!receiverPostcode || !postal(payload.sender_postcode)) throw new Error("Both sender and receiver postcodes are required.");
      const result = await easyParcelRequest("shipment/quotations", token, {
        shipment: [{
          sender: { postcode: postal(payload.sender_postcode), subdivision_code: "SG-01", country: "SG" },
          receiver: { postcode: receiverPostcode, subdivision_code: "SG-01", country: "SG" },
          parcel_value: Number(payload.parcel_value || 1),
          weight: Number(payload.weight),
          width: Number(payload.width),
          length: Number(payload.length),
          height: Number(payload.height)
        }]
      });
      return json(result);
    }

    if (action === "book") {
      const orderId = String(payload.order_id || "");
      const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      if (!order || order.collection_method !== "delivery") throw new Error("Delivery order not found.");
      if (order.easyparcel_shipment_number) throw new Error("This order already has an EasyParcel shipment.");
      const receiverPostcode = postal(order.delivery_address);
      if (!receiverPostcode) throw new Error("The customer address needs a six-digit postal code.");

      const result = await easyParcelRequest("shipment/submit_orders", token, {
        shipment: [{
          reference: order.order_ref,
          service_id: String(payload.service_id),
          collection_date: String(payload.collection_date),
          weight: Number(payload.weight),
          height: Number(payload.height),
          length: Number(payload.length),
          width: Number(payload.width),
          item: [{
            content: "Custom keychains",
            weight: Number(payload.weight),
            height: Number(payload.height),
            length: Number(payload.length),
            width: Number(payload.width),
            currency_code: "SGD",
            value: Math.max(1, Number(order.total || 1)),
            quantity: 1
          }],
          sender: {
            name: String(payload.sender_name),
            company: String(payload.sender_company || "Little Keeps"),
            phone_number_country_code: "SG",
            phone_number: digits(payload.sender_phone),
            email: String(payload.sender_email || ""),
            address_1: String(payload.sender_address_1),
            address_2: String(payload.sender_address_2 || ""),
            postcode: postal(payload.sender_postcode),
            city: String(payload.sender_city || "Singapore"),
            subdivision_code: "SG-01",
            country_code: "SG"
          },
          receiver: {
            name: order.customer_name,
            company: "",
            phone_number_country_code: "SG",
            phone_number: digits(order.customer_phone),
            email: order.customer_email || "",
            address_1: order.delivery_address,
            address_2: "",
            postcode: receiverPostcode,
            city: "Singapore",
            subdivision_code: "SG-01",
            country_code: "SG"
          },
          feature: {
            sms_tracking: false,
            email_tracking: false,
            whatsapp_tracking: false,
            awb_branding: { enable: false }
          }
        }]
      });
      const submitted = result.data?.[0];
      const shipment = submitted?.shipments?.[0];
      if (!shipment?.shipment_number) throw new Error(submitted?.message || result.message || "EasyParcel did not create the shipment.");
      const update = {
        easyparcel_order_number: submitted.order_details?.order_number || null,
        easyparcel_shipment_number: shipment.shipment_number,
        easyparcel_service_id: String(payload.service_id),
        easyparcel_courier_name: shipment.courier || String(payload.courier_name || ""),
        easyparcel_amount: Number(shipment.pricing_breakdown?.total_paid_amount || 0),
        easyparcel_currency: shipment.pricing_breakdown?.currency_code || null,
        easyparcel_awb_url: shipment.awb_urls_by_format?.A6 || shipment.awb_url || null,
        easyparcel_status: shipment.status || "Submitted",
        easyparcel_booked_at: new Date().toISOString(),
        courier_name: shipment.courier || String(payload.courier_name || ""),
        tracking_number: shipment.awb_number || "",
        tracking_url: shipment.tracking_url || ""
      };
      const familyRoot = String(order.linked_order_ref || order.order_ref || "").toLowerCase();
      const { data: family } = await supabase.from("orders").select("id, order_ref, linked_order_ref");
      const ids = (family || []).filter(item =>
        String(item.linked_order_ref || item.order_ref || "").toLowerCase() === familyRoot
      ).map(item => item.id);
      await supabase.from("orders").update(update).in("id", ids.length ? ids : [order.id]);
      return json({ ...result, shipment: { ...shipment, order_number: submitted.order_details?.order_number } });
    }

    if (action === "refresh") {
      const shipmentNumber = String(payload.shipment_number || "");
      const result = await easyParcelRequest("shipment/details", token, { shipment_number: shipmentNumber });
      const detail = result.data?.[0];
      if (detail) {
        await supabase.from("orders").update({
          easyparcel_status: detail.shipment_details?.shipment_status || null,
          easyparcel_awb_url: detail.shipment_details?.awb_url || null,
          easyparcel_last_event_at: new Date().toISOString(),
          tracking_number: detail.shipment_details?.awb_number || "",
          tracking_url: detail.shipment_details?.tracking_url || "",
          courier_name: detail.courier?.courier_name || ""
        }).eq("easyparcel_shipment_number", shipmentNumber);
      }
      return json(result);
    }

    return json({ error: "Unknown EasyParcel action." }, 400);
  } catch (error) {
    console.error("EasyParcel API error", error);
    return json({ error: error instanceof Error ? error.message : "EasyParcel request failed." }, 400);
  }
});

