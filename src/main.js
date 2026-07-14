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
    <span>Free islandwide delivery above $50</span>
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
          <small>From</small>
          <span>$3.20</span>
        </div>
      </div>

      <div class="hero-included-list">
        <p class="hero-card-label">What's included</p>

        <span>✓ No maximum letters</span>
        <span>✓ 1 base colour included</span>
        <span>✓ 1 cap colour included</span>
        <span>✓ 1 letter colour included</span>
        <span>✓ Icons included</span>
      </div>

      <div class="hero-pricing-guide">
        <p>Additional colours</p>

        <div class="hero-price-row">
          <span>Extra base colour</span>
          <strong>+$0.50</strong>
        </div>

        <div class="hero-price-row">
          <span>Extra cap colour</span>
          <strong>+$0.30</strong>
        </div>

        <div class="hero-price-row">
          <span>Extra letter colour</span>
          <strong>+$0.20</strong>
        </div>
      </div>
    </div>
  </div>

  <div class="hero-decoration hero-decoration-one"></div>
  <div class="hero-decoration hero-decoration-two"></div>
</section>

<section id="designArea" class="shop-section">
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
          </div>

          <canvas id="previewCanvas"></canvas>

          <p id="editModeText" class="preview-editing-text">
            Currently editing: Alicia only
          </p>
        </div>

      <div class="preview-tip">
        <p>
          Drag the preview to rotate your keychain.
        </p>
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
              <h3>Base Colours</h3>
              <p>Select one or more base colours.</p>
            </div>
          </div>

          <div id="baseSlots" class="slot-row"></div>

          <p id="baseColourHint" class="colour-hint">
            Hover or tap a colour
          </p>

          <div id="baseColours" class="swatches"></div>
        </div>

        <div class="customisation-section">
          <div class="customisation-title">
            <div>
              <h3>Cap Colours</h3>
              <p>Select one or more top cap colours.</p>
            </div>
          </div>

          <div id="capSlots" class="slot-row"></div>

          <p id="capColourHint" class="colour-hint">
            Hover or tap a colour
          </p>

          <div id="capColours" class="swatches"></div>
        </div>

        <div class="customisation-section">
          <div class="customisation-title">
            <div>
              <h3>Letter Colours</h3>
              <p>Select one or more raised letter colours.</p>
            </div>
          </div>

          <div id="letterSlots" class="slot-row"></div>

          <p id="letterColourHint" class="colour-hint">
            Hover or tap a colour
          </p>

          <div id="letterColours" class="swatches"></div>
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

  <div class="add-cart-area">
    <div class="cart-price-summary">
      <span>Your current design</span>
      <strong id="designTotalDisplay">$3.20</strong>
    </div>

    <button
      id="nextBtn"
      type="button"
      class="submit-btn add-cart-btn"
    >
      <span>Add to Cart</span>
      <span>♡</span>
    </button>
  </div>
</section>
</section>

<section
  id="checkoutScreen"
  class="checkout-screen hidden"
>
      <button id="backBtn" class="secondary-btn">
        ← Back to Design
      </button>

      <div class="contact-box">
<div class="checkout-heading">
  <p class="section-eyebrow">Checkout</p>
  <h2>Your Details</h2>
  <p>Tell us where and when you need your order.</p>
</div>

        <input id="customerName" placeholder="Name">

        <input
          id="customerEmail"
          type="email"
          placeholder="Email"
        >

        <input
          id="customerPhone"
          placeholder="Contact Number"
        >

        <label for="neededBy">Needed By</label>

        <p class="hint">
          Please allow at least 2–3 days for production
          and 2 days for delivery.
        </p>

        <input
          id="neededBy"
          type="text"
          placeholder="Select date"
        >

        <p id="dateAvailability" class="hint hidden"></p>

        <label for="collectionMethod">
          Collection Method
        </label>

        <select id="collectionMethod">
          <option value="pickup">
            📍 Pick Up at Woodlands MRT
          </option>

          <option value="delivery">
            🚚 Islandwide Delivery (+$2.50)
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
          placeholder="Preferred pickup timing, delivery instructions, or additional notes..."
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

<button
  id="submitOrderBtn"
  class="submit-btn"
  disabled
>
  Submit Order & Continue to Payment
</button>

      <p id="formStatus" class="hint"></p>
      <p id="submitStatus" class="hint"></p>
    </section>

    <section
      id="paymentScreen"
      class="checkout-screen hidden"
    >
      <button
        id="paymentBackBtn"
        class="secondary-btn"
      >
        ← Back
      </button>

      <div class="payment-box">
