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
  calculateGiftingBagTotal,
  formatDateRange,
  getBulkApprovalPolicy,
  getGiftingBagSelectionLimit,
  getPickupTimeRanges,
  getKeychainTurnaround,
  isPickupDay,
  isAlternatingProductionDay,
  isOrderReminderFinishedOrExpired,
  isSharedGroupCancelledOrExpired,
  flattenSharedGroupContributions,
  normalizePickupTimeOptions,
  pickRandomDesignColours
} from "./admin-logic.js";
import {
  DEFAULT_PRODUCT_CATALOG,
  MODULAR_PRODUCT_KEY,
  SOLID_PRODUCT_KEY,
  STANDARD_PRODUCT_KEY,
  calculateProductUnitPrice,
  getProductByKey,
  getProductDisplayPrice,
  normalizeProductCatalog
} from "./product-catalog.js";

const isManualOrder =
  new URLSearchParams(window.location.search).get("manual") === "true";

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
  large_order_quantity: 7,
  standard_min_working_days: 2,
  standard_max_working_days: 3,
  large_min_working_days: 3,
  large_max_working_days: 4,
  bulk_order_quantity: 15,
  rush_fee_small: 5,
  rush_fee_large: 8,
  stripe_enabled: false,
  status_emails_enabled: false,
  status_email_template_id: "",
  unavailable_colours: [],
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
  shopSettings.pickup_time_options = normalizePickupTimeOptions(
    shopSettings.pickup_time_options
  );
} catch (error) {
  console.warn("Using default shop pricing settings:", error);
}

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

const unavailableColourNames = new Set(
  (Array.isArray(shopSettings.unavailable_colours)
    ? shopSettings.unavailable_colours
    : []
  ).map(name => String(name).trim().toLowerCase())
);

const shopColourNameByHex = {
  "#ffffff": "Jade White",
  "#fec600": "Sunflower Yellow",
  "#e4bd68": "Gold",
  "#f55a74": "Pink",
  "#9d2235": "Maroon Red",
  "#00b1b7": "Turquoise",
  "#0086d6": "Cyan",
  "#3f8e43": "Mistletoe Green",
  "#68724d": "Dark Green",
  "#5e43b7": "Purple",
  "#482960": "Indigo Purple",
  "#000000": "Black"
};

