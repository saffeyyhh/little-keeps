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

function normalizeNeeds(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("No printed parts were selected.");
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([itemName, quantity]) => [String(itemName).trim(), Number(quantity)] as const)
    .filter(([itemName, quantity]) => itemName && Number.isInteger(quantity) && quantity > 0);

  if (!entries.length) throw new Error("No printed parts were selected.");
  if (entries.length > 100) throw new Error("Too many different parts were selected at once.");
  if (entries.some(([, quantity]) => quantity > 500)) {
    throw new Error("A reprint quantity is too large. Please refresh and try again.");
  }

  return Object.fromEntries(entries) as Record<string, number>;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Workshop configuration is missing." }, 503);
  }

  const authorization = request.headers.get("Authorization") || "";
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } }
  });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return json({ error: "Admin login required." }, 401);

  try {
    const payload = await request.json().catch(() => ({}));
    const needs = normalizeNeeds(payload.needs);
    const itemNames = Object.keys(needs);
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: inventoryRows, error: inventoryError } = await supabase
      .from("inventory_items")
      .select("id,item_name,qty,category")
      .in("item_name", itemNames);
    if (inventoryError) throw inventoryError;

    const rowsByName = new Map(
      (inventoryRows || []).map(row => [String(row.item_name), row])
    );
    const missing = itemNames.filter(itemName => !rowsByName.has(itemName));
    if (missing.length) {
      throw new Error(`Inventory item not found: ${missing.join(", ")}. Refresh Production and try again.`);
    }

    const insufficient = itemNames.filter(itemName => {
      const row = rowsByName.get(itemName);
      return Number(row?.qty || 0) < needs[itemName];
    });
    if (insufficient.length) {
      throw new Error(
        `These parts are no longer in printed inventory: ${insufficient.join(", ")}. Refresh Assembly before reprinting.`
      );
    }

    const changed: Array<{ id: number; itemName: string; previousQty: number; quantity: number }> = [];
    try {
      for (const itemName of itemNames) {
        const row = rowsByName.get(itemName)!;
        const previousQty = Number(row.qty || 0);
        const quantity = needs[itemName];
        const { data: updated, error } = await supabase
          .from("inventory_items")
          .update({ qty: previousQty - quantity, updated_at: new Date().toISOString() })
          .eq("id", row.id)
          .eq("qty", previousQty)
          .select("id")
          .maybeSingle();
        if (error || !updated) {
          throw error || new Error(`${itemName} changed while the reprint was being saved. Please try again.`);
        }
        changed.push({ id: row.id, itemName, previousQty, quantity });
      }
    } catch (error) {
      for (const item of changed.reverse()) {
        await supabase
          .from("inventory_items")
          .update({ qty: item.previousQty, updated_at: new Date().toISOString() })
          .eq("id", item.id);
      }
      throw error;
    }

    let clearanceSaved = false;
    let warning = "";
    if (Boolean(payload.keep_for_clearance)) {
      try {
        for (const itemName of itemNames) {
          const { data: existing, error: selectError } = await supabase
            .from("clearance_inventory")
            .select("id,qty")
            .eq("item_name", itemName)
            .maybeSingle();
          if (selectError) throw selectError;

          const values = {
            item_name: itemName,
            qty: Number(existing?.qty || 0) + needs[itemName],
            latest_order_ref: String(payload.order_ref || "").trim() || null,
            reason: String(payload.reason || "Failed quality check").trim(),
            updated_at: new Date().toISOString()
          };
          const query = existing?.id
            ? supabase.from("clearance_inventory").update(values).eq("id", existing.id)
            : supabase.from("clearance_inventory").insert(values);
          const { error } = await query;
          if (error) throw error;
        }
        clearanceSaved = true;
      } catch (error) {
        console.warn("Reprint saved but clearance inventory is unavailable:", error);
        warning = "The reprint is queued, but the rejected pieces could not be recorded in Clearance Inventory. Keep them aside physically for now.";
      }
    }

    return json({
      ok: true,
      reprint_items: itemNames.map(itemName => ({ item_name: itemName, quantity: needs[itemName] })),
      clearance_saved: clearanceSaved,
      warning
    });
  } catch (error) {
    console.error("Unable to save reprint:", error);
    return json({ error: error instanceof Error ? error.message : "Unable to save the reprint." }, 400);
  }
});
