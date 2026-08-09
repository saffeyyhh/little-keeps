type OrderItem = {
  name?: string;
  clean_name?: string;
};

type OrderRecord = {
  id?: string | number;
  order_ref?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  order_type?: string;
  status?: string;
  payment_type?: string;
  collection_method?: string;
  requested_completion_date?: string;
  needed_by?: string;
  total?: number | string;
  order_data?: OrderItem[];
  telegram_review_notified_at?: string | null;
  telegram_due_tomorrow_notified_at?: string | null;
  pickup_scheduled_date?: string | null;
  pickup_time_range?: string | null;
};

type NotificationPayload = {
  type?: string;
  record?: OrderRecord;
  old_record?: OrderRecord | null;
  order?: OrderRecord;
  order_ref?: string;
  email?: string;
  source?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret"
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  Object.entries(corsHeaders).forEach(([name, value]) => headers.set(name, value));
  return Response.json(body, {
    ...init,
    headers
  });
}

function getOrder(payload: NotificationPayload): OrderRecord {
  return payload.record || payload.order || payload as OrderRecord;
}

function isPaid(order?: OrderRecord | null) {
  return (
    order?.payment_type === "Paid" ||
    order?.status === "Payment Verified"
  );
}

function needsReview(order?: OrderRecord | null) {
  return ["Rush Review", "Bulk Review"].includes(order?.status || "");
}

function getOrderTypeLabel(order: OrderRecord) {
  if (order.order_type === "rush") return "RUSH ORDER";
  if (order.order_type === "bulk") return "BULK ORDER";
  return "NEW ORDER";
}

function formatMoney(value: number | string | undefined) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : "$0.00";
}

function formatNames(order: OrderRecord) {
  const names = (order.order_data || [])
    .map(item => item.name || item.clean_name)
    .filter(Boolean);

  if (!names.length) return "Not provided";

  const visibleNames = names.slice(0, 12);
  const extraCount = names.length - visibleNames.length;

  return [
    visibleNames.join(", "),
    extraCount > 0 ? `and ${extraCount} more` : ""
  ].filter(Boolean).join(" ");
}

