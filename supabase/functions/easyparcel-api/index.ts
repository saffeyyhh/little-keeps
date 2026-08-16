import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const EASY_PARCEL_API_VERSION = "2026-06";

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

async function easyParcelRequest(
  path: string,
  accessToken: string,
  body?: unknown,
  method = "POST",
  version = EASY_PARCEL_API_VERSION
) {
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(`https://api.easyparcel.com/open_api/${version}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {})
    });
    if (response.status !== 429 || attempt === 2) break;
    const retryAfter = Math.min(4, Math.max(1, Number(response.headers.get("Retry-After") || 2 ** attempt)));
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
  }
  if (!response) throw new Error("EasyParcel did not respond.");
  const data = await response.json().catch(() => ({}));
  if (!response.ok || Number(data.status_code || response.status) >= 400) {
    throw new Error(data.message || "EasyParcel request failed.");
  }
  return data;
}

function requireSuccessfulItem(item: any, fallback: string) {
  if (!item) throw new Error(fallback);
  const status = String(item?.status || "").toLowerCase();
  if (["error", "failed", "failure"].includes(status)) {
    throw new Error(item?.message || item?.remarks || fallback);
  }
  return item;
}

function positiveNumber(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be greater than zero.`);
  return number;
}

function itemQuantity(order: any) {
  const items = Array.isArray(order?.order_data) ? order.order_data : [];
  return Math.max(1, items.length);
}

