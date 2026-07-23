import "./style.css";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import confetti from "canvas-confetti";
import { createClient } from "@supabase/supabase-js";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";

const isManualOrder =
  new URLSearchParams(window.location.search).get("manual") === "true";

console.log("Manual mode:", isManualOrder);

const SUPABASE_URL = "https://jetamtthfenjyzcdklqm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_IXgEB4mpCTF3zOhkulGOYw_fcDwgiHf";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DEFAULT_SHOP_SETTINGS = {
  usual_base_price: 3.9,
  launch_base_price: 3.2,
  launch_price_enabled: true,
  included_characters: 6,
  extra_character_price: 0.2,
  extra_base_colour_price: 0.5,
  extra_cap_colour_price: 0.3,
  extra_letter_colour_price: 0.2,
  delivery_fee: 2.5,
  free_delivery_threshold: 50,
  large_order_quantity: 5,
  standard_min_working_days: 2,
  standard_max_working_days: 3,
  large_min_working_days: 3,
  large_max_working_days: 4,
  bulk_order_quantity: 10,
  rush_fee_small: 5,
  rush_fee_large: 8,
  stripe_enabled: false,
  unavailable_colours: [],
  promo_code: "CHILDRENSDAY",
  promo_percent_off: 10,
  promo_enabled: true
};

let shopSettings = { ...DEFAULT_SHOP_SETTINGS };

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
  }
];

let designPresets = [...DEFAULT_DESIGN_PRESETS];
let promoCodeRows = [];

