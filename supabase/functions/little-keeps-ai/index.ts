import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://little-keeps.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
]);
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://little-keeps.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const publicUsage = new Map<string, { startedAt: number; design: number; photo: number }>();

function getRequestOrigin(request: Request) {
  return request.headers.get("origin") || "";
}

function isAllowedOrigin(request: Request) {
  const origin = getRequestOrigin(request);
  return !origin || allowedOrigins.has(origin);
}

function responseCorsHeaders(request?: Request) {
  const origin = request ? getRequestOrigin(request) : "";
  return { ...corsHeaders, "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : corsHeaders["Access-Control-Allow-Origin"] };
}

function json(body: Record<string, unknown>, status = 200, request?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...responseCorsHeaders(request), "Content-Type": "application/json" }
  });
}

function checkPublicLimit(request: Request, mode: "design" | "photo") {
  const key = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const usage = publicUsage.get(key);
  const current = !usage || now - usage.startedAt >= 60 * 60 * 1000
    ? { startedAt: now, design: 0, photo: 0 }
    : usage;
  const maximum = mode === "design" ? 10 : 8;
  if (current[mode] >= maximum) {
    const retryAfterSeconds = Math.max(60, Math.ceil((current.startedAt + 60 * 60 * 1000 - now) / 1000));
    return { allowed: false, retryAfterSeconds, maximum };
  }
  current[mode] += 1;
  publicUsage.set(key, current);
  return { allowed: true, retryAfterSeconds: 0, maximum };
}

function cleanText(value: unknown, maximum = 500) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maximum);
}

function getOutputText(response: Record<string, any>) {
  if (typeof response.output_text === "string") return response.output_text;
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  throw new Error("The AI service returned no usable answer.");
}

async function moderate(openAiKey: string, input: unknown) {
  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "omni-moderation-latest", input })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "Safety check failed.");
  return Boolean(result.results?.[0]?.flagged);
}

async function respondWithSchema(
  openAiKey: string,
  instructions: string,
  input: unknown,
  name: string,
  schema: Record<string, unknown>,
  maxOutputTokens = 700
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_TEXT_MODEL") || "gpt-5.6-luna",
      store: false,
      instructions,
      input,
      max_output_tokens: maxOutputTokens,
      text: { format: { type: "json_schema", name, strict: true, schema } }
    })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "AI request failed.");
  return JSON.parse(getOutputText(result));
}

const designSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          base_hex: { type: "string" },
          cap_hex: { type: "string" },
          letter_hex: { type: "string" },
          icon: { type: "string" },
          reason: { type: "string" }
        },
        required: ["title", "description", "base_hex", "cap_hex", "letter_hex", "icon", "reason"]
      }
    }
  },
  required: ["suggestions"]
};

const photoSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    rating: { type: "string", enum: ["great", "okay", "difficult"] },
    heading: { type: "string" },
    summary: { type: "string" },
    tips: { type: "array", maxItems: 3, items: { type: "string" } }
  },
  required: ["rating", "heading", "summary", "tips"]
};

const messageSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    draft: { type: "string" }
  },
  required: ["draft"]
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: responseCorsHeaders(request) });
  if (!isAllowedOrigin(request)) return json({ error: "This AI tool is only available on the Little Keeps website." }, 403, request);
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, request);

  try {
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!openAiKey || !supabaseUrl || !serviceRoleKey) return json({ error: "AI tools are not configured yet." }, 503);

    const body = await request.json();
    const mode = cleanText(body.mode, 40);

    if (mode === "design_helper") {
      const limit = checkPublicLimit(request, "design");
      if (!limit.allowed) return json({ error: `You have used all ${limit.maximum} design suggestions for this hour. Please try again later.`, retry_after_seconds: limit.retryAfterSeconds }, 429, request);
      const brief = cleanText(body.brief, 300);
      const productName = cleanText(body.product_name, 100) || "keychain";
      const palette = (Array.isArray(body.palette) ? body.palette : []).slice(0, 50).flatMap((item: any) => {
        const name = cleanText(item?.name, 50);
        const hex = cleanText(item?.hex, 7).toUpperCase();
        const material = cleanText(item?.material, 20);
        return name && /^#[0-9A-F]{6}$/.test(hex) ? [{ name, hex, material }] : [];
      });
      const icons = (Array.isArray(body.icons) ? body.icons : []).slice(0, 50).map((item: unknown) => cleanText(item, 8)).filter(Boolean);
      if (!brief) return json({ error: "Tell us what kind of design you would like." }, 400);
      if (palette.length < 2) return json({ error: "Not enough in-stock colours are available for suggestions." }, 400);
      if (await moderate(openAiKey, brief)) return json({ error: "Please try a different design description." }, 400);

      const result = await respondWithSchema(
        openAiKey,
        "You are Little Keeps' friendly product design assistant. Create exactly three distinct, tasteful colour ideas. You must use only the exact HEX values and icons supplied by the shop. Never invent stock, prices, dates or product capabilities. Keep every field concise and customer-friendly.",
        `Product: ${productName}\nCustomer idea: ${brief}\nIn-stock filament options: ${JSON.stringify(palette)}\nAllowed icons: ${JSON.stringify(icons)}`,
        "little_keeps_design_suggestions",
        designSchema
      );
      return json(result, 200, request);
    }

    if (mode === "photo_check") {
      const limit = checkPublicLimit(request, "photo");
      if (!limit.allowed) return json({ error: `You have used all ${limit.maximum} photo checks for this hour. You can still create an artwork preview.`, retry_after_seconds: limit.retryAfterSeconds }, 429, request);
      const imageDataUrl = cleanText(body.image_data_url, 12_000_000);
      const subjectType = ["person", "pet", "object"].includes(body.subject_type) ? body.subject_type : "subject";
      if (!/^data:image\/(jpeg|png|webp);base64,/i.test(imageDataUrl)) return json({ error: "Choose a JPG, PNG or WebP photo." }, 400);
      if (await moderate(openAiKey, [{ type: "image_url", image_url: { url: imageDataUrl } }])) {
        return json({ error: "This photo cannot be processed. Please choose another appropriate image." }, 400);
      }
      const result = await respondWithSchema(
        openAiKey,
        "You assess whether a customer photo will simplify well into cute, flat-colour artwork for a small 60 mm FDM-printed keychain. Be encouraging and practical. Focus only on visibility, lighting, one clear main subject, obstruction, contrast and tiny details. Do not mention technical printer settings.",
        [{ role: "user", content: [
          { type: "input_text", text: `Check this ${subjectType} photo before artwork generation.` },
          { type: "input_image", image_url: imageDataUrl, detail: "low" }
        ] }],
        "little_keeps_photo_check",
        photoSchema,
        450
      );
      return json(result, 200, request);
    }

    if (mode === "admin_message") {
      const authorization = request.headers.get("authorization") || "";
      const token = authorization.replace(/^Bearer\s+/i, "");
      const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData.user) return json({ error: "Admin login required." }, 401);

      const orderId = cleanText(body.order_id, 120);
      const messageType = cleanText(body.message_type, 60) || "general update";
      const note = cleanText(body.note, 500);
      const { data: order, error: orderError } = await supabase.from("orders").select("*").eq("id", orderId).single();
      if (orderError || !order) return json({ error: "Order not found." }, 404);

      const safeOrder = {
        order_ref: order.order_ref,
        customer_name: order.customer_name,
        status: order.status,
        payment_status: order.payment_status,
        collection_method: order.collection_method,
        pickup_scheduled_date: order.pickup_scheduled_date,
        pickup_time_range: order.pickup_time_range,
        requested_completion_date: order.requested_completion_date,
        tracking_url: order.tracking_url,
        keychain_count: Array.isArray(order.order_items) ? order.order_items.reduce((sum: number, item: any) => sum + Math.max(1, Number(item?.quantity) || 1), 0) : null
      };
      const prompt = `Message type: ${messageType}\nOrder details: ${JSON.stringify(safeOrder)}\nAdmin note: ${note || "None"}`;
      if (await moderate(openAiKey, prompt)) return json({ error: "Please rewrite the optional note." }, 400);
      const result = await respondWithSchema(
        openAiKey,
        "Write one polished customer message for Little Keeps, a warm Singapore small business. Use friendly natural English with a light local warmth, but do not overdo slang. Never invent facts, promises, discounts, dates or tracking details. Include the order reference naturally. For WhatsApp-style messages, keep it concise and ready to copy. Do not use markdown or placeholders. Use at most two suitable emojis.",
        prompt,
        "little_keeps_admin_message",
        messageSchema,
        500
      );
      return json(result, 200, request);
    }

    return json({ error: "Unknown AI tool." }, 400, request);
  } catch (error) {
    console.error("little-keeps-ai failed", error);
    return json({ error: error instanceof Error ? error.message : "AI tool failed." }, 500, request);
  }
});
