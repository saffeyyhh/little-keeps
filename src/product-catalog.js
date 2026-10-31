export const MODULAR_PRODUCT_KEY = "modular-clicky-keychain";
export const SOLID_PRODUCT_KEY = "solid-clicky-keychain";
export const STANDARD_PRODUCT_KEY = "standard-name-keychain";
export const PHOTO_PRODUCT_KEY = "ai-photo-keepsake";
export const PENCIL_PRODUCT_KEY = "custom-pencil-clicker";
export const LED_PRODUCT_KEY = "light-up-name-clicker";
export const NORMAL_GRID_PRODUCT_KEY = "classic-grid-name-clicker";
export const IMAGE_CLICKER_PRODUCT_KEY = "custom-image-clicker";
export const MANUAL_CUSTOM_PRODUCT_KEY = "manual-custom-item";
export const RETIRED_PRODUCT_KEYS = Object.freeze([IMAGE_CLICKER_PRODUCT_KEY]);
const RETIRED_PRODUCT_KEY_SET = new Set(RETIRED_PRODUCT_KEYS);
export const READY_MADE_PRODUCT_TYPE = "ready_made";
export const CUSTOM_PRODUCT_TYPE = "custom";
export const CRITTER_LAUNCH_PRODUCT_KEYS = Object.freeze([
  "critter-chonky-cat",
  "critter-baby-sunflower",
  "critter-ghost"
]);
export const CRITTER_LAUNCH_UNIT_PRICE = 5.9;
export const CRITTER_LAUNCH_BUNDLE_QUANTITY = 3;
export const CRITTER_LAUNCH_BUNDLE_PRICE = 15;
export const PHOTO_KEEPSAKE_COLOUR_PRICES = Object.freeze({
  2: 6.5,
  3: 7.5,
  4: 8.5
});
export const DEFAULT_KPOP_CLICKER_MODELS = Object.freeze([
  { key: "baby-dragon", name: "Baby Dragon", accent: "#f383a0", modelUrl: "/models/critter-clickers/baby-dragon.3mf", thumbnail: "/images/critter-clickers/baby-dragon.jpg" },
  { key: "baby-mushroom", name: "Baby Mushroom", accent: "#f15b5b", modelUrl: "/models/critter-clickers/baby-mushroom.3mf", thumbnail: "/images/critter-clickers/baby-mushroom.jpg" },
  { key: "baby-sunflower", name: "Baby Sunflower", accent: "#ffc400", modelUrl: "/models/critter-clickers/baby-sunflower.3mf", thumbnail: "/images/critter-clickers/baby-sunflower.jpg" },
  { key: "cactus-cat", name: "Cactus Cat", accent: "#43a047", modelUrl: "/models/critter-clickers/cactus-cat.3mf", thumbnail: "/images/critter-clickers/cactus-cat.jpg" },
  { key: "mini-cauldron", name: "Mini Cauldron", accent: "#6742a6", modelUrl: "/models/critter-clickers/mini-cauldron.3mf", thumbnail: "/images/critter-clickers/mini-cauldron.jpg" },
  { key: "chonky-cat", name: "Chonky Cat", accent: "#f0a65a", modelUrl: "/models/critter-clickers/chonky-cat.3mf", thumbnail: "/images/critter-clickers/chonky-cat.jpg" },
  { key: "mini-dumpling", name: "Mini Dumpling", accent: "#f3d7a4", modelUrl: "/models/critter-clickers/mini-dumpling.3mf", thumbnail: "/images/critter-clickers/mini-dumpling.jpg" },
  { key: "fruit-turtle", name: "Fruit Turtle", accent: "#4aa36b", modelUrl: "/models/critter-clickers/fruit-turtle.3mf", thumbnail: "/images/critter-clickers/fruit-turtle.jpg" },
  { key: "ghost", name: "Ghost", accent: "#e9e6df", modelUrl: "/models/critter-clickers/ghost.3mf", thumbnail: "/images/critter-clickers/ghost.jpg" },
  { key: "jack-o-lantern", name: "Jack-O’-Lantern", accent: "#ff781f", modelUrl: "/models/critter-clickers/jack-o-lantern.3mf", thumbnail: "/images/critter-clickers/jack-o-lantern.jpg" },
  { key: "mothman", name: "Mothman", accent: "#38343b", modelUrl: "/models/critter-clickers/mothman.3mf", thumbnail: "/images/critter-clickers/mothman.jpg" },
  { key: "potion", name: "Potion", accent: "#8752bd", modelUrl: "/models/critter-clickers/potion.3mf", thumbnail: "/images/critter-clickers/potion.jpg" }
]);
const CRITTER_COLLECTION_VARIANTS = Object.freeze({
  "fruit-turtle": [{ name: "Fruit design", values: ["Citrus", "Strawberry", "Kiwi", "Watermelon"] }]
});