try {
  const { data, error } = await supabase
    .from("shop_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  if (data) shopSettings = { ...shopSettings, ...data };
} catch (error) {
  console.warn("Using default shop pricing settings:", error);
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
      "code,label,discount_type,discount_value,minimum_spend,starts_at,ends_at,active"
    )
    .eq("active", true);

  if (error) throw error;
  promoCodeRows = data || [];
} catch (error) {
  console.warn("Using the fallback promo code setting:", error);
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

const usualBasePrice = getSettingNumber("usual_base_price", 3.9);
const launchBasePrice = getSettingNumber("launch_base_price", 3.2);
const launchPriceEnabled = shopSettings.launch_price_enabled !== false;
const displayedBasePrice = launchPriceEnabled
  ? launchBasePrice
  : usualBasePrice;
const deliveryFeeSetting = getSettingNumber("delivery_fee", 2.5);
const freeDeliveryThreshold = getSettingNumber("free_delivery_threshold", 50);
const largeOrderQuantity = Math.max(
  2,
  Math.round(getSettingNumber("large_order_quantity", 5))
);
const standardMinWorkingDays = Math.max(
  1,
  Math.round(getSettingNumber("standard_min_working_days", 2))
);
const standardMaxWorkingDays = Math.max(
  standardMinWorkingDays,
  Math.round(getSettingNumber("standard_max_working_days", 3))
);
const largeMinWorkingDays = Math.max(
  standardMinWorkingDays,
  Math.round(getSettingNumber("large_min_working_days", 3))
);
const largeMaxWorkingDays = Math.max(
  largeMinWorkingDays,
  Math.round(getSettingNumber("large_max_working_days", 4))
);
const bulkOrderQuantity = Math.max(
  largeOrderQuantity + 1,
  Math.round(getSettingNumber("bulk_order_quantity", 10))
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
    <span>Handmade in Singapore</span>
  </div>

  <span class="announcement-divider"></span>

  <div class="announcement-item">
    <span class="announcement-icon">▣</span>
    <span>Free islandwide delivery above ${displaySettingMoney(freeDeliveryThreshold)}</span>
  </div>

  <span class="announcement-divider"></span>

  <div class="announcement-item announcement-holiday">
    <span class="announcement-icon">▧</span>

    <span>
      <strong>Holiday Notice:</strong>
      <span id="holidayNoticeText">
        No current announcements.
      </span>
    </span>
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

  <a href="#" class="site-logo">
    <span class="logo-flower">✿</span>
    Little Keeps
  </a>

  <nav class="top-nav" aria-label="Main navigation">
    <button type="button" class="is-active" data-scroll-target="homeSection">
      Shop
    </button>
    <button type="button" data-scroll-target="designArea">
      Design
    </button>
    <button type="button" data-scroll-target="orderStatusSection">
      Track / Pay Order
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
      data-scroll-target="homeSection"
    >
      <span>⌂</span>
      Home
    </button>

    <button
      type="button"
      class="side-nav-link"
      data-scroll-target="designArea"
    >
      <span>✿</span>
      Design Your Keychain
    </button>

    <button
      type="button"
      class="side-nav-link"
      data-scroll-target="orderStatusSection"
    >
      <span>◎</span>
      Track / Pay Order
    </button>

    <button
      type="button"
      class="side-nav-link"
      data-scroll-target="contactSection"
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
    <p>Personalised and made with love in Singapore.</p>

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
      id="checkoutFromCartBtn"
      type="button"
      class="submit-btn"
    >
      Checkout
    </button>
  </div>
</aside>

<section id="designScreen" class="design-screen">

<section id="homeSection" class="storefront-hero">
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
        Design your own personalised, clicky and
        fidget-friendly keychain in your favourite colours.
      </p>

      <button
        id="startDesignBtn"
        type="button"
        class="hero-button"
      >
        Start Designing
        <span>→</span>
      </button>
    </div>

    <div class="hero-offer-card">
      <div class="hero-offer-top">
        <div>
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

        <span class="character-inclusion">
          ✓ Up to ${getSettingNumber("included_characters", 6)} characters
          <small>
            Letters, numbers and icons each count as one character.
          </small>
        </span>
        <span>✓ 1 base, 1 cap and 1 letter/icon colour</span>
        <span>✓ Clicky switches and keyring</span>
      </div>

      <div class="hero-compact-size">
        <strong>📏 Size note:</strong>
        A 6-character keychain is approximately 17.5 cm long.
      </div>

      <details class="hero-more-details">
        <summary>View size &amp; extra charges</summary>

        <div class="hero-pricing-guide">
          <p>Approximate size</p>

          <div class="hero-price-row">
            <span>Each character block</span>
            <strong>3.5 × 2.7 cm</strong>
          </div>

          <p style="margin-top:14px;">Optional additions</p>

          <div class="hero-price-row">
            <span>Each character after ${getSettingNumber("included_characters", 6)}</span>
            <strong>+${displaySettingMoney(getSettingNumber("extra_character_price", 0.2))}</strong>
          </div>

          <div class="hero-price-row">
            <span>Extra base colour</span>
            <strong>+${displaySettingMoney(getSettingNumber("extra_base_colour_price", 0.5))}</strong>
          </div>

          <div class="hero-price-row">
            <span>Extra cap colour</span>
            <strong>+${displaySettingMoney(getSettingNumber("extra_cap_colour_price", 0.3))}</strong>
          </div>

          <div class="hero-price-row">
            <span>Extra letter/icon colour</span>
            <strong>+${displaySettingMoney(getSettingNumber("extra_letter_colour_price", 0.2))}</strong>
          </div>

        </div>
      </details>
    </div>
  </div>

  <div class="hero-decoration hero-decoration-one"></div>
  <div class="hero-decoration hero-decoration-two"></div>
</section>

<section class="value-props" aria-label="Why shop with Little Keeps">
  <article>
    <span>✦</span>
    <div>
      <strong>Design it live</strong>
      <small>See every colour in the 3D preview</small>
    </div>
  </article>

  <article>
    <span>♡</span>
    <div>
      <strong>Made in Singapore</strong>
      <small>Printed, assembled and checked by hand</small>
    </div>
  </article>

  <article>
    <span>◷</span>
    <div>
      <strong>Ready in 2–3 working days</strong>
      <small>Large orders are ready in 3–4 working days</small>
    </div>
  </article>
</section>

<section id="designArea" class="shop-section">
  <div class="customer-progress" aria-label="Order progress">
    <div class="customer-progress-step is-active"><span>1</span>Design</div>
    <div class="customer-progress-step"><span>2</span>Details</div>
    <div class="customer-progress-step"><span>3</span>Review</div>
    <div class="customer-progress-step"><span>4</span>Payment</div>
  </div>

  <div class="section-heading">
    <p class="section-eyebrow">Create yours</p>

    <h2>Design Your Keychain</h2>

    <p>
      Enter your name, choose your style and preview
      your personalised keychain in 3D.
    </p>
  </div>

  <div class="designer-setup">
    <div class="designer-setup-heading">
      <p class="section-eyebrow">Start here</p>
      <h2>Who are you designing for?</h2>

      <p>
        Choose one keychain or enter several names for a group order.
      </p>
    </div>

    <div class="setup-grid">
      <div class="card order-type-card">
        <h3>Order Type</h3>

        <p class="hint">
          Choose single for one keychain, or group for multiple names.
        </p>

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
      </div>

      <div class="card names-card">
        <div id="singleSection">
          <h3>Enter Name</h3>

          <p class="hint">
            Type your name, then tap an icon if you want to add one.
          </p>

          <input
            id="singleName"
            value="Alicia"
            maxlength="10"
          >

          <div id="iconPicker" class="icon-picker"></div>
        </div>

        <div id="groupSection" class="hidden">
          <h3>Enter Names</h3>

          <p class="hint">
            Enter one name per line.
          </p>

          <textarea
            id="nameList"
            placeholder="Paste names here, one per line"
          >Alicia
Ben
Chloe</textarea>

          <p id="nameCount">3 names</p>

          <p class="hint">
            Tap an icon to add it to the current line.
          </p>

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

          <p class="hint">
            For group orders, select the keychain you want to customise.
          </p>
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
              <p class="section-eyebrow">Live preview</p>
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

      <div class="design-inspiration">
        <h3>Need inspiration? ✨</h3>
        <p>Tap a colour idea to try it on your current keychain.</p>

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
          <p class="section-eyebrow">Make it yours</p>
          <h2>Customise Your Design</h2>

          <p>
            Choose your base shape, base colours,
            cap colours and letter colours.
          </p>
        </div>

        <div class="customisation-section">
          <div class="customisation-title">
            <div>
              <h3>Base Shape</h3>
              <p>Choose the shape of the keychain base.</p>
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

        <div class="customisation-section">
          <div class="customisation-title">
            <div>
              <h3>Letter Orientation</h3>
              <p>Choose how the letters and icons should face.</p>
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
              <p>Select one or more base colours.</p>
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

        <div class="customisation-section colour-accordion" data-colour-accordion="cap">
          <button type="button" class="customisation-title colour-accordion-toggle" aria-expanded="false">
            <div>
              <h3>Cap Colours</h3>
              <p>Select one or more top cap colours.</p>
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
              <p>Select one or more raised letter colours.</p>
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
            <strong>Looking for another colour?</strong>

            <p>
              Message us on WhatsApp. We may be able to
              specially order it at no additional cost.
            </p>

            <a
              href="https://wa.me/6585121915"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ask about another colour →
            </a>
          </div>
        </div>

        <p class="screen-colour-note">
          Colours shown on screen are for reference only.
          Slight differences may occur between monitors
          and filament batches.
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
    🕒 Ready for pickup/dispatch in approximately 2–3 working days.
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
  <p>Tell us how you would like to receive your order.</p>
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

        <div id="bulkOrderNotice" class="bulk-order-notice hidden">
          <strong>Bulk order request</strong>
          <p>For 10 or more keychains, tell us your preferred completion date. We’ll confirm availability before requesting payment.</p>
        </div>

        <label for="collectionMethod">
          Collection Method
        </label>

        <select id="collectionMethod">
          <option value="pickup">
            📍 Pick Up at Woodlands MRT
          </option>

          <option value="delivery">
            🚚 Islandwide Delivery (+${displaySettingMoney(deliveryFeeSetting)})
          </option>
        </select>

        <div
          id="deliveryAddressSection"
          class="hidden"
        >
          <label for="deliveryAddressLine1">
            Delivery Address
          </label>

          <input
            id="deliveryAddressLine1"
            type="text"
            placeholder="Block and street name"
          >

          <input
            id="deliveryAddressLine2"
            type="text"
            placeholder="Unit number, e.g. #12-34"
          >

          <input
            id="deliveryPostalCode"
            type="text"
            inputmode="numeric"
            maxlength="6"
            placeholder="Postal code"
          >
        </div>

        <p id="deliveryNote" class="hint"></p>

        <textarea
          id="orderNotes"
          placeholder="Additional order notes (optional)..."
        ></textarea>
      </div>

      <div class="review-box">
<h3>Order Summary</h3>

        <div class="review-summary">
          <p>
            Total names:
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
        <p>Enter it here before submitting your order.</p>

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

        <p>
          Payment is via PayNow only.
        </p>

        <p>
          After submitting, you’ll see the QR code
          and exact amount to pay.
        </p>
      </div>

<div class="checkout-submit-bar">
  <div class="checkout-sticky-figures">
    <span id="checkoutStickyCount">1 keychain</span>
    <strong id="checkoutStickyTotal">$0.00</strong>
  </div>

  <button
    id="submitOrderBtn"
    class="submit-btn"
    disabled
  >
    Submit Order & Continue to Payment
  </button>
</div>

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
        </div>

        <h2>Pay with PayNow</h2>
        <p class="payment-total-label">Total due</p>
        <strong id="paymentTotal" class="payment-total-value"></strong>

        ${shopSettings.stripe_enabled ? `
          <div class="online-payment-panel">
            <p>We’ll open a secure Stripe page with your exact PayNow amount. Your production slot is held for about 30 minutes once it opens.</p>
            <button id="stripeCheckoutBtn" type="button" class="submit-btn">Continue to PayNow</button>
            <p id="stripeCheckoutStatus" class="hint"></p>
          </div>
          <p class="hint">Payment is confirmed automatically - no screenshot needed. Your confirmation and order PDF will be emailed after payment. Please check Spam or Junk if it’s not in your inbox.</p>
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

        <p>Thank you! We’ve received your order.</p>

        <p id="orderRefText"></p>

        <p>
          We’ll contact you nearer to your
          collection or delivery date.
        </p>

        <p class="hint">
          📧 Please check your email for your order reference and return link.<br>
          If you don’t see it, kindly check your Junk or Spam folder too.
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

<section id="orderStatusSection" class="order-status-section">
  <div class="order-status-copy">
    <p class="section-eyebrow">Already ordered?</p>
    <h2>Track or pay for your order</h2>
    <p>
      Enter your order reference and the same email address used at checkout.
      Unpaid orders can continue to PayNow here.
    </p>
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

<section id="contactSection" class="contact-section">
  <div class="contact-copy">
    <p class="section-eyebrow">Say hello</p>
    <h2>Need a little help?</h2>

    <p>
      Have a colour request, group order or custom idea?
      Send us a message and we’ll be happy to help.
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

  <p>
    Personalised keepsakes, lovingly made in Singapore.
  </p>

  <small>
    © ${new Date().getFullYear()} Little Keeps
  </small>
</footer>

  </main>
`;

const BASE_PRICE = displayedBasePrice;
const INCLUDED_CHARACTERS = getSettingNumber("included_characters", 6);
const EXTRA_CHARACTER_PRICE = getSettingNumber("extra_character_price", 0.2);

const INCLUDED_BASE_COLOURS = 1;
const INCLUDED_CAP_COLOURS = 1;
const INCLUDED_LETTER_COLOURS = 1;

const EXTRA_BASE_COLOUR_PRICE = getSettingNumber("extra_base_colour_price", 0.5);
const EXTRA_CAP_COLOUR_PRICE = getSettingNumber("extra_cap_colour_price", 0.3);
const EXTRA_LETTER_COLOUR_PRICE = getSettingNumber("extra_letter_colour_price", 0.2);

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

const canvas = document.getElementById("previewCanvas");
const singleBtn = document.getElementById("singleBtn");
const groupBtn = document.getElementById("groupBtn");
const singleSection = document.getElementById("singleSection");
const groupSection = document.getElementById("groupSection");
const singleName = document.getElementById("singleName");
const nameList = document.getElementById("nameList");
const nameCount = document.getElementById("nameCount");
const nameCards = document.getElementById("nameCards");
const nameCardsSection = document.getElementById("nameCardsSection");
const applyAllToggle = document.getElementById("applyAllToggle");
const editModeText = document.getElementById("editModeText");
const dimensionEstimate = document.getElementById("dimensionEstimate");
const inspirationStatus = document.getElementById("inspirationStatus");

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
const deliveryNote = document.getElementById("deliveryNote");
const orderNotes = document.getElementById("orderNotes");
const submitOrderBtn = document.getElementById("submitOrderBtn");
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

const designScreen = document.getElementById("designScreen");
const checkoutScreen = document.getElementById("checkoutScreen");
const paymentScreen =
document.getElementById("paymentScreen");
const paymentOrderRef =
document.getElementById("paymentOrderRef");
const paymentTotal =
document.getElementById("paymentTotal");
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
let shopClosureRanges = [];
let rushAssessment = null;
let rushAssessmentRequest = 0;
let rushAssessmentFingerprint = "";

function getTurnaroundInfo(quantity = names.length || 1) {
  const isLargeOrder = quantity >= largeOrderQuantity;

  return {
    quantity,
    isLargeOrder,
    minDays: isLargeOrder
      ? largeMinWorkingDays
      : standardMinWorkingDays,
    maxDays: isLargeOrder
      ? largeMaxWorkingDays
      : standardMaxWorkingDays
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

function getAutomaticReadyDate() {
  const turnaround = getTurnaroundInfo();
  return addWorkingDays(new Date(), turnaround.maxDays);
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

function getCheckoutOrderType() {
  if (names.length >= bulkOrderQuantity) return "bulk";
  if (rushOrderToggle?.checked) return "rush";
  return "standard";
}

function getRushFee() {
  if (getCheckoutOrderType() !== "rush") return 0;
  return names.length <= 4 ? rushFeeSmall : rushFeeLarge;
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

    characters.forEach((character, index) => {
      const baseName = getColourName(design.bases[index % design.bases.length]);
      const capName = getColourName(design.caps[index % design.caps.length]);
      const letterName = getColourName(design.letters[index % design.letters.length]);
      add(`${baseName} ${shapeLabel} Base`);
      add(
        `${capName} Cap + ${letterName} Letter - ${character}` +
        (orientation === "horizontal" ? " - Sideways" : "")
      );
    });
  });

  const characterCount = names.reduce(
    (sum, item) => sum + Array.from(sanitizeName(item.name)).length,
    0
  );
  add("Mechanical Switch", characterCount);
  add("Key Ring", names.length);
  add("Jump Ring", names.length);
  return needs;
}

function getRushFingerprint() {
  return JSON.stringify({
    date: requestedCompletionDate.value,
    quantity: names.length,
    needs: getRushInventoryNeeds()
  });
}

function showRushAssessment(assessment) {
  rushAvailabilityResult.classList.remove("hidden", "is-available", "is-review", "is-unavailable", "is-checking");
  rushAvailabilityResult.classList.add(`is-${assessment.status}`);

  const heading = assessment.status === "available"
    ? `Rush available - +${displaySettingMoney(assessment.fee)}`
    : assessment.status === "review"
      ? "Manual review needed"
      : assessment.status === "checking"
        ? "Checking rush availability…"
        : "Rush unavailable for this date";

  const customerMessage = assessment.status === "review"
    ? "We’ll check this request and contact you before payment."
    : assessment.status === "unavailable"
      ? "Please choose another date."
      : assessment.status === "checking"
        ? "One moment please."
        : "";

  rushAvailabilityResult.innerHTML = `
    <strong>${heading}</strong>
    ${customerMessage ? `<span>${customerMessage}</span>` : ""}
  `;
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
    (sum, item) => sum + Array.from(sanitizeName(item.name)).length,
    0
  );
  const { data, error } = await supabase.rpc("assess_rush_order", {
    p_requested_date: requestedCompletionDate.value,
    p_keychain_count: names.length,
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

function updateTurnaroundMessaging() {
  const turnaround = getTurnaroundInfo();
  const itemWord = turnaround.quantity === 1 ? "keychain" : "keychains";
  const methodIsDelivery = collectionMethod.value === "delivery";
  const range = `${turnaround.minDays}–${turnaround.maxDays} working days`;
  const estimateStart = addWorkingDays(new Date(), turnaround.minDays);
  const estimateEnd = addWorkingDays(new Date(), turnaround.maxDays);
  const weekdayOnlyEnd = addWeekdaysOnly(new Date(), turnaround.maxDays);
  const includesHolidayClosure = estimateEnd.getTime() > weekdayOnlyEnd.getTime();
  const isBulk = turnaround.quantity >= bulkOrderQuantity;
  const isRush = !isBulk && Boolean(rushOrderToggle?.checked);

  neededBy.value = isBulk || isRush
    ? requestedCompletionDate.value
    : toLocalDateString(estimateEnd);

  if (turnaroundSummary) {
    turnaroundSummary.innerHTML = `
      🕒 <strong>${turnaround.quantity} ${itemWord}</strong>
      ready for pickup/dispatch in approximately <strong>${range}</strong>.
    `;
  }

  automaticDateLabel.textContent = methodIsDelivery
    ? "Estimated dispatch"
    : "Estimated ready for collection";
  automaticDateRange.textContent = `${formatEstimateDate(estimateStart)}–${formatEstimateDate(estimateEnd)}`;
  automaticDateNote.textContent = includesHolidayClosure
    ? "Our holiday closure is already included in this estimate."
    : "Based on our current production schedule.";

  automaticDateCard.classList.toggle("hidden", isBulk || isRush);
  rushOrderOption.classList.toggle("hidden", isBulk);
  bulkOrderNotice.classList.toggle("hidden", !isBulk);
  specialDateSection.classList.toggle("hidden", !isBulk && !isRush);

  if (isBulk) {
    specialDateLabel.textContent = "Preferred completion date";
    specialOrderMessage.textContent = "We’ll review your bulk request and contact you before payment.";
    orderNotes.placeholder = "Customer notes for your bulk order...";
  } else if (isRush) {
    specialDateLabel.textContent = "When do you need it?";
    specialOrderMessage.textContent = "Only dates earlier than the standard estimate are shown. Choose a date and we’ll check availability instantly.";
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
    rushAvailabilityResult.classList.add("hidden");
  }

  if (specialDateCalendar) {
    const tomorrow = addWorkingDays(new Date(), 1);
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
      minDate: tomorrow,
      maxDate: calendarMaxDate
    });

    // Flatpickr can remain parked on the old maximum month after its range
    // changes. Reset only when the order mode changes so month navigation
    // remains natural while the customer is choosing a date.
    if (calendarMode !== specialDateCalendarMode) {
      const selectedDate = specialDateCalendar.selectedDates[0];
      const dateToShow = selectedDate || tomorrow;

      specialDateCalendar.jumpToDate(dateToShow, false);
      specialDateCalendarMode = calendarMode;
    }
  }

  if (submitOrderBtn) {
    submitOrderBtn.textContent = isBulk
      ? "Submit Bulk Request"
      : isRush
        ? "Submit Rush Request"
        : "Submit Order & Continue to Payment";
  }
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
let selectedIndex = 0;
let orderSubmitted = false;

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
  const extraBaseColours = Math.max(
    0,
    getUniqueColourCount(design.bases) -
      INCLUDED_BASE_COLOURS
  );

  const extraCapColours = Math.max(
    0,
    getUniqueColourCount(design.caps) -
      INCLUDED_CAP_COLOURS
  );

  const extraLetterColours = Math.max(
    0,
    getUniqueColourCount(design.letters) -
      INCLUDED_LETTER_COLOURS
  );

  const characterCount = Array.from(sanitizeName(name)).length;
  const extraCharacters = Math.max(
    0,
    characterCount - INCLUDED_CHARACTERS
  );

  return (
    BASE_PRICE +
    extraCharacters * EXTRA_CHARACTER_PRICE +
    extraBaseColours * EXTRA_BASE_COLOUR_PRICE +
    extraCapColours * EXTRA_CAP_COLOUR_PRICE +
    extraLetterColours * EXTRA_LETTER_COLOUR_PRICE
  );
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

function makeSwatches(containerId, colourOptions, type) {
  const container = document.getElementById(containerId);
  const hint = document.getElementById(`${type}ColourHint`);

  container.innerHTML = "";

  if (hint) {
    hint.textContent = "Hover or tap a colour";
  }

  colourOptions.forEach(item => {
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

    container.appendChild(btn);
  });
}

backBtn.onclick = () => {
  checkoutScreen.classList.add("hidden");
  paymentScreen.classList.add("hidden");
  designScreen.classList.remove("hidden");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
};

function getOrderSubtotal() {
  return names.reduce(
    (sum, item) =>
      sum + calculatePrice(getDesign(item), item.name),
    0
  );
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
  const cartCount = cartHasItems ? names.length : 0;
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
      `${names.length} keychain${names.length === 1 ? "" : "s"}`;
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

  if (type === "base") design.bases.push(colour);
  if (type === "cap") design.caps.push(colour);
  if (type === "letter") design.letters.push(colour);

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

  const [closureResult, unavailableDateResult] = await Promise.all([
    supabase
      .from("shop_closures")
      .select("start_date, end_date")
      .gte("end_date", today),
    supabase.rpc("get_unavailable_needed_by_dates", {
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

  const disabledDates = [
    ...closureDates,
    ...fullOrderDates
  ];

  specialDateCalendar = flatpickr(requestedCompletionDate, {
    dateFormat: "Y-m-d",
    minDate,
    maxDate,
    disable: disabledDates,

    onOpen: (_selectedDates, _dateString, instance) => {
      const firstAvailableDate = addWorkingDays(new Date(), 1);
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
      }
      validateForm();
    }
  });

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

  if (!data.length) return;

  const notice = data[0];

  document.getElementById("holidayNoticeText").innerText =
    notice.reason || `We will be away from ${notice.start_date} to ${notice.end_date}.`;
}

function removeColourFromDesign(type, index) {
  const design = getActiveDesign();

  if (type === "base" && design.bases.length > 1) design.bases.splice(index, 1);
  if (type === "cap" && design.caps.length > 1) design.caps.splice(index, 1);
  if (type === "letter" && design.letters.length > 1) design.letters.splice(index, 1);

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
    slot.style.background = colour;
    slot.title = "Click to remove this colour";
    slot.onclick = () => removeColourFromDesign(type, index);
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

let previewBuildNumber = 0;

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

      <p class="hint">
        ${design.baseShape === "bubbly" ? "Bubbly Base" : "Ribbed Base"}
        · ${design.letterOrientation === "horizontal" ? "Sideways letters" : "Upright letters"}
      </p>

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

function autoSave(){

    saveDraft();

}

setInterval(autoSave,3000);

function renderReviewOrder() {
  let total = 0;

  reviewCount.innerText = names.length;
  reviewList.innerHTML = "";

  names.forEach((item, index) => {
    const design = getDesign(item);
    const price = calculatePrice(design, item.name);

    total += price;

    const row = document.createElement("div");
    row.className = "review-item";

    row.innerHTML = `
      <div class="review-item-heading">
        <div>
          <strong>${item.name}</strong>

          <p class="hint">
            ${
              design.baseShape === "bubbly"
                ? "Bubbly Base"
                : "Ribbed Base"
            }
            · ${design.letterOrientation === "horizontal" ? "Sideways letters" : "Upright letters"}
          </p>

          <p class="item-dimension-note">
            📏 ${getApproximateSizeText(item.name)}
          </p>
        </div>

        <span class="price-tag">
          $${price.toFixed(2)}
        </span>
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

        checkoutScreen.classList.add("hidden");
        paymentScreen.classList.add("hidden");
        designScreen.classList.remove("hidden");

        refreshUI();
        buildSelectedPreview();

        document
          .getElementById("designArea")
          .scrollIntoView({
            behavior: "smooth",
            block: "start"
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

  const deliveryFee =
    collectionMethod.value === "delivery" &&
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
      `${names.length} keychain${names.length === 1 ? "" : "s"}`;
  }

  if (checkoutStickyTotal) {
    checkoutStickyTotal.textContent = `$${grandTotal.toFixed(2)}`;
  }

  reviewPrice.innerHTML = `
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

    const { data, error } = await supabase
        .from("orders")
        .insert([order]);

    if (error) {
        console.error(error);
        throw error;
    }

    return data;

}

async function submitOrder() {
  submitStatus.innerText = "Submitting order...";

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

  const orderRef = generateOrderRef();
  const checkoutOrderType = getCheckoutOrderType();
  const turnaround = getTurnaroundInfo();
  const estimatedReadyFrom = addWorkingDays(new Date(), turnaround.minDays);
  const estimatedReadyTo = addWorkingDays(new Date(), turnaround.maxDays);

  if (["rush", "bulk"].includes(checkoutOrderType) && !requestedCompletionDate.value) {
    submitStatus.innerText = "Please choose your preferred completion date.";
    return;
  }

  let confirmedRushAssessment = null;
  if (checkoutOrderType === "rush" && !isManualOrder) {
    submitStatus.innerText = "Rechecking rush availability…";
    confirmedRushAssessment = await checkRushAvailability();

    if (!confirmedRushAssessment || confirmedRushAssessment.status === "unavailable") {
      submitStatus.innerText = "Rush service is unavailable for this date. Please choose another date.";
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

  const originalSubtotal = names.reduce(
    (sum, item) =>
      sum + calculatePrice(getDesign(item), item.name),
    0
  );

  const discountAmount = getPromoDiscount(originalSubtotal);
  const subtotal = roundMoney(originalSubtotal - discountAmount);

  const delivery =
    collectionMethod.value === "delivery" &&
    originalSubtotal < freeDeliveryThreshold
      ? deliveryFeeSetting
      : 0;

  const rushFee = checkoutOrderType === "rush"
    ? Number(confirmedRushAssessment?.fee ?? getRushFee())
    : 0;
  const total = roundMoney(subtotal + delivery + rushFee);

  const order = {
    order_ref: orderRef,

    customer_name: customerName.value.trim(),
    customer_email: customerEmail.value.trim(),
    customer_phone: customerPhone.value.trim(),

    collection_method: collectionMethod.value,

    delivery_address:
      collectionMethod.value === "delivery"
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
      ? "Payment Verified"
      : checkoutOrderType === "rush"
        ? rushAutoApproved ? "Pending Payment" : "Rush Review"
        : checkoutOrderType === "bulk"
          ? "Bulk Review"
          : "Pending Payment",

    order_data: names.map(item => {
      const design = getDesign(item);

      return {
        name: item.name,
        clean_name: sanitizeName(item.name),
        price: calculatePrice(design, item.name),

        design: {
          letter_orientation:
            design.letterOrientation || "vertical",

          base_shape: {
            key: design.baseShape || "ribbed",

            label:
              BASE_SHAPES[
                design.baseShape || "ribbed"
              ].label
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
    })
  };

  // First save the order.
  try {
    await saveOrderToDatabase(order);
  } catch (error) {
    console.error("Unable to save order:", error);

    submitStatus.innerText =
      "Unable to save your order. Please try again.";

    return;
  }

  // The order is now safely saved.
  orderSubmitted = true;
  localStorage.removeItem("littleKeepsDraft");

  if (!isManualOrder) {
    rememberPendingOrder({
      orderRef,
      email: order.customer_email.toLowerCase(),
      total,
      orderType: checkoutOrderType,
      approved: !isReviewRequest
    });
    void requestOrderSavedEmail(orderRef, order.customer_email);
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
        "Please do not make payment yet. Your timing and final amount must be confirmed first.";
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
  paymentOrderRef.innerText = orderRef;
  paymentTotal.innerText = `$${total.toFixed(2)}`;

  checkoutScreen.classList.add("hidden");
  paymentScreen.classList.remove("hidden");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function updateCollectionNote() {

    const subtotal = names.reduce(
        (sum, item) => sum + calculatePrice(getDesign(item), item.name),
        0
    );

    if (collectionMethod.value === "pickup") {

        deliveryNote.innerHTML = `
            📍 <strong>Pickup Location:</strong> Woodlands MRT.<br><br>

            Weekdays: <strong>After 7:00 PM</strong><br>
            Weekends: Selected time ranges will be available.<br><br>

            Once production is ready, we’ll email you. Return to
            <strong>Check Order</strong> to choose an available pickup
            date and time range. You can also reschedule there.
        `;

    } else {

        const fee = subtotal >= freeDeliveryThreshold
          ? "FREE 🎉"
          : displaySettingMoney(deliveryFeeSetting);

        deliveryNote.innerHTML = `
            Please enter any delivery instructions below.
        `;

    }

}

function refreshUI() {
  renderNameCards();
  renderColourSlots();
  updateEditModeText();
  updateBaseShapeButtons();
  updateLetterOrientationButtons();
  updateCartDisplay();
  updateTurnaroundMessaging();
  renderReviewOrder();
}

function buildSelectedPreview() {
  if (!names.length) {
    previewBuildNumber += 1;
    keychain.clear();
    previewLoading?.classList.add("hidden");
    return;
  }

  const item = names[selectedIndex];
  buildKeychain(item.name, getDesign(item));
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

  applyAllToggle.checked = false;

  updateNames();
}

singleBtn.onclick = () => {
  setOrderType("single");
};

groupBtn.onclick = () => {
  setOrderType("group");
};

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
    continueShoppingBtn.textContent = "Start Designing";
    return;
  }

  checkoutFromCartBtn.disabled = false;
  checkoutFromCartBtn.textContent = "Checkout";
  continueShoppingBtn.textContent = "Continue Designing";

  cartDrawerItems.innerHTML = names
    .map((item, index) => {
      const design = getDesign(item);
      const price = calculatePrice(design, item.name);
      const baseShape =
        design.baseShape === "bubbly"
          ? "Bubbly Base"
          : "Ribbed Base";

      return `
        <div class="cart-drawer-item">
          <div class="cart-item-top">
            <div>
              <strong>${item.name}</strong>
              <p>${baseShape}</p>
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
}

window.editCartItem = function(index) {
  selectedIndex = index;

  closeCartDrawer();

  designScreen.classList.remove("hidden");
  checkoutScreen.classList.add("hidden");
  paymentScreen.classList.add("hidden");

  refreshUI();
  buildSelectedPreview();

  document
    .getElementById("designArea")
    .scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
};

window.removeCartItem = function(index) {
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
};

function proceedToCheckout() {
  if (!cartHasItems || !names.length) {
    return;
  }

  closeCartDrawer();

  designScreen.classList.add("hidden");
  checkoutScreen.classList.remove("hidden");
  paymentScreen.classList.add("hidden");

  refreshUI();
  validateForm();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

nextBtn.onclick = () => {
  if (!names.length) {
    alert("Please enter at least one name.");
    return;
  }

  cartHasItems = true;
  draftHasMeaningfulChanges = true;

  updateCartDisplay();
  openCartDrawer();
};

headerCartBtn.onclick = openCartDrawer;
sideCartBtn.onclick = openCartDrawer;

cartCloseBtn.onclick = closeCartDrawer;
cartOverlay.onclick = closeCartDrawer;
continueShoppingBtn.onclick = closeCartDrawer;
checkoutFromCartBtn.onclick = proceedToCheckout;

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

document
  .querySelectorAll("[data-scroll-target]")
  .forEach(button => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.scrollTarget;
      const target = document.getElementById(targetId);

      closeSideMenu();

      document
        .querySelectorAll(".top-nav [data-scroll-target]")
        .forEach(tab => {
          tab.classList.toggle(
            "is-active",
            tab.dataset.scrollTarget === targetId
          );
        });

      target?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });

const PENDING_ORDER_STORAGE_KEY = "littleKeepsPendingOrder";

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
  if (!saved || (orderRef && saved.orderRef !== orderRef)) return;
  localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
  sessionStorage.removeItem("littleKeepsPendingOrderDismissed");
  pendingOrderBanner?.classList.add("hidden");
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
    ? "Your request is saved. View it here for approval and payment updates."
    : "Your order is saved, but payment is not complete.";
  resumePendingOrderBtn.textContent = needsReview ? "View Request" : "Continue Payment";
  pendingOrderBanner.classList.remove("hidden");
}

function openRememberedOrder() {
  const saved = getRememberedPendingOrder();
  if (!saved) return;

  statusOrderRef.value = saved.orderRef;
  statusCustomerEmail.value = saved.email;
  document.getElementById("orderStatusSection")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  setTimeout(() => orderStatusForm?.requestSubmit(), 450);
}

resumePendingOrderBtn?.addEventListener("click", openRememberedOrder);
dismissPendingOrderBtn?.addEventListener("click", () => {
  sessionStorage.setItem("littleKeepsPendingOrderDismissed", "true");
  pendingOrderBanner.classList.add("hidden");
});

async function requestOrderSavedEmail(orderRef, email) {
  try {
    const { error } = await supabase.functions.invoke("send-order-saved-email", {
      body: { order_ref: orderRef, email }
    });
    if (error) console.warn("Order reference email was not sent:", error);
  } catch (error) {
    console.warn("Order reference email was not sent:", error);
  }
}

startDesignBtn.onclick = () => {
  document
    .getElementById("designArea")
    .scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
};

singleName.addEventListener("input", updateNames);

customerName.addEventListener(
    "input",
    validateForm
);

customerEmail.addEventListener(
    "input",
    validateForm
);

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
  }

  updateCollectionNote();
  updateTurnaroundMessaging();
  refreshUI();
  validateForm();
});

rushOrderToggle.addEventListener("change", () => {
  if (!rushOrderToggle.checked && names.length < bulkOrderQuantity) {
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
  validateForm
);

deliveryAddressLine2.addEventListener(
  "input",
  validateForm
);

deliveryPostalCode.addEventListener(
  "input",
  validateForm
);

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

submitOrderBtn.onclick = submitOrder;

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
  const orderRef = paymentOrderRef.innerText.trim();
  const email = customerEmail.value.trim();
  if (!orderRef || !email) return;

  stripeCheckoutBtn.disabled = true;
  stripeCheckoutBtn.textContent = "Opening secure payment…";
  stripeCheckoutStatus.textContent = "Creating your secure PayNow checkout…";

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
    stripeCheckoutBtn.textContent = "Try PayNow Again";
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
      ["rush", "bulk"].includes(getCheckoutOrderType()) &&
      !requestedCompletionDate.value
    ) {
      valid = false;
      message = "Please choose your preferred completion date.";
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
  collectionMethod.value === "delivery" &&
  !deliveryAddressLine1.value.trim()
) {
  valid = false;
  message = "Please enter your block and street name.";
}

else if (
  collectionMethod.value === "delivery" &&
  !deliveryAddressLine2.value.trim()
) {
  valid = false;
  message = "Please enter your unit number.";
}

else if (
  collectionMethod.value === "delivery" &&
  !/^\d{6}$/.test(deliveryPostalCode.value.trim())
) {
  valid = false;
  message = "Postal code must be 6 digits.";
}

    submitOrderBtn.disabled = !valid;
    submitOrderBtn.classList.toggle("disabled", !valid);

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

    neededBy: neededBy.value,
    rushOrderRequested: rushOrderToggle.checked,
    requestedCompletionDate: requestedCompletionDate.value,
    collectionMethod: collectionMethod.value,
    deliveryAddressLine1:
      deliveryAddressLine1.value,

    deliveryAddressLine2:
      deliveryAddressLine2.value,

    deliveryPostalCode:
      deliveryPostalCode.value,
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

  neededBy.value =
    draftData.neededBy || "";

  rushOrderToggle.checked =
    Boolean(draftData.rushOrderRequested);

  requestedCompletionDate.value =
    draftData.requestedCompletionDate || "";

  collectionMethod.value =
    draftData.collectionMethod || "pickup";

  deliveryAddressLine1.value =
    draftData.deliveryAddressLine1 || "";

  deliveryAddressLine2.value =
    draftData.deliveryAddressLine2 || "";

  deliveryPostalCode.value =
    draftData.deliveryPostalCode || "";

  orderNotes.value =
    draftData.orderNotes || "";

  singleName.value =
    draftData.singleName || "Alicia";

  nameList.value =
    draftData.nameList || "Alicia\nBen\nChloe";

  setOrderType(orderType);

  deliveryAddressSection.classList.toggle(
    "hidden",
    collectionMethod.value !== "delivery"
  );

  draftHasMeaningfulChanges = true;

  refreshUI();
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
  if (status === "Ready for Pickup/Delivery") return 3;
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
      countdown.textContent = "The previous payment hold has expired. Open PayNow again to request a fresh slot.";
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

function getPickupTimeRanges(dateValue) {
  if (!dateValue) return [];

  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return [];

  const day = date.getDay();

  return day === 0 || day === 6
    ? [
        "10:00 AM - 12:00 PM",
        "2:00 PM - 4:00 PM",
        "7:00 PM - 8:00 PM"
      ]
    : [
        "7:00 PM - 7:30 PM",
        "7:30 PM - 8:00 PM",
        "8:00 PM - 8:30 PM"
      ];
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

  const ranges = getPickupTimeRanges(dateInput.value);

  timeSelect.innerHTML = ranges.length
    ? `
      <option value="">Choose a time range</option>
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
    alert("Please choose both a pickup date and time range.");
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

    alert(
      `Pickup confirmed for ${formatPreferredDate(pickupDate)}, ${pickupTimeRange}.`
    );

    orderStatusForm?.requestSubmit();
  } catch (error) {
    console.error("Unable to schedule pickup:", error);
    alert(
      error?.message ||
      "Unable to save this pickup time. Please choose another range."
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousLabel;
    }
  }
};

function renderCustomerOrderStatus(order) {
  const paymentExpired =
    order.payment_type !== "Paid" &&
    (order.status === "Payment Expired" ||
      (order.status === "Pending Payment" &&
        order.payment_expires_at &&
        new Date(order.payment_expires_at).getTime() <= Date.now()));
  const effectiveStatus = paymentExpired ? "Payment Expired" : order.status;
  const activeStep = getCustomerStatusStep(effectiveStatus);
  const methodIsDelivery = order.collection_method === "delivery";
  const isSpecialRequest = ["rush", "bulk"].includes(order.order_type);
  const requestApproved = ["Approved", "Auto Approved"].includes(order.review_status);
  const canPay =
    order.payment_type !== "Paid" &&
    ["Pending Payment", "Payment Expired"].includes(effectiveStatus) &&
    (!isSpecialRequest || requestApproved);
  const timingLabel = isSpecialRequest
    ? "Preferred completion date"
    : methodIsDelivery
      ? "Estimated dispatch"
      : "Estimated ready for collection";
  const timingValue = isSpecialRequest
    ? formatPreferredDate(order.requested_completion_date || order.needed_by)
    : order.estimated_ready_from && order.estimated_ready_to
      ? `${formatPreferredDate(order.estimated_ready_from)}–${formatPreferredDate(order.estimated_ready_to)}`
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
  const pickupRanges = getPickupTimeRanges(pickupDate);
  const canSchedulePickup =
    !methodIsDelivery &&
    effectiveStatus === "Ready for Pickup/Delivery";

  orderStatusResult.innerHTML = `
    <div class="order-status-result-heading">
      <div>
        <small>Order reference</small>
        <strong>${escapePresetText(order.order_ref)}</strong>
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
      <p>
        <span>Method</span>
        <strong>${methodIsDelivery ? "Islandwide delivery" : "Pickup at Woodlands MRT"}</strong>
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
          Select an available date and time range for Woodlands MRT.
          Each range has limited availability.
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
            <span>Time range</span>
            <select id="pickupScheduleTime">
              <option value="">Choose a time range</option>
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
            ${JSON.stringify(order.order_ref)},
            ${JSON.stringify(statusCustomerEmail.value.trim())},
            this
          )'
        >
          ${order.pickup_scheduled_date ? "Reschedule Pickup" : "Confirm Pickup Time"}
        </button>
      </div>
    ` : !methodIsDelivery && activeStep < 3 ? `
      <div class="pickup-scheduling-note">
        <strong>Pickup timing comes later</strong>
        <p>
          Once production is ready, this page will unlock available
          pickup dates and time ranges.
        </p>
      </div>
    ` : ""}

    ${canPay ? `
      <div class="approved-request-payment">
        <span>${isSpecialRequest ? "Request approved ✓" : paymentExpired ? "Fresh payment slot needed" : "Secure PayNow checkout"}</span>
        <h3>Total: ${displaySettingMoney(order.total)}</h3>
        ${order.payment_expires_at && !paymentExpired ? `
          <p class="payment-hold-countdown" data-payment-expiry="${escapePresetText(order.payment_expires_at)}"></p>
        ` : `
          <p>${paymentExpired
            ? "Your previous checkout expired and no slot is being held. Open PayNow again to reserve a fresh slot."
            : "A production slot will be held for about 30 minutes when the secure payment page opens."}</p>
        `}
        ${shopSettings.stripe_enabled ? `
          <button class="submit-btn" type="button" onclick='window.payTrackedOrder(${JSON.stringify(order.order_ref)}, ${JSON.stringify(statusCustomerEmail.value.trim())}, this)'>${paymentExpired ? "Open a Fresh PayNow Checkout" : "Pay Securely with PayNow"}</button>
        ` : `<p>Online payment is temporarily unavailable. Please contact Little Keeps.</p>`}
      </div>
    ` : ""}

    <p class="order-status-disclaimer">
      ${isSpecialRequest && !requestApproved
        ? "Your preferred completion date is being reviewed. Please wait for confirmation before making payment."
        : paymentExpired
          ? "No production slot is currently reserved for this unpaid order. Availability is checked again when you open PayNow."
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

window.payTrackedOrder = async function(orderRef, email, button) {
  const previousLabel = button?.textContent || "Pay Securely with PayNow";
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
        "Thank you! Stripe has received your PayNow payment.";
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
        "Your payment slot is held only briefly. Use Track / Pay Order with your reference and email whenever you’re ready to reopen PayNow.";
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
    document.getElementById("orderStatusSection")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
    statusCustomerEmail.focus();
  }, 300);
}

renderPendingOrderBanner();

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

  paymentOrderRef.innerText = "LK-PREVIEW-1234";
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
