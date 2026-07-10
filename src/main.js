import "./style.css";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import confetti from "canvas-confetti";
import emailjs from "@emailjs/browser";
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
    <section id="designScreen" class="design-screen">
      <div class="brand-box">
        <h1>Little Keeps ♡</h1>
        <p>Design your own personalised, clicky &amp; fidget-friendly modular keychain.</p>
      </div>

      <div class="info-panels">

  <div class="info-panel">
    <div class="included-header">
      <h3>🌸 What's Included</h3>

      <div class="mini-price-bubble">
        $3.50
        <span>/ keychain</span>
      </div>
    </div>

    <div class="included-grid">
      <span>No max letters</span>
      <span>2 Base colours</span>
      <span>2 Cap colours</span>
      <span>2 Letter colours</span>
      <span>Icons included</span>
    </div>

    <p class="extra-colour-note">
      🌈 Colour upgrades are based on extra unique colours:<br>
      <strong>Base +$0.50</strong> · <strong>Cap +$0.30</strong> · <strong>Letter +$0.20</strong>
    </p>
  </div>

  <div class="info-panel">
    <h3>📢 Notice</h3>

    <div class="notice-box">
      🚚 FREE islandwide delivery on orders above <strong>$50</strong>.
    </div>

    <div class="notice-box">
      <strong>✈️ Holiday Notice</strong><br>
      <span id="holidayNoticeText">No current announcements.</span>
    </div>
  </div>

</div>


    </div>
      <div class="design-grid">
        <section class="left-panel">
          <div class="card">
            <h3>① Choose order type</h3>
            <p class="hint">Choose single for one keychain, or group for multiple names.</p>
            <div class="toggle-row">
              <button id="singleBtn" class="toggle active">Single Order</button>
              <button id="groupBtn" class="toggle">Group Order</button>
            </div>
          </div>

          <div class="card">
            <div id="singleSection">
              <h3>② Enter your name</h3>
              <p class="hint">Type your name, then tap an icon if you want to add one.</p>
              <input id="singleName" value="Alicia" maxlength="10">
              <div id="iconPicker" class="icon-picker"></div>
            </div>

            <div id="groupSection" class="hidden">
              <h3>② Enter name list</h3>
              <p class="hint">For group orders, enter one name per line.</p>
              <textarea id="nameList" placeholder="Paste names here, one per line">Alicia
