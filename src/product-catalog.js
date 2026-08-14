export const MODULAR_PRODUCT_KEY = "modular-clicky-keychain";
export const SOLID_PRODUCT_KEY = "solid-clicky-keychain";
export const STANDARD_PRODUCT_KEY = "standard-name-keychain";

export const DEFAULT_PRODUCT_CATALOG = [
  {
    product_key: MODULAR_PRODUCT_KEY,
    name: "Chunky Clicky Keychain",
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
    sort_order: 10,
    image_path: "/images/modular-clicky-keychain.jpg",
    production_notes: "One modular base and one keycap are printed for every character."
  },
  {
    product_key: SOLID_PRODUCT_KEY,
    name: "Solid Clicky Keychain",
    eyebrow: "One-piece design",
    description: "A clean solid base with the same satisfying click.",
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
    minimum_characters: 2,
    maximum_characters: 12,
    base_print_minutes_fixed: 0,
    base_print_minutes_per_character: 0,
    keycap_print_minutes_per_character: 15,
    assembly_minutes_per_item: 0,
    sort_order: 20,
    image_path: null,
    production_notes: "Draft pricing only. Time 2-, 6- and 10-character test prints before launch."
  },

  {
    product_key: STANDARD_PRODUCT_KEY,
    name: "Normal Name Keychain",
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

    sort_order: 30,
    image_path: null,

    production_notes:
      "Normal personalised name keychain without clickable keycaps."
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
      product.name === "Modular Clicky Keychain"
    ) {
      product.name = fallback.name;
    }

    numericFields.forEach(field => {
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
