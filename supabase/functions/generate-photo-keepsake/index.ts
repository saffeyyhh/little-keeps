import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function decodeDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) throw new Error("Use a JPG, PNG or WebP image.");
  const binary = atob(match[2]);
  if (binary.length > 8 * 1024 * 1024) throw new Error("The image is larger than 8 MB.");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { bytes, mimeType: match[1] };
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!openAiKey || !supabaseUrl || !serviceRoleKey) {
      return json({ error: "The AI photo studio is not configured yet." }, 503);
    }

    const body = await request.json();
    const imageDataUrl = String(body.image_data_url || "");
    const subjectType = ["person", "pet", "object"].includes(body.subject_type)
      ? body.subject_type
      : "person";
    const variant = "classic";
    const filamentPalette = (Array.isArray(body.filament_palette) ? body.filament_palette : [])
      .slice(0, 40)
      .flatMap((item: Record<string, unknown>) => {
        const name = String(item?.name || "").trim().replace(/[^a-z0-9 ()&+.-]/gi, "").slice(0, 50);
        const hex = String(item?.hex || "").trim().toUpperCase();
        return name && /^#[0-9A-F]{6}$/.test(hex) ? [{ name, hex }] : [];
      });
    if (filamentPalette.length < 2) {
      return json({ error: "At least two available filament colours are required." }, 400);
    }
    const colourCount = Math.min(4, filamentPalette.length, Math.max(2, Number(body.colour_count) || 4));
    const clientToken = String(body.client_token || "").slice(0, 120);
    if (!clientToken) return json({ error: "The preview session is missing. Refresh and try again." }, 400);

    const { bytes, mimeType } = decodeDataUrl(imageDataUrl);
    const requester = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("cf-connecting-ip") || "unknown";
    const requesterHash = await sha256(`${requester}:${Deno.env.get("PHOTO_RATE_LIMIT_SALT") || serviceRoleKey.slice(0, 24)}`);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("photo_artwork_requests")
      .select("id", { count: "exact", head: true })
      .eq("requester_hash", requesterHash)
      .gte("created_at", oneHourAgo);
    if ((count || 0) >= 5) {
      return json({ error: "You have reached the preview limit. Please try again in an hour." }, 429);
    }

    const moderationResponse = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: [{ type: "image_url", image_url: { url: imageDataUrl } }]
      })
    });
    const moderation = await moderationResponse.json();
    if (!moderationResponse.ok) throw new Error(moderation.error?.message || "Photo safety check failed.");
    if (moderation.results?.[0]?.flagged) {
      return json({ error: "This photo cannot be processed. Please choose another appropriate image." }, 400);
    }

    const model = Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-1.5";
    const prompt = [
      `Transform the main ${subjectType} in this image into clean artwork specifically for a small FDM 3D-printed keychain.`,
      `Use no more than ${colourCount} flat solid colours including outlines.`,
      `Use only colours from this available physical filament palette: ${filamentPalette.map(item => `${item.name} (${item.hex})`).join(", ")}. Choose the closest matches and do not invent any colour outside this list.`,
      "Keep the subject recognizable and charming, with bold connected shapes, smooth closed outlines, and no gradients, shadows, texture, text, logos, scenery, frame, or background.",
      "Remove tiny details and isolated specks. Every important stroke and gap must remain thick enough to print at approximately 60 mm wide; target at least 1.2 mm features.",
      "Keep the silhouette compact with a safe solid area near an upper corner for a keyring hole.",
      "Return one centred front-facing sticker-like design on a transparent background. Do not add mockups, keyrings, hands, or product photography."
    ].join(" ");

    const form = new FormData();
    form.append("model", model);
    form.append("image", new Blob([bytes], { type: mimeType }), mimeType === "image/png" ? "photo.png" : "photo.jpg");
    form.append("prompt", prompt);
    form.append("size", "1024x1024");
    form.append("quality", "medium");
    form.append("background", "transparent");
    form.append("output_format", "png");
    if (!model.includes("mini")) form.append("input_fidelity", "high");

    const imageResponse = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}` },
      body: form
    });
    const generated = await imageResponse.json();
    if (!imageResponse.ok) throw new Error(generated.error?.message || "Artwork generation failed.");
    const artworkBase64 = generated.data?.[0]?.b64_json;
    if (!artworkBase64) throw new Error("The AI service returned no artwork.");

    const generationId = crypto.randomUUID();
    const originalPath = `${generationId}/original.${mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg"}`;
    const artworkPath = `${generationId}/artwork.png`;
    const artworkBinary = atob(artworkBase64);
    const artworkBytes = new Uint8Array(artworkBinary.length);
    for (let index = 0; index < artworkBinary.length; index += 1) artworkBytes[index] = artworkBinary.charCodeAt(index);

    const { error: originalError } = await supabase.storage
      .from("customer-artwork")
      .upload(originalPath, bytes, { contentType: mimeType, upsert: false });
    if (originalError) throw originalError;
    const { error: artworkError } = await supabase.storage
      .from("customer-artwork")
      .upload(artworkPath, artworkBytes, { contentType: "image/png", upsert: false });
    if (artworkError) throw artworkError;

    const { error: logError } = await supabase.from("photo_artwork_requests").insert({
      id: generationId,
      client_token: clientToken,
      requester_hash: requesterHash,
      subject_type: subjectType,
      variant,
      colour_count: colourCount,
      original_path: originalPath,
      artwork_path: artworkPath,
      model,
      status: "generated"
    });
    if (logError) throw logError;

    const { data: signedArtwork, error: signedError } = await supabase.storage
      .from("customer-artwork")
      .createSignedUrl(artworkPath, 60 * 60 * 2);
    if (signedError) throw signedError;

    return json({
      generation_id: generationId,
      original_path: originalPath,
      artwork_path: artworkPath,
      artwork_url: signedArtwork.signedUrl
    });
  } catch (error) {
    console.error("generate-photo-keepsake failed", error);
    return json({ error: error instanceof Error ? error.message : "Unable to create artwork." }, 500);
  }
});