Ben
Chloe</textarea>

              <p id="nameCount">3 names</p>

              <p class="hint">Tap an icon to add it to the current line.</p>
              <div id="groupIconPicker" class="icon-picker"></div>
            </div>

            <div id="nameCardsSection">
              <h3>③ Select a keychain to customise</h3>
              <p class="hint">
                For group orders, choose which keychain you want to edit.
              </p>
              <div id="nameCards"></div>
            </div>

            <div class="stock-note">

                💌 <strong>Need another colour?</strong><br>

                Can't find the colour you're looking for?
                WhatsApp us at <strong>8512 1915</strong>.

                <br><br>

                We may be able to specially order the colour for you at
                <strong>no extra cost!</strong>
            </div>

            <div class="colour-note">

                🖨️ Colours shown on screen are for reference only.
                Slight colour variations may occur due to monitor settings and filament batches.

            </div>

          </div>
        </section>

        <section class="right-panel">
          <div class="preview-card">
            <canvas id="previewCanvas"></canvas>
          </div>

          <div class="card colours-card">
            <h3>③ Customise colours</h3>
            <p class="hint">Choose colours for the base, top cap and letter. Your preview updates automatically.</p>

          <div id="applyAllSection">

            <label class="apply-row">
              <input id="applyAllToggle" type="checkbox" checked>
              🎨 Use the same colours for all keychains
            </label>

            <p id="editingLabel" class="hint"></p>

          </div>

            <p id="editModeText" class="hint">Currently editing: all names</p>

            <div id="livePriceBox" class="live-price-box">
              Current design: <strong id="livePrice">$3.50</strong>
            </div>

            <p>Base Shape</p>
            <div class="toggle-row">
              <button id="ribbedBaseBtn" class="toggle active">Ribbed</button>
              <button id="bubblyBaseBtn" class="toggle">Bubbly</button>
            </div>

            <p>Base Colours</p>
            <div id="baseSlots" class="slot-row"></div>
            <div id="baseColours" class="swatches"></div>

            <p>Cap Colours</p>
            <div id="capSlots" class="slot-row"></div>
            <div id="capColours" class="swatches"></div>

            <p>Letter Colours</p>
            <div id="letterSlots" class="slot-row"></div>
            <div id="letterColours" class="swatches"></div>

            <button id="resetSelected" class="reset-btn">Reset selected name to global design</button>
          </div>
        </section>
      </div>

      <button id="nextBtn" class="submit-btn">④ Continue to checkout</button>
    </section>

    <section id="checkoutScreen" class="checkout-screen hidden">
    <div class="promo-banner">
      🚚 <strong>FREE islandwide delivery on orders above $50!</strong>
    </div>
      <button id="backBtn" class="secondary-btn">← Back to Design</button>

      <div class="contact-box">
        <h3>Contact Details</h3>

        <input id="customerName" placeholder="Name">
        <input id="customerEmail" type="email" placeholder="Email">
        <input id="customerPhone" placeholder="Contact Number">

        <label>Needed By</label>
        <p class="hint">Please allow at least 2-3 days for production and 2 days for delivery.</p>

        <input id="neededBy" type="text" placeholder="Select date">
        <p id="dateAvailability" class="hint"></p>

      <label>Collection Method</label>

      <select id="collectionMethod">
        <option value="pickup">📍 Pick Up at Woodlands MRT</option>
        <option value="delivery">🚚 Islandwide Delivery (+$2.50)</option>
      </select>

      <div id="deliveryAddressSection" class="hidden">

        <label>Delivery Address</label>

        <textarea
          id="deliveryAddress"
          placeholder="Enter your delivery address..."
        ></textarea>

      </div>

      <p id="deliveryNote" class="hint"></p>

      <textarea
        id="orderNotes"
        placeholder="Preferred pickup timing, delivery instructions, or any additional notes..."
      ></textarea>
      </div>

      <div class="review-box">
        <h3>Review Order</h3>
        <div class="review-summary">
          <p>Total names: <strong id="reviewCount">0</strong></p>
          <p>Estimated total: <strong id="reviewPrice">$0.00</strong></p>
        </div>
        <div id="reviewList"></div>
      </div>

      <div class="payment-box">
        <h3>Payment</h3>
        <p>Payment is via PayNow only.</p>
        <p>After submitting, you’ll see the QR code and exact amount to pay.</p>
      </div>

      <button id="submitOrderBtn" class="submit-btn" disabled>
        Submit Order & Make Payment
      </button>

      <p id="formStatus" class="hint"></p>
      <p id="submitStatus" class="hint"></p>
    </section>

<!-- NEW PAYMENT SCREEN -->
<section id="paymentScreen" class="checkout-screen hidden">

  <button id="paymentBackBtn" class="secondary-btn">
    ← Back
  </button>

  <div class="payment-box">

    <h2>🩷 Almost Done!</h2>

    <p>Please complete payment to begin production.</p>

    <h3>Order Reference</h3>
    <strong id="paymentOrderRef"></strong>

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
    <p>Pay <strong>the exact amount</strong></p>
  </div>

  <div class="payment-step">
    <span>3</span>
    <p>Send your payment screenshot</p>
  </div>

  <div class="payment-step">
    <span>4</span>
    <p>We'll verify your payment & send a confirmation email 💌</p>
  </div>

</div>

    <button
      id="whatsappBtn"
      class="submit-btn"
    >
      💬 Send Payment Screenshot
    </button>

  </div>