export const DEFAULT_CRITTER_COLLECTIONS = Object.freeze(
  DEFAULT_KPOP_CLICKER_MODELS.map((model, index) => {
    const productKey = `critter-${model.key}`;
    const isLaunchProduct = CRITTER_LAUNCH_PRODUCT_KEYS.includes(productKey);
    const launchDescriptions = {
      "chonky-cat": "Round, grumpy-cute and made for endless belly clicks. Your tiny desk buddy for stressful days.",
      "baby-sunflower": "A pocket-sized ray of sunshine with the sweetest little face—and a very satisfying click.",
      ghost: "A shy little ghost with tiny colourful feet. Pick the leg colour that matches your spooky-cute mood."
    };
    return {
      product_key: productKey,
      product_type: READY_MADE_PRODUCT_TYPE,
      name: `${model.name} Clicker`,
      sku: `CRITTER-${model.key.toUpperCase()}`,
      eyebrow: "Licensed CritterCRAFT collection",
      description: launchDescriptions[model.key] || `A satisfying ${model.name} character clicker, made in the original fixed colours shown.`,
      status: isLaunchProduct ? "active" : "hidden",
      price_visible: isLaunchProduct,
      usual_base_price: 6.9,
      launch_base_price: isLaunchProduct ? CRITTER_LAUNCH_UNIT_PRICE : 6.9,
      launch_price_enabled: isLaunchProduct,
      launch_price_ends_at: null,
      included_characters: 1,
      extra_character_price: 0,
      included_base_colours: 1,
      included_cap_colours: 1,
      included_letter_colours: 0,
      extra_base_colour_price: 0,
      extra_cap_colour_price: 0,
      extra_letter_colour_price: 0,
      minimum_characters: 1,
      maximum_characters: 1,
      base_print_minutes_fixed: 25,
      base_print_minutes_per_character: 0,
      keycap_print_minutes_per_character: 20,
      assembly_minutes_per_item: 5,
      minimum_working_days: null,
      maximum_working_days: null,
      stock_quantity: 250,
      options: CRITTER_COLLECTION_VARIANTS[model.key] || [],
      featured: model.key === "chonky-cat",
      sort_order: 60 + index,
      image_path: model.thumbnail,
      gallery_paths: [model.thumbnail],
      video_path: "",
      kpop_models: [model],
      production_notes: `Licensed CritterCRAFT ${model.name}. Use ${model.modelUrl} and print only the selected fixed-colour keychain variant.`
    };
  })
);

export function isCritterLaunchProduct(productOrKey) {
  const productKey = typeof productOrKey === "string"
    ? productOrKey
    : productOrKey?.product_key;
  return CRITTER_LAUNCH_PRODUCT_KEYS.includes(String(productKey || ""));
}

export function calculateCritterLaunchBundleDiscount(quantity = 0) {
  const safeQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
  const bundleCount = Math.floor(safeQuantity / CRITTER_LAUNCH_BUNDLE_QUANTITY);
  const regularBundleTotal = CRITTER_LAUNCH_UNIT_PRICE * CRITTER_LAUNCH_BUNDLE_QUANTITY;
  return Math.round(
    (bundleCount * (regularBundleTotal - CRITTER_LAUNCH_BUNDLE_PRICE) + Number.EPSILON) * 100
  ) / 100;
}
const PRODUCT_STATUSES = new Set(["active", "coming_soon", "hidden"]);

export function normalizeKpopClickerModels(value = []) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const modelUrl = String(item.modelUrl || item.model_url || "").trim();
    if (!modelUrl) return [];
    const name = String(item.name || `Clicker design ${index + 1}`).trim();
    const key = String(item.key || name).toLowerCase().normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `design-${index + 1}`;
    const accent = /^#[0-9a-f]{6}$/i.test(String(item.accent || "")) ? String(item.accent) : "#f383a0";
    const previewMode = String(item.previewMode || item.preview_mode || "").trim() ||
      (modelUrl.startsWith("/models/critter-clickers/") ? "photo" : "3d");
    return [{ key, name, accent, modelUrl, thumbnail: String(item.thumbnail || item.thumbnail_url || "").trim(), previewMode }];
  });
}