<h2>Complete Your Payment</h2>

        <p>
          Please complete payment to begin production.
        </p>

        <h3>Order Reference</h3>
        <strong id="paymentOrderRef"></strong>

        <button
          id="copyOrderRefBtn"
          type="button"
          class="save-qr-btn"
        >
          Copy Order Reference
        </button>

        <p id="copyOrderRefStatus" class="hint"></p>

        <h3>Total Amount</h3>
        <strong id="paymentTotal"></strong>

        <img
          src="/models/paynow.png"
          class="paynowQR"
          alt="PayNow QR"
        >

        <a
          href="/models/paynow.png"
          download="LittleKeeps-PayNow.png"
          class="save-qr-btn"
        >
          ↑ Save QR Code
        </a>

        <div class="payment-steps">
          <div class="payment-step">
            <span>1</span>
            <p>Scan or save the QR code</p>
          </div>

          <div class="payment-step">
            <span>2</span>
            <p>
              Pay <strong>the exact amount</strong> and include
              your order reference in the payment reference or remarks
            </p>
          </div>

          <div class="payment-step">
            <span>3</span>
            <p>
              No screenshot or WhatsApp message is required
            </p>
          </div>

          <div class="payment-step">
            <span>4</span>
            <p>
              We'll verify your payment and send
              a confirmation email with your order PDF 💌<br>
              <small>
                If you can’t find it, please check your Spam or Junk folder.
              </small>
            </p>
          </div>
        </div>

<button
  id="paymentDoneBtn"
  class="submit-btn"
>
  Done — Return to Shop
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
          📧 Please check your email for payment instructions.<br>
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

const BASE_PRICE = 3.2;

const INCLUDED_BASE_COLOURS = 1;
const INCLUDED_CAP_COLOURS = 1;
const INCLUDED_LETTER_COLOURS = 1;

const EXTRA_BASE_COLOUR_PRICE = 0.5;
const EXTRA_CAP_COLOUR_PRICE = 0.3;
const EXTRA_LETTER_COLOUR_PRICE = 0.2;

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

const applyAllSection = document.getElementById("applyAllSection");
const resetSelected = document.getElementById("resetSelected");
const reviewCount = document.getElementById("reviewCount");
const reviewPrice = document.getElementById("reviewPrice");
const reviewList = document.getElementById("reviewList");
const customerName = document.getElementById("customerName");
const customerEmail = document.getElementById("customerEmail");
const customerPhone = document.getElementById("customerPhone");
const neededBy = document.getElementById("neededBy");
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

const designScreen = document.getElementById("designScreen");
const checkoutScreen = document.getElementById("checkoutScreen");
const paymentScreen =
document.getElementById("paymentScreen");
const paymentOrderRef =
document.getElementById("paymentOrderRef");
const copyOrderRefBtn =
document.getElementById("copyOrderRefBtn");
const copyOrderRefStatus =
document.getElementById("copyOrderRefStatus");
const paymentTotal =
document.getElementById("paymentTotal");
const paymentDoneBtn =
document.getElementById("paymentDoneBtn");
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
    available: true,
    note: ""
  },
  {
    name: "Sunflower Yellow",
    colour: "#FEC600",
    available: true,
    note: ""
  },
  {
    name: "Gold",
    colour: "#E4BD68",
    available: true,
    note: ""
  },
  {
    name: "Pink",
    colour: "#F55A74",
    available: true,
    note: ""
  },
  {
    name: "Maroon Red",
    colour: "#9D2235",
    available: true,
    note: ""
  },
  {
    name: "Turquoise",
    colour: "#00B1B7",
    available: true,
    note: ""
  },
  {
    name: "Cyan",
    colour: "#0086D6",
    available: true,
    note: ""
  },
  {
    name: "Mistletoe Green",
    colour: "#3F8E43",
    available: true,
    note: ""
  },
  {
    name: "Dark Green",
    colour: "#68724D",
    available: true,
    note: ""
  },

  {
    name: "Purple",
    colour: "#5E43B7",
    available: true,
    note: ""
  },
  {
    name: "Indigo Purple",
    colour: "#482960",
    available: true,
    note: ""
  },
  {
    name: "Black",
    colour: "#000000",
    available: true,
    note: ""
  }
];
const baseColours = colours;
const capColours = colours;
const letterColours = colours;

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

const dateAvailability = document.getElementById("dateAvailability");

let neededByAllowed = false;
let neededByMessage = "";

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