</section>

    <div id="successModal" class="modal hidden">
      <div class="modal-card">
        <h2>Order Submitted ♡</h2>
        <p>Thank you! We’ve received your order.</p>
        <p id="orderRefText"></p>
        <p>We’ll contact you nearer to your collection/delivery date.</p>
        <p class="hint">
          📧 Please check your email for payment instructions.<br>
          If you don’t see it, kindly check your Junk/Spam folder too.
        </p>
        <button id="closeModalBtn" class="submit-btn">Done</button>
      </div>
    </div>

    <div id="draftModal" class="modal hidden">
      <div class="modal-card">
        <h2>🩷 Welcome Back!</h2>
        <p>We found an unfinished order.</p>
        <p>Would you like to continue where you left off?</p>

        <button id="continueDraftBtn" class="submit-btn">Continue Order</button>
        <button id="discardDraftBtn" class="secondary-btn">Start New</button>
      </div>
    </div>
  </main>
`;

const BASE_PRICE = 3.5;

const INCLUDED_BASE_COLOURS = 2;
const INCLUDED_CAP_COLOURS = 2;
const INCLUDED_LETTER_COLOURS = 2;

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
const livePrice = document.getElementById("livePrice");
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

const designScreen = document.getElementById("designScreen");
const checkoutScreen = document.getElementById("checkoutScreen");
const paymentScreen =
document.getElementById("paymentScreen");
const paymentOrderRef =
document.getElementById("paymentOrderRef");
const paymentTotal =
document.getElementById("paymentTotal");
const whatsappBtn =
document.getElementById("whatsappBtn");
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

const EMAILJS_SERVICE = "service_joll6ie";
const EMAILJS_TEMPLATE = "template_3kt0yd9";
const EMAILJS_PUBLIC = "dRppqgrkwps-kd6W-";

const EMAILJS_CUSTOMER_TEMPLATE = "template_liazurv";

const deliveryAddressSection =
document.getElementById("deliveryAddressSection");

const deliveryAddress =
document.getElementById("deliveryAddress");

const ribbedBaseBtn = document.getElementById("ribbedBaseBtn");
const bubblyBaseBtn = document.getElementById("bubblyBaseBtn");

emailjs.init(EMAILJS_PUBLIC);


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
  "♡": "heart",
  "★": "star",
  "✿": "flower",
  "🎀": "ribbon",
  "🐾": "paw",
  "☘": "clover",
  "🌙": "moon",
  "♪": "music",
  "⚡": "lightning",
  "🔥": "fire",
  "☕": "coffee",
  "🦆": "duck"
};

const iconChoices = Object.keys(specialKeycaps);

const dateAvailability = document.getElementById("dateAvailability");

let neededByAllowed = false;
let neededByMessage = "";

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
    dateAvailability.innerText = neededByMessage;
    return false;
  }

  neededByAllowed = data.allowed;
  neededByMessage = data.reason;

  dateAvailability.innerText = neededByMessage;
  dateAvailability.style.color = data.allowed ? "#3c9d67" : "#c9184a";

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

function getAvailableColours() {
  return colours
    .filter(c => c.available)
    .map(c => c.colour);
}

const available = getAvailableColours();

let globalDesign = {
  bases: [
    available[0],
    available[1]
  ],

  caps: [
    available[1] || available[0],
    available[0]
  ],

  letters: [
    available[2] || available[0],
    available[3] || available[1] || available[0]
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

let baseShape = "ribbed";

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
  const baseExtra =
    Math.max(0, getUniqueColourCount(design.bases) - INCLUDED_BASE_COLOURS);

  const capExtra =
    Math.max(0, getUniqueColourCount(design.caps) - INCLUDED_CAP_COLOURS);

  const letterExtra =
    Math.max(0, getUniqueColourCount(design.letters) - INCLUDED_LETTER_COLOURS);

  return (
    BASE_PRICE +
    baseExtra * EXTRA_BASE_COLOUR_PRICE +
    capExtra * EXTRA_CAP_COLOUR_PRICE +
    letterExtra * EXTRA_LETTER_COLOUR_PRICE
  );
}

function getActiveDesign() {
  const item = names[selectedIndex];

  if (applyAllToggle.checked || !item) return globalDesign;

  if (!item.custom) {
    item.custom = {
      bases: [...globalDesign.bases],
      caps: [...globalDesign.caps],
      letters: [...globalDesign.letters]
    };
  }

  return item.custom;
}

function makeSwatches(containerId, colours, type) {

  const container = document.getElementById(containerId);
  container.innerHTML = "";

  colours.forEach(item => {

    const btn = document.createElement("button");
    btn.className = "swatch";
    btn.style.background = item.colour;

    if (!item.available) {

      btn.classList.add("oos");

      btn.title = `${item.name}\n${item.note}`;

      btn.onclick = () => {

        alert(`${item.name} is currently out of stock.\n\n${item.note}`);

      };

    } else {

      btn.onclick = () => {

        addColourToDesign(type, item.colour);

        refreshUI();

        buildSelectedPreview();

      };

    }

    container.appendChild(btn);

  });

}

nextBtn.onclick = () => {
  designScreen.classList.add("hidden");
  checkoutScreen.classList.remove("hidden");
  window.scrollTo(0, 0);
  refreshUI();
  validateForm();
};

backBtn.onclick = () => {
  checkoutScreen.classList.add("hidden");
  designScreen.classList.remove("hidden");
  window.scrollTo(0, 0);
};

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

  const today = new Date().toISOString().slice(0, 10);

  const { data: closures, error: closureError } = await supabase
    .from("shop_closures")
    .select("start_date, end_date")
    .gte("end_date", today);

  if (closureError) console.error(closureError);

  const { data: fullyBooked, error: bookedError } = await supabase
    .from("fully_booked_dates")
    .select("date")
    .gte("date", today);

  if (bookedError) console.error(bookedError);

  const disabledDates = [
    ...(closures || []).map(item => ({
      from: item.start_date,
      to: item.end_date
    })),
    ...(fullyBooked || []).map(item => item.date)
  ];

  flatpickr(neededBy, {
    dateFormat: "Y-m-d",
    minDate,
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
    bases: item.custom.bases || globalDesign.bases,
    caps: item.custom.caps || globalDesign.caps,
    letters: item.custom.letters || globalDesign.letters
  };
}

async function createKeycap(letter, index, design) {
  const group = new THREE.Group();

  const baseColour = design.bases[index % design.bases.length];
  const capColour = design.caps[index % design.caps.length];
  const letterColour = design.letters[index % design.letters.length];

  const baseGeo = await loadSTL(BASE_SHAPES[baseShape].file);
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
  const previous = names;

  if (orderType === "single") {
    const value = singleName.value.trim() || "Alicia";
    const existing = previous.find(n => n.name === value);
    names = [existing || { name: value, custom: null }];
  } else {
    names = nameList.value
      .split("\n")
      .map(name => name.trim())
      .filter(Boolean)
      .map(value => {
        const existing = previous.find(n => n.name === value);
        return existing || { name: value, custom: null };
      });
  }

  if (selectedIndex >= names.length) selectedIndex = 0;

  if (nameCount) {
    nameCount.innerText = `${names.length} name${names.length === 1 ? "" : "s"}`;
  }
  if (orderType === "single") {

      nameCardsSection.classList.add("hidden");
      applyAllSection.classList.add("hidden");

  } else {

      nameCardsSection.classList.remove("hidden");
      applyAllSection.classList.remove("hidden");

  }

  refreshUI();
  buildSelectedPreview();
}

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
  if (applyAllToggle.checked) {
    editModeText.innerText = "Currently editing: all names";
    resetSelected.style.display = "none";
    return;
  }

  const item = names[selectedIndex];

  editModeText.innerText = item
    ? `Currently editing: ${item.name} only`
    : "Currently editing: selected name only";

  resetSelected.style.display = "block";
}

function autoSave(){

    saveDraft();

}

setInterval(autoSave,3000);

function renderReviewOrder() {
  let total = 0;

  reviewCount.innerText = names.length;
  reviewList.innerHTML = "";

  names.forEach(item => {
    const design = getDesign(item);
    const price = calculatePrice(design);
    total += price;

    const row = document.createElement("div");
    row.className = "review-item";

    row.innerHTML = `
      <div class="name-card-top">
        <strong>${item.name}</strong>
        <span class="price-tag">$${price.toFixed(2)}</span>
      </div>

      <div class="mini-chain">
        ${createMiniPreview(item.name, design)}
      </div>
    `;

    reviewList.appendChild(row);
  });

  const deliveryFee =
  collectionMethod.value === "delivery" && total < 50 ? 2.5 : 0;

  const grandTotal = total + deliveryFee;

  reviewPrice.innerHTML = `
    Subtotal: $${total.toFixed(2)}<br>
    Delivery: $${deliveryFee.toFixed(2)}<br>
    Total: $${grandTotal.toFixed(2)}
  `;

  const deliveryOption =
    collectionMethod.querySelector('option[value="delivery"]');

  if (total >= 50) {

      deliveryOption.text =
          "🚚 Islandwide Delivery (FREE)";

  }
  else {

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

function addToTotal(totals, colour) {
  const name = getColourName(colour);
  totals[name] = (totals[name] || 0) + 1;
}

function getColourTotals() {
  const totals = {
    base: {},
    cap: {},
    letter: {}
  };

  names.forEach(item => {
    const design = getDesign(item);
    const cleanName = sanitizeName(item.name);

    Array.from(cleanName).forEach((_, i) => {
      addToTotal(totals.base, design.bases[i % design.bases.length]);
      addToTotal(totals.cap, design.caps[i % design.caps.length]);
      addToTotal(totals.letter, design.letters[i % design.letters.length]);
    });
  });

  return totals;
}

function formatTotals(title, totals) {
  const lines = [title];

  Object.entries(totals).forEach(([colour, count]) => {
    lines.push(`- ${colour}: ${count}`);
  });

  return lines.join("\n");
}

function createEmailMiniPreview(name, design) {
  return Array.from(sanitizeName(name))
    .map((letter, i) => {
      const base = design.bases[i % design.bases.length];
      const cap = design.caps[i % design.caps.length];
      const letterColour = design.letters[i % design.letters.length];

      return `
        <span style="display:inline-block;width:36px;height:36px;background:${base};border-radius:10px;margin:4px;position:relative;vertical-align:middle;">
          <span style="display:block;width:23px;height:23px;background:${cap};border-radius:7px;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;line-height:23px;font-size:13px;font-weight:bold;color:${letterColour};">
            ${displayIcon(letter)}
          </span>
        </span>
      `;
    })
    .join("");
}

function getBaseSummary() {
  const totals = {};

  names.forEach(item => {
    const design = getDesign(item);
    const cleanName = sanitizeName(item.name);

    Array.from(cleanName).forEach((_, i) => {
      const colour = getColourName(design.bases[i % design.bases.length]);
      totals[colour] = (totals[colour] || 0) + 1;
    });
  });

  return totals;
}

function getKeycapSummary() {
  const totals = {};

  names.forEach(item => {
    const design = getDesign(item);
    const cleanName = sanitizeName(item.name);

    Array.from(cleanName).forEach((letter, i) => {
      const cap = getColourName(design.caps[i % design.caps.length]);
      const letterColour = getColourName(design.letters[i % design.letters.length]);

      const key = `${letter} — Cap: ${cap}, Letter: ${letterColour}`;
      totals[key] = (totals[key] || 0) + 1;
    });
  });

  return totals;
}

function getEmailHtml() {
  let subtotal = 0;

  let html = `
    <h2 style="color:#ff6f9f;">Review Order</h2>
  `;

  names.forEach(item => {
    const design = getDesign(item);
    const price = calculatePrice(design);
    subtotal += price;

    html += `
      <div style="background:white;border:1px solid #eee;border-radius:16px;padding:14px;margin:12px 0;">
        <h3 style="margin:0 0 8px;">${item.name}</h3>
        <div>${createEmailMiniPreview(item.name, design)}</div>
        <p style="margin:10px 0 0;"><b>$${price.toFixed(2)}</b></p>
      </div>
    `;
  });

  const delivery = collectionMethod.value === "delivery" && subtotal < 50 ? 2.5 : 0;
  const total = subtotal + delivery;

  html += `
    <hr>
    <h2 style="color:#ff6f9f;">Total</h2>
    <p>Subtotal: <b>$${subtotal.toFixed(2)}</b></p>
    <p>Delivery: <b>$${delivery.toFixed(2)}</b></p>
    <h2>Total: $${total.toFixed(2)}</h2>
  `;

  const bases = getBaseSummary();
  const keycaps = getKeycapSummary();

  html += `
    <hr>
    <h2 style="color:#ff6f9f;">Production Summary</h2>
    <h3>Base Printing</h3>
  `;

  Object.entries(bases).forEach(([colour, count]) => {
    html += `<p>${colour}: <b>${count}</b></p>`;
  });

  html += `<hr><h3>Keycap Printing</h3>`;

  Object.entries(keycaps).forEach(([item, count]) => {
    html += `
      <div style="background:#fff7fb;border:1px solid #eee;border-radius:12px;padding:10px;margin:8px 0;">
        <p style="margin:0;"><b>${item}</b></p>
        <p style="margin:4px 0 0;">Quantity: <b>${count}</b></p>
      </div>
    `;
  });

  html += `
  <hr>
  <h2 style="color:#ff6f9f;">Payment Status</h2>
  <p><b>Pending Payment</b></p>
  <p>Customer has been instructed to send payment screenshot via WhatsApp.</p>
  <p>Ship out timeline: <b>3–5 working days after payment confirmation</b></p>