export function getPhotoKeepsakeColourPrice(colourCount = 4) {
  const normalizedCount = Math.min(4, Math.max(2, Math.round(Number(colourCount) || 4)));
  return PHOTO_KEEPSAKE_COLOUR_PRICES[normalizedCount];
}

export function normalizeProductStatusOverrides(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([productKey, status]) => [String(productKey), String(status)])
      .filter(([productKey, status]) => productKey && PRODUCT_STATUSES.has(status))
  );
}

export function applyProductStatusOverrides(catalog = [], value = {}) {
  const overrides = normalizeProductStatusOverrides(value);
  return (Array.isArray(catalog) ? catalog : []).map(product => {
    const isLicensedCritterCollection = product.product_key === IMAGE_CLICKER_PRODUCT_KEY &&
      normalizeKpopClickerModels(product.kpop_models).some(model =>
        String(model.modelUrl || "").startsWith("/models/critter-clickers/")
      );
    const savedOverride = product.reactivated_from_retired_catalog
      ? undefined
      : overrides[product.product_key];
    const status = isLicensedCritterCollection
      ? "hidden"
      : isRetiredProduct(product)
      ? "hidden"
      : savedOverride || product.status;
    return {
      ...product,
      status,
      price_visible: isLicensedCritterCollection ? false : status === "active" ? true : product.price_visible
    };
  });
}

export function isRetiredProduct(productOrKey) {
  const productKey = typeof productOrKey === "string"
    ? productOrKey
    : productOrKey?.product_key;
  return RETIRED_PRODUCT_KEY_SET.has(String(productKey || ""));
}

export function normalizeProductCatalogOverrides(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([productKey, settings]) => {
      if (!productKey || !settings || typeof settings !== "object" || Array.isArray(settings)) {
        return [];
      }
      return [[String(productKey), { ...settings, product_key: String(productKey) }]];
    })
  );
}

export function applyProductCatalogOverrides(catalog = [], value = {}) {
  const overrides = normalizeProductCatalogOverrides(value);
  return normalizeProductCatalog(
    (Array.isArray(catalog) ? catalog : []).map(product => ({
      ...product,
      ...(overrides[product.product_key] || {}),
      product_key: product.product_key
    }))
  );
}

export function formatProductUnitsSold(value) {
  const units = Math.max(0, Math.floor(Number(value) || 0));
  return `${units.toLocaleString("en-SG")} keychain${units === 1 ? "" : "s"} sold ♡`;
}

