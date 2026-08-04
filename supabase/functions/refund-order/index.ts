import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function getBearerToken(request: Request) {
  return (request.headers.get("Authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function safeInventoryNeeds(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([name, quantity]) => [
        String(name).trim(),
        Math.max(0, Math.floor(Number(quantity) || 0))
      ])
      .filter(([name, quantity]) => name && Number(quantity) > 0)
  );
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey) {
    return json({
      ok: false,
      error: "Refund service is missing its Supabase or Stripe secret."
    }, 500);
  }

  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return json({ ok: false, error: "Please log in to the admin again." }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

  if (userError || !userData.user) {
    return json({ ok: false, error: "Your admin session has expired. Please log in again." }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid refund request." }, 400);
  }

  const orderId = String(payload.order_id || "").trim();
  const amountCents = Math.round(Number(payload.amount) * 100);
  const reason = String(payload.reason || "Customer request").trim().slice(0, 500);
  const inventoryNeeds = safeInventoryNeeds(payload.inventory_needs);

  if (!orderId || !Number.isInteger(amountCents) || amountCents <= 0) {
    return json({ ok: false, error: "Enter a valid refund amount." }, 400);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_ref, total, refunded_amount, stripe_payment_intent_id, inventory_deducted_at, inventory_restored_at")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return json({ ok: false, error: "Order could not be found." }, 404);
  }

  if (!order.stripe_payment_intent_id) {
    return json({ ok: false, error: "This order does not have a Stripe payment to refund." }, 400);
  }

  const totalCents = Math.round(Number(order.total || 0) * 100);
  const alreadyRefundedCents = Math.round(Number(order.refunded_amount || 0) * 100);
  const refundLookupUrl = new URL("https://api.stripe.com/v1/refunds");
  refundLookupUrl.searchParams.set(
    "payment_intent",
    String(order.stripe_payment_intent_id)
  );
  refundLookupUrl.searchParams.set("limit", "100");

  const refundLookupResponse = await fetch(refundLookupUrl, {
    headers: { Authorization: `Bearer ${stripeSecretKey}` }
  });
  const refundLookupResult = await refundLookupResponse.json();

  if (!refundLookupResponse.ok) {
    console.error("Unable to verify existing Stripe refunds:", refundLookupResult);
    return json({
      ok: false,
      error: "Stripe refund history could not be checked, so no refund was sent. Please try again later."
    }, 502);
  }

  const stripeRefundedCents = (refundLookupResult.data || [])
    .filter((refund: Record<string, unknown>) =>
      !["failed", "canceled"].includes(String(refund.status || ""))
    )
    .reduce(
      (sum: number, refund: Record<string, unknown>) =>
        sum + Math.max(0, Number(refund.amount) || 0),
      0
    );

  if (stripeRefundedCents > alreadyRefundedCents) {
    const stripeShowsFullRefund = stripeRefundedCents >= totalCents;
    const reconciliationUpdate: Record<string, unknown> = {
      refunded_amount: stripeRefundedCents / 100
    };

    if (stripeShowsFullRefund) {
      reconciliationUpdate.status = "Refunded";
      reconciliationUpdate.payment_type = "Refunded";
    }

    const { error: reconciliationError } = await supabase
      .from("orders")
      .update(reconciliationUpdate)
      .eq("id", order.id);

    if (reconciliationError) {
      console.error("Unable to reconcile Stripe refunds:", reconciliationError);
      return json({
        ok: false,
        error: "Stripe already contains a refund, but the admin record could not be synced. No new refund was sent."
      }, 500);
    }

    return json({
      ok: false,
      reconciled: true,
      refunded_total: stripeRefundedCents / 100,
      error:
        `Stripe already shows $${(stripeRefundedCents / 100).toFixed(2)} refunded. ` +
        "The admin record has been synced and no new refund was sent. Refresh the order before trying again."
    });
  }

  const effectiveRefundedCents = Math.max(
    alreadyRefundedCents,
    stripeRefundedCents
  );
  const remainingCents = Math.max(0, totalCents - effectiveRefundedCents);

  if (amountCents > remainingCents) {
    return json({
      ok: false,
      error: `The maximum remaining refund is $${(remainingCents / 100).toFixed(2)}.`
    }, 400);
  }

  const stripeBody = new URLSearchParams({
    payment_intent: String(order.stripe_payment_intent_id),
    amount: String(amountCents),
    reason: "requested_by_customer",
    "metadata[order_id]": String(order.id),
    "metadata[order_ref]": String(order.order_ref || ""),
    "metadata[admin_reason]": reason
  });
  const stripeResponse = await fetch("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `little-keeps-refund-${order.id}-${effectiveRefundedCents}-${amountCents}`
    },
    body: stripeBody
  });
  const stripeResult = await stripeResponse.json();

  if (!stripeResponse.ok) {
    console.error("Stripe refund failed:", stripeResult);
    return json({
      ok: false,
      error: stripeResult?.error?.message || "Stripe could not complete this refund."
    }, 400);
  }

  const refundedCents = effectiveRefundedCents + amountCents;
  const isFullRefund = refundedCents >= totalCents;
  const orderUpdate: Record<string, unknown> = {
    refunded_amount: refundedCents / 100
  };

  if (isFullRefund) {
    orderUpdate.status = "Refunded";
    orderUpdate.payment_type = "Refunded";
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update(orderUpdate)
    .eq("id", order.id);

  if (updateError) {
    console.error("Stripe refunded, but the order record failed to update:", updateError);
    return json({
      ok: false,
      error: "Stripe completed the refund, but the order record did not update. Check Stripe before trying again."
    }, 500);
  }

  let inventoryWarning = "";
  if (
    isFullRefund &&
    order.inventory_deducted_at &&
    !order.inventory_restored_at &&
    Object.keys(inventoryNeeds).length
  ) {
    for (const [itemName, quantity] of Object.entries(inventoryNeeds)) {
      const { data: item, error: itemError } = await supabase
        .from("inventory_items")
        .select("id, qty")
        .eq("item_name", itemName)
        .maybeSingle();

      if (itemError || !item) {
        inventoryWarning = "Refund completed, but some inventory could not be restored automatically.";
        console.error("Unable to restore inventory item:", itemName, itemError);
        continue;
      }

      const { error: inventoryError } = await supabase
        .from("inventory_items")
        .update({
          qty: Number(item.qty || 0) + Number(quantity),
          updated_at: new Date().toISOString()
        })
        .eq("id", item.id);

      if (inventoryError) {
        inventoryWarning = "Refund completed, but some inventory could not be restored automatically.";
        console.error("Unable to restore inventory item:", itemName, inventoryError);
      }
    }

    if (!inventoryWarning) {
      const { error: restoredAtError } = await supabase
        .from("orders")
        .update({ inventory_restored_at: new Date().toISOString() })
        .eq("id", order.id);

      if (restoredAtError) {
        inventoryWarning = "Refund completed and stock was restored, but the restoration marker could not be saved.";
      }
    }
  }

  return json({
    ok: true,
    refund_id: stripeResult.id,
    refund_status: isFullRefund ? "full" : "partial",
    amount: amountCents / 100,
    refunded_total: refundedCents / 100,
    warning: inventoryWarning || undefined
  });
});