`;

  return html;
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
    (sum, item) => sum + calculatePrice(getDesign(item)),
    0
  );

  const delivery =
    collectionMethod.value === "delivery" && subtotal < 50
      ? 2.5
      : 0;

  const total = subtotal + delivery;

  const order = {
    order_ref: orderRef,

    customer_name: customerName.value,
    customer_email: customerEmail.value,
    customer_phone: customerPhone.value,

    collection_method: collectionMethod.value,
    delivery_address: deliveryAddress.value,

    preferred_time: orderNotes.value,
    needed_by: neededBy.value,
    notes: orderNotes.value,

    subtotal,
    delivery_fee: delivery,
    total,

    payment_type: "Pending",
    order_source: isManualOrder ? "Manual" : "Website",
    status: isManualOrder ? "Payment Verified" : "Pending Payment",

    order_data: names.map(item => {
      const design = getDesign(item);

      return {
        name: item.name,
        clean_name: sanitizeName(item.name),
        price: calculatePrice(design),

          design: {
            base_shape: {
              key: baseShape,
              label: BASE_SHAPES[baseShape].label
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

  try {

    const ok = await checkNeededByDate();

    if (!ok) {
      submitStatus.innerText = neededByMessage;
      return;
    }

    await saveOrderToDatabase(order);

    // ADMIN EMAIL ONLY
    await emailjs.send(
      EMAILJS_SERVICE,
      EMAILJS_TEMPLATE,
      {
        order_ref: orderRef,
        customer_name: customerName.value,
        customer_email: customerEmail.value,
        customer_phone: customerPhone.value,
        collection_method: collectionMethod.value,
        total_amount: `$${total.toFixed(2)}`,
        message: getEmailHtml(),
        customer_summary: getEmailHtml()
      }
    );

    orderSubmitted = true;
    localStorage.removeItem("littleKeepsDraft");

    paymentOrderRef.innerText = orderRef;
    paymentTotal.innerText = `$${total.toFixed(2)}`;

    checkoutScreen.classList.add("hidden");
    paymentScreen.classList.remove("hidden");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  } catch (error) {

    console.error(error);

    submitStatus.innerText =
      "Unable to submit order.";

  }

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

  const design = getActiveDesign();
  livePrice.innerText = `$${calculatePrice(design).toFixed(2)}`;

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

singleBtn.onclick = () => {
  orderType = "single";
  singleBtn.classList.add("active");
  groupBtn.classList.remove("active");
  singleSection.classList.remove("hidden");
  groupSection.classList.add("hidden");
  selectedIndex = 0;
  updateNames();
};

groupBtn.onclick = () => {
  orderType = "group";
  groupBtn.classList.add("active");
  singleBtn.classList.remove("active");
  groupSection.classList.remove("hidden");
  singleSection.classList.add("hidden");
  selectedIndex = 0;
  updateNames();
};

ribbedBaseBtn.onclick = () => {
  baseShape = "ribbed";

  ribbedBaseBtn.classList.add("active");
  bubblyBaseBtn.classList.remove("active");

  buildSelectedPreview();
};

bubblyBaseBtn.onclick = () => {
  baseShape = "bubbly";

  bubblyBaseBtn.classList.add("active");
  ribbedBaseBtn.classList.remove("active");

  buildSelectedPreview();
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

    if(collectionMethod.value==="delivery"){

        deliveryAddressSection.classList.remove("hidden");

    }

    else{

        deliveryAddressSection.classList.add("hidden");

        deliveryAddress.value="";

    }

    refreshUI();

    validateForm();

});

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

whatsappBtn.onclick = () => {

    const msg =
`Hi Little Keeps!