export const DEFAULT_PRODUCT_CATALOG = [
  {
    product_key: MODULAR_PRODUCT_KEY,
    name: "Chunky Modular Clicky Keychain",
    eyebrow: "Articulated design",
    description: "Flexible character blocks that move and click.",
    status: "active",
    price_visible: true,
    usual_base_price: 3.9,
    launch_base_price: 3.2,
    launch_price_enabled: true,
    launch_price_ends_at: null,
    included_characters: 6,
    extra_character_price: 0.2,
    included_base_colours: 1,
    included_cap_colours: 1,
    included_letter_colours: 1,
    extra_base_colour_price: 0.5,
    extra_cap_colour_price: 0.3,
    extra_letter_colour_price: 0.2,
    minimum_characters: 3,
    maximum_characters: 10,
    base_print_minutes_fixed: 0,
    base_print_minutes_per_character: 25,
    keycap_print_minutes_per_character: 15,
    assembly_minutes_per_item: 0,
    minimum_working_days: null,
    maximum_working_days: null,
    sort_order: 10,
    image_path: "/images/modular-clicky-keychain.jpg",
    gallery_paths: ["/images/modular-clicky-keychain.jpg"],
    video_path: "/media/modular-clicker-demo.mp4",
    production_notes: "One modular base and one keycap are printed for every character."
  },
  {
    product_key: SOLID_PRODUCT_KEY,
    name: "Compact Solid Clicky Keychain",
    eyebrow: "Compact one-piece base",
    description: "One sturdy base for up to 10 characters, made in one base colour with the same satisfying chunky clicks.",
    status: "coming_soon",
    price_visible: false,
    usual_base_price: 4.5,
    launch_base_price: 3.8,
    launch_price_enabled: true,
    launch_price_ends_at: null,
    included_characters: 6,
    extra_character_price: 0.3,
    included_base_colours: 1,
    included_cap_colours: 1,
    included_letter_colours: 1,
    extra_base_colour_price: 0,
    extra_cap_colour_price: 0.3,
    extra_letter_colour_price: 0.2,
    minimum_characters: 1,
    maximum_characters: 10,
    base_print_minutes_fixed: 0,
    base_print_minutes_per_character: 0,
    keycap_print_minutes_per_character: 15,
    assembly_minutes_per_item: 0,
    minimum_working_days: null,
    maximum_working_days: null,
    sort_order: 20,
    image_path: "/images/compact-solid-clicky-keychain.jpg",
    gallery_paths: ["/images/compact-solid-clicky-keychain.jpg"],
    video_path: "/media/compact-clicker-demo.mp4",
    production_notes: "Use the matching licensed Compact Fidget Clicker solid base for 1–10 slots, plus one chunky keycap and switch per character."
  },
  {
    product_key: LED_PRODUCT_KEY,
    name: "Light-Up Name Clicker",
    eyebrow: "Designed by Little Keeps",
    description: "A compact solid grid with light-up clicky caps for letters, numbers and icons.",
    status: "hidden",
    price_visible: false,
    usual_base_price: 0,
    launch_base_price: 0,
    launch_price_enabled: false,
    launch_price_ends_at: null,
    included_characters: 6,
    extra_character_price: 0,
    included_base_colours: 1,
    included_cap_colours: 1,
    included_letter_colours: 1,
    extra_base_colour_price: 0,
    extra_cap_colour_price: 0,
    extra_letter_colour_price: 0,
    minimum_characters: 1,
    maximum_characters: 9,
    base_print_minutes_fixed: 0,
    base_print_minutes_per_character: 0,
    keycap_print_minutes_per_character: 0,
    assembly_minutes_per_item: 0,
    minimum_working_days: null,
    maximum_working_days: null,
    sort_order: 21,
    image_path: "/images/light-up-name-clicker-bases.png",
    gallery_paths: [
      "/images/light-up-name-clicker-bases.png",
      "/images/light-up-name-clicker-keycaps.png"
    ],
    video_path: "",
    production_notes: "Little Keeps LED Base variant. Keep this product hidden until the light hardware, supported grid layouts, retail price and timed print settings are confirmed."
  },
  {
    product_key: NORMAL_GRID_PRODUCT_KEY,
    name: "Classic Grid Name Clicker",
    eyebrow: "Solid everyday clicker",
    description: "A sturdy grid-style clicker with opaque caps, raised letters or icons, and six base layouts for 3–12 slots.",
    status: "hidden",
    price_visible: false,
    usual_base_price: 0,
    launch_base_price: 0,
    launch_price_enabled: false,
    launch_price_ends_at: null,
    included_characters: 6,
    extra_character_price: 0,
    included_base_colours: 1,
    included_cap_colours: 1,
    included_letter_colours: 1,
    extra_base_colour_price: 0,
    extra_cap_colour_price: 0,
    extra_letter_colour_price: 0,
    minimum_characters: 1,
    maximum_characters: 12,
    base_print_minutes_fixed: 0,
    base_print_minutes_per_character: 0,
    keycap_print_minutes_per_character: 0,
    assembly_minutes_per_item: 0,
    minimum_working_days: null,
    maximum_working_days: null,
    sort_order: 22,
    image_path: "/images/classic-grid-clicker-bases.png",
    gallery_paths: [
      "/images/classic-grid-clicker-bases.png",
      "/images/classic-grid-clicker-keycaps.png",
      "/images/classic-grid-clicker-icons.png"
    ],
    video_path: "",
    production_notes: "Use the supplied Normal Clicker.3mf bases and matching opaque A–Z or icon keycaps. Confirm the chosen 3, 4, 6, 9 or 12-slot layout and all three colours before slicing."
  },

  {
    product_key: STANDARD_PRODUCT_KEY,
    name: "Customised Name Keychain",
    eyebrow: "Classic design",
    description: "A personalised name keychain without clickable switches.",
    status: "coming_soon",
    price_visible: false,

    usual_base_price: 3.5,
    launch_base_price: 3.5,
    launch_price_enabled: false,
    launch_price_ends_at: null,

    included_characters: 6,
    extra_character_price: 0.2,

    included_base_colours: 1,
    included_cap_colours: 0,
    included_letter_colours: 1,

    extra_base_colour_price: 0.5,
    extra_cap_colour_price: 0,
    extra_letter_colour_price: 0.2,

    minimum_characters: 1,
    maximum_characters: 10,

    base_print_minutes_fixed: 0,
    base_print_minutes_per_character: 25,
    keycap_print_minutes_per_character: 0,
    assembly_minutes_per_item: 0,
    minimum_working_days: null,
    maximum_working_days: null,

    sort_order: 30,
    image_path: null,

    production_notes:
      "Normal personalised name keychain without clickable keycaps."
  },
  {
    product_key: PHOTO_PRODUCT_KEY,
    name: "Photo Keepsake Keychain",
    eyebrow: "Your photo, simplified for 3D printing",
    description: "Upload a person, pet or meaningful picture and receive a limited-colour illustrated keepsake.",
    status: "coming_soon",
    price_visible: false,
    usual_base_price: 6.5,
    launch_base_price: 6.5,
    launch_price_enabled: false,
    launch_price_ends_at: null,
    included_characters: 50,
    extra_character_price: 0,
    included_base_colours: 1,
    included_cap_colours: 1,
    included_letter_colours: 1,
    extra_base_colour_price: 0,
    extra_cap_colour_price: 0,
    extra_letter_colour_price: 0,
    minimum_characters: 1,
    maximum_characters: 50,
    base_print_minutes_fixed: 120,
    base_print_minutes_per_character: 0,
    keycap_print_minutes_per_character: 0,
    assembly_minutes_per_item: 10,
    minimum_working_days: 4,
    maximum_working_days: 5,
    sort_order: 40,
    image_path: null,
    production_notes: "AI artwork requires a printability check before slicing. Keep this product coming soon until the OpenAI secret and storage migration are installed."
  },
  {
    product_key: PENCIL_PRODUCT_KEY,
    name: "Custom Pencil Clicker Keychain",
    eyebrow: "A pencil made completely yours",
    description: "Build a pencil with one satisfying clicky block per letter, number or symbol, then personalise every colour.",
    status: "coming_soon",
    price_visible: false,
    usual_base_price: 9.9,
    launch_base_price: 7.9,
    launch_price_enabled: true,
    launch_price_ends_at: null,
    included_characters: 6,
    extra_character_price: 0.2,
    included_base_colours: 1,
    included_cap_colours: 1,
    included_letter_colours: 1,
    extra_base_colour_price: 0.5,
    extra_cap_colour_price: 0.3,
    extra_letter_colour_price: 0.2,
    minimum_characters: 1,
    maximum_characters: 10,
    base_print_minutes_fixed: 90,
    base_print_minutes_per_character: 0,
    keycap_print_minutes_per_character: 0,
    assembly_minutes_per_item: 10,
    minimum_working_days: null,
    maximum_working_days: null,
    sort_order: 25,
    image_path: "/images/custom-pencil-clicker.jpg",
    gallery_paths: ["/images/custom-pencil-clicker.jpg"],
    video_path: "",
    production_notes: "Prepare one licensed Clickify 3D Pencil Body and matching Flat/Raised top per character. Confirm block, top, character, eraser, ferrule, wood, tip and end-cap colours before slicing."
  },
  {
    product_key: IMAGE_CLICKER_PRODUCT_KEY,
    name: "Critter Clickers",
    eyebrow: "Cute little characters with a satisfying click.",
    description: "Choose a licensed CritterCRAFT design in the original colours shown.",
    status: "hidden",
    price_visible: false,
    usual_base_price: 6.9,
    launch_base_price: 6.9,
    launch_price_enabled: false,
    launch_price_ends_at: null,
    included_characters: 1,
    extra_character_price: 0,
    included_base_colours: 1,
    included_cap_colours: 1,
    included_letter_colours: 0,
    extra_base_colour_price: 0,
    extra_cap_colour_price: 0,
    extra_letter_colour_price: 0,
    minimum_characters: 1,
    maximum_characters: 1,
    base_print_minutes_fixed: 25,
    base_print_minutes_per_character: 0,
    keycap_print_minutes_per_character: 20,
    assembly_minutes_per_item: 5,
    minimum_working_days: null,
    maximum_working_days: null,
    sort_order: 22,
    image_path: "/images/critter-clickers/baby-dragon.jpg",
    gallery_paths: [
      "/images/critter-clickers/baby-dragon.jpg",
      "/images/critter-clickers/chonky-cat.jpg",
      "/images/critter-clickers/mini-dumpling.jpg"
    ],
    video_path: "",
    kpop_models: DEFAULT_KPOP_CLICKER_MODELS,
    production_notes: "Licensed CritterCRAFT design. Print the selected 3MF clicker body and cap in the original fixed colours shown."
  },
  {
    product_key: MANUAL_CUSTOM_PRODUCT_KEY,
    product_type: "manual_custom",
    name: "Custom DM Item",
    eyebrow: "Admin-only custom item",
    description: "A free-form item entered by Little Keeps for a manual order.",
    status: "hidden",
    price_visible: false,
    usual_base_price: 0,
    launch_base_price: 0,
    launch_price_enabled: false,
    launch_price_ends_at: null,
    included_characters: 999,
    extra_character_price: 0,
    included_base_colours: 0,
    included_cap_colours: 0,
    included_letter_colours: 0,
    extra_base_colour_price: 0,
    extra_cap_colour_price: 0,
    extra_letter_colour_price: 0,
    minimum_characters: 1,
    maximum_characters: 999,
    base_print_minutes_fixed: 0,
    base_print_minutes_per_character: 0,
    keycap_print_minutes_per_character: 0,
    assembly_minutes_per_item: 0,
    minimum_working_days: null,
    maximum_working_days: null,
    sort_order: 999,
    image_path: null,
    production_notes: "Follow the production notes entered on the manual order."
  },
  ...DEFAULT_CRITTER_COLLECTIONS
];