async function checkNeededByDate() {
  if (!neededBy.value) {
    neededByAllowed = false;
    neededByMessage = "";
    dateAvailability.innerText = "";
    return false;
  }

  const { data, error } = await supabase.rpc("check_needed_by_date", {
    p_date: neededBy.value
  });

  if (error) {
    console.error(error);
    neededByAllowed = false;
    neededByMessage = "Unable to check date availability.";
    return false;
  }

  neededByAllowed = data.allowed;
  neededByMessage = data.reason;

  return data.allowed;
}

function sanitizeName(name) {
  return Array.from(name || "")
    .map(char => /[a-z]/i.test(char) ? char.toUpperCase() : char)
    .filter(char => /[A-Z0-9]/.test(char) || specialKeycaps[char])
    .join("");
}

function displayIcon(char) {
  const map = {
    "♡": "🩷",
    "★": "⭐",
    "✿": "🌸",
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

let globalDesign = {
  baseShape: "ribbed",

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

function calculatePrice(design) {
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

  return (
    BASE_PRICE +
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
      bases: [...globalDesign.bases],
      caps: [...globalDesign.caps],
      letters: [...globalDesign.letters]
    };
  }

  return item.custom;
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
      sum + calculatePrice(getDesign(item)),
    0
  );
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
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 3);

  const maxDate = new Date(minDate);
  maxDate.setFullYear(maxDate.getFullYear() + 1);

  const toLocalDateString = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const today = new Date().toISOString().slice(0, 10);

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

  const fullOrderDates = (unavailableDateResult.data || [])
    .map(item => item.unavailable_date)
    .filter(Boolean);

  const disabledDates = [
    ...closureDates,
    ...fullOrderDates
  ];

  flatpickr(neededBy, {
    dateFormat: "Y-m-d",
    minDate,
    maxDate,
    disable: disabledDates,

    onChange: async () => {
      await checkNeededByDate();
      validateForm();
    }
  });
}