async function requireSingaporeAccount(accessToken: string) {
  const walletResult = await easyParcelRequest("wallet", accessToken, undefined, "GET");
  const currency = String(walletResult?.data?.wallet?.[0]?.currency || "").toUpperCase();
  if (currency && currency !== "SGD") {
    throw new Error(`The connected EasyParcel wallet is ${currency}. Connect your Singapore EasyParcel account before booking Singapore delivery.`);
  }
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
      if (!data?.connected_at) return json({ connected: false });
      const token = await getAccessToken(supabase);
      const [accountResponse, walletResponse] = await Promise.allSettled([
        easyParcelRequest("account/get_account_information", token, {}),
        easyParcelRequest("wallet", token, undefined, "GET")
      ]);
      const accountResult = accountResponse.status === "fulfilled" ? accountResponse.value : {};
      const walletResult = walletResponse.status === "fulfilled" ? walletResponse.value : {};
      const wallet = walletResult?.data?.wallet?.[0] || {};
      const freeCredit = walletResult?.data?.free_credit_wallet?.[0] || {};
      return json({
        connected: true,
        connected_at: data.connected_at,
        account_name: accountResult?.data?.account?.name || "",
        account_type: accountResult?.data?.account?.account_type || "",
        account_country: accountResult?.data?.address?.pickup_address?.country_code || "",
        wallet_balance: Number(wallet.balance || 0),
        wallet_currency: wallet.currency || "",
        free_credit_balance: Number(freeCredit.balance || 0),
        free_credit_currency: freeCredit.currency || ""
      });
    }

    const token = await getAccessToken(supabase);
    if (action === "quote") {
      await requireSingaporeAccount(token);
      const receiverPostcode = postal(payload.receiver_postcode || payload.receiver_address);
      if (!receiverPostcode || !postal(payload.sender_postcode)) throw new Error("Both sender and receiver postcodes are required.");
      const result = await easyParcelRequest("shipment/quotations", token, {
        shipment: [{
          sender: { postcode: postal(payload.sender_postcode), subdivision_code: "SG-01", country: "SG" },
          receiver: { postcode: receiverPostcode, subdivision_code: "SG-01", country: "SG" },
          parcel_value: positiveNumber(payload.parcel_value || 1, "Parcel value"),
          weight: positiveNumber(payload.weight, "Weight"),
          width: positiveNumber(payload.width, "Width"),
          length: positiveNumber(payload.length, "Length"),
          height: positiveNumber(payload.height, "Height")
        }]
      });
      requireSuccessfulItem(result.data?.[0], "EasyParcel could not quote this parcel.");
      return json(result);
    }

    if (action === "book") {
      await requireSingaporeAccount(token);
      const orderId = String(payload.order_id || "");
      const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      if (!order || order.collection_method !== "delivery") throw new Error("Delivery order not found.");
      if (order.easyparcel_shipment_number) throw new Error("This order already has an EasyParcel shipment.");
      const receiverPostcode = postal(order.delivery_address);
      if (!receiverPostcode) throw new Error("The customer address needs a six-digit postal code.");
      const senderPhone = digits(payload.sender_phone);
      const receiverPhone = digits(order.customer_phone);
      if (!/^\d{8}$/.test(senderPhone)) throw new Error("The sender needs a valid 8-digit Singapore phone number.");
      if (!/^\d{8}$/.test(receiverPhone)) throw new Error("The customer needs a valid 8-digit Singapore phone number.");
      if (!String(payload.sender_name || "").trim() || !String(payload.sender_address_1 || "").trim()) {
        throw new Error("The sender name and address are required.");
      }
      if (!/^\S+@\S+\.\S+$/.test(String(payload.sender_email || ""))) {
        throw new Error("The sender needs a valid email address.");
      }
      if (!String(payload.service_id || "").trim()) throw new Error("Choose a courier service first.");

      const collectionDate = String(payload.collection_date || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(collectionDate)) throw new Error("Choose a valid collection date.");
      const singaporeToday = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date());
      if (collectionDate < singaporeToday) throw new Error("The collection date cannot be in the past.");
      const contents = String(payload.contents || "").trim();
      if (contents.length < 5) throw new Error("Enter a clear parcel contents description.");

      const { data: allOrders } = await supabase.from("orders").select("*");
      const familyRoot = String(order.linked_order_ref || order.order_ref || "").toLowerCase();
      const family = (allOrders || []).filter(item =>
        String(item.linked_order_ref || item.order_ref || "").toLowerCase() === familyRoot
      );
      const bookingOrders = family.length ? family : [order];
      const declaredValue = bookingOrders.reduce((sum, item) =>
        sum + Math.max(0, Number(item.subtotal ?? item.total ?? 0)), 0);
      const quantity = bookingOrders.reduce((sum, item) => sum + itemQuantity(item), 0);
      const weight = positiveNumber(payload.weight, "Weight");
      const height = positiveNumber(payload.height, "Height");
      const length = positiveNumber(payload.length, "Length");
      const width = positiveNumber(payload.width, "Width");

      const result = await easyParcelRequest("shipment/submit_orders", token, {
        shipment: [{
          reference: order.order_ref,
          service_id: String(payload.service_id),
          collection_date: collectionDate,
          weight,
          height,
          length,
          width,
          item: [{
            content: contents,
            weight,
            height,
            length,
            width,
            currency_code: "SGD",
            value: Math.max(1, declaredValue),
            quantity
          }],
          sender: {
            name: String(payload.sender_name),
            company: String(payload.sender_company || "Little Keeps"),
            phone_number_country_code: "SG",
            phone_number: senderPhone,
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
            phone_number: receiverPhone,
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
      const submitted = requireSuccessfulItem(result.data?.[0], "EasyParcel could not create the shipment.");
      const shipment = requireSuccessfulItem(submitted?.shipments?.[0], "EasyParcel could not create the shipment.");
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
      const ids = bookingOrders.map(item => item.id);
      const { error: saveError } = await supabase.from("orders").update(update).in("id", ids.length ? ids : [order.id]);
      if (saveError) {
        throw new Error(`EasyParcel created shipment ${shipment.shipment_number}, but Little Keeps could not save it. Refresh before booking again.`);
      }
      return json({ ...result, shipment: { ...shipment, order_number: submitted.order_details?.order_number } });
    }

    if (action === "refresh") {
      const shipmentNumber = String(payload.shipment_number || "");
      const result = await easyParcelRequest(
        "shipment/details",
        token,
        { shipment_number: shipmentNumber },
        "POST",
        "2026-03"
      );
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

    if (action === "cancel") {
      const shipmentNumber = String(payload.shipment_number || "").trim();
      const remark = String(payload.remark || "").trim();
      if (!/^ES-\d{4}-[A-Z0-9]+$/i.test(shipmentNumber)) throw new Error("Invalid EasyParcel shipment number.");
      if (!remark) throw new Error("A cancellation reason is required.");
      const result = await easyParcelRequest("shipment/cancel", token, {
        cancel_list: [{ shipment_number: shipmentNumber, remark }]
      });
      const cancelled = requireSuccessfulItem(result.data?.[0], "EasyParcel could not cancel this shipment.");
      const { error: cancelSaveError } = await supabase.from("orders").update({
        easyparcel_status: cancelled?.message || "Cancelled",
        easyparcel_last_event_at: new Date().toISOString()
      }).eq("easyparcel_shipment_number", shipmentNumber);
      if (cancelSaveError) throw new Error("EasyParcel cancelled the shipment, but Little Keeps could not save the new status. Refresh the shipment.");
      return json(result);
    }

    return json({ error: "Unknown EasyParcel action." }, 400);
  } catch (error) {
    console.error("EasyParcel API error", error);
    return json({ error: error instanceof Error ? error.message : "EasyParcel request failed." }, 400);
  }
});
