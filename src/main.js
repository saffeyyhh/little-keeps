import "./style.css";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import polygonClipping from "polygon-clipping";
import confetti from "canvas-confetti";
import { createClient } from "@supabase/supabase-js";
import emailjs from "@emailjs/browser";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import {
  getArtworkColourClusters,
  mapArtworkClustersToFilaments,
  normalizePhotoFilamentPalette
} from "./photo-palette.js";
import {
  exportPhotoGeometryStl,
  preparePhotoArtworkStlParts
} from "./photo-stl.js";
import {
  calculateGiftingBagTotal,
  formatDateRange,
  getCustomerDueDate,
  getBulkApprovalPolicy,
  getGiftingBagSelectionLimit,
  getPickupTimeRanges,
  isPickupDay,
  isOrderReminderFinishedOrExpired,
  isSharedGroupCancelledOrExpired,
  flattenSharedGroupContributions,
  normalizePickupTimeOptions,
  pickRandomDesignColourSets
} from "./admin-logic.js";
import {
  DEFAULT_PRODUCT_CATALOG,
  MODULAR_PRODUCT_KEY,
  SOLID_PRODUCT_KEY,
  STANDARD_PRODUCT_KEY,
  PHOTO_PRODUCT_KEY,
  PENCIL_PRODUCT_KEY,
  READY_MADE_PRODUCT_TYPE,
  applyProductCatalogOverrides,
  applyProductStatusOverrides,
  calculateProductUnitPrice,
  formatProductUnitsSold,
  getProductByKey,
  getProductDisplayPrice,
  normalizeProductCatalogOverrides,
  normalizeProductStatusOverrides,
  normalizeProductCatalog,
  normalizeProductOptions,
  isReadyMadeProduct
} from "./product-catalog.js";
import {
  DEFAULT_COLOUR_OPTIONS,
  normalizeColourOptions
} from "./colour-catalog.js";
import { normalizeAiDesignSuggestions } from "./ai-logic.js";
import {
  PENCIL_ICON_CATEGORIES,
  PENCIL_SYMBOLS,
  sanitizePencilCharacters
} from "./pencil-characters.js";
import {
  calculatePromoDiscount,
  getPromoEligibility as assessPromoEligibility,
  normalizePromoCode
} from "./promo-logic.js";
import {
  formatDesignBatchNames,
  parseDesignBatchNames
} from "./design-batches.js";

const pageUrlParams = new URLSearchParams(window.location.search);
const isManualOrder = pageUrlParams.get("manual") === "true";
const requestedPreviewProductKey = String(pageUrlParams.get("preview_product") || "").trim();

console.log("Manual mode:", isManualOrder);

const SUPABASE_URL = "https://jetamtthfenjyzcdklqm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_IXgEB4mpCTF3zOhkulGOYw_fcDwgiHf";
const EMAILJS_SERVICE = "service_joll6ie";
const EMAILJS_PUBLIC = "dRppqgrkwps-kd6W-";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
emailjs.init(EMAILJS_PUBLIC);

const DEFAULT_SHOP_SETTINGS = {
  usual_base_price: 3.9,
  launch_base_price: 3.2,
  launch_price_enabled: true,
  launch_price_ends_at: null,
  included_characters: 6,
  extra_character_price: 0.2,
  extra_base_colour_price: 0.5,
  extra_cap_colour_price: 0.3,
  extra_letter_colour_price: 0.2,
  delivery_fee: 2.5,
  free_delivery_threshold: 50,
  max_orders_per_date: 2,
  bulk_buffer_days: 1,
  large_order_quantity: 7,
  standard_min_working_days: 2,
  standard_max_working_days: 3,
  large_min_working_days: 4,
  large_max_working_days: 5,
  bulk_order_quantity: 15,
  rush_fee_small: 5,
  rush_fee_large: 8,
  nfc_addon_price: 2.5,
  photo_clicker_addon_price: 3,
  stripe_enabled: false,
  status_emails_enabled: false,
  status_email_template_id: "",
  unavailable_colours: [],
  colour_options: DEFAULT_COLOUR_OPTIONS,
  promo_code: "CHILDRENSDAY",
  promo_percent_off: 10,
  promo_enabled: true,
  pickup_time_options: {
    weekday: ["7:00 PM", "7:30 PM", "8:00 PM"],
    weekend: ["10:00 AM", "2:00 PM", "7:00 PM"]
  }
};

let shopSettings = { ...DEFAULT_SHOP_SETTINGS };
let productCatalog = normalizeProductCatalog(DEFAULT_PRODUCT_CATALOG);
let productCatalogOverrides = {};
let productStatusOverrides = {};

const DEFAULT_DESIGN_PRESETS = [
  {
    preset_key: "strawberry",
    name: "Strawberry Milk",
    emoji: "🍓",
    base_colour: "#F55A74",
    cap_colour: "#FFFFFF",
    letter_colour: "#9D2235",
    icon_suggestion: "♡"
  },
  {
    preset_key: "matcha",
    name: "Matcha Cream",
    emoji: "🍵",
    base_colour: "#3F8E43",
    cap_colour: "#FFFFFF",
    letter_colour: "#68724D",
    icon_suggestion: "☘"
  },
  {
    preset_key: "ocean",
    name: "Ocean Pop",
    emoji: "🫧",
    base_colour: "#00B1B7",
    cap_colour: "#FFFFFF",
    letter_colour: "#0086D6",
    icon_suggestion: "☁"
  },
  {
    preset_key: "grape",
    name: "Grape Soda",
    emoji: "🍇",
    base_colour: "#5E43B7",
    cap_colour: "#FFFFFF",
    letter_colour: "#482960",
    icon_suggestion: "★"
  },
  {
    preset_key: "honey-bee",
    name: "Honey Bee",
    emoji: "🐝",
    base_colour: "#FEC600",
    cap_colour: "#000000",
    letter_colour: "#FEC600",
    icon_suggestion: "✿"
  },
  {
    preset_key: "pink-lemonade",
    name: "Pink Lemonade",
    emoji: "🍋",
    base_colour: "#F55A74",
    cap_colour: "#FEC600",
    letter_colour: "#9D2235",
    icon_suggestion: "♡"
  },
  {
    preset_key: "taro-milk",
    name: "Taro Milk",
    emoji: "🧋",
    base_colour: "#5E43B7",
    cap_colour: "#FFFFFF",
    letter_colour: "#482960",
    icon_suggestion: "★"
  },
  {
    preset_key: "forest-berry",
    name: "Forest Berry",
    emoji: "🌲",
    base_colour: "#68724D",
    cap_colour: "#FFFFFF",
    letter_colour: "#9D2235",
    icon_suggestion: "☘"
  },
  {
    preset_key: "monochrome",
    name: "Classic Mono",
    emoji: "🖤",
    base_colour: "#000000",
    cap_colour: "#FFFFFF",
    letter_colour: "#000000",
    icon_suggestion: "★"
  },
  {
    preset_key: "golden-hour",
    name: "Golden Hour",
    emoji: "🌤️",
    base_colour: "#E4BD68",
    cap_colour: "#FFFFFF",
    letter_colour: "#9D2235",
    icon_suggestion: "☀"
  },
  {
    preset_key: "candy-pop",
    name: "Candy Pop",
    emoji: "🍬",
    base_colour: "#00B1B7",
    cap_colour: "#F55A74",
    letter_colour: "#FFFFFF",
    icon_suggestion: "♡"
  },
  {
    preset_key: "sunny-skies",
    name: "Sunny Skies",
    emoji: "🌈",
    base_colour: "#0086D6",
    cap_colour: "#FEC600",
    letter_colour: "#000000",
    icon_suggestion: "☁"
  }
];

let designPresets = [...DEFAULT_DESIGN_PRESETS];
let promoCodeRows = [];
const DEFAULT_CUSTOMER_REVIEWS = [
  {
    id: "fallback-clicking",
    quote: "The clicking is addictive!",
    customer_label: "Little Keeps customer",
    occasion: "Just because",
    image_url: "",
    sort_order: 10
  },
  {
    id: "fallback-group",
    quote: "So cute, beautifully made and really good quality. It turned out exactly how I imagined, and it’s so affordable too!",
    customer_label: "Little Keeps customer",
    occasion: "Group gifting",
    image_url: "",
    sort_order: 20
  }
];
let customerReviews = [...DEFAULT_CUSTOMER_REVIEWS];

try {
  const { data, error } = await supabase
    .from("shop_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  if (data) shopSettings = { ...shopSettings, ...data };
  productCatalogOverrides = normalizeProductCatalogOverrides(
    shopSettings.pickup_time_options?.product_catalog_overrides
  );
  productStatusOverrides = normalizeProductStatusOverrides(
    shopSettings.pickup_time_options?.product_statuses
  );
  shopSettings.colour_options = normalizeColourOptions(
    shopSettings.pickup_time_options?.colour_options || shopSettings.colour_options
  );
  shopSettings.bulk_buffer_days = Math.max(0, Number(
    shopSettings.pickup_time_options?.bulk_buffer_days ??
    shopSettings.bulk_buffer_days ??
    1
  ));
  shopSettings.contact_whatsapp_number = String(
    shopSettings.pickup_time_options?.contact_whatsapp_number || "6585121915"
  ).replace(/\D/g, "") || "6585121915";
  shopSettings.pickup_time_options = normalizePickupTimeOptions(
    shopSettings.pickup_time_options
  );
} catch (error) {
  console.warn("Using default shop pricing settings:", error);
}

const contactWhatsAppNumber = String(
  shopSettings.contact_whatsapp_number || "6585121915"
).replace(/\D/g, "") || "6585121915";
const contactWhatsAppUrl = `https://wa.me/${contactWhatsAppNumber}`;

try {
  const { data, error } = await supabase
    .from("product_catalog")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  productCatalog = normalizeProductCatalog(data);
} catch (error) {
  console.warn("Using the built-in product catalogue:", error);
}
productCatalog = applyProductCatalogOverrides(productCatalog, productCatalogOverrides);
productCatalog = applyProductStatusOverrides(productCatalog, productStatusOverrides);

let modularUnitsSold = null;
try {
  const { data, error } = await supabase.rpc("get_product_units_sold", {
    p_product_key: MODULAR_PRODUCT_KEY
  });
  if (error) throw error;
  const total = Math.max(0, Math.floor(Number(data)));
  if (Number.isFinite(total)) modularUnitsSold = total;
} catch (error) {
  console.warn("Unable to load the public product sales count:", error);
}

let previewProduct = requestedPreviewProductKey
  ? productCatalog.find(product => product.product_key === requestedPreviewProductKey) || null
  : null;
let isProductPreview = false;
if (previewProduct) {
  try {
    const { data } = await supabase.auth.getSession();
    isProductPreview = Boolean(data?.session?.user);
  } catch (error) {
    console.warn("Unable to verify the private product preview:", error);
  }
}

const unavailableColourNames = new Set(
  (Array.isArray(shopSettings.unavailable_colours)
    ? shopSettings.unavailable_colours
    : []
  ).map(name => String(name).trim().toLowerCase())
);

const shopColourNameByHex = Object.fromEntries(
  shopSettings.colour_options.map(colour => [colour.hex.toLowerCase(), colour.name])
);
const activeShopColourHexes = new Set(
  shopSettings.colour_options
    .filter(colour => colour.active)
    .map(colour => colour.hex.toLowerCase())
);

function isShopColourAvailable(colour) {
  const hex = String(colour || "").toLowerCase();
  const name = shopColourNameByHex[hex];
  return activeShopColourHexes.has(hex) &&
    Boolean(name) &&
    !unavailableColourNames.has(name.toLowerCase());
}

try {
  const { data, error } = await supabase
    .from("design_presets")
    .select(
      "preset_key,name,emoji,base_colour,cap_colour,letter_colour,icon_suggestion,sort_order"
    )
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  if (data?.length) designPresets = data;
} catch (error) {
  console.warn("Using default design inspiration:", error);
}

try {
  const { data, error } = await supabase
    .from("promo_codes")
    .select(
      "code,label,discount_type,discount_value,minimum_spend,starts_at,ends_at,active,featured"
    )
    .eq("active", true);

  if (error) throw error;
  promoCodeRows = data || [];
} catch (error) {
  console.warn("Using the fallback promo code setting:", error);
}

try {
  const { data, error } = await supabase
    .from("customer_reviews")
    .select("id,quote,customer_label,occasion,image_url,sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (data?.length) customerReviews = data;
} catch (error) {
  console.warn("Using fallback customer reviews:", error);
}

function escapePresetText(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '\"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function safePresetColour(value, fallback = "#FFFFFF") {
  const colour = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(colour) ? colour : fallback;
}

function renderCustomerReviewCards() {
  return customerReviews.map((review, index) => {
    const quote = escapePresetText(review.quote);
    const customer = escapePresetText(
      review.customer_label || "Little Keeps customer"
    );
    const occasion = escapePresetText(review.occasion || "Personalised order");
    const imageUrl = String(review.image_url || "").trim();
    const safeImageUrl = /^https:\/\//i.test(imageUrl)
      ? escapePresetText(imageUrl)
      : "";

    return `
      <article class="review-card ${index % 2 ? "is-featured" : ""} ${safeImageUrl ? "has-image" : ""}" role="listitem">
        ${safeImageUrl ? `
          <div class="review-photo">
            <img
              src="${safeImageUrl}"
              alt="Customer’s Little Keeps order for ${occasion}"
              loading="lazy"
            >
          </div>
        ` : ""}
        <span class="review-quote-mark" aria-hidden="true">“</span>
        <div class="review-card-content">
          <blockquote>${quote}</blockquote>
          <div class="review-card-footer">
            <span>${index % 2 ? "✦" : "♡"}</span>
            <div>
              <strong>${customer}</strong>
              <small>${occasion}</small>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderDesignPresetCards() {
  return designPresets.map(preset => {
    const key = escapePresetText(preset.preset_key);
    const name = escapePresetText(preset.name);
    const emoji = escapePresetText(preset.emoji);
    const icon = escapePresetText(preset.icon_suggestion);
    const base = safePresetColour(preset.base_colour, "#F55A74");
    const cap = safePresetColour(preset.cap_colour, "#FFFFFF");
    const letter = safePresetColour(preset.letter_colour, "#9D2235");
    const unavailable =
      !isShopColourAvailable(base) ||
      !isShopColourAvailable(cap) ||
      !isShopColourAvailable(letter);

    return `
      <button
        class="inspiration-option ${unavailable ? "is-oos" : ""}"
        type="button"
        data-design-preset="${key}"
        ${unavailable ? "disabled aria-disabled=\"true\"" : ""}
      >
        <strong>${emoji} ${name}</strong>
        <span class="inspiration-swatches" aria-label="Base, cap and letter colours">
          <i style="--preset-colour:${base};"></i>
          <i style="--preset-colour:${cap};"></i>
          <i style="--preset-colour:${letter};"></i>
        </span>
        ${
          unavailable
            ? `<small>Temporarily unavailable</small>`
            : icon
              ? `<small>Icon idea: ${icon}</small>`
              : ""
        }
      </button>
    `;
  }).join("");
}

function getSettingNumber(key, fallback) {
  const value = Number(shopSettings[key]);
  return Number.isFinite(value) ? value : fallback;
}

const modularProduct = getProductByKey(productCatalog, MODULAR_PRODUCT_KEY);
const solidProduct = getProductByKey(productCatalog, SOLID_PRODUCT_KEY);
const standardProduct = getProductByKey(
  productCatalog,
  STANDARD_PRODUCT_KEY
);
const photoProduct = getProductByKey(productCatalog, PHOTO_PRODUCT_KEY);
const pencilProduct = getProductByKey(productCatalog, PENCIL_PRODUCT_KEY);
const readyMadeProducts = productCatalog.filter(isReadyMadeProduct);

let activeProduct = modularProduct;

const usualBasePrice = Number(
  modularProduct.usual_base_price ?? getSettingNumber("usual_base_price", 3.9)
);
const launchBasePrice = Number(
  modularProduct.launch_base_price ?? getSettingNumber("launch_base_price", 3.2)
);
const launchPriceEndsAtTimestamp = Date.parse(
  String(modularProduct.launch_price_ends_at || "")
);
const launchPriceHasDeadline = Number.isFinite(launchPriceEndsAtTimestamp);
const launchPriceEnabled =
  modularProduct.launch_price_enabled !== false &&
  (!launchPriceHasDeadline || Date.now() < launchPriceEndsAtTimestamp);
const featuredPromo = !launchPriceEnabled
  ? promoCodeRows.find(row => {
      if (!row.featured || !row.active) return false;

      const startsAt = row.starts_at ? Date.parse(row.starts_at) : null;
      const endsAt = row.ends_at ? Date.parse(row.ends_at) : null;
      const now = Date.now();

      return (
        (!Number.isFinite(startsAt) || now >= startsAt) &&
        (!Number.isFinite(endsAt) || now < endsAt)
      );
    }) || null
  : null;
const featuredPromoEndsAtTimestamp = featuredPromo?.ends_at
  ? Date.parse(featuredPromo.ends_at)
  : NaN;
const featuredPromoHasDeadline = Number.isFinite(
  featuredPromoEndsAtTimestamp
);
const featuredPromoOffer = featuredPromo
  ? featuredPromo.discount_type === "fixed"
    ? `${displaySettingMoney(featuredPromo.discount_value)} off`
    : `${Number(featuredPromo.discount_value || 0)}% off`
  : "";
const displayedBasePrice = launchPriceEnabled
  ? launchBasePrice
  : usualBasePrice;
const deliveryFeeSetting = getSettingNumber("delivery_fee", 2.5);
const freeDeliveryThreshold = getSettingNumber("free_delivery_threshold", 50);
const maxOrdersPerDate = Math.max(
  1,
  Math.round(getSettingNumber("max_orders_per_date", 2))
);
const largeOrderQuantity = 7;
const bulkOrderQuantity = Math.max(
  largeOrderQuantity + 1,
  Math.round(getSettingNumber("bulk_order_quantity", 15))
);
const standardMinimumDays = Math.max(1, getSettingNumber("standard_min_working_days", 2));
const standardMaximumDays = Math.max(standardMinimumDays, getSettingNumber("standard_max_working_days", 3));
const largeMinimumDays = Math.max(standardMaximumDays, getSettingNumber("large_min_working_days", 4));
const largeMaximumDays = Math.max(largeMinimumDays, getSettingNumber("large_max_working_days", 5));
const rushFeeSmall = Math.max(0, getSettingNumber("rush_fee_small", 5));
const rushFeeLarge = Math.max(rushFeeSmall, getSettingNumber("rush_fee_large", 8));

function displaySettingMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function isProductLaunchOfferActive(product, now = Date.now()) {
  if (product?.launch_price_enabled === false) return false;
  const deadline = Date.parse(String(product?.launch_price_ends_at || ""));
  return !Number.isFinite(deadline) || now < deadline;
}

function renderProductCardPrice(product) {
  if (!product?.price_visible) {
    return '<span class="product-card-price is-pending">Pricing coming soon</span>';
  }
  const current = getProductDisplayPrice(product);
  const usual = Number(product.usual_base_price || 0);
  const launch = Number(product.launch_base_price || 0);
  const launchActive = isProductLaunchOfferActive(product) && launch < usual;
  return `
    <span class="product-card-price ${launchActive ? "has-launch-price" : ""}">
      ${launchActive ? `<small>Launch</small><del>${displaySettingMoney(usual)}</del>` : ""}
      <strong>${isReadyMadeProduct(product) ? "" : "From "}${displaySettingMoney(current)}</strong>
    </span>
  `;
}

function getProductPricingPartLabels(product) {
  if (product.product_key === PENCIL_PRODUCT_KEY) {
    return { character: "character block", base: "block", cap: "top", letter: "character" };
  }
  if (product.product_key === STANDARD_PRODUCT_KEY) {
    return { character: "character", base: "background", cap: "", letter: "name" };
  }
  return { character: "character", base: "base", cap: "cap", letter: "letter or icon" };
}

function renderProductPricingGuideMarkup(product, { compact = false, showHeading = true } = {}) {
  const labels = getProductPricingPartLabels(product);
  const isPhotoProduct = product.product_key === PHOTO_PRODUCT_KEY;
  const includedCharacters = Math.max(0, Number(product.included_characters) || 0);
  const maximumCharacters = Math.max(includedCharacters, Number(product.maximum_characters) || includedCharacters);
  const current = getProductDisplayPrice(product);
  const usual = Number(product.usual_base_price || current);
  const launchActive = isProductLaunchOfferActive(product) && current < usual;
  const extraColours = [
    [labels.base, Number(product.extra_base_colour_price || 0)],
    [labels.cap, Number(product.extra_cap_colour_price || 0)],
    [labels.letter, Number(product.extra_letter_colour_price || 0)]
  ].filter(([label, amount]) => label && amount > 0);
  const includedColourParts = [
    [labels.base, Number(product.included_base_colours || 0)],
    [labels.cap, Number(product.included_cap_colours || 0)],
    [labels.letter, Number(product.included_letter_colours || 0)]
  ].filter(([label, count]) => label && count > 0).map(([label]) => label);
  const includedColourChoices = includedColourParts.map(part => `one ${part} colour`);
  const includedColourPhrase = includedColourChoices.length > 1
    ? `${includedColourChoices.slice(0, -1).join(", ")} and ${includedColourChoices.at(-1)}`
    : includedColourChoices[0] || "one colour";
  const includedSummary = isPhotoProduct
    ? "Includes artwork preparation and one finished keepsake."
    : `Includes up to ${includedCharacters} ${labels.character}${includedCharacters === 1 ? "" : "s"}.`;

  return `
    ${showHeading ? `<div class="product-pricing-guide-heading">
      <div><span>Pricing guide</span><strong>${escapePresetText(product.name)}</strong></div>
      <div class="product-guide-price ${launchActive ? "has-launch-price" : ""}">
        ${launchActive ? `<small>Launch price</small><del>${displaySettingMoney(usual)}</del>` : `<small>Starting from</small>`}
        <b>${displaySettingMoney(current)}</b>
      </div>
    </div>` : ""}
    <div class="pricing-guide-included">
      <div><span>Starting price</span><strong>${displaySettingMoney(current)}</strong></div>
      <p>${includedSummary}</p>
    </div>
    <div class="product-pricing-guide-rows pricing-guide-character-rows">
      ${Number(product.extra_character_price || 0) > 0 && maximumCharacters > includedCharacters ? `
        <span><b>Characters ${includedCharacters + 1}-${maximumCharacters}</b><em>+${displaySettingMoney(product.extra_character_price)} each</em></span>
      ` : ""}
    </div>
    ${extraColours.length ? `
      <div class="pricing-guide-colour-note">
        <strong>Your first colours are included</strong>
        <p>Choose ${escapePresetText(includedColourPhrase)} at no extra cost. You only pay when you mix or alternate colours within the same part.</p>
      </div>
      <div class="pricing-guide-colour-addons">
        ${extraColours.map(([label, amount]) => `
          <span><b>Extra ${escapePresetText(label)} colour</b><em>+${displaySettingMoney(amount)} each</em></span>
        `).join("")}
      </div>
    ` : ""}
    ${compact ? "" : `<small>Your exact total updates automatically while you design.</small>`}
  `;
}

function renderProductCardPricingGuide(product) {
  if (!product?.price_visible) return "";
  return `
    <details class="product-pricing-guide product-card-pricing-guide">
      <summary><span>View pricing guide</span></summary>
      <div>${renderProductPricingGuideMarkup(product, { compact: true, showHeading: false })}</div>
    </details>
  `;
}

function renderReadyMadeProductCard(product) {
  if (product.status === "hidden") return "";
  const soldOut = Number(product.stock_quantity || 0) <= 0;
  const unavailable = product.status !== "active" || soldOut;
  return `
    <article class="product-card ready-made-product-card ${unavailable ? "product-card-coming" : "product-card-current"}">
      <div class="product-card-visual">
        ${product.image_path
          ? `<img src="${escapePresetText(product.image_path)}" alt="${escapePresetText(product.name)}" loading="lazy">`
          : `<div class="ready-made-image-placeholder">Little Keeps</div>`}
        <span class="product-card-badge">${soldOut ? "Sold out" : product.status === "active" ? "Ready to order" : "Coming soon"}</span>
      </div>
      <div class="product-card-content">
        <div><small>${escapePresetText(product.eyebrow || "Ready-made collection")}</small><h3>${escapePresetText(product.name)}</h3></div>
        <p>${escapePresetText(product.description || "A small-batch Little Keeps design.")}</p>
        ${renderProductCardPrice(product)}
        <button type="button" data-ready-product="${escapePresetText(product.product_key)}" ${unavailable ? "disabled" : ""}>
          ${soldOut ? "Sold out" : product.status === "active" ? "Choose options" : "Coming soon"}<span>→</span>
        </button>
      </div>
    </article>
  `;
}

function renderPencilColourSwatches(part) {
  return shopSettings.colour_options
    .filter(colour => colour.active && !unavailableColourNames.has(String(colour.name).toLowerCase()))
    .map(colour => `
      <button
        type="button"
        class="pencil-colour-swatch"
        data-pencil-colour="${part}"
        data-pencil-colour-value="${escapePresetText(colour.hex)}"
        title="${escapePresetText(colour.name)} · ${escapePresetText(colour.material_type || "BASIC")}"
      >
        <i style="background:${escapePresetText(colour.hex)}"></i>
        <span>${escapePresetText(colour.name)}</span>
      </button>
    `)
    .join("");
}

document.querySelector("#app").innerHTML = `
<main class="page">

${requestedPreviewProductKey ? `
  <aside class="product-preview-banner ${isProductPreview ? "" : "is-locked"}">
    <strong>${isProductPreview ? `Private preview: ${escapePresetText(previewProduct?.name || "Product")}` : "Private preview unavailable"}</strong>
    <span>${isProductPreview ? "You can generate artwork and download test STLs, but real checkout is disabled." : "Sign in to Admin on this browser, then open the preview link again."}</span>
    <a href="/admin.html">Open Admin</a>
  </aside>
` : ""}


<div class="announcement-bar">
  <div class="announcement-item">
    <span class="announcement-icon">♡</span>
    <span>Made in Singapore</span>
  </div>

  <span class="announcement-divider"></span>

  <div class="announcement-item">
    <span class="announcement-icon">▣</span>
    <span>Free islandwide delivery above ${displaySettingMoney(freeDeliveryThreshold)}</span>
  </div>

  <span class="announcement-divider"></span>

  <div class="announcement-item">
    <span class="announcement-icon">✦</span>
    <span><strong>Bulk orders welcome</strong></span>
  </div>

  <span id="holidayNoticeDivider" class="announcement-divider hidden"></span>

  <div id="holidayNotice" class="announcement-item announcement-holiday hidden">
    <span class="announcement-icon">▧</span>

    <span>
      <strong>Shop Notice:</strong>
      <span id="holidayNoticeText"></span>
    </span>
  </div>

  <span id="launchCountdownDivider" class="announcement-divider ${launchPriceEnabled && launchPriceHasDeadline ? "" : "hidden"}"></span>

  <div id="launchPriceCountdown" class="announcement-item announcement-launch ${launchPriceEnabled && launchPriceHasDeadline ? "" : "hidden"}">
    <span class="announcement-icon">⌛</span>
    <strong>Launch price ends in <span id="launchCountdownText"></span></strong>
  </div>

  <span id="featuredPromoDivider" class="announcement-divider ${featuredPromo ? "" : "hidden"}"></span>

  <div id="featuredPromoAnnouncement" class="announcement-item announcement-promo ${featuredPromo ? "" : "hidden"}">
    <span class="announcement-icon">✦</span>
    <strong>
      ${featuredPromo
        ? `${escapePresetText(featuredPromoOffer)} with code <span class="announcement-code">${escapePresetText(featuredPromo.code)}</span>${Number(featuredPromo.minimum_spend || 0) > 0 ? ` - min. spend ${displaySettingMoney(featuredPromo.minimum_spend)}` : ""}`
        : ""}
      ${featuredPromoHasDeadline ? ` - ends in <span id="featuredPromoCountdownText"></span>` : ""}
    </strong>
  </div>
</div>

<header class="site-header">
  <button
    id="menuOpenBtn"
    type="button"
    class="menu-icon-btn"
    aria-label="Open menu"
  >
    ☰
  </button>

  <a href="#" class="site-logo" data-view-target="shop">
    <span class="logo-flower">✿</span>
    Little Keeps
  </a>

  <nav class="top-nav" aria-label="Main navigation">
    <button type="button" class="is-active" data-view-target="shop">
      Shop
    </button>
    <button type="button" data-view-target="design">
      Design
    </button>
    <button type="button" data-view-target="track">
      Track / Pay
    </button>
  </nav>

  <button
    id="headerCartBtn"
    type="button"
    class="header-cart-btn"
  >
    <span>Cart</span>

    <span id="headerCartCount" class="cart-count">
      0
    </span>
  </button>
</header>

<section id="pendingOrderBanner" class="pending-order-banner hidden" aria-live="polite">
  <div>
    <small>Unfinished order</small>
    <strong id="pendingOrderBannerRef"></strong>
    <span id="pendingOrderBannerText">Your order is saved, but payment is not complete.</span>
  </div>
  <div class="pending-order-banner-actions">
    <button id="resumePendingOrderBtn" type="button">Continue Payment</button>
    <button id="dismissPendingOrderBtn" type="button" class="pending-order-dismiss" aria-label="Dismiss unfinished order reminder">×</button>
  </div>
</section>

<section id="sharedGroupBanner" class="shared-group-banner hidden" aria-live="polite">
  <div>
    <small>Group order</small>
    <strong id="sharedGroupBannerTitle">Loading…</strong>
    <span id="sharedGroupBannerText">Design your keychain, then add your basket to the group.</span>
  </div>
  <button id="sharedGroupBannerAction" type="button">View Group</button>
</section>

<div id="menuOverlay" class="menu-overlay hidden"></div>

<aside id="sideMenu" class="side-menu">
  <div class="side-menu-top">
    <div>
      <p class="side-menu-eyebrow">Little Keeps</p>
      <h2>Menu ♡</h2>
    </div>

    <button
      id="menuCloseBtn"
      type="button"
      class="menu-close-btn"
      aria-label="Close menu"
    >
      ×
    </button>
  </div>

  <nav class="side-nav">
    <button
      type="button"
      class="side-nav-link"
      data-view-target="shop"
    >
      <span>⌂</span>
      Home
    </button>

    <button
      type="button"
      class="side-nav-link"
      data-view-target="design"
    >
      <span>✿</span>
      Create a Custom Piece
    </button>

    <button
      type="button"
      class="side-nav-link"
      data-view-target="track"
    >
      <span>◎</span>
      Track / Pay Order
    </button>

    <button
      type="button"
      class="side-nav-link"
      data-view-target="shop"
      data-view-scroll="policiesSection"
    >
      <span>◎</span>
      Shop Policies
    </button>

    <button
      type="button"
      class="side-nav-link"
      data-view-target="shop"
      data-view-scroll="contactSection"
    >
      <span>♡</span>
      Contact
    </button>

    <button
      id="sideCartBtn"
      type="button"
      class="side-nav-link side-cart-link"
    >
      <span>🛍</span>

      <span>View Cart</span>

      <span id="sideCartCount" class="side-cart-count">
        0
      </span>
    </button>
  </nav>

  <div class="side-menu-footer">
    <a
      href="https://www.instagram.com/madebylittlekeeps"
      target="_blank"
      rel="noopener noreferrer"
    >
      @madebylittlekeeps
    </a>
  </div>
</aside>

<div id="cartOverlay" class="cart-overlay hidden"></div>

<aside id="cartDrawer" class="cart-drawer">
  <div class="cart-drawer-header">
    <div>
      <p class="side-menu-eyebrow">Your order</p>
      <h2>Your Cart</h2>
    </div>

    <button
      id="cartCloseBtn"
      type="button"
      class="menu-close-btn"
      aria-label="Close cart"
    >
      ×
    </button>
  </div>

  <div id="cartDrawerItems" class="cart-drawer-items"></div>

  <div class="cart-drawer-footer">
    <div class="cart-drawer-total">
      <span>Subtotal</span>
      <strong id="cartDrawerSubtotal">$0.00</strong>
    </div>

    <p class="cart-delivery-hint">
      Delivery is calculated during checkout.
    </p>

    <button
      id="continueShoppingBtn"
      type="button"
      class="cart-secondary-btn"
    >
      Continue Designing
    </button>

    <button
      id="sharedGroupCartBtn"
      type="button"
      class="shared-group-cart-btn hidden"
    >
      Save My Cart to Group Order
    </button>

    <button
      id="checkoutFromCartBtn"
      type="button"
      class="submit-btn"
    >
      Checkout
    </button>
  </div>
</aside>

<section id="designScreen" class="design-screen">

<section id="homeSection" class="storefront-hero" data-store-view="shop">
  <div class="hero-inner">
    <div class="hero-copy">
      <p class="hero-eyebrow">
        Thoughtfully made in Singapore
      </p>

      <h1>
        Small things,
        <span>made special.</span>
      </h1>

      <p class="hero-description">
        Personalised gifts and cheerful little designs, made in small batches just for you.
      </p>

      <div class="hero-actions">
        <button
          id="startDesignBtn"
          type="button"
          class="hero-button"
        >
          Shop the collection
          <span>→</span>
        </button>

        <button
          type="button"
          class="hero-secondary-button"
          data-view-target="shop"
          data-view-scroll="howItWorksSection"
        >
          See how it works
        </button>
      </div>

    </div>

    <div class="hero-offer-card hero-showcase-card">
      <div class="hero-showcase-photo">
        <img
          src="/images/modular-clicky-keychain.jpg"
          alt="Colourful personalised Little Keeps clicky keychains"
        />
        <span class="hero-bestseller-pill">Made to order in Singapore</span>
      </div>
      <div class="hero-showcase-copy">
        <strong>Designed with care. Made to keep.</strong>
        <p>Choose a ready-made favourite or create something completely personal.</p>
      </div>
      <div class="hero-showcase-points">
        <span>Made in Singapore</span>
        <span>Small-batch quality</span>
        <span>Personalised for you</span>
      </div>
    </div>
  </div>

  <div class="hero-decoration hero-decoration-one"></div>
  <div class="hero-decoration hero-decoration-two"></div>
</section>

<section class="availability-preview" data-store-view="shop" aria-labelledby="availabilityPreviewHeading">
  <button id="availabilityPreviewToggle" class="availability-preview-heading" type="button" aria-expanded="false" aria-controls="availabilityPreviewBody">
    <div>
      <p class="section-eyebrow">Plan before you design</p>
      <h2 id="availabilityPreviewHeading">Check current availability</h2>
    </div>
    <span>Live estimate <b aria-hidden="true">⌄</b></span>
  </button>
  <div id="availabilityPreviewBody" class="availability-preview-body hidden">
    <div class="availability-preview-grid">
      <article><span>Standard orders</span><strong id="availabilityStandardDate">Checking…</strong><small>Estimated ready date</small></article>
      <article><span>Pickup</span><strong id="availabilityPickupDate">Checking…</strong><small>First selectable appointment</small></article>
      <article><span>Event orders</span><strong id="availabilityBulkDate">Checking…</strong><small>Earliest dispatch request</small></article>
    </div>
    <p id="availabilityPreviewNote">Most production days accept ${Math.max(1, Number(shopSettings.max_orders_per_date || 2))} orders. Some dates may have extra or fewer slots.</p>
    <button id="refreshAvailabilityBtn" class="availability-refresh-btn" type="button">Refresh availability</button>
  </div>
</section>

<section id="productsSection" class="products-section" data-store-view="shop" aria-labelledby="productsHeading">
  <div class="products-heading">
    <p class="section-eyebrow">The Little Keeps collection</p>
    <h2 id="productsHeading">Find something made for you</h2>
  </div>

  <div class="product-card-grid">
  ${modularProduct.status !== "hidden" ? `
    <article class="product-card product-card-current">
      <span class="authorised-seller-ribbon">Authorised Seller</span>
      <div class="product-card-visual">
        <img
          src="/images/modular-clicky-keychain.jpg"
          alt="Colourful modular clicky keychains"
          loading="eager"
        >
        <span class="product-card-badge">Available now</span>
        ${modularUnitsSold > 0 ? `<span class="product-card-sales-badge">${formatProductUnitsSold(modularUnitsSold)}</span>` : ""}
      </div>

      <div class="product-card-content">
        <div>
          <small>${escapePresetText(modularProduct.eyebrow)}</small>
          <h3>${escapePresetText(modularProduct.name)}</h3>
        </div>
        <p>${escapePresetText(modularProduct.description)}</p>
        ${renderProductCardPrice(modularProduct)}
        ${renderProductCardPricingGuide(modularProduct)}
        <button type="button" data-product-key="${MODULAR_PRODUCT_KEY}" data-view-target="design">
          Design yours <span>→</span>
        </button>
      </div>
    </article>
  ` : ""}

  ${solidProduct.status !== "hidden" ? `
    <article class="product-card ${solidProduct.status === "active" ? "product-card-current" : "product-card-coming"}" ${solidProduct.status === "active" ? "" : "aria-disabled=\"true\""}>
      <span class="authorised-seller-ribbon">Authorised Seller</span>
      <div class="product-card-visual mystery-product-visual" aria-hidden="true">
        <div class="mystery-solid-base">
          <i></i><i></i><i></i><b>ABC</b>
        </div>
        <span class="product-card-badge">${solidProduct.status === "active" ? "Available now" : "Coming soon"}</span>
      </div>

      <div class="product-card-content">
        <div>
          <small>${escapePresetText(solidProduct.eyebrow)}</small>
          <h3>${escapePresetText(solidProduct.name)}</h3>
        </div>

        <p>${escapePresetText(solidProduct.description)}</p>

        ${renderProductCardPrice(solidProduct)}
        ${renderProductCardPricingGuide(solidProduct)}

        ${solidProduct.status === "active" ? `
          <button type="button" data-product-key="${SOLID_PRODUCT_KEY}" data-view-target="design">Design yours <span>→</span></button>
        ` : `<button type="button" disabled>Coming soon</button>`}
      </div>
    </article>
  ` : ""}

  ${pencilProduct.status !== "hidden" ? `
    <article class="product-card pencil-product-card ${pencilProduct.status === "active" ? "product-card-current" : "product-card-coming"}" ${pencilProduct.status === "active" ? "" : "aria-disabled=\"true\""}>
      <span class="authorised-seller-ribbon">Authorised Seller</span>
      <div class="product-card-visual pencil-product-visual" aria-hidden="true">
        <div class="pencil-card-art">
          <i class="pencil-card-eraser"></i><i class="pencil-card-ferrule"></i><b>LITTLE KEEPS</b><i class="pencil-card-wood"></i><i class="pencil-card-tip"></i>
        </div>
        <span class="product-card-badge">${pencilProduct.status === "active" ? "Available now" : "Coming soon"}</span>
      </div>
      <div class="product-card-content">
        <div>
          <small>${escapePresetText(pencilProduct.eyebrow)}</small>
          <h3>${escapePresetText(pencilProduct.name)}</h3>
        </div>
        <p>${escapePresetText(pencilProduct.description)}</p>
        ${renderProductCardPrice(pencilProduct)}
        ${renderProductCardPricingGuide(pencilProduct)}
        ${pencilProduct.status === "active"
          ? `<button type="button" data-product-key="${PENCIL_PRODUCT_KEY}" data-view-target="design">Design yours <span>→</span></button>`
          : `<button type="button" disabled>Coming soon</button>`}
      </div>
    </article>
  ` : ""}

  ${standardProduct.status !== "hidden" ? `
    <article class="product-card ${standardProduct.status === "active" ? "product-card-current" : "product-card-coming"}" ${standardProduct.status === "active" ? "" : "aria-disabled=\"true\""}>
      <div class="product-card-visual mystery-product-visual" aria-hidden="true">
        <div class="mystery-solid-base">
          <i></i><i></i><i></i><b>ABC</b>
        </div>

        <span class="product-card-badge">
          ${standardProduct.status === "coming_soon"
            ? "Coming soon"
            : "Available now"}
        </span>
      </div>

      <div class="product-card-content">
        <div>
          <small>${escapePresetText(standardProduct.eyebrow)}</small>
          <h3>${escapePresetText(standardProduct.name)}</h3>
        </div>

        <p>${escapePresetText(standardProduct.description)}</p>

        ${renderProductCardPrice(standardProduct)}
        ${renderProductCardPricingGuide(standardProduct)}

        ${
          standardProduct.status === "active"
            ? `
              <button
                type="button"
                data-product-key="${STANDARD_PRODUCT_KEY}"
                data-view-target="design"
              >
                Design yours <span>→</span>
              </button>
            `
            : `
              <button type="button" disabled>
                Coming soon
              </button>
            `
        }
      </div>
    </article>
  ` : ""}

  ${photoProduct.status !== "hidden" ? `
    <article class="product-card ${photoProduct.status === "active" ? "product-card-current" : "product-card-coming"}" ${photoProduct.status === "active" ? "" : "aria-disabled=\"true\""}>
      <div class="product-card-visual photo-keepsake-visual" aria-hidden="true">
        <div class="photo-artwork-sample"><span>♡</span><b>PHOTO</b></div>
        <span class="product-card-badge">${photoProduct.status === "active" ? "Available now" : "AI studio coming soon"}</span>
      </div>
      <div class="product-card-content">
        <div>
          <small>${escapePresetText(photoProduct.eyebrow)}</small>
          <h3>${escapePresetText(photoProduct.name)}</h3>
        </div>
        <p>${escapePresetText(photoProduct.description)}</p>
        ${renderProductCardPrice(photoProduct)}
        ${renderProductCardPricingGuide(photoProduct)}
        ${photoProduct.status === "active"
          ? `<button type="button" data-photo-product-start>Upload your photo <span>→</span></button>`
          : `<button type="button" disabled>Coming soon</button>`}
      </div>
    </article>
  ` : ""}

  ${readyMadeProducts.map(renderReadyMadeProductCard).join("")}

</div>
  </div>
</section>

<div id="readyMadeProductModal" class="ready-made-product-modal hidden" role="dialog" aria-modal="true" aria-labelledby="readyMadeProductTitle">
  <div class="ready-made-product-dialog">
    <button id="closeReadyMadeProductModal" class="photo-modal-close" type="button" aria-label="Close">×</button>
    <div id="readyMadeProductModalContent"></div>
  </div>
</div>

<div id="photoKeepsakeModal" class="photo-keepsake-modal hidden" role="dialog" aria-modal="true" aria-labelledby="photoKeepsakeTitle">
  <div class="photo-keepsake-dialog">
    <button id="closePhotoKeepsakeModal" type="button" class="photo-modal-close" aria-label="Close">×</button>
    <p class="section-eyebrow">AI Photo Keepsake</p>
    <h2 id="photoKeepsakeTitle">Turn your photo into a keepsake</h2>
    <p>Upload one clear photo and we’ll turn the main subject into simple artwork for your keychain. You can approve it or try another version.</p>

    <div class="photo-keepsake-grid">
      <section>
        <details class="product-pricing-guide photo-product-pricing-guide">
          <summary><span>Pricing guide</span><strong>From ${displaySettingMoney(getProductDisplayPrice(photoProduct))}</strong></summary>
          <div>${renderProductPricingGuideMarkup(photoProduct, { showHeading: false })}</div>
        </details>
        <label class="photo-upload-zone" for="photoKeepsakeInput">
          <input id="photoKeepsakeInput" type="file" accept="image/jpeg,image/png,image/webp" hidden>
          <span>Choose a clear photo</span>
          <small>A bright photo with one person, pet or object works best · maximum 8 MB</small>
          <img id="photoOriginalPreview" class="hidden" alt="Your uploaded photo preview">
        </label>

        <div id="photoSuitabilityCheck" class="photo-suitability-check hidden" aria-live="polite"></div>

        <div class="photo-option-grid">
          <label><span>Subject</span><select id="photoSubjectType"><option value="person">Person</option><option value="pet">Pet</option><option value="object">Object or keepsake</option></select></label>
          <label><span>Artwork detail</span><select id="photoColourCount"><option value="2">Simple · 2 colours</option><option value="3">Balanced · 3 colours</option><option value="4" selected>More detail · 4 colours</option></select></label>
          <label><span>Name for this design</span><input id="photoKeepsakeLabel" maxlength="40" placeholder="e.g. Milo or Mum"></label>
          <label><span>Quantity</span><input id="photoKeepsakeQuantity" type="number" min="1" max="250" step="1" value="1" inputmode="numeric"></label>
        </div>

        <label class="photo-permission-check"><input id="photoPermissionCheck" type="checkbox"><span>I own this photo or have permission to use it, including permission from the person or guardian shown.</span></label>
        <label class="photo-permission-check"><input id="photoAiConsentCheck" type="checkbox"><span>I agree to private AI processing of this photo. It may be kept for up to 30 days so Little Keeps can make my order.</span></label>
        <button id="generatePhotoArtworkBtn" type="button" class="photo-generate-btn">Create My Artwork</button>
        <p id="photoGenerationStatus" class="hint" aria-live="polite"></p>
      </section>

      <section class="photo-result-panel">
        <div id="photoGenerationLoader" class="photo-generation-loader hidden" role="status" aria-live="polite">
          <span class="photo-generation-spinner" aria-hidden="true"></span>
          <strong>Creating your artwork…</strong>
          <small>Please wait — this usually takes about 30–60 seconds.</small>
          <i aria-hidden="true"></i>
        </div>
        <div id="photoResultPlaceholder"><span>✦</span><strong>Your simplified artwork will appear here</strong><small>No payment is taken when you generate a preview.</small></div>
        <img id="photoArtworkResult" class="hidden" alt="AI simplified printable artwork preview">
        <div id="photoResultActions" class="photo-result-actions hidden">
          <div class="photo-retry-action"><button id="regeneratePhotoArtworkBtn" type="button">Try Another Version</button><small id="photoAttemptStatus">Up to 5 previews per hour</small></div>
          <button id="addPhotoArtworkToCartBtn" type="button">Approve & Add to Cart</button>
          ${isProductPreview ? `<button id="downloadPhotoTestStlsBtn" class="photo-preview-download-btn" type="button">Download Test STL Pack</button>` : ""}
        </div>
        <div id="photoMappedPalette" class="photo-mapped-palette hidden"></div>
        <p class="photo-proof-note">We check every design before making it. Very tiny details may be adjusted so your finished keychain looks neat.</p>
      </section>
    </div>
  </div>
</div>

<section id="howItWorksSection" class="how-it-works-section" data-store-view="shop">
  <div class="how-it-works-heading">
    <h2>How it works</h2>
  </div>

  <div class="how-it-works-grid">
    <article>
      <span>01</span>
      <div class="how-step-icon">✿</div>
      <h3>Design it live</h3>
      <p>Add a name and choose your colours.</p>
    </article>

    <article>
      <span>02</span>
      <div class="how-step-icon">♡</div>
      <h3>We make it</h3>
      <p>We print, assemble and check it.</p>
    </article>

    <article>
      <span>03</span>
      <div class="how-step-icon">→</div>
      <h3>Collect or deliver</h3>
      <p>Pick up at Woodlands or Marsiling MRT, or choose delivery.</p>
    </article>
  </div>
</section>

<section class="occasion-section" aria-labelledby="occasionHeading" data-store-view="shop">
  <div class="occasion-copy">
    <h2 id="occasionHeading">Made for little moments ♡</h2>
  </div>

  <div class="occasion-grid">
    <article><span>🎂</span><strong>Birthday gifts</strong></article>
    <article><span>🎁</span><strong>Party goodie bags</strong></article>
    <article><span>✏️</span><strong>Teachers’ Day</strong></article>
    <article><span>🌈</span><strong>Children’s Day</strong></article>
    <article><span>♡</span><strong>Friendship gifts</strong></article>
    <article><span>★</span><strong>Class and team gifts</strong></article>
  </div>

  <p class="occasion-safety-note">Contains small parts. Please supervise young children.</p>
</section>

<section class="reviews-section" aria-labelledby="reviewsHeading" data-store-view="shop">
  <div class="reviews-heading">
    <div>
      <p class="section-eyebrow">Real words from real customers</p>
      <h2 id="reviewsHeading">Loved by you ♡</h2>
    </div>
    <span>Swipe to read →</span>
  </div>

  <div class="reviews-track" role="list" aria-label="Customer reviews">
    ${renderCustomerReviewCards()}
  </div>
</section>

<aside class="payment-unlock-banner" aria-label="Payment options" data-store-view="shop">
  <div class="payment-unlock-icon">♡</div>
  <div>
    <strong>PayNow for all orders · Cards and wallets from $30</strong>
  </div>
</aside>

<section id="designArea" class="shop-section" data-store-view="design">
  <div class="customer-progress" aria-label="Order progress">
    <div class="customer-progress-step is-active"><span>1</span>Design</div>
    <div class="customer-progress-step"><span>2</span>Details</div>
    <div class="customer-progress-step"><span>3</span>Review</div>
    <div class="customer-progress-step"><span>4</span>Payment</div>
  </div>

  <div class="designer-setup">
    <div class="designer-setup-heading">
      <h2>Start your design</h2>
    </div>

    <div class="setup-grid">
      <div class="card order-type-card">
        <h3>Order Type</h3>

        <div class="toggle-row">
          <button
            id="singleBtn"
            type="button"
            class="toggle active"
          >
            Single Order
          </button>

          <button
            id="groupBtn"
            type="button"
            class="toggle"
          >
            Group Order
          </button>
        </div>

        <div id="sharedGroupStartCard" class="friends-family-share-card">
          <span>Recommended</span>
          <div>
            <h3 id="sharedGroupStartCardTitle">Create a shared Group Order</h3>
            <p id="sharedGroupStartCardText">Add your own design first, then create a private link for everyone else to add theirs. You review everything and pay once.</p>
          </div>
          <button id="friendsFamilyStartBtn" type="button">Create Group Order</button>
        </div>
      </div>

      <div class="card names-card">
        <div id="singleSection">
          <h3>Enter Name</h3>

          <input
            id="singleName"
            value="Alicia"
            maxlength="${Math.max(
              1,
              Number(modularProduct.maximum_characters) || 10
            )}"
          >
          <p id="productCharacterLimitNotice" class="hint" hidden></p>

          <label class="design-quantity-field" for="singleQuantity">
            <span>How many of this design?</span>
            <input
              id="singleQuantity"
              type="number"
              min="1"
              max="250"
              step="1"
              value="1"
              inputmode="numeric"
            >
          </label>

          <div id="iconPicker" class="icon-picker"></div>
        </div>

        <div id="groupSection" class="hidden">
          <h3>Paste your names</h3>

          <textarea
            id="nameList"
            placeholder="Paste names here, one per line"
          >Alicia
Ben
Chloe</textarea>

          <p id="nameCount">3 names</p>

          <div class="batch-paste-tip">
            <strong>Need a few different designs?</strong>
            <span>Keep names with the same design together. Leave one blank line before the next batch.</span>
            <code>Amy<br>Ben<br><br>Cara<br>Dan</code>
          </div>

          <div
            id="groupIconPicker"
            class="icon-picker"
          ></div>
        </div>
      </div>
    </div>

    <div id="nameCardsSection" class="card keychain-selector">
      <div class="keychain-selector-heading">
        <div>
          <h3 id="designSelectionHeading">Choose a Keychain to Edit</h3>

        </div>

        <div id="applyAllSection">
          <label class="apply-row">
            <input id="applyAllToggle" type="checkbox">
            Use one design for every batch
          </label>

          <p id="editingLabel" class="hint"></p>
        </div>
      </div>

      <div id="nameCards"></div>
    </div>
  </div>

  <div class="product-customiser">
    <section class="preview-column">
      <div class="preview-sticky">
        <div class="preview-card">
          <span id="authorisedSellerRibbon" class="authorised-seller-ribbon authorised-seller-ribbon-preview">Authorised Seller</span>
          <div class="preview-card-heading">
            <div>
              <h2>Your Keychain</h2>
            </div>

            <button
              id="mobilePreviewToggle"
              type="button"
              class="mobile-preview-toggle"
              aria-expanded="true"
            >
              Hide Preview
            </button>
          </div>

          <div class="preview-canvas-wrap">
            <canvas id="previewCanvas"></canvas>
            <img id="photoDesignPreview" class="photo-design-preview hidden" alt="Your approved photo keepsake artwork">
            <div id="pencilDesignPreview" class="pencil-design-preview hidden" aria-label="Custom pencil clicker preview"></div>

            <div id="previewLoading" class="preview-loading">
              <div class="preview-loading-spinner"></div>
              <strong>Loading your 3D preview…</strong>
            </div>
          </div>

          <div id="previewColourLegend" class="preview-colour-legend" aria-live="polite"></div>

          <p id="editModeText" class="preview-editing-text">
            Currently editing: Alicia only
          </p>

          <div id="dimensionEstimate" class="dimension-estimate" aria-live="polite">
            <div class="dimension-estimate-heading"><span>📏 Estimated finished size</span><strong>ALICIA</strong></div>
            <div class="dimension-estimate-grid">
              <span><small>Length</small><b>17.5 cm</b></span>
              <span><small>Breadth</small><b>2.7 cm</b></span>
              <span><small>Height</small><b>2.2 cm</b></span>
            </div>
            <p>Approximate measurement; slight variation may occur after assembly.</p>
          </div>
        </div>

      <div class="preview-tip">
        <p>
          Drag the preview to rotate your keychain.
        </p>
      </div>
      </div>

      <div id="designInspiration" class="design-inspiration">
        <h3>Need inspiration? ✨</h3>
        <div class="ai-design-helper">
          <label for="aiDesignBrief">Tell us the vibe, occasion or person</label>
          <div class="ai-design-helper-input">
            <input id="aiDesignBrief" maxlength="300" placeholder="e.g. cute purple birthday gift for a cat lover">
            <button id="aiDesignHelperBtn" type="button">Suggest Ideas</button>
          </div>
          <p id="aiDesignHelperStatus" aria-live="polite"></p>
          <div id="aiDesignSuggestions" class="ai-design-suggestions hidden"></div>
        </div>
        <div class="inspiration-scroll">
          ${renderDesignPresetCards()}
        </div>

        <p id="inspirationStatus" class="inspiration-status" aria-live="polite"></p>
      </div>
    </section>

    <section class="options-column">
      <div class="card colours-card">
        <div class="customiser-heading">
          <h2>Choose Your Style</h2>
        </div>

        <div id="standardKeychainOptions" class="standard-keychain-options" style="display:none">
          <div class="customisation-title">
            <div>
              <h3>Letter Size</h3>
              <p>Choose the physical height of the raised name. Your finished measurements update in the preview.</p>
            </div>
          </div>
          <div class="standard-font-size-options" role="group" aria-label="Letter size">
            <button type="button" data-standard-font-size="18"><strong>Small</strong><span>18 mm letters</span></button>
            <button type="button" class="active" data-standard-font-size="24"><strong>Regular</strong><span>24 mm letters</span></button>
            <button type="button" data-standard-font-size="30"><strong>Large</strong><span>30 mm letters</span></button>
          </div>
          <p class="standard-size-note">Longer names become wider. Please check the live length before adding to cart.</p>
        </div>

        <div id="pencilClickerOptions" class="pencil-clicker-options" style="display:none">
          <div class="customisation-title">
            <div>
              <h3>Personalise Your Pencil</h3>
              <p>Every character gets its own clicky block. Choose colours for the pencil ends, blocks, tops and characters.</p>
            </div>
          </div>
          <div class="pencil-ending-options" role="group" aria-label="Choose the pencil ending">
            <button type="button" class="active" data-pencil-ending-style="eraser"><strong>Eraser</strong><span>Includes the metal band</span></button>
            <button type="button" data-pencil-ending-style="endCap"><strong>End cap</strong><span>A simple rounded finish</span></button>
          </div>
          <div class="pencil-part-tabs" role="tablist" aria-label="Pencil part colours">
            <button type="button" data-pencil-part-tab="eraser" data-pencil-ending-group="eraser">Eraser</button>
            <button type="button" data-pencil-part-tab="ferrule" data-pencil-ending-group="eraser">Metal band</button>
            <button type="button" data-pencil-part-tab="endCap" data-pencil-ending-group="endCap">End cap</button>
            <button type="button" data-pencil-part-tab="wood">Wood</button>
            <button type="button" data-pencil-part-tab="tip">Pencil tip</button>
          </div>
          <div class="pencil-part-colour-panels">
            ${["eraser", "ferrule", "endCap", "wood", "tip"].map(part => `
              <div class="pencil-part-colour-panel" data-pencil-part-panel="${part}" hidden>
                <div class="pencil-colour-swatches">${renderPencilColourSwatches(part)}</div>
              </div>
            `).join("")}
          </div>
          <p class="pencil-options-note">Each character block includes its own clicker and switch.</p>
        </div>

        <details id="productPricingGuide" class="product-pricing-guide">
          <summary><span>Pricing guide</span><strong id="productPricingGuideSummary">From ${displaySettingMoney(getProductDisplayPrice(modularProduct))}</strong></summary>
          <div id="productPricingGuideBody">${renderProductPricingGuideMarkup(modularProduct, { showHeading: false })}</div>
        </details>

        <div class="random-colour-card clicky-only-option">
          <div class="random-colour-main">
            <div>
              <strong>Not sure which colours to choose? ✨</strong>
              <span>We’ll create one complete colour combination for you.</span>
            </div>
            <button id="randomiseColoursBtn" type="button" class="randomise-colours-btn">
              Surprise Me - All Parts
            </button>
          </div>
          <details id="randomColourOptions" class="random-colour-options">
            <summary id="randomColourOptionsSummary">Optional: allow mixed colours across characters</summary>
            <label class="random-multi-colour-option" for="randomiseMultipleColours">
              <input id="randomiseMultipleColours" type="checkbox">
              <span>
                <strong id="randomColourOptionsTitle">Use more than one colour per part</strong>
                <span id="randomColourOptionsText">This may alternate base, cap and letter/icon colours. Add-ons apply only if extra colours are used:</span>
                <span id="randomBaseColourFee">+${displaySettingMoney(modularProduct.extra_base_colour_price)} per extra base colour,</span>
                <span id="randomCapColourFee">+${displaySettingMoney(modularProduct.extra_cap_colour_price)} per extra cap colour and</span>
                <span id="randomLetterColourFee">+${displaySettingMoney(modularProduct.extra_letter_colour_price)} per extra letter/icon colour.</span>
              </span>
            </label>
          </details>
          <p id="randomiseColoursStatus" class="hint" aria-live="polite"></p>
        </div>

<div
  id="clickyBaseShapeSection"
  class="customisation-section clicky-only-option"
>
  <div class="customisation-title">
    <div>
      <h3>Base Shape</h3>
    </div>
  </div>

          <div class="toggle-row">
            <button
              id="ribbedBaseBtn"
              type="button"
              class="toggle active"
            >
              Ribbed
            </button>

            <button
              id="bubblyBaseBtn"
              type="button"
              class="toggle"
            >
              Bubbly
            </button>
          </div>
        </div>

          <div
            id="clickyOrientationSection"
            class="customisation-section clicky-only-option"
          >
          <div class="customisation-title">
            <div>
              <h3>Letter Orientation</h3>
            </div>
          </div>

          <div class="toggle-row letter-orientation-row">
            <button
              id="verticalLetterBtn"
              type="button"
              class="toggle active"
            >
              <span class="orientation-example">A</span>
              Vertical / Upright
            </button>

            <button
              id="horizontalLetterBtn"
              type="button"
              class="toggle"
            >
              <span class="orientation-example is-sideways">A</span>
              Horizontal / Sideways
            </button>
          </div>
        </div>

        <div class="customisation-section colour-workspace">
          <div class="customisation-title colour-workspace-heading">
            <div>
              <h3>Choose Colours</h3>
              <p>Select the part you want to change, then choose from BASIC or MATTE.</p>
            </div>
          </div>

          <div class="colour-part-tabs" role="tablist" aria-label="Keychain part to colour">
            <button type="button" class="active" data-colour-part-tab="base" role="tab" aria-selected="true"><span id="baseColourPartLabel">Base</span><small id="baseTabSummary"></small></button>
            <button type="button" class="clicky-only-option" data-colour-part-tab="cap" role="tab" aria-selected="false"><span>Cap</span><small id="capTabSummary"></small></button>
            <button type="button" data-colour-part-tab="letter" role="tab" aria-selected="false"><span id="letterColourPartLabel">Letter</span><small id="letterTabSummary"></small></button>
          </div>

          <div class="colour-part-panel active" data-colour-part-panel="base" role="tabpanel">
            <div id="baseSlots" class="slot-row"></div>

            <button id="randomiseBaseColoursBtn" type="button" class="part-surprise-btn">Surprise Me for Base Only ✨</button>
            <p id="baseColourPriceNotice" class="colour-price-notice"></p>

            <p id="baseColourHint" class="colour-hint">
              Hover or tap a colour
            </p>

            <div id="baseColours" class="swatches"></div>
          </div>

          <div id="clickyCapColourSection" class="colour-part-panel clicky-only-option" data-colour-part-panel="cap" role="tabpanel" hidden>
            <div id="capSlots" class="slot-row"></div>

            <button id="randomiseCapColoursBtn" type="button" class="part-surprise-btn">Surprise Me for Cap Only ✨</button>
            <p id="capColourPriceNotice" class="colour-price-notice"></p>

            <p id="capColourHint" class="colour-hint">
              Hover or tap a colour
            </p>

            <div id="capColours" class="swatches"></div>
          </div>

          <div class="colour-part-panel" data-colour-part-panel="letter" role="tabpanel" hidden>
            <div id="letterSlots" class="slot-row"></div>

            <button id="randomiseLetterColoursBtn" type="button" class="part-surprise-btn">Surprise Me for Letter Only ✨</button>
            <p id="letterColourPriceNotice" class="colour-price-notice"></p>

            <p id="letterColourHint" class="colour-hint">
              Hover or tap a colour
            </p>

            <div id="letterColours" class="swatches"></div>
          </div>
        </div>

        <div class="special-colour-note">
          <div class="special-colour-icon">♡</div>

          <div>
            <strong>Need another colour?</strong>

            <a
              href="${contactWhatsAppUrl}"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ask us on WhatsApp →
            </a>
          </div>
        </div>

        <p class="screen-colour-note">
          Screen colours may vary slightly from the finished piece.
        </p>

        <button
          id="resetSelected"
          type="button"
          class="reset-btn"
        >
          Reset Selected Keychain
        </button>
      </div>
    </section>
  </div>

  <p id="turnaroundSummary" class="design-turnaround-note">
    🕒 Ready in about 2–3 working days. Allow another 1–3 days for delivery.
  </p>

  <div class="add-cart-area">
    <div class="cart-price-summary">
      <span id="mobileOrderSummary">1 keychain</span>
      <strong id="designTotalDisplay">${displaySettingMoney(displayedBasePrice)}</strong>
    </div>

    <button
      id="nextBtn"
      type="button"
      class="submit-btn add-cart-btn"
    >
      <span id="addCartButtonLabel">Add to Cart</span>
      <span>♡</span>
    </button>
  </div>
</section>
</section>

<section
  id="checkoutScreen"
  class="checkout-screen hidden"
>
      <div class="customer-progress" aria-label="Order progress">
        <div class="customer-progress-step is-complete"><span>✓</span>Design</div>
        <div class="customer-progress-step is-active"><span>2</span>Details</div>
        <div class="customer-progress-step is-active"><span>3</span>Review</div>
        <div class="customer-progress-step"><span>4</span>Payment</div>
      </div>

      <button id="backBtn" class="secondary-btn">
        ← Back to Design
      </button>

      <div class="contact-box">
<div class="checkout-heading">
  <p class="section-eyebrow">Checkout</p>
  <h2>Your Details</h2>
</div>

        <label for="customerName">Full name</label>
        <input
          id="customerName"
          autocomplete="name"
          placeholder="Your full name"
        >

        <label for="customerEmail">Email address</label>
        <input
          id="customerEmail"
          type="email"
          autocomplete="email"
          placeholder="Email"
        >

        <label for="customerPhone">Contact number</label>
        <input
          id="customerPhone"
          type="tel"
          inputmode="numeric"
          autocomplete="tel"
          placeholder="Contact Number"
        >

        <div class="add-on-link-box">
          <label class="add-on-link-toggle" for="linkExistingOrderToggle">
            <input id="linkExistingOrderToggle" type="checkbox">
            <span>
              <strong>Add this to an existing order</strong>
              <small>Available only before the original order enters Printing.</small>
            </span>
          </label>

          <div id="linkExistingOrderPanel" class="add-on-link-panel hidden">
            <label for="existingOrderRef">Original order ID</label>
            <div class="add-on-link-row">
              <input id="existingOrderRef" type="text" autocomplete="off" placeholder="e.g. LK-1042">
              <button id="verifyExistingOrderBtn" type="button" class="secondary-btn">Verify & Link</button>
            </div>
            <p id="existingOrderLinkStatus" class="hint" aria-live="polite">
              Enter the original order ID and use the same email address above.
            </p>
          </div>
        </div>

        <div id="automaticDateCard" class="automatic-date-card">
          <span id="automaticDateLabel">Estimated ready for collection</span>
          <strong id="automaticDateRange">Calculating…</strong>
          <small id="automaticDateNote">Based on our current production schedule.</small>
        </div>

        <input id="neededBy" type="hidden">

        <div id="rushOrderOption" class="special-order-option">
          <label class="special-order-toggle" for="rushOrderToggle">
            <input id="rushOrderToggle" type="checkbox">
            <span>
              <strong>Need it sooner?</strong>
              <small>Rush fee: +${displaySettingMoney(rushFeeSmall)} for 1–4 keychains or +${displaySettingMoney(rushFeeLarge)} for 5–9. Availability is checked before payment.</small>
            </span>
          </label>
        </div>

        <div id="specialDateSection" class="special-date-section hidden">
          <label id="specialDateLabel" for="requestedCompletionDate">Preferred completion date</label>
          <input id="requestedCompletionDate" type="text" placeholder="Choose a date" readonly>
          <p id="specialOrderMessage" class="hint"></p>
          <div id="rushAvailabilityResult" class="rush-availability hidden" aria-live="polite"></div>
        </div>

        <div id="bulkOrderNotice" class="bulk-order-notice hidden"></div>

        <label for="collectionMethod">
          Collection or Delivery Method
        </label>

        <select id="collectionMethod">
          <option value="pickup">
            📍 Pick Up at Woodlands MRT
          </option>

          <option value="pickup_marsiling">
            📍 Pick Up at Marsiling MRT
          </option>

          <option value="delivery">
            🚚 Islandwide Delivery (+${displaySettingMoney(deliveryFeeSetting)})
          </option>
        </select>

        <div id="checkoutPickupSection" class="checkout-pickup-section">
          <div class="checkout-pickup-heading">
            <strong>Choose your pickup slot</strong>
            <span id="checkoutPickupGuidance">We’ll show slots after your estimated completion date.</span>
          </div>

          <div class="checkout-pickup-fields">
            <label for="checkoutPickupDate">
              Pickup date
              <input id="checkoutPickupDate" type="text" placeholder="Choose a date" readonly>
            </label>

            <label for="checkoutPickupTime">
              Pickup time
              <select id="checkoutPickupTime">
                <option value="">Choose a date first</option>
              </select>
            </label>
          </div>

          <p id="checkoutPickupStatus" class="hint" aria-live="polite"></p>
        </div>

        <div
          id="deliveryAddressSection"
          class="hidden"
        >
          <label for="deliveryPostalCode">
            Delivery postal code
          </label>

          <div class="delivery-postal-row">
            <input
              id="deliveryPostalCode"
              type="text"
              inputmode="numeric"
              autocomplete="postal-code"
              maxlength="6"
              placeholder="6-digit postal code"
            >

            <button id="verifyDeliveryAddressBtn" type="button" class="secondary-btn">
              Find Address
            </button>
          </div>

          <p id="deliveryAddressLookupStatus" class="address-lookup-status" aria-live="polite">
            Enter your postal code.
          </p>

          <button id="manualDeliveryAddressBtn" type="button" class="address-manual-link">
            Can’t find it? Enter the address manually
          </button>

          <label for="deliveryAddressLine1">
            Block and street
          </label>

          <input
            id="deliveryAddressLine1"
            type="text"
            autocomplete="address-line1"
            placeholder="Verified address will appear here"
            readonly
          >

          <label for="deliveryAddressLine2">
            Unit number
          </label>

          <input
            id="deliveryAddressLine2"
            type="text"
            autocomplete="address-line2"
            placeholder="Unit number, e.g. #12-34"
          >

          <div id="deliveryAddressConfirmation" class="delivery-address-confirmation hidden">
            <span>Deliver to</span>
            <strong id="deliveryAddressPreview"></strong>

            <label class="address-confirm-toggle" for="confirmDeliveryAddress">
              <input id="confirmDeliveryAddress" type="checkbox">
              <span>I confirm that this full address and unit number are correct.</span>
            </label>
          </div>
        </div>

        <p id="deliveryNote" class="hint"></p>

        <div class="gifting-bag-addon">
          <a
            class="gifting-bag-photo-link"
            href="/images/gifting-bag.png"
            target="_blank"
            rel="noopener"
            aria-label="View a larger photo of the gifting bags"
          >
            <img
              class="gifting-bag-photo"
              src="/images/gifting-bag.png"
              alt="Frosted gifting bags with a white star pattern"
              loading="lazy"
            >
          </a>
          <div class="gifting-bag-copy">
            <div>
              <strong>Add gifting bags?</strong>
              <small>S$0.50 each · fits 2 keychains up to 6 characters each; longer names will protrude</small>
              <small class="gifting-bag-disclaimer">Bags will be provided separately. Keychains will not be packed inside them.</small>
            </div>
          </div>
          <div class="gifting-bag-quantity-control">
            <span class="gifting-bag-quantity-label">Quantity</span>
            <div class="quantity-stepper">
              <button id="giftingBagDecrease" type="button" aria-label="Remove one gifting bag">−</button>
              <input
                id="giftingBagQuantity"
                type="number"
                min="0"
                max="0"
                step="1"
                value="0"
                inputmode="numeric"
                aria-label="Gifting bag quantity"
              >
              <button id="giftingBagIncrease" type="button" aria-label="Add one gifting bag">+</button>
            </div>
            <small id="giftingBagStockStatus" class="gifting-bag-stock-status">Checking stock…</small>
          </div>
        </div>

        <label class="final-order-confirmation" for="confirmFinalOrderDetails">
          <input id="confirmFinalOrderDetails" type="checkbox">
          <span>I checked every name, icon, colour, letter direction, and pickup or delivery detail.</span>
        </label>

        <textarea
          id="orderNotes"
          placeholder="Additional order notes (optional)..."
        ></textarea>
      </div>

      <div class="review-box">
<h3>Order Summary</h3>

        <div class="review-summary">
          <p>
            Total items:
            <strong id="reviewCount">0</strong>
          </p>

          <p>
            Estimated total:
            <strong id="reviewPrice">$0.00</strong>
          </p>
        </div>

        <div id="reviewList"></div>
      </div>

      <div class="promo-box">
        <h3>Have a promo code? ♡</h3>

        <div class="promo-code-row">
          <input
            id="promoCodeInput"
            type="text"
            maxlength="30"
            autocomplete="off"
            placeholder="Promo code"
          >

          <button id="applyPromoBtn" type="button">
            Apply
          </button>
        </div>

        <p
          id="promoCodeStatus"
          class="promo-code-status"
          aria-live="polite"
        ></p>
      </div>

      <div class="payment-box">
<h3>Ready to Order?</h3>

        <p>PayNow for all orders · Cards and wallets from $30</p>
      </div>

<div class="checkout-submit-bar">
  <div class="checkout-sticky-figures">
    <span id="checkoutStickyCount">1 keychain</span>
    <strong id="checkoutStickyTotal">$0.00</strong>
  </div>

  <div class="checkout-submit-action">
    <button
      id="submitOrderBtn"
      type="button"
      class="submit-btn"
      disabled
    >
      Submit Order & Continue to Payment
    </button>

    <p id="formStatus" class="checkout-submit-status" aria-live="polite"></p>
    <p id="submitStatus" class="checkout-submit-status" aria-live="polite"></p>
  </div>
</div>
    </section>

    <section
      id="paymentScreen"
      class="checkout-screen hidden"
    >
      <div class="customer-progress" aria-label="Order progress">
        <div class="customer-progress-step is-complete"><span>✓</span>Design</div>
        <div class="customer-progress-step is-complete"><span>✓</span>Details</div>
        <div class="customer-progress-step is-complete"><span>✓</span>Review</div>
        <div class="customer-progress-step is-active"><span>4</span>Payment</div>
      </div>

      <button
        id="paymentBackBtn"
        class="secondary-btn"
      >
        ← Back
      </button>

      <div class="payment-box">
        <div class="payment-status-banner">
          <strong>Order saved ✓</strong>
          <span>Keep this reference: <span id="paymentOrderRef"></span></span>
          <span id="paymentLinkedOrderNote" class="hidden"></span>
        </div>

        <p class="payment-edit-note">Need to correct a name, colour or delivery detail? Use Back within 30 minutes, make the change, then save again before paying.</p>

        <div id="manualPaymentRequestPanel" class="manual-payment-request hidden">
          <h3>Customer order ready to send</h3>
          <p>The confirmation email has been requested. Send this secure return link to the customer so they can pay.</p>
          <a id="manualPaymentLink" href="#" target="_blank" rel="noopener"></a>
          <button id="copyManualPaymentLinkBtn" type="button" class="secondary-btn">Copy payment-request link</button>
          <a class="secondary-btn" href="./admin.html">Return to Admin</a>
          <p id="manualPaymentLinkStatus" class="hint" aria-live="polite"></p>
        </div>

        <h2>Secure Payment</h2>
        <p class="payment-total-label">Total due</p>
        <strong id="paymentTotal" class="payment-total-value"></strong>

        ${shopSettings.stripe_enabled ? `
          <div class="online-payment-panel">
            <p>Your secure payment session holds this production slot for about 30 minutes.</p>
            <button id="stripeCheckoutBtn" type="button" class="submit-btn">Continue to Secure Payment</button>
            <p id="stripeCheckoutStatus" class="hint"></p>
          </div>
          <p class="hint">We’ll email your confirmation and order PDF after payment.</p>
        ` : `
          <div class="online-payment-panel">
            <h3>Online payment is temporarily unavailable</h3>
            <p>Please contact Little Keeps and quote your order reference.</p>
          </div>
        `}

<button
  id="paymentDoneBtn"
  class="secondary-btn"
>
  Pay later - Return to Shop
</button>
      </div>
    </section>

    <div id="successModal" class="modal hidden">
      <div class="modal-card">
        <h2>Order Submitted ♡</h2>

        <p id="orderRefText"></p>

        <p class="hint">
          Check your email for your confirmation and return link.
        </p>

        <div id="successNextSteps" class="success-next-steps">
          <strong>What happens next?</strong>
          <span>1. We confirm your order and payment</span>
          <span>2. Your keychains move into production</span>
          <span>3. Track updates using your order ID</span>
        </div>

        <div class="success-modal-actions">
          <button id="copySubmittedOrderBtn" type="button" class="secondary-btn">Copy Order ID</button>
          <button id="trackSubmittedOrderBtn" type="button" class="secondary-btn">Track This Order</button>
          <a id="successWhatsAppLink" class="secondary-btn" href="${contactWhatsAppUrl}" target="_blank" rel="noopener noreferrer">Ask on WhatsApp</a>
        </div>

        <button
          id="closeModalBtn"
          class="submit-btn"
        >
          Done
        </button>
      </div>
    </div>

    <div id="draftModal" class="modal hidden">
      <div class="modal-card">
        <h2>🩷 Welcome Back!</h2>

        <p>We found an unfinished order.</p>

        <p>
          Would you like to continue where you left off?
        </p>

        <button
          id="continueDraftBtn"
          class="submit-btn"
        >
          Continue Order
        </button>

        <button
          id="discardDraftBtn"
          class="secondary-btn"
        >
          Start New
        </button>
      </div>
    </div>

    <div id="sharedGroupStartModal" class="modal hidden">
      <form id="sharedGroupStartForm" class="modal-card shared-group-modal-card">
        <span class="shared-group-modal-icon">♡</span>
        <h2>Start a Group Order</h2>
        <p>We’ll create one private link. Each person adds their own design, then you review and pay once.</p>

        <label for="sharedGroupTitle">Group name</label>
        <input id="sharedGroupTitle" maxlength="80" placeholder="e.g. Sarah’s birthday gifts" required>

        <label for="sharedGroupOrganiserName">Your name</label>
        <input id="sharedGroupOrganiserName" maxlength="100" autocomplete="name" required>

        <label for="sharedGroupOrganiserEmail">Your email</label>
        <input id="sharedGroupOrganiserEmail" type="email" autocomplete="email" required>

        <p id="sharedGroupStartStatus" class="hint" aria-live="polite"></p>
        <button type="submit" class="submit-btn">Create Share Link</button>
        <button id="cancelSharedGroupStartBtn" type="button" class="secondary-btn">Cancel</button>
      </form>
    </div>

    <div id="sharedGroupContributeModal" class="modal hidden">
      <form id="sharedGroupContributeForm" class="modal-card shared-group-modal-card">
        <span class="shared-group-modal-icon">✿</span>
        <h2>Add Your Designs</h2>
        <p id="sharedGroupContributeIntro">Your basket will be sent to the organiser. You won’t need to pay here.</p>

        <label for="sharedGroupContributorName">Your name</label>
        <input id="sharedGroupContributorName" maxlength="100" autocomplete="name" required>

        <p id="sharedGroupContributeStatus" class="hint" aria-live="polite"></p>
        <button type="submit" class="submit-btn">Add My Basket to the Group</button>
        <button id="cancelSharedGroupContributeBtn" type="button" class="secondary-btn">Cancel</button>
      </form>
    </div>

    <div id="sharedGroupHowModal" class="modal hidden">
      <div class="modal-card shared-group-how-card">
        <span class="shared-group-modal-icon">?</span>
        <h2>How Group Orders Work</h2>
        <div class="shared-group-how-steps">
          <div><b>1</b><span><strong>Create your design</strong><small>Choose your name, colours and style as usual.</small></span></div>
          <div><b>2</b><span><strong>Add it to your cart</strong><small>Once you are happy with your design, add it to your cart as usual.</small></span></div>
          <div><b>3</b><span><strong>Add your cart to the group</strong><small>Tap “Add to Group”, then enter your name so the organiser knows whose designs they are.</small></span></div>
          <div><b>4</b><span><strong>The organiser reviews everything</strong><small>You can update your submitted designs until the organiser checks out.</small></span></div>
          <div><b>5</b><span><strong>One person pays</strong><small>Only the organiser checks out. Adding designs here does not create an order or charge you.</small></span></div>
        </div>
        <button id="closeSharedGroupHowBtn" type="button" class="submit-btn">Got It</button>
      </div>
    </div>

    <div id="sharedGroupSuccessModal" class="modal hidden">
      <div class="modal-card shared-group-success-card">
        <span class="shared-group-success-icon">✓</span>
        <h2>Designs Added Successfully!</h2>
        <p id="sharedGroupSuccessText">The organiser can now see your designs.</p>
        <div class="shared-group-success-note">
          <strong>No payment needed from you</strong>
          <span>The organiser will review the full group and pay once.</span>
        </div>
        <button id="closeSharedGroupSuccessBtn" type="button" class="submit-btn">Done</button>
      </div>
    </div>

    <div id="sharedGroupOwnerModal" class="modal hidden">
      <div class="modal-card shared-group-owner-card">
        <div class="shared-group-owner-heading">
          <div>
            <small>Group order</small>
            <h2 id="sharedGroupOwnerTitle">Your Group</h2>
            <p id="sharedGroupOwnerSummary"></p>
          </div>
          <button id="closeSharedGroupOwnerBtn" type="button" class="shared-group-close" aria-label="Close">×</button>
        </div>

        <div id="sharedGroupLinkBox" class="shared-group-link-box">
          <label for="sharedGroupInviteLink">Private invite link</label>
          <div>
            <input id="sharedGroupInviteLink" readonly>
            <button id="copySharedGroupLinkBtn" type="button">Copy Link</button>
          </div>
          <small>Anyone with this link can add designs. Only your organiser link can review them.</small>
        </div>

        <div id="sharedGroupContributionList" class="shared-group-contribution-list"></div>
        <p id="sharedGroupOwnerStatus" class="hint" aria-live="polite"></p>

        <div class="shared-group-owner-actions">
          <button id="editSharedGroupOwnerDesignsBtn" type="button" class="secondary-btn">Add / Edit My Designs</button>
          <button id="refreshSharedGroupBtn" type="button" class="secondary-btn">Refresh</button>
          <button id="checkoutSharedGroupBtn" type="button" class="submit-btn">Review Combined Basket</button>
        </div>
        <button id="cancelSharedGroupOrderBtn" type="button" class="shared-group-cancel-btn">Cancel Group Order</button>
      </div>
    </div>

<section id="orderStatusSection" class="order-status-section" data-store-view="track">
  <div class="order-status-copy">
    <p class="section-eyebrow">Already ordered?</p>
    <h2>Track or pay for your order</h2>
    <p>Enter your order reference and checkout email.</p>
  </div>

  <form id="orderStatusForm" class="order-status-form">
    <label for="statusOrderRef">Order reference</label>
    <input
      id="statusOrderRef"
      type="text"
      autocomplete="off"
      placeholder="Example: LK-260716-1234"
    >

    <label for="statusCustomerEmail">Email address</label>
    <input
      id="statusCustomerEmail"
      type="email"
      autocomplete="email"
      placeholder="Email used for your order"
    >

    <button id="checkOrderStatusBtn" type="submit" class="submit-btn">
      View Order
    </button>

    <p id="orderStatusMessage" class="order-status-message" aria-live="polite"></p>
    <div id="orderStatusResult" class="order-status-result hidden"></div>
  </form>
</section>

<section id="policiesSection" class="policies-section" data-store-view="shop">
  <div class="section-heading">
    <p class="section-eyebrow">Good to know</p>
    <h2>Shop Policies</h2>
  </div>

  <div class="policy-grid">
    <details class="production-policy">
      <summary>Production and timing</summary>
      <div class="policy-timing-copy">
        <p>Every Little Keep is made to order. Your checkout date updates automatically with our current bookings and scheduled shop closures.</p>
        <div class="policy-timing-groups">
          <article>
            <strong>Standard orders</strong>
            <span><b>1–3 keychains</b> · around ${standardMinimumDays}–${standardMaximumDays} working days</span>
            <span><b>4–6 keychains</b> · around ${standardMaximumDays}–${largeMinimumDays} working days</span>
            <span><b>7–14 keychains</b> · around ${largeMinimumDays}–${largeMaximumDays} working days</span>
          </article>
          <article>
            <strong>Event orders</strong>
            <span><b>${bulkOrderQuantity}–29 keychains</b> · at least 7 working days</span>
            <span><b>30–50 keychains</b> · at least 14 days</span>
            <span><b>51–75 keychains</b> · around 1.5–2 weeks</span>
            <span><b>76–100 keychains</b> · around 2–3 weeks</span>
            <span><b>101–150 keychains</b> · around 3–4 weeks</span>
            <span><b>151+ keychains</b> · around 4–6 weeks</span>
          </article>
        </div>
        <p class="policy-timing-note"><strong>Event orders:</strong> Islandwide delivery only. Choose an available date at checkout and continue straight to payment. Need it sooner? Rush requests are available where production allows.</p>
      </div>
    </details>

    <details>
      <summary>Personalised orders and changes</summary>
      <p>Please check every name, icon, colour and orientation before paying. Changes can be requested before production begins, but may not be possible once printing has started.</p>
    </details>

    <details>
      <summary>Cancellations, problems and refunds</summary>
      <p>Because each item is personalised, change-of-mind cancellations may not be accepted after production begins. If your order is incorrect, damaged or faulty, contact us within 7 days of collection or delivery so we can assess a replacement or refund. This does not limit rights provided by Singapore consumer law.</p>
    </details>

    <details>
      <summary>Collection and delivery</summary>
      <p>Choose your pickup slot during checkout. Pickup is available on Wednesdays and Fridays after 7pm, and on weekends. For delivery, the date shown is the estimated dispatch date; allow 1–3 days for arrival. Tracking is emailed unless we deliver your order by hand.</p>
    </details>

    <details>
      <summary>Privacy</summary>
      <p>Customer details are used only to process payment, produce and fulfil orders, provide updates and respond to support requests. Payment information is handled by Stripe and is not stored by Little Keeps.</p>
    </details>
  </div>
</section>

<section id="contactSection" class="contact-section" data-store-view="shop">
  <div class="contact-copy">
    <p class="section-eyebrow">Say hello</p>
    <h2>Need a little help?</h2>

    <p>
      Colour request, group order or custom idea? Message us.
    </p>
  </div>

  <div class="contact-links">
    <a
      href="${contactWhatsAppUrl}"
      target="_blank"
      rel="noopener noreferrer"
      class="contact-link-card"
    >
      <span class="contact-link-icon">💬</span>

      <span>
        <small>Message us</small>
        <strong>WhatsApp</strong>
      </span>

      <span>→</span>
    </a>

    <a
      href="https://www.instagram.com/madebylittlekeeps"
      target="_blank"
      rel="noopener noreferrer"
      class="contact-link-card"
    >
      <span class="contact-link-icon">♡</span>

      <span>
        <small>Follow us</small>
        <strong>@madebylittlekeeps</strong>
      </span>

      <span>→</span>
    </a>
  </div>
</section>

<footer class="site-footer">
  <a href="#" class="footer-logo">
    Little Keeps ♡
  </a>

  <small>
    © ${new Date().getFullYear()} Little Keeps
  </small>
</footer>

  </main>
`;

const BASE_PRICE = displayedBasePrice;
const INCLUDED_CHARACTERS = Number(modularProduct.included_characters);
const EXTRA_CHARACTER_PRICE = Number(modularProduct.extra_character_price);

const INCLUDED_BASE_COLOURS = Number(modularProduct.included_base_colours);
const INCLUDED_CAP_COLOURS = Number(modularProduct.included_cap_colours);
const INCLUDED_LETTER_COLOURS = Number(modularProduct.included_letter_colours);

const EXTRA_BASE_COLOUR_PRICE = Number(modularProduct.extra_base_colour_price);
const EXTRA_CAP_COLOUR_PRICE = Number(modularProduct.extra_cap_colour_price);
const EXTRA_LETTER_COLOUR_PRICE = Number(modularProduct.extra_letter_colour_price);
const GIFTING_BAG_PRICE = 0.5;

const configuredPromoCode = normalizePromoCode(shopSettings.promo_code);

const fallbackPromoCodes =
  shopSettings.promo_enabled !== false && configuredPromoCode
    ? {
        [configuredPromoCode]: {
          label: configuredPromoCode === "CHILDRENSDAY"
            ? "Children's Day"
            : configuredPromoCode,
          discountType: "percent",
          discountValue: getSettingNumber("promo_percent_off", 10),
          minimumSpend: 0,
          startsAt: null,
          endsAt: null
        }
      }
    : {};

const PROMO_CODES = promoCodeRows.length
  ? Object.fromEntries(
      promoCodeRows.map(row => [
        normalizePromoCode(row.code),
        {
          label: String(row.label || row.code || "Promo"),
          discountType: row.discount_type === "fixed" ? "fixed" : "percent",
          discountValue: Number(row.discount_value || 0),
          minimumSpend: Number(row.minimum_spend || 0),
          startsAt: row.starts_at || null,
          endsAt: row.ends_at || null
        }
      ])
    )
  : fallbackPromoCodes;

let appliedPromoCode = "";
let verifiedLinkedOrder = null;

const canvas = document.getElementById("previewCanvas");
const singleBtn = document.getElementById("singleBtn");
const groupBtn = document.getElementById("groupBtn");
const singleSection = document.getElementById("singleSection");
const groupSection = document.getElementById("groupSection");
const sharedGroupStartCard = document.getElementById("sharedGroupStartCard");
const sharedGroupStartCardTitle = document.getElementById("sharedGroupStartCardTitle");
const sharedGroupStartCardText = document.getElementById("sharedGroupStartCardText");
const friendsFamilyStartBtn = document.getElementById("friendsFamilyStartBtn");
const singleName = document.getElementById("singleName");
const singleQuantity = document.getElementById("singleQuantity");
const nameList = document.getElementById("nameList");
const nameCount = document.getElementById("nameCount");
const nameCards = document.getElementById("nameCards");
const nameCardsSection = document.getElementById("nameCardsSection");
const designSelectionHeading = document.getElementById("designSelectionHeading");
const applyAllToggle = document.getElementById("applyAllToggle");
const editModeText = document.getElementById("editModeText");
const dimensionEstimate = document.getElementById("dimensionEstimate");
const previewColourLegend = document.getElementById("previewColourLegend");
const photoDesignPreview = document.getElementById("photoDesignPreview");
const inspirationStatus = document.getElementById("inspirationStatus");
const randomiseColoursBtn = document.getElementById("randomiseColoursBtn");
const randomiseColoursStatus = document.getElementById("randomiseColoursStatus");
const randomiseMultipleColours = document.getElementById("randomiseMultipleColours");
const randomColourOptionsSummary = document.getElementById("randomColourOptionsSummary");
const randomColourOptions = document.getElementById("randomColourOptions");
const randomColourOptionsTitle = document.getElementById("randomColourOptionsTitle");
const randomColourOptionsText = document.getElementById("randomColourOptionsText");
const randomBaseColourFee = document.getElementById("randomBaseColourFee");
const randomCapColourFee = document.getElementById("randomCapColourFee");
const randomLetterColourFee = document.getElementById("randomLetterColourFee");
const randomiseBaseColoursBtn = document.getElementById("randomiseBaseColoursBtn");
const randomiseCapColoursBtn = document.getElementById("randomiseCapColoursBtn");
const randomiseLetterColoursBtn = document.getElementById("randomiseLetterColoursBtn");
const productCharacterLimitNotice = document.getElementById("productCharacterLimitNotice");

const applyAllSection = document.getElementById("applyAllSection");
const resetSelected = document.getElementById("resetSelected");
const reviewCount = document.getElementById("reviewCount");
const reviewPrice = document.getElementById("reviewPrice");
const reviewList = document.getElementById("reviewList");
const promoCodeInput = document.getElementById("promoCodeInput");
const applyPromoBtn = document.getElementById("applyPromoBtn");
const promoCodeStatus = document.getElementById("promoCodeStatus");
const customerName = document.getElementById("customerName");
const customerEmail = document.getElementById("customerEmail");
const customerPhone = document.getElementById("customerPhone");
const linkExistingOrderToggle = document.getElementById("linkExistingOrderToggle");
const linkExistingOrderPanel = document.getElementById("linkExistingOrderPanel");
const existingOrderRef = document.getElementById("existingOrderRef");
const verifyExistingOrderBtn = document.getElementById("verifyExistingOrderBtn");
const existingOrderLinkStatus = document.getElementById("existingOrderLinkStatus");
const neededBy = document.getElementById("neededBy");
const automaticDateCard = document.getElementById("automaticDateCard");
const automaticDateLabel = document.getElementById("automaticDateLabel");
const automaticDateRange = document.getElementById("automaticDateRange");
const automaticDateNote = document.getElementById("automaticDateNote");
const rushOrderOption = document.getElementById("rushOrderOption");
const rushOrderToggle = document.getElementById("rushOrderToggle");
const specialDateSection = document.getElementById("specialDateSection");
const specialDateLabel = document.getElementById("specialDateLabel");
const requestedCompletionDate = document.getElementById("requestedCompletionDate");
const specialOrderMessage = document.getElementById("specialOrderMessage");
const rushAvailabilityResult = document.getElementById("rushAvailabilityResult");
const bulkOrderNotice = document.getElementById("bulkOrderNotice");
const availabilityPreviewToggle = document.getElementById("availabilityPreviewToggle");
const availabilityPreviewBody = document.getElementById("availabilityPreviewBody");
availabilityPreviewToggle?.addEventListener("click", () => {
  const isOpen = availabilityPreviewToggle.getAttribute("aria-expanded") === "true";
  availabilityPreviewToggle.setAttribute("aria-expanded", String(!isOpen));
  availabilityPreviewBody?.classList.toggle("hidden", isOpen);
});

const turnaroundSummary =
  document.getElementById("turnaroundSummary");
const collectionMethod = document.getElementById("collectionMethod");
const checkoutPickupSection = document.getElementById("checkoutPickupSection");
const checkoutPickupGuidance = document.getElementById("checkoutPickupGuidance");
const checkoutPickupDate = document.getElementById("checkoutPickupDate");
const checkoutPickupTime = document.getElementById("checkoutPickupTime");
const checkoutPickupStatus = document.getElementById("checkoutPickupStatus");
const deliveryNote = document.getElementById("deliveryNote");
const giftingBagQuantityInput = document.getElementById("giftingBagQuantity");
const giftingBagDecrease = document.getElementById("giftingBagDecrease");
const giftingBagIncrease = document.getElementById("giftingBagIncrease");
const giftingBagStockStatus = document.getElementById("giftingBagStockStatus");
const readyMadeProductModal = document.getElementById("readyMadeProductModal");
const closeReadyMadeProductModal = document.getElementById("closeReadyMadeProductModal");
const readyMadeProductModalContent = document.getElementById("readyMadeProductModalContent");
const photoKeepsakeModal = document.getElementById("photoKeepsakeModal");
const closePhotoKeepsakeModal = document.getElementById("closePhotoKeepsakeModal");
const photoKeepsakeInput = document.getElementById("photoKeepsakeInput");
const photoOriginalPreview = document.getElementById("photoOriginalPreview");
const photoSubjectType = document.getElementById("photoSubjectType");
const photoColourCount = document.getElementById("photoColourCount");
const photoKeepsakeLabel = document.getElementById("photoKeepsakeLabel");
const photoKeepsakeQuantity = document.getElementById("photoKeepsakeQuantity");
const photoPermissionCheck = document.getElementById("photoPermissionCheck");
const photoAiConsentCheck = document.getElementById("photoAiConsentCheck");
const generatePhotoArtworkBtn = document.getElementById("generatePhotoArtworkBtn");
const regeneratePhotoArtworkBtn = document.getElementById("regeneratePhotoArtworkBtn");
const addPhotoArtworkToCartBtn = document.getElementById("addPhotoArtworkToCartBtn");
const downloadPhotoTestStlsBtn = document.getElementById("downloadPhotoTestStlsBtn");
const photoGenerationStatus = document.getElementById("photoGenerationStatus");
const photoGenerationLoader = document.getElementById("photoGenerationLoader");
const photoSuitabilityCheck = document.getElementById("photoSuitabilityCheck");
const photoResultPlaceholder = document.getElementById("photoResultPlaceholder");
const photoArtworkResult = document.getElementById("photoArtworkResult");
const photoResultActions = document.getElementById("photoResultActions");
const photoMappedPalette = document.getElementById("photoMappedPalette");
const photoAttemptStatus = document.getElementById("photoAttemptStatus");
const aiDesignBrief = document.getElementById("aiDesignBrief");
const aiDesignHelperBtn = document.getElementById("aiDesignHelperBtn");
const aiDesignHelperStatus = document.getElementById("aiDesignHelperStatus");
const aiDesignSuggestions = document.getElementById("aiDesignSuggestions");
const refreshAvailabilityBtn = document.getElementById("refreshAvailabilityBtn");
const orderNotes = document.getElementById("orderNotes");
const submitOrderBtn = document.getElementById("submitOrderBtn");
const confirmFinalOrderDetails = document.getElementById("confirmFinalOrderDetails");
const submitStatus = document.getElementById("submitStatus");
const successModal = document.getElementById("successModal");
const orderRefText = document.getElementById("orderRefText");
const closeModalBtn = document.getElementById("closeModalBtn");
const menuOpenBtn =
  document.getElementById("menuOpenBtn");

const menuCloseBtn =
  document.getElementById("menuCloseBtn");

const sideMenu =
  document.getElementById("sideMenu");

const menuOverlay =
  document.getElementById("menuOverlay");

const headerCartBtn =
  document.getElementById("headerCartBtn");

const sideCartBtn =
  document.getElementById("sideCartBtn");

const headerCartCount =
  document.getElementById("headerCartCount");

const sideCartCount =
  document.getElementById("sideCartCount");

const startDesignBtn =
  document.getElementById("startDesignBtn");

const designTotalDisplay =
  document.getElementById("designTotalDisplay");

const mobileOrderSummary =
  document.getElementById("mobileOrderSummary");

const addCartButtonLabel =
  document.getElementById("addCartButtonLabel");

const checkoutStickyCount =
  document.getElementById("checkoutStickyCount");

const checkoutStickyTotal =
  document.getElementById("checkoutStickyTotal");

const previewLoading =
  document.getElementById("previewLoading");

const previewCard =
  document.querySelector(".preview-card");

const mobilePreviewToggle =
  document.getElementById("mobilePreviewToggle");

const verticalLetterBtn =
  document.getElementById("verticalLetterBtn");
const horizontalLetterBtn =
  document.getElementById("horizontalLetterBtn");

  const cartDrawer =
  document.getElementById("cartDrawer");

const cartOverlay =
  document.getElementById("cartOverlay");

const cartCloseBtn =
  document.getElementById("cartCloseBtn");

const cartDrawerItems =
  document.getElementById("cartDrawerItems");

const cartDrawerSubtotal =
  document.getElementById("cartDrawerSubtotal");

const continueShoppingBtn =
  document.getElementById("continueShoppingBtn");

const checkoutFromCartBtn =
  document.getElementById("checkoutFromCartBtn");
const sharedGroupCartBtn = document.getElementById("sharedGroupCartBtn");

const orderStatusForm =
  document.getElementById("orderStatusForm");
const statusOrderRef =
  document.getElementById("statusOrderRef");
const statusCustomerEmail =
  document.getElementById("statusCustomerEmail");
const checkOrderStatusBtn =
  document.getElementById("checkOrderStatusBtn");
const orderStatusMessage =
  document.getElementById("orderStatusMessage");
const orderStatusResult =
  document.getElementById("orderStatusResult");
const copySubmittedOrderBtn = document.getElementById("copySubmittedOrderBtn");
const trackSubmittedOrderBtn = document.getElementById("trackSubmittedOrderBtn");
const pendingOrderBanner =
  document.getElementById("pendingOrderBanner");
const pendingOrderBannerRef =
  document.getElementById("pendingOrderBannerRef");
const pendingOrderBannerText =
  document.getElementById("pendingOrderBannerText");
const resumePendingOrderBtn =
  document.getElementById("resumePendingOrderBtn");
const dismissPendingOrderBtn =
  document.getElementById("dismissPendingOrderBtn");
const sharedGroupBanner = document.getElementById("sharedGroupBanner");
const sharedGroupBannerTitle = document.getElementById("sharedGroupBannerTitle");
const sharedGroupBannerText = document.getElementById("sharedGroupBannerText");
const sharedGroupBannerAction = document.getElementById("sharedGroupBannerAction");

const designScreen = document.getElementById("designScreen");
const checkoutScreen = document.getElementById("checkoutScreen");
const paymentScreen =
document.getElementById("paymentScreen");
const paymentOrderRef =
document.getElementById("paymentOrderRef");
const paymentTotal =
document.getElementById("paymentTotal");
const paymentLinkedOrderNote =
document.getElementById("paymentLinkedOrderNote");
const manualPaymentRequestPanel = document.getElementById("manualPaymentRequestPanel");
const manualPaymentLink = document.getElementById("manualPaymentLink");
const copyManualPaymentLinkBtn = document.getElementById("copyManualPaymentLinkBtn");
const manualPaymentLinkStatus = document.getElementById("manualPaymentLinkStatus");
const paymentDoneBtn =
document.getElementById("paymentDoneBtn");
const stripeCheckoutBtn =
document.getElementById("stripeCheckoutBtn");
const stripeCheckoutStatus =
document.getElementById("stripeCheckoutStatus");
const paymentBackBtn =
document.getElementById("paymentBackBtn");

const nextBtn = document.getElementById("nextBtn");
const backBtn = document.getElementById("backBtn");

const draftModal =
document.getElementById("draftModal");

const continueDraftBtn =
document.getElementById("continueDraftBtn");

const discardDraftBtn =
document.getElementById("discardDraftBtn");
const sharedGroupStartModal = document.getElementById("sharedGroupStartModal");
const sharedGroupStartForm = document.getElementById("sharedGroupStartForm");
const sharedGroupTitle = document.getElementById("sharedGroupTitle");
const sharedGroupOrganiserName = document.getElementById("sharedGroupOrganiserName");
const sharedGroupOrganiserEmail = document.getElementById("sharedGroupOrganiserEmail");
const sharedGroupStartStatus = document.getElementById("sharedGroupStartStatus");
const cancelSharedGroupStartBtn = document.getElementById("cancelSharedGroupStartBtn");
const sharedGroupContributeModal = document.getElementById("sharedGroupContributeModal");
const sharedGroupContributeForm = document.getElementById("sharedGroupContributeForm");
const sharedGroupContributeIntro = document.getElementById("sharedGroupContributeIntro");
const sharedGroupContributorName = document.getElementById("sharedGroupContributorName");
const sharedGroupContributeStatus = document.getElementById("sharedGroupContributeStatus");
const cancelSharedGroupContributeBtn = document.getElementById("cancelSharedGroupContributeBtn");
const sharedGroupHowModal = document.getElementById("sharedGroupHowModal");
const closeSharedGroupHowBtn = document.getElementById("closeSharedGroupHowBtn");
const sharedGroupSuccessModal = document.getElementById("sharedGroupSuccessModal");
const sharedGroupSuccessText = document.getElementById("sharedGroupSuccessText");
const closeSharedGroupSuccessBtn = document.getElementById("closeSharedGroupSuccessBtn");
const sharedGroupOwnerModal = document.getElementById("sharedGroupOwnerModal");
const sharedGroupOwnerTitle = document.getElementById("sharedGroupOwnerTitle");
const sharedGroupOwnerSummary = document.getElementById("sharedGroupOwnerSummary");
const sharedGroupInviteLink = document.getElementById("sharedGroupInviteLink");
const sharedGroupLinkBox = document.getElementById("sharedGroupLinkBox");
const copySharedGroupLinkBtn = document.getElementById("copySharedGroupLinkBtn");
const sharedGroupContributionList = document.getElementById("sharedGroupContributionList");
const sharedGroupOwnerStatus = document.getElementById("sharedGroupOwnerStatus");
const editSharedGroupOwnerDesignsBtn = document.getElementById("editSharedGroupOwnerDesignsBtn");
const refreshSharedGroupBtn = document.getElementById("refreshSharedGroupBtn");
const checkoutSharedGroupBtn = document.getElementById("checkoutSharedGroupBtn");
const closeSharedGroupOwnerBtn = document.getElementById("closeSharedGroupOwnerBtn");
const cancelSharedGroupOrderBtn = document.getElementById("cancelSharedGroupOrderBtn");

const sharedGroupUrlParams = new URLSearchParams(window.location.search);
let activeSharedGroupShareToken = sharedGroupUrlParams.get("group") || "";
let activeSharedGroupOwnerToken = sharedGroupUrlParams.get("group_owner") || "";
let activeSharedGroup = null;
let sharedGroupExpiryTimer = null;
let finalisingSharedGroupOwnerToken = "";

const addCartArea =
  document.querySelector(".add-cart-area");

const deliveryAddressSection =
document.getElementById("deliveryAddressSection");

const deliveryAddressLine1 =
  document.getElementById("deliveryAddressLine1");

const deliveryAddressLine2 =
  document.getElementById("deliveryAddressLine2");

const deliveryPostalCode =
  document.getElementById("deliveryPostalCode");

const verifyDeliveryAddressBtn =
  document.getElementById("verifyDeliveryAddressBtn");

const manualDeliveryAddressBtn =
  document.getElementById("manualDeliveryAddressBtn");

const deliveryAddressLookupStatus =
  document.getElementById("deliveryAddressLookupStatus");

const deliveryAddressConfirmation =
  document.getElementById("deliveryAddressConfirmation");

const deliveryAddressPreview =
  document.getElementById("deliveryAddressPreview");

const confirmDeliveryAddress =
  document.getElementById("confirmDeliveryAddress");

let deliveryAddressVerifiedPostal = "";
let deliveryAddressManualOverride = false;

function getDeliveryAddress() {
  return [
    deliveryAddressLine1.value.trim(),
    deliveryAddressLine2.value.trim(),
    deliveryPostalCode.value.trim()
      ? `Singapore ${deliveryPostalCode.value.trim()}`
      : ""
  ]
    .filter(Boolean)
    .join(", ");
}

function renderDeliveryAddressConfirmation() {
  const hasAddress =
    deliveryAddressLine1.value.trim() &&
    deliveryAddressLine2.value.trim() &&
    /^\d{6}$/.test(deliveryPostalCode.value.trim());

  deliveryAddressConfirmation.classList.toggle("hidden", !hasAddress);
  deliveryAddressPreview.textContent = hasAddress ? getDeliveryAddress() : "";
}

function resetDeliveryAddressVerification({ clearAddress = true } = {}) {
  deliveryAddressVerifiedPostal = "";
  deliveryAddressManualOverride = false;
  confirmDeliveryAddress.checked = false;
  deliveryAddressLine1.readOnly = true;

  if (clearAddress) {
    deliveryAddressLine1.value = "";
  }

  deliveryAddressLookupStatus.className = "address-lookup-status";
  deliveryAddressLookupStatus.textContent =
    "Enter your postal code.";
  renderDeliveryAddressConfirmation();
}

async function verifyDeliveryAddress() {
  const postalCode = deliveryPostalCode.value.replace(/\D/g, "").slice(0, 6);
  deliveryPostalCode.value = postalCode;

  if (!/^\d{6}$/.test(postalCode)) {
    deliveryAddressLookupStatus.className = "address-lookup-status is-error";
    deliveryAddressLookupStatus.textContent =
      "Please enter a complete 6-digit Singapore postal code.";
    validateForm();
    return;
  }

  verifyDeliveryAddressBtn.disabled = true;
  verifyDeliveryAddressBtn.textContent = "Checking…";
  deliveryAddressLookupStatus.className = "address-lookup-status is-checking";
  deliveryAddressLookupStatus.textContent = "Checking the official address…";

  try {
    const { data, error } = await supabase.functions.invoke(
      "verify-delivery-address",
      { body: { postal_code: postalCode } }
    );

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    if (!data?.address_line_1) {
      throw new Error("No matching address was returned.");
    }

    deliveryAddressLine1.value = data.address_line_1;
    deliveryAddressLine1.readOnly = true;
    deliveryAddressVerifiedPostal = postalCode;
    deliveryAddressManualOverride = false;
    confirmDeliveryAddress.checked = false;
    deliveryAddressLookupStatus.className = "address-lookup-status is-success";
    deliveryAddressLookupStatus.textContent =
      "Address found ✓ Please add your unit number and confirm it below.";
    deliveryAddressLine2.focus();
  } catch (error) {
    console.error("Unable to verify delivery address:", error);
    deliveryAddressVerifiedPostal = "";
    deliveryAddressLookupStatus.className = "address-lookup-status is-error";
    deliveryAddressLookupStatus.textContent =
      "We couldn’t verify this postal code right now. Check it again or enter the address manually.";
  } finally {
    verifyDeliveryAddressBtn.disabled = false;
    verifyDeliveryAddressBtn.textContent = "Find Address";
    renderDeliveryAddressConfirmation();
    validateForm();
  }
}

verifyDeliveryAddressBtn.addEventListener("click", verifyDeliveryAddress);

manualDeliveryAddressBtn.addEventListener("click", () => {
  deliveryAddressVerifiedPostal = "";
  deliveryAddressManualOverride = true;
  deliveryAddressLine1.readOnly = false;
  deliveryAddressLine1.value = "";
  confirmDeliveryAddress.checked = false;
  deliveryAddressLookupStatus.className = "address-lookup-status is-warning";
  deliveryAddressLookupStatus.textContent =
    "Manual address selected. Please check every detail carefully before confirming.";
  deliveryAddressLine1.focus();
  renderDeliveryAddressConfirmation();
  validateForm();
});

const ribbedBaseBtn = document.getElementById("ribbedBaseBtn");
const bubblyBaseBtn = document.getElementById("bubblyBaseBtn");

const colours = shopSettings.colour_options
  .filter(item => item.active)
  .map(item => ({
    name: item.name,
    colour: item.hex,
    materialType: item.material_type,
    available: !unavailableColourNames.has(item.name.toLowerCase()),
    note: ""
  }));
const baseColours = colours;
const capColours = colours;
const letterColours = colours;

const DESIGN_PRESETS = Object.fromEntries(
  designPresets.map(preset => [
    String(preset.preset_key),
    {
      label: String(preset.name || "Colour idea"),
      base: safePresetColour(preset.base_colour, "#F55A74"),
      cap: safePresetColour(preset.cap_colour, "#FFFFFF"),
      letter: safePresetColour(preset.letter_colour, "#9D2235")
    }
  ])
);

const specialKeycaps = {
  // Original
  "♡": "heart",
  "★": "star",
  "✿": "flower",
  "🎀": "ribbon",
  "🐾": "paw",
  "☘": "clover",
  "☁": "cloud",
  "🌙": "moon",
  "♪": "music",
  "⚡": "lightning",
  "🔥": "fire",
  "☕": "coffee",
  "🦆": "duck",
  "🐱": "cat",
  "✈": "airplane",

  // Sports
  "⚽": "soccer",
  "🏐": "volleyball",
  "🏉": "rugby",
  "⛷": "ski",
  "🚲": "bicycle",
  "⛳": "golf",
  "🥒": "pickleball",
  "🎳": "bowling",
  "⚾": "baseball",
  "♟": "chess",

  // Fruits
  "🍎": "apple",
  "🥑": "avocado",
  "🍌": "banana",
  "🫐": "blueberry",
  "🍒": "cherry",
  "🌰": "durian",
  "🍇": "grapes",
  "🥝": "kiwi",
  "🍋": "lemon",
  "🥭": "mango",
  "🍊": "orange",
  "🍑": "peach",
  "🌟": "starfruit",
  "🍓": "strawberry",
  "🍉": "watermelon"
};

const iconChoices = Object.keys(specialKeycaps);

const ICON_CATEGORIES = [
  {
    key: "all",
    label: "All",
    icons: iconChoices
  },
  {
    key: "popular",
    label: "Popular",
    icons: ["♡", "★", "✿", "🎀", "🐾", "☘", "⚡", "⚽"]
  },
  {
    key: "cute",
    label: "Cute",
    icons: ["♡", "✿", "🎀", "🐾", "☁", "🌙", "🦆", "🐱"]
  },
  {
    key: "nature",
    label: "Nature",
    icons: ["✿", "☘", "☁", "🌙", "⚡", "🔥"]
  },
  {
    key: "fun",
    label: "Food & Fun",
    icons: ["♪", "🔥", "☕", "🦆", "♟"]
  },
  {
    key: "fruits",
    label: "Fruits",
    icons: ["🍎", "🥑", "🍌", "🫐", "🍒", "🌰", "🍇", "🥝", "🍋", "🥭", "🍊", "🍑", "🌟", "🍓", "🍉"]
  },
  {
    key: "travel",
    label: "Travel",
    icons: ["✈", "🚲", "⛷"]
  },
  {
    key: "sports",
    label: "Sports",
    icons: ["⚽", "🏐", "🏉", "⛷", "🚲", "⛳", "🥒", "🎳", "⚾", "♟"]
  }
];

let specialDateCalendar = null;
let specialDateCalendarMode = "";
let checkoutPickupCalendar = null;
let shopClosureRanges = [];
let pickupUnavailableDates = [];
let normalUnavailableDates = [];
let bulkUnavailableDates = [];
let calendarClosureDates = [];
let rushAssessment = null;
let rushAssessmentRequest = 0;
let rushAssessmentFingerprint = "";
let bulkAssessment = null;
let bulkAssessmentRequest = 0;
let bulkAssessmentFingerprint = "";

function getTurnaroundInfo(quantity = getTotalKeychainQuantity() || 1) {
  const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  const turnaroundProducts = cartHasItems && getCartItems().length
    ? getCartItems().map(getItemProduct)
    : [activeProduct];
  const productMinimum = Math.max(
    0,
    ...turnaroundProducts.map(product => Number(product?.minimum_working_days) || 0)
  );
  const productMaximum = Math.max(
    0,
    ...turnaroundProducts.map(product => Number(product?.maximum_working_days) || 0)
  );
  if (productMinimum >= 1 || productMaximum >= 1) {
    const minDays = Math.max(1, productMinimum || productMaximum);
    const maxDays = Math.max(minDays, productMaximum || minDays);
    return {
      quantity: safeQuantity,
      tier: "product",
      minDays,
      maxDays,
      isLargeOrder: false
    };
  }
  const standardMin = Math.max(1, Number(shopSettings.standard_min_working_days || 2));
  const standardMax = Math.max(standardMin, Number(shopSettings.standard_max_working_days || 3));
  const largeMin = Math.max(standardMax, Number(shopSettings.large_min_working_days || 4));
  const largeMax = Math.max(largeMin, Number(shopSettings.large_max_working_days || 5));
  const turnaround = safeQuantity <= 3
    ? { quantity: safeQuantity, tier: "small", minDays: standardMin, maxDays: standardMax }
    : safeQuantity <= 6
      ? { quantity: safeQuantity, tier: "medium", minDays: standardMax, maxDays: largeMin }
      : { quantity: safeQuantity, tier: "large", minDays: largeMin, maxDays: largeMax };
  return {
    ...turnaround,
    isLargeOrder: turnaround.tier === "large"
  };
}

function isShopClosedDate(date) {
  const value = toLocalDateString(date);
  return shopClosureRanges.some(range =>
    value >= range.start_date && value <= range.end_date
  );
}

function isPickupUnavailableDate(date) {
  return pickupUnavailableDates.includes(toLocalDateString(date));
}

function addWorkingDays(startDate, workingDays) {
  const date = new Date(startDate);
  let daysAdded = 0;

  while (daysAdded < workingDays) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    const isWeekday = day !== 0 && day !== 6;
    if (isWeekday && !isShopClosedDate(date)) daysAdded += 1;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function getBulkMinimumDate(quantity = getTotalKeychainQuantity()) {
  const policy = getBulkApprovalPolicy(quantity);
  let candidate = addWorkingDays(
    new Date(),
    Math.max(getTurnaroundInfo(quantity).maxDays, policy.minWorkingDays || 0)
  );

  while (
    bulkUnavailableDates.includes(toLocalDateString(candidate)) ||
    isShopClosedDate(candidate)
  ) {
    candidate = addWorkingDays(candidate, 1);
  }

  return candidate;
}

function getFirstPickupDateAfter(readyDate) {
  const candidate = new Date(readyDate);
  const maximum = new Date(candidate);
  maximum.setDate(maximum.getDate() + 30);

  while (candidate <= maximum) {
    if (
      isPickupDay(toLocalDateString(candidate)) &&
      !isShopClosedDate(candidate) &&
      !isPickupUnavailableDate(candidate)
    ) {
      return candidate;
    }
    candidate.setDate(candidate.getDate() + 1);
  }

  return readyDate;
}

async function renderAvailabilityPreview() {
  const standardDate = document.getElementById("availabilityStandardDate");
  const pickupDate = document.getElementById("availabilityPickupDate");
  const bulkDate = document.getElementById("availabilityBulkDate");
  const note = document.getElementById("availabilityPreviewNote");
  if (!standardDate || !pickupDate || !bulkDate) return;

  const standardReady = alignToProductionDay(
    addWorkingDays(new Date(), getTurnaroundInfo(1).maxDays)
  );
  const firstPickup = getFirstPickupDateAfter(standardReady);
  const firstBulk = getBulkMinimumDate(bulkOrderQuantity);

  standardDate.textContent = formatEstimateDate(standardReady);
  pickupDate.textContent = formatEstimateDate(firstPickup);
  bulkDate.textContent = formatEstimateDate(firstBulk);

  const { data, error } = await supabase.rpc("check_needed_by_date", {
    p_date: toLocalDateString(standardReady),
    p_quantity: 1
  });
  if (!error && data?.allowed && note) {
    const limit = Math.max(0, Number(data.order_limit || 0));
    const used = Math.max(0, Number(data.orders || 0));
    const remaining = Math.max(0, limit - used);
    note.textContent = `${remaining} of ${limit} order slot${limit === 1 ? "" : "s"} remain on the next available production day. Daily limits may vary.`;
  }
}

function isCalendarDateUnavailable(date, mode) {
  const dateValue = toLocalDateString(date);
  const unavailableDates =
    mode === "bulk"
      ? bulkUnavailableDates
      : mode === "rush"
        ? []
        : normalUnavailableDates;

  if (unavailableDates.includes(dateValue)) return true;
  return calendarClosureDates.some(range => {
    const start = String(range.from || range.start_date || "").slice(0, 10);
    const end = String(range.to || range.end_date || "").slice(0, 10);
    return start && end && dateValue >= start && dateValue <= end;
  });
}

function getFirstAvailableCalendarDate(mode, startDate, maxDate) {
  const candidate = new Date(startDate);
  const lastDate = new Date(maxDate);

  candidate.setHours(0, 0, 0, 0);
  lastDate.setHours(0, 0, 0, 0);

  while (candidate <= lastDate) {
    if (!isCalendarDateUnavailable(candidate, mode)) {
      return new Date(candidate);
    }

    candidate.setDate(candidate.getDate() + 1);
  }

  return new Date(startDate);
}

function getAutomaticReadyDate() {
  const turnaround = getTurnaroundInfo();
  return alignToProductionDay(
    addWorkingDays(new Date(), turnaround.maxDays)
  );
}

function alignToProductionDay(dateValue) {
  let candidate = new Date(dateValue);
  while (
    normalUnavailableDates.includes(toLocalDateString(candidate)) ||
    isShopClosedDate(candidate)
  ) {
    candidate = addWorkingDays(candidate, 1);
  }
  return candidate;
}

function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatEstimateDate(date) {
  return date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short"
  });
}

function dateFromLocalValue(value) {
  const date = new Date(`${String(value || "").slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getCheckoutPickupReadyDate() {
  const orderType = getCheckoutOrderType();
  if (["rush", "bulk"].includes(orderType) && requestedCompletionDate.value) {
    return dateFromLocalValue(requestedCompletionDate.value) || getAutomaticReadyDate();
  }

  return getAutomaticReadyDate();
}

function isCheckoutPickupDateAvailable(dateValue) {
  const date = dateValue instanceof Date
    ? new Date(dateValue)
    : dateFromLocalValue(dateValue);
  if (!date) return false;

  const readyDate = getCheckoutPickupReadyDate();
  date.setHours(0, 0, 0, 0);
  readyDate.setHours(0, 0, 0, 0);

  return date >= readyDate && isPickupDay(toLocalDateString(date)) &&
    !isShopClosedDate(date) && !isPickupUnavailableDate(date);
}

function getFirstCheckoutPickupDate() {
  const candidate = getCheckoutPickupReadyDate();
  const maximum = new Date(candidate);
  maximum.setDate(maximum.getDate() + 60);

  while (candidate <= maximum) {
    if (isCheckoutPickupDateAvailable(candidate)) return new Date(candidate);
    candidate.setDate(candidate.getDate() + 1);
  }

  return getCheckoutPickupReadyDate();
}

function updateCheckoutPickupTimeOptions(selectedValue = "") {
  const ranges = getPickupTimeRanges(
    checkoutPickupDate?.value,
    shopSettings.pickup_time_options
  );
  if (!checkoutPickupTime) return;

  checkoutPickupTime.innerHTML = ranges.length
    ? `
      <option value="">Choose a time</option>
      ${ranges.map(range => `
        <option value="${escapePresetText(range)}" ${range === selectedValue ? "selected" : ""}>
          ${escapePresetText(range)}
        </option>
      `).join("")}
    `
    : `<option value="">Choose a date first</option>`;
}

function updateCheckoutPickupOptions() {
  if (!checkoutPickupSection) return;

  const shouldShow = collectionMethod.value !== "delivery" && !hasVerifiedLinkedOrder();
  checkoutPickupSection.classList.toggle("hidden", !shouldShow);

  if (!shouldShow) {
    checkoutPickupCalendar?.clear();
    checkoutPickupTime.value = "";
    checkoutPickupStatus.textContent = "";
    return;
  }

  const readyDate = getCheckoutPickupReadyDate();
  const firstPickupDate = getFirstCheckoutPickupDate();
  const maximum = new Date(firstPickupDate);
  maximum.setDate(maximum.getDate() + 60);

  checkoutPickupGuidance.textContent =
    `Estimated completion: ${formatEstimateDate(readyDate)}. Choose Wednesday or Friday after 7pm, or a weekend.`;

  if (checkoutPickupCalendar) {
    checkoutPickupCalendar.set({
      minDate: readyDate,
      maxDate: maximum,
      enable: [date => isCheckoutPickupDateAvailable(date)]
    });

    if (checkoutPickupDate.value && !isCheckoutPickupDateAvailable(checkoutPickupDate.value)) {
      checkoutPickupCalendar.clear();
      updateCheckoutPickupTimeOptions();
    }

    checkoutPickupCalendar.jumpToDate(
      checkoutPickupCalendar.selectedDates[0] || firstPickupDate,
      false
    );
  }
}

function setupCheckoutPickupCalendar() {
  if (!checkoutPickupDate || checkoutPickupCalendar) return;

  checkoutPickupCalendar = flatpickr(checkoutPickupDate, {
    dateFormat: "Y-m-d",
    minDate: getCheckoutPickupReadyDate(),
    enable: [date => isCheckoutPickupDateAvailable(date)],
    onChange: () => {
      updateCheckoutPickupTimeOptions();
      checkoutPickupStatus.textContent = checkoutPickupDate.value
        ? "Now choose a pickup time."
        : "";
      draftHasMeaningfulChanges = true;
      validateForm();
    }
  });

  updateCheckoutPickupOptions();
}

function getCheckoutOrderType() {
  if (getTotalKeychainQuantity() >= bulkOrderQuantity) return "bulk";
  if (rushOrderToggle?.checked) return "rush";
  return "standard";
}

function getRushFee() {
  if (getCheckoutOrderType() !== "rush") return 0;
  return getTotalKeychainQuantity() <= 4 ? rushFeeSmall : rushFeeLarge;
}

function getRushInventoryNeeds() {
  const needs = {};
  const add = (itemName, quantity = 1) => {
    needs[itemName] = (needs[itemName] || 0) + quantity;
  };

  names.forEach(item => {
    const design = getDesign(item);
    const characters = Array.from(sanitizeName(item.name));
    const orientation = design.letterOrientation === "horizontal" ? "horizontal" : "vertical";
    const shapeLabel = design.baseShape === "bubbly" ? "Bubbly" : "Ribbed";

    const itemQuantity = getItemQuantity(item);

    characters.forEach((character, index) => {
      const baseName = getColourName(design.bases[index % design.bases.length]);
      const capName = getColourName(design.caps[index % design.caps.length]);
      const letterName = getColourName(design.letters[index % design.letters.length]);
      add(`${baseName} ${shapeLabel} Base`, itemQuantity);
      add(
        `${capName} Cap + ${letterName} Letter - ${character}` +
        (orientation === "horizontal" ? " - Sideways" : ""),
        itemQuantity
      );
    });
  });

  const characterCount = names.reduce(
    (sum, item) =>
      sum + Array.from(sanitizeName(item.name)).length * getItemQuantity(item),
    0
  );
  add("Mechanical Switch", characterCount);
  add("Metal Large D Ring", getTotalKeychainQuantity());
  add("Gifting Bag", giftingBagQuantity);
  return needs;
}

function getRushFingerprint() {
  return JSON.stringify({
    date: requestedCompletionDate.value,
    quantity: getTotalKeychainQuantity(),
    needs: getRushInventoryNeeds()
  });
}

function showSpecialOrderAssessment(assessment, type = "rush") {
  rushAvailabilityResult.classList.remove("hidden", "is-available", "is-review", "is-unavailable", "is-checking");
  rushAvailabilityResult.classList.add(`is-${assessment.status}`);

  const isBulk = type === "bulk";
  const heading = assessment.status === "available"
    ? isBulk
      ? "Date available"
      : `Rush available - +${displaySettingMoney(assessment.fee)}`
    : assessment.status === "review"
      ? "Manual review needed"
      : assessment.status === "checking"
        ? `Checking ${isBulk ? "bulk date" : "rush availability"}…`
        : `${isBulk ? "Bulk date" : "Rush service"} unavailable`;

  const customerMessage = assessment.status === "review"
    ? "We’ll check this request and contact you before payment."
    : assessment.status === "unavailable"
      ? isBulk
        ? "Please choose another available date."
        : "Please choose another date."
      : assessment.status === "checking"
        ? "One moment please."
        : isBulk
          ? "This date is available. You can continue to payment."
          : "";

  rushAvailabilityResult.innerHTML = `
    <strong>${heading}</strong>
    ${customerMessage ? `<span>${customerMessage}</span>` : ""}
  `;
}

function showRushAssessment(assessment) {
  showSpecialOrderAssessment(assessment, "rush");
}

async function checkRushAvailability() {
  if (getCheckoutOrderType() !== "rush" || !requestedCompletionDate.value) {
    rushAssessment = null;
    rushAvailabilityResult.classList.add("hidden");
    return null;
  }

  const requestNumber = ++rushAssessmentRequest;
  const fingerprint = getRushFingerprint();
  rushAssessment = null;
  rushAssessmentFingerprint = "";
  showRushAssessment({ status: "checking", reason: "Checking current orders and printed inventory." });
  validateForm();

  const characterCount = names.reduce(
    (sum, item) =>
      sum + Array.from(sanitizeName(item.name)).length * getItemQuantity(item),
    0
  );
  const { data, error } = await supabase.rpc("assess_rush_order", {
    p_requested_date: requestedCompletionDate.value,
    p_keychain_count: getTotalKeychainQuantity(),
    p_character_count: characterCount,
    p_needs: getRushInventoryNeeds()
  });

  if (requestNumber !== rushAssessmentRequest) return rushAssessment;

  rushAssessment = error
    ? {
        status: "review",
        fee: getRushFee(),
        reason: "Automatic availability could not be confirmed, so we’ll review this request manually."
      }
    : {
        status: data?.status || "review",
        fee: Number(data?.fee ?? getRushFee()),
        reason: data?.reason || "We’ll review this request manually."
      };
  rushAssessmentFingerprint = fingerprint;

  if (error) console.warn("Rush assessment fallback:", error);
  showRushAssessment(rushAssessment);
  renderReviewOrder();
  validateForm();
  return rushAssessment;
}

function getBulkFingerprint() {
  return JSON.stringify({
    date: requestedCompletionDate.value,
    quantity: getTotalKeychainQuantity()
  });
}

async function checkBulkAvailability() {
  if (getCheckoutOrderType() !== "bulk" || !requestedCompletionDate.value) {
    bulkAssessment = null;
    bulkAssessmentFingerprint = "";
    rushAvailabilityResult.classList.add("hidden");
    return null;
  }

  const requestNumber = ++bulkAssessmentRequest;
  const fingerprint = getBulkFingerprint();
  bulkAssessment = null;
  bulkAssessmentFingerprint = "";
  showSpecialOrderAssessment({ status: "checking" }, "bulk");
  validateForm();

  const { data, error } = await supabase.rpc("check_bulk_order_date", {
    p_date: requestedCompletionDate.value,
    p_quantity: getTotalKeychainQuantity()
  });

  if (requestNumber !== bulkAssessmentRequest) return bulkAssessment;

  const allowed = !error && data?.allowed === true;
  bulkAssessment = {
    status: allowed ? "available" : "unavailable",
    reason:
      data?.reason ||
      (error
        ? "Bulk booking is temporarily unavailable."
        : "Please choose another date.")
  };
  bulkAssessmentFingerprint = fingerprint;

  if (!allowed && requestedCompletionDate.value) {
    const rejectedDate = requestedCompletionDate.value;
    if (!error && !bulkUnavailableDates.includes(rejectedDate)) {
      bulkUnavailableDates.push(rejectedDate);
    }
    specialDateCalendar?.clear();
    specialDateCalendar?.set({
      disable: [
        ...calendarClosureDates,
        ...bulkUnavailableDates
      ]
    });
    requestedCompletionDate.value = "";
    neededBy.value = "";
  }

  if (error) console.warn("Unable to check bulk date:", error);
  showSpecialOrderAssessment(bulkAssessment, "bulk");
  renderReviewOrder();
  validateForm();
  return bulkAssessment;
}

function updateTurnaroundMessaging() {
  const turnaround = getTurnaroundInfo();
  const itemWord = turnaround.quantity === 1 ? "keychain" : "keychains";
  const isBulk = turnaround.quantity >= bulkOrderQuantity;

  if (isBulk) {
    if (linkExistingOrderToggle.checked) {
      linkExistingOrderToggle.checked = false;
      linkExistingOrderPanel.classList.add("hidden");
      verifiedLinkedOrder = null;
    }
    linkExistingOrderToggle.disabled = true;
    collectionMethod.value = "delivery";
    collectionMethod.disabled = true;
    deliveryAddressSection.classList.remove("hidden");
  } else {
    linkExistingOrderToggle.disabled = false;
    collectionMethod.disabled = hasVerifiedLinkedOrder();
  }

  const methodIsDelivery = collectionMethod.value === "delivery";
  const range = `${turnaround.minDays}-${turnaround.maxDays} working days`;
  const estimateStart = alignToProductionDay(
    addWorkingDays(new Date(), turnaround.minDays)
  );
  const estimateEnd = alignToProductionDay(
    addWorkingDays(new Date(), turnaround.maxDays)
  );
  const bulkPolicy = getBulkApprovalPolicy(turnaround.quantity);
  const isRush = !isBulk && Boolean(rushOrderToggle?.checked);

  neededBy.value = isBulk || isRush
    ? requestedCompletionDate.value
    : toLocalDateString(estimateEnd);

  if (turnaroundSummary) {
    turnaroundSummary.innerHTML = isBulk
      ? `📦 <strong>${turnaround.quantity} ${itemWord}</strong> · allow <strong>${bulkPolicy.timeframeLabel}</strong>. Choose an available date and continue to payment.`
      : `
        🕒 <strong>${turnaround.quantity} ${itemWord}</strong>
        ${methodIsDelivery ? "estimated to dispatch" : "estimated ready for pickup"}
        in approximately <strong>${range}</strong>.
        ${methodIsDelivery ? "<br><small>Allow another 1–3 days for delivery.</small>" : ""}
      `;
  }

  automaticDateLabel.textContent = methodIsDelivery
    ? "Estimated dispatch"
    : "Estimated ready for collection";
  automaticDateRange.textContent = formatDateRange(
    estimateStart,
    estimateEnd,
    formatEstimateDate
  );
  automaticDateNote.textContent = methodIsDelivery
    ? "This is the dispatch date. Allow 1–3 days for delivery."
    : "Choose an available pickup slot below.";

  automaticDateCard.classList.toggle("hidden", isBulk || isRush);
  rushOrderOption.classList.toggle("hidden", isBulk);
  bulkOrderNotice.classList.add("hidden");
  specialDateSection.classList.toggle("hidden", !isBulk && !isRush);

  if (isBulk) {
    bulkOrderNotice.classList.remove("hidden");
    bulkOrderNotice.innerHTML = `
      <p>Only islandwide delivery is available for orders of ${bulkOrderQuantity} or more keychains.</p>
    `;
    specialDateLabel.textContent = methodIsDelivery
      ? "Choose your dispatch date"
      : "Choose your completion date";
    const earliestBulkDate = getBulkMinimumDate(turnaround.quantity);
    specialOrderMessage.textContent = methodIsDelivery
      ? `The earliest available dispatch date is ${formatEstimateDate(earliestBulkDate)}. It uses the current production capacity and your order size. Your selected date is accepted immediately. Allow 1–3 days for delivery.`
      : `The earliest available completion date is ${formatEstimateDate(earliestBulkDate)}. It uses the current production capacity and your order size. Your selected date is accepted immediately.`;
    orderNotes.placeholder = "Additional order notes (optional)...";

    if (requestedCompletionDate.value && bulkAssessmentFingerprint !== getBulkFingerprint()) {
      bulkAssessment = null;
      bulkAssessmentFingerprint = "";
      queueMicrotask(() => checkBulkAvailability());
    }
  } else if (isRush) {
    specialDateLabel.textContent = methodIsDelivery
      ? "When should we dispatch it?"
      : "When do you need it?";
    specialOrderMessage.textContent = methodIsDelivery
      ? "Choose an earlier dispatch date and we’ll check availability. Allow 1–3 days for delivery."
      : "Only dates earlier than the standard estimate are shown. Choose a date and we’ll check availability instantly.";
    orderNotes.placeholder = "Tell us about your deadline or event...";

    if (requestedCompletionDate.value && rushAssessmentFingerprint !== getRushFingerprint()) {
      rushAssessment = null;
      rushAssessmentFingerprint = "";
      queueMicrotask(() => checkRushAvailability());
    }
  } else {
    orderNotes.placeholder = methodIsDelivery
      ? "Delivery instructions or additional notes..."
      : "Additional order notes (optional)...";
    rushAssessment = null;
    rushAssessmentFingerprint = "";
    bulkAssessment = null;
    bulkAssessmentFingerprint = "";
    rushAvailabilityResult.classList.add("hidden");
  }

  if (specialDateCalendar) {
    const tomorrow = addWorkingDays(new Date(), 1);
    const bulkMinimumDate = getBulkMinimumDate(turnaround.quantity);
    const calendarMode = isRush ? "rush" : isBulk ? "bulk" : "standard";
    let calendarMaxDate;

    if (isRush) {
      calendarMaxDate = getAutomaticReadyDate();
      calendarMaxDate.setDate(calendarMaxDate.getDate() - 1);
    } else {
      calendarMaxDate = new Date(tomorrow);
      calendarMaxDate.setFullYear(calendarMaxDate.getFullYear() + 1);
    }

    specialDateCalendar.set({
      minDate: isBulk ? bulkMinimumDate : tomorrow,
      maxDate: calendarMaxDate,
      disable: [
        ...calendarClosureDates,
        ...(isBulk
          ? bulkUnavailableDates
          : isRush
            ? []
            : normalUnavailableDates)
      ]
    });

    if (isBulk && requestedCompletionDate.value) {
      const selectedBulkDate = dateFromLocalValue(requestedCompletionDate.value);
      if (
        !selectedBulkDate ||
        selectedBulkDate < bulkMinimumDate ||
        isCalendarDateUnavailable(selectedBulkDate, "bulk")
      ) {
        specialDateCalendar.clear();
        requestedCompletionDate.value = "";
        neededBy.value = "";
        bulkAssessment = null;
        bulkAssessmentFingerprint = "";
        rushAvailabilityResult.classList.add("hidden");
      }
    }

    // Flatpickr can remain parked on the old maximum month after its range
    // changes. Reset only when the order mode changes so month navigation
    // remains natural while the customer is choosing a date.
    if (calendarMode !== specialDateCalendarMode) {
      const selectedDate = specialDateCalendar.selectedDates[0];
      const firstAvailableDate = getFirstAvailableCalendarDate(
        calendarMode,
        isBulk ? bulkMinimumDate : tomorrow,
        calendarMaxDate
      );
      const dateToShow = selectedDate || firstAvailableDate;

      specialDateCalendar.jumpToDate(dateToShow, false);
      specialDateCalendarMode = calendarMode;
    }
  }

  if (submitOrderBtn) {
    submitOrderBtn.textContent = isBulk
      ? "Submit Order & Continue to Payment"
      : isRush
        ? "Submit Rush Request"
        : "Submit Order & Continue to Payment";
  }

  updateCheckoutPickupOptions();
}

function updateAddCartVisibility() {
  if (!addCartArea) return;

  const designArea =
    document.getElementById("designArea");

  const customiser =
    document.querySelector(".product-customiser");

  if (!designArea || !customiser) return;

  const customiserTop =
    customiser.getBoundingClientRect().top;

  const designBottom =
    designArea.getBoundingClientRect().bottom;

  const shouldShow =
    customiserTop < window.innerHeight * 0.9 &&
    designBottom > 100;

  addCartArea.classList.toggle(
    "mobile-cart-visible",
    shouldShow
  );
}

window.addEventListener(
  "scroll",
  updateAddCartVisibility,
  { passive: true }
);

window.addEventListener(
  "resize",
  updateAddCartVisibility
);

updateAddCartVisibility();

async function findAutomaticAvailableDate() {
  let candidate = getAutomaticReadyDate();

  for (let attempt = 0; attempt < 45; attempt += 1) {
    const day = candidate.getDay();
    if (day === 0 || day === 6) {
      candidate = addWorkingDays(candidate, 1);
      continue;
    }

    const candidateValue = toLocalDateString(candidate);
    const { data, error } = await supabase.rpc("check_needed_by_date", {
      p_date: candidateValue,
      p_quantity: getTotalKeychainQuantity()
    });

    if (error) {
      console.warn("Using calculated fulfilment date:", error);
      return candidateValue;
    }

    if (data?.allowed) return candidateValue;
    candidate = addWorkingDays(candidate, 1);
  }

  return toLocalDateString(candidate);
}

function sanitizeName(name) {
  if (activeProduct?.product_key === PENCIL_PRODUCT_KEY) {
    return sanitizePencilCharacters(name);
  }
  return Array.from(name || "")
    .map(char => /[a-z]/i.test(char) ? char.toUpperCase() : char)
    .filter(char => /[A-Z0-9]/.test(char) || specialKeycaps[char])
    .join("");
}

function getActiveProductCharacterLimit() {
  const configuredLimit = Math.max(
    1,
    Number(activeProduct?.maximum_characters) || 10
  );
  return [SOLID_PRODUCT_KEY, PENCIL_PRODUCT_KEY].includes(activeProduct?.product_key)
    ? Math.min(10, configuredLimit)
    : configuredLimit;
}

function limitKeychainName(value) {
  const normalized = activeProduct?.product_key === PENCIL_PRODUCT_KEY
    ? sanitizePencilCharacters(value)
    : String(value || "");
  return Array.from(normalized)
    .slice(0, getActiveProductCharacterLimit())
    .join("");
}

function enforceNameInputLimits() {
  const limitedSingleName = limitKeychainName(singleName.value);
  if (singleName.value !== limitedSingleName) {
    singleName.value = limitedSingleName;
  }

  const limitedLines = String(nameList.value || "")
    .split("\n")
    .map(limitKeychainName)
    .join("\n");
  if (nameList.value !== limitedLines) {
    nameList.value = limitedLines;
  }
}

function getApproximateKeychainSize(
  name,
  productKey = activeProduct?.product_key,
  design = getActiveDesign()
) {
  const characterCount = Array.from(sanitizeName(name)).length;

  if (productKey === PHOTO_PRODUCT_KEY) {
    const clicker = design?.photo?.variant === "clicker";
    return {
      characterCount: 1,
      lengthCm: clicker ? 7 : 6,
      heightCm: 6,
      thicknessCm: clicker ? 2.2 : .45
    };
  }

  if (productKey === STANDARD_PRODUCT_KEY) {
    const fontSize = getStandardFontSize(design);
    const cleanLength = Math.max(0, String(name || "").trim().length);
    const estimatedTextWidthMm = cleanLength * fontSize * 0.61;
    return {
      characterCount,
      lengthCm: characterCount ? (estimatedTextWidthMm + 13) / 10 : 0,
      heightCm: (fontSize + 5) / 10,
      thicknessCm: 0.42,
      fontSizeMm: fontSize
    };
  }

  if (productKey === PENCIL_PRODUCT_KEY) {
    return {
      characterCount,
      lengthCm: characterCount ? (characterCount * 30 + 80) / 10 : 0,
      heightCm: 3.4,
      thicknessCm: 3
    };
  }

  if (productKey === SOLID_PRODUCT_KEY) {
    const slotPitchMm = 20.5;
    const solidBaseLengthMm = 25.88 + Math.max(0, characterCount - 1) * slotPitchMm;
    return {
      characterCount,
      lengthCm: characterCount ? solidBaseLengthMm / 10 : 0,
      heightCm: 2.2,
      thicknessCm: 2.2
    };
  }

  if (!characterCount) {
    return {
      characterCount: 0,
      lengthCm: 0,
      heightCm: 2.7,
      thicknessCm: 2.2
    };
  }

  // Measurements come from the displayed STL models. Each additional
  // linked block adds approximately 28 mm to the overall length.
  const lengthMm = 34.8 + (characterCount - 1) * 28;

  return {
    characterCount,
    lengthCm: lengthMm / 10,
    heightCm: 2.7,
    thicknessCm: 2.2
  };
}

function getApproximateSizeText(name, product = activeProduct, design = getActiveDesign()) {
  const size = getApproximateKeychainSize(name, product.product_key, design);

  if (!size.characterCount) {
    return "Enter a name to see its approximate finished size.";
  }

  return `Approx. ${size.lengthCm.toFixed(1)} cm long × ${size.heightCm.toFixed(1)} cm tall × ${size.thicknessCm.toFixed(1)} cm thick`;
}

function displayIcon(char) {
  const map = {
    "♡": "🩷",
    "★": "⭐",
    "✿": "✿",
    "🎀": "🎀",
    "🐾": "🐾",
    "☘": "☘️",
    "🌙": "🌙",
    "♪": "🎵",
    "⚡": "⚡",
    "🔥": "🔥",
    "☕": "☕",
    "🦆": "🦆"
  };

  return map[char] || char;
}

let draftData = null;
let orderType = "single";
let giftingBagQuantity = 0;
let giftingBagStock = 0;
let giftingBagStockConfirmed = false;
let selectedIndex = 0;
let orderSubmitted = false;
let orderSubmissionInProgress = false;
let editingPendingOrder = false;
let pendingOrderEditableUntil = 0;
let currentSubmissionId = crypto.randomUUID();
let currentSubmissionOrderRef = "";
let photoRetryAvailableAt = 0;
let photoRetryTimer = null;
let photoKeepsakeState = {
  file: null,
  inputDataUrl: "",
  originalPath: "",
  artworkPath: "",
  artworkUrl: "",
  generationId: "",
  filamentPalette: []
};

let cartHasItems = false;
let draftHasMeaningfulChanges = false;

function getAvailableColours() {
  return colours
    .filter(c => c.available)
    .map(c => c.colour);
}

const available = getAvailableColours();
if (!available.length) available.push("#FFFFFF");

function getPencilDefaultColour(name, fallback) {
  return colours.find(colour =>
    colour.available && String(colour.name).toLowerCase() === String(name).toLowerCase()
  )?.colour || fallback || available[0];
}

const CLASSIC_PENCIL_COLOURS = {
  block: getPencilDefaultColour("Sunflower Yellow", available[1]),
  top: getPencilDefaultColour("Sunflower Yellow", available[1]),
  character: getPencilDefaultColour("Jade White", available[0]),
  eraser: getPencilDefaultColour("Pink", available[3]),
  ferrule: getPencilDefaultColour("Blue Grey", available[4]),
  wood: getPencilDefaultColour("Desert Tan", available[5]),
  tip: getPencilDefaultColour("Black", available[6]),
  endCap: getPencilDefaultColour("Sunflower Yellow", available[1])
};

let classicPencilDefaultsApplied = false;

function applyClassicPencilDefaults() {
  if (classicPencilDefaultsApplied) return;
  classicPencilDefaultsApplied = true;
  globalDesign.bases = [CLASSIC_PENCIL_COLOURS.block];
  globalDesign.caps = [CLASSIC_PENCIL_COLOURS.top];
  globalDesign.letters = [CLASSIC_PENCIL_COLOURS.character];
  globalDesign.pencil = normalizePencilDesign({
    textStyle: "raised",
    endingStyle: "eraser",
    eraser: CLASSIC_PENCIL_COLOURS.eraser,
    ferrule: CLASSIC_PENCIL_COLOURS.ferrule,
    wood: CLASSIC_PENCIL_COLOURS.wood,
    tip: CLASSIC_PENCIL_COLOURS.tip,
    endCap: CLASSIC_PENCIL_COLOURS.endCap
  });
  names.forEach(item => { item.custom = null; });
}

let globalDesign = {
  baseShape: "ribbed",
  letterOrientation: "vertical",
  fontSize: 24,
  nfcEnabled: false,
  nfcType: "guardian",
  nfcPayload: "",
  pencil: {
    textStyle: "raised",
    endingStyle: "eraser",
    eraser: CLASSIC_PENCIL_COLOURS.eraser,
    ferrule: CLASSIC_PENCIL_COLOURS.ferrule,
    wood: CLASSIC_PENCIL_COLOURS.wood,
    tip: CLASSIC_PENCIL_COLOURS.tip,
    endCap: CLASSIC_PENCIL_COLOURS.endCap
  },

  bases: [
    available[0]
  ],

  caps: [
    available[1] || available[0]
  ],

  letters: [
    available[2] || available[0]
  ]
};

function normalizePencilDesign(value = {}) {
  return {
    textStyle: "raised",
    endingStyle: value.endingStyle === "endCap" ? "endCap" : "eraser",
    eraser: value.eraser || CLASSIC_PENCIL_COLOURS.eraser,
    ferrule: value.ferrule || CLASSIC_PENCIL_COLOURS.ferrule,
    wood: value.wood || CLASSIC_PENCIL_COLOURS.wood,
    tip: value.tip || CLASSIC_PENCIL_COLOURS.tip,
    endCap: value.endCap || CLASSIC_PENCIL_COLOURS.endCap
  };
}

const BASE_SHAPES = {
  ribbed: {
    label: "Ribbed",
    file: "/models/base_ribbed.stl"
  },
  bubbly: {
    label: "Bubbly",
    file: "/models/base_bubbly.stl"
  }
};


let names = [];

function cloneCustomDesign(source = globalDesign) {
  return {
    baseShape: source?.baseShape || "ribbed",
    letterOrientation: source?.letterOrientation || "vertical",
    fontSize: getStandardFontSize(source || globalDesign),
    nfcEnabled: Boolean(source?.nfcEnabled),
    nfcType: source?.nfcType || "guardian",
    nfcPayload: source?.nfcPayload || "",
    photo: source?.photo ? structuredClone(source.photo) : null,
    pencil: normalizePencilDesign(source?.pencil || globalDesign.pencil),
    bases: [...(source?.bases || globalDesign.bases)],
    caps: [...(source?.caps || globalDesign.caps)],
    letters: [...(source?.letters || globalDesign.letters)]
  };
}

function getActiveProductBatchGroups() {
  const activeItems = names
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => getItemProduct(item).product_key === activeProduct.product_key);
  const grouped = new Map();
  activeItems.forEach(entry => {
    const id = entry.item.designBatchId || entry.item.design_batch_id || "batch-1";
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(entry);
  });
  return Array.from(grouped.entries()).map(([id, entries], groupIndex) => ({
    id,
    number: Number(entries[0]?.item?.designBatchNumber || entries[0]?.item?.design_batch_number) || groupIndex + 1,
    entries
  }));
}

function linkSharedBatchDesigns() {
  const groups = getActiveProductBatchGroups();
  if (groups.length < 2) return;
  groups.forEach(group => {
    const savedDesign = group.entries.find(({ item }) => item.custom)?.item.custom;
    const sharedDesign = cloneCustomDesign(savedDesign || globalDesign);
    group.entries.forEach(({ item }) => {
      item.custom = sharedDesign;
      item.designBatchId = group.id;
      item.designBatchNumber = group.number;
    });
  });
}

function formatActiveProductNames() {
  return formatDesignBatchNames(
    names.filter(item => getItemProduct(item).product_key === activeProduct.product_key)
  );
}

function getItemProduct(item) {
  return getProductByKey(
    productCatalog,
    item?.product_key || activeProduct?.product_key || MODULAR_PRODUCT_KEY
  );
}

function getCartEntries() {
  if (!cartHasItems) return [];
  return names
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.cartAdded !== false);
}

function getCartItems() {
  return getCartEntries().map(({ item }) => item);
}

function normalizeItemQuantity(value) {
  return Math.min(250, Math.max(1, Math.floor(Number(value) || 1)));
}

function getItemQuantity(item) {
  return normalizeItemQuantity(item?.quantity);
}

function getTotalKeychainQuantity() {
  const items = cartHasItems ? getCartItems() : names;
  return items.reduce((total, item) => total + getItemQuantity(item), 0);
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#efe9e1");

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
camera.position.set(0, 0, 180);

const controls = new OrbitControls(camera, renderer.domElement);

controls.enableDamping = true;
controls.enablePan = false;

// Don't allow flipping underneath
controls.minPolarAngle = Math.PI * 0.28;
controls.maxPolarAngle = Math.PI * 0.58;

// Limit left/right rotation slightly
controls.minAzimuthAngle = -Math.PI / 5;
controls.maxAzimuthAngle = Math.PI / 5;

// Optional: prevent zooming
// controls.enableZoom = false;

scene.add(new THREE.AmbientLight(0xffffff, 1.6));

const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
keyLight.position.set(50, 80, 70);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
fillLight.position.set(-40, 30, 30);
scene.add(fillLight);

const loader = new STLLoader();
const keychain = new THREE.Group();
scene.add(keychain);

const designInspiration =
  document.getElementById("designInspiration");

const geometryCache = {};

function generateOrderRef() {
  const date = new Date();
  const yymmdd = date.toISOString().slice(2, 10).replaceAll("-", "");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `LK-${yymmdd}-${random}`;
}

function createMat(colour) {
  return new THREE.MeshStandardMaterial({
    color: colour,
    roughness: 0.42,
    metalness: 0
  });
}

function createPencilSymbolMesh(character, colour) {
  const symbolCanvas = document.createElement("canvas");
  symbolCanvas.width = 256;
  symbolCanvas.height = 256;
  const context = symbolCanvas.getContext("2d");
  context.clearRect(0, 0, 256, 256);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = '190px "Arial Unicode MS", "Apple Symbols", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  context.fillStyle = "#ffffff";
  context.fillText(character, 128, 134);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = colour;
  context.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(symbolCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(15, 15),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide
    })
  );
}

function getUniqueColourCount(colours) {
  return new Set(
    colours.map(colour => colour.toLowerCase())
  ).size;
}

function calculatePrice(design, name = "", product = activeProduct) {
  if (isReadyMadeProduct(product)) {
    return roundMoney(getProductDisplayPrice(product));
  }
  const characterCount = Array.from(sanitizeName(name)).length;

  const productPrice = calculateProductUnitPrice({
    product,
    characterCount,
    baseColourCount: getUniqueColourCount(design.bases),
    capColourCount: getUniqueColourCount(design.caps),
    letterColourCount: getUniqueColourCount(design.letters)
  });
  const photoVariantPrice =
    product.product_key === PHOTO_PRODUCT_KEY && design?.photo?.variant === "clicker"
      ? Math.max(0, Number(shopSettings.photo_clicker_addon_price ?? 3))
      : 0;
  return roundMoney(productPrice + photoVariantPrice);
}

function getUnitPriceBreakdown(design, name = "", product = activeProduct) {
  if (isReadyMadeProduct(product)) {
    const unitTotal = roundMoney(getProductDisplayPrice(product));
    return { rows: [{ label: "Product price", amount: unitTotal, addOn: false }], unitTotal };
  }
  const characterCount = Array.from(sanitizeName(name)).length;
  const includedCharacters = Math.max(0, Number(product.included_characters) || 0);
  const extraCharacters = Math.max(0, characterCount - includedCharacters);
  const extraBaseColours = Math.max(
    0,
    getUniqueColourCount(design.bases) - Number(product.included_base_colours || 0)
  );
  const extraCapColours = Math.max(
    0,
    getUniqueColourCount(design.caps) - Number(product.included_cap_colours || 0)
  );
  const extraLetterColours = Math.max(
    0,
    getUniqueColourCount(design.letters) - Number(product.included_letter_colours || 0)
  );
  const basePrice = getProductDisplayPrice(product);
  const rows = [{
    label: `Base price · includes up to ${includedCharacters} character${includedCharacters === 1 ? "" : "s"}`,
    amount: basePrice,
    addOn: false
  }];

  [
    ["Extra character", extraCharacters, Number(product.extra_character_price || 0)],
    ["Extra base colour", extraBaseColours, Number(product.extra_base_colour_price || 0)],
    ["Extra cap colour", extraCapColours, Number(product.extra_cap_colour_price || 0)],
    ["Extra letter colour", extraLetterColours, Number(product.extra_letter_colour_price || 0)]
  ].forEach(([label, quantity, unitAmount]) => {
    if (!quantity || !unitAmount) return;
    rows.push({
      label: `${label}${quantity === 1 ? "" : "s"} · ${quantity} × S$${unitAmount.toFixed(2)}`,
      amount: roundMoney(quantity * unitAmount),
      addOn: true
    });
  });

  if (product.product_key === PHOTO_PRODUCT_KEY && design?.photo?.variant === "clicker") {
    rows.push({
      label: "Clicker keychain upgrade",
      amount: Math.max(0, Number(shopSettings.photo_clicker_addon_price ?? 3)),
      addOn: true
    });
  }

  return {
    rows,
    unitTotal: calculatePrice(design, name, product)
  };
}

function renderColourChargeNotices() {
  const design = getActiveDesign();
  [
    ["baseColourPriceNotice", design.bases, activeProduct.included_base_colours, activeProduct.extra_base_colour_price, "base"],
    ["capColourPriceNotice", design.caps, activeProduct.included_cap_colours, activeProduct.extra_cap_colour_price, "cap"],
    ["letterColourPriceNotice", design.letters, activeProduct.included_letter_colours, activeProduct.extra_letter_colour_price, "letter/icon"]
  ].forEach(([id, selectedColours, includedCount, extraPrice, label]) => {
    const element = document.getElementById(id);
    if (!element) return;
    if (activeProduct.product_key === PENCIL_PRODUCT_KEY) {
      const pencilLabels = {
        baseColourPriceNotice: "Add more colours to alternate the pencil blocks.",
        capColourPriceNotice: "Add more colours to alternate the clicker tops.",
        letterColourPriceNotice: "Add more colours to alternate the letters and symbols."
      };
      element.classList.remove("has-charge");
      element.textContent = pencilLabels[id];
      return;
    }
    if (id === "baseColourPriceNotice" && activeProduct.product_key === SOLID_PRODUCT_KEY) {
      element.classList.remove("has-charge");
      element.textContent = "The compact solid base is one piece and uses one base colour.";
      return;
    }
    const uniqueCount = getUniqueColourCount(selectedColours || []);
    const extras = Math.max(0, uniqueCount - Number(includedCount || 0));
    const unitPrice = Number(extraPrice || 0);
    element.classList.toggle("has-charge", extras > 0);
    element.textContent = extras > 0
      ? `${extras} extra ${label} colour${extras === 1 ? "" : "s"}: +${displaySettingMoney(extras * unitPrice)}`
      : `One ${label} colour is included. Each additional colour adds ${displaySettingMoney(unitPrice)}.`;
  });
}

function getActiveDesign() {
  const item = names[selectedIndex];

  if (applyAllToggle.checked || !item) {
    return globalDesign;
  }

  if (!item.custom) {
    item.custom = {
      baseShape: globalDesign.baseShape || "ribbed",
      letterOrientation: globalDesign.letterOrientation || "vertical",
      fontSize: getStandardFontSize(globalDesign),
      nfcEnabled: Boolean(globalDesign.nfcEnabled),
      nfcType: globalDesign.nfcType || "guardian",
      nfcPayload: globalDesign.nfcPayload || "",
      pencil: normalizePencilDesign(globalDesign.pencil),
      bases: [...globalDesign.bases],
      caps: [...globalDesign.caps],
      letters: [...globalDesign.letters]
    };
  }

  item.custom.fontSize = getStandardFontSize(item.custom);

  return item.custom;
}

function getUnavailableDesignColours(design) {
  return [
    ...(design?.bases || []),
    ...(design?.caps || []),
    ...(design?.letters || [])
  ]
    .filter(colour => !isShopColourAvailable(colour))
    .map(colour => shopColourNameByHex[String(colour).toLowerCase()] || colour)
    .filter((name, index, list) => list.indexOf(name) === index);
}

function applyDesignPreset(presetKey) {
  const preset = DESIGN_PRESETS[presetKey];

  if (!preset) return;

  const unavailable = getUnavailableDesignColours({
    bases: [preset.base],
    caps: [preset.cap],
    letters: [preset.letter]
  });

  if (unavailable.length) {
    alert(
      `${unavailable.join(", ")} ${
        unavailable.length === 1 ? "is" : "are"
      } currently out of stock. Please choose another colour idea.`
    );
    return;
  }

  const design = getActiveDesign();
  design.bases = [preset.base];
  design.caps = [preset.cap];
  design.letters = [preset.letter];

  if (applyAllToggle.checked) {
    globalDesign.bases = [preset.base];
    globalDesign.caps = [preset.cap];
    globalDesign.letters = [preset.letter];

    names.forEach(item => {
      item.custom = null;
    });
  }

  draftHasMeaningfulChanges = true;

  if (inspirationStatus) {
    const selectedName = names[selectedIndex]?.name || "your keychain";
    inspirationStatus.textContent =
      `${preset.label} applied to ${selectedName} ♡`;
  }

  refreshUI();
  buildSelectedPreview();
  saveDraft();
}

let currentAiDesignSuggestions = [];

function renderAiDesignSuggestions(suggestions) {
  currentAiDesignSuggestions = suggestions;
  if (!aiDesignSuggestions) return;
  aiDesignSuggestions.classList.toggle("hidden", !suggestions.length);
  aiDesignSuggestions.innerHTML = suggestions.map((suggestion, index) => `
    <article>
      <div class="ai-design-swatch-row">
        <i style="background:${suggestion.baseHex}"></i>
        <i style="background:${suggestion.capHex}"></i>
        <i style="background:${suggestion.letterHex}"></i>
        ${suggestion.icon ? `<b>${escapePresetText(suggestion.icon)}</b>` : ""}
      </div>
      <strong>${escapePresetText(suggestion.title)}</strong>
      <span>${escapePresetText(suggestion.description || suggestion.reason)}</span>
      <button type="button" data-ai-design-index="${index}">Use These Colours</button>
    </article>
  `).join("");
}

async function requestAiDesignSuggestions() {
  const brief = String(aiDesignBrief?.value || "").trim();
  if (!brief) {
    aiDesignHelperStatus.textContent = "Tell us the vibe you want first.";
    aiDesignBrief?.focus();
    return;
  }
  const palette = colours.filter(item => item.available).map(item => ({
    name: item.name,
    hex: item.colour,
    material: item.materialType
  }));
  const allowedIcons = activeProduct.product_key === PENCIL_PRODUCT_KEY
    ? Object.keys(PENCIL_SYMBOLS)
    : iconChoices;
  aiDesignHelperBtn.disabled = true;
  aiDesignHelperBtn.textContent = "Thinking…";
  aiDesignHelperStatus.textContent = "Matching ideas to the colours currently in stock…";
  renderAiDesignSuggestions([]);
  try {
    const { data, error } = await supabase.functions.invoke("little-keeps-ai", {
      body: {
        mode: "design_helper",
        brief,
        product_name: activeProduct.name,
        palette,
        icons: allowedIcons
      }
    });
    if (error) {
      const details = await getPhotoFunctionErrorDetails(error);
      throw new Error(details.error || error.message || "Suggestions are unavailable right now.");
    }
    const suggestions = normalizeAiDesignSuggestions(data?.suggestions, palette, allowedIcons);
    if (!suggestions.length) throw new Error("No in-stock combinations were returned. Please try again.");
    renderAiDesignSuggestions(suggestions);
    aiDesignHelperStatus.textContent = "Choose one, or keep your current design.";
  } catch (error) {
    aiDesignHelperStatus.textContent = error.message || "Suggestions are unavailable right now.";
  } finally {
    aiDesignHelperBtn.disabled = false;
    aiDesignHelperBtn.textContent = "Suggest Ideas";
  }
}

function applyAiDesignSuggestion(index) {
  const suggestion = currentAiDesignSuggestions[Number(index)];
  if (!suggestion) return;
  const design = getActiveDesign();
  design.bases = [suggestion.baseHex];
  design.caps = [suggestion.capHex];
  design.letters = [suggestion.letterHex];
  if (applyAllToggle.checked) {
    Object.assign(globalDesign, {
      bases: [suggestion.baseHex],
      caps: [suggestion.capHex],
      letters: [suggestion.letterHex]
    });
    names.forEach(item => { item.custom = null; });
  }
  draftHasMeaningfulChanges = true;
  aiDesignHelperStatus.textContent = `${suggestion.title} applied. ${suggestion.icon ? `${suggestion.icon} is an optional icon idea.` : ""}`;
  refreshUI();
  buildSelectedPreview();
  saveDraft();
}

async function checkPhotoSuitability(imageDataUrl) {
  if (!photoSuitabilityCheck) return;
  photoSuitabilityCheck.className = "photo-suitability-check is-checking";
  photoSuitabilityCheck.innerHTML = "<strong>Checking your photo…</strong>";
  try {
    const { data, error } = await supabase.functions.invoke("little-keeps-ai", {
      body: {
        mode: "photo_check",
        image_data_url: imageDataUrl,
        subject_type: photoSubjectType?.value || "person"
      }
    });
    if (error) {
      const details = await getPhotoFunctionErrorDetails(error);
      throw new Error(details.error || error.message);
    }
    const suitable = Boolean(data?.suitable);
    photoSuitabilityCheck.className = `photo-suitability-check ${suitable ? "is-great" : "is-difficult"}`;
    photoSuitabilityCheck.innerHTML = suitable
      ? "<strong>✓ This photo should work well.</strong>"
      : "<strong>Try another photo for a clearer result.</strong>";
  } catch (error) {
    photoSuitabilityCheck.className = "photo-suitability-check hidden";
    photoSuitabilityCheck.innerHTML = "";
  }
}

function randomiseArticulatedColours() {
  if (activeProduct.product_key === STANDARD_PRODUCT_KEY) return;
  const availableHexes = colours.filter(item => item.available).map(item => item.colour);
  const characterCount = Array.from(
    sanitizeName(names[selectedIndex]?.name || singleName?.value || "")
  ).length;
  const selected = pickRandomDesignColourSets({
    baseColours: availableHexes,
    capColours: availableHexes,
    letterColours: availableHexes,
    characterCount,
    allowMultiple: Boolean(randomiseMultipleColours?.checked)
  });
  const design = getActiveDesign();
  const singleColourParts = activeProduct.product_key === SOLID_PRODUCT_KEY;
  design.bases = singleColourParts ? selected.bases.slice(0, 1) : selected.bases;
  design.caps = selected.caps;
  design.letters = selected.letters;
  if (activeProduct.product_key === PENCIL_PRODUCT_KEY) {
    const randomPartColour = () => availableHexes[Math.floor(Math.random() * availableHexes.length)] || available[0];
    design.pencil = normalizePencilDesign({
      ...design.pencil,
      eraser: randomPartColour(),
      ferrule: randomPartColour(),
      wood: CLASSIC_PENCIL_COLOURS.wood,
      tip: randomPartColour(),
      endCap: randomPartColour()
    });
  }

  if (applyAllToggle.checked) {
    globalDesign.bases = [...design.bases];
    globalDesign.caps = [...design.caps];
    globalDesign.letters = [...design.letters];
    if (activeProduct.product_key === PENCIL_PRODUCT_KEY) {
      globalDesign.pencil = normalizePencilDesign(design.pencil);
    }
    names.forEach(item => { item.custom = null; });
  }

  draftHasMeaningfulChanges = true;
  if (randomiseColoursStatus) {
    const isMixed = [selected.bases, selected.caps, selected.letters]
      .some(selection => selection.length > 1);
    randomiseColoursStatus.textContent = isMixed
      ? "Mixed palette chosen ♡ Any extra colour add-ons are included in the price shown."
      : characterCount < 2 && randomiseMultipleColours?.checked
        ? "One character uses one colour per part, so a single palette was chosen ♡"
        : `Palette chosen: ${getColourName(selected.bases[0])}, ${getColourName(selected.caps[0])} and ${getColourName(selected.letters[0])} ♡`;
  }
  refreshUI();
  buildSelectedPreview();
  saveDraft();
}

function randomiseColourPart(part) {
  if (activeProduct.product_key === STANDARD_PRODUCT_KEY && part === "caps") return;
  const availableHexes = colours.filter(item => item.available).map(item => item.colour);
  const characterCount = Array.from(
    sanitizeName(names[selectedIndex]?.name || singleName?.value || "")
  ).length;
  const selected = pickRandomDesignColourSets({
    baseColours: availableHexes,
    capColours: availableHexes,
    letterColours: availableHexes,
    characterCount,
    allowMultiple: Boolean(randomiseMultipleColours?.checked)
  });
  const property = part === "base" ? "bases" : part === "cap" ? "caps" : "letters";
  const design = getActiveDesign();
  design[property] = activeProduct.product_key === SOLID_PRODUCT_KEY && part === "base"
    ? selected[property].slice(0, 1)
    : [...selected[property]];

  if (applyAllToggle.checked) {
    globalDesign[property] = [...design[property]];
    names.forEach(item => { item.custom = null; });
  }

  draftHasMeaningfulChanges = true;
  if (randomiseColoursStatus) {
    const label = part === "letter" ? "Letter/icon" : `${part[0].toUpperCase()}${part.slice(1)}`;
    randomiseColoursStatus.textContent = `${label} colours refreshed ♡`;
  }
  refreshUI();
  buildSelectedPreview();
  saveDraft();
}

function makeSwatches(containerId, colourOptions, type) {
  const container = document.getElementById(containerId);
  const hint = document.getElementById(`${type}ColourHint`);

  container.innerHTML = "";

  if (hint) {
    hint.textContent = "Hover or tap a colour";
  }

  container.classList.add("material-swatch-groups");

  ["BASIC", "MATTE"].forEach(materialType => {
    const group = document.createElement("section");
    group.className = `material-swatch-group material-${materialType.toLowerCase()}`;
    const heading = document.createElement("h4");
    heading.textContent = materialType;
    const options = document.createElement("div");
    options.className = "material-swatches";
    const materialColours = colourOptions.filter(
      item => item.materialType === materialType
    );

    if (!materialColours.length) {
      const empty = document.createElement("p");
      empty.className = "material-colour-empty";
      empty.textContent = "No colours added yet";
      options.appendChild(empty);
    }

    materialColours.forEach(item => {
    const option = document.createElement("div");
    option.className = "swatch-option";
    const btn = document.createElement("button");

    btn.type = "button";
    btn.className = "swatch";
    btn.style.backgroundColor = item.colour;
    const colourLabel = `${item.name} · ${item.materialType}`;
    btn.title = colourLabel;
    btn.setAttribute("aria-label", colourLabel);

    const showColourName = () => {
      if (!hint) return;

      hint.innerHTML = `
        <span
          class="colour-hint-dot"
          style="background:${item.colour}"
        ></span>
        ${colourLabel}
      `;
    };

    btn.addEventListener("mouseenter", showColourName);
    btn.addEventListener("focus", showColourName);
    btn.addEventListener("touchstart", showColourName, {
      passive: true
    });

    if (!item.available) {
      btn.classList.add("oos");

      btn.onclick = () => {
        showColourName();

        alert(
          `${item.name} is currently out of stock.` +
          `${item.note ? `\n\n${item.note}` : ""}`
        );
      };
    } else {
      btn.onclick = () => {
        showColourName();

        addColourToDesign(type, item.colour);
        refreshUI();
        buildSelectedPreview();
      };
    }

    const label = document.createElement("span");
    label.textContent = item.name;
    option.append(btn, label);
    options.appendChild(option);
    });

    group.append(heading, options);
    container.appendChild(group);
  });
}

backBtn.onclick = () => {
  setStorefrontView("design", {
    scrollTo: "designArea"
  });
};

function getOrderSubtotal() {
  const pricedItems = cartHasItems ? getCartItems() : names;
  const keychainSubtotal = pricedItems.reduce(
    (sum, item) => {
      const product = getItemProduct(item);
      return sum + calculatePrice(getDesign(item), item.name, product) * getItemQuantity(item);
    },
    0
  );

  return roundMoney(
    keychainSubtotal + calculateGiftingBagTotal(giftingBagQuantity, GIFTING_BAG_PRICE)
  );
}

function getMaxGiftingBagQuantity() {
  if (!giftingBagStockConfirmed) return 0;
  return getGiftingBagSelectionLimit(0, giftingBagStock);
}

function updateGiftingBagOptions() {
  if (!giftingBagQuantityInput) return;

  const maxGiftingBagQuantity = getMaxGiftingBagQuantity();

  giftingBagQuantity = Math.min(
    Math.max(0, Math.floor(Number(giftingBagQuantity) || 0)),
    maxGiftingBagQuantity
  );

  giftingBagQuantityInput.max = String(maxGiftingBagQuantity);
  giftingBagQuantityInput.value = String(giftingBagQuantity);
  giftingBagQuantityInput.disabled = !giftingBagStockConfirmed || maxGiftingBagQuantity === 0;
  giftingBagDecrease.disabled = giftingBagQuantity <= 0;
  giftingBagIncrease.disabled =
    !giftingBagStockConfirmed || giftingBagQuantity >= maxGiftingBagQuantity;

  if (giftingBagStockStatus) {
    giftingBagStockStatus.textContent = !giftingBagStockConfirmed
      ? "Stock unavailable"
      : giftingBagStock <= 0
        ? "Currently out of stock"
        : `${giftingBagStock} available`;
  }
}

async function refreshGiftingBagStock() {
  let stockValue = null;

  const rpcResult = await supabase.rpc("get_gifting_bag_stock");

  if (!rpcResult.error) {
    stockValue = rpcResult.data;
  } else {
    const fallback = await supabase
      .from("inventory_items")
      .select("qty")
      .eq("item_name", "Gifting Bag")
      .maybeSingle();

    if (!fallback.error) stockValue = fallback.data?.qty;
  }

  const parsedStock = Number(stockValue);
  giftingBagStockConfirmed = Number.isFinite(parsedStock);
  giftingBagStock = giftingBagStockConfirmed
    ? Math.max(0, Math.floor(parsedStock))
    : 0;
  updateGiftingBagOptions();

  return giftingBagStockConfirmed;
}

function hasVerifiedLinkedOrder() {
  return Boolean(
    linkExistingOrderToggle?.checked &&
    verifiedLinkedOrder?.orderRef &&
    verifiedLinkedOrder.orderRef === existingOrderRef.value.trim().toUpperCase() &&
    verifiedLinkedOrder.email === customerEmail.value.trim().toLowerCase()
  );
}

function resetLinkedOrderVerification(message = "Enter the original order ID and use the same email address above.") {
  verifiedLinkedOrder = null;
  collectionMethod.disabled = false;
  existingOrderLinkStatus.className = "hint";
  existingOrderLinkStatus.textContent = message;
  validateForm();
}

async function verifyExistingOrderLink() {
  const orderRef = existingOrderRef.value.trim().toUpperCase();
  const email = customerEmail.value.trim().toLowerCase();

  existingOrderRef.value = orderRef;

  if (!orderRef || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    resetLinkedOrderVerification("Enter the original order ID and a valid matching email address first.");
    return;
  }

  verifyExistingOrderBtn.disabled = true;
  verifyExistingOrderBtn.textContent = "Checking…";
  existingOrderLinkStatus.className = "hint is-checking";
  existingOrderLinkStatus.textContent = "Checking that the original order can still accept an add-on…";

  const { data, error } = await supabase.rpc("verify_add_on_order", {
    p_order_ref: orderRef,
    p_email: email
  });

  verifyExistingOrderBtn.disabled = false;
  verifyExistingOrderBtn.textContent = "Verify & Link";

  if (error || !data?.allowed) {
    verifiedLinkedOrder = null;
    collectionMethod.disabled = false;
    existingOrderLinkStatus.className = "hint is-error";
    existingOrderLinkStatus.textContent =
      data?.reason ||
      "Unable to verify this order. Check the ID and email, or try again after the linking update is installed.";
    validateForm();
    return;
  }

  verifiedLinkedOrder = {
    orderRef: String(data.order_ref || orderRef).toUpperCase(),
    email,
    collectionMethod: data.collection_method || "pickup",
    latestDate: data.latest_date || ""
  };
  existingOrderRef.value = verifiedLinkedOrder.orderRef;
  collectionMethod.value = verifiedLinkedOrder.collectionMethod;
  collectionMethod.disabled = true;
  deliveryAddressSection.classList.add("hidden");
  existingOrderLinkStatus.className = "hint is-success";
  existingOrderLinkStatus.textContent =
    `Linked to ${verifiedLinkedOrder.orderRef} ✓ Same collection method and no second delivery fee. Admin will see everything together under this order ID.`;
  updateCollectionNote();
  renderReviewOrder();
  validateForm();
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function getAppliedPromo() {
  return appliedPromoCode
    ? PROMO_CODES[appliedPromoCode] || null
    : null;
}

function getPromoDiscount(subtotal) {
  const promo = getAppliedPromo();
  return calculatePromoDiscount(promo, subtotal);
}

function getPromoOfferLabel(promo) {
  if (!promo) return "Promo";

  return promo.discountType === "fixed"
    ? `${displaySettingMoney(promo.discountValue)} off`
    : `${Number(promo.discountValue || 0)}% off`;
}

function getPromoEligibility(promo, subtotal = getOrderSubtotal()) {
  const eligibility = assessPromoEligibility(promo, subtotal);
  const messages = {
    invalid: "Sorry, that promo code is not valid.",
    not_started: "This promo code is not active yet.",
    expired: "This promo code has expired.",
    minimum_spend: `A minimum spend of ${displaySettingMoney(promo?.minimumSpend)} is required.`
  };
  return {
    ...eligibility,
    message: messages[eligibility.reason] || ""
  };
}

function showPromoStatus(message, type = "") {
  promoCodeStatus.textContent = message;
  promoCodeStatus.classList.remove("success", "error");

  if (type) promoCodeStatus.classList.add(type);
}

function applyPromoCode() {
  const enteredCode = normalizePromoCode(promoCodeInput.value);

  if (!enteredCode) {
    appliedPromoCode = "";
    showPromoStatus("Promo code removed.");
    renderReviewOrder();
    saveDraft();
    return;
  }

  const promo = PROMO_CODES[enteredCode];

  if (!promo) {
    appliedPromoCode = "";
    showPromoStatus("Sorry, that promo code is not valid.", "error");
    renderReviewOrder();
    return;
  }

  const eligibility = getPromoEligibility(promo);

  if (!eligibility.allowed) {
    appliedPromoCode = "";
    showPromoStatus(eligibility.message, "error");
    renderReviewOrder();
    return;
  }

  appliedPromoCode = enteredCode;
  promoCodeInput.value = enteredCode;
  draftHasMeaningfulChanges = true;

  showPromoStatus(
    `Applied! ${promo.label} gives you ${getPromoOfferLabel(promo)} ♡`,
    "success"
  );

  renderReviewOrder();
  saveDraft();
}

function updateCartDisplay() {
  const totalKeychains = getTotalKeychainQuantity();
  const cartCount = cartHasItems ? totalKeychains : 0;
  const activeDesignItems = names.filter(item =>
    getItemProduct(item).product_key === activeProduct.product_key &&
    (!cartHasItems || item.cartAdded === false || item === names[selectedIndex])
  );
  const currentDesignTotal = roundMoney(activeDesignItems.reduce((sum, item) =>
    sum + calculatePrice(getDesign(item), item.name, getItemProduct(item)) * getItemQuantity(item), 0
  ));
  const currentDesignQuantity = activeDesignItems.reduce(
    (sum, item) => sum + getItemQuantity(item),
    0
  );
  const cartSubtotal = cartHasItems ? getOrderSubtotal() : 0;

  headerCartCount.textContent = cartCount;
  sideCartCount.textContent = cartCount;
  cartDrawerSubtotal.textContent = `$${cartSubtotal.toFixed(2)}`;

  if (designTotalDisplay) {
    designTotalDisplay.textContent =
      `$${currentDesignTotal.toFixed(2)}`;
  }

  if (mobileOrderSummary) {
    mobileOrderSummary.textContent =
      `${currentDesignQuantity} keychain${currentDesignQuantity === 1 ? "" : "s"}`;
  }

  if (addCartButtonLabel) {
    const selectedItem = names[selectedIndex];
    const isNewDesign = selectedItem?.cartAdded === false;
    addCartButtonLabel.textContent =
      cartHasItems && !isNewDesign ? "Update Cart" : "Add to Cart";
  }

  headerCartBtn.setAttribute(
    "aria-label",
    cartHasItems
      ? `Open cart with ${cartCount} keychain${cartCount === 1 ? "" : "s"}`
      : "Cart is empty"
  );
}

function addColourToDesign(type, colour) {
  const design = getActiveDesign();

  const isStandardProduct =
    activeProduct.product_key === STANDARD_PRODUCT_KEY;
  const isSolidProduct =
    activeProduct.product_key === SOLID_PRODUCT_KEY;
  if (isStandardProduct || (isSolidProduct && type === "base")) {
    if (type === "base") {
      design.bases = [colour];
    }

    if (type === "letter") {
      design.letters = [colour];
    }

    if (type === "cap") return;
  } else {
    if (type === "base") design.bases.push(colour);
    if (type === "cap") design.caps.push(colour);
    if (type === "letter") design.letters.push(colour);
  }

  if (applyAllToggle.checked) {
    names.forEach(item => {
      item.custom = null;
    });
  }
}

async function setupNeededByCalendar() {
  const minDate = addWorkingDays(new Date(), 1);

  const maxDate = new Date(minDate);
  maxDate.setFullYear(maxDate.getFullYear() + 1);

  const today = toLocalDateString(new Date());

  const [closureResult, unavailableDateResult, bulkUnavailableDateResult, dayOverrideResult] = await Promise.all([
    supabase
      .from("shop_closures")
      .select("start_date, end_date")
      .gte("end_date", today),
    supabase.rpc("get_unavailable_needed_by_dates", {
      p_start: toLocalDateString(minDate),
      p_end: toLocalDateString(maxDate)
    }),
    supabase.rpc("get_unavailable_bulk_dates", {
      p_start: toLocalDateString(minDate),
      p_end: toLocalDateString(maxDate)
    }),
    supabase.rpc("get_pickup_unavailable_dates", {
      p_start: today,
      p_end: toLocalDateString(maxDate)
    })
  ]);

  if (closureResult.error) {
    console.error("Unable to load shop closures:", closureResult.error);
  }

  if (unavailableDateResult.error) {
    console.error(
      "Unable to load full order dates:",
      unavailableDateResult.error
    );
  }

  if (bulkUnavailableDateResult.error) {
    console.error(
      "Unable to load bulk booking dates:",
      bulkUnavailableDateResult.error
    );
  }
  if (dayOverrideResult.error) {
    console.warn("Pickup blackout dates are not ready yet:", dayOverrideResult.error);
  }

  const closureDates = (closureResult.data || []).map(item => ({
    from: item.start_date,
    to: item.end_date
  }));

  if (!closureResult.error) {
    shopClosureRanges = (closureResult.data || []).map(item => ({
      start_date: item.start_date,
      end_date: item.end_date,
      reason: item.reason || "Shop closed"
    }));
  }
  pickupUnavailableDates = (dayOverrideResult.data || [])
    .map(item => String(item.unavailable_date || "").slice(0, 10))
    .filter(Boolean);

  const fullOrderDates = (unavailableDateResult.data || [])
    .map(item => item.unavailable_date)
    .filter(Boolean);

  const unavailableBulkDates = (bulkUnavailableDateResult.data || [])
    .map(item => item.unavailable_date)
    .filter(Boolean);

  calendarClosureDates = closureDates;
  normalUnavailableDates = fullOrderDates;
  bulkUnavailableDates = unavailableBulkDates;

  specialDateCalendar = flatpickr(requestedCompletionDate, {
    dateFormat: "Y-m-d",
    minDate,
    maxDate,
    disable: [
      ...calendarClosureDates,
      ...normalUnavailableDates
    ],

    onOpen: (_selectedDates, _dateString, instance) => {
      const mode = getCheckoutOrderType() === "bulk"
        ? "bulk"
        : getCheckoutOrderType() === "rush"
          ? "rush"
          : "standard";
      const configuredMinimum =
        instance.config.minDate ||
        addWorkingDays(new Date(), 1);
      const configuredMaximum =
        instance.config.maxDate ||
        maxDate;
      const firstAvailableDate = getFirstAvailableCalendarDate(
        mode,
        configuredMinimum,
        configuredMaximum
      );

      instance.jumpToDate(
        instance.selectedDates[0] || firstAvailableDate,
        false
      );
    },

    onChange: async () => {
      neededBy.value = requestedCompletionDate.value;
      rushAssessment = null;
      rushAssessmentFingerprint = "";
      if (getCheckoutOrderType() === "rush") {
        await checkRushAvailability();
      } else if (getCheckoutOrderType() === "bulk") {
        await checkBulkAvailability();
      }
      validateForm();
    }
  });

  setupCheckoutPickupCalendar();
  updateTurnaroundMessaging();
  renderAvailabilityPreview();
}

async function loadShopNotices() {
  const today = toLocalDateString(new Date());

  const { data, error } = await supabase
    .from("shop_closures")
    .select("*")
    .gte("end_date", today)
    .order("start_date", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  shopClosureRanges = (data || []).map(item => ({
    start_date: item.start_date,
    end_date: item.end_date,
    reason: item.reason || "Shop closed"
  }));

  updateTurnaroundMessaging();
  renderAvailabilityPreview();

  const holidayNotice = document.getElementById("holidayNotice");
  const holidayNoticeDivider = document.getElementById("holidayNoticeDivider");

  if (!data.length) {
    holidayNotice?.classList.add("hidden");
    holidayNoticeDivider?.classList.add("hidden");
    return;
  }

  const notice = data[0];

  document.getElementById("holidayNoticeText").innerText =
    notice.reason || `We will be away from ${notice.start_date} to ${notice.end_date}.`;
  holidayNotice?.classList.remove("hidden");
  holidayNoticeDivider?.classList.remove("hidden");
}

function startLaunchPriceCountdown() {
  const countdown = document.getElementById("launchPriceCountdown");
  const divider = document.getElementById("launchCountdownDivider");
  const text = document.getElementById("launchCountdownText");

  if (
    !countdown ||
    !text ||
    !launchPriceEnabled ||
    !launchPriceHasDeadline
  ) {
    countdown?.classList.add("hidden");
    divider?.classList.add("hidden");
    return;
  }

  const update = () => {
    const remaining = launchPriceEndsAtTimestamp - Date.now();

    if (remaining <= 0) {
      countdown.classList.add("hidden");
      divider?.classList.add("hidden");
      window.location.reload();
      return;
    }

    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    text.textContent = days > 0
      ? `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`
      : `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  };

  update();
  window.setInterval(update, 1000);
}

function startFeaturedPromoCountdown() {
  const announcement = document.getElementById("featuredPromoAnnouncement");
  const divider = document.getElementById("featuredPromoDivider");
  const text = document.getElementById("featuredPromoCountdownText");

  if (
    !announcement ||
    !featuredPromo ||
    !featuredPromoHasDeadline ||
    !text
  ) {
    return;
  }

  const update = () => {
    const remaining = featuredPromoEndsAtTimestamp - Date.now();

    if (remaining <= 0) {
      announcement.classList.add("hidden");
      divider?.classList.add("hidden");
      window.location.reload();
      return;
    }

    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    text.textContent = days > 0
      ? `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`
      : `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  };

  update();
  window.setInterval(update, 1000);
}

function removeColourFromDesign(type, index) {
  const isStandardProduct =
    activeProduct.product_key === STANDARD_PRODUCT_KEY;
  const isFixedSolidBase =
    activeProduct.product_key === SOLID_PRODUCT_KEY && type === "base";
  // Standard keychains must always keep one background
  // colour and one name colour.
  if (isStandardProduct || isFixedSolidBase) return;

  const design = getActiveDesign();

  if (type === "base" && design.bases.length > 1) {
    design.bases.splice(index, 1);
  }

  if (type === "cap" && design.caps.length > 1) {
    design.caps.splice(index, 1);
  }

  if (type === "letter" && design.letters.length > 1) {
    design.letters.splice(index, 1);
  }

  if (applyAllToggle.checked) {
    names.forEach(item => {
      item.custom = null;
    });
  }

  refreshUI();
  buildSelectedPreview();
}


function renderColourSlots() {
  const design = getActiveDesign();
  renderSlots("baseSlots", design.bases, "base");
  renderSlots("capSlots", design.caps, "cap");
  renderSlots("letterSlots", design.letters, "letter");
}

function renderSlots(containerId, colours, type) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  colours.forEach((colour, index) => {
    const slot = document.createElement("button");
  slot.className = "colour-slot";

  const isStandardProduct =
    activeProduct.product_key === STANDARD_PRODUCT_KEY;
  const isFixedSolidBase =
    activeProduct.product_key === SOLID_PRODUCT_KEY && type === "base";
  if (!isStandardProduct && !isFixedSolidBase) {
    slot.title = "Click to remove this colour";
    slot.onclick = () => removeColourFromDesign(type, index);
  } else {
    slot.classList.add("is-fixed-colour");
  }
    slot.style.background = colour;
    container.appendChild(slot);
  });

  const summary = document.getElementById(`${type}TabSummary`);
  if (summary) {
    summary.textContent = colours
      .map(colour => getColourName(colour))
      .filter((name, index, list) => list.indexOf(name) === index)
      .join(" + ");
  }
}

function loadSTL(path, options = {}) {
  const preservePosition = options.preservePosition === true;
  const cacheKey = preservePosition ? `${path}::preserved` : path;
  if (geometryCache[cacheKey]) return Promise.resolve(geometryCache[cacheKey].clone());

  return new Promise((resolve, reject) => {
    loader.load(
      path,
      geometry => {
        geometry.computeVertexNormals();
        if (!preservePosition) geometry.center();
        geometryCache[cacheKey] = geometry;
        resolve(geometry.clone());
      },
      undefined,
      reject
    );
  });
}

function splitCapGeometry(geometry) {
  const pos = geometry.attributes.position;
  const triangleCount = pos.count / 3;
  const visited = new Array(triangleCount).fill(false);
  const components = [];

  function getVertexKey(i) {
    return [
      pos.getX(i).toFixed(3),
      pos.getY(i).toFixed(3),
      pos.getZ(i).toFixed(3)
    ].join(",");
  }

  const vertexMap = new Map();

  for (let t = 0; t < triangleCount; t++) {
    for (let j = 0; j < 3; j++) {
      const key = getVertexKey(t * 3 + j);
      if (!vertexMap.has(key)) vertexMap.set(key, []);
      vertexMap.get(key).push(t);
    }
  }

  for (let t = 0; t < triangleCount; t++) {
    if (visited[t]) continue;

    const stack = [t];
    const component = [];
    visited[t] = true;

    while (stack.length > 0) {
      const current = stack.pop();
      component.push(current);

      for (let j = 0; j < 3; j++) {
        const key = getVertexKey(current * 3 + j);
        const neighbours = vertexMap.get(key) || [];

        neighbours.forEach(n => {
          if (!visited[n]) {
            visited[n] = true;
            stack.push(n);
          }
        });
      }
    }

    components.push(component);
  }

  components.sort((a, b) => b.length - a.length);

  const tileTriangles = components[0] || [];
  const letterTriangles = components.slice(1).flat();

  function makeGeometry(triangles) {
    const vertices = [];

    triangles.forEach(t => {
      for (let j = 0; j < 3; j++) {
        const i = t * 3 + j;
        vertices.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      }
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    g.computeVertexNormals();
    return g;
  }

  return {
    tile: makeGeometry(tileTriangles),
    letter: makeGeometry(letterTriangles)
  };
}

function getDesign(item) {
  if (!item.custom) return globalDesign;

  return {
    baseShape:
      item.custom.baseShape ||
      globalDesign.baseShape ||
      "ribbed",

    letterOrientation:
      item.custom.letterOrientation ||
      globalDesign.letterOrientation ||
      "vertical",

    fontSize: getStandardFontSize(item.custom),

    nfcEnabled: Boolean(item.custom.nfcEnabled),
    nfcType: item.custom.nfcType || "guardian",
    nfcPayload: item.custom.nfcPayload || "",
    photo: item.custom.photo || null,
    pencil: normalizePencilDesign(item.custom.pencil || globalDesign.pencil),

    bases:
      item.custom.bases ||
      globalDesign.bases,

    caps:
      item.custom.caps ||
      globalDesign.caps,

    letters:
      item.custom.letters ||
      globalDesign.letters
  };
}

async function createKeycapTop(letter, index, design) {
  const capColour = design.caps[index % design.caps.length];
  const letterColour = design.letters[index % design.letters.length];

  // Load the correct keycap STL
  const special = specialKeycaps[letter];

  const capPath = special
    ? `/models/keycap - ${special}.stl`
    : `/models/keycap-char-${letter}.stl`;

  const capGeo = await loadSTL(capPath);

  const parts = splitCapGeometry(capGeo);

  const tile = new THREE.Mesh(parts.tile, createMat(capColour));
  const raisedLetter = new THREE.Mesh(parts.letter, createMat(letterColour));

  if ((design.letterOrientation || "vertical") === "horizontal") {
    parts.letter.computeBoundingBox();

    if (parts.letter.boundingBox) {
      const letterCentre = new THREE.Vector3();
      parts.letter.boundingBox.getCenter(letterCentre);

      parts.letter.translate(
        -letterCentre.x,
        -letterCentre.y,
        0
      );

      raisedLetter.position.set(
        letterCentre.x,
        letterCentre.y,
        0
      );
      raisedLetter.rotation.z = Math.PI / 2;
    }
  }

  const capGroup = new THREE.Group();
  capGroup.add(tile);
  capGroup.add(raisedLetter);

  return capGroup;
}

async function createKeycap(letter, index, design) {
  const group = new THREE.Group();

  const baseColour = design.bases[index % design.bases.length];
  const selectedBaseShape =
    design.baseShape || "ribbed";

  const baseGeo = await loadSTL(
    BASE_SHAPES[selectedBaseShape].file
  );
  const base = new THREE.Mesh(baseGeo, createMat(baseColour));
  base.rotation.z = Math.PI / 2;
  group.add(base);

  const capGroup = await createKeycapTop(letter, index, design);
  capGroup.position.set(4.2, 0, 11);
  group.add(capGroup);

  group.position.x = index * 28;

  return group;
}

const previewFontLoader = new FontLoader();

let standardPreviewFont = null;
let standardPreviewFontPromise = null;

function getStandardPreviewFont() {
  if (standardPreviewFont) {
    return Promise.resolve(standardPreviewFont);
  }

  if (!standardPreviewFontPromise) {
    standardPreviewFontPromise = new Promise((resolve, reject) => {
      previewFontLoader.load(
        "/fonts/fredoka_bold.typeface.json",
        font => {
          standardPreviewFont = font;
          resolve(font);
        },
        undefined,
        error => {
          console.error(
            "Unable to load standard preview font:",
            error
          );

          standardPreviewFontPromise = null;
          reject(error);
        }
      );
    });
  }

  return standardPreviewFontPromise;
}

const STANDARD_FONT_SIZES = [18, 24, 30];

function getStandardFontSize(design = {}) {
  const requested = Number(design.fontSize || design.font_size || 24);
  return STANDARD_FONT_SIZES.includes(requested) ? requested : 24;
}

let previewBuildNumber = 0;

function disposePreviewObject(object) {
  object.traverse(child => {
    if (child.geometry) {
      child.geometry.dispose();
    }

    if (child.material) {
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach(material => {
        material.map?.dispose();
        material.dispose();
      });
    }
  });
}

function clearKeychainPreview() {
  while (keychain.children.length) {
    const child = keychain.children.pop();
    disposePreviewObject(child);
  }
}

function createStandardTextGeometry(
  name,
  font,
  depth,
  {
    fontSize = 24,
    bevelEnabled = false,
    bevelSize = 0,
    bevelThickness = 0
  } = {}
) {
  const geometry = new TextGeometry(name, {
    font,
    size: fontSize,
    depth,
    curveSegments: 16,
    bevelEnabled,
    bevelThickness,
    bevelSize,
    bevelSegments: bevelEnabled ? 4 : 1
  });

  geometry.computeBoundingBox();

  if (geometry.boundingBox) {
    const centre = new THREE.Vector3();

    geometry.boundingBox.getCenter(centre);
    geometry.userData.sourceCentreY = centre.y;

    geometry.translate(
      -centre.x,
      -centre.y,
      -centre.z
    );
  }

  return geometry;
}

function createStandardBackground(
  name,
  font,
  backgroundColour,
  fontSize = 24
) {
  const outlineRadius = 2.5;
  const outlineSteps = 32;
  const offsets = [[0, 0]];
  const contours = font
    .generateShapes(name, fontSize)
    .map(shape => shape.getPoints(20))
    .filter(points => points.length >= 3);

  for (let index = 0; index < outlineSteps; index += 1) {
    const angle = (index / outlineSteps) * Math.PI * 2;
    offsets.push([
      Math.cos(angle) * outlineRadius,
      Math.sin(angle) * outlineRadius
    ]);
  }

  const offsetPolygons = [];

  contours.forEach(points => {
    offsets.forEach(([offsetX, offsetY]) => {
      const ring = points.map(point => [
        point.x + offsetX,
        point.y + offsetY
      ]);

      ring.push([...ring[0]]);
      offsetPolygons.push([ring]);
    });
  });

  const mergedPolygons = offsetPolygons.length
    ? polygonClipping.union(...offsetPolygons)
    : [];

  const mergedShapes = mergedPolygons
    .filter(polygon => polygon[0]?.length >= 4)
    .map(polygon => {
      const outerPoints = polygon[0]
        .slice(0, -1)
        .map(([x, y]) => new THREE.Vector2(x, y));
      const shape = new THREE.Shape(outerPoints);

      polygon.slice(1).forEach(holeRing => {
        if (holeRing.length < 4) return;

        const holePoints = holeRing
          .slice(0, -1)
          .map(([x, y]) => new THREE.Vector2(x, y));

        shape.holes.push(new THREE.Path(holePoints));
      });

      return shape;
    });

  const geometry = new THREE.ExtrudeGeometry(
    mergedShapes,
    {
      depth: 3,
      curveSegments: 16,
      bevelEnabled: false
    }
  );

  geometry.computeBoundingBox();

  if (geometry.boundingBox) {
    const centre = new THREE.Vector3();
    geometry.boundingBox.getCenter(centre);
    geometry.translate(-centre.x, -centre.y, -centre.z);
  }

  return new THREE.Mesh(
    geometry,
    createMat(backgroundColour)
  );
}

function addStandardKeyringLoop(
  group,
  textWidth,
  textSourceCentreY,
  backgroundColour,
  fontSize = 24
) {
  const outerRadius = 5;
  const innerRadius = 2.25;
  const depth = 3;
  const loopOverlap = 2.5;
  const loopX =
    -(textWidth / 2) - outerRadius + loopOverlap;
  const loopY =
    fontSize * 0.38 - textSourceCentreY;
  const ringShape = new THREE.Shape();

  ringShape.absarc(
    0,
    0,
    outerRadius,
    0,
    Math.PI * 2,
    false
  );

  const hole = new THREE.Path();

  hole.absarc(
    0,
    0,
    innerRadius,
    0,
    Math.PI * 2,
    true
  );

  ringShape.holes.push(hole);

  const ringGeometry = new THREE.ExtrudeGeometry(
    ringShape,
    {
      depth,
      bevelEnabled: false,
      curveSegments: 48
    }
  );

  ringGeometry.translate(0, 0, -depth / 2);

  const loop = new THREE.Mesh(
    ringGeometry,
    createMat(backgroundColour)
  );

  loop.position.set(loopX, loopY, 0);

  group.add(loop);

  const bridge = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 2, depth, 48),
    createMat(backgroundColour)
  );

  bridge.rotation.x = Math.PI / 2;

  bridge.position.set(
    loopX + outerRadius,
    loopY,
    0
  );

  group.add(bridge);
}
async function buildStandardKeychain(name, design) {
  const thisBuildNumber = ++previewBuildNumber;

  previewLoading?.classList.remove("hidden");
  clearKeychainPreview();

  try {
    const cleanName =
      String(name || "Alicia")
        .trim()
        .replace(/[^a-z0-9 ]/gi, "") ||
      "Alicia";

    const font = await getStandardPreviewFont();

    const backgroundColour =
      design.bases?.[0] || "#F55A74";

    const nameColour =
      design.letters?.[0] || "#FFFFFF";
    const fontSize = getStandardFontSize(design);

    const textGeometryForWidth =
      createStandardTextGeometry(cleanName, font, 1.2, { fontSize });

    textGeometryForWidth.computeBoundingBox();

    const textWidth =
      textGeometryForWidth.boundingBox
        ? textGeometryForWidth.boundingBox.max.x -
          textGeometryForWidth.boundingBox.min.x
        : cleanName.length * fontSize * 0.6;

    const textSourceCentreY = Number(
      textGeometryForWidth.userData.sourceCentreY || 0
    );

    textGeometryForWidth.dispose();

    const backgroundGroup = createStandardBackground(
      cleanName,
      font,
      backgroundColour,
      fontSize
    );

    const nameGeometry =
      createStandardTextGeometry(cleanName, font, 1.2, { fontSize });

    const nameMesh = new THREE.Mesh(
      nameGeometry,
      createMat(nameColour)
    );

    // The STL has a 3 mm backing and a 1.2 mm raised name.
    // Both geometries are centred, so 2.1 mm places the name
    // directly on the backing's top face (1.5 + 0.6).
    nameMesh.position.z = 2.1;

    const standardGroup = new THREE.Group();

    standardGroup.add(backgroundGroup);
    standardGroup.add(nameMesh);

    addStandardKeyringLoop(
      standardGroup,
      textWidth,
      textSourceCentreY,
      backgroundColour,
      fontSize
    );

    const standardBounds = new THREE.Box3().setFromObject(
      standardGroup
    );
    const standardCentre = new THREE.Vector3();
    const standardSize = new THREE.Vector3();

    standardBounds.getCenter(standardCentre);
    standardBounds.getSize(standardSize);
    standardGroup.position.sub(standardCentre);

    if (thisBuildNumber !== previewBuildNumber) {
      disposePreviewObject(standardGroup);
      return;
    }

    keychain.add(standardGroup);

    keychain.position.set(0, 0, 0);
    keychain.rotation.set(-0.35, 0.15, 0);

    controls.target.set(0, 0, 0);

    const cameraDistance = Math.max(
      90,
      standardSize.x * 1.75
    );

    camera.position.set(
      0,
      10,
      cameraDistance
    );

    controls.update();
  } catch (error) {
    console.error(
      "Unable to build normal keychain preview:",
      error
    );
  } finally {
    if (thisBuildNumber === previewBuildNumber) {
      previewLoading?.classList.add("hidden");
    }
  }
}

async function buildKeychain(name, design) {
  const thisBuildNumber = ++previewBuildNumber;

  previewLoading?.classList.remove("hidden");
  keychain.clear();

  const cleanName = sanitizeName(name || "A");
  const letters = Array.from(cleanName);

  try {
    if (activeProduct.product_key === SOLID_PRODUCT_KEY && letters.length) {
      const slotCount = Math.min(10, Math.max(1, letters.length));
      const baseGeometry = await loadSTL(`/models/solid-base-${slotCount}.stl`);
      baseGeometry.computeBoundingBox();
      const baseSize = new THREE.Vector3();
      baseGeometry.boundingBox?.getSize(baseSize);
      const solidBase = new THREE.Mesh(
        baseGeometry,
        createMat(design.bases[0] || available[0])
      );
      keychain.add(solidBase);

      // The compact base's keyring end makes its overall bounding box slightly
      // asymmetrical. Its switch slots are centred 1.84 mm to the right of the
      // mesh centre, at an exact 20.5 mm pitch.
      const slotCentreOffsetX = 1.84;
      for (let index = 0; index < letters.length; index += 1) {
        const cap = await createKeycapTop(letters[index], index, design);
        cap.position.set(
          slotCentreOffsetX + (index - (letters.length - 1) / 2) * 20.5,
          0,
          11
        );
        if (thisBuildNumber !== previewBuildNumber) return;
        keychain.add(cap);
      }

      keychain.position.set(0, 0, 0);
      // Keep this one-piece design closer to a top view. A steep tilt makes
      // raised caps appear displaced from their slots through perspective.
      keychain.rotation.set(-0.32, 0.08, 0);
      controls.target.set(0, 0, 0);
      camera.fov = 35;
      camera.position.set(0, 0, Math.max(145, baseSize.x * 1.08));
      camera.updateProjectionMatrix();
      controls.update();
      return;
    }

    for (let i = 0; i < letters.length; i++) {
      try {
        const item = await createKeycap(letters[i], i, design);

        if (thisBuildNumber !== previewBuildNumber) return;
        keychain.add(item);
      } catch (err) {
        console.warn(`Missing STL for ${letters[i]}`, err);
      }
    }

    if (thisBuildNumber !== previewBuildNumber) return;

    keychain.position.x = -((letters.length - 1) * 28) / 2;
    keychain.rotation.x = -0.8;
    keychain.rotation.y = 0.2;

    controls.target.set(0, 0, 0);
    controls.update();
  } finally {
    if (thisBuildNumber === previewBuildNumber) {
      previewLoading?.classList.add("hidden");
    }
  }
}

function updateNames() {
  enforceNameInputLimits();
  const previousNames = [...names];
  const activeKey = activeProduct.product_key;
  const activePreviousNames = previousNames.filter(
    item => (item.product_key || activeKey) === activeKey
  );
  const otherProductNames = previousNames.filter(
    item => (item.product_key || activeKey) !== activeKey
  );

  const copyItemDesign = previousItem => previousItem?.custom
    ? cloneCustomDesign(previousItem.custom)
    : null;

  if (orderType === "single") {
    const value = singleName.value.trim() || "Alicia";
    const selectedItem = previousNames[selectedIndex];
    const previousItem = (selectedItem?.product_key || activeKey) === activeKey
      ? selectedItem
      : activePreviousNames[0];
    const nextItem = {
      name: value,
      quantity: normalizeItemQuantity(singleQuantity?.value || previousItem?.quantity),
      product_key: activeKey,
      cartAdded: previousItem?.cartAdded ?? (cartHasItems ? false : undefined),
      groupContributorName: previousItem?.groupContributorName || null,
      custom: copyItemDesign(previousItem)
    };
    const preservedActiveItems = activePreviousNames.filter(
      item => item !== previousItem && item.cartAdded !== false
    );
    names = [...otherProductNames, ...preservedActiveItems, nextItem];
    selectedIndex = names.length - 1;
  } else {
    const parsedNames = parseDesignBatchNames(nameList.value);

    const activeNames = parsedNames.map((entry, index) => {
      // First try matching the exact existing name.
      const exactMatch = activePreviousNames.find(
        item => item.name === entry.name &&
          (item.designBatchId || "batch-1") === entry.designBatchId
      );

      // If the name changed because an icon was added,
      // preserve the design from the same line/index.
      const previousItem =
        exactMatch || activePreviousNames[index];

      return {
        name: entry.name,
        quantity: getItemQuantity(previousItem),
        product_key: activeKey,
        cartAdded: previousItem?.cartAdded ?? (cartHasItems ? false : undefined),
        groupContributorName: previousItem?.groupContributorName || null,
        designBatchId: entry.designBatchId,
        designBatchNumber: entry.designBatchNumber,
        custom: copyItemDesign(previousItem)
      };
    });
    names = [...otherProductNames, ...activeNames];
    linkSharedBatchDesigns();
    selectedIndex = otherProductNames.length + Math.min(
      Math.max(0, selectedIndex),
      Math.max(0, activeNames.length - 1)
    );
  }

  if (selectedIndex >= names.length) {
    selectedIndex = Math.max(0, names.length - 1);
  }

  const activeNameCount = names.filter(item => item.product_key === activeKey).length;
  const activeBatchCount = getActiveProductBatchGroups().length;
  nameCount.textContent = `${activeNameCount} name${activeNameCount === 1 ? "" : "s"}${
    activeBatchCount > 1 ? ` · ${activeBatchCount} design batches` : ""
  }`;

  const isGroupOrder = orderType === "group";

  applyAllSection.classList.toggle(
    "hidden",
    !isGroupOrder
  );

  nameCardsSection.classList.toggle(
    "hidden",
    !isGroupOrder
  );

  draftHasMeaningfulChanges = true;

  updateDimensionEstimate(names[selectedIndex]?.name || "");
  refreshUI();
  buildSelectedPreview();
}

function updateBaseShapeButtons() {
  const design = getActiveDesign();
  const shape = design.baseShape || "ribbed";

  ribbedBaseBtn.classList.toggle(
    "active",
    shape === "ribbed"
  );

  bubblyBaseBtn.classList.toggle(
    "active",
    shape === "bubbly"
  );
}

function updateLetterOrientationButtons() {
  const orientation =
    getActiveDesign().letterOrientation || "vertical";

  verticalLetterBtn?.classList.toggle(
    "active",
    orientation === "vertical"
  );

  horizontalLetterBtn?.classList.toggle(
    "active",
    orientation === "horizontal"
  );
}

function updateStandardFontSizeButtons() {
  const selectedSize = getStandardFontSize(getActiveDesign());
  document.querySelectorAll("[data-standard-font-size]").forEach(button => {
    const isActive = Number(button.dataset.standardFontSize) === selectedSize;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

let activePencilColourPart = "eraser";

function updatePencilControls() {
  if (activeProduct.product_key !== PENCIL_PRODUCT_KEY) return;
  const design = getActiveDesign();
  design.pencil = normalizePencilDesign(design.pencil);

  document.querySelectorAll("[data-pencil-ending-style]").forEach(button => {
    const active = button.dataset.pencilEndingStyle === design.pencil.endingStyle;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  document.querySelectorAll("[data-pencil-ending-group]").forEach(element => {
    element.hidden = element.dataset.pencilEndingGroup !== design.pencil.endingStyle;
  });

  const availableParts = design.pencil.endingStyle === "endCap"
    ? ["endCap", "wood", "tip"]
    : ["eraser", "ferrule", "wood", "tip"];
  if (!availableParts.includes(activePencilColourPart)) {
    activePencilColourPart = availableParts[0];
  }

  document.querySelectorAll("[data-pencil-part-tab]").forEach(button => {
    const active = button.dataset.pencilPartTab === activePencilColourPart;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-pencil-part-panel]").forEach(panel => {
    panel.hidden = panel.dataset.pencilPartPanel !== activePencilColourPart;
  });
  document.querySelectorAll("[data-pencil-colour-value]").forEach(button => {
    const part = button.dataset.pencilColour;
    const active = String(button.dataset.pencilColourValue).toLowerCase() === String(design.pencil[part]).toLowerCase();
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function updatePencilChoice(part, value) {
  if (activeProduct.product_key !== PENCIL_PRODUCT_KEY) return;
  const current = normalizePencilDesign(getActiveDesign().pencil);
  current[part] = value;

  if (applyAllToggle.checked) {
    globalDesign.pencil = current;
    names.forEach(item => { item.custom = null; });
  } else {
    getActiveDesign().pencil = current;
  }

  draftHasMeaningfulChanges = true;
  refreshUI();
  buildSelectedPreview();
  saveDraft();
}

document.getElementById("pencilClickerOptions")?.addEventListener("click", event => {
  const endingButton = event.target.closest("[data-pencil-ending-style]");
  if (endingButton) {
    updatePencilChoice("endingStyle", endingButton.dataset.pencilEndingStyle);
    return;
  }
  const partTab = event.target.closest("[data-pencil-part-tab]");
  if (partTab) {
    activePencilColourPart = partTab.dataset.pencilPartTab;
    updatePencilControls();
    return;
  }
  const colourButton = event.target.closest("[data-pencil-colour-value]");
  if (colourButton) {
    updatePencilChoice(colourButton.dataset.pencilColour, colourButton.dataset.pencilColourValue);
  }
});

function setStandardFontSize(size) {
  const normalized = Number(size);
  if (!STANDARD_FONT_SIZES.includes(normalized)) return;

  if (applyAllToggle.checked) {
    globalDesign.fontSize = normalized;
    names.forEach(item => { item.custom = null; });
  } else {
    getActiveDesign().fontSize = normalized;
  }

  draftHasMeaningfulChanges = true;
  refreshUI();
  buildSelectedPreview();
  saveDraft();
}

document.querySelectorAll("[data-standard-font-size]").forEach(button => {
  button.addEventListener("click", () => setStandardFontSize(button.dataset.standardFontSize));
});

function setLetterOrientation(orientation) {
  if (!["vertical", "horizontal"].includes(orientation)) return;

  if (applyAllToggle.checked) {
    globalDesign.letterOrientation = orientation;

    names.forEach(item => {
      item.custom = null;
    });
  } else {
    const design = getActiveDesign();
    design.letterOrientation = orientation;
  }

  draftHasMeaningfulChanges = true;
  refreshUI();
  buildSelectedPreview();
  saveDraft();
}

function setBaseShape(shape) {
  if (!BASE_SHAPES[shape]) {
    console.error("Unknown base shape:", shape);
    return;
  }

  if (applyAllToggle.checked) {
    globalDesign.baseShape = shape;

    names.forEach(item => {
      item.custom = null;
    });
  } else {
    const item = names[selectedIndex];

    if (!item) return;

    if (!item.custom) {
      item.custom = {
        baseShape: globalDesign.baseShape || "ribbed",
        letterOrientation: globalDesign.letterOrientation || "vertical",
        fontSize: getStandardFontSize(globalDesign),
        nfcEnabled: Boolean(globalDesign.nfcEnabled),
        nfcType: globalDesign.nfcType || "guardian",
        nfcPayload: globalDesign.nfcPayload || "",
        pencil: normalizePencilDesign(globalDesign.pencil),
        bases: [...globalDesign.bases],
        caps: [...globalDesign.caps],
        letters: [...globalDesign.letters]
      };
    }

    item.custom.baseShape = shape;
  }

  refreshUI();
  buildSelectedPreview();
}

ribbedBaseBtn.onclick = () => {
  setBaseShape("ribbed");
};

bubblyBaseBtn.onclick = () => {
  setBaseShape("bubbly");
};

verticalLetterBtn.onclick = () => {
  setLetterOrientation("vertical");
};

horizontalLetterBtn.onclick = () => {
  setLetterOrientation("horizontal");
};

function createMiniPreview(name, design, product = activeProduct) {
  if (isReadyMadeProduct(product)) {
    return `<div class="mini-ready-made"><img src="${escapePresetText(design.readyMade?.imagePath || product.image_path || "")}" alt="${escapePresetText(product.name)}"></div>`;
  }
  if (product.product_key === PHOTO_PRODUCT_KEY && design.photo?.artworkUrl) {
    return `<div class="mini-photo-keepsake"><img src="${escapePresetText(design.photo.artworkUrl)}" alt="${escapePresetText(name)} artwork"></div>`;
  }

  if (product.product_key === STANDARD_PRODUCT_KEY) {
    const backgroundColour = design.bases?.[0] || "#F55A74";
    const nameColour = design.letters?.[0] || "#FFFFFF";
    const cleanName = String(name || "Name").trim() || "Name";

    return `
      <div
        class="mini-standard-keychain"
        style="--mini-background:${backgroundColour}; --mini-name:${nameColour}"
        aria-label="${escapePresetText(cleanName)} name keychain preview"
      >
        <span class="mini-standard-loop" aria-hidden="true"></span>
        <span class="mini-standard-bridge" aria-hidden="true"></span>
        <span class="mini-standard-name">
          ${escapePresetText(cleanName)}
        </span>
      </div>
    `;
  }

  if (product.product_key === PENCIL_PRODUCT_KEY) {
    const pencil = normalizePencilDesign(design.pencil);
    const blocks = Array.from(sanitizeName(name || "A"))
      .map((character, index) => `
        <b style="--pencil-block:${design.bases[index % design.bases.length]}; --pencil-top:${design.caps[index % design.caps.length]}; --pencil-character:${design.letters[index % design.letters.length]}">
          <em>${displayIcon(character)}</em>
        </b>
      `)
      .join("");
    return `
      <div class="mini-pencil-preview" style="--pencil-eraser:${pencil.eraser}; --pencil-ferrule:${pencil.ferrule}; --pencil-wood:${pencil.wood}; --pencil-tip:${pencil.tip};">
        <span></span>${blocks}<i class="${pencil.endingStyle === "endCap" ? "is-end-cap" : ""}" style="--pencil-end-cap:${pencil.endCap}"></i>
      </div>
    `;
  }

  return Array.from(sanitizeName(name))
    .map((letter, i) => {
      const base = design.bases[i % design.bases.length];
      const cap = design.caps[i % design.caps.length];
      const letterColour = design.letters[i % design.letters.length];

      return `
        <div class="mini-block" style="background:${base}">
          <div class="mini-cap" style="background:${cap}; color:${letterColour}">
            <span class="mini-character ${design.letterOrientation === "horizontal" ? "is-sideways" : ""}">
              ${displayIcon(letter)}
            </span>
          </div>
        </div>
      `;
    })
    .join("");
}

function getDesignDescription(design, product = activeProduct) {
  if (isReadyMadeProduct(product)) {
    const selections = Object.entries(design.readyMade?.selections || {});
    return selections.length
      ? selections.map(([name, value]) => `${escapePresetText(name)}: ${escapePresetText(value)}`).join(" · ")
      : "Ready-made design";
  }
  if (product.product_key === PHOTO_PRODUCT_KEY) {
    return design.photo?.variant === "clicker"
      ? "AI simplified artwork · Clicker keychain"
      : "AI simplified artwork · Classic keychain";
  }

  if (product.product_key === STANDARD_PRODUCT_KEY) {
    return "Flat background · Raised name";
  }

  if (product.product_key === PENCIL_PRODUCT_KEY) {
    return "Raised characters · One clicker block per character";
  }

  return `${
    design.baseShape === "bubbly" ? "Bubbly Base" : "Ribbed Base"
  } · ${
    design.letterOrientation === "horizontal"
      ? "Sideways letters"
      : "Upright letters"
  }`;
}

function getDesignColourSummary(design, product = activeProduct) {
  if (isReadyMadeProduct(product)) {
    return product.stock_quantity > 0 ? "Made in small batches" : "Made to order";
  }
  if (product.product_key === PHOTO_PRODUCT_KEY) {
    return `Up to ${Number(design.photo?.colourCount || 4)} stocked filament colours · final printability check included`;
  }
  const uniqueNames = values => Array.from(new Set((values || []).map(getColourName))).join(", ");
  if (product.product_key === STANDARD_PRODUCT_KEY) {
    return `Background: ${uniqueNames(design.bases)} · Name: ${uniqueNames(design.letters)}`;
  }
  if (product.product_key === PENCIL_PRODUCT_KEY) {
    const pencil = normalizePencilDesign(design.pencil);
    const ending = pencil.endingStyle === "endCap"
      ? `End cap: ${getColourName(pencil.endCap)}`
      : `Eraser: ${getColourName(pencil.eraser)} · Band: ${getColourName(pencil.ferrule)}`;
    return `Blocks: ${uniqueNames(design.bases)} · Tops: ${uniqueNames(design.caps)} · Characters: ${uniqueNames(design.letters)} · ${ending} · Wood: ${getColourName(pencil.wood)} · Tip: ${getColourName(pencil.tip)}`;
  }
  return `Bases: ${uniqueNames(design.bases)} · Caps: ${uniqueNames(design.caps)} · Letters: ${uniqueNames(design.letters)}`;
}

function renderNameCards() {
  nameCards.innerHTML = "";

  const batches = getActiveProductBatchGroups();
  const useBatchCards = orderType === "group" && batches.length > 1;
  nameCards.classList.toggle("is-batch-list", useBatchCards);
  if (designSelectionHeading) {
    designSelectionHeading.textContent = useBatchCards
      ? "Choose a Design Batch to Edit"
      : "Choose a Keychain to Edit";
  }

  if (useBatchCards) {
    batches.forEach(batch => {
      const representative = batch.entries[0];
      const product = getItemProduct(representative.item);
      const design = getDesign(representative.item);
      const batchTotal = batch.entries.reduce(
        (total, { item }) => total + calculatePrice(design, item.name, product) * getItemQuantity(item),
        0
      );
      const card = document.createElement("button");
      card.type = "button";
      card.className = "student-card design-batch-card";
      if (batch.entries.some(({ index }) => index === selectedIndex)) card.classList.add("active");
      const shownNames = batch.entries.slice(0, 8).map(({ item }) => item.name);
      const remaining = batch.entries.length - shownNames.length;

      card.innerHTML = `
        <div class="name-card-top">
          <span><small>Design batch ${batch.number}</small><strong>${batch.entries.length} names</strong></span>
          <span class="price-tag">$${batchTotal.toFixed(2)}</span>
        </div>
        <p class="batch-name-list">${shownNames.map(escapePresetText).join(" · ")}${remaining > 0 ? ` · +${remaining} more` : ""}</p>
        <p class="batch-shared-note">Edit once — this design applies to every name in this batch.</p>
        <div class="mini-chain">${createMiniPreview(representative.item.name, design, product)}</div>
      `;
      card.onclick = () => {
        selectedIndex = representative.index;
        applyAllToggle.checked = false;
        refreshUI();
        buildSelectedPreview();
      };
      nameCards.appendChild(card);
    });
    return;
  }

  names.forEach((item, index) => {
    const product = getItemProduct(item);
    if (product.product_key !== activeProduct.product_key) return;
    const card = document.createElement("button");
    card.className = "student-card";

    if (index === selectedIndex) card.classList.add("active");

    const design = getDesign(item);
    const price = calculatePrice(design, item.name, product);

    card.innerHTML = `
      <div class="name-card-top">
        <strong>${item.name}</strong>
        <span class="price-tag">$${price.toFixed(2)}</span>
      </div>

      <p class="hint">${getDesignDescription(design, product)}</p>

      <div class="mini-chain">
        ${createMiniPreview(item.name, design, product)}
      </div>
    `;

    card.onclick = () => {
      selectedIndex = index;
      refreshUI();
      buildSelectedPreview();
    };

    nameCards.appendChild(card);
  });
}

function updateDimensionEstimate(name) {
  if (dimensionEstimate) {
    const selectedName = name || "";
    const size = getApproximateKeychainSize(
      selectedName,
      activeProduct.product_key,
      getActiveDesign()
    );

    if (!size.characterCount) {
      dimensionEstimate.innerHTML = `
        <div class="dimension-estimate-heading"><span>📏 Estimated finished size</span></div>
        <p>Enter a name to see its approximate length, breadth and height.</p>
      `;
      dimensionEstimate.classList.remove("is-long-name");
      return;
    }

    const isLongName = size.characterCount >= 8;
    dimensionEstimate.classList.toggle("is-long-name", isLongName);
    dimensionEstimate.innerHTML = `
      <div class="dimension-estimate-heading">
        <span>📏 Estimated finished size</span>
        <strong>${escapePresetText(selectedName)}</strong>
      </div>
      <div class="dimension-estimate-grid">
        <span><small>Length</small><b>${size.lengthCm.toFixed(1)} cm</b></span>
        <span><small>Breadth</small><b>${size.heightCm.toFixed(1)} cm</b></span>
        <span><small>Height</small><b>${size.thicknessCm.toFixed(1)} cm</b></span>
      </div>
      ${isLongName ? `<p class="dimension-long-name-warning">Long name — please check the finished length before adding it to your cart.</p>` : ""}
      <p>Approximate measurement; slight variation may occur after assembly.</p>
    `;
  }
}

function updateEditModeText() {
  const selectedItem = names[selectedIndex];
  const batches = getActiveProductBatchGroups();
  const selectedBatch = batches.find(batch =>
    batch.entries.some(({ index }) => index === selectedIndex)
  );

  updateDimensionEstimate(selectedItem?.name || "");

  if (
    orderType === "group" &&
    applyAllToggle.checked
  ) {
    editModeText.textContent =
      "Currently editing: all keychains";

    resetSelected.style.display = "none";
    return;
  }

  if (orderType === "group" && batches.length > 1 && selectedBatch) {
    editModeText.textContent =
      `Editing Batch ${selectedBatch.number} · changes apply to all ${selectedBatch.entries.length} names`;
    resetSelected.style.display = "block";
    resetSelected.textContent = `Reset Batch ${selectedBatch.number}`;
    return;
  }

  editModeText.textContent = selectedItem
    ? `Currently editing: ${selectedItem.name}`
    : "Currently editing: selected keychain";

  resetSelected.style.display =
    orderType === "group"
      ? "block"
      : "none";
  resetSelected.textContent = "Reset Selected";
}

function updatePreviewColourLegend() {
  if (!previewColourLegend) return;

  const selectedItem = names[selectedIndex];
  const design = selectedItem ? getDesign(selectedItem) : globalDesign;
const parts =
  activeProduct.product_key === PENCIL_PRODUCT_KEY
    ? (() => {
        const pencil = normalizePencilDesign(design.pencil);
        return [
          { label: "Pencil blocks", colours: design.bases || [] },
          { label: "Clicker tops", colours: design.caps || [] },
          { label: "Characters", colours: design.letters || [] },
          ...(pencil.endingStyle === "endCap"
            ? [{ label: "End cap", colours: [pencil.endCap] }]
            : [
                { label: "Eraser", colours: [pencil.eraser] },
                { label: "Metal band", colours: [pencil.ferrule] }
              ]),
          { label: "Wood", colours: [pencil.wood] },
          { label: "Tip", colours: [pencil.tip] }
        ];
      })()
    : activeProduct.product_key === STANDARD_PRODUCT_KEY
    ? [
        {
          label: "Background",
          colours: design.bases?.slice(0, 1) || []
        },
        {
          label: "Name",
          colours: design.letters?.slice(0, 1) || []
        }
      ]
    : [
        {
          label: "Base strip",
          colours: design.bases || []
        },
        {
          label: "Top caps",
          colours: design.caps || []
        },
        {
          label: "Raised letters",
          colours: design.letters || []
        }
      ];

  previewColourLegend.innerHTML = parts.map(part => {
    const uniqueColours = part.colours.filter(
      (colour, index, list) => list.indexOf(colour) === index
    );
    return `
      <div>
        <strong>${part.label}</strong>
        <span>
          ${uniqueColours.map(colour => `
            <i style="background:${colour}"></i>${getColourName(colour)} · ${getColourMaterial(colour)}
          `).join(" · ")}
        </span>
      </div>
    `;
  }).join("");
}

function autoSave(){

    saveDraft();

}

setInterval(autoSave,3000);

function renderReviewOrder() {
  let total = 0;
  const totalKeychains = getTotalKeychainQuantity();

  reviewCount.innerText = totalKeychains;
  reviewList.innerHTML = "";

  getCartEntries().forEach(({ item, index }) => {
    const design = getDesign(item);
    const product = getItemProduct(item);
    const unitPrice = calculatePrice(design, item.name, product);
    const priceBreakdown = getUnitPriceBreakdown(design, item.name, product);
    const itemQuantity = getItemQuantity(item);
    const price = roundMoney(unitPrice * itemQuantity);

    total += price;

    const row = document.createElement("div");
    row.className = "review-item";

    row.innerHTML = `
      <div class="review-item-heading">
        <div>
          <strong>${item.name}${itemQuantity > 1 ? ` × ${itemQuantity}` : ""}</strong>

          <p class="hint"><strong>${escapePresetText(product.name)}</strong> · ${getDesignDescription(design, product)}</p>

          <p class="review-colour-summary">${getDesignColourSummary(design, product)}</p>

          ${isReadyMadeProduct(product) ? "" : `<p class="item-dimension-note">📏 ${getApproximateSizeText(item.name, product, design)}</p>`}
        </div>

        <div class="review-line-price">
          <strong>S$${price.toFixed(2)}</strong>
          <small>
            ${itemQuantity > 1
              ? `Total · S$${unitPrice.toFixed(2)} each`
              : "Total"
            }
          </small>
        </div>
      </div>

      <div class="mini-chain">
        ${createMiniPreview(item.name, design, product)}
      </div>

      <div class="review-price-breakdown">
        <strong>Price per keychain</strong>
        ${priceBreakdown.rows.map(part => `
          <div${part.addOn ? ' class="is-add-on"' : ""}>
            <span>${part.label}</span>
            <b>${part.addOn ? "+" : ""}S$${part.amount.toFixed(2)}</b>
          </div>
        `).join("")}
        <div class="review-unit-total">
          <span>Price per keychain</span>
          <b>S$${priceBreakdown.unitTotal.toFixed(2)}</b>
        </div>
        ${itemQuantity > 1 ? `
          <div class="review-quantity-total">
            <span>${itemQuantity} keychains × S$${priceBreakdown.unitTotal.toFixed(2)}</span>
            <b>S$${price.toFixed(2)}</b>
          </div>
        ` : ""}
      </div>

      <div class="review-item-actions">
        <button
          type="button"
          class="review-edit-btn"
          data-review-edit="${index}"
        >
          Edit
        </button>

        <button
          type="button"
          class="review-remove-btn"
          data-review-remove="${index}"
        >
          Remove
        </button>
      </div>
    `;

    reviewList.appendChild(row);
  });

  reviewList
    .querySelectorAll("[data-review-edit]")
    .forEach(button => {
      button.addEventListener("click", () => {
        selectedIndex = Number(button.dataset.reviewEdit);
        const selectedItem = names[selectedIndex];
        if (!selectedItem) return;
        activeProduct = getItemProduct(selectedItem);

        if (activeProduct.product_key === PHOTO_PRODUCT_KEY) {
          const item = selectedItem;
          const design = getDesign(item);
          photoKeepsakeLabel.value = item?.name || "";
          photoColourCount.value = String(design.photo?.colourCount || 4);
          photoSubjectType.value = design.photo?.subjectType || "person";
          photoKeepsakeQuantity.value = String(getItemQuantity(item));
          Object.assign(photoKeepsakeState, {
            originalPath: design.photo?.originalPath || "",
            artworkPath: design.photo?.artworkPath || "",
            artworkUrl: design.photo?.artworkUrl || "",
            generationId: design.photo?.generationId || "",
            filamentPalette: normalizePhotoFilamentPalette(
              design.photo?.filamentPalette || design.photo?.filament_palette
            )
          });
          if (design.photo?.artworkUrl) {
            photoArtworkResult.src = design.photo.artworkUrl;
            photoArtworkResult.classList.remove("hidden");
            photoResultPlaceholder.classList.add("hidden");
            photoResultActions.classList.remove("hidden");
            renderPhotoMappedPalette();
          }
          openPhotoKeepsakeStudio();
          return;
        }

        orderType = "single";
        singleName.value = selectedItem.name;
        singleQuantity.value = String(getItemQuantity(selectedItem));
        updateProductCustomiser();
        refreshUI();
        buildSelectedPreview();
        setStorefrontView("design", {
          scrollTo: "designArea"
        });
      });
    });

  reviewList
    .querySelectorAll("[data-review-remove]")
    .forEach(button => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.reviewRemove);
        const item = names[index];

        if (!item) return;

        const confirmed = confirm(
          `Remove ${item.name} from your order?`
        );

        if (!confirmed) return;

        names.splice(index, 1);

        if (orderType === "group") {
          nameList.value = formatActiveProductNames();
        } else if (!names.length) {
          singleName.value = "";
        }

        if (selectedIndex >= names.length) {
          selectedIndex = Math.max(0, names.length - 1);
        }

        if (!names.some(entry => entry.cartAdded !== false)) {
          cartHasItems = false;
        }

        draftHasMeaningfulChanges = true;

        refreshUI();
        buildSelectedPreview();
        validateForm();
      });
    });

  const keychainTotal = roundMoney(total);
  const giftingBagTotal = calculateGiftingBagTotal(
    giftingBagQuantity,
    GIFTING_BAG_PRICE
  );
  total = roundMoney(keychainTotal + giftingBagTotal);

  if (giftingBagQuantity > 0) {
    reviewList.insertAdjacentHTML("beforeend", `
      <div class="review-item gifting-bag-review-item">
        <div class="review-item-heading">
          <div>
            <strong>🎁 Gifting bag × ${giftingBagQuantity}</strong>
            <p class="hint">Fits 2 keychains up to 6 characters each; longer names will protrude</p>
          </div>
          <span class="price-tag">+$${giftingBagTotal.toFixed(2)}</span>
        </div>
      </div>
    `);
  }

  const deliveryFee =
    collectionMethod.value === "delivery" &&
    !hasVerifiedLinkedOrder() &&
    total < freeDeliveryThreshold
      ? deliveryFeeSetting
      : 0;

  let promo = getAppliedPromo();
  if (promo) {
    const eligibility = getPromoEligibility(promo, total);
    if (!eligibility.allowed) {
      appliedPromoCode = "";
      showPromoStatus(eligibility.message, "error");
      promo = null;
    }
  }
  const discountAmount = getPromoDiscount(total);
  const discountedSubtotal = roundMoney(total - discountAmount);
  const rushFee = getRushFee();
  const grandTotal = roundMoney(discountedSubtotal + deliveryFee + rushFee);

  if (checkoutStickyCount) {
    checkoutStickyCount.textContent =
      `${totalKeychains} keychain${totalKeychains === 1 ? "" : "s"}`;
  }

  if (checkoutStickyTotal) {
    checkoutStickyTotal.textContent = `$${grandTotal.toFixed(2)}`;
  }

  reviewPrice.innerHTML = `
    <span>Keychains</span>
    <strong>$${keychainTotal.toFixed(2)}</strong>

    ${giftingBagQuantity > 0 ? `
      <span>Gifting bags (${giftingBagQuantity})</span>
      <strong>+$${giftingBagTotal.toFixed(2)}</strong>
    ` : ""}

    <span>Subtotal</span>
    <strong>$${total.toFixed(2)}</strong>

    ${
      promo && discountAmount > 0
        ? `
          <span>Promo ${appliedPromoCode} (${getPromoOfferLabel(promo)})</span>
          <strong style="color:#278154;">−$${discountAmount.toFixed(2)}</strong>

          <span>Discounted subtotal</span>
          <strong>$${discountedSubtotal.toFixed(2)}</strong>
        `
        : ""
    }

    <span>Delivery</span>
    <strong>
      ${
        deliveryFee === 0 &&
        collectionMethod.value === "delivery"
          ? "FREE"
          : `$${deliveryFee.toFixed(2)}`
      }
    </strong>

    ${rushFee > 0 ? `
      <span>Rush fee</span>
      <strong>+$${rushFee.toFixed(2)}</strong>
    ` : ""}

    <span class="review-total-label">Total</span>
    <strong class="review-grand-total">
      $${grandTotal.toFixed(2)}
    </strong>
  `;

  const deliveryOption =
    collectionMethod.querySelector(
      'option[value="delivery"]'
    );

  if (total >= freeDeliveryThreshold) {
    deliveryOption.text =
      "🚚 Islandwide Delivery (FREE)";
  } else {
    deliveryOption.text =
      `🚚 Islandwide Delivery (+${displaySettingMoney(deliveryFeeSetting)})`;
  }

  updateCollectionNote();
}

function getColourDetails(hex) {
  return colours.find(
    colour => colour.colour.toLowerCase() === String(hex || "").toLowerCase()
  );
}

function getColourName(hex) {
  return getColourDetails(hex)?.name || hex;
}

function getColourMaterial(hex) {
  return getColourDetails(hex)?.materialType || "BASIC";
}

async function saveOrderToDatabase(order) {
    let { data, error } = await supabase
      .from("orders")
      .insert([order]);

    const idempotencySchemaUnavailable =
      error && (
        error.code === "PGRST204" ||
        error.code === "42703" ||
        String(error.message || "").includes("client_submission_id")
      );

    if (idempotencySchemaUnavailable) {
      const { client_submission_id: _unused, ...legacyOrder } = order;
      ({ data, error } = await supabase
        .from("orders")
        .insert([legacyOrder]));
    }

    if (error?.code === "23505") {
      const { data: existingData, error: lookupError } = await supabase.rpc(
        "lookup_order_status",
        {
          p_order_ref: order.order_ref,
          p_email: order.customer_email
        }
      );
      const existingOrder = Array.isArray(existingData) ? existingData[0] : existingData;
      if (!lookupError && existingOrder) {
        return { data: existingOrder, alreadySaved: true };
      }
    }

    if (error) {
      console.error(error);
      throw error;
    }

    return { data, alreadySaved: false };

}

async function updatePendingOrderInDatabase(order) {
  const { order_ref: _orderRef, client_submission_id: _submissionId, ...changes } = order;
  const { data, error } = await supabase
    .from("orders")
    .update(changes)
    .eq("order_ref", order.order_ref)
    .eq("client_submission_id", order.client_submission_id)
    .eq("status", "Pending Payment")
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("This order can no longer be edited.");
  return data;
}

async function submitOrder() {
  if (isProductPreview) {
    alert("This is a private product preview. Real checkout is disabled.");
    return;
  }
  if (orderSubmissionInProgress || (orderSubmitted && !editingPendingOrder)) return;
  orderSubmissionInProgress = true;
  const previousSubmitLabel = submitOrderBtn.textContent;
  submitOrderBtn.disabled = true;
  submitOrderBtn.classList.add("disabled");
  submitOrderBtn.textContent = "Submitting once…";

  try {
    await submitOrderOnce();
  } finally {
    orderSubmissionInProgress = false;
    if (!orderSubmitted) {
      submitOrderBtn.textContent = previousSubmitLabel;
      validateForm();
    }
  }
}

async function submitOrderOnce() {
  submitStatus.innerText = "Submitting order...";

  if (linkExistingOrderToggle.checked && !hasVerifiedLinkedOrder()) {
    submitStatus.innerText = "Please verify the original order ID before continuing.";
    return;
  }

  const checkoutItems = getCartItems();
  const unavailableSelections = checkoutItems.reduce((allNames, item) => {
    getUnavailableDesignColours(getDesign(item)).forEach(name => {
      if (!allNames.includes(name)) allNames.push(name);
    });
    return allNames;
  }, []);

  if (unavailableSelections.length) {
    submitStatus.innerText =
      `${unavailableSelections.join(", ")} ${
        unavailableSelections.length === 1 ? "is" : "are"
      } currently out of stock. Please update the affected keychain colours before ordering.`;
    return;
  }

  if (giftingBagQuantity > 0) {
    submitStatus.innerText = "Checking gifting bag stock…";
    await refreshGiftingBagStock();

    if (
      !giftingBagStockConfirmed ||
      giftingBagQuantity > getMaxGiftingBagQuantity()
    ) {
      submitStatus.innerText = giftingBagStockConfirmed
        ? `Only ${giftingBagStock} gifting bag${giftingBagStock === 1 ? " is" : "s are"} currently available. Please update the quantity.`
        : "Gifting bag stock cannot be confirmed right now. Please remove the bag add-on or try again shortly.";
      return;
    }
  }

  const orderRef = currentSubmissionOrderRef || generateOrderRef();
  currentSubmissionOrderRef = orderRef;
  successModal.dataset.orderRef = orderRef;
  const checkoutOrderType = getCheckoutOrderType();

  if (checkoutOrderType === "bulk" && collectionMethod.value !== "delivery") {
    submitStatus.innerText = "Event orders are available by delivery only.";
    collectionMethod.value = "delivery";
    deliveryAddressSection.classList.remove("hidden");
    refreshUI();
    return;
  }

  const turnaround = getTurnaroundInfo();
  const estimatedReadyFrom = alignToProductionDay(
    addWorkingDays(new Date(), turnaround.minDays)
  );
  const estimatedReadyTo = alignToProductionDay(
    addWorkingDays(new Date(), turnaround.maxDays)
  );

  if (["rush", "bulk"].includes(checkoutOrderType) && !requestedCompletionDate.value) {
    submitStatus.innerText = "Please choose a completion date.";
    return;
  }

  let confirmedRushAssessment = null;
  let confirmedBulkAssessment = null;
  if (checkoutOrderType === "rush" && !isManualOrder) {
    submitStatus.innerText = "Rechecking rush availability…";
    confirmedRushAssessment = await checkRushAvailability();

    if (!confirmedRushAssessment || confirmedRushAssessment.status === "unavailable") {
      submitStatus.innerText = "Rush service is unavailable for this date. Please choose another date.";
      return;
    }
  } else if (checkoutOrderType === "bulk" && !isManualOrder) {
    submitStatus.innerText = "Rechecking bulk date…";
    confirmedBulkAssessment = await checkBulkAvailability();

    if (!confirmedBulkAssessment || confirmedBulkAssessment.status !== "available") {
      submitStatus.innerText = "This bulk date is no longer available. Please choose another date.";
      return;
    }
  }

  const rushAutoApproved =
    checkoutOrderType === "rush" &&
    confirmedRushAssessment?.status === "available";
  const isReviewRequest =
    !isManualOrder &&
    checkoutOrderType === "rush" &&
    !rushAutoApproved;

  const productionNeededBy = ["rush", "bulk"].includes(checkoutOrderType)
    ? requestedCompletionDate.value
    : await findAutomaticAvailableDate();
  const selectedPickupDate =
    collectionMethod.value !== "delivery" &&
    !hasVerifiedLinkedOrder()
      ? checkoutPickupDate.value
      : "";
  const assignedNeededBy = getCustomerDueDate(
    productionNeededBy,
    selectedPickupDate
  );

  neededBy.value = assignedNeededBy;

  const originalSubtotal = getOrderSubtotal();

  const discountAmount = getPromoDiscount(originalSubtotal);
  const subtotal = roundMoney(originalSubtotal - discountAmount);

  const delivery =
    collectionMethod.value === "delivery" &&
    !hasVerifiedLinkedOrder() &&
    originalSubtotal < freeDeliveryThreshold
      ? deliveryFeeSetting
      : 0;

  const rushFee = checkoutOrderType === "rush"
    ? Number(confirmedRushAssessment?.fee ?? getRushFee())
    : 0;
  const total = roundMoney(subtotal + delivery + rushFee);

  let expandedItemIndex = 0;
  const orderData = checkoutItems.flatMap(item => {
    const design = getDesign(item);
    const itemProduct = getItemProduct(item);

    return Array.from({ length: getItemQuantity(item) }, () => {
      const includesGiftingBag = expandedItemIndex === 0 && giftingBagQuantity > 0;
      expandedItemIndex += 1;

      return {
        product_key: itemProduct.product_key,
        product_name: itemProduct.name,
        product_type: itemProduct.product_type || "custom",
        name: item.name,
        clean_name: sanitizeName(item.name),
        design_batch_id: item.designBatchId || null,
        design_batch_number: item.designBatchNumber || null,
        group_contributor_name: item.groupContributorName || null,
        price: roundMoney(
          calculatePrice(design, item.name, itemProduct) +
          (includesGiftingBag ? giftingBagQuantity * GIFTING_BAG_PRICE : 0)
        ),
        gifting_bag: includesGiftingBag,
        gifting_bag_quantity: includesGiftingBag ? giftingBagQuantity : 0,

        design: {
          ready_made: design.readyMade ? {
            sku: itemProduct.sku || "",
            image_path: design.readyMade.imagePath || itemProduct.image_path || "",
            selections: design.readyMade.selections || {}
          } : null,
          font_size_mm: getStandardFontSize(design),
          pencil: itemProduct.product_key === PENCIL_PRODUCT_KEY ? (() => {
            const pencil = normalizePencilDesign(design.pencil);
            const detail = hex => ({
              name: getColourName(hex),
              material_type: getColourMaterial(hex),
              hex
            });
            return {
              text_style: pencil.textStyle,
              ending_style: pencil.endingStyle,
              eraser: detail(pencil.eraser),
              ferrule: detail(pencil.ferrule),
              wood: detail(pencil.wood),
              tip: detail(pencil.tip),
              end_cap: detail(pencil.endCap)
            };
          })() : null,
          photo: design.photo ? {
            original_path: design.photo.originalPath || "",
            artwork_path: design.photo.artworkPath || "",
            artwork_url: design.photo.artworkUrl || "",
            generation_id: design.photo.generationId || "",
            subject_type: design.photo.subjectType || "person",
            colour_count: Number(design.photo.colourCount || 4),
            variant: design.photo.variant || "classic",
            filament_palette: normalizePhotoFilamentPalette(
              design.photo.filamentPalette || design.photo.filament_palette
            ),
            printability_status: "needs_review"
          } : null,
          letter_orientation: design.letterOrientation || "vertical",
          base_shape: {
            key: design.baseShape || "ribbed",
            label: BASE_SHAPES[design.baseShape || "ribbed"]?.label || "Photo Artwork"
          },
          bases: design.bases.map(hex => ({
            name: getColourName(hex),
            material_type: getColourMaterial(hex),
            hex
          })),
          caps: design.caps.map(hex => ({
            name: getColourName(hex),
            material_type: getColourMaterial(hex),
            hex
          })),
          letters: design.letters.map(hex => ({
            name: getColourName(hex),
            material_type: getColourMaterial(hex),
            hex
          }))
        }
      };
    });
  });

  const order = {
    order_ref: orderRef,
    client_submission_id: currentSubmissionId,
    product_key: orderData[0]?.product_key || activeProduct.product_key,
    group_order_code:
      finalisingSharedGroupOwnerToken && activeSharedGroup?.public_code
        ? activeSharedGroup.public_code
        : null,
    linked_order_ref: hasVerifiedLinkedOrder()
      ? verifiedLinkedOrder.orderRef
      : null,

    customer_name: customerName.value.trim(),
    customer_email: customerEmail.value.trim(),
    customer_phone: customerPhone.value.trim(),

    collection_method: collectionMethod.value,

    pickup_scheduled_date:
      collectionMethod.value !== "delivery" && !hasVerifiedLinkedOrder()
        ? checkoutPickupDate.value
        : null,
    pickup_time_range:
      collectionMethod.value !== "delivery" && !hasVerifiedLinkedOrder()
        ? checkoutPickupTime.value
        : null,

    delivery_address:
      collectionMethod.value === "delivery" && !hasVerifiedLinkedOrder()
        ? getDeliveryAddress()
        : "",

    preferred_time: orderNotes.value,
    needed_by: assignedNeededBy,
    notes: orderNotes.value,
    order_type: checkoutOrderType,
    requested_completion_date: ["rush", "bulk"].includes(checkoutOrderType)
      ? requestedCompletionDate.value
      : null,
    estimated_ready_from: toLocalDateString(estimatedReadyFrom),
    estimated_ready_to: isReviewRequest
      ? toLocalDateString(estimatedReadyTo)
      : productionNeededBy,
    review_status: isReviewRequest
      ? "Pending Review"
      : rushAutoApproved || checkoutOrderType === "bulk"
        ? "Auto Approved"
        : null,

    original_subtotal: roundMoney(originalSubtotal),
    promo_code: appliedPromoCode || null,
    discount_amount: discountAmount,
    subtotal,
    delivery_fee: delivery,
    rush_fee: rushFee,
    total,

    payment_type: "Pending",

    order_source: isManualOrder
      ? "Manual"
      : "Website",

    status: isManualOrder
      ? "Pending Payment"
      : checkoutOrderType === "rush"
        ? rushAutoApproved ? "Pending Payment" : "Rush Review"
        : "Pending Payment",

    order_data: orderData
  };

  // First save the order.
  let orderWasAlreadySaved = editingPendingOrder;
  try {
    if (editingPendingOrder) {
      await updatePendingOrderInDatabase(order);
    } else {
      const saveResult = await saveOrderToDatabase(order);
      orderWasAlreadySaved = saveResult.alreadySaved;
    }
  } catch (error) {
    console.error("Unable to save order:", error);

    submitStatus.innerText =
      "Unable to save your order. Please try again.";

    return;
  }

  if (!editingPendingOrder && order.group_order_code && finalisingSharedGroupOwnerToken) {
    try {
      const { error } = await supabase.rpc("finalise_shared_group_order", {
        p_owner_token: finalisingSharedGroupOwnerToken,
        p_order_ref: orderRef,
        p_email: order.customer_email
      });
      if (error) throw error;
      activeSharedGroup = {
        ...activeSharedGroup,
        status: "finalised",
        final_order_ref: orderRef
      };
      renderSharedGroupBanner();
    } catch (error) {
      console.error("Unable to close the shared group after checkout:", error);
    }
  }

  // The order is now safely saved.
  orderSubmitted = true;
  editingPendingOrder = false;
  if (!pendingOrderEditableUntil) {
    pendingOrderEditableUntil = Date.now() + 30 * 60 * 1000;
  }
  localStorage.removeItem("littleKeepsDraft");

  if (
    !orderWasAlreadySaved &&
    order.collection_method !== "delivery" &&
    !order.linked_order_ref &&
    order.pickup_scheduled_date &&
    order.pickup_time_range
  ) {
    await requestPickupTimingTelegramAlert(
      orderRef,
      order.customer_email
    );
  }

  if (isReviewRequest && !orderWasAlreadySaved) {
    await requestSpecialOrderTelegramAlert(
      orderRef,
      order.customer_email
    );
  }

  if (!isManualOrder) {
    rememberPendingOrder({
      orderRef,
      email: order.customer_email.toLowerCase(),
      total,
      orderType: checkoutOrderType,
      approved: !isReviewRequest
    });

    // Wait for the small reference email request to finish before continuing.
    // This prevents mobile browsers from cancelling it during navigation.
    if (!isReviewRequest && !orderWasAlreadySaved) {
      await requestOrderSavedEmail(
        orderRef,
        order.customer_email,
        order.linked_order_ref
      );
      if (order.linked_order_ref) {
        const sharedLatestDate = [
          verifiedLinkedOrder?.latestDate,
          assignedNeededBy
        ].filter(Boolean).sort().at(-1) || assignedNeededBy;
        await sendLinkedOrderConfirmationEmail(
          order,
          orderRef,
          order.linked_order_ref,
          sharedLatestDate
        );
      }
    }
  } else if (!isReviewRequest && !orderWasAlreadySaved) {
    await requestOrderSavedEmail(
      orderRef,
      order.customer_email,
      order.linked_order_ref
    );
  }

  if (isReviewRequest) {
    orderRefText.innerHTML = `<strong>${orderRef}</strong>`;
    successModal.querySelector("h2").textContent =
      checkoutOrderType === "rush" ? "Rush Request Received ♡" : "Bulk Request Received ♡";
    const modalParagraphs = successModal.querySelectorAll(".modal-card > p");
    if (modalParagraphs[0]) {
      modalParagraphs[0].textContent =
        "We’ll review your preferred completion date and contact you before payment.";
    }
    if (modalParagraphs[2]) {
      modalParagraphs[2].textContent =
        "Please do not make payment yet. We’ll confirm the timing and final quote first.";
    }
    if (modalParagraphs[3]) {
      modalParagraphs[3].textContent =
        "We’ll contact you by email or WhatsApp after reviewing your request.";
    }
    checkoutScreen.classList.add("hidden");
    successModal.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  // Supabase sends the Telegram alert only after payment is verified.
  // The customer-facing website does not contain the Telegram bot token.
  paymentOrderRef.innerText = order.linked_order_ref || orderRef;
  paymentOrderRef.dataset.paymentRef = orderRef;
  paymentTotal.innerText = `$${total.toFixed(2)}`;
  if (order.linked_order_ref) {
    paymentLinkedOrderNote.textContent =
      `Added to order ${order.linked_order_ref}. It keeps the same collection method and there is no second delivery fee.`;
    paymentLinkedOrderNote.classList.remove("hidden");
  } else {
    paymentLinkedOrderNote.classList.add("hidden");
  }

  if (isManualOrder && manualPaymentRequestPanel && manualPaymentLink) {
    const paymentRequestUrl = new URL(window.location.origin);
    paymentRequestUrl.searchParams.set("resume_order", orderRef);
    paymentRequestUrl.hash = "orderStatusSection";
    manualPaymentLink.href = paymentRequestUrl.toString();
    manualPaymentLink.textContent = paymentRequestUrl.toString();
    manualPaymentRequestPanel.classList.remove("hidden");
  }

  checkoutScreen.classList.add("hidden");
  paymentScreen.classList.remove("hidden");
  hideStorefrontViews();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function updateCollectionNote() {

    const subtotal = (cartHasItems ? getCartItems() : names).reduce(
        (sum, item) =>
          sum + calculatePrice(getDesign(item), item.name, getItemProduct(item)) * getItemQuantity(item),
        0
    );

    if (hasVerifiedLinkedOrder()) {
        deliveryAddressSection.classList.add("hidden");
        checkoutPickupSection.classList.add("hidden");
        deliveryNote.innerHTML = `
          🔗 <strong>Linked to ${verifiedLinkedOrder.orderRef}.</strong><br><br>
          This add-on uses the original order’s ${collectionMethod.value === "delivery" ? "delivery address" : "pickup method"}, so there is no second delivery fee. Both parts follow whichever pickup or dispatch date is later.
        `;
        return;
    }

    if (collectionMethod.value !== "delivery") {
        const pickupLocation = collectionMethod.value === "pickup_marsiling"
          ? "Marsiling MRT"
          : "Woodlands MRT";

        deliveryNote.innerHTML = `
            📍 <strong>${pickupLocation}</strong><br>
            Choose a Wednesday or Friday slot after 7pm, or a weekend slot.
        `;

    } else {

        const fee = subtotal >= freeDeliveryThreshold
          ? "FREE 🎉"
          : displaySettingMoney(deliveryFeeSetting);

        deliveryNote.innerHTML = `
            🚚 Tracking details are emailed unless your order is hand delivered.
        `;

    }

}

function refreshUI() {
  renderNameCards();
  renderColourSlots();
  updateEditModeText();
  updatePreviewColourLegend();
  renderColourChargeNotices();
  updateBaseShapeButtons();
  updateLetterOrientationButtons();
  updateStandardFontSizeButtons();
  updatePencilControls();
  updateGiftingBagOptions();
  updateCartDisplay();
  updateTurnaroundMessaging();
  renderReviewOrder();
}

// Manual 3D preview alignment controls for the pencil product.
// Adjust only these values when fine-tuning how the STL pieces meet.
const PENCIL_PREVIEW_LAYOUT = Object.freeze({
  blockPitch: 27,
  topOffsetX: 2.8,
  topOffsetY: -6,
  characterOffsetX: 0,
  characterHeight: 17.2,
  noseOffsetX: 4,
  tipOffsetX: 6,
  ferruleOffsetX: -5,
  eraserOffsetX: -11,
  endCapOffsetX: 10,
  rotationX: Math.PI / 2 - 0.22,
  rotationY: 0.08,
  rotationZ: -0.04,
  cameraDistanceScale: 1.55
});

async function buildPencilClickerPreview(item, design) {
  const thisBuildNumber = ++previewBuildNumber;
  const pencil = normalizePencilDesign(design.pencil);
  const cleanName = Array.from(sanitizeName(item.name || "A")).slice(0, 10);

  clearKeychainPreview();
  canvas.classList.remove("hidden");
  document.getElementById("pencilDesignPreview")?.classList.add("hidden");
  photoDesignPreview?.classList.add("hidden");
  previewLoading?.classList.remove("hidden");

  try {
    const pencilGroup = new THREE.Group();
    const [bodyGeometry, topGeometry, noseGeometry, tipGeometry, ferruleGeometry, eraserGeometry, endCapGeometry, font] = await Promise.all([
      loadSTL("/models/pencil/body.stl", { preservePosition: true }),
      loadSTL("/models/pencil/top.stl", { preservePosition: true }),
      loadSTL("/models/pencil/nose.stl", { preservePosition: true }),
      loadSTL("/models/pencil/tip.stl", { preservePosition: true }),
      loadSTL("/models/pencil/ferrule.stl", { preservePosition: true }),
      loadSTL("/models/pencil/eraser.stl", { preservePosition: true }),
      loadSTL("/models/pencil/end-cap.stl", { preservePosition: true }),
      getStandardPreviewFont()
    ]);

    const blockPitch = PENCIL_PREVIEW_LAYOUT.blockPitch;
    const firstBlockX = -((cleanName.length - 1) * blockPitch) / 2;
    const lastBlockX = firstBlockX + (cleanName.length - 1) * blockPitch;

    for (let index = 0; index < cleanName.length; index += 1) {
      const character = cleanName[index];
      const x = firstBlockX + index * blockPitch;
      const bodyColour = design.bases[index % design.bases.length];
      const topColour = design.caps[index % design.caps.length];
      const characterColour = design.letters[index % design.letters.length];

      const body = new THREE.Mesh(bodyGeometry.clone(), createMat(bodyColour));
      body.position.x = x;
      pencilGroup.add(body);

      const top = new THREE.Mesh(topGeometry.clone(), createMat(topColour));
      top.position.set(
        x + PENCIL_PREVIEW_LAYOUT.topOffsetX,
        PENCIL_PREVIEW_LAYOUT.topOffsetY,
        0
      );
      pencilGroup.add(top);

      let characterMesh;
      if (PENCIL_SYMBOLS[character]) {
        characterMesh = createPencilSymbolMesh(character, characterColour);
      } else {
        const characterGeometry = new TextGeometry(character, {
          font,
          size: 12,
          depth: 1,
          curveSegments: 6,
          bevelEnabled: false
        });
        characterGeometry.center();
        characterMesh = new THREE.Mesh(characterGeometry, createMat(characterColour));
      }

      characterMesh.rotation.x = -Math.PI / 2;
      characterMesh.position.set(
        x + PENCIL_PREVIEW_LAYOUT.topOffsetX + PENCIL_PREVIEW_LAYOUT.characterOffsetX,
        PENCIL_PREVIEW_LAYOUT.characterHeight,
        0
      );
      pencilGroup.add(characterMesh);
    }

    const nose = new THREE.Mesh(noseGeometry, createMat(pencil.wood));
    nose.position.x = firstBlockX + PENCIL_PREVIEW_LAYOUT.noseOffsetX;
    pencilGroup.add(nose);

    const tip = new THREE.Mesh(tipGeometry, createMat(pencil.tip));
    tip.position.x = firstBlockX + PENCIL_PREVIEW_LAYOUT.tipOffsetX;
    pencilGroup.add(tip);

    if (pencil.endingStyle === "endCap") {
      const endCap = new THREE.Mesh(endCapGeometry, createMat(pencil.endCap));
      endCap.position.x = lastBlockX + PENCIL_PREVIEW_LAYOUT.endCapOffsetX;
      pencilGroup.add(endCap);
    } else {
      const ferrule = new THREE.Mesh(ferruleGeometry, createMat(pencil.ferrule));
      ferrule.position.x = lastBlockX + PENCIL_PREVIEW_LAYOUT.ferruleOffsetX;
      pencilGroup.add(ferrule);

      const eraser = new THREE.Mesh(eraserGeometry, createMat(pencil.eraser));
      eraser.position.x = lastBlockX + PENCIL_PREVIEW_LAYOUT.eraserOffsetX;
      pencilGroup.add(eraser);
    }

    const bounds = new THREE.Box3().setFromObject(pencilGroup);
    const centre = new THREE.Vector3();
    const size = new THREE.Vector3();
    bounds.getCenter(centre);
    bounds.getSize(size);
    pencilGroup.position.sub(centre);

    if (thisBuildNumber !== previewBuildNumber) {
      disposePreviewObject(pencilGroup);
      return;
    }

    keychain.add(pencilGroup);
    keychain.position.set(0, 0, 0);
    keychain.rotation.set(
      PENCIL_PREVIEW_LAYOUT.rotationX,
      PENCIL_PREVIEW_LAYOUT.rotationY,
      PENCIL_PREVIEW_LAYOUT.rotationZ
    );
    controls.target.set(0, 0, 0);
    camera.fov = 35;
    camera.position.set(0, 8, Math.max(135, size.x * PENCIL_PREVIEW_LAYOUT.cameraDistanceScale));
    camera.updateProjectionMatrix();
    controls.update();
  } catch (error) {
    console.error("Unable to build pencil clicker preview:", error);
    const pencilPreview = document.getElementById("pencilDesignPreview");
    canvas.classList.add("hidden");
    if (pencilPreview) {
      pencilPreview.classList.remove("hidden");
      pencilPreview.innerHTML = "<p>Preview is temporarily unavailable. Your colour choices are still saved.</p>";
    }
  } finally {
    if (thisBuildNumber === previewBuildNumber) previewLoading?.classList.add("hidden");
  }
}

function buildSelectedPreview() {
  if (!names.length) {
    previewBuildNumber += 1;
    clearKeychainPreview();
    previewLoading?.classList.add("hidden");
    photoDesignPreview?.classList.add("hidden");
    document.getElementById("pencilDesignPreview")?.classList.add("hidden");
    return;
  }

  const item = names[selectedIndex];
  const design = getDesign(item);

  if (activeProduct.product_key === PENCIL_PRODUCT_KEY) {
    buildPencilClickerPreview(item, design);
    return;
  }

  canvas.classList.remove("hidden");
  document.getElementById("pencilDesignPreview")?.classList.add("hidden");

  if (activeProduct.product_key === PHOTO_PRODUCT_KEY) {
    previewBuildNumber += 1;
    clearKeychainPreview();
    previewLoading?.classList.add("hidden");
    if (photoDesignPreview) {
      photoDesignPreview.src = design.photo?.artworkUrl || "";
      photoDesignPreview.classList.toggle("hidden", !design.photo?.artworkUrl);
    }
    return;
  }

  photoDesignPreview?.classList.add("hidden");

  if (
    activeProduct.product_key ===
    STANDARD_PRODUCT_KEY
  ) {
    buildStandardKeychain(
      item.name,
      design
    );

    return;
  }

  buildKeychain(
    item.name,
    design
  );
}

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  if (!w || !h) return;

  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function animate() {
  resize();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function setOrderType(type) {
  orderType = type;

  const isGroupOrder = type === "group";

  singleBtn.classList.toggle(
    "active",
    !isGroupOrder
  );

  groupBtn.classList.toggle(
    "active",
    isGroupOrder
  );

  singleSection.classList.toggle(
    "hidden",
    isGroupOrder
  );

  groupSection.classList.toggle(
    "hidden",
    !isGroupOrder
  );

  renderSharedGroupStartCard();

  applyAllToggle.checked = false;

  updateNames();
}

singleBtn.onclick = () => {
  setOrderType("single");
};

groupBtn.onclick = () => {
  setOrderType("group");
};

friendsFamilyStartBtn.addEventListener("click", () => {
  if (activeSharedGroup?.is_owner) {
    renderSharedGroupOwner();
    return;
  }
  if (!names.length) {
    alert("Enter your name first, then choose your colours.");
    (orderType === "group" ? nameList : singleName).focus();
    return;
  }
  cartHasItems = true;
  draftHasMeaningfulChanges = true;
  updateCartDisplay();
  openSharedGroupCartAction();
});

function createPrivateGroupToken() {
  return crypto.randomUUID();
}

function serializeSharedGroupBasket() {
  return names.map(item => {
    const design = getDesign(item);
    return {
      product_key: activeProduct.product_key,
      name: item.name,
      quantity: getItemQuantity(item),
      design: {
        font_size_mm: getStandardFontSize(design),
        photo: design.photo || null,
        pencil: normalizePencilDesign(design.pencil),
        base_shape: design.baseShape || "ribbed",
        letter_orientation: design.letterOrientation || "vertical",
        bases: [...design.bases],
        caps: [...design.caps],
        letters: [...design.letters]
      }
    };
  });
}

function restoreSharedGroupItems(contributions = []) {
  return flattenSharedGroupContributions(contributions).map(item => ({
    ...item,
    custom: {
      ...item.custom,
      pencil: normalizePencilDesign(item.custom.pencil || globalDesign.pencil),
      bases: item.custom.bases.length ? item.custom.bases : [...globalDesign.bases],
      caps: item.custom.caps.length ? item.custom.caps : [...globalDesign.caps],
      letters: item.custom.letters.length ? item.custom.letters : [...globalDesign.letters]
    }
  }));
}

function getSharedGroupOwnerContribution(group = activeSharedGroup) {
  const contributions = group?.contributions || [];
  return contributions.find(contribution => contribution.is_organiser) || contributions[0] || null;
}

function restoreSharedGroupOwnerCart(group = activeSharedGroup, { force = false } = {}) {
  if (!group?.is_owner || (cartHasItems && !force)) return false;
  const ownerContribution = getSharedGroupOwnerContribution(group);
  if (!ownerContribution) return false;
  const restored = restoreSharedGroupItems([ownerContribution]);
  if (!restored.length) return false;

  activeProduct = getProductByKey(productCatalog, group.product_key);
  updateProductCustomiser();
  names = restored;
  selectedIndex = 0;
  cartHasItems = true;
  orderType = restored.length > 1 ? "group" : "single";
  singleBtn.classList.toggle("active", orderType === "single");
  groupBtn.classList.toggle("active", orderType === "group");
  singleSection.classList.toggle("hidden", orderType !== "single");
  groupSection.classList.toggle("hidden", orderType !== "group");
  singleName.value = restored[0].name;
  singleQuantity.value = String(restored[0].quantity);
  nameList.value = formatDesignBatchNames(restored);
  refreshUI();
  buildSelectedPreview();
  return true;
}

function getSharedGroupInviteUrl(shareToken) {
  const url = new URL(window.location.origin);
  url.searchParams.set("group", shareToken);
  url.hash = "designArea";
  return url.toString();
}

function getSharedGroupContributionToken(groupCode) {
  const key = `littleKeepsGroupContribution:${groupCode}`;
  let token = localStorage.getItem(key);
  if (!token) {
    token = createPrivateGroupToken();
    localStorage.setItem(key, token);
  }
  return token;
}

function getSharedGroupOwnerContributionToken(groupCode) {
  return localStorage.getItem(`littleKeepsGroupOwnerContribution:${groupCode}`) || "";
}

function renderSharedGroupBanner() {
  renderSharedGroupStartCard();
  if (!activeSharedGroup) {
    sharedGroupBanner.classList.add("hidden");
    return;
  }

  sharedGroupBannerTitle.textContent = activeSharedGroup.title;
  if (activeSharedGroup.is_owner) {
    sharedGroupBannerText.textContent =
      `${activeSharedGroup.contribution_count} contributor${Number(activeSharedGroup.contribution_count) === 1 ? "" : "s"} · ${activeSharedGroup.item_count} design${Number(activeSharedGroup.item_count) === 1 ? "" : "s"}`;
    sharedGroupBannerAction.textContent = "Review Group";
  } else if (activeSharedGroup.status === "open") {
    sharedGroupBannerText.textContent =
      `Design your keychain for ${activeSharedGroup.organiser_name}, then add your basket to the group.`;
    sharedGroupBannerAction.textContent = "How It Works";
  } else {
    sharedGroupBannerText.textContent = activeSharedGroup.final_order_ref
      ? `The organiser has checked out as order ${activeSharedGroup.final_order_ref}.`
      : "This group order is now closed.";
    sharedGroupBannerAction.textContent = "Closed";
  }
  sharedGroupBanner.classList.remove("hidden");
}

function renderSharedGroupStartCard() {
  const isInvitedContributor = Boolean(activeSharedGroup && !activeSharedGroup.is_owner);
  sharedGroupStartCard.classList.toggle("hidden", isInvitedContributor);
  if (isInvitedContributor) return;

  if (activeSharedGroup?.is_owner) {
    sharedGroupStartCardTitle.textContent = "Your shared Group Order";
    sharedGroupStartCardText.textContent =
      "Add or update your own designs in the cart. They will be saved into the Group Order automatically.";
    friendsFamilyStartBtn.textContent = "Review Group Order";
    return;
  }

  sharedGroupStartCardTitle.textContent = "Create a shared Group Order";
  sharedGroupStartCardText.textContent =
    "Add your own design first, then create a private link for everyone else to add theirs. You review everything and pay once.";
  friendsFamilyStartBtn.textContent = "Create Group Order";
}

function renderSharedGroupOwner() {
  if (!activeSharedGroup?.is_owner) return;
  const contributions = activeSharedGroup.contributions || [];
  const totalItems = contributions.reduce(
    (sum, contribution) => sum + (contribution.items || []).reduce(
      (itemSum, item) => itemSum + normalizeItemQuantity(item.quantity),
      0
    ),
    0
  );

  sharedGroupOwnerTitle.textContent = activeSharedGroup.title;
  sharedGroupOwnerSummary.textContent =
    `${contributions.length} contributor${contributions.length === 1 ? "" : "s"} · ${totalItems} keychain${totalItems === 1 ? "" : "s"}`;
  sharedGroupInviteLink.value = getSharedGroupInviteUrl(activeSharedGroup.share_token);
  sharedGroupLinkBox.classList.toggle("hidden", activeSharedGroup.status !== "open");
  sharedGroupContributionList.innerHTML = contributions.length
    ? contributions.map(contribution => {
        const quantity = (contribution.items || []).reduce(
          (sum, item) => sum + normalizeItemQuantity(item.quantity),
          0
        );
        const namesList = (contribution.items || [])
          .map(item => `${escapePresetText(item.name)}${normalizeItemQuantity(item.quantity) > 1 ? ` × ${normalizeItemQuantity(item.quantity)}` : ""}`)
          .join(", ");
        return `
          <article>
            <div>
              <strong>${escapePresetText(contribution.contributor_name)}${contribution.is_organiser ? " · You" : ""}</strong>
              <span>${namesList}</span>
              <small>${quantity} keychain${quantity === 1 ? "" : "s"}</small>
            </div>
            ${activeSharedGroup.status === "open" && !contribution.is_organiser ? `
              <button type="button" onclick='window.removeSharedGroupContribution(${JSON.stringify(contribution.id)})'>Remove</button>
            ` : ""}
          </article>
        `;
      }).join("")
    : `<div class="shared-group-empty"><strong>No designs yet</strong><span>Share the invite link with your group.</span></div>`;
  checkoutSharedGroupBtn.disabled = !contributions.length || activeSharedGroup.status !== "open";
  checkoutSharedGroupBtn.textContent = activeSharedGroup.status === "open"
    ? "Review Combined Basket"
    : activeSharedGroup.status === "cancelled"
      ? "Group Order Cancelled"
      : `Checked Out${activeSharedGroup.final_order_ref ? ` · ${activeSharedGroup.final_order_ref}` : ""}`;
  cancelSharedGroupOrderBtn.classList.toggle("hidden", activeSharedGroup.status !== "open");
  sharedGroupOwnerModal.classList.remove("hidden");
}

async function syncSharedGroupOwnerBasket({ openOwner = false } = {}) {
  if (
    !activeSharedGroup?.is_owner ||
    activeSharedGroup.status !== "open" ||
    finalisingSharedGroupOwnerToken
  ) return true;

  const ownerReviewWasOpen = !sharedGroupOwnerModal.classList.contains("hidden");
  sharedGroupBannerText.textContent = "Saving your cart to the Group Order…";
  sharedGroupCartBtn.disabled = true;
  sharedGroupCartBtn.textContent = "Saving to Group Order…";
  try {
    let { error } = await supabase.rpc("save_shared_group_owner_contribution", {
      p_owner_token: activeSharedGroupOwnerToken,
      p_items: cartHasItems && names.length ? serializeSharedGroupBasket() : []
    });
    const ownerFunctionUnavailable = error && (
      error.code === "PGRST202" ||
      String(error.message || "").includes("save_shared_group_owner_contribution")
    );
    const ownerContributionToken = getSharedGroupOwnerContributionToken(
      activeSharedGroup.public_code
    );
    if (ownerFunctionUnavailable && ownerContributionToken && cartHasItems && names.length) {
      ({ error } = await supabase.rpc("save_shared_group_contribution", {
        p_share_token: activeSharedGroup.share_token,
        p_contributor_name: activeSharedGroup.organiser_name,
        p_contribution_token: ownerContributionToken,
        p_items: serializeSharedGroupBasket()
      }));
    }
    if (error) throw error;
    await loadSharedGroup(activeSharedGroupOwnerToken, {
      openOwner: openOwner || ownerReviewWasOpen
    });
    return true;
  } catch (error) {
    console.error("Unable to update organiser group designs:", error);
    sharedGroupBannerText.textContent =
      "Your cart changed, but the Group Order could not be updated. Please try again.";
    renderCartDrawer();
    alert("Your cart is saved on this device, but it could not update the Group Order. Please try again.");
    return false;
  }
}

async function loadSharedGroup(token, { openOwner = false } = {}) {
  if (!token) return null;
  try {
    const { data, error } = await supabase.rpc("get_shared_group_order", {
      p_token: token
    });
    if (error) throw error;
    if (!data) {
      clearSharedGroupLink();
      return null;
    }
    if (isSharedGroupCancelledOrExpired(data)) {
      clearSharedGroupLink(data);
      return null;
    }
    activeSharedGroup = data;
    if (data.is_owner) restoreSharedGroupOwnerCart(data);
    scheduleSharedGroupExpiry(data);
    if (
      !data.is_owner &&
      !cartHasItems &&
      data.product_key &&
      activeProduct.product_key !== data.product_key
    ) {
      activeProduct = getProductByKey(productCatalog, data.product_key);
      updateProductCustomiser();
    }
    renderSharedGroupBanner();
    renderCartDrawer();
    if (data.is_owner && openOwner) renderSharedGroupOwner();
    return data;
  } catch (error) {
    console.error("Unable to load shared group order:", error);
    sharedGroupBannerTitle.textContent = "Shared order unavailable";
    sharedGroupBannerText.textContent = "Ask the organiser for a new private link.";
    sharedGroupBannerAction.textContent = "Unavailable";
    sharedGroupBanner.classList.remove("hidden");
    return null;
  }
}

function scheduleSharedGroupExpiry(group) {
  clearTimeout(sharedGroupExpiryTimer);
  sharedGroupExpiryTimer = null;
  if (group?.status !== "open" || !group.expires_at) return;

  const remaining = new Date(group.expires_at).getTime() - Date.now();
  if (!Number.isFinite(remaining)) return;
  if (remaining <= 0) {
    clearSharedGroupLink(group);
    return;
  }

  sharedGroupExpiryTimer = setTimeout(() => {
    if (new Date(group.expires_at).getTime() <= Date.now()) {
      clearSharedGroupLink(group);
    } else {
      scheduleSharedGroupExpiry(group);
    }
  }, Math.min(remaining + 250, 2147483647));
}

function clearSharedGroupLink(group = activeSharedGroup) {
  clearTimeout(sharedGroupExpiryTimer);
  sharedGroupExpiryTimer = null;
  if (group?.is_owner && group.public_code) {
    localStorage.removeItem(`littleKeepsGroupOwner:${group.public_code}`);
  }
  activeSharedGroup = null;
  activeSharedGroupOwnerToken = "";
  activeSharedGroupShareToken = "";
  finalisingSharedGroupOwnerToken = "";
  sharedGroupBanner.classList.add("hidden");
  sharedGroupOwnerModal.classList.add("hidden");
  sharedGroupContributeModal.classList.add("hidden");
  sharedGroupHowModal.classList.add("hidden");
  sharedGroupSuccessModal.classList.add("hidden");
  renderSharedGroupStartCard();
  renderCartDrawer();

  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("group");
  cleanUrl.searchParams.delete("group_owner");
  window.history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
}

function openSharedGroupCartAction() {
  if (activeSharedGroup?.is_owner) {
    closeCartDrawer();
    if (cartHasItems && names.length) {
      void syncSharedGroupOwnerBasket({ openOwner: true });
    } else {
      renderSharedGroupOwner();
    }
    return;
  }
  if (!cartHasItems || !names.length) return;
  closeCartDrawer();

  if (activeSharedGroup && !activeSharedGroup.is_owner) {
    if (activeSharedGroup.status !== "open") {
      alert("This group order is no longer accepting designs.");
      return;
    }
    if (activeProduct.product_key !== activeSharedGroup.product_key) {
      alert("This group is collecting a different Little Keeps product. Open the invite link again and design the matching product.");
      return;
    }
    sharedGroupContributeIntro.textContent =
      `Your ${getTotalKeychainQuantity()} keychain${getTotalKeychainQuantity() === 1 ? "" : "s"} will be sent to ${activeSharedGroup.organiser_name}. You won’t need to pay here.`;
    sharedGroupContributeModal.classList.remove("hidden");
    sharedGroupContributorName.focus();
    return;
  }

  sharedGroupOrganiserName.value ||= customerName.value.trim();
  sharedGroupOrganiserEmail.value ||= customerEmail.value.trim();
  sharedGroupStartModal.classList.remove("hidden");
  sharedGroupTitle.focus();
}

sharedGroupStartForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!cartHasItems || !names.length) return;
  const submitButton = sharedGroupStartForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Creating…";
  sharedGroupStartStatus.textContent = "Creating your private group link…";

  const shareToken = createPrivateGroupToken();
  const ownerToken = createPrivateGroupToken();
  const contributionToken = createPrivateGroupToken();
  try {
    const { data, error } = await supabase.rpc("create_shared_group_order", {
      p_title: sharedGroupTitle.value.trim(),
      p_organiser_name: sharedGroupOrganiserName.value.trim(),
      p_organiser_email: sharedGroupOrganiserEmail.value.trim(),
      p_product_key: activeProduct.product_key,
      p_share_token: shareToken,
      p_owner_token: ownerToken,
      p_contribution_token: contributionToken,
      p_items: serializeSharedGroupBasket()
    });
    if (error) throw error;
    localStorage.setItem(`littleKeepsGroupOwner:${data.public_code}`, ownerToken);
    localStorage.setItem(
      `littleKeepsGroupOwnerContribution:${data.public_code}`,
      contributionToken
    );
    activeSharedGroupOwnerToken = ownerToken;
    activeSharedGroupShareToken = "";
    window.history.replaceState({}, "", `?group_owner=${encodeURIComponent(ownerToken)}`);
    sharedGroupStartModal.classList.add("hidden");
    await loadSharedGroup(ownerToken, { openOwner: true });
  } catch (error) {
    console.error("Unable to create shared group order:", error);
    sharedGroupStartStatus.textContent =
      "Group orders are not ready yet. Please apply the supplied Supabase update, then try again.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Create Share Link";
  }
});

sharedGroupContributeForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!activeSharedGroup || !cartHasItems || !names.length) return;
  const submitButton = sharedGroupContributeForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Adding…";
  sharedGroupContributeStatus.textContent = "Sending your designs to the organiser…";

  try {
    const { data, error } = await supabase.rpc("save_shared_group_contribution", {
      p_share_token: activeSharedGroupShareToken,
      p_contributor_name: sharedGroupContributorName.value.trim(),
      p_contribution_token: getSharedGroupContributionToken(activeSharedGroup.public_code),
      p_items: serializeSharedGroupBasket()
    });
    if (error) throw error;
    sharedGroupContributeStatus.textContent =
      `Added ✓ ${activeSharedGroup.organiser_name} can now see your designs.`;
    sharedGroupBannerText.textContent =
      `Your designs are saved. You can update them before the organiser checks out.`;
    submitButton.textContent = "Update My Group Designs";
    activeSharedGroup.contribution_count = data.contribution_count;
    sharedGroupSuccessText.textContent =
      `${sharedGroupContributorName.value.trim()}, your ${getTotalKeychainQuantity()} keychain${getTotalKeychainQuantity() === 1 ? " is" : "s are"} saved in “${activeSharedGroup.title}”.`;
    sharedGroupContributeModal.classList.add("hidden");
    sharedGroupSuccessModal.classList.remove("hidden");
  } catch (error) {
    console.error("Unable to save group designs:", error);
    sharedGroupContributeStatus.textContent =
      error?.message || "Unable to add your designs. Please try again.";
  } finally {
    submitButton.disabled = false;
    if (!submitButton.textContent.includes("Update")) {
      submitButton.textContent = "Add My Basket to the Group";
    }
  }
});

window.removeSharedGroupContribution = async function(contributionId) {
  if (!activeSharedGroup?.is_owner || !confirm("Remove this person’s designs from the group?")) return;
  sharedGroupOwnerStatus.textContent = "Removing designs…";
  const { error } = await supabase.rpc("remove_shared_group_contribution", {
    p_owner_token: activeSharedGroupOwnerToken,
    p_contribution_id: contributionId
  });
  if (error) {
    sharedGroupOwnerStatus.textContent = "Unable to remove these designs.";
    return;
  }
  await loadSharedGroup(activeSharedGroupOwnerToken, { openOwner: true });
};

function checkoutSharedGroup() {
  if (!activeSharedGroup?.is_owner || activeSharedGroup.status !== "open") return;
  const restored = restoreSharedGroupItems(activeSharedGroup.contributions || []);
  if (!restored.length) return;
  activeProduct = getProductByKey(productCatalog, activeSharedGroup.product_key);
  updateProductCustomiser();
  names = restored;
  orderType = restored.length > 1 ? "group" : "single";
  selectedIndex = 0;
  giftingBagQuantity = 0;
  cartHasItems = true;
  finalisingSharedGroupOwnerToken = activeSharedGroupOwnerToken;
  customerName.value = activeSharedGroup.organiser_name || "";
  customerEmail.value = activeSharedGroup.organiser_email || "";
  if (orderType === "single") {
    singleName.value = restored[0].name;
    singleQuantity.value = String(restored[0].quantity);
  } else {
    nameList.value = restored.map(item => item.name).join("\n");
  }
  sharedGroupOwnerModal.classList.add("hidden");
  refreshUI();
  buildSelectedPreview();
  openCartDrawer();
}

sharedGroupCartBtn.addEventListener("click", openSharedGroupCartAction);
sharedGroupBannerAction.addEventListener("click", () => {
  if (activeSharedGroup?.is_owner) renderSharedGroupOwner();
  else if (activeSharedGroup?.status === "open") sharedGroupHowModal.classList.remove("hidden");
});
cancelSharedGroupStartBtn.addEventListener("click", () => sharedGroupStartModal.classList.add("hidden"));
cancelSharedGroupContributeBtn.addEventListener("click", () => sharedGroupContributeModal.classList.add("hidden"));
closeSharedGroupOwnerBtn.addEventListener("click", () => sharedGroupOwnerModal.classList.add("hidden"));
closeSharedGroupHowBtn.addEventListener("click", () => sharedGroupHowModal.classList.add("hidden"));
closeSharedGroupSuccessBtn.addEventListener("click", () => sharedGroupSuccessModal.classList.add("hidden"));
refreshSharedGroupBtn.addEventListener("click", () => loadSharedGroup(activeSharedGroupOwnerToken, { openOwner: true }));
editSharedGroupOwnerDesignsBtn.addEventListener("click", () => {
  if (!restoreSharedGroupOwnerCart(activeSharedGroup, { force: true })) return;
  nameList.value = formatActiveProductNames();
  setOrderType("group");
  sharedGroupOwnerModal.classList.add("hidden");
  setStorefrontView("design", { scrollTo: "designArea" });
  nameList.focus();
  sharedGroupBannerText.textContent =
    "Add another name on a new line, design it, then save your cart to the Group Order.";
});
checkoutSharedGroupBtn.addEventListener("click", checkoutSharedGroup);
cancelSharedGroupOrderBtn.addEventListener("click", async () => {
  if (!activeSharedGroup?.is_owner || activeSharedGroup.status !== "open") return;
  const confirmed = confirm(
    `Cancel “${activeSharedGroup.title}”?\n\nThe invite link will close immediately. No order or payment will be created.`
  );
  if (!confirmed) return;

  cancelSharedGroupOrderBtn.disabled = true;
  cancelSharedGroupOrderBtn.textContent = "Cancelling…";
  sharedGroupOwnerStatus.textContent = "Closing this group order…";
  try {
    const { error } = await supabase.rpc("cancel_shared_group_order", {
      p_owner_token: activeSharedGroupOwnerToken
    });
    if (error) throw error;
    localStorage.removeItem(`littleKeepsGroupOwner:${activeSharedGroup.public_code}`);
    clearSharedGroupLink(activeSharedGroup);
    alert("Group order cancelled. No order or payment was created.");
  } catch (error) {
    console.error("Unable to cancel group order:", error);
    sharedGroupOwnerStatus.textContent =
      "Unable to cancel this group order. Please try again.";
  } finally {
    cancelSharedGroupOrderBtn.disabled = false;
    cancelSharedGroupOrderBtn.textContent = "Cancel Group Order";
  }
});
copySharedGroupLinkBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(sharedGroupInviteLink.value);
  copySharedGroupLinkBtn.textContent = "Copied ✓";
  setTimeout(() => { copySharedGroupLinkBtn.textContent = "Copy Link"; }, 1400);
});

function openCartDrawer() {
  closeSideMenu();
  renderCartDrawer();

  cartDrawer.classList.add("open");
  cartOverlay.classList.remove("hidden");
  document.body.classList.add("cart-open");
}

function closeCartDrawer() {
  cartDrawer.classList.remove("open");
  cartOverlay.classList.add("hidden");
  document.body.classList.remove("cart-open");
}

function renderCartDrawer() {
  const subtotal =
    cartHasItems ? getOrderSubtotal() : 0;

  cartDrawerSubtotal.textContent =
    `$${subtotal.toFixed(2)}`;

  const cartEntries = getCartEntries();
  if (!cartHasItems || !cartEntries.length) {
    cartDrawerItems.innerHTML = `
      <div class="empty-cart">
        <div class="empty-cart-icon">♡</div>
        <h3>Your cart is empty</h3>
        <p>Choose a ready-made favourite or create something personal.</p>
      </div>
    `;

    checkoutFromCartBtn.disabled = true;
    checkoutFromCartBtn.textContent = "Add an item first";
    sharedGroupCartBtn.classList.toggle("hidden", !activeSharedGroup?.is_owner);
    sharedGroupCartBtn.disabled = !activeSharedGroup?.is_owner;
    sharedGroupCartBtn.textContent = "Review Group Order";
    continueShoppingBtn.textContent = "Shop Products";
    return;
  }

  checkoutFromCartBtn.disabled = false;
  checkoutFromCartBtn.textContent = activeSharedGroup && !activeSharedGroup.is_owner
    ? `Add to ${activeSharedGroup.title}`
    : "Checkout";
  sharedGroupCartBtn.classList.toggle(
    "hidden",
    !activeSharedGroup?.is_owner
  );
  sharedGroupCartBtn.disabled = false;
  sharedGroupCartBtn.textContent = "Save My Cart to Group Order";
  continueShoppingBtn.textContent = "Continue Designing";

  const renderCartEntry = ({ item, index }) => {
      const design = getDesign(item);
      const product = getItemProduct(item);
      const unitPrice = calculatePrice(design, item.name, product);
      const itemQuantity = getItemQuantity(item);
      const price = roundMoney(unitPrice * itemQuantity);
      const designDescription = getDesignDescription(design, product);

      return `
        <div class="cart-drawer-item">
          <div class="cart-item-top">
            <div>
              <strong>${item.name}${itemQuantity > 1 ? ` × ${itemQuantity}` : ""}</strong>
              <p>${escapePresetText(product.name)}</p>
              <p>${designDescription}</p>
              ${itemQuantity > 1 ? `<p>${displaySettingMoney(unitPrice)} each</p>` : ""}
              ${isReadyMadeProduct(product) ? "" : `<p class="item-dimension-note">📏 ${getApproximateSizeText(item.name, product, design)}</p>`}
            </div>

            <strong class="cart-item-price">
              $${price.toFixed(2)}
            </strong>
          </div>

          <div class="mini-chain">
            ${createMiniPreview(item.name, design, product)}
          </div>

          <div class="cart-item-actions">
            <button
              type="button"
              onclick="window.editCartItem(${index})"
            >
              Edit
            </button>

            <button
              type="button"
              onclick="window.duplicateCartItem(${index})"
            >
              Duplicate
            </button>

            <button
              type="button"
              class="remove-cart-item"
              onclick="window.removeCartItem(${index})"
            >
              Remove
            </button>
          </div>
        </div>
      `;
    };

  const batchIds = Array.from(new Set(
    cartEntries.map(({ item }) => item.designBatchId).filter(Boolean)
  ));
  if (batchIds.length > 1) {
    const groupedMarkup = batchIds.map((batchId, batchIndex) => {
      const entries = cartEntries.filter(({ item }) => item.designBatchId === batchId);
      const batchTotal = entries.reduce((total, { item }) => {
        const product = getItemProduct(item);
        return total + calculatePrice(getDesign(item), item.name, product) * getItemQuantity(item);
      }, 0);
      return `
        <details class="cart-design-batch" ${batchIndex === 0 ? "open" : ""}>
          <summary>
            <span><small>Design Batch ${entries[0]?.item?.designBatchNumber || batchIndex + 1}</small><strong>${entries.length} names</strong></span>
            <b>$${batchTotal.toFixed(2)}</b>
          </summary>
          <div>${entries.map(renderCartEntry).join("")}</div>
        </details>
      `;
    }).join("");
    const unbatchedMarkup = cartEntries
      .filter(({ item }) => !item.designBatchId)
      .map(renderCartEntry)
      .join("");
    cartDrawerItems.innerHTML = groupedMarkup + unbatchedMarkup;
  } else {
    cartDrawerItems.innerHTML = cartEntries.map(renderCartEntry).join("");
  }

  if (giftingBagQuantity > 0) {
    cartDrawerItems.insertAdjacentHTML("beforeend", `
      <div class="cart-drawer-item gifting-bag-cart-item">
        <div class="cart-item-top">
          <div>
            <strong>🎁 Gifting bag × ${giftingBagQuantity}</strong>
            <p>S$0.50 each</p>
          </div>
          <strong class="cart-item-price">
            $${calculateGiftingBagTotal(giftingBagQuantity, GIFTING_BAG_PRICE).toFixed(2)}
          </strong>
        </div>
      </div>
    `);
  }
}

window.editCartItem = function(index) {
  selectedIndex = index;
  const item = names[index];
  if (!item) return;
  activeProduct = getItemProduct(item);

  closeCartDrawer();

  if (isReadyMadeProduct(activeProduct)) {
    openReadyMadeProduct(activeProduct.product_key, item);
    return;
  }

  if (activeProduct.product_key === PHOTO_PRODUCT_KEY) {
    const design = getDesign(item);
    photoKeepsakeLabel.value = item?.name || "";
    photoColourCount.value = String(design.photo?.colourCount || 4);
    photoSubjectType.value = design.photo?.subjectType || "person";
    photoKeepsakeQuantity.value = String(getItemQuantity(item));
    Object.assign(photoKeepsakeState, {
      originalPath: design.photo?.originalPath || "",
      artworkPath: design.photo?.artworkPath || "",
      artworkUrl: design.photo?.artworkUrl || "",
      generationId: design.photo?.generationId || "",
      filamentPalette: normalizePhotoFilamentPalette(
        design.photo?.filamentPalette || design.photo?.filament_palette
      )
    });
    if (design.photo?.artworkUrl) {
      photoArtworkResult.src = design.photo.artworkUrl;
      photoArtworkResult.classList.remove("hidden");
      photoResultPlaceholder.classList.add("hidden");
      photoResultActions.classList.remove("hidden");
      renderPhotoMappedPalette();
    }
    openPhotoKeepsakeStudio();
    return;
  }

  if (item.designBatchId && getActiveProductBatchGroups().length > 1) {
    orderType = "group";
    nameList.value = formatActiveProductNames();
    setOrderType("group");
    selectedIndex = names.findIndex(entry =>
      entry.product_key === item.product_key && entry.designBatchId === item.designBatchId
    );
    refreshUI();
    buildSelectedPreview();
    setStorefrontView("design", { scrollTo: "designArea" });
    return;
  }

  orderType = "single";
  singleName.value = item.name;
  singleQuantity.value = String(getItemQuantity(item));
  updateProductCustomiser();
  refreshUI();
  buildSelectedPreview();
  setStorefrontView("design", {
    scrollTo: "designArea"
  });
};

window.duplicateCartItem = async function(index) {
  const original = names[index];
  if (!original) return;
  activeProduct = getItemProduct(original);
  if (isReadyMadeProduct(activeProduct)) {
    const duplicate = JSON.parse(JSON.stringify(original));
    names.splice(index + 1, 0, duplicate);
    selectedIndex = index + 1;
    draftHasMeaningfulChanges = true;
    renderCartDrawer();
    refreshUI();
    saveDraft();
    return;
  }
  const newName = prompt("Name for the duplicated design:", original.name);
  if (newName === null) return;
  const cleanName = sanitizeName(newName);
  if (!cleanName) {
    alert("Please enter at least one supported letter, number or icon.");
    return;
  }

  const duplicate = JSON.parse(JSON.stringify(original));
  duplicate.name = cleanName;
  names.splice(index + 1, 0, duplicate);
  selectedIndex = index + 1;
  orderType = "group";
  nameList.value = formatActiveProductNames();
  setOrderType("group");
  draftHasMeaningfulChanges = true;

  closeCartDrawer();
  refreshUI();
  buildSelectedPreview();
  saveDraft();
  await syncSharedGroupOwnerBasket();
  setStorefrontView("design", { scrollTo: "designArea" });
};

window.removeCartItem = async function(index) {
  if (!cartHasItems) return;

  const itemName =
    names[index]?.name || "this keychain";

  const confirmed = confirm(
    `Remove ${itemName} from your cart?`
  );

  if (!confirmed) return;

  names.splice(index, 1);

  if (!names.some(item => item.cartAdded !== false)) {
    cartHasItems = false;
    selectedIndex = 0;
  } else if (selectedIndex >= names.length) {
    selectedIndex = names.length - 1;
  }

  if (orderType === "group") {
    nameList.value = formatActiveProductNames();
  }

  refreshUI();
  buildSelectedPreview();
  renderCartDrawer();
  await syncSharedGroupOwnerBasket();
};

function proceedToCheckout() {
  if (!cartHasItems || !getCartEntries().length) {
    return;
  }

  closeCartDrawer();

  designScreen.classList.add("hidden");
  checkoutScreen.classList.remove("hidden");
  paymentScreen.classList.add("hidden");
  hideStorefrontViews();

  refreshUI();
  validateForm();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

nextBtn.onclick = async () => {
  if (!names.length) {
    alert("Please enter at least one name.");
    return;
  }

  names.forEach(item => {
    if ((item.product_key || activeProduct.product_key) === activeProduct.product_key) {
      item.product_key = activeProduct.product_key;
      item.cartAdded = true;
    }
  });
  cartHasItems = true;
  draftHasMeaningfulChanges = true;

  updateCartDisplay();
  openCartDrawer();
  await syncSharedGroupOwnerBasket();
};

headerCartBtn.onclick = openCartDrawer;
sideCartBtn.onclick = openCartDrawer;

cartCloseBtn.onclick = closeCartDrawer;
cartOverlay.onclick = closeCartDrawer;
continueShoppingBtn.onclick = closeCartDrawer;
checkoutFromCartBtn.onclick = () => {
  if (activeSharedGroup && !activeSharedGroup.is_owner) {
    openSharedGroupCartAction();
    return;
  }
  proceedToCheckout();
};

function openSideMenu() {
  sideMenu.classList.add("open");
  menuOverlay.classList.remove("hidden");
  document.body.classList.add("menu-open");
}

function closeSideMenu() {
  sideMenu.classList.remove("open");
  menuOverlay.classList.add("hidden");
  document.body.classList.remove("menu-open");
}

menuOpenBtn.onclick = openSideMenu;
menuCloseBtn.onclick = closeSideMenu;
menuOverlay.onclick = closeSideMenu;

function hideStorefrontViews() {
  document
    .querySelectorAll("[data-store-view]")
    .forEach(section => section.classList.add("store-view-hidden"));
}

function setStorefrontView(view, options = {}) {
  const selectedView = ["shop", "design", "track"].includes(view)
    ? view
    : "shop";

  designScreen.classList.remove("hidden");
  checkoutScreen.classList.add("hidden");
  paymentScreen.classList.add("hidden");

  document
    .querySelectorAll("[data-store-view]")
    .forEach(section => {
      section.classList.toggle(
        "store-view-hidden",
        section.dataset.storeView !== selectedView
      );
    });

  document
    .querySelectorAll(".top-nav [data-view-target]")
    .forEach(tab => {
      tab.classList.toggle(
        "is-active",
        tab.dataset.viewTarget === selectedView
      );
    });

  closeSideMenu();
  closeCartDrawer();

  const scrollTarget = options.scrollTo
    ? document.getElementById(options.scrollTo)
    : null;

  requestAnimationFrame(() => {
    if (scrollTarget) {
      scrollTarget.scrollIntoView({
        behavior: options.instant ? "auto" : "smooth",
        block: "start"
      });
    } else if (options.scroll !== false) {
      window.scrollTo({
        top: 0,
        behavior: options.instant ? "auto" : "smooth"
      });
    }
  });
}

function updateProductCustomiser() {
  const isNormalKeychain =
    activeProduct.product_key === STANDARD_PRODUCT_KEY;
  const isSolidClicker =
    activeProduct.product_key === SOLID_PRODUCT_KEY;
  const isPencilClicker =
    activeProduct.product_key === PENCIL_PRODUCT_KEY;

  if (isSolidClicker) {
    globalDesign.bases = globalDesign.bases.slice(0, 1);
    names.forEach(item => {
      if ((item.product_key || activeProduct.product_key) !== activeProduct.product_key) return;
      if (item.custom?.bases?.length) {
        item.custom.bases = item.custom.bases.slice(0, 1);
      }
    });
  }

  if (isPencilClicker) {
    names.forEach(item => {
      if ((item.product_key || activeProduct.product_key) !== activeProduct.product_key) return;
      if (item.custom) {
        item.custom.pencil = normalizePencilDesign(item.custom.pencil || globalDesign.pencil);
      }
    });
  }

    if (designInspiration) {
  designInspiration.style.display =
    isNormalKeychain ? "none" : "";
}

    if (dimensionEstimate) {
  dimensionEstimate.style.display =
    "";
}

  document.body.classList.toggle(
    "standard-product-selected",
    isNormalKeychain
  );
  document.body.classList.toggle(
    "pencil-product-selected",
    isPencilClicker
  );

  document.getElementById("authorisedSellerRibbon")?.classList.toggle(
    "hidden",
    ![MODULAR_PRODUCT_KEY, SOLID_PRODUCT_KEY, PENCIL_PRODUCT_KEY].includes(activeProduct.product_key)
  );

  const standardOptions =
    document.getElementById("standardKeychainOptions");

  if (standardOptions) {
    standardOptions.style.display =
      isNormalKeychain ? "block" : "none";
  }

  const pencilOptions = document.getElementById("pencilClickerOptions");
  if (pencilOptions) {
    pencilOptions.style.display = isPencilClicker ? "block" : "none";
  }

  const pricingGuide = document.getElementById("productPricingGuide");
  const pricingGuideSummary = document.getElementById("productPricingGuideSummary");
  const pricingGuideBody = document.getElementById("productPricingGuideBody");
  if (pricingGuide) pricingGuide.hidden = activeProduct.product_key === PHOTO_PRODUCT_KEY;
  if (pricingGuideSummary) {
    pricingGuideSummary.textContent = `From ${displaySettingMoney(getProductDisplayPrice(activeProduct))}`;
  }
  if (pricingGuideBody) {
    pricingGuideBody.innerHTML = renderProductPricingGuideMarkup(activeProduct, { showHeading: false });
  }

  document
    .querySelectorAll(".clicky-only-option")
    .forEach(section => {
      section.style.display =
        isNormalKeychain ? "none" : "";
    });

  const baseShapeSection = document.getElementById("clickyBaseShapeSection");
  if (baseShapeSection) {
    baseShapeSection.style.display =
      isNormalKeychain || isSolidClicker || isPencilClicker ? "none" : "";
  }
  const orientationSection = document.getElementById("clickyOrientationSection");
  if (orientationSection) {
    orientationSection.style.display = isNormalKeychain || isPencilClicker ? "none" : "";
  }

  const baseHeading = document.getElementById("baseColourPartLabel");
  const letterHeading = document.getElementById("letterColourPartLabel");

  if (baseHeading) {
    baseHeading.textContent =
      isNormalKeychain
        ? "Background"
        : isPencilClicker
          ? "Pencil Blocks"
        : "Base";
  }

  if (letterHeading) {
    letterHeading.textContent =
      isNormalKeychain
        ? "Name"
        : isPencilClicker
          ? "Characters"
        : "Letter";
  }

  const capHeading = document.querySelector('[data-colour-part-tab="cap"] span');
  if (capHeading) capHeading.textContent = isPencilClicker ? "Clicker Tops" : "Cap";

  if (isNormalKeychain) {
    document.querySelector('[data-colour-part-tab="base"]')?.click();
  }

  const nameLimit = Math.max(
    1,
    getActiveProductCharacterLimit()
  );

  // Emoji icons can use more than one UTF-16 unit, so the input receives
  // extra room while updateNames enforces the real character count.
  singleName.maxLength = (isSolidClicker || isPencilClicker) ? nameLimit * 4 : nameLimit;
  nameList.maxLength = ((isSolidClicker || isPencilClicker) ? nameLimit * 4 : nameLimit) * 250;

  if (productCharacterLimitNotice) {
    productCharacterLimitNotice.hidden = !(isSolidClicker || isPencilClicker);
    productCharacterLimitNotice.textContent = isPencilClicker
      ? "One clicky block per letter, number or symbol. Maximum 10 blocks. Only the symbols shown below are available for this pencil."
      : isSolidClicker
        ? "Maximum 10 letters, numbers or icons. The compact base is made as one solid piece."
        : "";
  }

  if (randomColourOptions) randomColourOptions.style.display = "";

  if (randomColourOptionsSummary) {
    randomColourOptionsSummary.textContent = isSolidClicker
      ? "Optional: mix cap or letter colours"
      : "Optional: allow mixed colours across characters";
  }
  if (randomColourOptionsTitle) {
    randomColourOptionsTitle.textContent = isSolidClicker
      ? "Use more than one cap or letter/icon colour"
      : "Use more than one colour per part";
  }
  if (randomColourOptionsText) {
    randomColourOptionsText.textContent = isSolidClicker
      ? "The base stays one colour. Caps and letters/icons may alternate. Add-ons apply only if extra colours are used:"
      : "This may alternate base, cap and letter/icon colours. Add-ons apply only if extra colours are used:";
  }
  if (randomBaseColourFee) {
    randomBaseColourFee.hidden = isSolidClicker || Number(activeProduct.extra_base_colour_price || 0) <= 0;
    randomBaseColourFee.textContent = `+${displaySettingMoney(activeProduct.extra_base_colour_price)} per extra ${isPencilClicker ? "block" : "base"} colour,`;
  }
  if (randomCapColourFee) {
    randomCapColourFee.hidden = Number(activeProduct.extra_cap_colour_price || 0) <= 0;
    randomCapColourFee.textContent = `+${displaySettingMoney(activeProduct.extra_cap_colour_price)} per extra ${isPencilClicker ? "top" : "cap"} colour and`;
  }
  if (randomLetterColourFee) {
    randomLetterColourFee.hidden = Number(activeProduct.extra_letter_colour_price || 0) <= 0;
    randomLetterColourFee.textContent = `+${displaySettingMoney(activeProduct.extra_letter_colour_price)} per extra ${isPencilClicker ? "character" : "letter/icon"} colour.`;
  }

  updatePencilControls();
  renderIconPicker();

  updateNames();
}

function beginProductDesign(productKey) {
  const nextProduct = getProductByKey(productCatalog, productKey);
  const previousProductKey = activeProduct.product_key;

  names.forEach(item => {
    if (!item.product_key) item.product_key = previousProductKey;
    if (!item.custom) {
      item.custom = {
        baseShape: globalDesign.baseShape || "ribbed",
        letterOrientation: globalDesign.letterOrientation || "vertical",
        fontSize: getStandardFontSize(globalDesign),
        nfcEnabled: Boolean(globalDesign.nfcEnabled),
        nfcType: globalDesign.nfcType || "guardian",
        nfcPayload: globalDesign.nfcPayload || "",
        photo: globalDesign.photo || null,
        pencil: normalizePencilDesign(globalDesign.pencil),
        bases: [...globalDesign.bases],
        caps: [...globalDesign.caps],
        letters: [...globalDesign.letters]
      };
    }
    if (cartHasItems && item.cartAdded !== false) item.cartAdded = true;
  });
  names = cartHasItems
    ? names.filter(item => item.cartAdded !== false)
    : [];

  activeProduct = nextProduct;
  orderType = "single";
  singleBtn.classList.add("active");
  groupBtn.classList.remove("active");
  singleSection.classList.remove("hidden");
  groupSection.classList.add("hidden");
  singleName.value = "Alicia";
  singleQuantity.value = "1";
  names.push({
    name: "Alicia",
    quantity: 1,
    product_key: activeProduct.product_key,
    cartAdded: false,
    groupContributorName: null,
    custom: null
  });
  selectedIndex = names.length - 1;

  if (activeProduct.product_key === PENCIL_PRODUCT_KEY) {
    applyClassicPencilDefaults();
  }
  updateProductCustomiser();
}

function resetPhotoArtworkResult() {
  photoKeepsakeState.originalPath = "";
  photoKeepsakeState.artworkPath = "";
  photoKeepsakeState.artworkUrl = "";
  photoKeepsakeState.generationId = "";
  photoKeepsakeState.filamentPalette = [];
  photoArtworkResult?.classList.add("hidden");
  photoArtworkResult?.removeAttribute("src");
  photoResultActions?.classList.add("hidden");
  photoResultPlaceholder?.classList.remove("hidden");
  photoMappedPalette?.classList.add("hidden");
  photoGenerationLoader?.classList.add("hidden");
  if (photoMappedPalette) photoMappedPalette.innerHTML = "";
}

function getAvailablePhotoFilamentPalette() {
  return normalizePhotoFilamentPalette(colours
    .filter(item => item.available)
    .map(item => ({
      name: item.name,
      hex: item.colour,
      material_type: item.materialType
    })));
}

function renderPhotoMappedPalette(palette = photoKeepsakeState.filamentPalette) {
  if (!photoMappedPalette) return;
  const normalized = normalizePhotoFilamentPalette(palette);
  photoMappedPalette.classList.toggle("hidden", !normalized.length);
  photoMappedPalette.innerHTML = normalized.length ? `
    <strong>Your finished keychain colours</strong>
    <div>${normalized.map(item => `
      <span><i style="background:${item.hex}"></i>${escapePresetText(item.name)}</span>
    `).join("")}</div>
    <small>The preview and finished print use these exact colour choices. Screen colours may look slightly different in person.</small>
  ` : "";
}

async function mapPhotoPreviewToAvailableFilaments(artworkUrl, colourCount, palette) {
  const response = await fetch(artworkUrl);
  if (!response.ok) throw new Error("The generated preview could not be colour-matched.");
  const bitmap = await createImageBitmap(await response.blob());
  const maxSide = 120;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(8, Math.round(bitmap.width * scale));
  canvas.height = Math.max(8, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const centres = getArtworkColourClusters(pixels, colourCount);
  return mapArtworkClustersToFilaments(centres, palette);
}

async function recolourPhotoPreview(artworkUrl, filamentPalette) {
  const palette = normalizePhotoFilamentPalette(filamentPalette).map(item => ({
    ...item,
    rgb: [
      Number.parseInt(item.hex.slice(1, 3), 16),
      Number.parseInt(item.hex.slice(3, 5), 16),
      Number.parseInt(item.hex.slice(5, 7), 16)
    ]
  }));
  if (!palette.length) throw new Error("The selected print colours could not be applied.");

  const response = await fetch(artworkUrl);
  if (!response.ok) throw new Error("The generated preview could not be prepared.");
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const image = context.getImageData(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < image.data.length; index += 4) {
    if (image.data[index + 3] < 24) continue;
    let closest = palette[0];
    let closestDistance = Infinity;
    palette.forEach(option => {
      const red = image.data[index] - option.rgb[0];
      const green = image.data[index + 1] - option.rgb[1];
      const blue = image.data[index + 2] - option.rgb[2];
      const distance = red * red + green * green + blue * blue;
      if (distance < closestDistance) {
        closest = option;
        closestDistance = distance;
      }
    });
    image.data[index] = closest.rgb[0];
    image.data[index + 1] = closest.rgb[1];
    image.data[index + 2] = closest.rgb[2];
  }

  context.putImageData(image, 0, 0);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The exact print-colour preview could not be saved.");
  return blob;
}

function formatPhotoRetryTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  if (safeSeconds <= 90) return "about 1 minute";
  if (safeSeconds < 3600) return `about ${Math.ceil(safeSeconds / 60)} minutes`;
  const hours = Math.ceil(safeSeconds / 3600);
  return `about ${hours} hour${hours === 1 ? "" : "s"}`;
}

function updatePhotoAttemptStatus(details = {}) {
  if (!photoAttemptStatus) return;
  const remaining = Number(details.attempts_remaining);
  if (!Number.isFinite(remaining)) {
    photoAttemptStatus.textContent = "Up to 5 previews per hour";
    return;
  }
  if (remaining <= 0) {
    const retrySeconds = Number(details.retry_after_seconds) || Math.max(
      60,
      Math.ceil((new Date(details.retry_at || Date.now()).getTime() - Date.now()) / 1000)
    );
    photoAttemptStatus.textContent = `0 of 5 previews left · try again in ${formatPhotoRetryTime(retrySeconds)}`;
    photoRetryAvailableAt = Date.now() + retrySeconds * 1000;
    generatePhotoArtworkBtn.disabled = true;
    regeneratePhotoArtworkBtn.disabled = true;
    clearTimeout(photoRetryTimer);
    photoRetryTimer = setTimeout(() => {
      photoRetryAvailableAt = 0;
      generatePhotoArtworkBtn.disabled = false;
      regeneratePhotoArtworkBtn.disabled = false;
      updatePhotoAttemptStatus();
    }, Math.min(retrySeconds * 1000 + 500, 2147483647));
    return;
  }
  photoRetryAvailableAt = 0;
  photoAttemptStatus.textContent = `${remaining} of 5 previews left this hour`;
}

async function getPhotoFunctionErrorDetails(error) {
  try {
    const response = error?.context;
    if (response?.clone) return await response.clone().json();
  } catch {
    // Use the normal error message below when the response body is unavailable.
  }
  return {};
}

function openPhotoKeepsakeStudio() {
  activeProduct = getProductByKey(productCatalog, PHOTO_PRODUCT_KEY);
  photoKeepsakeModal?.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closePhotoKeepsakeStudio() {
  photoKeepsakeModal?.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

async function preparePhotoForAi(file) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPG, PNG or WebP photo.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("This photo is larger than 8 MB. Please choose a smaller file.");
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("This photo could not be read."));
      element.src = objectUrl;
    });
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d", { alpha: false }).drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", .9);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function generatePhotoKeepsakeArtwork() {
  if (!photoKeepsakeState.file) {
    photoGenerationStatus.textContent = "Upload one clear photo first.";
    return;
  }
  if (!photoPermissionCheck.checked || !photoAiConsentCheck.checked) {
    photoGenerationStatus.textContent = "Please confirm photo permission and AI processing first.";
    return;
  }

  generatePhotoArtworkBtn.disabled = true;
  regeneratePhotoArtworkBtn.disabled = true;
  photoGenerationStatus.textContent = "Please keep this page open while your artwork is created.";
  photoGenerationLoader?.classList.remove("hidden");
  photoResultPlaceholder?.classList.add("hidden");
  photoArtworkResult?.classList.add("hidden");
  photoResultActions?.classList.add("hidden");
  photoMappedPalette?.classList.add("hidden");

  try {
    const imageDataUrl = photoKeepsakeState.inputDataUrl || await preparePhotoForAi(photoKeepsakeState.file);
    photoKeepsakeState.inputDataUrl = imageDataUrl;
    const availableFilamentPalette = getAvailablePhotoFilamentPalette();
    if (availableFilamentPalette.length < 2) {
      throw new Error("At least two in-stock filament colours are needed for a photo keepsake.");
    }
    const { data, error } = await supabase.functions.invoke("generate-photo-keepsake", {
      body: {
        image_data_url: imageDataUrl,
        subject_type: photoSubjectType.value,
        colour_count: Number(photoColourCount.value),
        variant: "classic",
        filament_palette: availableFilamentPalette,
        client_token: currentSubmissionId
      }
    });
    if (error) {
      const details = await getPhotoFunctionErrorDetails(error);
      updatePhotoAttemptStatus(details);
      const friendlyError = new Error(details.error || error.message || "The preview could not be created.");
      friendlyError.details = details;
      throw friendlyError;
    }
    if (!data?.artwork_url || !data?.artwork_path) {
      throw new Error(data?.error || "The artwork service did not return a preview.");
    }
    updatePhotoAttemptStatus(data);

    const filamentPalette = await mapPhotoPreviewToAvailableFilaments(
      data.artwork_url,
      Number(photoColourCount.value),
      availableFilamentPalette
    );
    const exactColourArtwork = await recolourPhotoPreview(
      data.artwork_url,
      filamentPalette
    );
    if (!data.recolour_token) {
      throw new Error("The exact print-colour preview could not be saved. Please try again.");
    }
    const { error: recolourError } = await supabase.storage
      .from("customer-artwork")
      .uploadToSignedUrl(
        data.artwork_path,
        data.recolour_token,
        exactColourArtwork,
        { contentType: "image/png", upsert: true }
      );
    if (recolourError) throw recolourError;
    const exactArtworkUrl = new URL(data.artwork_url);
    exactArtworkUrl.searchParams.set("preview", String(Date.now()));
    Object.assign(photoKeepsakeState, {
      originalPath: data.original_path || "",
      artworkPath: data.artwork_path,
      artworkUrl: exactArtworkUrl.toString(),
      generationId: data.generation_id || "",
      filamentPalette
    });
    photoArtworkResult.src = exactArtworkUrl.toString();
    photoArtworkResult.classList.remove("hidden");
    photoResultPlaceholder.classList.add("hidden");
    photoResultActions.classList.remove("hidden");
    renderPhotoMappedPalette(filamentPalette);
    photoGenerationStatus.textContent = "Preview ready in the exact colours available for your keychain.";
  } catch (error) {
    console.error("Unable to generate photo keepsake artwork:", error);
    photoGenerationStatus.textContent =
      error?.details?.error || error?.message ||
      "The AI studio is not configured yet. Please try again later.";
    if (photoKeepsakeState.artworkUrl) {
      photoArtworkResult?.classList.remove("hidden");
      photoResultActions?.classList.remove("hidden");
      renderPhotoMappedPalette();
    } else {
      photoResultPlaceholder?.classList.remove("hidden");
    }
  } finally {
    photoGenerationLoader?.classList.add("hidden");
    const rateLimited = photoRetryAvailableAt > Date.now();
    generatePhotoArtworkBtn.disabled = rateLimited;
    regeneratePhotoArtworkBtn.disabled = rateLimited;
  }
}

function safePhotoTestFileName(value, fallback = "photo") {
  const cleaned = String(value || "")
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

function downloadPhotoTestBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function downloadPhotoTestStlPack() {
  if (!isProductPreview || !photoKeepsakeState.artworkUrl) return;
  const previousLabel = downloadPhotoTestStlsBtn?.textContent || "Download Test STL Pack";
  if (downloadPhotoTestStlsBtn) {
    downloadPhotoTestStlsBtn.disabled = true;
    downloadPhotoTestStlsBtn.textContent = "Building Test STLs…";
  }

  try {
    const palette = normalizePhotoFilamentPalette(photoKeepsakeState.filamentPalette);
    const parts = await preparePhotoArtworkStlParts(
      photoKeepsakeState.artworkUrl,
      Number(photoColourCount.value || 4),
      palette
    );
    const label = safePhotoTestFileName(photoKeepsakeLabel.value, "Photo-Keepsake");
    const backingFilament = parts.mappedPalette[parts.backingPaletteIndex] || parts.mappedPalette[0];
    const files = [{
      blob: exportPhotoGeometryStl(parts.backing),
      filename: `TEST_${label}_00-BACKING_${safePhotoTestFileName(backingFilament.name, "filament")}_${backingFilament.material_type}_1.6mm_0.4MM-NOZZLE.stl`
    }];
    parts.colours.forEach((geometry, index) => {
      if (!geometry) return;
      const filament = parts.mappedPalette[index];
      files.push({
        blob: exportPhotoGeometryStl(geometry),
        filename:
          `TEST_${label}_${String(index + 1).padStart(2, "0")}-` +
          `${safePhotoTestFileName(filament.name, "filament")}_${filament.material_type}_${filament.hex.slice(1)}_0.4MM-NOZZLE.stl`
      });
    });
    files.forEach((file, index) => {
      setTimeout(() => downloadPhotoTestBlob(file.blob, file.filename), index * 350);
    });
    parts.backing?.dispose();
    parts.colours.forEach(geometry => geometry?.dispose());
    photoGenerationStatus.textContent =
      `Downloaded ${files.length} test STLs at approximately ${parts.widthMm.toFixed(1)} × ${parts.heightMm.toFixed(1)} mm. Import them together without moving their positions.`;
    if (downloadPhotoTestStlsBtn) downloadPhotoTestStlsBtn.textContent = "Downloaded ✓";
  } catch (error) {
    console.error("Unable to build private preview STL files:", error);
    photoGenerationStatus.textContent = error?.message || "The test STL pack could not be created.";
  } finally {
    if (downloadPhotoTestStlsBtn) {
      downloadPhotoTestStlsBtn.disabled = false;
      setTimeout(() => { downloadPhotoTestStlsBtn.textContent = previousLabel; }, 2500);
    }
  }
}

function addPhotoKeepsakeToCart() {
  if (!photoKeepsakeState.artworkPath || !photoKeepsakeState.artworkUrl) return;
  const label = photoKeepsakeLabel.value.trim() ||
    (photoSubjectType.value === "pet" ? "Pet Photo" : "Photo Keepsake");
  const fallbackColours = getAvailableColours();
  names = names.filter(item => cartHasItems && item.cartAdded !== false);
  names.push({
    name: label,
    quantity: normalizeItemQuantity(photoKeepsakeQuantity?.value),
    product_key: PHOTO_PRODUCT_KEY,
    cartAdded: true,
    groupContributorName: null,
    custom: {
      baseShape: "photo",
      letterOrientation: "vertical",
      fontSize: 24,
      bases: [fallbackColours[0] || "#F55A74"],
      caps: [fallbackColours[1] || fallbackColours[0] || "#FFFFFF"],
      letters: [fallbackColours[2] || "#FFFFFF"],
      photo: {
        originalPath: photoKeepsakeState.originalPath,
        artworkPath: photoKeepsakeState.artworkPath,
        artworkUrl: photoKeepsakeState.artworkUrl,
        generationId: photoKeepsakeState.generationId,
        subjectType: photoSubjectType.value,
        colourCount: Number(photoColourCount.value),
        variant: "classic",
        filamentPalette: normalizePhotoFilamentPalette(photoKeepsakeState.filamentPalette)
      }
    }
  });
  selectedIndex = names.length - 1;
  orderType = "single";
  cartHasItems = true;
  draftHasMeaningfulChanges = true;
  closePhotoKeepsakeStudio();
  refreshUI();
  renderCartDrawer();
  openCartDrawer();
}

function isSecureWebUrl(value) {
  try {
    return new URL(String(value || "").trim()).protocol === "https:";
  } catch {
    return false;
  }
}

function closeReadyMadeProduct() {
  readyMadeProductModal?.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function openReadyMadeProduct(productKey, existingItem = null) {
  const product = productCatalog.find(item => item.product_key === productKey);
  if (!product || !isReadyMadeProduct(product) || !readyMadeProductModalContent) return;
  const options = normalizeProductOptions(product.options);
  const previousSelections = existingItem?.custom?.readyMade?.selections || {};
  readyMadeProductModalContent.innerHTML = `
    <div class="ready-made-product-layout">
      <div class="ready-made-product-image">
        ${product.image_path ? `<img src="${escapePresetText(product.image_path)}" alt="${escapePresetText(product.name)}">` : ""}
      </div>
      <div class="ready-made-product-details">
        <p class="section-eyebrow">${escapePresetText(product.eyebrow || "Ready-made collection")}</p>
        <h2 id="readyMadeProductTitle">${escapePresetText(product.name)}</h2>
        <p>${escapePresetText(product.description || "A small-batch Little Keeps design.")}</p>
        <strong class="ready-made-product-price">${displaySettingMoney(getProductDisplayPrice(product))}</strong>
        <div class="ready-made-product-options">
          ${options.map((option, index) => `
            <label><span>${escapePresetText(option.name)}</span><select data-ready-option="${escapePresetText(option.name)}">
              ${option.values.map(value => `<option value="${escapePresetText(value)}" ${previousSelections[option.name] === value ? "selected" : ""}>${escapePresetText(value)}</option>`).join("")}
            </select></label>
          `).join("")}
          <label><span>Quantity</span><input id="readyMadeQuantity" type="number" min="1" max="${Math.max(1, Number(product.stock_quantity) || 1)}" value="${getItemQuantity(existingItem || {})}"></label>
        </div>
        <p class="ready-made-stock-note">${Number(product.stock_quantity)} available</p>
        <button id="addReadyMadeToCartBtn" class="submit-btn" type="button">${existingItem ? "Update cart" : "Add to cart"}</button>
      </div>
    </div>
  `;
  document.getElementById("addReadyMadeToCartBtn")?.addEventListener("click", () => {
    const selections = Object.fromEntries(Array.from(readyMadeProductModalContent.querySelectorAll("[data-ready-option]")).map(select => [select.dataset.readyOption, select.value]));
    const quantity = Math.min(Number(product.stock_quantity), normalizeItemQuantity(document.getElementById("readyMadeQuantity")?.value));
    const design = {
      baseShape: "ready-made", letterOrientation: "vertical", fontSize: 0,
      bases: ["#FFFFFF"], caps: ["#FFFFFF"], letters: ["#332D30"],
      readyMade: { selections, imagePath: product.image_path || "", sku: product.sku || "" }
    };
    if (existingItem) {
      existingItem.quantity = quantity;
      existingItem.custom = design;
    } else {
      names = names.filter(item => cartHasItems && item.cartAdded !== false);
      names.push({ name: product.name, quantity, product_key: product.product_key, cartAdded: true, custom: design });
      selectedIndex = names.length - 1;
    }
    cartHasItems = true;
    draftHasMeaningfulChanges = true;
    closeReadyMadeProduct();
    refreshUI();
    renderCartDrawer();
    openCartDrawer();
  });
  readyMadeProductModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

document.querySelectorAll("[data-ready-product]").forEach(button => {
  button.addEventListener("click", () => openReadyMadeProduct(button.dataset.readyProduct));
});
closeReadyMadeProductModal?.addEventListener("click", closeReadyMadeProduct);
readyMadeProductModal?.addEventListener("click", event => {
  if (event.target === readyMadeProductModal) closeReadyMadeProduct();
});

document.querySelectorAll("[data-photo-product-start]").forEach(button => {
  button.addEventListener("click", openPhotoKeepsakeStudio);
});
closePhotoKeepsakeModal?.addEventListener("click", closePhotoKeepsakeStudio);
photoKeepsakeModal?.addEventListener("click", event => {
  if (event.target === photoKeepsakeModal) closePhotoKeepsakeStudio();
});
photoKeepsakeInput?.addEventListener("change", async () => {
  const file = photoKeepsakeInput.files?.[0];
  if (!file) return;
  try {
    const dataUrl = await preparePhotoForAi(file);
    photoKeepsakeState.file = file;
    photoKeepsakeState.inputDataUrl = dataUrl;
    photoOriginalPreview.src = dataUrl;
    photoOriginalPreview.classList.remove("hidden");
    resetPhotoArtworkResult();
    photoGenerationStatus.textContent = "Photo ready. Choose the options, then create your artwork.";
    void checkPhotoSuitability(dataUrl);
  } catch (error) {
    photoGenerationStatus.textContent = error.message;
    photoKeepsakeInput.value = "";
  }
});
generatePhotoArtworkBtn?.addEventListener("click", generatePhotoKeepsakeArtwork);
regeneratePhotoArtworkBtn?.addEventListener("click", generatePhotoKeepsakeArtwork);
addPhotoArtworkToCartBtn?.addEventListener("click", addPhotoKeepsakeToCart);
downloadPhotoTestStlsBtn?.addEventListener("click", downloadPhotoTestStlPack);
aiDesignHelperBtn?.addEventListener("click", requestAiDesignSuggestions);
aiDesignBrief?.addEventListener("keydown", event => {
  if (event.key === "Enter") requestAiDesignSuggestions();
});
aiDesignSuggestions?.addEventListener("click", event => {
  const button = event.target.closest("[data-ai-design-index]");
  if (button) applyAiDesignSuggestion(button.dataset.aiDesignIndex);
});
refreshAvailabilityBtn?.addEventListener("click", async () => {
  const previous = refreshAvailabilityBtn.textContent;
  refreshAvailabilityBtn.disabled = true;
  refreshAvailabilityBtn.textContent = "Refreshing…";
  await setupNeededByCalendar();
  refreshAvailabilityBtn.textContent = "Availability updated ✓";
  setTimeout(() => {
    refreshAvailabilityBtn.disabled = false;
    refreshAvailabilityBtn.textContent = previous;
  }, 1400);
});

document
  .querySelectorAll("[data-view-target]")
  .forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();

      const productKey = button.dataset.productKey;

      if (productKey) {
        beginProductDesign(productKey);
      }

      setStorefrontView(button.dataset.viewTarget, {
        scrollTo: button.dataset.viewScroll || null
      });
    });
  });

setStorefrontView("shop", {
  instant: true,
  scroll: false
});

if (isProductPreview && previewProduct) {
  activeProduct = getProductByKey(productCatalog, previewProduct.product_key);
  if (activeProduct.product_key === PHOTO_PRODUCT_KEY) {
    openPhotoKeepsakeStudio();
  } else {
    if (activeProduct.product_key === PENCIL_PRODUCT_KEY) applyClassicPencilDefaults();
    updateProductCustomiser();
    setStorefrontView("design", { instant: true, scroll: false });
  }
}

const PENDING_ORDER_STORAGE_KEY = "littleKeepsPendingOrder";
let pendingOrderExpiryTimer = null;

function getRememberedPendingOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(PENDING_ORDER_STORAGE_KEY) || "null");
    if (!saved?.orderRef || !saved?.email) return null;

    const savedAt = new Date(saved.savedAt || 0).getTime();
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > 30 * 86400000) {
      localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
      return null;
    }

    return saved;
  } catch {
    localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
    return null;
  }
}

function rememberPendingOrder(details) {
  localStorage.setItem(PENDING_ORDER_STORAGE_KEY, JSON.stringify({
    ...details,
    savedAt: new Date().toISOString()
  }));
  sessionStorage.removeItem("littleKeepsPendingOrderDismissed");
  renderPendingOrderBanner();
}

function clearRememberedPendingOrder(orderRef = "") {
  const saved = getRememberedPendingOrder();
  if (orderRef && saved?.orderRef !== orderRef) return;
  clearTimeout(pendingOrderExpiryTimer);
  pendingOrderExpiryTimer = null;
  localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
  sessionStorage.removeItem("littleKeepsPendingOrderDismissed");
  pendingOrderBanner?.classList.add("hidden");
}

function scheduleRememberedOrderExpiry(order, saved) {
  clearTimeout(pendingOrderExpiryTimer);
  pendingOrderExpiryTimer = null;
  if (!order?.payment_expires_at) return;

  const remaining = new Date(order.payment_expires_at).getTime() - Date.now();
  if (!Number.isFinite(remaining)) return;
  if (remaining <= 0) {
    clearRememberedPendingOrder(saved.orderRef);
    return;
  }

  pendingOrderExpiryTimer = setTimeout(
    () => {
      if (new Date(order.payment_expires_at).getTime() <= Date.now()) {
        clearRememberedPendingOrder(saved.orderRef);
      } else {
        scheduleRememberedOrderExpiry(order, saved);
      }
    },
    Math.min(remaining + 250, 2147483647)
  );
}

async function refreshRememberedPendingOrderState() {
  const saved = getRememberedPendingOrder();
  if (!saved) {
    pendingOrderBanner?.classList.add("hidden");
    return;
  }

  try {
    const { data, error } = await supabase.rpc("lookup_order_status", {
      p_order_ref: saved.orderRef,
      p_email: saved.email
    });
    if (error) throw error;
    const order = Array.isArray(data) ? data[0] : data;
    if (!order) return;

    if (isOrderReminderFinishedOrExpired(order)) {
      clearRememberedPendingOrder(saved.orderRef);
      return;
    }
    scheduleRememberedOrderExpiry(order, saved);
  } catch (error) {
    // Keep the reminder during a temporary connection problem and try again
    // when the customer returns to the tab.
    console.warn("Unable to refresh unfinished order reminder:", error);
  }
}

function renderPendingOrderBanner() {
  const saved = getRememberedPendingOrder();
  const dismissed = sessionStorage.getItem("littleKeepsPendingOrderDismissed") === "true";

  if (!saved || dismissed || isManualOrder) {
    pendingOrderBanner?.classList.add("hidden");
    return;
  }

  const needsReview = ["rush", "bulk"].includes(saved.orderType) && !saved.approved;
  pendingOrderBannerRef.textContent = saved.orderRef;
  pendingOrderBannerText.textContent = needsReview
    ? "Your request is saved. View it here for quote and payment updates."
    : "Your order is saved, but payment is not complete.";
  resumePendingOrderBtn.textContent = needsReview ? "View Request" : "Continue Payment";
  pendingOrderBanner.classList.remove("hidden");
}

function openRememberedOrder() {
  const saved = getRememberedPendingOrder();
  if (!saved) return;

  statusOrderRef.value = saved.orderRef;
  statusCustomerEmail.value = saved.email;
  setStorefrontView("track", {
    scrollTo: "orderStatusSection"
  });

  setTimeout(() => orderStatusForm?.requestSubmit(), 450);
}

resumePendingOrderBtn?.addEventListener("click", openRememberedOrder);
dismissPendingOrderBtn?.addEventListener("click", () => {
  sessionStorage.setItem("littleKeepsPendingOrderDismissed", "true");
  pendingOrderBanner.classList.add("hidden");
});

async function requestOrderSavedEmail(orderRef, email, linkedOrderRef = null) {
  try {
    const { data, error } = await supabase.functions.invoke("send-order-saved-email", {
      body: {
        order_ref: orderRef,
        email,
        linked_order_ref: linkedOrderRef
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return data?.ok === true;
  } catch (error) {
    console.warn("Order reference email was not sent:", error);
    return false;
  }
}

async function requestSpecialOrderTelegramAlert(orderRef, email) {
  try {
    const { data, error } = await supabase.functions.invoke("telegram-new-order", {
      body: {
        order_ref: orderRef,
        email,
        source: "website-review-request"
      }
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data?.ok === true;
  } catch (error) {
    console.warn("Special-order Telegram alert was not sent:", error);
    return false;
  }
}

async function requestPickupTimingTelegramAlert(orderRef, email) {
  try {
    const { data, error } = await supabase.functions.invoke("telegram-new-order", {
      body: {
        order_ref: orderRef,
        email,
        source: "pickup-timing-selected"
      }
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data?.ok === true;
  } catch (error) {
    console.warn("Pickup-timing Telegram alert was not sent:", error);
    return false;
  }
}

async function sendLinkedOrderConfirmationEmail(order, internalRef, rootRef, latestDate) {
  if (!shopSettings.status_emails_enabled) return false;
  const templateId = String(shopSettings.status_email_template_id || "").trim();
  if (!templateId || !order.customer_email) return false;

  try {
    await emailjs.send(EMAILJS_SERVICE, templateId, {
      to_email: order.customer_email,
      customer_name: order.customer_name || "Customer",
      order_ref: rootRef,
      update_title: "Your add-on has been linked! 🩷",
      update_message: `Your new add-on (${internalRef}) is now linked to ${rootRef}.`,
      action_title: "One combined order",
      action_details: `Both parts will follow the later pickup or dispatch date: ${formatEstimateDate(latestDate)}.`,
      action_button_label: "View Your Order",
      action_url: `https://little-keeps.vercel.app/?resume_order=${encodeURIComponent(rootRef)}#orderStatusSection`,
      has_tracking: false,
      tracking_number: "",
      tracking_url: "",
      courier_name: "",
      collection_method: collectionMethod.options[collectionMethod.selectedIndex]?.text || collectionMethod.value,
      needed_by: formatEstimateDate(latestDate)
    });
    return true;
  } catch (error) {
    console.warn("Linked-order confirmation email was not sent:", error);
    return false;
  }
}

async function retryRememberedOrderEmail() {
  const saved = getRememberedPendingOrder();
  const needsReview =
    ["rush", "bulk"].includes(saved?.orderType) && !saved?.approved;

  if (!saved || needsReview || isManualOrder) return;
  await requestOrderSavedEmail(saved.orderRef, saved.email);
}

startDesignBtn.onclick = () => {
  setStorefrontView("shop", {
    scrollTo: "productsSection"
  });
};

singleName.addEventListener("input", updateNames);
singleQuantity?.addEventListener("input", () => {
  if (singleQuantity.value === "") return;
  singleQuantity.value = String(normalizeItemQuantity(singleQuantity.value));
  updateNames();
});
singleQuantity?.addEventListener("change", () => {
  singleQuantity.value = String(normalizeItemQuantity(singleQuantity.value));
  updateNames();
});

customerName.addEventListener(
    "input",
    validateForm
);

customerEmail.addEventListener("input", () => {
  if (verifiedLinkedOrder &&
      verifiedLinkedOrder.email !== customerEmail.value.trim().toLowerCase()) {
    resetLinkedOrderVerification("Email changed — verify the original order again.");
  }
  validateForm();
});

customerPhone.addEventListener(
    "input",
    validateForm
);


collectionMethod.addEventListener("change", () => {
  const isDelivery =
    collectionMethod.value === "delivery";

  deliveryAddressSection.classList.toggle(
    "hidden",
    !isDelivery
  );

  if (!isDelivery) {
    deliveryAddressLine1.value = "";
    deliveryAddressLine2.value = "";
    deliveryPostalCode.value = "";
    resetDeliveryAddressVerification();
  }

  updateCollectionNote();
  updateTurnaroundMessaging();
  refreshUI();
  validateForm();
});

checkoutPickupTime?.addEventListener("change", () => {
  checkoutPickupStatus.textContent = checkoutPickupTime.value
    ? "Pickup slot selected ✓"
    : "Please choose a pickup time.";
  draftHasMeaningfulChanges = true;
  validateForm();
});

function setGiftingBagQuantity(value) {
  giftingBagQuantity = Math.min(
    Math.max(0, Math.floor(Number(value) || 0)),
    getMaxGiftingBagQuantity()
  );
  draftHasMeaningfulChanges = true;
  updateGiftingBagOptions();
  updateCartDisplay();
  renderReviewOrder();
  saveDraft();
}

giftingBagQuantityInput?.addEventListener("change", () => {
  setGiftingBagQuantity(giftingBagQuantityInput.value);
});

giftingBagDecrease?.addEventListener("click", () => {
  setGiftingBagQuantity(giftingBagQuantity - 1);
});

giftingBagIncrease?.addEventListener("click", () => {
  setGiftingBagQuantity(giftingBagQuantity + 1);
});

linkExistingOrderToggle.addEventListener("change", () => {
  linkExistingOrderPanel.classList.toggle("hidden", !linkExistingOrderToggle.checked);
  if (!linkExistingOrderToggle.checked) {
    resetLinkedOrderVerification();
    collectionMethod.dispatchEvent(new Event("change"));
  }
  draftHasMeaningfulChanges = true;
  validateForm();
});

verifyExistingOrderBtn.addEventListener("click", verifyExistingOrderLink);
existingOrderRef.addEventListener("input", () => {
  existingOrderRef.value = existingOrderRef.value.toUpperCase();
  if (verifiedLinkedOrder && verifiedLinkedOrder.orderRef !== existingOrderRef.value.trim()) {
    resetLinkedOrderVerification("Order ID changed — verify it again.");
  }
  draftHasMeaningfulChanges = true;
  validateForm();
});

rushOrderToggle.addEventListener("change", () => {
  if (!rushOrderToggle.checked && getTotalKeychainQuantity() < bulkOrderQuantity) {
    requestedCompletionDate.value = "";
    specialDateCalendar?.clear();
  }
  rushAssessment = null;
  rushAssessmentFingerprint = "";
  updateTurnaroundMessaging();
  validateForm();
});

deliveryAddressLine1.addEventListener(
  "input",
  () => {
    confirmDeliveryAddress.checked = false;
    renderDeliveryAddressConfirmation();
    validateForm();
  }
);

deliveryAddressLine2.addEventListener(
  "input",
  () => {
    confirmDeliveryAddress.checked = false;
    renderDeliveryAddressConfirmation();
    validateForm();
  }
);

deliveryPostalCode.addEventListener(
  "input",
  () => {
    const postalCode = deliveryPostalCode.value.replace(/\D/g, "").slice(0, 6);
    deliveryPostalCode.value = postalCode;

    if (postalCode !== deliveryAddressVerifiedPostal) {
      resetDeliveryAddressVerification();
    }

    validateForm();
  }
);

confirmDeliveryAddress.addEventListener("change", validateForm);
confirmFinalOrderDetails?.addEventListener("change", validateForm);

nameList.addEventListener("input", updateNames);

applyAllToggle.addEventListener("change", () => {
  refreshUI();
  buildSelectedPreview();
});

resetSelected.onclick = () => {
  if (randomiseMultipleColours) randomiseMultipleColours.checked = false;
  if (randomiseColoursStatus) randomiseColoursStatus.textContent = "";
  if (names[selectedIndex]) {
    const batches = getActiveProductBatchGroups();
    const selectedBatch = batches.find(batch =>
      batch.entries.some(({ index }) => index === selectedIndex)
    );
    if (batches.length > 1 && selectedBatch) {
      const sharedDefault = cloneCustomDesign(globalDesign);
      selectedBatch.entries.forEach(({ item }) => { item.custom = sharedDefault; });
    } else {
      names[selectedIndex].custom = null;
    }
    refreshUI();
    buildSelectedPreview();
  }
};

randomiseColoursBtn?.addEventListener("click", randomiseArticulatedColours);
randomiseBaseColoursBtn?.addEventListener("click", () => randomiseColourPart("base"));
randomiseCapColoursBtn?.addEventListener("click", () => randomiseColourPart("cap"));
randomiseLetterColoursBtn?.addEventListener("click", () => randomiseColourPart("letter"));
randomiseMultipleColours?.addEventListener("change", () => {
  draftHasMeaningfulChanges = true;
  if (randomiseColoursStatus) randomiseColoursStatus.textContent = "";
  saveDraft();
});

copyManualPaymentLinkBtn?.addEventListener("click", async () => {
  const url = manualPaymentLink?.href || "";
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    manualPaymentLinkStatus.textContent = "Payment-request link copied ✓";
  } catch {
    window.prompt("Copy this payment-request link:", url);
  }
});

submitOrderBtn.onclick = event => {
  event.preventDefault();
  void submitOrder();
};

applyPromoBtn.onclick = applyPromoCode;

promoCodeInput.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;

  event.preventDefault();
  applyPromoCode();
});

paymentBackBtn.onclick = () => {
    if (!currentSubmissionOrderRef || Date.now() > pendingOrderEditableUntil) {
      alert("The 30-minute editing window has ended. Please contact Little Keeps if you need a correction.");
      return;
    }

    editingPendingOrder = true;
    orderSubmitted = false;
    cartHasItems = true;
    paymentScreen.classList.add("hidden");
    checkoutScreen.classList.remove("hidden");
    submitOrderBtn.textContent = "Save Changes & Return to Payment";
    submitStatus.textContent = "Your unpaid order is editable for 30 minutes after submission.";
    validateForm();

};

paymentDoneBtn.onclick = () => {
  window.location.href = "/";
};

async function getCheckoutErrorMessage(error, fallback) {
  try {
    const response = error?.context;
    if (response?.clone) {
      const body = await response.clone().json();
      if (body?.error) return body.error;
    }
  } catch {
    // Use the friendly fallback below when the Edge Function response is unavailable.
  }

  return error?.message && !String(error.message).includes("non-2xx")
    ? error.message
    : fallback;
}

stripeCheckoutBtn?.addEventListener("click", async () => {
  const orderRef = paymentOrderRef.dataset.paymentRef || paymentOrderRef.innerText.trim();
  const email = customerEmail.value.trim();
  if (!orderRef || !email) return;

  stripeCheckoutBtn.disabled = true;
  stripeCheckoutBtn.textContent = "Opening secure payment…";
  stripeCheckoutStatus.textContent = "Creating your secure checkout…";

  try {
    const { data, error } = await supabase.functions.invoke("stripe-create-checkout", {
      body: { order_ref: orderRef, email }
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    if (data?.paid) {
      clearRememberedPendingOrder(orderRef);
      stripeCheckoutStatus.textContent = "This order has already been paid ✓";
      return;
    }

    if (!data?.url) throw new Error(data?.error || "Payment link was not returned.");
    window.location.assign(data.url);
  } catch (error) {
    console.error("Unable to open Stripe Checkout:", error);
    stripeCheckoutStatus.textContent = await getCheckoutErrorMessage(
      error,
      "Online payment is temporarily unavailable. Please contact Little Keeps and quote your order reference."
    );
    stripeCheckoutBtn.disabled = false;
    stripeCheckoutBtn.textContent = "Try Secure Payment Again";
  }
});

makeSwatches("baseColours", baseColours, "base");
makeSwatches("capColours", capColours, "cap");
makeSwatches("letterColours", letterColours, "letter");

function validateForm() {

    let valid = true;
    let message = "";

    if (isProductPreview) {
        valid = false;
        message = "Private preview mode - checkout is disabled.";
    }

    else if (!customerName.value.trim()) {
        valid = false;
        message = "Please enter your name.";
    }

    else if (
        !customerEmail.value.match(
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        )
    ) {
        valid = false;
        message = "Please enter a valid email.";
    }

    else if (
        !customerPhone.value.match(/^[0-9]{8}$/)
    ) {
        valid = false;
        message = "Contact number must be 8 digits.";
    }

    else if (
      linkExistingOrderToggle.checked &&
      !hasVerifiedLinkedOrder()
    ) {
      valid = false;
      message = "Please verify the original order ID before continuing.";
    }

    else if (
      collectionMethod.value !== "delivery" &&
      !hasVerifiedLinkedOrder() &&
      (!checkoutPickupDate.value || !isCheckoutPickupDateAvailable(checkoutPickupDate.value))
    ) {
      valid = false;
      message = "Please choose an available pickup date.";
    }

    else if (
      collectionMethod.value !== "delivery" &&
      !hasVerifiedLinkedOrder() &&
      !checkoutPickupTime.value
    ) {
      valid = false;
      message = "Please choose a pickup time.";
    }

    else if (
      ["rush", "bulk"].includes(getCheckoutOrderType()) &&
      !requestedCompletionDate.value
    ) {
      valid = false;
      message = "Please choose a completion date.";
    }

    else if (
      getCheckoutOrderType() === "rush" &&
      (!rushAssessment || rushAssessmentFingerprint !== getRushFingerprint())
    ) {
      valid = false;
      message = "Please wait while we check rush availability.";
    }

    else if (
      getCheckoutOrderType() === "rush" &&
      rushAssessment.status === "unavailable"
    ) {
      valid = false;
      message = "Rush service is unavailable for this date. Please choose another date or use the normal estimate.";
    }

    else if (
      getCheckoutOrderType() === "bulk" &&
      (!bulkAssessment || bulkAssessmentFingerprint !== getBulkFingerprint())
    ) {
      valid = false;
      message = "Please wait while we check this bulk date.";
    }

    else if (
      getCheckoutOrderType() === "bulk" &&
      bulkAssessment.status !== "available"
    ) {
      valid = false;
      message = "This bulk date is unavailable. Please choose another date.";
    }

else if (
  collectionMethod.value === "delivery" && !hasVerifiedLinkedOrder() &&
  !/^\d{6}$/.test(deliveryPostalCode.value.trim())
) {
  valid = false;
  message = "Please enter a 6-digit postal code.";
}

else if (!confirmFinalOrderDetails?.checked) {
  valid = false;
  message = "Please confirm that you checked every personalised detail.";
}

else if (
  collectionMethod.value === "delivery" && !hasVerifiedLinkedOrder() &&
  deliveryAddressVerifiedPostal !== deliveryPostalCode.value.trim() &&
  !deliveryAddressManualOverride
) {
  valid = false;
  message = "Please use Find Address to verify your postal code.";
}

else if (
  collectionMethod.value === "delivery" && !hasVerifiedLinkedOrder() &&
  !deliveryAddressLine1.value.trim()
) {
  valid = false;
  message = "Please enter your block and street name.";
}

else if (
  collectionMethod.value === "delivery" && !hasVerifiedLinkedOrder() &&
  !deliveryAddressLine2.value.trim()
) {
  valid = false;
  message = "Please enter your unit number.";
}

else if (
  collectionMethod.value === "delivery" && !hasVerifiedLinkedOrder() &&
  !confirmDeliveryAddress.checked
) {
  valid = false;
  message = "Please confirm that your complete delivery address is correct.";
}

    submitOrderBtn.disabled = orderSubmissionInProgress || !valid;
    submitOrderBtn.classList.toggle("disabled", orderSubmissionInProgress || !valid);

    document.getElementById("formStatus").innerText = message;

}

closeModalBtn.onclick = () => {
  successModal.classList.add("hidden");
};

copySubmittedOrderBtn?.addEventListener("click", async () => {
  const orderRef = successModal.dataset.orderRef || currentSubmissionOrderRef;
  if (!orderRef) return;
  await navigator.clipboard.writeText(orderRef);
  copySubmittedOrderBtn.textContent = "Order ID Copied ✓";
});

trackSubmittedOrderBtn?.addEventListener("click", () => {
  const orderRef = successModal.dataset.orderRef || currentSubmissionOrderRef;
  successModal.classList.add("hidden");
  if (orderRef) statusOrderRef.value = orderRef;
  if (customerEmail?.value) statusCustomerEmail.value = customerEmail.value;
  setStorefrontView("track", { scrollTo: "orderStatusSection" });
  statusCustomerEmail.focus();
});

function decodeSharedDesign(value) {
  const normalized = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function loadSharedDesignFromUrl() {
  const encoded = new URLSearchParams(window.location.hash.slice(1)).get("design");
  if (!encoded) return false;

  try {
    const shared = decodeSharedDesign(encoded);
    if (!Array.isArray(shared.names) || !shared.names.length) return false;
    activeProduct = getProductByKey(productCatalog, shared.productKey || MODULAR_PRODUCT_KEY);
    names = shared.names.map(item => ({
      ...item,
      name: sanitizeName(item.name),
      quantity: normalizeItemQuantity(item.quantity)
    })).filter(item => item.name);
    if (!names.length) return false;
    globalDesign = { ...globalDesign, ...(shared.globalDesign || {}) };
    selectedIndex = Math.min(
      names.length - 1,
      Math.max(0, Number(shared.selectedIndex) || 0)
    );
    orderType = names.length > 1 || shared.orderType === "group" ? "group" : "single";
    cartHasItems = true;
    singleName.value = names[0].name;
    singleQuantity.value = String(getItemQuantity(names[0]));
    nameList.value = formatActiveProductNames();
    if (randomiseMultipleColours) {
      randomiseMultipleColours.checked = Boolean(shared.randomiseMultipleColours);
    }
    updateProductCustomiser();
    setOrderType(orderType);
    refreshUI();
    buildSelectedPreview();
    setStorefrontView("design", { scrollTo: "designArea" });
    draftHasMeaningfulChanges = true;
    saveDraft();
    return true;
  } catch (error) {
    console.warn("Unable to open the shared design link:", error);
    return false;
  }
}

function saveDraft() {
  if (
    orderSubmitted ||
    !draftHasMeaningfulChanges
  ) {
    return;
  }

  const draft = {
    orderType,
    activeProductKey: activeProduct.product_key,
    names,
    selectedIndex,
    globalDesign,
    cartHasItems,
    appliedPromoCode,
    randomiseMultipleColours: Boolean(randomiseMultipleColours?.checked),

    customerName: customerName.value,
    customerEmail: customerEmail.value,
    customerPhone: customerPhone.value,
    linkExistingOrderRequested: linkExistingOrderToggle.checked,
    existingOrderRef: existingOrderRef.value,

    neededBy: neededBy.value,
    rushOrderRequested: rushOrderToggle.checked,
    requestedCompletionDate: requestedCompletionDate.value,
    collectionMethod: collectionMethod.value,
    giftingBagQuantity,
    checkoutPickupDate: checkoutPickupDate.value,
    checkoutPickupTime: checkoutPickupTime.value,
    deliveryAddressLine1:
      deliveryAddressLine1.value,

    deliveryAddressLine2:
      deliveryAddressLine2.value,

    deliveryPostalCode:
      deliveryPostalCode.value,
    deliveryAddressVerifiedPostal,
    deliveryAddressManualOverride,
    deliveryAddressConfirmed: confirmDeliveryAddress.checked,
    orderNotes: orderNotes.value,

    singleName: singleName.value,
    nameList: nameList.value
  };

  localStorage.setItem(
    "littleKeepsDraft",
    JSON.stringify(draft)
  );
}

function loadDraft() {

    const saved = localStorage.getItem("littleKeepsDraft");

    if (!saved) return;

    draftData = JSON.parse(saved);

    draftModal.classList.remove("hidden");

}

continueDraftBtn.onclick = () => {
  draftModal.classList.add("hidden");

  orderType =
    draftData.orderType || "single";

  activeProduct = getProductByKey(
    productCatalog,
    draftData.activeProductKey || MODULAR_PRODUCT_KEY
  );

  names =
    Array.isArray(draftData.names)
      ? draftData.names
      : [];

  names.forEach(item => {
    item.quantity = getItemQuantity(item);
  });

  selectedIndex =
    Number.isInteger(draftData.selectedIndex)
      ? draftData.selectedIndex
      : 0;

  globalDesign = {
    ...globalDesign,
    ...(draftData.globalDesign || {})
  };

  globalDesign.baseShape =
    globalDesign.baseShape || "ribbed";

  globalDesign.letterOrientation =
    globalDesign.letterOrientation || "vertical";

  names.forEach(item => {
    if (item.custom) {
      item.custom.baseShape =
        item.custom.baseShape ||
        globalDesign.baseShape;

      item.custom.letterOrientation =
        item.custom.letterOrientation ||
        globalDesign.letterOrientation;
    }
  });

  cartHasItems =
    Boolean(draftData.cartHasItems);

  appliedPromoCode =
    PROMO_CODES[draftData.appliedPromoCode]
      ? draftData.appliedPromoCode
      : "";

  if (randomiseMultipleColours) {
    randomiseMultipleColours.checked = Boolean(draftData.randomiseMultipleColours);
  }

  promoCodeInput.value = appliedPromoCode;

  if (
    appliedPromoCode &&
    getPromoEligibility(PROMO_CODES[appliedPromoCode]).allowed
  ) {
    const promo = PROMO_CODES[appliedPromoCode];
    showPromoStatus(
      `Applied! ${promo.label} gives you ${getPromoOfferLabel(promo)} ♡`,
      "success"
    );
  } else {
    appliedPromoCode = "";
    promoCodeInput.value = "";
  }

  customerName.value =
    draftData.customerName || "";

  customerEmail.value =
    draftData.customerEmail || "";

  customerPhone.value =
    draftData.customerPhone || "";

  linkExistingOrderToggle.checked =
    Boolean(draftData.linkExistingOrderRequested);
  existingOrderRef.value =
    String(draftData.existingOrderRef || "").toUpperCase();
  linkExistingOrderPanel.classList.toggle(
    "hidden",
    !linkExistingOrderToggle.checked
  );
  if (linkExistingOrderToggle.checked) {
    resetLinkedOrderVerification("For security, please verify the original order again.");
  }

  neededBy.value =
    draftData.neededBy || "";

  rushOrderToggle.checked =
    Boolean(draftData.rushOrderRequested);

  requestedCompletionDate.value =
    draftData.requestedCompletionDate || "";

  collectionMethod.value =
    draftData.collectionMethod || "pickup";

  giftingBagQuantity = Math.min(
    Math.max(0, Number(draftData.giftingBagQuantity) || 0),
    giftingBagStockConfirmed
      ? getMaxGiftingBagQuantity()
      : Math.ceil(getTotalKeychainQuantity() / 2)
  );

  checkoutPickupDate.value =
    draftData.checkoutPickupDate || "";

  checkoutPickupTime.dataset.draftValue =
    draftData.checkoutPickupTime || "";

  deliveryAddressLine1.value =
    draftData.deliveryAddressLine1 || "";

  deliveryAddressLine2.value =
    draftData.deliveryAddressLine2 || "";

  deliveryPostalCode.value =
    String(draftData.deliveryPostalCode || "").replace(/\D/g, "").slice(0, 6);

  deliveryAddressVerifiedPostal =
    draftData.deliveryAddressVerifiedPostal === deliveryPostalCode.value
      ? deliveryPostalCode.value
      : "";

  deliveryAddressManualOverride =
    Boolean(draftData.deliveryAddressManualOverride);

  deliveryAddressLine1.readOnly = !deliveryAddressManualOverride;
  confirmDeliveryAddress.checked =
    Boolean(draftData.deliveryAddressConfirmed) &&
    Boolean(deliveryAddressVerifiedPostal || deliveryAddressManualOverride);

  if (deliveryAddressVerifiedPostal) {
    deliveryAddressLookupStatus.className = "address-lookup-status is-success";
    deliveryAddressLookupStatus.textContent = "Address found ✓";
  } else if (deliveryAddressManualOverride) {
    deliveryAddressLookupStatus.className = "address-lookup-status is-warning";
    deliveryAddressLookupStatus.textContent =
      "Manual address selected. Please check every detail carefully.";
  }

  renderDeliveryAddressConfirmation();

  orderNotes.value =
    draftData.orderNotes || "";

  singleName.value =
    draftData.singleName || "Alicia";

  singleQuantity.value = String(getItemQuantity(names[0]));

  nameList.value =
    draftData.nameList || "Alicia\nBen\nChloe";

  setOrderType(orderType);

  deliveryAddressSection.classList.toggle(
    "hidden",
    collectionMethod.value !== "delivery"
  );

  draftHasMeaningfulChanges = true;

  refreshUI();
  if (checkoutPickupCalendar && checkoutPickupDate.value) {
    checkoutPickupCalendar.setDate(checkoutPickupDate.value, false);
  }
  updateCheckoutPickupTimeOptions(checkoutPickupTime.dataset.draftValue || "");
  delete checkoutPickupTime.dataset.draftValue;
  buildSelectedPreview();
  validateForm();
};

discardDraftBtn.onclick = () => {
  localStorage.removeItem(
    "littleKeepsDraft"
  );

  draftData = null;
  cartHasItems = false;
  appliedPromoCode = "";
  promoCodeInput.value = "";
  showPromoStatus("");
  draftHasMeaningfulChanges = false;
  if (randomiseMultipleColours) randomiseMultipleColours.checked = false;
  if (randomiseColoursStatus) randomiseColoursStatus.textContent = "";

  draftModal.classList.add("hidden");

  updateCartDisplay();
};

function celebrateOrder() {

  const duration = 1800;
  const end = Date.now() + duration;

  (function frame() {

    confetti({
      particleCount: 3,
      angle: 60,
      spread: 60,
      origin: { x: 0 },
      colors: [
        "#ff8fab",
        "#ffd166",
        "#8ecae6",
        "#95d5b2",
        "#ffffff"
      ]
    });

    confetti({
      particleCount: 3,
      angle: 120,
      spread: 60,
      origin: { x: 1 },
      colors: [
        "#ff8fab",
        "#ffd166",
        "#8ecae6",
        "#95d5b2",
        "#ffffff"
      ]
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }

  })();

}

function renderIconPicker() {
  const singlePicker = document.getElementById("iconPicker");
  const groupPicker = document.getElementById("groupIconPicker");

  function buildPicker(container, targetInput) {
    if (!container || !targetInput) return;

    container.innerHTML = "";

    const pencilPicker = activeProduct?.product_key === PENCIL_PRODUCT_KEY;
    const iconMap = pencilPicker ? PENCIL_SYMBOLS : specialKeycaps;
    const categories = pencilPicker ? PENCIL_ICON_CATEGORIES : ICON_CATEGORIES;
    const tabs = document.createElement("div");
    tabs.className = "icon-category-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Icon categories");

    const grid = document.createElement("div");
    grid.className = "icon-category-grid";

    const insertIcon = icon => {
      const start = targetInput.selectionStart ?? targetInput.value.length;
      const end = targetInput.selectionEnd ?? targetInput.value.length;

      targetInput.value =
        targetInput.value.slice(0, start) +
        icon +
        targetInput.value.slice(end);

      targetInput.focus();
      targetInput.selectionStart = start + icon.length;
      targetInput.selectionEnd = start + icon.length;
      updateNames();
    };

    const showCategory = categoryKey => {
      const category =
        categories.find(item => item.key === categoryKey) ||
        categories[0];

      tabs.querySelectorAll(".icon-category-tab").forEach(tab => {
        const isActive = tab.dataset.iconCategory === category.key;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
      });

      grid.innerHTML = "";

      category.icons
        .filter(icon => iconMap[icon])
        .forEach(icon => {
          const button = document.createElement("button");
          const iconName = iconMap[icon];

          button.type = "button";
          button.className = "icon-btn";
          button.innerHTML = displayIcon(icon);
          button.title = iconName;
          button.setAttribute("aria-label", `Add ${iconName} icon`);
          button.addEventListener("click", () => insertIcon(icon));
          grid.appendChild(button);
        });

      if (!grid.children.length) {
        grid.innerHTML = '<p class="icon-category-empty">No icons in this category yet.</p>';
      }
    };

    categories.forEach(category => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "icon-category-tab";
      tab.dataset.iconCategory = category.key;
      tab.setAttribute("role", "tab");
      tab.textContent = category.label;
      tab.addEventListener("click", () => showCategory(category.key));
      tabs.appendChild(tab);
    });

    container.append(tabs, grid);
    showCategory(pencilPicker ? "all" : "popular");
  }

  buildPicker(singlePicker, singleName);
  buildPicker(groupPicker, nameList);
}

function setupColourAccordions() {
  const tabs = Array.from(document.querySelectorAll("[data-colour-part-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-colour-part-panel]"));

  const selectPart = part => {
    tabs.forEach(tab => {
      const selected = tab.dataset.colourPartTab === part;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    panels.forEach(panel => {
      const selected = panel.dataset.colourPartPanel === part;
      panel.classList.toggle("active", selected);
      panel.hidden = !selected;
    });
  };

  tabs.forEach(tab => {
    tab.addEventListener("click", () => selectPart(tab.dataset.colourPartTab));
  });

  selectPart("base");
}

const CUSTOMER_STATUS_STEPS = [
  "Order Received",
  "Payment Verified",
  "Printing",
  "Ready",
  "Fulfilment",
  "Completed"
];

function getCustomerStatusStep(status) {
  if (status === "Completed") return 5;
  if (status === "Out for Delivery") return 4;
  if (["Pending Pickup", "Pending Delivery"].includes(status)) return 3;
  if (status === "Ready for Pickup/Delivery") return 3;
  if (status === "Assembly Complete") return 2;
  if (status === "Printing") return 2;
  if (status === "Payment Verified") return 1;
  return 0;
}

function formatCustomerStatus(status) {
  const labels = {
    "Rush Review": "Rush request being reviewed",
    "Bulk Review": "Bulk request being reviewed",
    "Pending Payment": "Waiting for payment",
    "Payment Expired": "Payment time expired",
    "Payment Verification": "Payment being checked",
    "Payment Verified": "Payment verified",
    "Printing": "In production",
    "Assembly Complete": "Assembly complete - preparing your handoff",
    "Pending Pickup": "Pending pickup",
    "Pending Delivery": "Pending delivery",
    "Ready for Pickup/Delivery": "Ready for pickup or delivery",
    "Out for Delivery": "Ready and out for delivery",
    "Completed": "Completed"
  };

  return labels[status] || status || "Order received";
}

let paymentHoldCountdownTimer = null;
let trackedPickupCalendar = null;

function startPaymentHoldCountdown() {
  clearInterval(paymentHoldCountdownTimer);

  const update = () => {
    const countdown = orderStatusResult.querySelector("[data-payment-expiry]");
    if (!countdown) return;

    const expiresAt = new Date(countdown.dataset.paymentExpiry).getTime();
    const remaining = expiresAt - Date.now();

    if (!Number.isFinite(expiresAt) || remaining <= 0) {
      countdown.textContent = "The previous payment hold has expired. Open payment again to request a fresh slot.";
      countdown.classList.add("is-expired");
      clearInterval(paymentHoldCountdownTimer);
      return;
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    countdown.textContent = `Production slot held for ${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  update();
  paymentHoldCountdownTimer = setInterval(update, 1000);
}

function formatPreferredDate(value) {
  if (!value) return "To be confirmed";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function getPickupDateBounds() {
  const minimum = new Date();
  const maximum = new Date();
  maximum.setDate(maximum.getDate() + 30);

  return {
    minimum: toLocalDateString(minimum),
    maximum: toLocalDateString(maximum)
  };
}

function isTrackedPickupDateAvailable(dateValue) {
  const date = dateValue instanceof Date
    ? new Date(dateValue)
    : dateFromLocalValue(dateValue);
  if (!date) return false;

  const dateString = toLocalDateString(date);
  const bounds = getPickupDateBounds();
  return (
    dateString >= bounds.minimum &&
    dateString <= bounds.maximum &&
    isPickupDay(dateString) &&
    !isShopClosedDate(date) &&
    !isPickupUnavailableDate(date)
  );
}

function getFirstTrackedPickupDate() {
  const { minimum, maximum } = getPickupDateBounds();
  const candidate = dateFromLocalValue(minimum);
  const lastDate = dateFromLocalValue(maximum);

  while (candidate && lastDate && candidate <= lastDate) {
    if (isTrackedPickupDateAvailable(candidate)) return toLocalDateString(candidate);
    candidate.setDate(candidate.getDate() + 1);
  }

  return "";
}

function setupTrackedPickupCalendar(selectedDate = "", selectedTime = "") {
  const dateInput = document.getElementById("pickupScheduleDate");
  if (!dateInput) return;

  trackedPickupCalendar?.destroy();
  const bounds = getPickupDateBounds();
  trackedPickupCalendar = flatpickr(dateInput, {
    dateFormat: "Y-m-d",
    minDate: bounds.minimum,
    maxDate: bounds.maximum,
    defaultDate: isTrackedPickupDateAvailable(selectedDate)
      ? selectedDate
      : getFirstTrackedPickupDate(),
    enable: [date => isTrackedPickupDateAvailable(date)],
    onChange: () => window.updatePickupTimeOptions()
  });

  window.updatePickupTimeOptions(selectedTime);
}

window.updatePickupTimeOptions = function(selectedValue = "") {
  const dateInput = document.getElementById("pickupScheduleDate");
  const timeSelect = document.getElementById("pickupScheduleTime");
  if (!dateInput || !timeSelect) return;

  const ranges = getPickupTimeRanges(
    dateInput.value,
    shopSettings.pickup_time_options
  );
  const availableRanges = isTrackedPickupDateAvailable(dateInput.value)
    ? ranges
    : [];

  timeSelect.innerHTML = availableRanges.length
    ? `
      <option value="">Choose a time</option>
      ${availableRanges.map(range => `
        <option
          value="${escapePresetText(range)}"
          ${range === selectedValue ? "selected" : ""}
        >
          ${escapePresetText(range)}
        </option>
      `).join("")}
    `
    : `<option value="">Choose a date first</option>`;
};

window.scheduleTrackedPickup = async function(
  orderRef,
  email,
  button
) {
  const dateInput = document.getElementById("pickupScheduleDate");
  const timeSelect = document.getElementById("pickupScheduleTime");
  const pickupDate = dateInput?.value || "";
  const pickupTimeRange = timeSelect?.value || "";

  if (!pickupDate || !pickupTimeRange) {
    alert("Please choose both a pickup date and exact time.");
    return;
  }

  if (!isTrackedPickupDateAvailable(pickupDate)) {
    alert("Please choose an available pickup date. Closed and unavailable days cannot be selected.");
    return;
  }

  const configuredTimes = getPickupTimeRanges(
    pickupDate,
    shopSettings.pickup_time_options
  );
  if (!configuredTimes.includes(pickupTimeRange)) {
    alert("Please choose one of the available pickup times.");
    window.updatePickupTimeOptions();
    return;
  }

  const previousLabel = button?.textContent || "Confirm Pickup Time";

  if (button) {
    button.disabled = true;
    button.textContent = "Saving…";
  }

  try {
    const { data, error } = await supabase.rpc(
      "schedule_order_pickup",
      {
        p_order_ref: orderRef,
        p_email: email,
        p_pickup_date: pickupDate,
        p_pickup_time_range: pickupTimeRange
      }
    );

    if (error) throw error;
    if (!data?.ok) throw new Error("Pickup timing could not be saved.");

    await requestPickupTimingTelegramAlert(orderRef, email);

    alert(
      `Pickup confirmed for ${formatPreferredDate(pickupDate)}, ${pickupTimeRange}.`
    );

    orderStatusForm?.requestSubmit();
  } catch (error) {
    console.error("Unable to schedule pickup:", error);
    alert(
      error?.message ||
      "Unable to save this pickup time. Please choose another time."
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousLabel;
    }
  }
};

function renderCustomerOrderStatus(order) {
  const sharedOrderRef = order.linked_order_ref || order.order_ref;
  const paymentExpired =
    order.payment_type !== "Paid" &&
    (order.status === "Payment Expired" ||
      (order.status === "Pending Payment" &&
        order.payment_expires_at &&
        new Date(order.payment_expires_at).getTime() <= Date.now()));
  const effectiveStatus = paymentExpired ? "Payment Expired" : order.status;
  const activeStep = getCustomerStatusStep(effectiveStatus);
  const methodIsDelivery = order.collection_method === "delivery";
  const pickupLocation = order.collection_method === "pickup_marsiling"
    ? "Marsiling MRT"
    : "Woodlands MRT";
  const isSpecialRequest = ["rush", "bulk"].includes(order.order_type);
  const requestApproved = ["Approved", "Auto Approved"].includes(order.review_status);
  const canPay =
    order.payment_type !== "Paid" &&
    ["Pending Payment", "Payment Expired"].includes(effectiveStatus) &&
    (!isSpecialRequest || requestApproved);
  const timingLabel = isSpecialRequest
    ? methodIsDelivery
      ? "Preferred dispatch date"
      : "Preferred completion date"
    : methodIsDelivery
      ? "Estimated dispatch"
      : "Estimated ready for collection";
  const timingValue = isSpecialRequest
    ? formatPreferredDate(order.requested_completion_date || order.needed_by)
    : order.estimated_ready_from && order.estimated_ready_to
      ? formatDateRange(
          order.estimated_ready_from,
          order.estimated_ready_to,
          formatPreferredDate
        )
      : formatPreferredDate(order.needed_by);
  const trackingUrl = (() => {
    try {
      const url = new URL(order.tracking_url || "");
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  })();
  const pickupDate = isTrackedPickupDateAvailable(order.pickup_scheduled_date)
    ? order.pickup_scheduled_date
    : getFirstTrackedPickupDate();
  const pickupTimeRange = order.pickup_time_range || "";
  const pickupRanges = getPickupTimeRanges(
    pickupDate,
    shopSettings.pickup_time_options
  );
  const pickupCutoff = order.pickup_scheduled_date
    ? new Date(`${order.pickup_scheduled_date}T00:00:00`).getTime() - 86400000
    : Number.POSITIVE_INFINITY;
  const canSchedulePickup =
    !methodIsDelivery &&
    !["Completed", "Refunded", "Out for Delivery"].includes(effectiveStatus) &&
    Date.now() < pickupCutoff;
  const reorderItems = Array.isArray(order.order_data)
    ? order.order_data
    : [];

  orderStatusResult.innerHTML = `
    <div class="order-status-result-heading">
      <div>
        <small>Order reference</small>
        <strong>${escapePresetText(sharedOrderRef)}</strong>
        ${order.linked_order_ref ? `<small>Linked add-on included under this order ID</small>` : ""}
      </div>
      <span>${escapePresetText(formatCustomerStatus(effectiveStatus))}</span>
    </div>

    <div class="order-status-timeline">
      ${CUSTOMER_STATUS_STEPS.map((step, index) => `
        <div class="order-status-step ${index <= activeStep ? "is-complete" : ""} ${index === activeStep ? "is-current" : ""}">
          <i>${index < activeStep ? "✓" : index + 1}</i>
          <span>${step}</span>
        </div>
      `).join("")}
    </div>

    <div class="order-status-details">
      ${order.group_order_code ? `
        <p>
          <span>Group order</span>
          <strong>${escapePresetText(order.group_order_code)}</strong>
        </p>
      ` : ""}
      <p>
        <span>Method</span>
        <strong>${methodIsDelivery ? "Islandwide delivery" : `Pickup at ${pickupLocation}`}</strong>
      </p>
      <p>
        <span>${timingLabel}</span>
        <strong>${escapePresetText(timingValue)}</strong>
      </p>
      ${methodIsDelivery && order.courier_name ? `
        <p><span>Courier</span><strong>${escapePresetText(order.courier_name)}</strong></p>
      ` : ""}
      ${methodIsDelivery && order.tracking_number ? `
        <p><span>Tracking number</span><strong>${escapePresetText(order.tracking_number)}</strong></p>
      ` : ""}
      ${methodIsDelivery ? `
        <p>
          <span>Delivery timing</span>
          <strong>Allow 1–3 days after dispatch</strong>
        </p>
      ` : ""}
      ${!methodIsDelivery && order.pickup_scheduled_date ? `
        <p>
          <span>Pickup appointment</span>
          <strong>
            ${escapePresetText(formatPreferredDate(order.pickup_scheduled_date))}
            · ${escapePresetText(order.pickup_time_range || "Time to be selected")}
          </strong>
        </p>
      ` : ""}
    </div>

    <div class="order-self-service-actions">
      ${!methodIsDelivery && order.pickup_scheduled_date ? `
        <button type="button" onclick='window.downloadPickupCalendar(${JSON.stringify({
          orderRef: sharedOrderRef,
          date: order.pickup_scheduled_date,
          time: order.pickup_time_range,
          location: pickupLocation
        })})'>Add Pickup to Calendar</button>
      ` : ""}
      ${reorderItems.length ? `
        <button type="button" onclick='window.reorderTrackedItems(${JSON.stringify(reorderItems)})'>Order These Designs Again</button>
      ` : ""}
    </div>

    ${methodIsDelivery && trackingUrl ? `
      <a class="order-tracking-link" href="${escapePresetText(trackingUrl)}" target="_blank" rel="noopener">Track Delivery</a>
    ` : ""}

    ${canSchedulePickup ? `
      <div class="pickup-scheduler">
        <span class="pickup-scheduler-kicker">
          ${order.pickup_scheduled_date ? "Manage pickup appointment" : "Choose your pickup appointment"}
        </span>
        <h3>
          ${order.pickup_scheduled_date ? "Need another timing?" : "Your order is ready for collection!"}
        </h3>
        <p>
          Select an available date and exact time for ${escapePresetText(pickupLocation)}.
          Each exact time has limited availability.
        </p>

        <div class="pickup-scheduler-fields">
          <label>
            <span>Pickup date</span>
            <input
              id="pickupScheduleDate"
              type="text"
              placeholder="Choose an available date"
              readonly
              value="${escapePresetText(pickupDate)}"
            >
          </label>

          <label>
            <span>Exact time</span>
            <select id="pickupScheduleTime">
              <option value="">Choose a time</option>
              ${pickupRanges.map(range => `
                <option
                  value="${escapePresetText(range)}"
                  ${range === pickupTimeRange ? "selected" : ""}
                >
                  ${escapePresetText(range)}
                </option>
              `).join("")}
            </select>
          </label>
        </div>

        <button
          class="submit-btn"
          type="button"
          onclick='window.scheduleTrackedPickup(
            ${JSON.stringify(sharedOrderRef)},
            ${JSON.stringify(statusCustomerEmail.value.trim())},
            this
          )'
        >
          ${order.pickup_scheduled_date ? "Reschedule Pickup" : "Confirm Pickup Time"}
        </button>
      </div>
    ` : !methodIsDelivery && !order.pickup_scheduled_date ? `
      <div class="pickup-scheduling-note">
        <strong>Pickup slot not set</strong>
        <p>
          Please contact Little Keeps to arrange your pickup timing.
        </p>
      </div>
    ` : ""}

    ${canPay ? `
      <div class="approved-request-payment">
        <span>${isSpecialRequest ? "Request approved ✓" : paymentExpired ? "Fresh payment slot needed" : "Secure payment checkout"}</span>
        <h3>Total: ${displaySettingMoney(order.total)}</h3>
        ${order.payment_expires_at && !paymentExpired ? `
          <p class="payment-hold-countdown" data-payment-expiry="${escapePresetText(order.payment_expires_at)}"></p>
        ` : `
          <p>${paymentExpired
            ? "Your previous checkout expired and no slot is being held. Open payment again to reserve a fresh slot."
            : "A production slot will be held for about 30 minutes when the secure payment page opens."}</p>
        `}
        ${shopSettings.stripe_enabled ? `
          <button class="submit-btn" type="button" onclick='window.payTrackedOrder(${JSON.stringify(order.order_ref)}, ${JSON.stringify(statusCustomerEmail.value.trim())}, this)'>${paymentExpired ? "Open a Fresh Payment Checkout" : "Pay Securely"}</button>
        ` : `<p>Online payment is temporarily unavailable. Please contact Little Keeps.</p>`}
      </div>
    ` : ""}

    <p class="order-status-disclaimer">
      ${isSpecialRequest && !requestApproved
        ? "Your preferred completion date is being reviewed. Please wait for confirmation before making payment."
        : paymentExpired
          ? "No production slot is currently reserved for this unpaid order. Availability is checked again when you open payment."
        : "This estimate is based on our current production schedule. Pickup or delivery updates will appear here as your order progresses."}
    </p>
  `;

  orderStatusResult.classList.remove("hidden");
  if (canSchedulePickup) setupTrackedPickupCalendar(pickupDate, pickupTimeRange);
  startPaymentHoldCountdown();
}

window.copyTrackedOrderRef = async function(orderRef, button) {
  await navigator.clipboard.writeText(orderRef);
  if (button) button.textContent = "Copied ✓";
};

window.downloadPickupCalendar = function(details) {
  const date = String(details?.date || "").replace(/-/g, "");
  if (!date) return;
  const eventText = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Little Keeps//Pickup//EN",
    "BEGIN:VEVENT",
    `UID:${String(details.orderRef || "order")}@little-keeps`,
    `DTSTART;VALUE=DATE:${date}`,
    `DTEND;VALUE=DATE:${date}`,
    `SUMMARY:Little Keeps pickup · ${String(details.time || "Selected time")}`,
    `LOCATION:${String(details.location || "Little Keeps pickup")}`,
    `DESCRIPTION:Order ${String(details.orderRef || "")} · Pickup at ${String(details.time || "selected time")}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([eventText], { type: "text/calendar" }));
  link.download = `Little-Keeps-${details.orderRef || "pickup"}.ics`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};

window.reorderTrackedItems = function(items) {
  const reorderProductKey = String(items?.[0]?.product_key || "");
  if (reorderProductKey) {
    activeProduct = getProductByKey(productCatalog, reorderProductKey);
  }
  const restored = (items || []).map(item => {
    const design = item.design || {};
    return {
      name: item.name || item.clean_name || "Alicia",
      quantity: normalizeItemQuantity(item.quantity || 1),
      custom: {
        baseShape: design.base_shape?.key || design.baseShape || "ribbed",
        letterOrientation: design.letter_orientation || design.letterOrientation || "vertical",
        fontSize: getStandardFontSize({
          fontSize: design.font_size_mm || design.fontSize || design.font_size
        }),
        nfcEnabled: Boolean(design.nfc?.enabled || design.nfcEnabled),
        nfcType: design.nfc?.content_type || design.nfcType || "guardian",
        nfcPayload: design.nfc?.payload || design.nfcPayload || "",
        photo: design.photo ? {
          originalPath: design.photo.original_path || design.photo.originalPath || "",
          artworkPath: design.photo.artwork_path || design.photo.artworkPath || "",
          artworkUrl: design.photo.artwork_url || design.photo.artworkUrl || "",
          generationId: design.photo.generation_id || design.photo.generationId || "",
          subjectType: design.photo.subject_type || design.photo.subjectType || "person",
          colourCount: Number(design.photo.colour_count || design.photo.colourCount || 4),
          variant: design.photo.variant || "classic",
          filamentPalette: normalizePhotoFilamentPalette(
            design.photo.filament_palette || design.photo.filamentPalette
          )
        } : null,
        pencil: design.pencil ? normalizePencilDesign({
          textStyle: design.pencil.text_style || design.pencil.textStyle,
          endingStyle: design.pencil.ending_style || design.pencil.endingStyle,
          eraser: design.pencil.eraser?.hex || design.pencil.eraser,
          ferrule: design.pencil.ferrule?.hex || design.pencil.ferrule,
          wood: design.pencil.wood?.hex || design.pencil.wood,
          tip: design.pencil.tip?.hex || design.pencil.tip,
          endCap: design.pencil.end_cap?.hex || design.pencil.endCap?.hex || design.pencil.endCap
        }) : normalizePencilDesign(globalDesign.pencil),
        bases: (design.bases || []).map(colour => colour?.hex || colour),
        caps: (design.caps || []).map(colour => colour?.hex || colour),
        letters: (design.letters || []).map(colour => colour?.hex || colour)
      }
    };
  }).filter(item => item.name);
  if (!restored.length) return;
  names = restored;
  orderType = restored.length > 1 ? "group" : "single";
  singleSection.classList.toggle("hidden", orderType !== "single");
  groupSection.classList.toggle("hidden", orderType !== "group");
  if (orderType === "single") {
    singleName.value = restored[0].name;
    if (singleQuantity) singleQuantity.value = String(restored[0].quantity);
  } else {
    nameList.value = restored.map(item => item.name).join("\n");
  }
  selectedIndex = 0;
  updateProductCustomiser();
  refreshUI();
  buildSelectedPreview();
  setStorefrontView("design", { scrollTo: "designArea" });
};

window.payTrackedOrder = async function(orderRef, email, button) {
  const previousLabel = button?.textContent || "Pay Securely";
  if (button) {
    button.disabled = true;
    button.textContent = "Opening secure payment…";
  }

  try {
    const { data, error } = await supabase.functions.invoke("stripe-create-checkout", {
      body: { order_ref: orderRef, email }
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    if (data?.paid) {
      clearRememberedPendingOrder(orderRef);
      alert("This order has already been paid ✓");
      return;
    }
    if (!data?.url) throw new Error(data?.error || "Payment link unavailable");
    window.location.assign(data.url);
  } catch (error) {
    console.error("Unable to open approved payment:", error);
    alert(await getCheckoutErrorMessage(
      error,
      "Online payment is temporarily unavailable. Please contact Little Keeps for help."
    ));
    if (button) {
      button.disabled = false;
      button.textContent = previousLabel;
    }
  }
};

orderStatusForm?.addEventListener("submit", async event => {
  event.preventDefault();

  const orderRef = statusOrderRef.value.trim().toUpperCase();
  const email = statusCustomerEmail.value.trim().toLowerCase();

  orderStatusResult.classList.add("hidden");
  orderStatusMessage.classList.remove("error");

  if (!orderRef || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    orderStatusMessage.textContent =
      "Please enter your order reference and the email used at checkout.";
    orderStatusMessage.classList.add("error");
    return;
  }

  checkOrderStatusBtn.disabled = true;
  checkOrderStatusBtn.textContent = "Checking…";
  orderStatusMessage.textContent = "Checking your order…";

  try {
    const { data, error } = await supabase.rpc("lookup_order_status", {
      p_order_ref: orderRef,
      p_email: email
    });

    if (error) throw error;

    const order = Array.isArray(data) ? data[0] : data;

    if (!order) {
      orderStatusMessage.textContent =
        "We couldn’t find a matching order. Check the reference and email, then try again.";
      orderStatusMessage.classList.add("error");
      return;
    }

    if (order.payment_type === "Paid" || order.online_payment_status === "completed") {
      clearRememberedPendingOrder(order.order_ref);
    }

    orderStatusMessage.textContent = "";
    renderCustomerOrderStatus(order);
  } catch (error) {
    console.error("Unable to check order status:", error);
    orderStatusMessage.textContent =
      "Order status is temporarily unavailable. Please try again shortly.";
    orderStatusMessage.classList.add("error");
  } finally {
    checkOrderStatusBtn.disabled = false;
    checkOrderStatusBtn.textContent = "View Order";
  }
});

loadShopNotices();
startLaunchPriceCountdown();
startFeaturedPromoCountdown();
renderIconPicker();
setupColourAccordions();

document
  .querySelectorAll("[data-design-preset]")
  .forEach(button => {
    button.addEventListener("click", () => {
      applyDesignPreset(button.dataset.designPreset);
    });
  });

mobilePreviewToggle?.addEventListener("click", () => {
  const collapsed = previewCard.classList.toggle("mobile-collapsed");

  mobilePreviewToggle.textContent = collapsed
    ? "Show Preview"
    : "Hide Preview";
  mobilePreviewToggle.setAttribute(
    "aria-expanded",
    String(!collapsed)
  );
});

setOrderType("single");
void refreshGiftingBagStock();
cartHasItems = false;
draftHasMeaningfulChanges = false;

setupNeededByCalendar();
updateCollectionNote();
validateForm();
updateCartDisplay();
buildSelectedPreview();
animate();

if (!loadSharedDesignFromUrl()) {
  loadDraft();
} else {
  draftModal.classList.add("hidden");
}

const paymentReturnParams = new URLSearchParams(window.location.search);
const paymentReturnState = paymentReturnParams.get("payment");

if (["success", "cancelled"].includes(paymentReturnState)) {
  const returnedOrderRef = paymentReturnParams.get("order_ref") || "";
  const modalHeading = successModal.querySelector("h2");
  const modalParagraphs = successModal.querySelectorAll(".modal-card > p");

  draftModal.classList.add("hidden");
  successModal.dataset.orderRef = returnedOrderRef;

  if (paymentReturnState === "success") {
    clearRememberedPendingOrder(returnedOrderRef);
    modalHeading.textContent = "Payment successful ✓";
    if (modalParagraphs[0]) {
      modalParagraphs[0].textContent =
        "Thank you! Stripe has received your payment.";
    }
    orderRefText.textContent = returnedOrderRef
      ? `Order ${returnedOrderRef}`
      : "Your Little Keeps order";
    if (modalParagraphs[2]) {
      modalParagraphs[2].textContent =
        "Your order is confirmed and will move into production.";
    }
    if (modalParagraphs[3]) {
      modalParagraphs[3].innerHTML =
        "📧 Your confirmation and order PDF will be emailed shortly.<br>If it isn’t in your inbox, please check Spam or Junk.";
    }

    setTimeout(() => {
      confetti({
        particleCount: 90,
        spread: 72,
        startVelocity: 34,
        origin: { y: 0.68 },
        zIndex: 1300,
        colors: ["#ff6799", "#ffb6cf", "#ffd966", "#ffffff"],
      });
    }, 250);
  } else {
    modalHeading.textContent = "Payment not completed";
    if (modalParagraphs[0]) {
      modalParagraphs[0].textContent =
        "No payment was taken. Your order is still saved.";
    }
    orderRefText.textContent = returnedOrderRef
      ? `Order ${returnedOrderRef}`
      : "Your Little Keeps order";
    if (modalParagraphs[2]) {
      modalParagraphs[2].textContent =
        "Your payment slot is held only briefly. Use Track / Pay Order with your reference and email whenever you’re ready to reopen payment.";
    }
    if (modalParagraphs[3]) {
      modalParagraphs[3].textContent =
        "Need help? Contact Little Keeps and quote your order reference.";
    }
  }

  closeModalBtn.textContent = "Return to Shop";
  successModal.classList.remove("hidden");
  window.history.replaceState({}, "", window.location.pathname);
}

const resumeOrderRef = paymentReturnParams.get("resume_order");
if (resumeOrderRef && !paymentReturnState) {
  statusOrderRef.value = resumeOrderRef.trim().toUpperCase();
  setTimeout(() => {
    setStorefrontView("track", {
      scrollTo: "orderStatusSection"
    });
    statusCustomerEmail.focus();
  }, 300);
}

renderPendingOrderBanner();
void refreshRememberedPendingOrderState();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    renderPendingOrderBanner();
    void refreshRememberedPendingOrderState();
  }
});
void retryRememberedOrderEmail();

if (activeSharedGroupOwnerToken) {
  void loadSharedGroup(activeSharedGroupOwnerToken, { openOwner: true });
} else if (activeSharedGroupShareToken) {
  void loadSharedGroup(activeSharedGroupShareToken);
}

// Payment-page preview for layout testing only.
// This does not create, save or update an order.
if (
  new URLSearchParams(window.location.search)
    .get("payment-preview") === "true"
) {
  draftModal.classList.add("hidden");
  designScreen.classList.add("hidden");
  checkoutScreen.classList.add("hidden");
  paymentScreen.classList.remove("hidden");
  hideStorefrontViews();

  paymentOrderRef.innerText = "LK-PREVIEW-1234";
  paymentOrderRef.dataset.paymentRef = "LK-PREVIEW-1234";
  paymentTotal.innerText = "$5.70";

  const paymentBox = paymentScreen.querySelector(".payment-box");

  if (paymentBox) {
    const previewNotice = document.createElement("div");
    previewNotice.style.cssText = `
      margin-bottom:16px;
      padding:12px;
      background:#fff0f6;
      border:1px solid #ffc6d9;
      border-radius:12px;
      color:#a83d65;
      font-weight:700;
      text-align:center;
    `;
    previewNotice.innerText =
      "Preview mode only - no order has been submitted.";
    paymentBox.prepend(previewNotice);
  }

  window.scrollTo(0, 0);
}