const numericFields = [
  "usual_base_price",
  "launch_base_price",
  "included_characters",
  "extra_character_price",
  "included_base_colours",
  "included_cap_colours",
  "included_letter_colours",
  "extra_base_colour_price",
  "extra_cap_colour_price",
  "extra_letter_colour_price",
  "minimum_characters",
  "maximum_characters",
  "base_print_minutes_fixed",
  "base_print_minutes_per_character",
  "keycap_print_minutes_per_character",
  "assembly_minutes_per_item",
  "minimum_working_days",
  "maximum_working_days",
  "sort_order",
  "stock_quantity"
];

export function normalizeProductOptions(value = []) {
  const source = Array.isArray(value) ? value : [];
  return source
    .map(option => ({
      name: String(option?.name || "").trim(),
      values: Array.from(new Set(
        (Array.isArray(option?.values) ? option.values : [])
          .map(item => String(item || "").trim())
          .filter(Boolean)
      ))
    }))
    .filter(option => option.name && option.values.length)
    .slice(0, 5);
}

export function isReadyMadeProduct(product) {
  return product?.product_type === READY_MADE_PRODUCT_TYPE;
}

export function normalizeProductCatalog(rows = []) {
  const savedByKey = new Map(
    (Array.isArray(rows) ? rows : [])
      .filter(row => row?.product_key)
      .map(row => [String(row.product_key), row])
  );

  const defaults = DEFAULT_PRODUCT_CATALOG.map(fallback => {
    const saved = savedByKey.get(fallback.product_key) || {};
    const product = { ...fallback, ...saved };

    if (isCritterLaunchProduct(fallback)) {
      const usesLegacyCritterListing = !saved.description || /^A satisfying .+ character clicker/i.test(String(saved.description));
      if (usesLegacyCritterListing) {
        product.description = fallback.description;
        product.usual_base_price = fallback.usual_base_price;
        product.launch_base_price = fallback.launch_base_price;
        product.launch_price_enabled = true;
        product.price_visible = true;
      }
      if (!String(saved.image_path || "").trim()) {
        product.image_path = fallback.image_path;
      }
      if (!Array.isArray(saved.gallery_paths) || !saved.gallery_paths.filter(Boolean).length) {
        product.gallery_paths = fallback.gallery_paths;
      }
    }

    if (
      fallback.product_key === MODULAR_PRODUCT_KEY &&
      [
        "Modular Clicky Keychain",
        "Modular Base Clicky Keychain",
        "Chunky Clicky Keychain"
      ].includes(product.name)
    ) {
      product.name = fallback.name;
    }

    if (fallback.product_key === SOLID_PRODUCT_KEY) {
      if (["Solid Clicky Keychain", "Solid Base Clicky Keychain"].includes(product.name)) {
        product.name = fallback.name;
      }
      if (product.eyebrow === "One-piece design") {
        product.eyebrow = fallback.eyebrow;
      }
      if ([
        "A clean solid base with the same satisfying click.",
        "One sturdy base with the same satisfying chunky clicks."
      ].includes(product.description)) {
        product.description = fallback.description;
      }
      product.minimum_characters = 1;
      product.maximum_characters = Math.min(10, Math.max(1, Number(product.maximum_characters) || 10));
      if (!product.production_notes || product.production_notes.startsWith("Draft pricing only")) {
        product.production_notes = fallback.production_notes;
      }
    }

    if (fallback.product_key === PENCIL_PRODUCT_KEY) {
      if (product.description === "Personalise the name, lettering style and every pencil part colour, finished with one satisfying clicker.") {
        product.description = fallback.description;
      }
      if (product.production_notes === "Prepare in the licensed Clickify 3D Custom Pencil Clicker project. Confirm body, name, eraser, ferrule, wood, tip, end-cap and lettering-style choices before slicing.") {
        product.production_notes = fallback.production_notes;
      }
      const usesOriginalFlatPricing = Number(product.included_characters) === 10 &&
        Number(product.extra_character_price) === 0 &&
        Number(product.extra_base_colour_price) === 0 &&
        Number(product.extra_cap_colour_price) === 0 &&
        Number(product.extra_letter_colour_price) === 0;
      if (usesOriginalFlatPricing) {
        product.included_characters = fallback.included_characters;
        product.extra_character_price = fallback.extra_character_price;
        product.extra_base_colour_price = fallback.extra_base_colour_price;
        product.extra_cap_colour_price = fallback.extra_cap_colour_price;
        product.extra_letter_colour_price = fallback.extra_letter_colour_price;
      }
    }

    if (fallback.product_key === IMAGE_CLICKER_PRODUCT_KEY) {
      const savedModels = normalizeKpopClickerModels(saved.kpop_models);
      const usesRetiredKpopLibrary = savedModels.length > 0 && savedModels.every(model =>
        String(model.modelUrl || "").startsWith("/models/kpop/")
      );
      const hasCritterLibrary = savedModels.some(model =>
        String(model.modelUrl || "").startsWith("/models/critter-clickers/")
      );
      if (!hasCritterLibrary || usesRetiredKpopLibrary || /k-pop/i.test(String(product.name || ""))) {
        product.reactivated_from_retired_catalog = true;
        product.name = fallback.name;
        product.eyebrow = fallback.eyebrow;
        product.description = fallback.description;
        product.status = fallback.status;
        product.price_visible = fallback.price_visible;
        product.image_path = fallback.image_path;
        product.gallery_paths = fallback.gallery_paths;
        product.kpop_models = fallback.kpop_models;
        product.production_notes = fallback.production_notes;
      }
    }

    numericFields.forEach(field => {
      if (
        ["minimum_working_days", "maximum_working_days"].includes(field) &&
        (product[field] === null || product[field] === "")
      ) {
        product[field] = null;
        return;
      }
      const value = Number(product[field]);
      product[field] = Number.isFinite(value) ? value : (fallback[field] ?? 0);
    });

    product.launch_price_enabled = product.launch_price_enabled !== false;
    product.price_visible = product.status === "active" || product.price_visible === true;
    product.product_type = product.product_type || CUSTOM_PRODUCT_TYPE;
    product.options = normalizeProductOptions(product.options);
    product.gallery_paths = Array.from(new Set(
      (Array.isArray(product.gallery_paths) ? product.gallery_paths : [])
        .map(path => String(path || "").trim())
        .filter(Boolean)
    ));
    if (!product.gallery_paths.length && product.image_path) {
      product.gallery_paths = [String(product.image_path)];
    }
    product.video_path = String(product.video_path || "").trim();
    product.kpop_models = normalizeKpopClickerModels(product.kpop_models);
    if (isRetiredProduct(product)) {
      product.status = "hidden";
      product.price_visible = false;
    }
    return product;
  });

  const knownKeys = new Set(defaults.map(product => product.product_key));
  const additional = (Array.isArray(rows) ? rows : [])
    .filter(row => row?.product_key && !knownKeys.has(String(row.product_key)))
    .map(row => {
      const product = {
        eyebrow: "Ready-made collection",
        description: "A small-batch Little Keeps design, made in Singapore.",
        status: "hidden",
        price_visible: true,
        usual_base_price: 0,
        launch_base_price: 0,
        launch_price_enabled: false,
        included_characters: 999,
        extra_character_price: 0,
        included_base_colours: 1,
        included_cap_colours: 1,
        included_letter_colours: 1,
        extra_base_colour_price: 0,
        extra_cap_colour_price: 0,
        extra_letter_colour_price: 0,
        minimum_characters: 1,
        maximum_characters: 999,
        product_type: READY_MADE_PRODUCT_TYPE,
        stock_quantity: 0,
        options: [],
        gallery_paths: [],
        video_path: "",
        ...row
      };
      numericFields.forEach(field => {
        const value = Number(product[field]);
        product[field] = Number.isFinite(value) ? value : 0;
      });
      product.options = normalizeProductOptions(product.options);
      product.gallery_paths = Array.from(new Set(
        (Array.isArray(product.gallery_paths) ? product.gallery_paths : [])
          .map(path => String(path || "").trim())
          .filter(Boolean)
      ));
      if (!product.gallery_paths.length && product.image_path) {
        product.gallery_paths = [String(product.image_path)];
      }
      product.video_path = String(product.video_path || "").trim();
      product.kpop_models = normalizeKpopClickerModels(product.kpop_models);
      return product;
    });

  return [...defaults, ...additional].sort(
    (left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0)
  );
}