async function loadShopNotices() {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("shop_closures")
    .select("*")
    .gte("end_date", today)
    .order("start_date", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

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

  const capGroup = new THREE.Group();
  capGroup.add(tile);
  capGroup.add(raisedLetter);
  capGroup.position.set(4.2, 0, 11);
  group.add(capGroup);

  group.position.x = index * 28;

  return group;
}

async function buildKeychain(name, design) {
  keychain.clear();

  const cleanName = sanitizeName(name || "A");
  const letters = Array.from(cleanName);

  for (let i = 0; i < letters.length; i++) {
    try {
      const item = await createKeycap(letters[i], i, design);
      keychain.add(item);
    } catch (err) {
      console.warn(`Missing STL for ${letters[i]}`, err);
    }
  }

  keychain.position.x = -((letters.length - 1) * 28) / 2;
  keychain.rotation.x = -0.8;
  keychain.rotation.y = 0.2;

  controls.target.set(0, 0, 0);
  controls.update();
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

function createMiniPreview(name, design) {
  return Array.from(sanitizeName(name))
    .map((letter, i) => {
      const base = design.bases[i % design.bases.length];
      const cap = design.caps[i % design.caps.length];
      const letterColour = design.letters[i % design.letters.length];

      return `
        <div class="mini-block" style="background:${base}">
          <div class="mini-cap" style="background:${cap}; color:${letterColour}">
            ${displayIcon(letter)}
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
    const price = calculatePrice(design);

    card.innerHTML = `
      <div class="name-card-top">
        <strong>${item.name}</strong>
        <span class="price-tag">$${price.toFixed(2)}</span>
      </div>

      <p class="hint">
        ${design.baseShape === "bubbly" ? "Bubbly Base" : "Ribbed Base"}
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

function updateEditModeText() {
  if (
    orderType === "group" &&
    applyAllToggle.checked
  ) {
    editModeText.textContent =
      "Currently editing: all keychains";

    resetSelected.style.display = "none";
    return;
  }

  const selectedItem = names[selectedIndex];

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
    const price = calculatePrice(design);

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
    total < 50
      ? 2.5
      : 0;

  const grandTotal = total + deliveryFee;

  reviewPrice.innerHTML = `
    <span>Subtotal</span>
    <strong>$${total.toFixed(2)}</strong>

    <span>Delivery</span>
    <strong>
      ${
        deliveryFee === 0 &&
        collectionMethod.value === "delivery"
          ? "FREE"
          : `$${deliveryFee.toFixed(2)}`
      }
    </strong>

    <span class="review-total-label">Total</span>
    <strong class="review-grand-total">
      $${grandTotal.toFixed(2)}
    </strong>
  `;

  const deliveryOption =
    collectionMethod.querySelector(
      'option[value="delivery"]'
    );

  if (total >= 50) {
    deliveryOption.text =
      "🚚 Islandwide Delivery (FREE)";
  } else {
    deliveryOption.text =
      "🚚 Islandwide Delivery (+$2.50)";
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

  const orderRef = generateOrderRef();

  const subtotal = names.reduce(
    (sum, item) =>
      sum + calculatePrice(getDesign(item)),
    0
  );

  const delivery =
    collectionMethod.value === "delivery" &&
    subtotal < 50
      ? 2.5
      : 0;

  const total = subtotal + delivery;

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
    needed_by: neededBy.value,
    notes: orderNotes.value,

    subtotal,
    delivery_fee: delivery,
    total,

    payment_type: "Pending",

    order_source: isManualOrder
      ? "Manual"
      : "Website",

    status: isManualOrder
      ? "Payment Verified"
      : "Pending Payment",

    order_data: names.map(item => {
      const design = getDesign(item);

      return {
        name: item.name,
        clean_name: sanitizeName(item.name),
        price: calculatePrice(design),

        design: {
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

  const dateAvailable = await checkNeededByDate();

  if (!dateAvailable) {
    submitStatus.innerText = neededByMessage;
    return;
  }

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

  // Supabase sends the Telegram alert through a database webhook.
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
        (sum, item) => sum + calculatePrice(getDesign(item)),
        0
    );

    if (collectionMethod.value === "pickup") {

        deliveryNote.innerHTML = `
            📍 <strong>Pickup Location:</strong> Woodlands MRT.<br><br>

            Weekdays: <strong>After 7:00 PM</strong><br>
            Weekends: We'll arrange a mutually convenient time.<br><br>

            Please indicate your <strong>preferred pickup timing</strong> in the notes below.
        `;

    } else {

        const fee = subtotal >= 50 ? "FREE 🎉" : "$2.50";

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
  updateCartDisplay();
  renderReviewOrder();
}

function buildSelectedPreview() {
  if (!names.length) {
    keychain.clear();
    return;
  }

  const item = names[selectedIndex];
  buildKeychain(item.name, getDesign(item));
}

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

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
    return;
  }

  checkoutFromCartBtn.disabled = false;

  cartDrawerItems.innerHTML = names
    .map((item, index) => {
      const design = getDesign(item);
      const price = calculatePrice(design);
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

      target?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });

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
  refreshUI();
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

paymentBackBtn.onclick = () => {

    paymentScreen.classList.add("hidden");
    checkoutScreen.classList.remove("hidden");

};

paymentDoneBtn.onclick = () => {
  window.location.href = "/";
};

copyOrderRefBtn.onclick = async () => {
  const orderRef = paymentOrderRef.innerText.trim();

  if (!orderRef) return;

  try {
    await navigator.clipboard.writeText(orderRef);
  } catch (error) {
    const temporaryInput = document.createElement("textarea");
    temporaryInput.value = orderRef;
    temporaryInput.style.position = "fixed";
    temporaryInput.style.opacity = "0";
    document.body.appendChild(temporaryInput);
    temporaryInput.select();
    document.execCommand("copy");
    temporaryInput.remove();
  }

  copyOrderRefStatus.innerText =
    "Copied! Paste this into your PayNow reference or remarks.";

  setTimeout(() => {
    copyOrderRefStatus.innerText = "";
  }, 4000);
};

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

    else if (!neededBy.value) {
        valid = false;
        message = "Please select a required date.";
    }

    else if (!neededByAllowed) {
      valid = false;
      message = neededByMessage || "Please choose another date.";
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

    customerName: customerName.value,
    customerEmail: customerEmail.value,
    customerPhone: customerPhone.value,

    neededBy: neededBy.value,
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

  names.forEach(item => {
    if (item.custom) {
      item.custom.baseShape =
        item.custom.baseShape ||
        globalDesign.baseShape;
    }
  });

  cartHasItems =
    Boolean(draftData.cartHasItems);

  customerName.value =
    draftData.customerName || "";

  customerEmail.value =
    draftData.customerEmail || "";

  customerPhone.value =
    draftData.customerPhone || "";

  neededBy.value =
    draftData.neededBy || "";

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

    iconChoices.forEach(icon => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "icon-btn";
      btn.innerHTML = displayIcon(icon);

      btn.onclick = () => {
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

      container.appendChild(btn);
    });
  }

  buildPicker(singlePicker, singleName);
  buildPicker(groupPicker, nameList);
}

loadShopNotices();
renderIconPicker();

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
      "Preview mode only — no order has been submitted.";
    paymentBox.prepend(previewNotice);
  }

  window.scrollTo(0, 0);
}
