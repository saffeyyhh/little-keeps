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
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Private artwork storage is not configured yet." }, 503);
    }

    const body = await request.json();
    const clientToken = String(body.client_token || "").slice(0, 120);
    if (!clientToken) return json({ error: "The preview session is missing. Refresh and try again." }, 400);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    if (body.action === "store_image_cap") {
      const { bytes, mimeType } = decodeDataUrl(String(body.image_data_url || ""));
      const uploadId = crypto.randomUUID();
      const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
      const artworkPath = `image-caps/${uploadId}/artwork.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("customer-artwork")
        .upload(artworkPath, bytes, { contentType: mimeType, upsert: false });
      if (uploadError) throw uploadError;
      const requester = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("cf-connecting-ip") || "unknown";
      const requesterHash = await sha256(`${requester}:${Deno.env.get("PHOTO_RATE_LIMIT_SALT") || serviceRoleKey.slice(0, 24)}`);
      const { error: logError } = await supabase.from("photo_artwork_requests").insert({
        id: uploadId,
        client_token: clientToken,
        requester_hash: requesterHash,
        subject_type: "object",
        variant: "clicker",
        colour_count: 2,
        original_path: artworkPath,
        artwork_path: artworkPath,
        model: "customer-upload",
        status: "generated"
      });
      if (logError) {
        await supabase.storage.from("customer-artwork").remove([artworkPath]);
        throw logError;
      }
      const { data: signedArtwork, error: signedError } = await supabase.storage
        .from("customer-artwork")
        .createSignedUrl(artworkPath, 60 * 60 * 2);
      if (signedError) throw signedError;
      return json({
        generation_id: uploadId,
        artwork_path: artworkPath,
        artwork_url: signedArtwork.signedUrl
      });
    }

    if (!openAiKey) {
      return json({ error: "The AI photo studio is not configured yet." }, 503);
    }
    let isVerifiedAdminPreview = false;
    if (body.admin_preview === true) {
      const accessToken = String(request.headers.get("Authorization") || "")
        .replace(/^Bearer\s+/i, "")
        .trim();
      if (accessToken) {
        const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
        isVerifiedAdminPreview = !userError && Boolean(userData.user);
      }
    }

    if (body.action === "recolour") {
      const generationId = String(body.generation_id || "").trim();
      if (!/^[0-9a-f-]{36}$/i.test(generationId)) {
        return json({ error: "This artwork preview could not be found." }, 400);
      }
      const { data: requestRow, error: requestError } = await supabase
        .from("photo_artwork_requests")
        .select("artwork_path")
        .eq("id", generationId)
        .eq("client_token", clientToken)
        .maybeSingle();
      if (requestError) throw requestError;
      if (!requestRow?.artwork_path) {
        return json({ error: "This artwork preview has expired. Please create a new version." }, 404);
      }
      const { data: signedArtwork, error: signedError } = await supabase.storage
        .from("customer-artwork")
        .createSignedUrl(requestRow.artwork_path, 60 * 60 * 2);
      if (signedError) throw signedError;
      const { data: recolourUpload, error: recolourUploadError } = await supabase.storage
        .from("customer-artwork")
        .createSignedUploadUrl(requestRow.artwork_path, { upsert: true });
      if (recolourUploadError) throw recolourUploadError;
      return json({
        artwork_path: requestRow.artwork_path,
        artwork_url: signedArtwork.signedUrl,
        recolour_token: recolourUpload.token
      });
    }

    const imageDataUrl = String(body.image_data_url || "");
    const subjectType = ["person", "pet", "pet_person", "object"].includes(body.subject_type)
      ? body.subject_type
      : "person";
    const variant = body.variant === "clicker" ? "clicker" : "classic";
    const artworkStyle = ["true_to_photo", "cute_cartoon", "bold_graphic"].includes(body.artwork_style)
      ? body.artwork_style
      : "true_to_photo";
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
    const { bytes, mimeType } = decodeDataUrl(imageDataUrl);
    const requester = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("cf-connecting-ip") || "unknown";
    const requesterHash = await sha256(`${requester}:${Deno.env.get("PHOTO_RATE_LIMIT_SALT") || serviceRoleKey.slice(0, 24)}`);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    let recentAttempts: Array<{ created_at: string }> | null = null;
    let count: number | null = 0;
    if (!isVerifiedAdminPreview) {
      const attemptResult = await supabase
        .from("photo_artwork_requests")
        .select("created_at", { count: "exact" })
        .eq("requester_hash", requesterHash)
        .neq("model", "customer-upload")
        .gte("created_at", oneHourAgo)
        .order("created_at", { ascending: true })
        .limit(1);
      recentAttempts = attemptResult.data;
      count = attemptResult.count;
    }
    if (!isVerifiedAdminPreview && (count || 0) >= 5) {
      const resetAt = new Date(
        new Date(recentAttempts?.[0]?.created_at || Date.now()).getTime() + 60 * 60 * 1000
      );
      const retryAfterSeconds = Math.max(60, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
      return json({
        error: "You have used all 5 previews for this hour.",
        attempts_used: 5,
        attempts_remaining: 0,
        retry_after_seconds: retryAfterSeconds,
        retry_at: resetAt.toISOString()
      }, 429);
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
    const styleDirection = artworkStyle === "cute_cartoon"
      ? "Use a cute cartoon style: rounded friendly shapes, softly simplified features, a warm expression and slightly larger expressive eyes. Keep the subject clearly recognizable and do not invent accessories or markings."
      : artworkStyle === "bold_graphic"
        ? "Use a bold graphic style: chunky high-contrast shapes, very thick clean outlines and the fewest practical details. Favour strong recognizability and print reliability over realism."
        : "Use an identity-locked, true-to-reference style. Treat the uploaded image as a strict composition reference, not loose inspiration. Preserve the subject's exact proportions, pose, expression, age, hairstyle, clothing silhouette, object geometry and distinctive features as closely as the limited flat-colour medium permits. Simplify only what is physically necessary for printing. Do not beautify, caricature, restyle or redesign the subject.";
    const subjectDirection = subjectType === "person"
      ? "IDENTITY IS THE HIGHEST PRIORITY. Keep one or two main people together and do not omit either person. Match each person's face shape, head-to-body proportions, hairstyle and hairline, eyebrow shape, eye spacing, nose placement, mouth shape, expression, pose and outfit silhouette to the reference. Do not change their age, ethnicity, pose, clothes, accessories or relationship to each other. Use exactly one single flat filament colour for all visible skin across every face, neck, ear, arm and hand. Completely ignore photographic lighting, highlights, shadows, blush and reflections on skin: never turn them into additional skin colours or white patches. Preserve likeness through geometry and feature placement, not through skin shading."
      : subjectType === "pet"
        ? "IDENTITY IS THE HIGHEST PRIORITY. Keep one or two main pets together and do not omit either pet. Match each pet's real species or breed, body proportions, ear shape, face shape, eye spacing, expression, pose and distinctive coat markings. Do not make the animal generic and do not invent clothes, bows, accessories, protruding tongues or markings that are not in the reference. Ignore photographic lighting, highlights, shadows and reflections when separating the pets into colour regions."
        : subjectType === "pet_person"
          ? "IDENTITY IS THE HIGHEST PRIORITY. Keep exactly the main person and their pet together as one compact composition. Match the person's face shape, hairstyle, hairline, expression, pose and outfit silhouette. Use exactly one single flat filament colour for all visible human skin across the face, neck, ears, arms and hands; completely ignore skin lighting, highlights, shadows, blush and reflections. Match the pet's species or breed, proportions, ear shape, face shape, expression and distinctive coat markings. Preserve the exact natural pose and relationship between the person and pet. Do not omit either subject, merge their features, or invent clothing, accessories or markings."
          : "TRACE THE MAIN OBJECT FAITHFULLY. Preserve its exact outer silhouette, proportions, orientation, internal cut-outs, line angles and negative spaces. If the source is a simple emblem, number, wordmark or graphic, reproduce its visible geometry and layout as closely as possible instead of redesigning or stylising it. Keep readable numerals and short lettering faithful to the reference. Do not add new symbols, characters, outlines or decorative details. Ignore photographic lighting, highlights, shadows and reflections when separating the object into colour regions.";
    const prompt = [
      `Transform the selected main ${subjectType} subject or subjects in this image into clean artwork specifically for a small FDM 3D-printed keychain. Include every selected main subject, with no more than two subjects total.`,
      styleDirection,
      subjectDirection,
      `Use no more than ${colourCount} flat solid colours including outlines.`,
      `Use only colours from this available physical filament palette: ${filamentPalette.map(item => `${item.name} (${item.hex})`).join(", ")}. Choose the closest matches and do not invent any colour outside this list.`,
      subjectType === "object"
        ? "Keep the object as a clean trace with bold connected shapes and smooth closed outlines. Remove the surrounding scene, frame and background. Use no gradients, shadows or textures."
        : "Keep the subject recognizable, with bold connected shapes and smooth closed outlines. Use no gradients, shadows, textures, text, logos, scenery, frame or background.",
      "Remove tiny details and isolated specks. Every important stroke and gap must remain thick enough to print at approximately 60 mm wide; target at least 1.2 mm features.",
      variant === "clicker"
        ? "This is the Clicker version. Do not draw or include any keyring hole, hanging loop, eyelet, attachment tab, ring, or circular cut-out. Keep the subject's outer silhouette clean and natural all the way around."
        : "This is the Classic keychain version. Keep the silhouette compact with a safe solid area near an upper corner for its keyring hole.",
      "Return one centred front-facing sticker-like design on a transparent background. Do not add mockups, keyrings, hands, or product photography."
    ].join(" ");

    const form = new FormData();
    form.append("model", model);
    form.append("image", new Blob([bytes], { type: mimeType }), mimeType === "image/png" ? "photo.png" : "photo.jpg");
    form.append("prompt", prompt);
    form.append("size", "1024x1024");
    form.append("quality", "high");
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

    const requestLog = {
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
    };
    let { error: logError } = await supabase.from("photo_artwork_requests").insert(requestLog);
    if (logError?.code === "23514" && subjectType === "pet_person") {
      ({ error: logError } = await supabase.from("photo_artwork_requests").insert({
        ...requestLog,
        subject_type: "person"
      }));
    }
    if (logError) throw logError;

    const { data: signedArtwork, error: signedError } = await supabase.storage
      .from("customer-artwork")
      .createSignedUrl(artworkPath, 60 * 60 * 2);
    if (signedError) throw signedError;
    const { data: recolourUpload, error: recolourUploadError } = await supabase.storage
      .from("customer-artwork")
      .createSignedUploadUrl(artworkPath, { upsert: true });
    if (recolourUploadError) throw recolourUploadError;

    return json({
      generation_id: generationId,
      original_path: originalPath,
      artwork_path: artworkPath,
      artwork_url: signedArtwork.signedUrl,
      recolour_token: recolourUpload.token,
      attempts_used: (count || 0) + 1,
      attempts_remaining: isVerifiedAdminPreview ? null : Math.max(0, 4 - (count || 0)),
      unlimited: isVerifiedAdminPreview,
      retry_at: isVerifiedAdminPreview ? null : new Date(
        new Date(recentAttempts?.[0]?.created_at || Date.now()).getTime() + 60 * 60 * 1000
      ).toISOString()
    });
  } catch (error) {
    console.error("generate-photo-keepsake failed", error);
    return json({ error: error instanceof Error ? error.message : "Unable to create artwork." }, 500);
  }
});
