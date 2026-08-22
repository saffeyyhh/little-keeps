import { createClient } from "npm:@supabase/supabase-js@2";

const EMAILJS_SERVICE_ID = Deno.env.get("EMAILJS_SERVICE_ID") || "service_joll6ie";
const EMAILJS_PUBLIC_KEY = Deno.env.get("EMAILJS_PUBLIC_KEY") || "dRppqgrkwps-kd6W-";

type DeliveryOrder = {
  id: string;
  order_ref?: string | null;
  linked_order_ref?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  collection_method?: string | null;
  needed_by?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  courier_name?: string | null;
  easyparcel_courier_name?: string | null;
  status?: string | null;
  status_email_type?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00+08:00`);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

async function sendAutomaticDeliveryEmail(
  supabase: ReturnType<typeof createClient>,
  orders: DeliveryOrder[],
  status: "Out for Delivery" | "Completed"
) {
  const root = orders.find(order => !order.linked_order_ref) || orders[0];
  if (!root?.customer_email) return { skipped: true, reason: "Customer email missing" };
  if (root.status_email_type === status) return { skipped: true, reason: "Already sent" };

  const { data: settings, error: settingsError } = await supabase
    .from("shop_settings")
    .select("status_emails_enabled,status_email_template_id,review_url")
    .eq("id", 1)
    .maybeSingle();
  if (settingsError) throw settingsError;
  if (!settings?.status_emails_enabled || !settings?.status_email_template_id) {
    return { skipped: true, reason: "Status emails disabled or template missing" };
  }

  const completed = status === "Completed";
  const templateParams = {
    to_email: root.customer_email,
    customer_name: root.customer_name || "Customer",
    order_ref: root.order_ref || "-",
    update_title: completed
      ? "Your Little Keeps order has been delivered! 🩷"
      : "Your Little Keeps order is out for delivery! 🩷",
    update_message: completed
      ? "Your order has been delivered. Thank you so much for supporting Little Keeps!"
      : "Your personalised order has been handed to the courier and is on its way to you.",
    action_title: completed ? "Love your Little Keeps order?" : "Track your delivery",
    action_details: completed
      ? "We’d be so happy to see your creation! Share a review or tag us. If anything is not quite right, reply to this email and we’ll help."
      : root.tracking_number
        ? `Tracking number: ${root.tracking_number}`
        : "Use the tracking link below for the latest courier update.",
    action_button_label: completed ? "Share Your Review" : "View Tracking",
    action_url: completed
      ? settings.review_url || "https://www.instagram.com/madebylittlekeeps/"
      : root.tracking_url || `https://little-keeps.vercel.app/?resume_order=${encodeURIComponent(root.order_ref || "")}#orderStatusSection`,
    has_tracking: Boolean(root.tracking_number),
    tracking_number: root.tracking_number || "",
    tracking_url: root.tracking_url || "",
    courier_name: root.courier_name || root.easyparcel_courier_name || "EasyParcel courier",
    collection_method: "Islandwide Delivery",
    needed_by: formatDate(root.needed_by)
  };

  const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: settings.status_email_template_id,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: templateParams
    })
  });
  if (!response.ok) {
    throw new Error(`EmailJS returned ${response.status}: ${await response.text()}`);
  }

  const ids = orders.map(order => order.id);
  const sentAt = new Date().toISOString();
  const historyUpdate: Record<string, unknown> = {
    status_email_sent_at: sentAt,
    status_email_type: status
  };
  if (completed) historyUpdate.review_request_sent_at = sentAt;
  const { error: historyError } = await supabase.from("orders").update(historyUpdate).in("id", ids);
  if (historyError) console.warn("Delivery email sent but history could not be saved", historyError);
  return { sent: true };
}

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

  const { data: matchingOrders, error: lookupError } = await supabase
    .from("orders")
    .select("id,order_ref,linked_order_ref,customer_name,customer_email,collection_method,needed_by,tracking_number,tracking_url,courier_name,easyparcel_courier_name,status,status_email_type")
    .eq("easyparcel_shipment_number", shipmentNumber);
  if (lookupError) {
    console.error("Unable to find EasyParcel orders", lookupError);
    return new Response("server error", { status: 500 });
  }

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

  const orderIds = (matchingOrders || []).map(order => order.id);
  if (!orderIds.length) return new Response("ok", { status: 200 });
  const { error } = await supabase.from("orders")
    .update(update)
    .in("id", orderIds);
  if (error) {
    console.error("Unable to save EasyParcel webhook", error);
    return new Response("server error", { status: 500 });
  }

  const emailStatus = statusCode === 4
    ? "Out for Delivery"
    : statusCode === 5
      ? "Completed"
      : null;
  if (emailStatus && matchingOrders?.length) {
    try {
      await sendAutomaticDeliveryEmail(
        supabase,
        matchingOrders.map(order => ({ ...order, ...update })),
        emailStatus
      );
    } catch (emailError) {
      console.error("EasyParcel status saved but customer email failed", emailError);
      return new Response("email error", { status: 500 });
    }
  }
  return new Response("ok", { status: 200 });
});