function buildMessage(
  order: OrderRecord,
  notificationKind: "review" | "paid" | "pickup" | "due"
) {
  const typeLabel = getOrderTypeLabel(order);
  const date =
    order.requested_completion_date ||
    order.needed_by ||
    "Not selected";
  const method =
    order.collection_method === "delivery"
      ? "Delivery"
      : "Pickup";

  if (notificationKind === "due") {
    return [
      "⏰ ORDER DUE TOMORROW",
      "",
      `Reference: ${order.order_ref || "No reference"}`,
      `Customer: ${order.customer_name || "Customer"}`,
      `Status: ${order.status || "Unknown"}`,
      `Method: ${method}`,
      `Names: ${formatNames(order)}`,
      "",
      "Check Printing and Assembly in Admin today."
    ].join("\n");
  }

  if (notificationKind === "pickup") {
    return [
      "🗓 PICKUP TIMING CHOSEN",
      "",
      `Reference: ${order.order_ref || "No reference"}`,
      `Customer: ${order.customer_name || "Customer"}`,
      `Contact: ${order.customer_phone || "Not provided"}`,
      `Pickup date: ${order.pickup_scheduled_date || "Not selected"}`,
      `Pickup time: ${order.pickup_time_range || "Not selected"}`,
      "",
      `Names: ${formatNames(order)}`,
      "",
      "The pickup appointment is saved in Admin → Fulfilment."
    ].join("\n");
  }

  if (notificationKind === "review") {
    return [
      `⚡ ${typeLabel} - REVIEW NEEDED`,
      "",
      `Reference: ${order.order_ref || "No reference"}`,
      `Customer: ${order.customer_name || "Customer"}`,
      `Contact: ${order.customer_phone || "Not provided"}`,
      `Email: ${order.customer_email || "Not provided"}`,
      `Requested date: ${date}`,
      `Method: ${method}`,
      `Total: ${formatMoney(order.total)}`,
      "",
      `Names: ${formatNames(order)}`,
      "",
      "Open Admin → Today to review this request."
    ].join("\n");
  }

  return [
    `💗 ${typeLabel} - PAYMENT SUCCESSFUL`,
    "",
    `Reference: ${order.order_ref || "No reference"}`,
    `Customer: ${order.customer_name || "Customer"}`,
    `Contact: ${order.customer_phone || "Not provided"}`,
    `Date: ${date}`,
    `Method: ${method}`,
    `Paid: ${formatMoney(order.total)}`,
    "",
    `Names: ${formatNames(order)}`,
    "",
    "The order is ready to enter your production queue."
  ].join("\n");
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      { status: 405 }
    );
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!botToken || !chatId) {
    return jsonResponse(
      { ok: false, error: "Telegram secrets are missing" },
      { status: 500 }
    );
  }

  let payload: NotificationPayload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const isDirectOrderRequest = Boolean(payload.order_ref && payload.email);
  const isDirectPickupRequest =
    isDirectOrderRequest && payload.source === "pickup-timing-selected";
  const isDirectDueRequest =
    isDirectOrderRequest && payload.source === "due-tomorrow";
  const webhookSecret = Deno.env.get("ORDER_WEBHOOK_SECRET");
  const suppliedSecret = request.headers.get("x-webhook-secret");

  if (!isDirectOrderRequest && webhookSecret && suppliedSecret !== webhookSecret) {
    return jsonResponse(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let order = getOrder(payload);
  if (isDirectOrderRequest) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { ok: false, error: "Order verification is unavailable" },
        { status: 500 }
      );
    }

    const query = new URL(`${supabaseUrl}/rest/v1/orders`);
    query.searchParams.set("select", "*");
    query.searchParams.set("order_ref", `eq.${String(payload.order_ref).trim()}`);
    query.searchParams.set("customer_email", `eq.${String(payload.email).trim()}`);
    query.searchParams.set("limit", "1");
    const orderResponse = await fetch(query, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`
      }
    });
    const rows = orderResponse.ok ? await orderResponse.json() : [];
    order = rows[0];
    if (!order) {
      return jsonResponse(
        { ok: false, error: "Order was not found" },
        { status: 404 }
      );
    }

    if (isDirectPickupRequest) {
      if (
        order.collection_method === "delivery" ||
        !order.pickup_scheduled_date ||
        !order.pickup_time_range
      ) {
        return jsonResponse(
          { ok: false, error: "A saved pickup appointment was not found" },
          { status: 404 }
        );
      }
    } else if (isDirectDueRequest) {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const dateParts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Singapore",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(tomorrow);
      const dateValues = Object.fromEntries(
        dateParts.map(part => [part.type, part.value])
      );
      const singaporeTomorrow = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;
      const dueDate = String(order.requested_completion_date || order.needed_by || "").slice(0, 10);
      if (
        dueDate !== singaporeTomorrow ||
        ["Assembly Complete", "Pending Pickup", "Pending Delivery", "Out for Delivery", "Completed", "Refunded"].includes(order.status || "")
      ) {
        return jsonResponse({ ok: true, skipped: true, reason: "Order does not need a due-tomorrow alert." });
      }
      if (order.telegram_due_tomorrow_notified_at) {
        return jsonResponse({ ok: true, skipped: true, reason: "Due-tomorrow alert already sent." });
      }
    } else {
      if (!needsReview(order)) {
        return jsonResponse(
          { ok: false, error: "Bulk or rush review order was not found" },
          { status: 404 }
        );
      }
      if (order.telegram_review_notified_at) {
        return jsonResponse({ ok: true, skipped: true, reason: "Review alert already sent." });
      }
    }
  }

  const oldOrder = payload.old_record || null;
  const reviewStarted =
    needsReview(order) &&
    oldOrder?.status !== order.status &&
    !order.telegram_review_notified_at;
  const paymentCompleted =
    isPaid(order) &&
    !isPaid(oldOrder);

  const notificationKind = isDirectPickupRequest
    ? "pickup"
    : isDirectDueRequest
      ? "due"
    : reviewStarted
      ? "review"
      : paymentCompleted
        ? "paid"
        : null;

  if (!notificationKind) {
    return jsonResponse({
      ok: true,
      skipped: true,
      reason: "No Telegram alert is needed for this order event."
    });
  }

  let reviewClaimed = false;
  if (notificationKind === "review" && order.id) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceRoleKey) {
      const claimUrl = new URL(`${supabaseUrl}/rest/v1/orders`);
      claimUrl.searchParams.set("id", `eq.${order.id}`);
      claimUrl.searchParams.set("telegram_review_notified_at", "is.null");
      const claimResponse = await fetch(claimUrl, {
        method: "PATCH",
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({ telegram_review_notified_at: new Date().toISOString() })
      });
      const claimedRows = claimResponse.ok ? await claimResponse.json() : [];
      if (!claimedRows.length) {
        return jsonResponse({ ok: true, skipped: true, reason: "Review alert already sent." });
      }
      reviewClaimed = true;
    }
  }

  let dueClaimed = false;
  if (notificationKind === "due" && order.id) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceRoleKey) {
      const claimUrl = new URL(`${supabaseUrl}/rest/v1/orders`);
      claimUrl.searchParams.set("id", `eq.${order.id}`);
      claimUrl.searchParams.set("telegram_due_tomorrow_notified_at", "is.null");
      const claimResponse = await fetch(claimUrl, {
        method: "PATCH",
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({ telegram_due_tomorrow_notified_at: new Date().toISOString() })
      });
      const claimedRows = claimResponse.ok ? await claimResponse.json() : [];
      if (!claimedRows.length) {
        return jsonResponse({ ok: true, skipped: true, reason: "Due-tomorrow alert already sent." });
      }
      dueClaimed = true;
    }
  }

  const telegramResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildMessage(order, notificationKind),
        disable_web_page_preview: true
      })
    }
  );

  const telegramResult = await telegramResponse.json();

  if (!telegramResponse.ok || !telegramResult.ok) {
    console.error("Telegram rejected the message:", telegramResult);
    if (reviewClaimed && order.id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRoleKey) {
        const resetUrl = new URL(`${supabaseUrl}/rest/v1/orders`);
        resetUrl.searchParams.set("id", `eq.${order.id}`);
        await fetch(resetUrl, {
          method: "PATCH",
          headers: {
            apikey: serviceRoleKey,
            authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ telegram_review_notified_at: null })
        });
      }
    }
    if (dueClaimed && order.id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRoleKey) {
        const resetUrl = new URL(`${supabaseUrl}/rest/v1/orders`);
        resetUrl.searchParams.set("id", `eq.${order.id}`);
        await fetch(resetUrl, {
          method: "PATCH",
          headers: {
            apikey: serviceRoleKey,
            authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ telegram_due_tomorrow_notified_at: null })
        });
      }
    }
    return jsonResponse(telegramResult, { status: 502 });
  }

  return jsonResponse({
    ok: true,
    notification_kind: notificationKind
  });
});