I've completed payment for my order.

Order Reference:
${paymentOrderRef.innerText}.

Amount Paid:
${paymentTotal.innerText}.

I'll attach my payment screenshot below`;

    window.open(
        `https://wa.me/6585121915?text=${encodeURIComponent(msg)}`,
        "_blank"
    );

};
collectionMethod.addEventListener("change", () => {

    if (collectionMethod.value === "delivery") {

        deliveryAddressSection.classList.remove("hidden");

    }

    else {

        deliveryAddressSection.classList.add("hidden");

    }

    updateCollectionNote();

    refreshUI();

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

    else if (!neededBy.value) {
        valid = false;
        message = "Please select a required date.";
    }

    else if (!neededByAllowed) {
      valid = false;
      message = neededByMessage || "Please choose another date.";
    }

    else if(
    collectionMethod.value==="delivery" &&
    !deliveryAddress.value.trim()
  ){

    valid = false;

    message = "Please enter your delivery address.";

  }

    submitOrderBtn.disabled = !valid;
    submitOrderBtn.classList.toggle("disabled", !valid);

    document.getElementById("formStatus").innerText = message;

}

closeModalBtn.onclick = () => {
  successModal.classList.add("hidden");
};

function saveDraft() {
  if (orderSubmitted) return;

    const draft = {

        orderType,

        names,

        selectedIndex,

        globalDesign,

        customerName: customerName.value,

        customerEmail: customerEmail.value,

        customerPhone: customerPhone.value,

        neededBy: neededBy.value,

        collectionMethod: collectionMethod.value,

        deliveryAddress: deliveryAddress.value,

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

    orderType = draftData.orderType;

    names = draftData.names;

    selectedIndex = draftData.selectedIndex;

    globalDesign = draftData.globalDesign;

    customerName.value = draftData.customerName;

    customerEmail.value = draftData.customerEmail;

    customerPhone.value = draftData.customerPhone;

    neededBy.value = draftData.neededBy;

    collectionMethod.value =
        draftData.collectionMethod;

    deliveryAddress.value =
        draftData.deliveryAddress || "";

    if (collectionMethod.value === "delivery") {

        deliveryAddressSection.classList.remove("hidden");

    } else {

        deliveryAddressSection.classList.add("hidden");

    }

    orderNotes.value =
        draftData.orderNotes;

    orderNotes.value =
        draftData.orderNotes;

    singleName.value =
        draftData.singleName;

    nameList.value =
        draftData.nameList;

    if(orderType==="group"){

        groupBtn.click();

    }

    else{

        singleBtn.click();

    }

    refreshUI();

    buildSelectedPreview();

};

discardDraftBtn.onclick = () => {

    localStorage.removeItem(
        "littleKeepsDraft"
    );

    draftModal.classList.add("hidden");

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
updateNames();
loadDraft();
setupNeededByCalendar();

updateCollectionNote();

validateForm();
animate();