export function getProductByKey(catalog, productKey = MODULAR_PRODUCT_KEY) {
  const products = normalizeProductCatalog(catalog);
  return products.find(product => product.product_key === productKey) || products[0];
}

export function getProductDisplayPrice(product, now = Date.now()) {
  const deadline = Date.parse(String(product?.launch_price_ends_at || ""));
  const deadlineActive = Number.isFinite(deadline) && now < deadline;
  const hasNoDeadline = !Number.isFinite(deadline);
  const launchActive = product?.launch_price_enabled !== false &&
    (hasNoDeadline || deadlineActive);

  return launchActive
    ? Number(product?.launch_base_price || 0)
    : Number(product?.usual_base_price || 0);
}

export function calculateProductUnitPrice({
  product,
  characterCount = 0,
  baseColourCount = 1,
  capColourCount = 1,
  letterColourCount = 1
}) {
  const safeCount = Math.max(0, Math.floor(Number(characterCount) || 0));
  const extraCharacters = Math.max(
    0,
    safeCount - Math.max(0, Number(product?.included_characters) || 0)
  );
  const extraBaseColours = Math.max(
    0,
    Number(baseColourCount || 0) - Number(product?.included_base_colours || 0)
  );
  const extraCapColours = Math.max(
    0,
    Number(capColourCount || 0) - Number(product?.included_cap_colours || 0)
  );
  const extraLetterColours = Math.max(
    0,
    Number(letterColourCount || 0) - Number(product?.included_letter_colours || 0)
  );

  const price =
    getProductDisplayPrice(product) +
    extraCharacters * Number(product?.extra_character_price || 0) +
    extraBaseColours * Number(product?.extra_base_colour_price || 0) +
    extraCapColours * Number(product?.extra_cap_colour_price || 0) +
    extraLetterColours * Number(product?.extra_letter_colour_price || 0);

  return Math.round((price + Number.EPSILON) * 100) / 100;
}

export function calculateProductProductionEstimate(
  product,
  characterCount = 0,
  quantity = 1
) {
  const characters = Math.max(0, Math.floor(Number(characterCount) || 0));
  const items = Math.max(0, Math.floor(Number(quantity) || 0));
  const baseMinutesPerItem =
    Number(product?.base_print_minutes_fixed || 0) +
    characters * Number(product?.base_print_minutes_per_character || 0);
  const keycapMinutesPerItem =
    characters * Number(product?.keycap_print_minutes_per_character || 0);

  return {
    productKey: product?.product_key || "",
    quantity: items,
    characterCount: characters,
    baseMinutes: baseMinutesPerItem * items,
    keycapMinutes: keycapMinutesPerItem * items,
    assemblyMinutes: Number(product?.assembly_minutes_per_item || 0) * items,
    totalMinutes:
      (baseMinutesPerItem + keycapMinutesPerItem) * items +
      Number(product?.assembly_minutes_per_item || 0) * items
  };
}