function isShopColourAvailable(colour) {
  const name = shopColourNameByHex[String(colour || "").toLowerCase()];
  return !name || !unavailableColourNames.has(name.toLowerCase());
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
const modularCardPrice = modularProduct.price_visible
  ? `From ${displaySettingMoney(getProductDisplayPrice(modularProduct))}`
  : "Pricing soon";
const solidCardPrice = solidProduct.price_visible
  ? `From ${displaySettingMoney(getProductDisplayPrice(solidProduct))}`
  : "Pricing coming soon";
  const standardCardPrice = standardProduct.price_visible
  ? displaySettingMoney(getProductDisplayPrice(standardProduct))
  : "Price coming soon";
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
const rushFeeSmall = Math.max(0, getSettingNumber("rush_fee_small", 5));
const rushFeeLarge = Math.max(rushFeeSmall, getSettingNumber("rush_fee_large", 8));

function displaySettingMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

document.querySelector("#app").innerHTML = `
<main class="page">


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
      <strong>Holiday Notice:</strong>
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
      Design Your Keychain
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
      <h2>Shopping Cart ♡</h2>
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
      class="shared-group-cart-btn"
    >
      Start a Group Order
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
        Made especially for you
      </p>

      <h1>
        Tiny keepsakes,
        <span>made personal.</span>
      </h1>

      <p class="hero-description">
        Design a clicky keychain in your favourite colours.
      </p>

      <div class="hero-actions">
        <button
          id="startDesignBtn"
          type="button"
          class="hero-button"
        >
          View Products
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

    <div class="hero-offer-card">
      <div class="hero-offer-top">
        <div>
          <span class="hero-bestseller-pill">Little Keeps favourite</span>
          <p>Personalised</p>
          <strong>Clicky Keychains</strong>
        </div>

        <div class="hero-price-badge">
          ${launchPriceEnabled ? `
            <small>Launch price</small>
            <span class="usual-price">${displaySettingMoney(usualBasePrice)}</span>
            <span class="promo-price">${displaySettingMoney(launchBasePrice)}</span>
            <span class="promo-saving">
              Save ${displaySettingMoney(Math.max(0, usualBasePrice - launchBasePrice))}
            </span>
          ` : `
            <small>From</small>
            <span class="promo-price">${displaySettingMoney(usualBasePrice)}</span>
          `}
        </div>
      </div>

      <div class="hero-included-list">
        <p class="hero-card-label">Included in the price</p>

        <span class="character-inclusion">✓ Up to ${modularProduct.included_characters} characters</span>
        <span>✓ 1 base, 1 cap and 1 letter/icon colour</span>
        <span>✓ Clicky switches and keyring</span>
      </div>

      <details class="hero-more-details">
        <summary>Size &amp; extras</summary>

        <div class="hero-pricing-guide">
          <p>Approximate size</p>

          <div class="hero-price-row">
            <span>Each character block</span>
            <strong>3.5 × 2.7 cm</strong>
          </div>

          <div class="hero-price-row">
            <span>Letters, numbers and icons</span>
            <strong>1 character each</strong>
          </div>

          <p style="margin-top:14px;">Optional additions</p>

          <div class="hero-price-row">
            <span>Each character after ${modularProduct.included_characters}</span>
            <strong>+${displaySettingMoney(modularProduct.extra_character_price)}</strong>
          </div>

          <div class="hero-price-row">
            <span>Extra base colour</span>
            <strong>+${displaySettingMoney(modularProduct.extra_base_colour_price)}</strong>
          </div>

          <div class="hero-price-row">
            <span>Extra cap colour</span>
            <strong>+${displaySettingMoney(modularProduct.extra_cap_colour_price)}</strong>
          </div>

          <div class="hero-price-row">
            <span>Extra letter/icon colour</span>
            <strong>+${displaySettingMoney(modularProduct.extra_letter_colour_price)}</strong>
          </div>

        </div>
      </details>
    </div>
  </div>

  <div class="hero-decoration hero-decoration-one"></div>
  <div class="hero-decoration hero-decoration-two"></div>
</section>

<section id="productsSection" class="products-section" data-store-view="shop" aria-labelledby="productsHeading">
  <div class="products-heading">
    <p class="section-eyebrow">Our Products</p>
    <h2 id="productsHeading">Choose your little keep</h2>
  </div>

  <div class="product-card-grid">
  ${modularProduct.status !== "hidden" ? `
    <article class="product-card product-card-current">
      <div class="product-card-visual">
        <img
          src="/images/modular-clicky-keychain.jpg"
          alt="Colourful modular clicky keychains"
          loading="eager"
        >
        <span class="product-card-badge">Available now</span>
      </div>

      <div class="product-card-content">
        <div>
          <small>${escapePresetText(modularProduct.eyebrow)}</small>
          <h3>${escapePresetText(modularProduct.name)}</h3>
        </div>
        <p>${escapePresetText(modularProduct.description)}</p>
        <span class="product-card-price">${escapePresetText(modularCardPrice)}</span>
        <button type="button" data-product-key="${MODULAR_PRODUCT_KEY}" data-view-target="design">
          Design yours <span>→</span>
        </button>
      </div>
    </article>
  ` : ""}

  ${solidProduct.status !== "hidden" ? `
    <article class="product-card product-card-coming" aria-disabled="true">
      <div class="product-card-visual mystery-product-visual" aria-hidden="true">
        <div class="mystery-solid-base">
          <i></i><i></i><i></i><b>ABC</b>
        </div>
        <span class="product-card-badge">Coming soon</span>
      </div>

      <div class="product-card-content">
        <div>
          <small>${escapePresetText(standardProduct.eyebrow)}</small>
          <h3>${escapePresetText(standardProduct.name)}</h3>
        </div>

        <p>${escapePresetText(standardProduct.description)}</p>

        <span class="product-card-price">
          ${escapePresetText(standardCardPrice)}
        </span>

        <button type="button" disabled>
          Coming soon
        </button>
      </div>
    </article>
  ` : ""}

  ${standardProduct.status !== "hidden" ? `
    <article class="product-card product-card-coming" aria-disabled="true">
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

        <span class="product-card-price">
          ${escapePresetText(standardCardPrice)}
        </span>

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

</div>
  </div>
</section>

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
          <h3>Or enter everyone yourself</h3>

          <textarea
            id="nameList"
            placeholder="Paste names here, one per line"
          >Alicia
Ben
Chloe</textarea>

          <p id="nameCount">3 names</p>

          <p class="hint">One name per line · icons optional</p>

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
          <h3>Choose a Keychain to Edit</h3>

        </div>

        <div id="applyAllSection">
          <label class="apply-row">
            <input id="applyAllToggle" type="checkbox">
            Use the same design for all keychains
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

            <div id="previewLoading" class="preview-loading">
              <div class="preview-loading-spinner"></div>
              <strong>Loading your 3D preview…</strong>
            </div>
          </div>

          <div id="previewColourLegend" class="preview-colour-legend" aria-live="polite"></div>

          <p id="editModeText" class="preview-editing-text">
            Currently editing: Alicia only
          </p>

          <p id="dimensionEstimate" class="dimension-estimate">
            📏 <strong>ALICIA:</strong>
            Approx. 17.5 cm long × 2.7 cm tall × 2.2 cm thick
            <br><small>Approximate measurement; slight variation may occur after assembly.</small>
          </p>
        </div>

      <div class="preview-tip">
        <p>
          Drag the preview to rotate your keychain.
        </p>
      </div>

      <div id="designInspiration" class="design-inspiration">
        <h3>Need inspiration? ✨</h3>
        <div class="inspiration-scroll">
          ${renderDesignPresetCards()}
        </div>

        <p id="inspirationStatus" class="inspiration-status" aria-live="polite"></p>
      </div>
      </div>
    </section>

    <section class="options-column">
      <div class="card colours-card">
        <div class="customiser-heading">
          <h2>Choose Your Style</h2>
        </div>

        <div class="random-colour-card clicky-only-option">
          <div>
            <strong>Too many lovely choices? ✨</strong>
            <span>Let Little Keeps choose a complete colour combination for you.</span>
          </div>
          <button id="randomiseColoursBtn" type="button" class="randomise-colours-btn">
            Surprise Me
          </button>
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

        <div class="customisation-section colour-accordion is-open" data-colour-accordion="base">
          <button type="button" class="customisation-title colour-accordion-toggle" aria-expanded="true">
            <div>
              <h3>Base Colours</h3>
            </div>
            <span class="colour-accordion-arrow" aria-hidden="true">⌄</span>
          </button>

          <div class="colour-accordion-content">
            <div id="baseSlots" class="slot-row"></div>

            <p id="baseColourHint" class="colour-hint">
              Hover or tap a colour
            </p>

            <div id="baseColours" class="swatches"></div>
          </div>
        </div>
        <div
          id="clickyCapColourSection"
          class="customisation-section colour-accordion clicky-only-option"
          data-colour-accordion="cap"
        >
          <button type="button" class="customisation-title colour-accordion-toggle" aria-expanded="false">
            <div>
              <h3>Cap Colours</h3>
            </div>
            <span class="colour-accordion-arrow" aria-hidden="true">⌄</span>
          </button>

          <div class="colour-accordion-content">
            <div id="capSlots" class="slot-row"></div>

            <p id="capColourHint" class="colour-hint">
              Hover or tap a colour
            </p>

            <div id="capColours" class="swatches"></div>
          </div>
        </div>

        <div class="customisation-section colour-accordion" data-colour-accordion="letter">
          <button type="button" class="customisation-title colour-accordion-toggle" aria-expanded="false">
            <div>
              <h3>Letter Colours</h3>
            </div>
            <span class="colour-accordion-arrow" aria-hidden="true">⌄</span>
          </button>

          <div class="colour-accordion-content">
            <div id="letterSlots" class="slot-row"></div>

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
              href="https://wa.me/6585121915"
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
          <input id="requestedCompletionDate" type="text" placeholder="Choose a date">
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

        <textarea
          id="orderNotes"
          placeholder="Additional order notes (optional)..."
        ></textarea>
      </div>

      <div class="review-box">
<h3>Order Summary</h3>

        <div class="review-summary">
          <p>
            Total keychains:
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

  <button
    id="submitOrderBtn"
    type="button"
    class="submit-btn"
    disabled
  >
    Submit Order & Continue to Payment
  </button>
</div>

<label class="final-order-confirmation" for="confirmFinalOrderDetails">
  <input id="confirmFinalOrderDetails" type="checkbox">
  <span>I checked every name, icon, colour, letter direction, and pickup or delivery detail.</span>
</label>

      <p id="formStatus" class="hint"></p>
      <p id="submitStatus" class="hint"></p>
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
    <details>
      <summary>Production and timing</summary>
      <ul>
        <li>1–3 keychains usually require 2–3 working days.</li>
        <li>4–6 keychains usually require 3–4 working days.</li>
        <li>7–14 keychains usually require 4–5 working days.</li>
        <li>The date shown at checkout includes current availability and closures.</li>
        <li>For ${bulkOrderQuantity}–29 keychains, allow at least 7 days.</li>
        <li>For 30–50 keychains, allow at least 14 days.</li>
        <li>51–75 keychains take approximately 1.5–2 weeks.</li>
        <li>76–100 keychains take approximately 2–3 weeks.</li>
        <li>101–150 keychains take approximately 3–4 weeks.</li>
        <li>More than 150 keychains take approximately 4–6 weeks.</li>
        <li>Event orders are available by islandwide delivery only.</li>
        <li>We’ll confirm the timing and final quote before payment.</li>
        <li>Rush requests are subject to availability.</li>
      </ul>
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
      href="https://wa.me/6585121915"
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

const configuredPromoCode = String(shopSettings.promo_code || "")
  .trim()
  .toUpperCase()
  .replace(/\s+/g, "");

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
        String(row.code || "").trim().toUpperCase(),
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
const applyAllToggle = document.getElementById("applyAllToggle");
const editModeText = document.getElementById("editModeText");
const dimensionEstimate = document.getElementById("dimensionEstimate");
const previewColourLegend = document.getElementById("previewColourLegend");
const inspirationStatus = document.getElementById("inspirationStatus");
const randomiseColoursBtn = document.getElementById("randomiseColoursBtn");
const randomiseColoursStatus = document.getElementById("randomiseColoursStatus");

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

const colours = [
  {
    name: "Jade White",
    colour: "#FFFFFF",
    available: !unavailableColourNames.has("jade white"),
    note: ""
  },
  {
    name: "Sunflower Yellow",
    colour: "#FEC600",
    available: !unavailableColourNames.has("sunflower yellow"),
    note: ""
  },
  {
    name: "Gold",
    colour: "#E4BD68",
    available: !unavailableColourNames.has("gold"),
    note: ""
  },
  {
    name: "Pink",
    colour: "#F55A74",
    available: !unavailableColourNames.has("pink"),
    note: ""
  },
  {
    name: "Maroon Red",
    colour: "#9D2235",
    available: !unavailableColourNames.has("maroon red"),
    note: ""
  },
  {
    name: "Turquoise",
    colour: "#00B1B7",
    available: !unavailableColourNames.has("turquoise"),
    note: ""
  },
  {
    name: "Cyan",
    colour: "#0086D6",
    available: !unavailableColourNames.has("cyan"),
    note: ""
  },
  {
    name: "Mistletoe Green",
    colour: "#3F8E43",
    available: !unavailableColourNames.has("mistletoe green"),
    note: ""
  },
  {
    name: "Dark Green",
    colour: "#68724D",
    available: !unavailableColourNames.has("dark green"),
    note: ""
  },

  {
    name: "Purple",
    colour: "#5E43B7",
    available: !unavailableColourNames.has("purple"),
    note: ""
  },
  {
    name: "Indigo Purple",
    colour: "#482960",
    available: !unavailableColourNames.has("indigo purple"),
    note: ""
  },
  {
    name: "Black",
    colour: "#000000",
    available: !unavailableColourNames.has("black"),
    note: ""
  }
];
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
  "♟": "chess"
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
  const turnaround = getKeychainTurnaround(quantity);
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

function addWeekdaysOnly(startDate, workingDays) {
  const date = new Date(startDate);
  let daysAdded = 0;

  while (daysAdded < workingDays) {
    date.setDate(date.getDate() + 1);

    const day = date.getDay();
    if (day !== 0 && day !== 6) daysAdded += 1;
  }

  date.setHours(0, 0, 0, 0);
  return date;
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

function isCalendarDateUnavailable(date, mode) {
  const dateValue = toLocalDateString(date);
  const unavailableDates =
    mode === "bulk"
      ? bulkUnavailableDates
      : mode === "rush"
        ? []
        : normalUnavailableDates;

  if (unavailableDates.includes(dateValue)) return true;
  if (mode === "standard" && !isAlternatingProductionDay(dateValue)) return true;

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
    !isAlternatingProductionDay(toLocalDateString(candidate)) ||
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

  return date >= readyDate && isPickupDay(toLocalDateString(date)) && !isShopClosedDate(date);
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
          ? "This date can be requested. We’ll confirm the timing and final quote before payment."
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
    p_date: requestedCompletionDate.value
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
  const weekdayOnlyEnd = addWeekdaysOnly(new Date(), turnaround.maxDays);
  const includesHolidayClosure = estimateEnd.getTime() > weekdayOnlyEnd.getTime();
  const bulkPolicy = getBulkApprovalPolicy(turnaround.quantity);
  const isRush = !isBulk && Boolean(rushOrderToggle?.checked);

  neededBy.value = isBulk || isRush
    ? requestedCompletionDate.value
    : toLocalDateString(estimateEnd);

  if (turnaroundSummary) {
    turnaroundSummary.innerHTML = isBulk
      ? `📦 <strong>${turnaround.quantity} ${itemWord}</strong> · allow <strong>${bulkPolicy.timeframeLabel}</strong>. We’ll confirm the timing and final quote before payment.`
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
    ? `This is the dispatch date. Allow 1–3 days for delivery.${includesHolidayClosure ? " Our holiday closure is already included." : ""}`
    : includesHolidayClosure
      ? "Our holiday closure is included. Choose a pickup slot below."
      : "Choose an available pickup slot below.";

  automaticDateCard.classList.toggle("hidden", isBulk || isRush);
  rushOrderOption.classList.toggle("hidden", isBulk);
  bulkOrderNotice.classList.add("hidden");
  specialDateSection.classList.toggle("hidden", !isBulk && !isRush);

  if (isBulk) {
    bulkOrderNotice.classList.remove("hidden");
    bulkOrderNotice.innerHTML = `
      <strong>Event order request</strong>
      <p>Delivery is required for event orders. We’ll review the details and contact you with the confirmed timing and final quote before payment.</p>
    `;
    specialDateLabel.textContent = methodIsDelivery
      ? "Choose your bulk dispatch date"
      : "Choose your bulk completion date";
    specialOrderMessage.textContent = methodIsDelivery
      ? `Choose a preferred dispatch date ${bulkPolicy.timeframeLabel} away. We’ll confirm it with your final quote. Allow 1–3 days for delivery.`
      : `Choose a preferred date ${bulkPolicy.timeframeLabel} away. We’ll confirm it with your final quote.`;
    orderNotes.placeholder = "Customer notes for your bulk order...";

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
    const bulkMinimumDate = new Date();
    bulkMinimumDate.setHours(0, 0, 0, 0);
    bulkMinimumDate.setDate(
      bulkMinimumDate.getDate() + Math.max(7, bulkPolicy.minLeadDays)
    );
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
      ? "Request Event Order Quote"
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
    if (
      day === 0 ||
      day === 6 ||
      !isAlternatingProductionDay(toLocalDateString(candidate))
    ) {
      candidate = addWorkingDays(candidate, 1);
      continue;
    }

    const candidateValue = toLocalDateString(candidate);
    const { data, error } = await supabase.rpc("check_needed_by_date", {
      p_date: candidateValue
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
  return Array.from(name || "")
    .map(char => /[a-z]/i.test(char) ? char.toUpperCase() : char)
    .filter(char => /[A-Z0-9]/.test(char) || specialKeycaps[char])
    .join("");
}

function getApproximateKeychainSize(name) {
  const characterCount = Array.from(sanitizeName(name)).length;

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

function getApproximateSizeText(name) {
  const size = getApproximateKeychainSize(name);

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
let currentSubmissionId = crypto.randomUUID();
let currentSubmissionOrderRef = "";

let cartHasItems = false;
let draftHasMeaningfulChanges = false;

function getAvailableColours() {
  return colours
    .filter(c => c.available)
    .map(c => c.colour);
}

const available = getAvailableColours();
if (!available.length) available.push("#FFFFFF");

let globalDesign = {
  baseShape: "ribbed",
  letterOrientation: "vertical",

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

function normalizeItemQuantity(value) {
  return Math.min(250, Math.max(1, Math.floor(Number(value) || 1)));
}

function getItemQuantity(item) {
  return normalizeItemQuantity(item?.quantity);
}

function getTotalKeychainQuantity() {
  return names.reduce((total, item) => total + getItemQuantity(item), 0);
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

function getUniqueColourCount(colours) {
  return new Set(
    colours.map(colour => colour.toLowerCase())
  ).size;
}

function calculatePrice(design, name = "") {
  const characterCount = Array.from(sanitizeName(name)).length;

  return calculateProductUnitPrice({
    product: activeProduct,
    characterCount,
    baseColourCount: getUniqueColourCount(design.bases),
    capColourCount: getUniqueColourCount(design.caps),
    letterColourCount: getUniqueColourCount(design.letters)
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
      bases: [...globalDesign.bases],
      caps: [...globalDesign.caps],
      letters: [...globalDesign.letters]
    };
  }

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

function randomiseArticulatedColours() {
  if (activeProduct.product_key === STANDARD_PRODUCT_KEY) return;
  const availableHexes = colours.filter(item => item.available).map(item => item.colour);
  const selected = pickRandomDesignColours({
    baseColours: availableHexes,
    capColours: availableHexes,
    letterColours: availableHexes
  });
  const design = getActiveDesign();
  design.bases = [selected.base];
  design.caps = [selected.cap];
  design.letters = [selected.letter];

  if (applyAllToggle.checked) {
    globalDesign.bases = [selected.base];
    globalDesign.caps = [selected.cap];
    globalDesign.letters = [selected.letter];
    names.forEach(item => { item.custom = null; });
  }

  draftHasMeaningfulChanges = true;
  if (randomiseColoursStatus) {
    randomiseColoursStatus.textContent = `Chosen: ${getColourName(selected.base)}, ${getColourName(selected.cap)} and ${getColourName(selected.letter)} ♡`;
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

  colourOptions.forEach(item => {
    const option = document.createElement("div");
    option.className = "swatch-option";
    const btn = document.createElement("button");

    btn.type = "button";
    btn.className = "swatch";
    btn.style.backgroundColor = item.colour;
    btn.title = item.name;
    btn.setAttribute("aria-label", item.name);

    const showColourName = () => {
      if (!hint) return;

      hint.innerHTML = `
        <span
          class="colour-hint-dot"
          style="background:${item.colour}"
        ></span>
        ${item.name}
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
    container.appendChild(option);
  });
}

backBtn.onclick = () => {
  setStorefrontView("design", {
    scrollTo: "designArea"
  });
};

function getOrderSubtotal() {
  const keychainSubtotal = names.reduce(
    (sum, item) =>
      sum + calculatePrice(getDesign(item), item.name) * getItemQuantity(item),
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

  if (!promo) return 0;
  if (!getPromoEligibility(promo, subtotal).allowed) return 0;

  if (promo.discountType === "fixed") {
    return roundMoney(
      Math.min(Number(subtotal || 0), Number(promo.discountValue || 0))
    );
  }

  return roundMoney(
    subtotal * (Number(promo.discountValue || 0) / 100)
  );
}

function getPromoOfferLabel(promo) {
  if (!promo) return "Promo";

  return promo.discountType === "fixed"
    ? `${displaySettingMoney(promo.discountValue)} off`
    : `${Number(promo.discountValue || 0)}% off`;
}

function getPromoEligibility(promo, subtotal = getOrderSubtotal()) {
  const now = new Date();

  if (promo.startsAt && now < new Date(promo.startsAt)) {
    return {
      allowed: false,
      message: "This promo code is not active yet."
    };
  }

  if (promo.endsAt && now > new Date(promo.endsAt)) {
    return {
      allowed: false,
      message: "This promo code has expired."
    };
  }

  if (subtotal < Number(promo.minimumSpend || 0)) {
    return {
      allowed: false,
      message: `A minimum spend of ${displaySettingMoney(promo.minimumSpend)} is required.`
    };
  }

  return { allowed: true, message: "" };
}

function showPromoStatus(message, type = "") {
  promoCodeStatus.textContent = message;
  promoCodeStatus.classList.remove("success", "error");

  if (type) promoCodeStatus.classList.add(type);
}

function applyPromoCode() {
  const enteredCode = promoCodeInput.value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

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
  const currentDesignTotal = getOrderSubtotal();
  const cartSubtotal = cartHasItems ? currentDesignTotal : 0;

  headerCartCount.textContent = cartCount;
  sideCartCount.textContent = cartCount;
  cartDrawerSubtotal.textContent = `$${cartSubtotal.toFixed(2)}`;

  if (designTotalDisplay) {
    designTotalDisplay.textContent =
      `$${currentDesignTotal.toFixed(2)}`;
  }

  if (mobileOrderSummary) {
    mobileOrderSummary.textContent =
      `${totalKeychains} keychain${totalKeychains === 1 ? "" : "s"}`;
  }

  if (addCartButtonLabel) {
    addCartButtonLabel.textContent =
      cartHasItems ? "Update Cart" : "Add to Cart";
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

  if (isStandardProduct) {
    if (type === "base") {
      design.bases = [colour];
    }

    if (type === "letter") {
      design.letters = [colour];
    }

    // Normal keychains do not use caps.
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

  const [closureResult, unavailableDateResult, bulkUnavailableDateResult] = await Promise.all([
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

  const closureDates = (closureResult.data || []).map(item => ({
    from: item.start_date,
    to: item.end_date
  }));

  if (!closureResult.error) {
    shopClosureRanges = (closureResult.data || []).map(item => ({
      start_date: item.start_date,
      end_date: item.end_date,
      reason: item.reason || "Holiday closure"
    }));
  }

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
    reason: item.reason || "Holiday closure"
  }));

  updateTurnaroundMessaging();

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

  // Standard keychains must always keep one background
  // colour and one name colour.
  if (isStandardProduct) return;

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

  if (!isStandardProduct) {
    slot.title = "Click to remove this colour";
    slot.onclick = () => removeColourFromDesign(type, index);
  } else {
    slot.classList.add("is-fixed-colour");
  }
    slot.style.background = colour;
    container.appendChild(slot);
  });
}

function loadSTL(path) {
  if (geometryCache[path]) return Promise.resolve(geometryCache[path].clone());

  return new Promise((resolve, reject) => {
    loader.load(
      path,
      geometry => {
        geometry.computeVertexNormals();
        geometry.center();
        geometryCache[path] = geometry;
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

async function createKeycap(letter, index, design) {
  const group = new THREE.Group();

  const baseColour = design.bases[index % design.bases.length];
  const capColour = design.caps[index % design.caps.length];
  const letterColour = design.letters[index % design.letters.length];

  const selectedBaseShape =
    design.baseShape || "ribbed";

  const baseGeo = await loadSTL(
    BASE_SHAPES[selectedBaseShape].file
  );
  const base = new THREE.Mesh(baseGeo, createMat(baseColour));
  base.rotation.z = Math.PI / 2;
  group.add(base);

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

const selectedStandardSize = 24;
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

      materials.forEach(material => material.dispose());
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
    bevelEnabled = false,
    bevelSize = 0,
    bevelThickness = 0
  } = {}
) {
  const geometry = new TextGeometry(name, {
    font,
    size: selectedStandardSize,
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
  backgroundColour
) {
  const outlineRadius = 2.5;
  const outlineSteps = 32;
  const offsets = [[0, 0]];
  const contours = font
    .generateShapes(name, selectedStandardSize)
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
  backgroundColour
) {
  const outerRadius = 5;
  const innerRadius = 2.25;
  const depth = 3;
  const loopOverlap = 2.5;
  const loopX =
    -(textWidth / 2) - outerRadius + loopOverlap;
  const loopY =
    selectedStandardSize * 0.38 - textSourceCentreY;
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

    const textGeometryForWidth =
      createStandardTextGeometry(cleanName, font, 1.2);

    textGeometryForWidth.computeBoundingBox();

    const textWidth =
      textGeometryForWidth.boundingBox
        ? textGeometryForWidth.boundingBox.max.x -
          textGeometryForWidth.boundingBox.min.x
        : cleanName.length * selectedStandardSize * 0.6;

    const textSourceCentreY = Number(
      textGeometryForWidth.userData.sourceCentreY || 0
    );

    textGeometryForWidth.dispose();

    const backgroundGroup = createStandardBackground(
      cleanName,
      font,
      backgroundColour
    );

    const nameGeometry =
      createStandardTextGeometry(cleanName, font, 1.2);

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
      backgroundColour
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
  const previousNames = [...names];

  if (orderType === "single") {
    const value = singleName.value.trim() || "Alicia";

    const previousItem = previousNames[0];

    names = [
      {
        name: value,
        quantity: normalizeItemQuantity(singleQuantity?.value || previousItem?.quantity),
        groupContributorName: previousItem?.groupContributorName || null,

        // Keep the existing colours/design even when
        // the name or icon changes.
        custom: previousItem?.custom
          ? {
              baseShape:
                previousItem.custom.baseShape ||
                globalDesign.baseShape ||
                "ribbed",

              letterOrientation:
                previousItem.custom.letterOrientation ||
                globalDesign.letterOrientation ||
                "vertical",

              bases: [...previousItem.custom.bases],
              caps: [...previousItem.custom.caps],
              letters: [...previousItem.custom.letters]
            }
          : null
      }
    ];
  } else {
    const newNameValues = nameList.value
      .split("\n")
      .map(name => name.trim())
      .filter(Boolean);

    names = newNameValues.map((value, index) => {
      // First try matching the exact existing name.
      const exactMatch = previousNames.find(
        item => item.name === value
      );

      // If the name changed because an icon was added,
      // preserve the design from the same line/index.
      const previousItem =
        exactMatch || previousNames[index];

      return {
        name: value,
        quantity: getItemQuantity(previousItem),
        groupContributorName: previousItem?.groupContributorName || null,

        custom: previousItem?.custom
          ? {
              baseShape:
                previousItem.custom.baseShape ||
                globalDesign.baseShape ||
                "ribbed",

              letterOrientation:
                previousItem.custom.letterOrientation ||
                globalDesign.letterOrientation ||
                "vertical",

              bases: [...previousItem.custom.bases],
              caps: [...previousItem.custom.caps],
              letters: [...previousItem.custom.letters]
            }
          : null
      };
    });
  }

  if (selectedIndex >= names.length) {
    selectedIndex = Math.max(0, names.length - 1);
  }

  nameCount.textContent =
    `${names.length} name${names.length === 1 ? "" : "s"}`;

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

function createMiniPreview(name, design) {
  if (activeProduct.product_key === STANDARD_PRODUCT_KEY) {
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

function getDesignDescription(design) {
  if (activeProduct.product_key === STANDARD_PRODUCT_KEY) {
    return "Flat background · Raised name";
  }

  return `${
    design.baseShape === "bubbly" ? "Bubbly Base" : "Ribbed Base"
  } · ${
    design.letterOrientation === "horizontal"
      ? "Sideways letters"
      : "Upright letters"
  }`;
}

function renderNameCards() {
  nameCards.innerHTML = "";

  names.forEach((item, index) => {
    const card = document.createElement("button");
    card.className = "student-card";

    if (index === selectedIndex) card.classList.add("active");

    const design = getDesign(item);
    const price = calculatePrice(design, item.name);

    card.innerHTML = `
      <div class="name-card-top">
        <strong>${item.name}</strong>
        <span class="price-tag">$${price.toFixed(2)}</span>
      </div>

      <p class="hint">${getDesignDescription(design)}</p>

      <div class="mini-chain">
        ${createMiniPreview(item.name, design)}
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
    dimensionEstimate.innerHTML = `
      📏 <strong>${selectedName || "Finished size"}:</strong>
      ${getApproximateSizeText(selectedName)}
      <br><small>Approximate measurement; slight variation may occur after assembly.</small>
    `;
  }
}

function updateEditModeText() {
  const selectedItem = names[selectedIndex];

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

  editModeText.textContent = selectedItem
    ? `Currently editing: ${selectedItem.name}`
    : "Currently editing: selected keychain";

  resetSelected.style.display =
    orderType === "group"
      ? "block"
      : "none";
}

function updatePreviewColourLegend() {
  if (!previewColourLegend) return;

  const selectedItem = names[selectedIndex];
  const design = selectedItem ? getDesign(selectedItem) : globalDesign;
const parts =
  activeProduct.product_key === STANDARD_PRODUCT_KEY
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
            <i style="background:${colour}"></i>${getColourName(colour)}
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

  names.forEach((item, index) => {
    const design = getDesign(item);
    const unitPrice = calculatePrice(design, item.name);
    const itemQuantity = getItemQuantity(item);
    const price = roundMoney(unitPrice * itemQuantity);

    total += price;

    const row = document.createElement("div");
    row.className = "review-item";

    row.innerHTML = `
      <div class="review-item-heading">
        <div>
          <strong>${item.name}${itemQuantity > 1 ? ` × ${itemQuantity}` : ""}</strong>

          <p class="hint">${getDesignDescription(design)}</p>

          <p class="item-dimension-note">
            📏 ${getApproximateSizeText(item.name)}
          </p>
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
        ${createMiniPreview(item.name, design)}
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
          nameList.value = names
            .map(entry => entry.name)
            .join("\n");
        } else if (!names.length) {
          singleName.value = "";
        }

        if (selectedIndex >= names.length) {
          selectedIndex = Math.max(0, names.length - 1);
        }

        if (!names.length) {
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

  const promo = getAppliedPromo();
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

function getColourName(hex) {

    const colour = colours.find(
        c => c.colour.toLowerCase() === hex.toLowerCase()
    );

    return colour ? colour.name : hex;

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

async function submitOrder() {
  if (orderSubmissionInProgress || orderSubmitted) return;
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

  const unavailableSelections = names.reduce((allNames, item) => {
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
    (checkoutOrderType === "bulk" ||
      (checkoutOrderType === "rush" && !rushAutoApproved));

  const assignedNeededBy = ["rush", "bulk"].includes(checkoutOrderType)
    ? requestedCompletionDate.value
    : await findAutomaticAvailableDate();

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
  const orderData = names.flatMap(item => {
    const design = getDesign(item);

    return Array.from({ length: getItemQuantity(item) }, () => {
      const includesGiftingBag = expandedItemIndex === 0 && giftingBagQuantity > 0;
      expandedItemIndex += 1;

      return {
        product_key: activeProduct.product_key,
        product_name: activeProduct.name,
        name: item.name,
        clean_name: sanitizeName(item.name),
        group_contributor_name: item.groupContributorName || null,
        price: roundMoney(
          calculatePrice(design, item.name) +
          (includesGiftingBag ? giftingBagQuantity * GIFTING_BAG_PRICE : 0)
        ),
        gifting_bag: includesGiftingBag,
        gifting_bag_quantity: includesGiftingBag ? giftingBagQuantity : 0,

        design: {
          letter_orientation: design.letterOrientation || "vertical",
          base_shape: {
            key: design.baseShape || "ribbed",
            label: BASE_SHAPES[design.baseShape || "ribbed"].label
          },
          bases: design.bases.map(hex => ({
            name: getColourName(hex),
            hex
          })),
          caps: design.caps.map(hex => ({
            name: getColourName(hex),
            hex
          })),
          letters: design.letters.map(hex => ({
            name: getColourName(hex),
            hex
          }))
        }
      };
    });
  });

  const order = {
    order_ref: orderRef,
    client_submission_id: currentSubmissionId,
    product_key: activeProduct.product_key,
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
      : assignedNeededBy,
    review_status: isReviewRequest
      ? "Pending Review"
      : rushAutoApproved
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
        : checkoutOrderType === "bulk"
          ? "Bulk Review"
          : "Pending Payment",

    order_data: orderData
  };

  // First save the order.
  let orderWasAlreadySaved = false;
  try {
    const saveResult = await saveOrderToDatabase(order);
    orderWasAlreadySaved = saveResult.alreadySaved;
  } catch (error) {
    console.error("Unable to save order:", error);

    submitStatus.innerText =
      "Unable to save your order. Please try again.";

    return;
  }

  if (order.group_order_code && finalisingSharedGroupOwnerToken) {
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

    const subtotal = names.reduce(
        (sum, item) =>
          sum + calculatePrice(getDesign(item), item.name) * getItemQuantity(item),
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
  updateBaseShapeButtons();
  updateLetterOrientationButtons();
  updateGiftingBagOptions();
  updateCartDisplay();
  updateTurnaroundMessaging();
  renderReviewOrder();
}

function buildSelectedPreview() {
  if (!names.length) {
    previewBuildNumber += 1;
    clearKeychainPreview();
    previewLoading?.classList.add("hidden");
    return;
  }

  const item = names[selectedIndex];
  const design = getDesign(item);

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
  nameList.value = restored.map(item => item.name).join("\n");
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
  nameList.value = names.map(item => item.name).join("\n");
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

  if (!cartHasItems || !names.length) {
    cartDrawerItems.innerHTML = `
      <div class="empty-cart">
        <div class="empty-cart-icon">♡</div>
        <h3>Your cart is empty</h3>
        <p>Design a personalised keychain to get started.</p>
      </div>
    `;

    checkoutFromCartBtn.disabled = true;
    checkoutFromCartBtn.textContent = "Add a keychain first";
    sharedGroupCartBtn.classList.remove("hidden");
    sharedGroupCartBtn.disabled = !activeSharedGroup?.is_owner;
    sharedGroupCartBtn.textContent = activeSharedGroup?.is_owner
      ? "Review Group Order"
      : activeSharedGroup
        ? "Design a keychain first"
        : "Start a Group Order";
    continueShoppingBtn.textContent = "Start Designing";
    return;
  }

  checkoutFromCartBtn.disabled = false;
  checkoutFromCartBtn.textContent = activeSharedGroup && !activeSharedGroup.is_owner
    ? `Add to ${activeSharedGroup.title}`
    : "Checkout";
  sharedGroupCartBtn.classList.toggle(
    "hidden",
    Boolean(activeSharedGroup && !activeSharedGroup.is_owner)
  );
  sharedGroupCartBtn.disabled = false;
  sharedGroupCartBtn.textContent = activeSharedGroup?.is_owner
    ? "Save My Cart to Group Order"
    : activeSharedGroup
      ? `Add Basket to ${activeSharedGroup.title}`
      : "Start a Group Order";
  continueShoppingBtn.textContent = "Continue Designing";

  cartDrawerItems.innerHTML = names
    .map((item, index) => {
      const design = getDesign(item);
      const unitPrice = calculatePrice(design, item.name);
      const itemQuantity = getItemQuantity(item);
      const price = roundMoney(unitPrice * itemQuantity);
      const designDescription = getDesignDescription(design);

      return `
        <div class="cart-drawer-item">
          <div class="cart-item-top">
            <div>
              <strong>${item.name}${itemQuantity > 1 ? ` × ${itemQuantity}` : ""}</strong>
              <p>${designDescription}</p>
              ${itemQuantity > 1 ? `<p>${displaySettingMoney(unitPrice)} each</p>` : ""}
              <p class="item-dimension-note">
                📏 ${getApproximateSizeText(item.name)}
              </p>
            </div>

            <strong class="cart-item-price">
              $${price.toFixed(2)}
            </strong>
          </div>

          <div class="mini-chain">
            ${createMiniPreview(item.name, design)}
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
              class="remove-cart-item"
              onclick="window.removeCartItem(${index})"
            >
              Remove
            </button>
          </div>
        </div>
      `;
    })
    .join("");

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

  closeCartDrawer();

  refreshUI();
  buildSelectedPreview();
  setStorefrontView("design", {
    scrollTo: "designArea"
  });
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

  if (names.length === 0) {
    cartHasItems = false;
    selectedIndex = 0;
  } else if (selectedIndex >= names.length) {
    selectedIndex = names.length - 1;
  }

  if (orderType === "group") {
    nameList.value =
      names.map(item => item.name).join("\n");
  }

  refreshUI();
  buildSelectedPreview();
  renderCartDrawer();
  await syncSharedGroupOwnerBasket();
};

function proceedToCheckout() {
  if (!cartHasItems || !names.length) {
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

    if (designInspiration) {
  designInspiration.style.display =
    isNormalKeychain ? "none" : "";
}

    if (dimensionEstimate) {
  dimensionEstimate.style.display =
    isNormalKeychain ? "none" : "";
}

  document.body.classList.toggle(
    "standard-product-selected",
    isNormalKeychain
  );

  const standardOptions =
    document.getElementById("standardKeychainOptions");

  if (standardOptions) {
    standardOptions.style.display =
      isNormalKeychain ? "block" : "none";
  }

  document
    .querySelectorAll(".clicky-only-option")
    .forEach(section => {
      section.style.display =
        isNormalKeychain ? "none" : "";
    });

  const baseHeading = document.querySelector(
    '[data-colour-accordion="base"] h3'
  );

  const letterHeading = document.querySelector(
    '[data-colour-accordion="letter"] h3'
  );

  if (baseHeading) {
    baseHeading.textContent =
      isNormalKeychain
        ? "Background Colour"
        : "Base Colours";
  }

  if (letterHeading) {
    letterHeading.textContent =
      isNormalKeychain
        ? "Name Colour"
        : "Letter Colours";
  }

  const nameLimit = Math.max(
    1,
    Number(activeProduct.maximum_characters) || 10
  );

  singleName.maxLength = nameLimit;
  nameList.maxLength = nameLimit * 250;

  updateNames();
}

document
  .querySelectorAll("[data-view-target]")
  .forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();

      const productKey = button.dataset.productKey;

      if (productKey) {
        activeProduct = getProductByKey(
          productCatalog,
          productKey
        );

        updateProductCustomiser();
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
  if (names[selectedIndex]) {
    names[selectedIndex].custom = null;
    refreshUI();
    buildSelectedPreview();
  }
};

randomiseColoursBtn?.addEventListener("click", randomiseArticulatedColours);

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

    paymentScreen.classList.add("hidden");
    checkoutScreen.classList.remove("hidden");

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

    if (!customerName.value.trim()) {
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

function saveDraft() {
  if (
    orderSubmitted ||
    !draftHasMeaningfulChanges
  ) {
    return;
  }

  const draft = {
    orderType,
    names,
    selectedIndex,
    globalDesign,
    cartHasItems,
    appliedPromoCode,

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
        ICON_CATEGORIES.find(item => item.key === categoryKey) ||
        ICON_CATEGORIES[0];

      tabs.querySelectorAll(".icon-category-tab").forEach(tab => {
        const isActive = tab.dataset.iconCategory === category.key;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
      });

      grid.innerHTML = "";

      category.icons
        .filter(icon => specialKeycaps[icon])
        .forEach(icon => {
          const button = document.createElement("button");
          const iconName = specialKeycaps[icon];

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

    ICON_CATEGORIES.forEach(category => {
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
    showCategory("popular");
  }

  buildPicker(singlePicker, singleName);
  buildPicker(groupPicker, nameList);
}

function setupColourAccordions() {
  const accordions = Array.from(
    document.querySelectorAll("[data-colour-accordion]")
  );

  accordions.forEach(accordion => {
    const toggle = accordion.querySelector(".colour-accordion-toggle");
    if (!toggle) return;

    toggle.addEventListener("click", () => {
      const willOpen = !accordion.classList.contains("is-open");

      accordions.forEach(item => {
        item.classList.remove("is-open");
        item
          .querySelector(".colour-accordion-toggle")
          ?.setAttribute("aria-expanded", "false");
      });

      if (willOpen) {
        accordion.classList.add("is-open");
        toggle.setAttribute("aria-expanded", "true");
      }
    });
  });
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

window.updatePickupTimeOptions = function(selectedValue = "") {
  const dateInput = document.getElementById("pickupScheduleDate");
  const timeSelect = document.getElementById("pickupScheduleTime");
  if (!dateInput || !timeSelect) return;

  const ranges = getPickupTimeRanges(
    dateInput.value,
    shopSettings.pickup_time_options
  );

  timeSelect.innerHTML = ranges.length
    ? `
      <option value="">Choose a time</option>
      ${ranges.map(range => `
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
  const pickupDateBounds = getPickupDateBounds();
  const pickupDate =
    order.pickup_scheduled_date || pickupDateBounds.minimum;
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
              type="date"
              min="${pickupDateBounds.minimum}"
              max="${pickupDateBounds.maximum}"
              value="${escapePresetText(pickupDate)}"
              onchange="window.updatePickupTimeOptions()"
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
  const restored = (items || []).map(item => {
    const design = item.design || {};
    return {
      name: item.name || item.clean_name || "Alicia",
      quantity: normalizeItemQuantity(item.quantity || 1),
      custom: {
        baseShape: design.base_shape?.key || design.baseShape || "ribbed",
        letterOrientation: design.letter_orientation || design.letterOrientation || "vertical",
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

loadDraft();

const paymentReturnParams = new URLSearchParams(window.location.search);
const paymentReturnState = paymentReturnParams.get("payment");

if (["success", "cancelled"].includes(paymentReturnState)) {
  const returnedOrderRef = paymentReturnParams.get("order_ref") || "";
  const modalHeading = successModal.querySelector("h2");
  const modalParagraphs = successModal.querySelectorAll(".modal-card > p");

  draftModal.classList.add("hidden");

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
