export const MODULAR_PRODUCT_KEY = "modular-clicky-keychain";
export const SOLID_PRODUCT_KEY = "solid-clicky-keychain";
export const STANDARD_PRODUCT_KEY = "standard-name-keychain";
export const PHOTO_PRODUCT_KEY = "ai-photo-keepsake";
export const PENCIL_PRODUCT_KEY = "custom-pencil-clicker";
const PRODUCT_STATUSES = new Set(["active", "coming_soon", "hidden"]);

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
  return (Array.isArray(catalog) ? catalog : []).map(product => ({
    ...product,
    status: overrides[product.product_key] || product.status
  }));
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
    minimum_characters: 1,
    maximum_characters: 10,
    base_print_minutes_fixed: 0,
    base_print_minutes_per_character: 25,
    keycap_print_minutes_per_character: 15,
    assembly_minutes_per_item: 0,
    minimum_working_days: null,
    maximum_working_days: null,
    sort_order: 10,
    image_path: "/images/modular-clicky-keychain.jpg",
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
    image_path: null,
    production_notes: "Use the matching licensed Compact Fidget Clicker solid base for 1–10 slots, plus one chunky keycap and switch per character."
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
    usual_base_price: 15,
    launch_base_price: 12,
    launch_price_enabled: true,
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
    image_path: null,
    production_notes: "Prepare one licensed Clickify 3D Pencil Body and matching Flat/Raised top per character. Confirm block, top, character, eraser, ferrule, wood, tip and end-cap colours before slicing."
  }
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
  "sort_order"
];

export function normalizeProductCatalog(rows = []) {
  const savedByKey = new Map(
    (Array.isArray(rows) ? rows : [])
      .filter(row => row?.product_key)
      .map(row => [String(row.product_key), row])
  );

  const defaults = DEFAULT_PRODUCT_CATALOG.map(fallback => {
    const saved = savedByKey.get(fallback.product_key) || {};
    const product = { ...fallback, ...saved };

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

    numericFields.forEach(field => {
      if (
        ["minimum_working_days", "maximum_working_days"].includes(field) &&
        (product[field] === null || product[field] === "")
      ) {
        product[field] = null;
        return;
      }
      const value = Number(product[field]);
      product[field] = Number.isFinite(value) ? value : fallback[field];
    });

    product.launch_price_enabled = product.launch_price_enabled !== false;
    product.price_visible = product.price_visible === true;
    return product;
  });

  const knownKeys = new Set(defaults.map(product => product.product_key));
  const additional = (Array.isArray(rows) ? rows : [])
    .filter(row => row?.product_key && !knownKeys.has(String(row.product_key)))
    .map(row => ({ ...row }));

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
