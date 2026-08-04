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
};

type NotificationPayload = {
  type?: string;
  record?: OrderRecord;
  old_record?: OrderRecord | null;
  order?: OrderRecord;
};

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
  notificationKind: "review" | "paid"
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
  if (request.method !== "POST") {
    return Response.json(
      { ok: false, error: "Method not allowed" },
      { status: 405 }
    );
  }

  const webhookSecret = Deno.env.get("ORDER_WEBHOOK_SECRET");
  const suppliedSecret = request.headers.get("x-webhook-secret");

  if (webhookSecret && suppliedSecret !== webhookSecret) {
    return Response.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!botToken || !chatId) {
    return Response.json(
      { ok: false, error: "Telegram secrets are missing" },
      { status: 500 }
    );
  }

  let payload: NotificationPayload;

  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const order = getOrder(payload);
  const oldOrder = payload.old_record || null;
  const reviewStarted =
    needsReview(order) &&
    oldOrder?.status !== order.status;
  const paymentCompleted =
    isPaid(order) &&
    !isPaid(oldOrder);

  const notificationKind = reviewStarted
    ? "review"
    : paymentCompleted
      ? "paid"
      : null;

  if (!notificationKind) {
    return Response.json({
      ok: true,
      skipped: true,
      reason: "No Telegram alert is needed for this order event."
    });
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
    return Response.json(telegramResult, { status: 502 });
  }

  return Response.json({
    ok: true,
    notification_kind: notificationKind
  });
});
