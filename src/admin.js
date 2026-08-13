import "./admin.css";
import { createClient } from "@supabase/supabase-js";
import emailjs from "@emailjs/browser";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  ASSEMBLY_STAGES,
  assignPrintedKeycapsToOwners,
  buildGoogleMapsRouteUrl,
  canOrderAcceptAddOn,
  calculateProductionTimeEstimate,
  calculateQueuedProductionQuantity,
  calculateBusinessFinancials,
  calculatePaidOrderRevenue,
  calculateSubscriptionSummary,
  distributeAmsPlatesAcrossPrinters,
  formatProductionMinutes,
  getBulkApprovalPolicy,
  getFreeAmsPrinters,
  getHandDeliveryLabelData,
  getInternalBasketLabelData,
  groupLinkedOrdersForAdmin,
  normalizePickupTimeOptions,
  getDeliveryRouteGroup,
  getOperationalBuckets,
  getProductionPreviewOrders,
  getProductionJobGroup,
  getTrackedProductionQuantity,
  normalizeAssemblyProgress,
  optimizeAmsPlateSequence,
  partitionAmsCombinationsByBusyColours,
  validateInventoryDecrement
} from "./admin-logic.js";
import {
  DEFAULT_PRODUCT_CATALOG,
  normalizeProductCatalog
} from "./product-catalog.js";

const SUPABASE_URL = "https://jetamtthfenjyzcdklqm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_IXgEB4mpCTF3zOhkulGOYw_fcDwgiHf";

const EMAILJS_SERVICE = "service_joll6ie";
const EMAILJS_PUBLIC = "dRppqgrkwps-kd6W-";
const EMAILJS_PAYMENT_VERIFIED_TEMPLATE = "template_liazurv";


emailjs.init(EMAILJS_PUBLIC);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const IS_ADMIN_PREVIEW =
  import.meta.env.DEV &&
  new URLSearchParams(location.search).get("adminPreview") === "1";

const { data: sessionData } = await supabase.auth.getSession();

if (!sessionData.session && !IS_ADMIN_PREVIEW) {
  document.querySelector("#app").innerHTML = `
    <main class="admin-page">
      <div class="login-card">
        <h1>Little Keeps Workshop ♡</h1>
        <p>Admin login required.</p>

        <input id="loginEmail" type="email" placeholder="Email">
        <input id="loginPassword" type="password" placeholder="Password">

        <button id="loginBtn">Login</button>

        <p id="loginStatus" class="hint"></p>
      </div>
    </main>
  `;

  document.getElementById("loginBtn").onclick = async () => {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      document.getElementById("loginStatus").innerText =
        "Login failed. Check email/password.";
      return;
    }

    location.reload();
  };

  throw new Error("Not logged in");
}

document.querySelector("#app").innerHTML = `
  <main class="admin-page">
    <header class="admin-header">
      <div class="admin-header-copy">
        <p class="eyebrow">Little Keeps Admin</p>
        <h1>Operations Dashboard</h1>
        <p>A calm view of today’s orders, production and fulfilment.</p>
      </div>

      <div class="admin-header-actions">
        <a class="header-store-link" href="./index.html" target="_blank" rel="noopener">
          View Store
        </a>
        <button id="logoutBtn" type="button">Logout</button>
      </div>
    </header>

    <section id="stats" class="stats-grid"></section>

    <section id="operationsSummary" class="operations-summary" aria-live="polite"></section>

    <nav class="workshop-tabs" aria-label="Workshop sections">
      <button id="todayViewBtn" class="workshop-tab active" type="button">
        <span aria-hidden="true">●</span> Today
      </button>
      <button id="ordersViewBtn" class="workshop-tab" type="button">
        <span aria-hidden="true">▤</span> Orders
      </button>
      <button id="scheduleViewBtn" class="workshop-tab" type="button">
        <span aria-hidden="true">▦</span> Calendar
      </button>
      <button id="productionViewBtn" class="workshop-tab" type="button">
        <span aria-hidden="true">▦</span> Production
      </button>
      <button id="assemblyViewBtn" class="workshop-tab" type="button">
        <span aria-hidden="true">◇</span> Assembly
      </button>
      <button id="fulfilmentViewBtn" class="workshop-tab" type="button">
        <span aria-hidden="true">↗</span> Fulfilment
      </button>
      <button id="inventoryViewBtn" class="workshop-tab" type="button">
        <span aria-hidden="true">□</span> Inventory
      </button>
      <button id="financeViewBtn" class="workshop-tab" type="button">
        <span aria-hidden="true">⌁</span> Finances
      </button>
      <button id="settingsViewBtn" class="workshop-tab" type="button">
        <span aria-hidden="true">⚙️</span> Settings
      </button>
    </nav>

    <section class="workspace-panel">
      <div class="section-title">
        <div>
          <p class="section-kicker">Workspace</p>
          <h2 id="sectionTitle">Orders</h2>
        </div>

        <div class="admin-actions" id="ordersActions">
          <a class="new-order-btn" href="./index.html?manual=true">
            + Manual Order
          </a>

          <button id="cleanupExpiredBtn" type="button">
            Clean Expired
          </button>

          <button id="refreshBtn" type="button" title="Refresh orders" aria-label="Refresh orders">
            ↻
          </button>
        </div>
      </div>

      <div id="orderFilters" class="order-filters">
        <label class="filter-search">
          <span>Search</span>
          <input id="orderSearch" placeholder="Order reference, customer or email...">
        </label>

        <label>
          <span>Orders</span>
          <select id="orderViewFilter">
            <option value="active">Active Orders</option>
            <option value="all">All Orders</option>
            <option value="completed">Completed Only</option>
            <option value="archived">Archived</option>
          </select>
        </label>

        <label>
          <span>Status</span>
          <select id="statusFilter">
            <option value="all">All stages</option>
            <option value="review">Needs review</option>
            <option value="Pending Payment">Awaiting payment</option>
            <option value="Payment Expired">Expired checkouts</option>
            <option value="Payment Verified">Ready to print</option>
            <option value="Printing">Printing</option>
            <option value="Completed">Completed</option>
            <option value="Refunded">Refunded</option>
          </select>
        </label>

        <label>
          <span>Payment</span>
          <select id="paymentFilter">
            <option value="all">All payments</option>
            <option value="Pending">Awaiting payment</option>
            <option value="Paid">Paid</option>
            <option value="no-charge">No payment needed</option>
          </select>
        </label>

        <label>
          <span>Fulfilment</span>
          <select id="fulfilmentFilter">
            <option value="all">Pickup & delivery</option>
            <option value="pickup">Pickup only</option>
            <option value="delivery">Delivery only</option>
          </select>
        </label>

        <label>
          <span>Order Date</span>
          <select id="orderDateSort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>

      <div id="orders">
        <p class="empty">Loading orders...</p>
      </div>
    </section>

    <aside class="workshop-notes" aria-label="Persistent workshop notes">
      <button id="workshopNotesToggle" class="workshop-notes-toggle" type="button" aria-expanded="true">
        <span>Quick Notes</span>
        <small id="workshopNotesSaveState">Saved</small>
      </button>
      <div id="workshopNotesBody" class="workshop-notes-body">
        <textarea id="workshopNotesInput" rows="9" placeholder="Printer issues, add-ons, handoffs, reminders…"></textarea>
        <p>Visible on every tab · saves automatically</p>
      </div>
    </aside>
  </main>
`;

const ordersContainer = document.getElementById("orders");
const statsContainer = document.getElementById("stats");
const operationsSummary = document.getElementById("operationsSummary");
const refreshBtn = document.getElementById("refreshBtn");
const cleanupExpiredBtn = document.getElementById("cleanupExpiredBtn");
const todayViewBtn = document.getElementById("todayViewBtn");
const ordersViewBtn = document.getElementById("ordersViewBtn");
const scheduleViewBtn = document.getElementById("scheduleViewBtn");
const productionViewBtn = document.getElementById("productionViewBtn");
const sectionTitle = document.getElementById("sectionTitle");
const ordersActions = document.getElementById("ordersActions");
const assemblyViewBtn = document.getElementById("assemblyViewBtn");
const fulfilmentViewBtn = document.getElementById("fulfilmentViewBtn");
const inventoryViewBtn = document.getElementById("inventoryViewBtn");
const financeViewBtn = document.getElementById("financeViewBtn");
const settingsViewBtn = document.getElementById("settingsViewBtn");

const orderFilters = document.getElementById("orderFilters");
const orderSearch = document.getElementById("orderSearch");
const orderViewFilter = document.getElementById("orderViewFilter");
const statusFilter = document.getElementById("statusFilter");
const paymentFilter = document.getElementById("paymentFilter");
const fulfilmentFilter = document.getElementById("fulfilmentFilter");
const orderDateSort = document.getElementById("orderDateSort");

const logoutBtn = document.getElementById("logoutBtn");
const workshopNotesToggle = document.getElementById("workshopNotesToggle");
const workshopNotesBody = document.getElementById("workshopNotesBody");
const workshopNotesInput = document.getElementById("workshopNotesInput");
const workshopNotesSaveState = document.getElementById("workshopNotesSaveState");

const { data: { session } } = await supabase.auth.getSession();


console.log(session);

logoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  location.reload();
};

let currentView = "today";
let latestOrders = [];
let scheduleMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedScheduleDate = getSingaporeDateValue();
let workshopNotesSaveTimer = null;
let printers = [];
const AMS_BASE_RESERVATION_KEY = "little-keeps-ams-base-reservation";
let amsBaseReservation = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(AMS_BASE_RESERVATION_KEY));
    return {
      printerId: String(saved?.printerId || ""),
      colourNames: Array.isArray(saved?.colourNames)
        ? saved.colourNames.map(String)
        : []
    };
  } catch {
    return { printerId: "", colourNames: [] };
  }
})();
const selectedOrderIds = new Set();
const productionOrderSelection = new Set();

let inventoryItems = {};
let clearanceInventoryItems = {};
let productionJobs = [];
let productionJobsLoadFailed = false;
let productionStageView = "queue";
let productionQueueView = "timeline";
const DEFAULT_BUSINESS_FINANCIALS = {
  id: 1,
  printer_spend: 934,
  filament_accessories_spend: 628.36
};
let businessFinancials = { ...DEFAULT_BUSINESS_FINANCIALS };
let businessFinancialsLoaded = false;
let businessFinancialsLoadFailed = false;
let businessExpenses = [];
let businessExpensesLoaded = false;
let businessExpensesLoadFailed = false;
let businessSubscriptions = [];
let businessSubscriptionsLoaded = false;
let businessSubscriptionsLoadFailed = false;
const DEFAULT_ADMIN_SHOP_SETTINGS = {
  id: 1,
  usual_base_price: 3.90,
  launch_base_price: 3.20,
  launch_price_enabled: true,
  launch_price_ends_at: null,
  included_characters: 6,
  extra_character_price: 0.20,
  delivery_fee: 2.50,
  free_delivery_threshold: 50,
  max_orders_per_date: 2,
  bulk_buffer_days: 1,
  large_order_quantity: 7,
  bulk_order_quantity: 15,
  standard_min_working_days: 2,
  standard_max_working_days: 3,
  large_min_working_days: 4,
  large_max_working_days: 5,
  rush_fee_small: 5,
  rush_fee_large: 8,
  rush_max_missing_parts: 60,
  rush_max_active_orders: 5,
  mechanical_switch_low_stock: 100,
  key_ring_low_stock: 20,
  status_emails_enabled: false,
  status_email_template_id: "",
  review_url: "https://www.instagram.com/madebylittlekeeps/",
  contact_whatsapp_number: "6585121915",
  stripe_enabled: false,
  unavailable_colours: [],
  pickup_time_options: {
    weekday: ["7:00 PM", "7:30 PM", "8:00 PM"],
    weekend: ["10:00 AM", "2:00 PM", "7:00 PM"]
  }
};

let adminShopSettings = { ...DEFAULT_ADMIN_SHOP_SETTINGS };
let adminSettingsLoaded = false;
let adminSettingsLoadFailed = false;
let adminPromoCodes = [];
let adminCustomerReviews = [];
let adminShopClosures = [];
let adminReviewsLoadFailed = false;
let editingCustomerReviewId = null;
let adminProductCatalog = normalizeProductCatalog(DEFAULT_PRODUCT_CATALOG);
let adminProductsLoadFailed = false;

const ADMIN_COLOUR_OPTIONS = [
  { name: "Jade White", hex: "#FFFFFF" },
  { name: "Sunflower Yellow", hex: "#FEC600" },
  { name: "Gold", hex: "#E4BD68" },
  { name: "Pink", hex: "#F55A74" },
  { name: "Maroon Red", hex: "#9D2235" },
  { name: "Turquoise", hex: "#00B1B7" },
  { name: "Cyan", hex: "#0086D6" },
  { name: "Mistletoe Green", hex: "#3F8E43" },
  { name: "Dark Green", hex: "#68724D" },
  { name: "Purple", hex: "#5E43B7" },
  { name: "Indigo Purple", hex: "#482960" },
  { name: "Black", hex: "#000000" }
];

function getUnavailableAdminColours() {
  return new Set(
    (Array.isArray(adminShopSettings.unavailable_colours)
      ? adminShopSettings.unavailable_colours
      : []
    ).map(name => String(name).trim().toLowerCase())
  );
}

const ACTIVE_ORDER_STATUSES = [
  "Rush Review",
  "Bulk Review",
  "Pending Payment",
  "Payment Verification",
  "Payment Verified",
  "Printing",
  "Assembly Complete",
  "Pending Pickup",
  "Pending Delivery",
  "Out for Delivery"
];

const FULFILMENT_STATUSES = [
  "Assembly Complete",
  "Pending Pickup",
  "Pending Delivery",
  "Out for Delivery"
];

const PRODUCTION_ORDER_STATUSES = [
  "Payment Verified",
  "Printing"
];

const hardwareItems = [
  {
    itemName: "Mechanical Switch",
    label: "Mechanical Switch",
    category: "Hardware"
  },
  {
    itemName: "Metal Large D Ring",
    label: "Metal Large D Ring",
    category: "Hardware"
  },
  {
    itemName: "Gifting Bag",
    label: "Gifting Bag",
    category: "Packaging"
  },
  {
    itemName: "NTAG215 NFC Wet Label (25 mm)",
    label: "NTAG215 NFC Wet Label · 25 mm",
    category: "Hardware"
  },
  {
    itemName: "White Thickened Courier Bag (28 × 40 cm)",
    label: "White Thickened Courier Bag · 28 × 40 cm",
    category: "Packaging"
  },
  {
    itemName: "White Thickened Courier Bag (17 × 30 cm)",
    label: "White Thickened Courier Bag · 17 × 30 cm",
    category: "Packaging"
  },
  {
    itemName: "Pink Bubble Packing Bag (25 × 30 + 5 cm)",
    label: "Pink Bubble Packing Bag · 25 × 30 + 5 cm",
    category: "Packaging"
  },
  {
    itemName: "Self-Adhesive Transparent Bag (15 × 21 cm)",
    label: "Self-Adhesive Transparent Bag · 15 × 21 cm",
    category: "Packaging"
  }
];

function getCustomerSummaryHtml(order) {
  let savedOrderData = order.order_data;

  // Supabase may return JSON/JSONB as an array, or older rows may
  // contain the same information as a JSON string.
  if (typeof savedOrderData === "string") {
    try {
      savedOrderData = JSON.parse(savedOrderData);
    } catch (error) {
      console.error("Unable to read order_data:", error);
      savedOrderData = [];
    }
  }

  const items = Array.isArray(savedOrderData)
    ? savedOrderData
    : Array.isArray(savedOrderData?.items)
      ? savedOrderData.items
      : [];

  if (!items.length) {
    return `
      <p style="color:#888;">
        Your order details are available under reference
        <strong>${escapeEmailHtml(order.order_ref)}</strong>.
      </p>
    `;
  }

  const itemRows = items
    .slice(0, 50)
    .map((item, index) => {
      return `
        <div style="
          background:#ffffff;
          border:1px solid #f2dce5;
          border-radius:12px;
          padding:12px;
          margin:8px 0;
        ">
          <strong>
            ${index + 1}. ${escapeEmailHtml(item.name || "Personalised keychain")}
          </strong>

          <span style="float:right;">
            ${formatMoney(item.price)}
          </span>
        </div>
      `;
    })
    .join("");

  return `
    <h2 style="color:#ff6f9f;">
      Your Order
    </h2>

    ${itemRows}

    <p style="
      text-align:right;
      font-size:18px;
      margin-top:16px;
    ">
      Total:
      <strong>${formatMoney(order.total)}</strong>
    </p>
  `;
}

function createEmailMiniPreview(name, design) {
  return Array.from(sanitizeName(name))
    .map((letter, i) => {
      const base = design.bases[i % design.bases.length];
      const cap = design.caps[i % design.caps.length];
      const letterColour = design.letters[i % design.letters.length];

      return `
        <span style="
          display:inline-block;
          width:36px;
          height:36px;
          background:${base.hex};
          border-radius:10px;
          margin:4px;
          position:relative;
          vertical-align:middle;
        ">
          <span style="
            display:block;
            width:23px;
            height:23px;
            background:${cap.hex};
            border-radius:7px;
            position:absolute;
            left:50%;
            top:50%;
            transform:translate(-50%,-50%);
            text-align:center;
            line-height:23px;
            font-size:13px;
            font-weight:bold;
            color:${letterColour.hex};
          ">
            ${displayIcon(letter)}
          </span>
        </span>
      `;
    })
    .join("");
}

function renderCurrentView() {

  orderFilters.style.display = currentView === "orders" ? "" : "none";
  if (currentView === "today") {
    sectionTitle.innerText = "Today’s Work";
    ordersActions.style.display = "flex";
    renderStats(latestOrders);
    renderTodayWorkspace(latestOrders);
  }

  if (currentView === "orders") {
    sectionTitle.innerText = "Orders";
    ordersActions.style.display = "flex";
    renderStats(latestOrders);
    renderOrders(latestOrders);
  }

  if (currentView === "schedule") {
    sectionTitle.innerText = "Order Calendar";
    ordersActions.style.display = "none";
    renderScheduleCalendar();
  }

  if (currentView === "production") {
    sectionTitle.innerText = "Production";
    ordersActions.style.display = "none";
    renderProductionPlanner(latestOrders);
  }

  if (currentView === "assembly") {
    sectionTitle.innerText = "Assembly";
    ordersActions.style.display = "none";
    renderAssemblyQueue();
  }

  if (currentView === "fulfilment") {
    sectionTitle.innerText = "Fulfilment";
    ordersActions.style.display = "flex";
    renderFulfilmentWorkspace(latestOrders);
  }

  if (currentView === "inventory") {
    sectionTitle.innerText = "Inventory";
    ordersActions.style.display = "none";
    renderInventoryWorkspace();
  }

  if (currentView === "finance") {
    sectionTitle.innerText = "Business Finances";
    ordersActions.style.display = "none";
    renderFinanceWorkspace();
  }

  if (currentView === "settings") {
    sectionTitle.innerText = "Shop Settings";
    ordersActions.style.display = "none";
    renderSettingsWorkspace();
  }
}

const ORDER_PROGRESS = {
  "Rush Review": { percent: 5, label: "Rush request awaiting review" },
  "Bulk Review": { percent: 5, label: "Bulk request awaiting review" },
  "Pending Payment": { percent: 5, label: "Waiting for payment" },
  "Payment Expired": { percent: 0, label: "Checkout expired - slot released" },
  "Payment Verification": { percent: 15, label: "Checking payment" },
  "Payment Verified": { percent: 30, label: "Ready for production" },
  "Printing": { percent: 58, label: "Printing parts" },
  "Assembly Complete": { percent: 76, label: "Assembly complete - ready to notify" },
  "Pending Pickup": { percent: 88, label: "Pending pickup" },
  "Pending Delivery": { percent: 88, label: "Pending delivery" },
  "Out for Delivery": { percent: 94, label: "Out for delivery" },
  "Completed": { percent: 100, label: "Completed" }
  ,"Refunded": { percent: 100, label: "Refunded" }
};

function hasExpiredPaymentHold(order) {
  if (
    order.payment_type === "Paid" ||
    order.online_payment_status === "completed" ||
    order.status === "Payment Expired"
  ) {
    return order.status === "Payment Expired";
  }

  return Boolean(
    order.status === "Pending Payment" &&
    order.payment_expires_at &&
    new Date(order.payment_expires_at).getTime() <= Date.now()
  );
}

function formatPaymentHold(order) {
  if (hasExpiredPaymentHold(order)) return "Expired - production slot released";
  if (!order.payment_expires_at || order.status !== "Pending Payment") return "Not active";

  const expiry = new Date(order.payment_expires_at);
  if (Number.isNaN(expiry.getTime())) return "Not active";

  return `Held until ${expiry.toLocaleTimeString("en-SG", {
    hour: "numeric",
    minute: "2-digit"
  })}`;
}

function getOrderProgress(order) {
  return ORDER_PROGRESS[order.status] || { percent: 0, label: order.status || "Order received" };
}

function renderProgressBar(order, compact = false) {
  const progress = getOrderProgress(order);

  return `
    <div class="order-progress ${compact ? "is-compact" : ""}">
      <div class="order-progress-copy">
        <span>${escapeAdminHtml(progress.label)}</span>
        <strong>${progress.percent}%</strong>
      </div>
      <div class="order-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}">
        <span style="width:${progress.percent}%"></span>
      </div>
    </div>
  `;
}

function getOrderInstructions(order) {
  return [
    order.notes,
    order.preferred_time,
    order.special_instructions,
    order.handoff_notes
  ]
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function renderOrderAlerts(order, compact = false) {
  const instructions = getOrderInstructions(order);
  const hasHandoff = Boolean(order.handoff_name);
  const linkedChildren = latestOrders.filter(item =>
    String(item.linked_order_ref || "").toUpperCase() ===
    String(order.order_ref || "").toUpperCase()
  );

  if (
    !instructions.length &&
    !hasHandoff &&
    !order.linked_order_ref &&
    !linkedChildren.length &&
    !order.update_needs_review &&
    !order.rework_required
  ) {
    return "";
  }

  return `
    <div class="order-alert-stack ${compact ? "is-compact" : ""}">
      ${order.linked_order_ref ? `
        <div class="order-alert linked-order-alert">
          <strong>🔗 Add-on grouped under ${escapeAdminHtml(order.linked_order_ref)}</strong>
          <span>Latest shared pickup / dispatch date: ${escapeAdminHtml(formatDate(order.needed_by))}</span>
        </div>
      ` : ""}
      ${linkedChildren.length ? `
        <div class="order-alert linked-order-alert">
          <strong>🔗 ${linkedChildren.length} linked add-on${linkedChildren.length === 1 ? "" : "s"}</strong>
          <span>${linkedChildren.map(item => escapeAdminHtml(item.order_ref)).join(" · ")} · latest shared date ${escapeAdminHtml(formatDate(order.needed_by))}</span>
        </div>
      ` : ""}
      ${order.update_needs_review ? `
        <div class="order-alert order-update-alert">
          <strong>⚠ Order changed · review required</strong>
          <span>${escapeAdminHtml(order.update_summary || `Revision ${order.revision_number || 2} may affect production quantities.`)}</span>
          ${compact ? "" : `
            <button type="button" onclick='window.acknowledgeOrderUpdate(${JSON.stringify(String(order.id))}, this)'>
              Acknowledge & use recalculated quantities
            </button>
          `}
        </div>
      ` : ""}
      ${order.rework_required ? `
        <div class="order-alert rework-alert">
          <strong>↩ Workshop rework required</strong>
          <span>${escapeAdminHtml(order.rework_reason || "Returned from packing for another quality pass.")}</span>
          ${compact ? "" : `
            <button type="button" onclick='window.resolveOrderRework(${JSON.stringify(String(order.id))}, this)'>
              Mark rework resolved
            </button>
          `}
        </div>
      ` : ""}
      ${hasHandoff ? `
        <div class="order-alert handoff-alert">
          <strong>↗ Hand off to ${escapeAdminHtml(order.handoff_name)}</strong>
          <span>${escapeAdminHtml([
            order.handoff_relationship,
            order.handoff_phone
          ].filter(Boolean).join(" · ") || "Recipient is not the customer")}</span>
        </div>
      ` : ""}
      ${instructions.map(instruction => `
        <div class="order-alert instruction-alert">
          <strong>Special instruction</strong>
          <span>${escapeAdminHtml(instruction)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderProductionNote(order, compact = false) {
  return `
    <section class="production-note ${compact ? "is-compact" : ""}">
      <label>
        <strong>Private production note</strong>
        <span>Only for your workshop — not shown to the customer.</span>
        <textarea rows="${compact ? 2 : 3}" placeholder="e.g. Base connected only; inspect the N cap again…">${escapeAdminHtml(order.production_notes || "")}</textarea>
      </label>
      <button
        type="button"
        onclick='window.saveOrderProductionNote(
          ${JSON.stringify(String(order.id))},
          this.closest(".production-note").querySelector("textarea").value,
          this
        )'
      >
        Save note
      </button>
    </section>
  `;
}

function renderAssemblyChecklist(order, compact = false) {
  const progress = normalizeAssemblyProgress(order.assembly_progress);
  const completed = Object.values(progress).filter(Boolean).length;

  return `
    <section class="assembly-checklist ${compact ? "is-compact" : ""}">
      <header>
        <strong>Assembly progress</strong>
        <span>${completed}/${ASSEMBLY_STAGES.length}</span>
      </header>
      <div>
        ${ASSEMBLY_STAGES.map(stage => `
          <label>
            <input
              type="checkbox"
              ${progress[stage.key] ? "checked" : ""}
              onchange='window.updateAssemblyStage(${JSON.stringify(String(order.id))}, ${JSON.stringify(stage.key)}, this.checked)'
            >
            <span>${escapeAdminHtml(stage.label)}</span>
          </label>
        `).join("")}
      </div>
    </section>
  `;
}

async function loadWorkshopNotes() {
  const localFallback = localStorage.getItem("little-keeps-workshop-notes") || "";

  if (IS_ADMIN_PREVIEW) {
    workshopNotesInput.value =
      localFallback ||
      "Both printers are online.\nCheck add-on for LK-1042.\nAlicia: pass to husband.";
    return;
  }

  const { data, error } = await supabase
    .from("workshop_notes")
    .select("content")
    .eq("id", 1)
    .maybeSingle();

  workshopNotesInput.value = error ? localFallback : (data?.content || localFallback);
  if (error) console.warn("Using local workshop notes fallback:", error);
}

async function saveWorkshopNotes() {
  const content = workshopNotesInput.value;
  localStorage.setItem("little-keeps-workshop-notes", content);
  workshopNotesSaveState.textContent = "Saving…";

  if (!IS_ADMIN_PREVIEW) {
    const { error } = await supabase
      .from("workshop_notes")
      .upsert({ id: 1, content, updated_at: new Date().toISOString() });

    if (error) {
      workshopNotesSaveState.textContent = "Saved on this device";
      console.warn("Unable to sync workshop notes:", error);
      return;
    }
  }

  workshopNotesSaveState.textContent = "Saved";
}

async function loadPrinters() {
  if (IS_ADMIN_PREVIEW) {
    printers = [
      { id: "a1-mini-1", name: "Whimsy Daisy", status: "online", issue_notes: "" },
      { id: "a1-mini-2", name: "Little Keeps", status: "online", issue_notes: "" }
    ];
    return;
  }

  const { data, error } = await supabase
    .from("printers")
    .select("*")
    .order("name");

  if (error) {
    console.warn("Printer tracking is not ready:", error);
    printers = [];
    return;
  }
  const printerNames = {
    "a1-mini-1": "Whimsy Daisy",
    "a1-mini-2": "Little Keeps"
  };
  printers = (data || []).map(printer => ({
    ...printer,
    name: printerNames[String(printer.id)] || printer.name
  }));
}

function getPriorityOrders(orders) {
  return orders
    .filter(order => !order.archived_at && ACTIVE_ORDER_STATUSES.includes(order.status))
    .sort((a, b) => {
      const aDate = new Date(`${String(a.needed_by || "9999-12-31").slice(0, 10)}T00:00:00`);
      const bDate = new Date(`${String(b.needed_by || "9999-12-31").slice(0, 10)}T00:00:00`);
      return aDate - bDate;
    });
}

function renderTodayOrder(order) {
  const due = getDuePresentation(order);

  return `
    <button class="today-order ${due.className}" type="button" onclick='window.focusOrder(${JSON.stringify(String(order.id))})'>
      <span>
        <strong>${escapeAdminHtml(order.order_ref || "-")}</strong>
        <small>${escapeAdminHtml(order.customer_name || "Customer")} · ${getMethodLabel(order.collection_method)}</small>
        ${order.update_needs_review ? `<em>Changed · review</em>` : ""}
        ${getOrderInstructions(order).length ? `<em>Special instruction</em>` : ""}
      </span>
      <span class="today-order-right">
        <b>${escapeAdminHtml(due.label)}</b>
        <small>${escapeAdminHtml(order.status || "-")}</small>
      </span>
    </button>
  `;
}

function renderTodayWorkspace(orders) {
  const groupedOrders = groupLinkedOrdersForAdmin(orders);
  const priority = getPriorityOrders(groupedOrders);
  const operational = getOperationalBuckets(groupedOrders);
  const dueNow = priority.filter(order => {
    const days = getDaysUntil(order.needed_by);
    return days !== null && days <= 1 && !["Rush Review", "Bulk Review"].includes(order.status);
  });
  const specialRequests = priority.filter(order =>
    ["Rush Review", "Bulk Review"].includes(order.status)
  );
  const awaitingPayment = priority.filter(order =>
    ["Pending Payment", "Payment Verification"].includes(order.status)
  );
  const production = priority.filter(order =>
    ["Payment Verified", "Printing"].includes(order.status)
  );
  const fulfilment = priority.filter(order => FULFILMENT_STATUSES.includes(order.status));
  const workflowOrders = groupedOrders.filter(order =>
    !order.archived_at && ACTIVE_ORDER_STATUSES.includes(order.status)
  );
  const workflowReview = workflowOrders.filter(order =>
    ["Rush Review", "Bulk Review", "Pending Payment", "Payment Verification"].includes(order.status)
  );
  const workflowPrintPlan = workflowOrders.filter(order => order.status === "Payment Verified");
  const workflowPrinting = workflowOrders.filter(order => order.status === "Printing");
  const workflowAssembly = operational.assemblyInProgress;
  const workflowFulfilment = workflowOrders.filter(order => FULFILMENT_STATUSES.includes(order.status));
  const reprints = productionJobs.filter(job =>
    ["failed", "reprint_needed"].includes(job.quality_status)
  );
  const offlinePrinterIds = new Set(
    printers.filter(printer => printer.status === "offline").map(printer => String(printer.id))
  );
  const affectedPrinterJobs = productionJobs.filter(job =>
    job.stage === "printing" && offlinePrinterIds.has(String(job.printer_id))
  );
  const lowStock = hardwareItems
    .map(item => ({
      ...item,
      qty: getInventoryQty(item.itemName),
      threshold: Number(adminShopSettings[`${item.itemName.toLowerCase().replaceAll(" ", "_")}_low_stock`] || 20)
    }))
    .filter(item => item.qty <= item.threshold);

  const section = (title, icon, rows, emptyText) => `
    <section class="today-panel">
      <header><span aria-hidden="true">${icon}</span><h3>${title}</h3><b>${rows.length}</b></header>
      <div class="today-list">
        ${rows.map(renderTodayOrder).join("") || `<p class="today-empty">${emptyText}</p>`}
      </div>
    </section>
  `;

  ordersContainer.innerHTML = `
    <div class="today-heading">
      <div>
        <h2>Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"} ♡</h2>
        <p class="hint">Start with urgent orders, then move through payment, production and fulfilment.</p>
      </div>
      <button class="ready-btn" type="button" onclick="window.openProductionView()">Open Production</button>
    </div>

    <section class="admin-order-pipeline" aria-label="Order workflow">
      <header>
        <div><p class="section-kicker">Order workflow</p><h3>Move every order from left to right</h3></div>
        <span>Linked orders stay together throughout</span>
      </header>
      <div class="admin-order-pipeline-steps">
        <button type="button" onclick="window.openAdminWorkflow('orders')">
          <i>1</i><span><strong>Review & payment</strong><small>Approve requests and verify payment</small></span><b>${workflowReview.length}</b>
        </button>
        <button type="button" onclick="window.openAdminWorkflow('production')">
          <i>2</i><span><strong>Labels & print plan</strong><small>Print basket labels and optimise plates</small></span><b>${workflowPrintPlan.length}</b>
        </button>
        <button type="button" onclick="window.openAdminWorkflow('production')">
          <i>3</i><span><strong>Printing</strong><small>Track plates, printers and picked parts</small></span><b>${workflowPrinting.length}</b>
        </button>
        <button type="button" onclick="window.openAdminWorkflow('assembly')">
          <i>4</i><span><strong>Assembly & QC</strong><small>Assemble, check and pack once</small></span><b>${workflowAssembly.length}</b>
        </button>
        <button type="button" onclick="window.openAdminWorkflow('fulfilment')">
          <i>5</i><span><strong>Fulfilment</strong><small>Pickup, dispatch and complete</small></span><b>${workflowFulfilment.length}</b>
        </button>
      </div>
    </section>

    ${lowStock.length ? `
      <div class="stock-alert">
        <strong>Low-stock reminder</strong>
        <span>${lowStock.map(item => `${escapeAdminHtml(item.label)}: ${item.qty}`).join(" · ")}</span>
      </div>
    ` : ""}

    <div class="today-command-strip">
      <article class="${operational.overdue.length ? "is-danger" : ""}">
        <span>Overdue</span><strong>${operational.overdue.length}</strong>
      </article>
      <article class="${operational.dueTomorrow.length ? "is-warning" : ""}">
        <span>Due tomorrow</span><strong>${operational.dueTomorrow.length}</strong>
      </article>
      <article class="${operational.needsReview.length ? "is-warning" : ""}">
        <span>Changed orders</span><strong>${operational.needsReview.length}</strong>
      </article>
      <article class="${reprints.length ? "is-danger" : ""}">
        <span>Failed / reprint</span><strong>${reprints.length}</strong>
      </article>
      <article class="${operational.rework.length ? "is-warning" : ""}">
        <span>Packing rework</span><strong>${operational.rework.length}</strong>
      </article>
      <article class="${affectedPrinterJobs.length ? "is-danger" : ""}">
        <span>Needs reassignment</span><strong>${affectedPrinterJobs.length}</strong>
      </article>
      <article><span>Assembly started</span><strong>${operational.assemblyInProgress.length}</strong></article>
      <article><span>Packed</span><strong>${operational.packed.length}</strong></article>
      <article><span>Pickup</span><strong>${operational.pickup.length}</strong></article>
      <article><span>Delivery</span><strong>${operational.delivery.length}</strong></article>
    </div>

    <div class="today-grid">
      ${section("Changed orders — acknowledge first", "⚠️", operational.needsReview, "No order changes need review.")}
      ${section("Overdue & not delivered", "🚨", operational.overdue, "No overdue active orders.")}
      ${section("Rush & bulk requests", "⚡", specialRequests, "No special requests need review.")}
      ${section("Due today or tomorrow", "⏰", dueNow, "Nothing urgent - lovely!")}
      ${section("Payment attention", "💳", awaitingPayment, "No payments need attention.")}
      ${section("Print & assemble", "🖨️", production, "Production is caught up.")}
      ${section("Pickup & delivery", "📦", fulfilment, "Nothing is waiting for fulfilment.")}
    </div>
  `;
}

window.openAdminWorkflow = function(stage) {
  const tabs = {
    orders: ordersViewBtn,
    production: productionViewBtn,
    assembly: assemblyViewBtn,
    fulfilment: fulfilmentViewBtn
  };
  currentView = tabs[stage] ? stage : "today";
  setActiveTab(tabs[stage] || todayViewBtn);
  renderCurrentView();
};

window.focusOrder = function(id) {
  currentView = "orders";
  setActiveTab(ordersViewBtn);
  orderViewFilter.value = "all";
  statusFilter.value = "all";
  paymentFilter.value = "all";
  const order = latestOrders.find(item => String(item.id) === String(id));
  orderSearch.value = order?.order_ref || "";
  renderCurrentView();
  requestAnimationFrame(() => {
    const card = document.querySelector(`[data-order-id="${CSS.escape(String(id))}"]`);
    if (card) {
      card.open = true;
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
};

window.openProductionView = function() {
  currentView = "production";
  setActiveTab(productionViewBtn);
  renderCurrentView();
};

function settingNumber(name, label, step = "1", min = "0") {
  return `
    <label class="settings-field">
      <span>${label}</span>
      <input name="${name}" type="number" min="${min}" step="${step}" value="${escapeAdminHtml(adminShopSettings[name] ?? 0)}">
    </label>
  `;
}

function settingSlider(name, label, min, max, suffix = "") {
  const value = Number(adminShopSettings[name] ?? min);
  return `
    <label class="settings-slider">
      <span><strong>${label}</strong><output id="${name}Output">${value}${suffix}</output></span>
      <input name="${name}" type="range" min="${min}" max="${max}" step="1" value="${value}"
        oninput="document.getElementById('${name}Output').value=this.value+'${suffix}'">
    </label>
  `;
}

function getScheduleDate(order) {
  return String(order.requested_completion_date || order.needed_by || "").slice(0, 10);
}

function isScheduleOrderActive(order) {
  return !order.archived_at && ![
    "Cancelled", "Rejected", "Payment Failed", "Payment Expired", "Refunded"
  ].includes(order.status || "");
}

function getScheduleOrdersForDate(dateValue) {
  return latestOrders.filter(order =>
    isScheduleOrderActive(order) && getScheduleDate(order) === dateValue
  );
}

function renderScheduleCalendar() {
  const year = scheduleMonth.getFullYear();
  const month = scheduleMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = scheduleMonth.toLocaleDateString("en-SG", { month: "long", year: "numeric" });
  const maxOrders = Math.max(1, Number(adminShopSettings.max_orders_per_date || 2));
  const closedDates = new Set();
  adminShopClosures.forEach(closure => {
    const cursor = new Date(`${closure.start_date}T12:00:00`);
    const end = new Date(`${closure.end_date}T12:00:00`);
    while (cursor <= end) {
      closedDates.add(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  const cells = [];
  for (let blank = 0; blank < firstWeekday; blank += 1) cells.push(`<div class="schedule-day is-empty"></div>`);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateValue = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const due = getScheduleOrdersForDate(dateValue);
    const pickups = latestOrders.filter(order => isScheduleOrderActive(order) && String(order.pickup_scheduled_date || "").slice(0, 10) === dateValue);
    const keychains = due.reduce((sum, order) => sum + (order.order_data || []).length, 0);
    const isFull = due.length >= maxOrders;
    const classes = [
      "schedule-day",
      dateValue === selectedScheduleDate ? "is-selected" : "",
      dateValue === getSingaporeDateValue() ? "is-today" : "",
      closedDates.has(dateValue) ? "is-closed" : "",
      isFull ? "is-full" : ""
    ].filter(Boolean).join(" ");
    cells.push(`
      <button class="${classes}" type="button" onclick="window.selectScheduleDate('${dateValue}')">
        <span class="schedule-day-number">${day}</span>
        ${closedDates.has(dateValue) ? `<small>Closed</small>` : ""}
        ${due.length ? `<strong>${keychains} keychain${keychains === 1 ? "" : "s"}</strong><small>${due.length}/${maxOrders} orders</small>` : ""}
        ${pickups.length ? `<em>${pickups.length} pickup${pickups.length === 1 ? "" : "s"}</em>` : ""}
      </button>
    `);
  }

  const selectedOrders = getScheduleOrdersForDate(selectedScheduleDate);
  const selectedPickups = latestOrders.filter(order => isScheduleOrderActive(order) && String(order.pickup_scheduled_date || "").slice(0, 10) === selectedScheduleDate);
  const detailRows = [...new Map([...selectedOrders, ...selectedPickups].map(order => [String(order.id), order])).values()];
  const selectedKeychains = selectedOrders.reduce((sum, order) => sum + (order.order_data || []).length, 0);

  ordersContainer.innerHTML = `
    <section class="schedule-workspace">
      <div class="schedule-explainer">
        <div><p class="section-kicker">Capacity-based planning</p><h2>${monthLabel}</h2></div>
        <p>Normal orders take the first open working day after their production lead time. The ${adminShopSettings.bulk_buffer_days || 0}-day buffer is kept only around event orders.</p>
      </div>
      <div class="schedule-capacity-strip">
        <span><strong>${maxOrders}</strong> orders / production day</span>
        <span><strong>${adminShopSettings.bulk_buffer_days || 0}</strong> event buffer day${Number(adminShopSettings.bulk_buffer_days || 0) === 1 ? "" : "s"}</span>
      </div>
      <div class="schedule-toolbar">
        <button type="button" onclick="window.changeScheduleMonth(-1)" aria-label="Previous month">←</button>
        <strong>${monthLabel}</strong>
        <button type="button" onclick="window.changeScheduleMonth(1)" aria-label="Next month">→</button>
      </div>
      <div class="schedule-weekdays">${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day => `<span>${day}</span>`).join("")}</div>
      <div class="schedule-grid">${cells.join("")}</div>
      <section class="schedule-date-detail">
        <div><p class="section-kicker">Selected date</p><h3>${formatDate(selectedScheduleDate)}</h3><span>${selectedOrders.length}/${maxOrders} orders · ${selectedKeychains} keychain${selectedKeychains === 1 ? "" : "s"} due</span></div>
        <div class="schedule-detail-list">
          ${detailRows.map(order => `
            <button type="button" onclick="window.focusOrder('${escapeAdminHtml(String(order.id))}')">
              <span><strong>${escapeAdminHtml(order.order_ref || "Order")}</strong><small>${escapeAdminHtml(order.customer_name || "Customer")} · ${(order.order_data || []).length} keychain${(order.order_data || []).length === 1 ? "" : "s"}</small></span>
              <em>${getScheduleDate(order) === selectedScheduleDate ? "Due" : "Pickup"} · ${escapeAdminHtml(order.status || "")}</em>
            </button>
          `).join("") || `<p class="today-empty">Nothing due or scheduled for pickup on this date.</p>`}
        </div>
      </section>
    </section>
  `;
}

window.changeScheduleMonth = function(offset) {
  scheduleMonth = new Date(scheduleMonth.getFullYear(), scheduleMonth.getMonth() + offset, 1);
  renderScheduleCalendar();
};

window.selectScheduleDate = function(dateValue) {
  selectedScheduleDate = dateValue;
  renderScheduleCalendar();
};

function formatDateTimeLocal(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatPromoDate(value) {
  if (!value) return "No limit";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No limit";

  return date.toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function renderSettingsWorkspace() {
  const checked = value => value ? "checked" : "";
  const unavailableColours = getUnavailableAdminColours();
  const pickupTimes = normalizePickupTimeOptions(adminShopSettings.pickup_time_options);
  const productNumberField = (product, field, label, step = "0.01") => `
    <label class="settings-field">
      <span>${label}</span>
      <input
        name="product:${escapeAdminHtml(product.product_key)}:${field}"
        type="number"
        min="0"
        step="${step}"
        value="${escapeAdminHtml(product[field] ?? 0)}"
      >
    </label>
  `;

  ordersContainer.innerHTML = `
    <form id="shopSettingsForm" class="settings-workspace">
      ${adminSettingsLoadFailed ? `
        <div class="stock-alert">
          <strong>Settings could not be loaded</strong>
          <span>Your saved values are protected. Refresh the page or check the Supabase connection before editing.</span>
        </div>
      ` : ""}
      <div class="settings-intro">
        <div>
          <h2>Run the shop without editing code</h2>
          <p class="hint">Pricing, capacity, turnaround, email updates and stock reminders are controlled here.</p>
        </div>
        <button class="ready-btn" type="submit" ${adminSettingsLoadFailed ? "disabled" : ""}>Save Settings</button>
      </div>

      <div class="settings-grid">
        <section class="settings-card settings-card-wide product-settings-section">
          <div class="settings-card-heading">
            <div>
              <h3>Products & pricing</h3>
              <p class="hint">Each product now has its own price and production timing. Coming-soon prices stay hidden from customers.</p>
            </div>
            <strong>${adminProductCatalog.length} products</strong>
          </div>

          ${adminProductsLoadFailed ? `
            <div class="stock-alert">
              <strong>Product catalogue is not connected yet</strong>
              <span>Run the supplied product-catalog SQL once before saving these cards.</span>
            </div>
          ` : ""}

          <div class="product-settings-grid">
            ${adminProductCatalog.map(product => {
              const prefix = `product:${product.product_key}:`;
              const isSolidDraft = product.product_key === "solid-clicky-keychain";

              return `
                <article class="product-settings-card ${product.status === "active" ? "is-active" : ""}">
                  <header>
                    <div>
                      <span>${escapeAdminHtml(product.eyebrow)}</span>
                      <h4>${escapeAdminHtml(product.name)}</h4>
                    </div>
                    <select name="${escapeAdminHtml(prefix)}status" aria-label="${escapeAdminHtml(product.name)} status">
                      <option value="active" ${product.status === "active" ? "selected" : ""}>Available</option>
                      <option value="coming_soon" ${product.status === "coming_soon" ? "selected" : ""}>Coming soon</option>
                      <option value="hidden" ${product.status === "hidden" ? "selected" : ""}>Hidden</option>
                    </select>
                  </header>

                  ${isSolidDraft ? `
                    <p class="product-draft-note">Draft suggestion: S$3.80 launch, then S$4.50. Keep pricing hidden until the test prints are timed.</p>
                  ` : ""}

                  <div class="settings-fields two-columns">
                    ${productNumberField(product, "usual_base_price", "Usual price ($)")}
                    ${productNumberField(product, "launch_base_price", "Launch price ($)")}
                    ${productNumberField(product, "included_characters", "Characters included", "1")}
                    ${productNumberField(product, "extra_character_price", "Extra character ($)")}
                    ${productNumberField(product, "extra_base_colour_price", "Extra base colour ($)")}
                    ${productNumberField(product, "extra_cap_colour_price", "Extra cap colour ($)")}
                    ${productNumberField(product, "extra_letter_colour_price", "Extra letter colour ($)")}
                    ${productNumberField(product, "maximum_characters", "Maximum characters", "1")}
                  </div>

                  <div class="product-timing-settings">
                    <strong>Production timing</strong>
                    <div class="settings-fields two-columns">
                      ${productNumberField(product, "base_print_minutes_fixed", "Base fixed minutes")}
                      ${productNumberField(product, "base_print_minutes_per_character", "Base minutes / character")}
                      ${productNumberField(product, "keycap_print_minutes_per_character", "Keycap minutes / character")}
                      ${productNumberField(product, "assembly_minutes_per_item", "Assembly minutes / item")}
                    </div>
                  </div>

                  <label class="settings-toggle">
                    <input name="${escapeAdminHtml(prefix)}launch_price_enabled" type="checkbox" ${checked(product.launch_price_enabled)}>
                    Use launch price
                  </label>
                  <label class="settings-toggle">
                    <input name="${escapeAdminHtml(prefix)}price_visible" type="checkbox" ${checked(product.price_visible)}>
                    Show price on product card
                  </label>
                  <label class="settings-field">
                    <span>Production notes</span>
                    <textarea name="${escapeAdminHtml(prefix)}production_notes" rows="3">${escapeAdminHtml(product.production_notes || "")}</textarea>
                  </label>
                </article>
              `;
            }).join("")}
          </div>
        </section>

        <section class="settings-card">
          <h3>Checkout</h3>
          <div class="settings-fields two-columns">
            ${settingNumber("delivery_fee", "Delivery fee ($)", "0.10")}
            ${settingNumber("free_delivery_threshold", "Free delivery from ($)", "0.10")}
          </div>
          <p class="hint">Product prices are managed separately above.</p>
        </section>

        <section class="settings-card">
          <h3>Exact pickup times</h3>
          <p class="hint">Enter one selectable time per line. Customers choose an exact appointment, not a time range.</p>
          <label class="settings-field">
            <span>Wednesday & Friday</span>
            <textarea name="pickup_times_weekday" rows="4">${escapeAdminHtml(pickupTimes.weekday.join("\n"))}</textarea>
          </label>
          <label class="settings-field">
            <span>Saturday & Sunday</span>
            <textarea name="pickup_times_weekend" rows="4">${escapeAdminHtml(pickupTimes.weekend.join("\n"))}</textarea>
          </label>
        </section>

        <section class="settings-card">
          <h3>Capacity & turnaround</h3>
          <p class="hint">A date closes when its order limit is reached. The number of keychains does not close a standard production day. Buffer days are reserved around event orders only.</p>
          <div class="settings-slider-stack">
            ${settingSlider("max_orders_per_date", "Orders accepted per production day", 1, 12)}
            ${settingSlider("bulk_buffer_days", "Protected days around event orders", 0, 4)}
            ${settingSlider("standard_min_working_days", "Small order minimum lead time", 1, 10, " days")}
            ${settingSlider("standard_max_working_days", "Small order maximum lead time", 1, 14, " days")}
            ${settingSlider("large_min_working_days", "Large order minimum lead time", 1, 14, " days")}
            ${settingSlider("large_max_working_days", "Large order maximum lead time", 1, 21, " days")}
          </div>
          <div class="settings-fields two-columns">
            ${settingNumber("large_order_quantity", "7+ tier starts at")}
            ${settingNumber("bulk_order_quantity", "Bulk request starts at")}
            ${settingNumber("rush_fee_small", "Rush fee: 1–4 items ($)", "0.50")}
            ${settingNumber("rush_fee_large", "Rush fee: 5–9 items ($)", "0.50")}
            ${settingNumber("rush_max_missing_parts", "Auto-approve up to missing parts")}
            ${settingNumber("rush_max_active_orders", "Auto-approve up to active orders")}
          </div>
        </section>

        <section class="settings-card">
          <h3>Stock reminders</h3>
          <div class="settings-fields">
            ${settingNumber("mechanical_switch_low_stock", "Warn when switches reach")}
            ${settingNumber("key_ring_low_stock", "Warn when large D rings reach")}
          </div>
        </section>

        <section class="settings-card settings-card-wide">
          <div class="settings-card-heading">
            <div>
              <h3>Colour availability</h3>
              <p class="hint">Tick a colour to mark it out of stock across bases, caps and letters.</p>
            </div>
            <strong id="colourStockCount" class="colour-stock-count">
              ${unavailableColours.size} out of stock
            </strong>
          </div>

          <div class="admin-colour-grid">
            ${ADMIN_COLOUR_OPTIONS.map(colour => {
              const isUnavailable = unavailableColours.has(colour.name.toLowerCase());

              return `
                <label class="admin-colour-option ${isUnavailable ? "is-oos" : ""}">
                  <input
                    name="unavailable_colours"
                    type="checkbox"
                    value="${escapeAdminHtml(colour.name)}"
                    ${checked(isUnavailable)}
                  >
                  <span
                    class="admin-colour-dot"
                    style="background:${colour.hex};"
                    aria-hidden="true"
                  ></span>
                  <span class="admin-colour-copy">
                    <strong>${escapeAdminHtml(colour.name)}</strong>
                    <small>${isUnavailable ? "Out of stock" : "Available"}</small>
                  </span>
                </label>
              `;
            }).join("")}
          </div>
        </section>

        <section class="settings-card">
          <h3>Customer updates</h3>
          <label class="settings-field">
            <span>Shop WhatsApp number</span>
            <input name="contact_whatsapp_number" inputmode="tel" value="${escapeAdminHtml(adminShopSettings.contact_whatsapp_number || "6585121915")}" placeholder="6585121915">
          </label>
          <p class="hint">Include the country code without + or spaces. This updates every customer-facing WhatsApp link.</p>
          <label class="settings-toggle"><input name="status_emails_enabled" type="checkbox" ${checked(adminShopSettings.status_emails_enabled)}> Automatically email pickup-ready, out-for-delivery and completed updates</label>
          <label class="settings-field">
            <span>EmailJS status-template ID</span>
            <input name="status_email_template_id" value="${escapeAdminHtml(adminShopSettings.status_email_template_id || "")}" placeholder="template_xxxxxxx">
          </label>
          <label class="settings-field">
            <span>Review / Instagram link</span>
            <input name="review_url" type="url" value="${escapeAdminHtml(adminShopSettings.review_url || "")}" placeholder="https://instagram.com/...">
          </label>
          <p class="hint">Use the supplied status email HTML in EmailJS, then paste that template ID here.</p>
        </section>

        <section class="settings-card settings-card-wide">
          <div class="settings-card-heading">
            <div>
              <h3>Shop closures</h3>
              <p class="hint">Use this for exams, personal breaks, maintenance or holidays. The notice and customer date estimates update automatically.</p>
            </div>
            <strong>${adminShopClosures.length} scheduled</strong>
          </div>
          <div class="closure-create-row">
            <label class="settings-field"><span>From</span><input id="shopClosureStart" type="date"></label>
            <label class="settings-field"><span>To</span><input id="shopClosureEnd" type="date"></label>
            <label class="settings-field closure-reason-field"><span>Customer notice</span><input id="shopClosureReason" placeholder="Closed for exams — orders reopen on…"></label>
            <button type="button" class="ready-btn" onclick="window.addShopClosure()">Add Closure</button>
          </div>
          <div class="closure-admin-list">
            ${adminShopClosures.map(closure => `
              <article>
                <div><strong>${formatDate(closure.start_date)}–${formatDate(closure.end_date)}</strong><span>${escapeAdminHtml(closure.reason || "Shop closed")}</span></div>
                <button type="button" class="archive-action" onclick="window.deleteShopClosure(${JSON.stringify(closure.id)})">Remove</button>
              </article>
            `).join("") || `<p class="today-empty">No shop closures scheduled.</p>`}
          </div>
        </section>

        <section class="settings-card settings-card-wide">
          <h3>Online payment</h3>
          <div class="payment-readiness">
            <div>
              <strong>${adminShopSettings.stripe_enabled ? "Stripe checkout enabled" : "Online checkout is disabled"}</strong>
              <p class="hint">PayNow is available for every order. Orders from $30 can also use card, Apple Pay or Google Pay.</p>
            </div>
            <label class="settings-toggle"><input name="stripe_enabled" type="checkbox" ${checked(adminShopSettings.stripe_enabled)}> Enable Stripe checkout</label>
          </div>
        </section>
      </div>

      <section class="settings-card promo-manager">
        <div class="settings-card-heading">
          <div><h3>Promo codes</h3><p class="hint">Schedule codes and feature one in the storefront announcement bar.</p></div>
        </div>
        <div class="promo-create-row">
          <input id="promoCodeInput" placeholder="CODE" maxlength="30">
          <input id="promoLabelInput" placeholder="Label, e.g. Teacher's Day">
          <select id="promoTypeInput"><option value="percent">Percent off</option><option value="fixed">Fixed amount</option></select>
          <input id="promoValueInput" type="number" min="0.01" step="0.01" placeholder="Value">
          <input id="promoMinimumInput" type="number" min="0" step="0.01" value="0" placeholder="Minimum spend">
          <label class="promo-create-field">
            <span>Starts</span>
            <input id="promoStartsInput" type="datetime-local">
          </label>
          <label class="promo-create-field">
            <span>Ends</span>
            <input id="promoEndsInput" type="datetime-local">
          </label>
          <label class="promo-feature-toggle">
            <input id="promoFeaturedInput" type="checkbox">
            Broadcast on storefront
          </label>
          <button class="ready-btn" type="button" onclick="window.addPromoCode()">Save Code</button>
        </div>
        <div class="promo-admin-list">
          ${adminPromoCodes.map(promo => `
            <div class="promo-admin-row ${promo.featured ? "is-featured" : ""}">
              <div>
                <strong>${escapeAdminHtml(promo.code)}</strong>
                <span>${escapeAdminHtml(promo.label || "Promo")}</span>
                <small>${formatPromoDate(promo.starts_at)} - ${formatPromoDate(promo.ends_at)}</small>
              </div>
              <span>${promo.discount_type === "fixed" ? formatMoney(promo.discount_value) : `${Number(promo.discount_value)}%`} off</span>
              <span>Min. ${formatMoney(promo.minimum_spend)}</span>
              <span class="promo-broadcast-status">${promo.featured ? "Broadcasting" : "Private"}</span>
              <div class="promo-admin-actions">
                <button type="button" onclick='window.editPromoCode(${JSON.stringify(promo.code)})'>Edit</button>
                <button type="button" onclick='window.toggleFeaturedPromo(${JSON.stringify(promo.code)}, ${!promo.featured})'>${promo.featured ? "Stop Broadcast" : "Feature"}</button>
                <button type="button" class="archive-action" onclick='window.deletePromoCode(${JSON.stringify(promo.code)})'>Delete</button>
              </div>
            </div>
          `).join("") || `<p class="today-empty">No promo codes yet.</p>`}
        </div>
      </section>

      <section class="settings-card review-manager">
        <div class="settings-card-heading">
          <div>
            <h3>Customer reviews</h3>
            <p class="hint">Add genuine customer feedback to the swipeable storefront section.</p>
          </div>
          <strong>${adminCustomerReviews.length} review${adminCustomerReviews.length === 1 ? "" : "s"}</strong>
        </div>

        ${adminReviewsLoadFailed ? `
          <div class="stock-alert">
            <strong>Review manager is not ready</strong>
            <span>Run the supplied customer reviews SQL once, then refresh Admin.</span>
          </div>
        ` : ""}

        <div class="review-create-grid">
          <label class="review-create-field review-quote-field">
            <span>Customer’s words</span>
            <textarea id="reviewQuoteInput" rows="3" maxlength="500" placeholder="Paste the genuine review here..."></textarea>
          </label>

          <label class="review-create-field">
            <span>Customer label</span>
            <input id="reviewCustomerInput" maxlength="80" value="Little Keeps customer" placeholder="e.g. Aisyah or Little Keeps customer">
          </label>

          <label class="review-create-field">
            <span>Occasion / ordered for</span>
            <input id="reviewOccasionInput" maxlength="80" list="reviewOccasionIdeas" placeholder="e.g. Teachers’ Day gifts">
            <datalist id="reviewOccasionIdeas">
              <option value="Birthday gift">
              <option value="Party goodie bags">
              <option value="Teachers’ Day gifts">
              <option value="Children’s Day gifts">
              <option value="Friendship gift">
              <option value="Class or team gifts">
              <option value="Group gifting">
              <option value="Just because">
            </datalist>
          </label>

          <label class="review-create-field review-image-field">
            <span>Customer photo (optional)</span>
            <input id="reviewImageInput" type="file" accept="image/jpeg,image/png,image/webp">
            <small>Use a clear product photo with the customer’s permission. Maximum 5 MB.</small>
          </label>

          <div id="reviewImagePreview" class="review-image-preview hidden"></div>

          <label id="reviewRemoveImageField" class="promo-feature-toggle hidden">
            <input id="reviewRemoveImageInput" type="checkbox">
            Remove current photo
          </label>

          <label class="review-create-field">
            <span>Display order</span>
            <input id="reviewSortInput" type="number" min="0" step="1" value="${(adminCustomerReviews.length + 1) * 10}">
          </label>

          <label class="promo-feature-toggle review-active-toggle">
            <input id="reviewActiveInput" type="checkbox" checked>
            Show on storefront
          </label>

          <div class="review-editor-actions">
            <button id="saveReviewBtn" class="ready-btn" type="button" onclick="window.saveCustomerReview()" ${adminReviewsLoadFailed ? "disabled" : ""}>
              Add Review
            </button>
            <button id="cancelReviewEditBtn" type="button" class="hidden" onclick="window.cancelCustomerReviewEdit()">
              Cancel Edit
            </button>
          </div>
        </div>

        <div class="review-admin-list">
          ${adminCustomerReviews.map(review => `
            <article class="review-admin-row ${review.active ? "" : "is-hidden"} ${review.image_url ? "has-photo" : ""}">
              ${String(review.image_url || "").startsWith("https://") ? `
                <img
                  class="review-admin-thumbnail"
                  src="${escapeAdminHtml(review.image_url)}"
                  alt=""
                  loading="lazy"
                >
              ` : ""}
              <div class="review-admin-copy">
                <blockquote>“${escapeAdminHtml(review.quote)}”</blockquote>
                <p>
                  <strong>${escapeAdminHtml(review.customer_label || "Little Keeps customer")}</strong>
                  <span>${escapeAdminHtml(review.occasion || "No occasion added")}</span>
                </p>
              </div>
              <div class="review-admin-meta">
                <span>Order ${Number(review.sort_order || 0)}</span>
                <strong>${review.active ? "Visible" : "Hidden"}</strong>
              </div>
              <div class="promo-admin-actions">
                <button type="button" onclick="window.editCustomerReview(${Number(review.id)})">Edit</button>
                <button type="button" onclick="window.toggleCustomerReview(${Number(review.id)}, ${!review.active})">${review.active ? "Hide" : "Show"}</button>
                <button type="button" class="archive-action" onclick="window.deleteCustomerReview(${Number(review.id)})">Delete</button>
              </div>
            </article>
          `).join("") || `<p class="today-empty">No reviews yet. Add your first one above.</p>`}
        </div>
      </section>
    </form>
  `;

  document.getElementById("shopSettingsForm").addEventListener("submit", saveShopSettings);
  document
    .querySelectorAll('.admin-colour-option input[name="unavailable_colours"]')
    .forEach(input => {
      input.addEventListener("change", () => {
        const option = input.closest(".admin-colour-option");
        option.classList.toggle("is-oos", input.checked);
        option.querySelector("small").textContent =
          input.checked ? "Out of stock" : "Available";

        const count = document.querySelectorAll(
          '.admin-colour-option input[name="unavailable_colours"]:checked'
        ).length;
        document.getElementById("colourStockCount").textContent =
          `${count} out of stock`;
      });
    });

  const reviewImageInput = document.getElementById("reviewImageInput");
  reviewImageInput?.addEventListener("change", () => {
    const preview = document.getElementById("reviewImagePreview");
    const file = reviewImageInput.files?.[0];
    if (!preview) return;

    if (!file) {
      preview.classList.add("hidden");
      preview.innerHTML = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${objectUrl}" alt="Selected review photo preview">`;
    preview.classList.remove("hidden");
    preview.querySelector("img")?.addEventListener("load", () => {
      URL.revokeObjectURL(objectUrl);
    }, { once: true });
  });
}

async function saveShopSettings(event) {
  event.preventDefault();

  if (adminSettingsLoadFailed) {
    alert("Your saved settings could not be loaded, so saving is disabled to protect them. Refresh and try again.");
    return;
  }

  const form = new FormData(event.currentTarget);
  const numberFields = [
    "delivery_fee", "free_delivery_threshold", "max_orders_per_date", "large_order_quantity",
    "bulk_order_quantity",
    "standard_min_working_days", "standard_max_working_days", "large_min_working_days",
    "large_max_working_days", "rush_fee_small", "rush_fee_large", "rush_max_missing_parts",
    "rush_max_active_orders", "mechanical_switch_low_stock", "key_ring_low_stock"
  ];
  const updates = { id: 1 };
  numberFields.forEach(name => { updates[name] = Number(form.get(name)); });
  updates.status_emails_enabled = form.has("status_emails_enabled");
  updates.stripe_enabled = form.has("stripe_enabled");
  updates.status_email_template_id = String(form.get("status_email_template_id") || "").trim();
  updates.review_url = String(form.get("review_url") || "").trim();
  updates.unavailable_colours = form
    .getAll("unavailable_colours")
    .map(name => String(name).trim())
    .filter(Boolean);
  const parsePickupTimes = name => String(form.get(name) || "")
    .split(/[\n,]+/)
    .map(value => value.trim())
    .filter(Boolean);
  updates.pickup_time_options = {
    ...normalizePickupTimeOptions({
    weekday: parsePickupTimes("pickup_times_weekday"),
    weekend: parsePickupTimes("pickup_times_weekend")
    }),
    bulk_buffer_days: Math.max(0, Number(form.get("bulk_buffer_days") || 0)),
    contact_whatsapp_number: String(form.get("contact_whatsapp_number") || "")
      .replace(/\D/g, "") || "6585121915"
  };
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase.from("shop_settings").upsert(updates).select().single();
  if (error) {
    console.error("Unable to save settings:", error);
    alert("Unable to save settings. Run the supplied operations SQL once, then try again.");
    return;
  }

  if (!adminProductsLoadFailed) {
    const productNumberFields = [
      "usual_base_price",
      "launch_base_price",
      "included_characters",
      "extra_character_price",
      "extra_base_colour_price",
      "extra_cap_colour_price",
      "extra_letter_colour_price",
      "maximum_characters",
      "base_print_minutes_fixed",
      "base_print_minutes_per_character",
      "keycap_print_minutes_per_character",
      "assembly_minutes_per_item"
    ];
    const productUpdates = adminProductCatalog.map(product => {
      const prefix = `product:${product.product_key}:`;
      const productUpdate = {
        ...product,
        status: String(form.get(`${prefix}status`) || product.status),
        launch_price_enabled: form.has(`${prefix}launch_price_enabled`),
        price_visible: form.has(`${prefix}price_visible`),
        production_notes: String(form.get(`${prefix}production_notes`) || "").trim(),
        updated_at: new Date().toISOString()
      };

      productNumberFields.forEach(field => {
        productUpdate[field] = Number(form.get(`${prefix}${field}`));
      });
      return productUpdate;
    });
    const { data: savedProducts, error: productsError } = await supabase
      .from("product_catalog")
      .upsert(productUpdates, { onConflict: "product_key" })
      .select("*");

    if (productsError) {
      console.error("Unable to save product settings:", productsError);
      alert("Checkout settings were saved, but product pricing could not be saved.");
      return;
    }

    adminProductCatalog = normalizeProductCatalog(savedProducts);
  }

  adminShopSettings = {
    ...data,
    bulk_buffer_days: Math.max(0, Number(
      data.pickup_time_options?.bulk_buffer_days ?? 1
    )),
    contact_whatsapp_number: String(
      data.pickup_time_options?.contact_whatsapp_number || "6585121915"
    ).replace(/\D/g, "") || "6585121915",
    pickup_time_options: normalizePickupTimeOptions(data.pickup_time_options)
  };
  alert("Shop settings saved ✓");
  renderSettingsWorkspace();
}

window.addShopClosure = async function() {
  const startDate = document.getElementById("shopClosureStart")?.value || "";
  const endDate = document.getElementById("shopClosureEnd")?.value || "";
  const reason = document.getElementById("shopClosureReason")?.value.trim() || "Shop closed";

  if (!startDate || !endDate) {
    alert("Choose both the closure start and end dates.");
    return;
  }
  if (endDate < startDate) {
    alert("The reopening date cannot be before the closure starts.");
    return;
  }

  const { error } = await supabase.from("shop_closures").insert({
    start_date: startDate,
    end_date: endDate,
    reason
  });
  if (error) {
    console.error("Unable to add shop closure:", error);
    alert("Unable to add the shop closure.");
    return;
  }

  await loadAdminSettings();
  renderSettingsWorkspace();
};

window.deleteShopClosure = async function(id) {
  if (!confirm("Remove this shop closure? Customers will immediately see those dates as available again.")) return;
  const { error } = await supabase.from("shop_closures").delete().eq("id", id);
  if (error) {
    console.error("Unable to remove shop closure:", error);
    alert("Unable to remove the shop closure.");
    return;
  }

  await loadAdminSettings();
  renderSettingsWorkspace();
};

async function addPromoCode() {
  const code = document.getElementById("promoCodeInput").value.trim().toUpperCase();
  const label = document.getElementById("promoLabelInput").value.trim() || code;
  const discountType = document.getElementById("promoTypeInput").value;
  const discountValue = Number(document.getElementById("promoValueInput").value);
  const minimumSpend = Number(document.getElementById("promoMinimumInput").value || 0);
  const startsValue = document.getElementById("promoStartsInput").value;
  const endsValue = document.getElementById("promoEndsInput").value;
  const featured = document.getElementById("promoFeaturedInput").checked;
  const startsAt = startsValue ? new Date(startsValue).toISOString() : null;
  const endsAt = endsValue ? new Date(endsValue).toISOString() : null;

  if (
    !/^[A-Z0-9_-]+$/.test(code) ||
    discountValue <= 0 ||
    (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt))
  ) {
    alert("Enter a valid code and discount value.");
    return;
  }

  if (featured) {
    const { error: clearError } = await supabase
      .from("promo_codes")
      .update({ featured: false, updated_at: new Date().toISOString() })
      .neq("code", code);
    if (clearError) {
      console.error("Unable to clear the previous featured promo:", clearError);
      alert("Unable to update the storefront broadcast. Run the supplied promo broadcast SQL once.");
      return;
    }
  }

  const { error } = await supabase.from("promo_codes").upsert({
    code, label, discount_type: discountType, discount_value: discountValue,
    minimum_spend: minimumSpend, starts_at: startsAt, ends_at: endsAt,
    active: true, featured, updated_at: new Date().toISOString()
  });
  if (error) {
    console.error("Unable to add promo:", error);
    alert("Unable to save the promo code. Check the supplied SQL has been run.");
    return;
  }

  await loadAdminSettings();
  renderSettingsWorkspace();
}

async function deletePromoCode(code) {
  const confirmed = window.confirm(
    `Delete promo code ${code}? Past orders that used it will not be changed.`
  );
  if (!confirmed) return;

  const { data, error } = await supabase
    .from("promo_codes")
    .delete()
    .eq("code", code)
    .select("code");

  if (error) {
    console.error("Unable to delete promo code:", error);
    alert("Unable to delete that promo code. Run the supplied promo delete SQL once, then try again.");
    return;
  }

  if (!data?.length) {
    alert("Supabase blocked this deletion. Run the supplied promo delete SQL once, then try again.");
    return;
  }

  await loadAdminSettings();
  renderSettingsWorkspace();
}

async function toggleFeaturedPromo(code, featured) {
  if (featured) {
    const { error: clearError } = await supabase
      .from("promo_codes")
      .update({ featured: false, updated_at: new Date().toISOString() })
      .neq("code", code);
    if (clearError) return alert("Unable to change the storefront broadcast.");
  }

  const { error } = await supabase
    .from("promo_codes")
    .update({ featured, updated_at: new Date().toISOString() })
    .eq("code", code);

  if (error) return alert("Unable to change the storefront broadcast.");
  await loadAdminSettings();
  renderSettingsWorkspace();
}

function editPromoCode(code) {
  const promo = adminPromoCodes.find(
    item => String(item.code).toUpperCase() === String(code).toUpperCase()
  );
  if (!promo) return;

  document.getElementById("promoCodeInput").value = promo.code;
  document.getElementById("promoLabelInput").value = promo.label || "";
  document.getElementById("promoTypeInput").value = promo.discount_type || "percent";
  document.getElementById("promoValueInput").value = promo.discount_value || "";
  document.getElementById("promoMinimumInput").value = promo.minimum_spend || 0;
  document.getElementById("promoStartsInput").value = formatDateTimeLocal(promo.starts_at);
  document.getElementById("promoEndsInput").value = formatDateTimeLocal(promo.ends_at);
  document.getElementById("promoFeaturedInput").checked = Boolean(promo.featured);
  document.getElementById("promoCodeInput").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

window.addPromoCode = addPromoCode;
window.deletePromoCode = deletePromoCode;
window.toggleFeaturedPromo = toggleFeaturedPromo;
window.editPromoCode = editPromoCode;

async function uploadCustomerReviewImage(file) {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

  if (!allowedTypes.has(file.type)) {
    throw new Error("Please choose a JPEG, PNG or WebP image.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("The review photo must be smaller than 5 MB.");
  }

  const extensionByType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };
  const fileName =
    `${Date.now()}-${crypto.randomUUID()}.${extensionByType[file.type]}`;

  const { error } = await supabase.storage
    .from("review-images")
    .upload(fileName, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("review-images")
    .getPublicUrl(fileName);

  return {
    imagePath: fileName,
    imageUrl: data.publicUrl
  };
}

async function saveCustomerReview() {
  const quote = document.getElementById("reviewQuoteInput")?.value.trim() || "";
  const customerLabel =
    document.getElementById("reviewCustomerInput")?.value.trim() ||
    "Little Keeps customer";
  const occasion =
    document.getElementById("reviewOccasionInput")?.value.trim() || "";
  const sortOrder = Number(
    document.getElementById("reviewSortInput")?.value || 0
  );
  const active = Boolean(
    document.getElementById("reviewActiveInput")?.checked
  );
  const imageFile = document.getElementById("reviewImageInput")?.files?.[0];
  const removeCurrentImage = Boolean(
    document.getElementById("reviewRemoveImageInput")?.checked
  );
  const existingReview = editingCustomerReviewId
    ? adminCustomerReviews.find(
        item => Number(item.id) === Number(editingCustomerReviewId)
      )
    : null;

  if (quote.length < 3) {
    alert("Please enter the customer’s review.");
    return;
  }

  if (!occasion) {
    alert("Please add what the order was for, such as Birthday gift or Group gifting.");
    return;
  }

  let imagePath = removeCurrentImage
    ? null
    : (existingReview?.image_path || null);
  let imageUrl = removeCurrentImage
    ? null
    : (existingReview?.image_url || null);
  let uploadedImagePath = null;

  if (imageFile) {
    try {
      const uploaded = await uploadCustomerReviewImage(imageFile);
      imagePath = uploaded.imagePath;
      imageUrl = uploaded.imageUrl;
      uploadedImagePath = uploaded.imagePath;
    } catch (error) {
      console.error("Unable to upload review photo:", error);
      alert(error.message || "Unable to upload the review photo.");
      return;
    }
  }

  const review = {
    quote,
    customer_label: customerLabel,
    occasion,
    image_path: imagePath,
    image_url: imageUrl,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    active,
    updated_at: new Date().toISOString()
  };

  if (editingCustomerReviewId) {
    review.id = editingCustomerReviewId;
  }

  const { error } = await supabase
    .from("customer_reviews")
    .upsert(review);

  if (error) {
    console.error("Unable to save customer review:", error);
    if (uploadedImagePath) {
      await supabase.storage
        .from("review-images")
        .remove([uploadedImagePath]);
    }
    alert("Unable to save the review. Run the supplied customer reviews SQL once, then try again.");
    return;
  }

  const previousImagePath = existingReview?.image_path || null;
  if (
    previousImagePath &&
    previousImagePath !== imagePath
  ) {
    await supabase.storage
      .from("review-images")
      .remove([previousImagePath]);
  }

  editingCustomerReviewId = null;
  await loadAdminSettings();
  renderSettingsWorkspace();
}

function editCustomerReview(id) {
  const review = adminCustomerReviews.find(
    item => Number(item.id) === Number(id)
  );
  if (!review) return;

  editingCustomerReviewId = Number(review.id);
  document.getElementById("reviewQuoteInput").value = review.quote || "";
  document.getElementById("reviewCustomerInput").value =
    review.customer_label || "Little Keeps customer";
  document.getElementById("reviewOccasionInput").value =
    review.occasion || "";
  document.getElementById("reviewSortInput").value =
    Number(review.sort_order || 0);
  document.getElementById("reviewActiveInput").checked =
    Boolean(review.active);
  const preview = document.getElementById("reviewImagePreview");
  const removeField = document.getElementById("reviewRemoveImageField");
  if (review.image_url && preview) {
    preview.innerHTML = `
      <img
        src="${escapeAdminHtml(review.image_url)}"
        alt="Current review photo"
      >
    `;
    preview.classList.remove("hidden");
    removeField?.classList.remove("hidden");
  } else {
    preview?.classList.add("hidden");
    removeField?.classList.add("hidden");
  }
  document.getElementById("reviewRemoveImageInput").checked = false;
  document.getElementById("saveReviewBtn").textContent = "Update Review";
  document.getElementById("cancelReviewEditBtn").classList.remove("hidden");
  document.getElementById("reviewQuoteInput").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
  document.getElementById("reviewQuoteInput").focus();
}

function cancelCustomerReviewEdit() {
  editingCustomerReviewId = null;
  renderSettingsWorkspace();
}

async function toggleCustomerReview(id, active) {
  const { error } = await supabase
    .from("customer_reviews")
    .update({
      active,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    console.error("Unable to update customer review:", error);
    alert("Unable to change this review.");
    return;
  }

  await loadAdminSettings();
  renderSettingsWorkspace();
}

async function deleteCustomerReview(id) {
  if (!window.confirm("Delete this customer review from the storefront?")) {
    return;
  }

  const { data, error } = await supabase
    .from("customer_reviews")
    .delete()
    .eq("id", id)
    .select("id");

  if (error || !data?.length) {
    console.error("Unable to delete customer review:", error);
    alert("Unable to delete this review. Check that the customer reviews SQL has been run.");
    return;
  }

  const deletedReview = adminCustomerReviews.find(
    item => Number(item.id) === Number(id)
  );
  if (deletedReview?.image_path) {
    await supabase.storage
      .from("review-images")
      .remove([deletedReview.image_path]);
  }

  if (Number(editingCustomerReviewId) === Number(id)) {
    editingCustomerReviewId = null;
  }

  await loadAdminSettings();
  renderSettingsWorkspace();
}

window.saveCustomerReview = saveCustomerReview;
window.editCustomerReview = editCustomerReview;
window.cancelCustomerReviewEdit = cancelCustomerReviewEdit;
window.toggleCustomerReview = toggleCustomerReview;
window.deleteCustomerReview = deleteCustomerReview;

window.moveAssemblyToFulfilment = async function(id) {
  const order = latestOrders.find(item => String(item.id) === String(id));
  if (!order) return;

  if (!IS_ADMIN_PREVIEW) {
    const { error } = await updateOrderFamily(order, {
      status: "Assembly Complete",
      status_updated_at: new Date().toISOString()
    });

    if (error) {
      alert("Unable to move this completed order to Fulfilment.");
      return;
    }
  }

  order.status = "Assembly Complete";
  currentView = "fulfilment";
  setActiveTab(fulfilmentViewBtn);
  await loadOrders();
};

function getOrderFamily(order) {
  const rootRef = String(order?.linked_order_ref || order?.order_ref || "").trim().toLowerCase();
  return latestOrders.filter(item =>
    String(item?.linked_order_ref || item?.order_ref || "").trim().toLowerCase() === rootRef
  );
}

async function updateOrderFamily(order, updateData) {
  const ids = getOrderFamily(order).map(item => item.id);
  if (!ids.length) return { error: new Error("Order family could not be found.") };
  return supabase.from("orders").update(updateData).in("id", ids);
}

window.markReady = async function(id) {
  const order = groupLinkedOrdersForAdmin(latestOrders).find(
    order => String(order.id) === String(id)
  );

  if (!order) return;

  await loadInventoryItems();

  const needs = getOrderRemainingInventoryNeeds(order);

  const missingItems = Object.entries(needs)
    .map(([itemName, qtyNeeded]) => {
      const stock = getInventoryQty(itemName);
      const missing = Math.max(0, qtyNeeded - stock);

      return {
        itemName,
        qtyNeeded,
        stock,
        missing
      };
    })
    .filter(item => item.missing > 0);

  if (missingItems.length) {
    alert(
      "This order is missing stock:\n\n" +
      missingItems
        .map(item =>
          `${item.itemName}: need ${item.qtyNeeded}, stock ${item.stock}`
        )
        .join("\n")
    );

    await renderAssemblyQueue();
    return;
  }

  const isDelivery = order.collection_method === "delivery";

  const ok = confirm(
    isDelivery
      ? `Move ${order.order_ref} to Pending Delivery?\n\n` +
        `This deducts any remaining parts and keeps delivery completion inside Fulfilment.`
      : `Mark ${order.order_ref} as ready for pickup?\n\n` +
        `Pickup is already booked for ${formatDate(order.pickup_scheduled_date)} at ${order.pickup_time_range || "the selected time"}.`
  );

  if (!ok) return;

  const { error } = await supabase.rpc("complete_order_inventory", {
    p_order_id: String(id),
    p_needs: needs
  });

  if (error) {
    console.error("Unable to complete assembly safely:", error);
    alert(
      "Nothing was deducted because the safe stock update could not finish.\n\n" +
      "Run the supplied operations SQL once, then try again."
    );
    return;
  }

  const finalStatus = isDelivery
    ? "Pending Delivery"
    : "Pending Pickup";
  const updatedOrder = {
    ...order,
    status: finalStatus
  };

  const familyIds = getOrderFamily(order).map(item => item.id);
  const { error: readyError } = await supabase
    .from("orders")
    .update({ status: finalStatus, status_updated_at: new Date().toISOString() })
    .in("id", familyIds);
  if (readyError) {
    alert("Stock was deducted, but the fulfilment status could not be updated.");
    await loadOrders();
    return;
  }

  if (isDelivery) {
    alert("Order moved to Pending Delivery. This is an internal step, so no customer email was sent.");
    await loadOrders();
    return;
  }

  try {
    const emailResult = await sendOrderStatusEmail(
      updatedOrder,
      finalStatus
    );

    if (emailResult.sent) {
      alert(
        isDelivery
          ? `Order is pending delivery and an update was sent to ${order.customer_email}.`
          : `Order is pending pickup on ${formatDate(order.pickup_scheduled_date)} at ${order.pickup_time_range}, and an update was sent to ${order.customer_email}.`
      );
    } else {
      alert(
        "Order finished, but no ready email was sent.\n\n" +
        (emailResult.reason || "Check Customer updates under Settings.")
      );
    }
  } catch (error) {
    console.error("Ready email failed:", error);
    alert(
      `${isDelivery ? "Order is pending delivery" : "Order is pending pickup"} and stock was deducted, but the customer email failed to send.\n\n` +
      (error?.text || error?.message || "Unknown EmailJS error")
    );
  }

  await loadOrders();
};

window.markKeychainComplete = async function(orderId, itemIndex) {
  const order = latestOrders.find(
    item => String(item.id) === String(orderId)
  );
  const index = Number(itemIndex);
  const keychain = order?.order_data?.[index];

  if (!order || !keychain || keychain.assembly_completed) return;

  await loadInventoryItems();

  const needs = getOrderInventoryNeeds({
    ...order,
    order_data: [keychain]
  });

  const missingItems = Object.entries(needs)
    .map(([itemName, qtyNeeded]) => ({
      itemName,
      qtyNeeded,
      stock: getInventoryQty(itemName)
    }))
    .filter(item => item.stock < item.qtyNeeded);

  if (missingItems.length) {
    alert(
      "This keychain is still missing stock:\n\n" +
      missingItems
        .map(item =>
          `${item.itemName}: need ${item.qtyNeeded}, stock ${item.stock}`
        )
        .join("\n")
    );
    await renderAssemblyQueue();
    return;
  }

  const ok = confirm(
    `Complete ${keychain.name || "this keychain"}?\n\n` +
    `Its printed parts and hardware will be deducted now.`
  );

  if (!ok) return;

  const { error } = await supabase.rpc(
    "complete_order_keychain_inventory",
    {
      p_order_id: String(orderId),
      p_item_index: index,
      p_needs: needs
    }
  );

  if (error) {
    console.error("Unable to complete this keychain safely:", error);
    alert(
      "Nothing was deducted.\n\n" +
      "Run the individual assembly SQL once, then try again."
    );
    return;
  }

  const completesOrder = (order.order_data || []).every(
    (item, itemPosition) => itemPosition === index || item.assembly_completed
  );

  if (completesOrder) {
    if (!IS_ADMIN_PREVIEW) {
      const { error: statusError } = await supabase
        .from("orders")
        .update({
          status: "Assembly Complete",
          status_updated_at: new Date().toISOString()
        })
        .eq("id", orderId);

      if (statusError) {
        alert("The keychain was completed, but the order could not move to Fulfilment automatically.");
      }
    }

    currentView = "fulfilment";
    setActiveTab(fulfilmentViewBtn);
  }

  await loadOrders();
};

window.markBaseAssemblyComplete = async function(orderId, itemIndex) {
  const order = latestOrders.find(item => String(item.id) === String(orderId));
  const index = Number(itemIndex);
  const keychain = order?.order_data?.[index];
  if (!order || !keychain || keychain.base_assembled || keychain.assembly_completed) return;

  await loadInventoryItems();
  const needs = getKeychainBaseAssemblyNeeds(keychain);
  const missingItems = Object.entries(needs).filter(
    ([itemName, qtyNeeded]) => getInventoryQty(itemName) < qtyNeeded
  );
  if (missingItems.length) {
    alert("Some base parts or hardware are no longer available. Refresh Production and try again.");
    await renderAssemblyQueue();
    return;
  }
  if (!confirm(`Mark the ${keychain.name || "keychain"} base as assembled and set aside?\n\nIts base parts and hardware will be deducted now.`)) return;

  if (IS_ADMIN_PREVIEW) {
    keychain.base_assembled = true;
    keychain.base_assembled_at = new Date().toISOString();
    renderCurrentView();
    return;
  }

  const { error } = await supabase.rpc("complete_keychain_base_assembly", {
    p_order_id: String(orderId),
    p_item_index: index,
    p_needs: needs
  });
  if (error) {
    console.error("Unable to save base assembly:", error);
    alert("Unable to mark this base assembled. Run the latest assembly workflow SQL once, then try again.");
    return;
  }
  await loadOrders();
};

window.sendSelectedPrintedPartsToReprint = async function(
  orderId,
  itemIndex,
  keepForClearance = true
) {
  const order = latestOrders.find(item => String(item.id) === String(orderId));
  const index = Number(itemIndex);
  const keychain = order?.order_data?.[index];
  if (!order || !keychain) return;

  const selected = Array.from(document.querySelectorAll(
    `[data-reprint-part][data-order-id="${CSS.escape(String(orderId))}"][data-item-index="${index}"]:checked`
  ));
  if (!selected.length) {
    alert("Tick the bases and keycaps that need reprinting first.");
    return;
  }

  const needs = {};
  selected.forEach(input => {
    const partNeeds = getKeychainPrintablePartNeeds(
      keychain,
      input.dataset.partType,
      Number(input.dataset.characterIndex)
    );
    Object.entries(partNeeds).forEach(([itemName, quantity]) => {
      needs[itemName] = (needs[itemName] || 0) + quantity;
    });
  });

  if (!confirm(
    `Send ${selected.length} checked printed part${selected.length === 1 ? "" : "s"} back to Production?\n\n` +
    "All checked parts will be processed together before Assembly refreshes."
  )) return;

  const { error } = await supabase.rpc("mark_inventory_for_reprint", {
    p_needs: needs,
    p_keep_for_clearance: Boolean(keepForClearance),
    p_order_ref: order.order_ref || null,
    p_reason: "Failed quality check"
  });
  if (error) {
    console.error("Unable to batch reprint parts:", error);
    alert("Unable to send the checked parts back to Production. Run the latest reprint SQL once, then try again.");
    return;
  }
  await loadOrders();
};

window.sendPrintedPartToReprint = async function(
  orderId,
  itemIndex,
  partType,
  characterIndex = null,
  keepForClearance = true
) {
  const order = latestOrders.find(
    item => String(item.id) === String(orderId)
  );
  const index = Number(itemIndex);
  const keychain = order?.order_data?.[index];
  const selectedCharacterIndex =
    characterIndex === null ? null : Number(characterIndex);

  if (!order || !keychain || keychain.assembly_completed) return;

  const needs = getKeychainPrintablePartNeeds(
    keychain,
    partType,
    Number.isInteger(selectedCharacterIndex)
      ? selectedCharacterIndex
      : null
  );

  if (!Object.keys(needs).length) {
    alert("This printed part could not be identified.");
    return;
  }

  let label = "all printed bases and keycaps";

  if (partType === "base") {
    label = Number.isInteger(selectedCharacterIndex)
      ? `the base at position ${selectedCharacterIndex + 1}`
      : "all bases for this keychain";
  } else if (partType === "keycap") {
    const character = Array.from(
      keychain.clean_name || keychain.name || ""
    )[selectedCharacterIndex];
    label = `the ${displayIcon(character)} keycap`;
  }

  const ok = confirm(
    `Send ${label} back to Production?\n\n` +
    "The printed quantity will be reduced so Production shows it as needing reprint. Hardware stock will not change.\n\n" +
    (keepForClearance
      ? "The rejected piece will be saved in Clearance / Seconds Inventory."
      : "The rejected piece will be discarded and will not enter clearance stock.")
  );

  if (!ok) return;

  const { error } = await supabase.rpc(
    "mark_inventory_for_reprint",
    {
      p_needs: needs,
      p_keep_for_clearance: Boolean(keepForClearance),
      p_order_ref: order.order_ref || null,
      p_reason: "Failed quality check"
    }
  );

  if (error) {
    console.error("Unable to send printed part for reprint:", error);
    alert(
      "Unable to send this part back to Production.\n\n" +
      "Run the latest reprint SQL once, then refresh the admin page.\n\n" +
      `Supabase: ${error.message || error.details || "Unknown database error"}`
    );
    return;
  }

  await loadOrders();
};

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDate(date) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getPaymentMethodLabel(order) {
  const method = String(order.stripe_payment_method || "").toLowerCase();
  const labels = {
    paynow: "PayNow",
    card: "Card",
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
    link: "Link"
  };

  if (labels[method]) return labels[method];
  if (order.online_payment_status === "completed") return "Stripe payment";
  if (order.payment_type === "Paid") return "Manually verified";
  return "Awaiting payment";
}

function renderPaymentLedger(order) {
  if (
    order.payment_type !== "Paid" &&
    order.online_payment_status !== "completed"
  ) {
    return "";
  }

  const hasFee =
    order.stripe_processing_fee !== null &&
    order.stripe_processing_fee !== undefined;
  const hasNet =
    order.stripe_net_amount !== null &&
    order.stripe_net_amount !== undefined;
  const stripeReference =
    order.stripe_balance_transaction_id ||
    order.stripe_payment_intent_id ||
    order.stripe_checkout_session_id ||
    "";

  return `
    <section class="payment-ledger-card full-row">
      <div class="payment-ledger-heading">
        <div>
          <small>Payment received</small>
          <strong>${escapeAdminHtml(getPaymentMethodLabel(order))}</strong>
        </div>
        <span>${escapeAdminHtml(formatDateTime(order.stripe_payment_completed_at || order.status_updated_at))}</span>
      </div>

      <div class="payment-ledger-values">
        <div>
          <span>Customer paid</span>
          <strong>${formatMoney(order.total)}</strong>
        </div>
        <div>
          <span>Stripe fee</span>
          <strong>${hasFee ? `-${formatMoney(order.stripe_processing_fee)}` : "Not recorded"}</strong>
        </div>
        <div>
          <span>Net received</span>
          <strong>${hasNet ? formatMoney(order.stripe_net_amount) : "Not recorded"}</strong>
        </div>
        ${Number(order.refunded_amount || 0) > 0 ? `
          <div>
            <span>Refunded</span>
            <strong>-${formatMoney(order.refunded_amount)}</strong>
          </div>
        ` : ""}
      </div>

      ${stripeReference ? `
        <p>
          <span>Stripe reference</span>
          <code>${escapeAdminHtml(stripeReference)}</code>
        </p>
      ` : `
        <p class="payment-ledger-note">This payment was verified manually, so Stripe fee details are unavailable.</p>
      `}
    </section>
  `;
}

function getMethodLabel(method) {
  if (method === "delivery") return "Islandwide Delivery";
  return method === "pickup_marsiling"
    ? "Marsiling MRT Pickup"
    : "Woodlands MRT Pickup";
}

function getPickupLocation(method) {
  return method === "pickup_marsiling"
    ? "Marsiling MRT"
    : "Woodlands MRT";
}

function escapeAdminHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderEmailHistory(order) {
  const entries = [
    {
      label: "Order saved",
      sentAt: order.order_saved_email_sent_at
    },
    {
      label: "Payment reminder",
      sentAt: order.payment_reminder_sent_at
    },
    {
      label: "Confirmation + PDF",
      sentAt: order.payment_confirmation_sent_at
    },
    {
      label: order.status_email_type
        ? `Status: ${order.status_email_type}`
        : "Status update",
      sentAt: order.status_email_sent_at
    },
    {
      label: "Review request",
      sentAt: order.review_request_sent_at
    }
  ];

  return `
    <section class="order-email-history">
      <div class="order-email-history-heading">
        <div>
          <span>Email history</span>
          <small>Recorded delivery attempts for this order</small>
        </div>
      </div>

      <div class="order-email-history-list">
        ${entries.map(entry => `
          <div class="order-email-history-item ${entry.sentAt ? "is-sent" : "is-pending"}">
            <span class="email-history-dot" aria-hidden="true"></span>
            <div>
              <strong>${escapeAdminHtml(entry.label)}</strong>
              <small>${entry.sentAt ? `Sent ${escapeAdminHtml(formatDateTime(entry.sentAt))}` : "Not sent yet"}</small>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function getOrderCharacterCount(order) {
  return (order.order_data || []).reduce((sum, item) => {
    return sum + Array.from(item.clean_name || sanitizeName(item.name || "")).length;
  }, 0);
}

function getOrderKeychainCount(order) {
  return (order.order_data || []).length;
}

function getItemGiftingBagQuantity(item) {
  const storedQuantity = Math.max(0, Math.floor(Number(item?.gifting_bag_quantity) || 0));
  return storedQuantity || (item?.gifting_bag === true ? 1 : 0);
}

function getOrderGiftingBagCount(order) {
  return (order.order_data || []).reduce(
    (sum, item) => sum + getItemGiftingBagQuantity(item),
    0
  );
}

function getWhatsAppHref(phoneValue) {
  let digits = String(phoneValue || "").replace(/\D/g, "");

  if (!digits) return "";

  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.length === 8) {
    digits = `65${digits}`;
  }

  return `https://wa.me/${digits}`;
}

function getTrackPayUrl(orderRef) {
  return `https://little-keeps.vercel.app/?resume_order=${encodeURIComponent(orderRef || "")}#orderStatusSection`;
}

function getDaysUntil(dateValue) {
  if (!dateValue) return null;

  const dueDate = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(dueDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.round((dueDate - today) / 86400000);
}

function getDuePresentation(order) {
  if (hasExpiredPaymentHold(order)) {
    return { className: "is-overdue", label: "Payment expired" };
  }

  if (order.status === "Completed") {
    return { className: "is-complete", label: "Completed" };
  }

  const days = getDaysUntil(order.needed_by);

  if (days === null) {
    return { className: "", label: "No date" };
  }

  if (days < 0) {
    return {
      className: "is-overdue",
      label: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`
    };
  }

  if (days === 0) {
    return { className: "is-urgent", label: "Due today" };
  }

  if (days === 1) {
    return { className: "is-urgent", label: "Due tomorrow" };
  }

  if (days <= 3) {
    return { className: "is-soon", label: `Due in ${days} days` };
  }

  return { className: "", label: formatDate(order.needed_by) };
}

function renderStats(orders) {
  const visibleOrders = orders.filter(order => !order.archived_at);
  const activeOrders = visibleOrders.filter(order =>
    ACTIVE_ORDER_STATUSES.includes(order.status)
  );

  const paidRevenue = visibleOrders.reduce((sum, order) => {
    return order.payment_type === "Paid"
      ? sum + Number(order.total || 0)
      : sum;
  }, 0);

  const dueSoon = activeOrders.filter(order => {
    const days = getDaysUntil(order.needed_by);
    return days !== null && days <= 3;
  }).length;

  const productionOrders = visibleOrders.filter(order =>
    PRODUCTION_ORDER_STATUSES.includes(order.status)
  );

  const switchesNeeded = productionOrders.reduce(
    (sum, order) => sum + getOrderCharacterCount(order),
    0
  );

  const readyOrders = activeOrders.filter(
    order => ["Assembly Complete", "Pending Pickup", "Pending Delivery"].includes(order.status)
  ).length;

  statsContainer.innerHTML = `
    <div class="stat-card stat-card-primary">
      <span>Open Orders</span>
      <strong>${activeOrders.length}</strong>
      <small>${visibleOrders.length} total recorded</small>
    </div>

    <div class="stat-card">
      <span>Paid Revenue</span>
      <strong>${formatMoney(paidRevenue)}</strong>
      <small>Excludes pending and giveaways</small>
    </div>

    <div class="stat-card ${dueSoon ? "stat-card-warning" : ""}">
      <span>Due Soon</span>
      <strong>${dueSoon}</strong>
      <small>Due within 3 days or overdue</small>
    </div>

    <div class="stat-card">
      <span>Switches Required</span>
      <strong>${switchesNeeded}</strong>
      <small>${getInventoryQty("Mechanical Switch")} currently in stock</small>
    </div>

    <div class="stat-card ${readyOrders ? "stat-card-success" : ""}">
      <span>Ready to Fulfil</span>
      <strong>${readyOrders}</strong>
      <small>Pickup or delivery</small>
    </div>
  `;

  renderOperationsSummary(orders);
}

function renderOperationsSummary(orders) {
  const visibleOrders = orders.filter(order => !order.archived_at);
  const productionOrders = visibleOrders.filter(order =>
    PRODUCTION_ORDER_STATUSES.includes(order.status)
  );

  const switchesNeeded = productionOrders.reduce(
    (sum, order) => sum + getOrderCharacterCount(order),
    0
  );

  const switchStock = getInventoryQty("Mechanical Switch");
  const switchShortage = Math.max(0, switchesNeeded - switchStock);
  const awaitingPayment = visibleOrders.filter(order =>
    ["Pending Payment", "Payment Verification"].includes(order.status)
  ).length;
  const awaitingReview = visibleOrders.filter(order =>
    ["Rush Review", "Bulk Review"].includes(order.status)
  ).length;
  const ready = visibleOrders.filter(
    order => ["Assembly Complete", "Pending Pickup", "Pending Delivery"].includes(order.status)
  ).length;
  const delivery = visibleOrders.filter(order =>
    ACTIVE_ORDER_STATUSES.includes(order.status) &&
    order.collection_method === "delivery"
  ).length;

  operationsSummary.innerHTML = `
    <div class="operations-copy">
      <span class="operations-icon" aria-hidden="true">✨</span>
      <div>
        <strong>${productionOrders.length ? "Today’s workshop focus" : "You’re caught up"}</strong>
        <p>
          ${productionOrders.length
            ? `${productionOrders.length} paid order${productionOrders.length === 1 ? "" : "s"} need production.`
            : "No paid orders are waiting for production."}
        </p>
      </div>
    </div>

    <div class="operations-chips">
      <span class="${awaitingReview ? "chip-danger" : ""}">${awaitingReview} special review</span>
      <span>${awaitingPayment} awaiting payment</span>
      <span>${ready} ready</span>
      <span>${delivery} delivery</span>
      <span class="${switchShortage ? "chip-danger" : "chip-success"}">
        ${switchShortage
          ? `${switchShortage} switches short`
          : "Switch stock covered"}
      </span>
    </div>
  `;
}

function formatPercentage(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatSgdMoney(value) {
  const amount = Number(value || 0);
  const sign = amount < 0 ? "-" : "";
  const formatted = Math.abs(amount).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return `${sign}S$${formatted}`;
}

async function loadBusinessFinancials() {
  if (IS_ADMIN_PREVIEW) {
    businessFinancialsLoaded = true;
    businessFinancialsLoadFailed = false;
    businessFinancials = { ...DEFAULT_BUSINESS_FINANCIALS };
    return;
  }

  const { data, error } = await supabase
    .from("business_financials")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  businessFinancialsLoaded = true;
  businessFinancialsLoadFailed = Boolean(error);

  if (error) {
    console.warn("Using fallback business financials:", error);
    businessFinancials = { ...DEFAULT_BUSINESS_FINANCIALS };
    return;
  }

  businessFinancials = {
    ...DEFAULT_BUSINESS_FINANCIALS,
    ...(data || {})
  };
}

async function loadBusinessExpenses() {
  if (IS_ADMIN_PREVIEW) {
    const previewAmounts = [
      60.20, 59.34, 34.18, 36.71, 38.20, 38.19, 206.09, 155.45
    ];
    businessExpensesLoaded = true;
    businessExpensesLoadFailed = false;
    businessExpenses = previewAmounts.map((amount, index) => ({
      id: index + 1,
      expense_date: new Date().toISOString().slice(0, 10),
      category: "Filament & accessories",
      description: `Purchase batch ${index + 1}${index === 6 ? " (your share)" : ""}`,
      amount
    }));
    return;
  }

  const { data, error } = await supabase
    .from("business_expenses")
    .select("*")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  businessExpensesLoaded = true;
  businessExpensesLoadFailed = Boolean(error);

  if (error) {
    console.warn("Unable to load business expenses:", error);
    businessExpenses = [];
    return;
  }

  businessExpenses = data || [];
}

async function loadBusinessSubscriptions() {
  if (IS_ADMIN_PREVIEW) {
    businessSubscriptionsLoaded = true;
    businessSubscriptionsLoadFailed = false;
    businessSubscriptions = [];
    return;
  }

  const { data, error } = await supabase
    .from("business_subscriptions")
    .select("*")
    .order("status", { ascending: true })
    .order("name", { ascending: true });

  businessSubscriptionsLoaded = true;
  businessSubscriptionsLoadFailed = Boolean(error);

  if (error) {
    console.warn("Unable to load business subscriptions:", error);
    businessSubscriptions = [];
    return;
  }

  businessSubscriptions = data || [];
}

function renderFinanceWorkspace() {
  const actualRevenue = calculatePaidOrderRevenue(latestOrders);
  const trackedExpenseTotal = businessExpensesLoadFailed
    ? Number(businessFinancials.filament_accessories_spend || 0)
    : businessExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0
      );
  const figures = calculateBusinessFinancials({
    printerSpend: businessFinancials.printer_spend,
    filamentAccessoriesSpend: trackedExpenseTotal,
    totalRevenue: actualRevenue
  });
  const subscriptionSummary = calculateSubscriptionSummary(businessSubscriptions);
  const isCashPositive = figures.netCashPosition >= 0;
  const amountToPositive = Math.max(0, -figures.netCashPosition);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore"
  }).format(new Date());
  const setupFailed =
    businessFinancialsLoadFailed || businessExpensesLoadFailed;
  const expenseRows = businessExpenses.map(expense => `
    <tr>
      <td>${formatDate(expense.expense_date)}</td>
      <td>
        <span class="expense-category">
          ${escapeAdminHtml(expense.category || "Business expense")}
        </span>
      </td>
      <td>${escapeAdminHtml(expense.description || "Expense")}</td>
      <td class="expense-amount">${formatSgdMoney(expense.amount)}</td>
      <td>
        <button
          type="button"
          class="expense-delete-btn"
          onclick="window.deleteBusinessExpense(${JSON.stringify(expense.id)})"
          aria-label="Delete ${escapeAdminHtml(expense.description || "expense")}"
        >
          Delete
        </button>
      </td>
    </tr>
  `).join("");
  const subscriptionRows = businessSubscriptions.map(subscription => {
    const isActive = subscription.status === "active";
    return `
      <tr>
        <td><strong>${escapeAdminHtml(subscription.name || "Subscription")}</strong></td>
        <td class="expense-amount">${formatSgdMoney(subscription.monthly_amount)}</td>
        <td>Day ${Number(subscription.billing_day || 1)}</td>
        <td>${formatDate(subscription.started_on)}</td>
        <td>
          <span class="subscription-status ${isActive ? "is-active" : "is-cancelled"}">
            ${isActive ? "Active" : "Cancelled"}
          </span>
        </td>
        <td class="subscription-actions">
          <button
            type="button"
            class="subscription-toggle-btn"
            onclick="window.toggleBusinessSubscription(${JSON.stringify(subscription.id)}, ${JSON.stringify(isActive ? "cancelled" : "active")})"
          >
            ${isActive ? "Cancel" : "Reactivate"}
          </button>
          <button
            type="button"
            class="expense-delete-btn"
            onclick="window.deleteBusinessSubscription(${JSON.stringify(subscription.id)})"
          >
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join("");

  ordersContainer.innerHTML = `
    <div class="finance-workspace">
      <div class="finance-hero ${isCashPositive ? "is-positive" : ""}">
        <div>
          <p class="finance-kicker">
            ${isCashPositive ? "You made it into the green!" : "Cost recovery"}
          </p>
          <h2>${formatPercentage(figures.recoveryPercentage)} recovered</h2>
          <p>
            ${isCashPositive
              ? `${formatSgdMoney(figures.netCashPosition)} beyond your startup investment.`
              : `${formatSgdMoney(amountToPositive)} more revenue to cover recorded business costs.`
            }
          </p>
        </div>
        <span class="finance-hero-icon" aria-hidden="true">
          ${isCashPositive ? "🌱" : "♡"}
        </span>
      </div>

      <div class="finance-progress-card">
        <div class="finance-progress-heading">
          <div>
            <span>Cost recovery</span>
            <strong>
              ${formatSgdMoney(figures.totalRevenue)}
              <small>of ${formatSgdMoney(figures.totalInvestment)}</small>
            </strong>
          </div>
          <span>${formatPercentage(figures.recoveryPercentage)}</span>
        </div>
        <div
          class="finance-progress-track"
          role="progressbar"
          aria-label="Cost recovery"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="${Math.round(figures.recoveryProgress)}"
        >
          <span style="width:${figures.recoveryProgress}%"></span>
        </div>
      </div>

      <div class="finance-metrics">
        <article class="finance-metric revenue">
          <span>Total Revenue</span>
          <strong>${formatSgdMoney(figures.totalRevenue)}</strong>
          <small>Automatically from paid orders, after refunds</small>
        </article>
        <article class="finance-metric">
          <span>Business Costs</span>
          <strong>${formatSgdMoney(figures.totalInvestment)}</strong>
          <small>Printer spend plus recorded expenses</small>
        </article>
        <article class="finance-metric ${isCashPositive ? "positive" : "negative"}">
          <span>Net Cash Position</span>
          <strong>${formatSgdMoney(figures.netCashPosition)}</strong>
          <small>Revenue minus recorded business costs</small>
        </article>
        <article class="finance-metric subscription-metric">
          <span>Monthly Subscriptions</span>
          <strong>${formatSgdMoney(subscriptionSummary.monthlyTotal)}</strong>
          <small>${subscriptionSummary.activeCount} active · ${formatSgdMoney(subscriptionSummary.yearlyEstimate)} yearly</small>
        </article>
      </div>

      <form id="businessFinancialsForm" class="finance-editor">
        <div class="finance-editor-heading">
          <div>
            <p class="section-kicker">Equipment investment</p>
            <h3>Printer spend</h3>
            <p>
              Revenue is automatic. Only update this if your printer investment changes.
            </p>
          </div>
          <span>Last saved ${businessFinancials.updated_at
            ? formatDateTime(businessFinancials.updated_at)
            : "with your starting figures"
          }</span>
        </div>

        ${setupFailed ? `
          <div class="finance-setup-note" role="alert">
            Run <strong>supabase/business-financials.sql</strong> once in
            Supabase before saving expenses. The dashboard is showing its
            safe starting values in the meantime.
          </div>
        ` : ""}

        <div class="finance-fields finance-fields-single">
          <label>
            <span>Printer spend</span>
            <div class="money-input">
              <span>S$</span>
              <input
                name="printer_spend"
                type="number"
                min="0"
                step="0.01"
                value="${figures.printerSpend.toFixed(2)}"
                required
              >
            </div>
          </label>
        </div>

        <button
          class="finance-save-btn"
          type="submit"
          ${businessFinancialsLoadFailed ? "disabled" : ""}
        >
          Save printer spend
        </button>
      </form>

      <section class="expense-ledger">
        <div class="finance-editor-heading">
          <div>
            <p class="section-kicker">Expense tracker</p>
            <h3>Business expenses</h3>
            <p>Record supplies and actual delivery charges paid by Little Keeps.</p>
          </div>
          <strong>${formatSgdMoney(figures.filamentAccessoriesSpend)}</strong>
        </div>

        <form id="businessExpenseForm" class="expense-entry-form">
          <label>
            <span>Date</span>
            <input name="expense_date" type="date" value="${today}" required>
          </label>
          <label>
            <span>Category</span>
            <select name="category" required>
              <option value="Filament">Filament</option>
              <option value="Accessories">Accessories</option>
              <option value="Filament & accessories">Mixed purchase</option>
              <option value="Delivery">Delivery</option>
            </select>
          </label>
          <label class="expense-description-field">
            <span>Description</span>
            <input
              name="description"
              maxlength="120"
              placeholder="e.g. PLA Silk+ restock"
              required
            >
          </label>
          <label>
            <span>Amount</span>
            <div class="money-input">
              <span>S$</span>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                required
              >
            </div>
          </label>
          <button
            class="finance-save-btn expense-add-btn"
            type="submit"
            ${businessExpensesLoadFailed ? "disabled" : ""}
          >
            Add expense
          </button>
        </form>

        <div class="expense-table-wrap">
          <table class="expense-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              ${expenseRows || `
                <tr>
                  <td colspan="5" class="expense-empty">
                    No expenses recorded yet.
                  </td>
                </tr>
              `}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">Total business expenses</td>
                <td class="expense-amount">
                  ${formatSgdMoney(figures.filamentAccessoriesSpend)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section class="expense-ledger subscription-ledger">
        <div class="finance-editor-heading">
          <div>
            <p class="section-kicker">Recurring expenses</p>
            <h3>Subscriptions</h3>
            <p>Track monthly tools and licences without counting future months as money already spent.</p>
          </div>
          <strong>${formatSgdMoney(subscriptionSummary.monthlyTotal)}<small>/month</small></strong>
        </div>

        ${businessSubscriptionsLoadFailed ? `
          <div class="finance-setup-note" role="alert">
            Run <strong>supabase/business-subscriptions.sql</strong> once before saving subscriptions.
          </div>
        ` : ""}

        <form id="businessSubscriptionForm" class="expense-entry-form subscription-entry-form">
          <label class="subscription-name-field">
            <span>Subscription</span>
            <input name="name" maxlength="100" placeholder="e.g. Patreon licence" required>
          </label>
          <label>
            <span>Monthly amount</span>
            <div class="money-input">
              <span>S$</span>
              <input name="monthly_amount" type="number" min="0.01" step="0.01" placeholder="0.00" required>
            </div>
          </label>
          <label>
            <span>Billing day</span>
            <input name="billing_day" type="number" min="1" max="31" value="1" required>
          </label>
          <label>
            <span>Started on</span>
            <input name="started_on" type="date" value="${today}" required>
          </label>
          <button
            class="finance-save-btn expense-add-btn"
            type="submit"
            ${businessSubscriptionsLoadFailed ? "disabled" : ""}
          >
            Add subscription
          </button>
        </form>

        <div class="expense-table-wrap">
          <table class="expense-table subscription-table">
            <thead>
              <tr>
                <th>Subscription</th>
                <th>Monthly</th>
                <th>Billing</th>
                <th>Started</th>
                <th>Status</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              ${subscriptionRows || `
                <tr>
                  <td colspan="6" class="expense-empty">
                    No subscriptions yet. Add Patreon and Meshy AI above.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  document
    .getElementById("businessFinancialsForm")
    ?.addEventListener("submit", saveBusinessFinancials);
  document
    .getElementById("businessExpenseForm")
    ?.addEventListener("submit", addBusinessExpense);
  document
    .getElementById("businessSubscriptionForm")
    ?.addEventListener("submit", addBusinessSubscription);
}

async function saveBusinessFinancials(event) {
  event.preventDefault();

  if (businessFinancialsLoadFailed) {
    alert("Set up business financials in Supabase before saving.");
    return;
  }

  const form = new FormData(event.currentTarget);
  const updates = {
    id: 1,
    printer_spend: Number(form.get("printer_spend")),
    updated_at: new Date().toISOString()
  };

  if (
    !Number.isFinite(updates.printer_spend) ||
    updates.printer_spend < 0
  ) {
    alert("Please enter a valid printer spend of zero or more.");
    return;
  }

  const saveButton = event.currentTarget.querySelector(
    ".finance-save-btn"
  );
  saveButton.disabled = true;
  saveButton.textContent = "Saving…";

  const { data, error } = await supabase
    .from("business_financials")
    .upsert(updates)
    .select()
    .single();

  if (error) {
    console.error("Unable to save business financials:", error);
    alert("Unable to save your figures. Please try again.");
    saveButton.disabled = false;
    saveButton.textContent = "Save printer spend";
    return;
  }

  businessFinancials = data;
  renderFinanceWorkspace();
}

async function addBusinessExpense(event) {
  event.preventDefault();

  if (businessExpensesLoadFailed) {
    alert("Set up the expense table in Supabase before adding expenses.");
    return;
  }

  const form = new FormData(event.currentTarget);
  const expense = {
    expense_date: String(form.get("expense_date") || ""),
    category: String(form.get("category") || ""),
    description: String(form.get("description") || "").trim(),
    amount: Number(form.get("amount"))
  };

  if (
    !expense.expense_date ||
    !["Filament", "Accessories", "Filament & accessories", "Delivery"].includes(
      expense.category
    ) ||
    !expense.description ||
    !Number.isFinite(expense.amount) ||
    expense.amount <= 0
  ) {
    alert("Please complete the date, category, description and amount.");
    return;
  }

  const button = event.currentTarget.querySelector(".expense-add-btn");
  button.disabled = true;
  button.textContent = "Adding…";

  const { error } = await supabase
    .from("business_expenses")
    .insert(expense);

  if (error) {
    console.error("Unable to add business expense:", error);
    alert("Unable to add the expense. Please try again.");
    button.disabled = false;
    button.textContent = "Add expense";
    return;
  }

  await loadBusinessExpenses();
  renderFinanceWorkspace();
}

window.deleteBusinessExpense = async function(expenseId) {
  const expense = businessExpenses.find(
    item => String(item.id) === String(expenseId)
  );

  if (!expense) return;
  if (!confirm(
    `Delete "${expense.description}" for ${formatSgdMoney(expense.amount)}?`
  )) return;

  const { error } = await supabase
    .from("business_expenses")
    .delete()
    .eq("id", expenseId);

  if (error) {
    console.error("Unable to delete business expense:", error);
    alert("Unable to delete the expense. Please try again.");
    return;
  }

  await loadBusinessExpenses();
  renderFinanceWorkspace();
};

async function addBusinessSubscription(event) {
  event.preventDefault();

  if (businessSubscriptionsLoadFailed) {
    alert("Set up the subscription table in Supabase before adding subscriptions.");
    return;
  }

  const form = new FormData(event.currentTarget);
  const subscription = {
    name: String(form.get("name") || "").trim(),
    monthly_amount: Number(form.get("monthly_amount")),
    billing_day: Number(form.get("billing_day")),
    started_on: String(form.get("started_on") || ""),
    status: "active"
  };

  if (
    !subscription.name ||
    !Number.isFinite(subscription.monthly_amount) ||
    subscription.monthly_amount <= 0 ||
    !Number.isInteger(subscription.billing_day) ||
    subscription.billing_day < 1 ||
    subscription.billing_day > 31 ||
    !subscription.started_on
  ) {
    alert("Please enter the subscription, monthly amount, billing day and start date.");
    return;
  }

  const button = event.currentTarget.querySelector(".expense-add-btn");
  button.disabled = true;
  button.textContent = "Adding…";

  const { error } = await supabase
    .from("business_subscriptions")
    .insert(subscription);

  if (error) {
    console.error("Unable to add business subscription:", error);
    alert("Unable to add the subscription. Please try again.");
    button.disabled = false;
    button.textContent = "Add subscription";
    return;
  }

  await loadBusinessSubscriptions();
  renderFinanceWorkspace();
}

window.toggleBusinessSubscription = async function(subscriptionId, status) {
  if (!['active', 'cancelled'].includes(status)) return;

  const { error } = await supabase
    .from("business_subscriptions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", subscriptionId);

  if (error) {
    console.error("Unable to update business subscription:", error);
    alert("Unable to update the subscription. Please try again.");
    return;
  }

  await loadBusinessSubscriptions();
  renderFinanceWorkspace();
};

window.deleteBusinessSubscription = async function(subscriptionId) {
  const subscription = businessSubscriptions.find(
    item => String(item.id) === String(subscriptionId)
  );

  if (!subscription) return;
  if (!confirm(`Delete "${subscription.name}"?`)) return;

  const { error } = await supabase
    .from("business_subscriptions")
    .delete()
    .eq("id", subscriptionId);

  if (error) {
    console.error("Unable to delete business subscription:", error);
    alert("Unable to delete the subscription. Please try again.");
    return;
  }

  await loadBusinessSubscriptions();
  renderFinanceWorkspace();
};

function renderOrders(orders) {
  const searchText = orderSearch.value.toLowerCase();
  const orderViewValue = orderViewFilter.value;
  const statusValue = statusFilter.value;
  const paymentValue = paymentFilter.value;
  const fulfilmentValue = fulfilmentFilter.value;
  const dateSortValue = orderDateSort.value;

  const groupedOrders = groupLinkedOrdersForAdmin(orders);
  const filteredOrders = groupedOrders.filter(order => {
    const designSearchText = (order.order_data || []).flatMap(item => {
      const design = item.design || {};
      return [
        item.name,
        ...(design.bases || []).map(colour => colour?.name || colour?.hex || colour),
        ...(design.caps || []).map(colour => colour?.name || colour?.hex || colour),
        ...(design.letters || []).map(colour => colour?.name || colour?.hex || colour)
      ];
    }).join(" ").toLowerCase();
    const matchesSearch =
      (order.order_ref || "").toLowerCase().includes(searchText) ||
      (order.customer_name || "").toLowerCase().includes(searchText) ||
      (order.customer_email || "").toLowerCase().includes(searchText) ||
      (order.customer_phone || "").toLowerCase().includes(searchText) ||
      (order.group_order_code || "").toLowerCase().includes(searchText) ||
      designSearchText.includes(searchText) ||
      getOrderInstructions(order).join(" ").toLowerCase().includes(searchText) ||
      (order.handoff_name || "").toLowerCase().includes(searchText);

    const matchesOrderView =
      (orderViewValue === "all" && !order.archived_at) ||
      (orderViewValue === "active" && !order.archived_at && ACTIVE_ORDER_STATUSES.includes(order.status)) ||
      (orderViewValue === "completed" && !order.archived_at && order.status === "Completed") ||
      (orderViewValue === "archived" && Boolean(order.archived_at));

    const matchesStatus =
      statusValue === "all" ||
      (statusValue === "review"
        ? ["Rush Review", "Bulk Review", "Payment Verification"].includes(order.status)
        : order.status === statusValue);

    const matchesPayment =
      paymentValue === "all" ||
      (paymentValue === "no-charge"
        ? ["Free", "Giveaway", "Replacement"].includes(order.payment_type)
        : order.payment_type === paymentValue);

    const matchesFulfilment =
      fulfilmentValue === "all" ||
      (fulfilmentValue === "delivery"
        ? order.collection_method === "delivery"
        : order.collection_method !== "delivery");

    return (
      matchesSearch &&
      matchesOrderView &&
      matchesStatus &&
      matchesPayment &&
      matchesFulfilment
    );
  }).sort((a, b) => {
    if (fulfilmentValue === "delivery") {
      const aRoute = getDeliveryRouteGroup(a.delivery_address);
      const bRoute = getDeliveryRouteGroup(b.delivery_address);
      const routeDifference = aRoute.sortValue - bRoute.sortValue;

      if (routeDifference) return routeDifference;

      const postalDifference =
        Number(aRoute.postalCode || Number.MAX_SAFE_INTEGER) -
        Number(bRoute.postalCode || Number.MAX_SAFE_INTEGER);

      if (postalDifference) return postalDifference;
    }

    const aDate = new Date(a.created_at || 0).getTime();
    const bDate = new Date(b.created_at || 0).getTime();

    return dateSortValue === "oldest"
      ? aDate - bDate
      : bDate - aDate;
  });

  if (!filteredOrders.length) {
    ordersContainer.innerHTML = `
      <div class="empty-card">
        <h3>No matching orders</h3>
        <p>Try changing the search or filters.</p>
      </div>
    `;
    return;
  }

  let previousRouteKey = "";

  const visibleOrderIds = filteredOrders.map(order => String(order.id));
  const selectedVisibleCount = visibleOrderIds.filter(id => selectedOrderIds.has(id)).length;

  ordersContainer.innerHTML = `
    <div class="order-batch-toolbar">
      <label>
        <input
          id="selectAllVisibleOrders"
          type="checkbox"
          ${selectedVisibleCount === visibleOrderIds.length && visibleOrderIds.length ? "checked" : ""}
          onchange='window.toggleVisibleOrderSelection(
            ${JSON.stringify(visibleOrderIds)},
            this.checked
          )'
        >
        <span>Select all visible</span>
      </label>
      <div>
        <strong id="selectedOrderCount">${selectedOrderIds.size} selected</strong>
        <button
          id="previewSelectedProductionBtn"
          type="button"
          ${selectedOrderIds.size ? "" : "disabled"}
          onclick="window.previewSelectedOrdersProduction()"
        >
          Preview Production & AMS
        </button>
        <button
          id="printSelectedInternalLabelsBtn"
          type="button"
          class="shipping-label-action"
          ${selectedOrderIds.size ? "" : "disabled"}
          onclick="window.printSelectedOrderBasketLabels()"
        >
          Print Internal Labels
        </button>
        <button
          id="printSelectedDeliveryLabelsBtn"
          type="button"
          class="hand-delivery-label-action"
          ${selectedOrderIds.size ? "" : "disabled"}
          onclick="window.printSelectedOrderHandDeliveryLabels()"
        >
          Print Hand-Delivery Labels
        </button>
        <button
          id="clearOrderSelectionBtn"
          type="button"
          class="batch-clear-action"
          ${selectedOrderIds.size ? "" : "disabled"}
          onclick="window.clearOrderSelection()"
        >
          Clear
        </button>
      </div>
    </div>
    ${fulfilmentValue === "delivery" ? `
      <div class="route-assistance-bar">
        <div>
          <strong>Google Maps route assistance</strong>
          <span>Select stops below. Google Maps may reorder or change routes; this is not guaranteed live optimisation.</span>
        </div>
        <button type="button" onclick="window.openSelectedDeliveryRoute()">Open Route</button>
      </div>
    ` : ""}
  ` + filteredOrders.map(order => {
    const due = getDuePresentation(order);
    const orderId = String(order.id);
    const orderRef = escapeAdminHtml(order.order_ref || "-");
    const customerName = escapeAdminHtml(order.customer_name || "-");
    const customerEmail = escapeAdminHtml(order.customer_email || "-");
    const customerPhone = escapeAdminHtml(order.customer_phone || "-");
    const keychainCount = getOrderKeychainCount(order);
    const giftingBagCount = getOrderGiftingBagCount(order);
    const characterCount = getOrderCharacterCount(order);
    const whatsappHref = getWhatsAppHref(order.customer_phone);
    const routeGroup = getDeliveryRouteGroup(
      order.delivery_address
    );
    const showRouteHeading =
      fulfilmentValue === "delivery" &&
      routeGroup.key !== previousRouteKey;

    if (showRouteHeading) {
      previousRouteKey = routeGroup.key;
    }

    return `
    ${showRouteHeading ? `
      <div class="delivery-route-heading">
        <div>
          <span aria-hidden="true">⌖</span>
          <div>
            <h3>${escapeAdminHtml(routeGroup.label)}</h3>
            <p>${escapeAdminHtml(routeGroup.note)}</p>
          </div>
        </div>
      </div>
    ` : ""}
    <details class="order-card ${due.className} ${order.archived_at ? "is-archived" : ""}" data-order-id="${escapeAdminHtml(orderId)}" data-status="${escapeAdminHtml(order.status || "")}">
      <summary class="order-summary">
        <div class="order-summary-customer">
          <label class="order-batch-select" onclick="event.stopPropagation()">
            <input
              type="checkbox"
              data-order-batch-select
              value="${escapeAdminHtml(orderId)}"
              ${selectedOrderIds.has(orderId) ? "checked" : ""}
              onchange='window.toggleOrderSelection(${JSON.stringify(orderId)}, this.checked)'
            >
            <span>Select for batch actions</span>
          </label>
          <p class="order-ref-label">${orderRef}</p>
          ${order.linked_children?.length ? `
            <span class="linked-order-badge">${order.linked_children.length} add-on${order.linked_children.length === 1 ? "" : "s"} combined under this ID</span>
          ` : ""}
          ${order.group_order_code ? `
            <span class="linked-order-badge">Group order · ${escapeAdminHtml(order.group_order_code)}</span>
          ` : ""}
          <h3>${customerName}</h3>
          <div class="order-summary-badges">
            <span class="order-status-badge">${escapeAdminHtml(order.status || "-")}</span>
            <span class="due-badge ${due.className}">${escapeAdminHtml(due.label)}</span>
            ${order.archived_at ? `<span class="archive-badge">Archived</span>` : ""}
          </div>
          ${renderProgressBar(order, true)}
        </div>

        <div class="order-summary-meta">
          ${fulfilmentValue === "delivery" ? `
            <label class="route-stop-select" onclick="event.stopPropagation()">
              <input type="checkbox" data-route-address="${escapeAdminHtml(order.delivery_address || "")}">
              Route stop
            </label>
          ` : ""}
          <strong>${formatMoney(order.total)}</strong>
          <span>${keychainCount} keychain${keychainCount === 1 ? "" : "s"}</span>
          ${giftingBagCount > 0 ? `<span>🎁 ${giftingBagCount} gifting bag${giftingBagCount === 1 ? "" : "s"}</span>` : ""}
          <span>${characterCount} character${characterCount === 1 ? "" : "s"} · ${getMethodLabel(order.collection_method)}</span>
          <span>Ordered ${formatDate(order.created_at)}</span>
        </div>
      </summary>

      ${renderOrderAlerts(order)}
      ${renderProductionNote(order)}
      ${renderAssemblyChecklist(order)}

      <div class="order-detail-grid">
        <p><strong>Customer Name</strong><br>${customerName}</p>
        <p><strong>Email</strong><br>${customerEmail}</p>
        <p><strong>Phone</strong><br>${customerPhone}</p>
        <p><strong>Order Reference</strong><br>${orderRef}</p>

        <p><strong>Collection Method</strong><br>${getMethodLabel(order.collection_method)}</p>
        ${order.collection_method !== "delivery" ? `
          <p>
            <strong>Pickup Appointment</strong><br>
            ${order.pickup_scheduled_date
              ? `${formatDate(order.pickup_scheduled_date)} · ${escapeAdminHtml(order.pickup_time_range || "Time not selected")}`
              : "Customer has not selected a timing yet"
            }
          </p>
        ` : ""}
        <p><strong>${order.order_type === "bulk" || order.order_type === "rush" ? "Preferred Completion" : "Estimated Ready By"}</strong><br>${formatDate(order.requested_completion_date || order.needed_by)}</p>
        <p><strong>Order Type</strong><br>${order.order_type === "rush" ? "⚡ Rush Request" : order.order_type === "bulk" ? "📦 Bulk Request" : "Standard Order"}</p>
        ${order.review_status ? `<p><strong>Review</strong><br>${escapeAdminHtml(order.review_status)}</p>` : ""}

        ${
          order.collection_method === "delivery"
            ? `
              <p class="full-row">
                <strong>Delivery Address</strong><br>
                ${escapeAdminHtml(order.delivery_address || "-")}
              </p>
            `
            : `
              <p class="full-row">
                <strong>Pickup Location</strong><br>
                ${escapeAdminHtml(getPickupLocation(order.collection_method))}
              </p>
            `
        }

        ${order.handoff_name ? `
          <div class="full-row handoff-section">
            <strong>Hand off to someone else</strong>
            <p>${escapeAdminHtml(order.handoff_name)}${order.handoff_relationship ? ` · ${escapeAdminHtml(order.handoff_relationship)}` : ""}</p>
            ${order.handoff_phone ? `<p>${escapeAdminHtml(order.handoff_phone)}</p>` : ""}
            ${order.handoff_notes ? `<p>${escapeAdminHtml(order.handoff_notes)}</p>` : ""}
          </div>
        ` : ""}

        <p class="full-row">
          <strong>Customer Notes / Preferred Timing</strong><br>
          ${escapeAdminHtml(order.notes || order.preferred_time || "-")}
        </p>

        ${Number(order.discount_amount || 0) > 0 ? `
          <p><strong>Original Subtotal</strong><br>${formatMoney(order.original_subtotal)}</p>
          <p><strong>Promo Code</strong><br>${escapeAdminHtml(order.promo_code || "-")}</p>
          <p><strong>Promo Discount</strong><br>−${formatMoney(order.discount_amount)}</p>
          <p><strong>Discounted Subtotal</strong><br>${formatMoney(order.subtotal)}</p>
        ` : `
          <p><strong>Subtotal</strong><br>${formatMoney(order.subtotal)}</p>
        `}
        <p><strong>Delivery Fee</strong><br>${formatMoney(order.delivery_fee)}</p>
        ${giftingBagCount > 0 ? `<p><strong>Gifting Bags</strong><br>${giftingBagCount} × S$0.50</p>` : ""}
        ${Number(order.rush_fee || 0) > 0 ? `<p><strong>Rush Fee</strong><br>${formatMoney(order.rush_fee)}</p>` : ""}
        <p><strong>Total</strong><br>${formatMoney(order.total)}</p>
        <p><strong>Order Source</strong><br>${escapeAdminHtml(order.order_source || "-")}</p>
        ${renderPaymentLedger(order)}
        ${["Pending Payment", "Payment Expired"].includes(order.status) ? `
          <p><strong>Payment Slot</strong><br>${escapeAdminHtml(formatPaymentHold(order))}</p>
        ` : ""}
      </div>

      ${renderEmailHistory(order)}

      <div class="order-quick-actions">
        ${["Rush Review", "Bulk Review"].includes(order.status) ? `
          <button type="button" class="approve-request-action" onclick='window.approveSpecialOrder(${JSON.stringify(orderId)})'>
            Approve Request
          </button>
        ` : ""}

        <button type="button" onclick='window.copyOrderReference(${JSON.stringify(orderId)})'>
          Copy Reference
        </button>

        ${order.linked_order_ref ? `
          <button type="button" class="linked-order-action" onclick='window.unlinkOrderAddOn(${JSON.stringify(orderId)}, this)'>
            Unlink Add-on
          </button>
        ` : canOrderAcceptAddOn(order.status) && !latestOrders.some(item =>
          String(item.linked_order_ref || "").toUpperCase() ===
          String(order.order_ref || "").toUpperCase()
        ) ? `
          <button type="button" class="linked-order-action" onclick='window.linkOrderAsAddOn(${JSON.stringify(orderId)}, this)'>
            Link as Add-on
          </button>
        ` : ""}

        ${order.customer_email ? `
          <a href="mailto:${encodeURIComponent(order.customer_email)}?subject=${encodeURIComponent(`Little Keeps order ${order.order_ref || ""}`)}">
            Email Customer
          </a>
        ` : ""}

        ${["Pending Payment", "Payment Expired"].includes(order.status) && order.customer_email ? `
          <button type="button" onclick='window.sendPaymentReminder(${JSON.stringify(orderId)}, this)'>
            Email Payment Reminder
          </button>
        ` : ""}

        ${order.stripe_payment_intent_id && Number(order.refunded_amount || 0) < Number(order.total || 0) ? `
          <button type="button" class="danger-action" onclick='window.refundOrder(${JSON.stringify(orderId)}, this)'>
            Refund
          </button>
        ` : ""}

        ${order.status === "Completed" && order.customer_email ? `
          <button type="button" onclick='window.sendReviewRequest(${JSON.stringify(orderId)}, this)'>
            ${order.review_request_sent_at ? "Resend Review Request" : "Send Review Request"}
          </button>
        ` : ""}

        ${order.customer_email && (order.payment_type === "Paid" || order.status === "Payment Verified") ? `
          <button type="button" class="approve-request-action" onclick='window.sendPaymentConfirmationEmail(${JSON.stringify(orderId)}, this)'>
            Send Confirmation + PDF
          </button>
        ` : ""}

        ${order.customer_email && (
          order.collection_method === "delivery"
            ? ["Out for Delivery", "Completed"].includes(order.status)
            : ["Pending Pickup", "Completed"].includes(order.status)
        ) ? `
          <button
            type="button"
            class="approve-request-action"
            onclick='window.resendCurrentStatusEmail(${JSON.stringify(orderId)}, this)'
          >
            Resend Status Email
          </button>
        ` : ""}

        ${whatsappHref ? `
          <a href="${whatsappHref}" target="_blank" rel="noopener">
            WhatsApp
          </a>
        ` : ""}

        ${whatsappHref &&
          order.collection_method !== "delivery" &&
          !["Completed", "Refunded", "Cancelled", "Rejected"].includes(order.status) ? `
          <button
            type="button"
            class="approve-request-action"
            onclick='window.offerEarlierPickupWhatsApp(${JSON.stringify(orderId)}, this)'
          >
            WhatsApp: Offer Earlier Pickup
          </button>
        ` : ""}

        ${whatsappHref &&
          order.collection_method !== "delivery" &&
          order.status === "Pending Pickup" ? `
          <button
            type="button"
            class="approve-request-action"
            onclick='window.copyPickupWhatsAppReminder(${JSON.stringify(orderId)}, this)'
          >
            Copy Pickup Reminder
          </button>
        ` : ""}

        <button type="button" onclick='window.downloadOrderPdf(${JSON.stringify(orderId)}, this)'>
          Download PDF
        </button>

        <button type="button" class="shipping-label-action" onclick='window.printBasketLabel(${JSON.stringify(orderId)})'>
          Print Basket Label
        </button>

        ${order.collection_method === "delivery" ? `
          <button type="button" class="hand-delivery-label-action" onclick='window.printHandDeliveryLabel(${JSON.stringify(orderId)})'>
            Print Hand-Delivery Label
          </button>
        ` : ""}

        ${!order.archived_at && !["Completed", "Refunded"].includes(order.status) ? `
          <button type="button" class="rework-action" onclick='window.startOrderRework(${JSON.stringify(orderId)})'>
            Send Keychain Back to Rework
          </button>
        ` : ""}

        <button type="button" class="rush-stl-action" onclick='window.generateOrderStls(${JSON.stringify(orderId)}, this)'>
          Generate Order STLs
        </button>

        ${order.archived_at ? `
          <button type="button" onclick='window.restoreOrder(${JSON.stringify(orderId)})'>Restore Order</button>
          <button type="button" class="danger-action" onclick='window.deleteTestOrder(${JSON.stringify(orderId)})'>Delete Permanently</button>
        ` : `
          <button type="button" class="archive-action" onclick='window.archiveOrder(${JSON.stringify(orderId)})'>Archive Order</button>
        `}
      </div>

      <div class="order-info">
  <div>
    <span>Status</span>
    <select
      class="status-select"
      ${FULFILMENT_STATUSES.includes(order.status) || order.status === "Completed" ? "disabled" : ""}
      onchange="window.updateOrderStatus('${order.id}', this.value)"
    >
      ${FULFILMENT_STATUSES.includes(order.status) ? `
        <option selected>${escapeAdminHtml(order.status)} · manage in Fulfilment</option>
      ` : ""}
      ${order.status === "Completed" ? `<option selected>Completed</option>` : ""}
      ${order.status === "Rush Review" ? `<option value="Rush Review" selected>Rush request - review</option>` : ""}
      ${order.status === "Bulk Review" ? `<option value="Bulk Review" selected>Bulk request - review</option>` : ""}
      ${order.status === "Payment Verification" ? `<option value="Payment Verification" selected>Manual payment - check</option>` : ""}
      <option value="Pending Payment" ${order.status === "Pending Payment" ? "selected" : ""}>Awaiting payment</option>
      <option value="Payment Expired" ${order.status === "Payment Expired" ? "selected" : ""}>Checkout expired - slot released</option>
      <option value="Payment Verified" ${order.status === "Payment Verified" ? "selected" : ""}>Paid - ready to print</option>
      <option value="Printing" ${order.status === "Printing" ? "selected" : ""}>Printing</option>
      <option value="Assembly Complete" ${order.status === "Assembly Complete" ? "selected" : ""}>Assembly complete - ready to notify</option>
      <option value="Refunded" ${order.status === "Refunded" ? "selected" : ""}>Refunded</option>
    </select>
  </div>

  <div>
    <span>Payment</span>
    <select
      class="status-select"
      onchange="window.updatePaymentType('${order.id}', this.value)"
    >
      <option value="Pending" ${order.payment_type === "Pending" ? "selected" : ""}>Awaiting payment</option>
      <option value="Paid" ${order.payment_type === "Paid" ? "selected" : ""}>Paid</option>
      <option value="Refunded" ${order.payment_type === "Refunded" ? "selected" : ""}>Refunded</option>
      <option value="Free" ${["Free", "Giveaway", "Replacement"].includes(order.payment_type) ? "selected" : ""}>No payment needed</option>
    </select>
  </div>
</div>
<div class="order-preview-list">
  ${(order.order_data || []).map(item => {
    const baseShape =
      item.design?.base_shape?.key ||
      item.design?.baseShape ||
      "ribbed";
    const letterOrientation = getLetterOrientation(item.design);

    return `
      <div class="order-preview-item">
        <div class="assembly-item-top">
          <strong>${escapeAdminHtml(item.name || "Personalised keychain")}</strong>

          ${item.group_contributor_name ? `
            <span class="assembly-tag group-contributor-tag">
              For ${escapeAdminHtml(item.group_contributor_name)}
            </span>
          ` : ""}

          <span class="assembly-tag">
            ${baseShape === "bubbly" ? "Bubbly Base" : "Ribbed Base"}
          </span>

          <span class="assembly-tag">
            ${letterOrientation === "horizontal" ? "Sideways Letters" : "Upright Letters"}
          </span>

          ${getItemGiftingBagQuantity(item) ? `<span class="assembly-tag">🎁 ${getItemGiftingBagQuantity(item)} Gifting Bag${getItemGiftingBagQuantity(item) === 1 ? "" : "s"}</span>` : ""}
        </div>

        <div class="mini-chain">
          ${createAssemblyMiniPreview(item.name, item.design)}
        </div>
      </div>
    `;
  }).join("")}
</div>
    </details>
  `;
  }).join("");
}

function renderFulfilmentWorkspace(orders) {
  const ready = groupLinkedOrdersForAdmin(orders).filter(order =>
    !order.archived_at &&
    FULFILMENT_STATUSES.includes(order.status)
  );
  const deliveries = ready
    .filter(order => order.collection_method === "delivery")
    .sort((a, b) => {
      const aRoute = getDeliveryRouteGroup(a.delivery_address);
      const bRoute = getDeliveryRouteGroup(b.delivery_address);
      return aRoute.sortValue - bRoute.sortValue ||
        Number(aRoute.postalCode || 999999) - Number(bRoute.postalCode || 999999);
    });
  const pickups = ready.filter(order => order.collection_method !== "delivery");

  const fulfilmentCard = order => `
    <details class="fulfilment-card">
      <summary class="fulfilment-card-summary">
        <span>
          <strong>${escapeAdminHtml(order.order_ref || "-")} · ${escapeAdminHtml(order.customer_name || "Customer")}</strong>
          <small>${getOrderKeychainCount(order)} keychain${getOrderKeychainCount(order) === 1 ? "" : "s"} · ${escapeAdminHtml(getMethodLabel(order.collection_method))}</small>
        </span>
        <span class="fulfilment-summary-status">
          ${order.linked_children?.length ? `<em>${order.linked_children.length + 1} linked parts</em>` : ""}
          <b class="order-status-badge">${escapeAdminHtml(order.status || "-")}</b>
          <i aria-hidden="true">⌄</i>
        </span>
      </summary>
      <div class="fulfilment-card-body">
      <div class="fulfilment-card-info">
        <label class="route-stop-select">
          <input type="checkbox" data-label-order-id="${escapeAdminHtml(String(order.id))}">
          <span>Select for label printing</span>
        </label>
        ${order.collection_method === "delivery" ? `
          <p>${escapeAdminHtml(order.delivery_address || "Address missing")}</p>
          <label class="route-stop-select">
            <input type="checkbox" data-route-address="${escapeAdminHtml(order.delivery_address || "")}">
            <span>Include as route stop</span>
          </label>
        ` : `
          <p><strong>${escapeAdminHtml(getPickupLocation(order.collection_method))}</strong><br>
          ${order.pickup_scheduled_date
            ? `${formatDate(order.pickup_scheduled_date)} at ${escapeAdminHtml(order.pickup_time_range || "time not selected")}`
            : "Pickup appointment not selected"}</p>
        `}
        ${order.linked_children?.length ? `
          <div class="linked-fulfilment-family">
            <strong>One linked order · update once</strong>
            <span>${[order, ...order.linked_children].map(part => `${escapeAdminHtml(part.order_ref || "Part")} (${getOrderKeychainCount(part)} keychain${getOrderKeychainCount(part) === 1 ? "" : "s"})`).join(" · ")}</span>
          </div>
        ` : ""}
        ${renderOrderAlerts(order, true)}
        ${renderProductionNote(order, true)}
        ${renderAssemblyChecklist(order, true)}
      </div>
      <div class="fulfilment-card-actions">
        <button type="button" class="shipping-label-action" onclick='window.printBasketLabel(${JSON.stringify(String(order.id))})'>
          Print Basket Label
        </button>
        ${order.collection_method === "delivery" ? `
          <button type="button" class="hand-delivery-label-action" onclick='window.printHandDeliveryLabel(${JSON.stringify(String(order.id))})'>
            Print Hand-Delivery Label
          </button>
        ` : ""}
        ${order.status === "Assembly Complete" ? `
          <button type="button" class="ready-btn" onclick='window.markReady(${JSON.stringify(String(order.id))})'>
            ${order.collection_method === "delivery"
              ? "Set Pending Delivery"
              : "Set Pending Pickup"}
          </button>
        ` : ""}
        ${order.status === "Pending Delivery" ? `
          <button type="button" class="ready-btn" onclick='window.startDelivery(${JSON.stringify(String(order.id))})'>Start Delivery</button>
        ` : ""}
        ${order.status === "Pending Pickup" ? `
          <button type="button" class="ready-btn" onclick='window.completeFulfilment(${JSON.stringify(String(order.id))})'>Complete Pickup</button>
        ` : ""}
        ${order.collection_method !== "delivery" && getWhatsAppHref(order.customer_phone) ? `
          <button type="button" class="approve-request-action" onclick='window.offerEarlierPickupWhatsApp(${JSON.stringify(String(order.id))}, this)'>
            WhatsApp: Offer Earlier Pickup
          </button>
        ` : ""}
        ${order.status === "Out for Delivery" ? `
          <button type="button" class="approve-request-action" onclick='window.copyHandDeliveredWhatsApp(${JSON.stringify(String(order.id))}, this)'>WhatsApp: Delivered</button>
          <button type="button" class="ready-btn" onclick='window.completeFulfilment(${JSON.stringify(String(order.id))})'>Complete Delivery</button>
        ` : ""}
        ${order.customer_email && (
          order.collection_method === "delivery"
            ? ["Out for Delivery", "Completed"].includes(order.status)
            : ["Pending Pickup", "Completed"].includes(order.status)
        ) ? `
          <button type="button" class="approve-request-action" onclick='window.resendCurrentStatusEmail(${JSON.stringify(String(order.id))}, this)'>
            Resend Customer Email
          </button>
        ` : ""}
        <button type="button" class="rework-action" onclick='window.startOrderRework(${JSON.stringify(String(order.id))})'>
          Send back to rework
        </button>
        <button type="button" onclick='window.focusOrder(${JSON.stringify(String(order.id))})'>Open order</button>
      </div>
      </div>
    </details>
  `;

  let previousRoute = "";
  const deliveryHtml = deliveries.map(order => {
    const route = getDeliveryRouteGroup(order.delivery_address);
    const heading = route.key !== previousRoute
      ? `<div class="delivery-route-heading"><div><span>⌖</span><div><h3>${escapeAdminHtml(route.label)}</h3><p>${escapeAdminHtml(route.note)}</p></div></div></div>`
      : "";
    previousRoute = route.key;
    return heading + fulfilmentCard(order);
  }).join("");

  ordersContainer.innerHTML = `
    <div class="fulfilment-heading">
      <div>
        <h2>Pack → hand off → complete</h2>
        <p>Delivery customers are emailed only when the order goes out for delivery and when it is delivered. Pending Delivery stays internal.</p>
      </div>
      <span>${pickups.length} pickup · ${deliveries.length} delivery</span>
    </div>
    <details class="fulfilment-tools">
      <summary><span><strong>Labels & delivery tools</strong><small>Batch printing and route planning</small></span><i>⌄</i></summary>
      <div class="route-assistance-bar">
        <div>
          <strong>Prepare handoffs in one go</strong>
          <span>Select orders inside the cards, then print labels or open the selected delivery route.</span>
        </div>
        <div class="route-assistance-actions">
        <button type="button" class="shipping-label-action" onclick="window.printSelectedBasketLabels()">Print Selected Basket Labels</button>
        <button type="button" class="shipping-label-secondary" onclick="window.printAllBasketLabels()">Print All ${ready.length || ""} Basket Labels</button>
        <button type="button" class="hand-delivery-label-action" onclick="window.printSelectedHandDeliveryLabels()">Print Selected Hand-Delivery Labels</button>
        <button type="button" class="hand-delivery-label-secondary" onclick="window.printAllHandDeliveryLabels()">Print All ${deliveries.length || ""} Hand-Delivery Labels</button>
        <button type="button" onclick="window.openSelectedDeliveryRoute()">Open Selected Route</button>
        </div>
      </div>
    </details>
    <details class="fulfilment-section" ${deliveries.length ? "open" : ""}>
      <summary><span><strong>Deliveries</strong><small>Ready, pending and out for delivery</small></span><b>${deliveries.length}</b><i>⌄</i></summary>
      <div class="fulfilment-section-body">
      ${deliveryHtml || `<p class="today-empty">No deliveries are ready.</p>`}
      </div>
    </details>
    <details class="fulfilment-section" ${pickups.length ? "open" : ""}>
      <summary><span><strong>Pickups</strong><small>Ready for collection and appointments</small></span><b>${pickups.length}</b><i>⌄</i></summary>
      <div class="fulfilment-section-body">
      ${pickups.map(fulfilmentCard).join("") || `<p class="today-empty">No pickups are ready.</p>`}
      </div>
    </details>
  `;
}

function getBaseInventoryName(baseName, baseShape = "ribbed") {
  const shapeLabel =
    baseShape === "bubbly" ? "Bubbly" : "Ribbed";

  return `${baseName} ${shapeLabel} Base`;
}

function getKeycapInventoryName(
  capName,
  letterName,
  character
) {
  return `${capName} Cap + ${letterName} Letter - ${character}`;
}

async function loadInventoryItems() {
  if (IS_ADMIN_PREVIEW) {
    inventoryItems = {
      "Mechanical Switch": {
        id: 1,
        qty: 128,
        category: "Hardware"
      },
      "Metal Large D Ring": {
        id: 2,
        qty: 42,
        category: "Hardware"
      },
      "Gifting Bag": {
        id: 6,
        qty: 20,
        category: "Packaging"
      },
      "NTAG215 NFC Wet Label (25 mm)": {
        id: 7,
        qty: 50,
        category: "Hardware"
      },
      "White Thickened Courier Bag (28 × 40 cm)": {
        id: 8,
        qty: 100,
        category: "Packaging"
      },
      "White Thickened Courier Bag (17 × 30 cm)": {
        id: 9,
        qty: 100,
        category: "Packaging"
      },
      "Pink Bubble Packing Bag (25 × 30 + 5 cm)": {
        id: 10,
        qty: 48,
        category: "Packaging"
      },
      "Self-Adhesive Transparent Bag (15 × 21 cm)": {
        id: 11,
        qty: 500,
        category: "Packaging"
      },
      "Jade White Ribbed Base": {
        id: 4,
        qty: 9,
        category: "Base"
      },
      "Pink Cap + Jade White Letter - A": {
        id: 5,
        qty: 6,
        category: "Keycap"
      }
    };
    return;
  }

  const { data, error } = await supabase
    .from("inventory_items")
    .select("*");

  if (error) {
    console.error(error);
    alert("Unable to load inventory.");
    return;
  }

  inventoryItems = {};

  (data || []).forEach(item => {
    inventoryItems[item.item_name] = {
      id: item.id,
      qty: Number(item.qty || 0),
      category: item.category || "Hardware"
    };
  });
}

async function loadClearanceInventory() {
  if (IS_ADMIN_PREVIEW) {
    clearanceInventoryItems = {
      "Pink Cap + Jade White Letter - S": {
        id: 1,
        qty: 4,
        latestOrderRef: "Preview",
        reason: "Small cosmetic mark"
      }
    };
    return;
  }

  const { data, error } = await supabase
    .from("clearance_inventory")
    .select("*")
    .order("item_name", { ascending: true });

  if (error) {
    console.error("Unable to load clearance inventory:", error);
    clearanceInventoryItems = {};
    return;
  }

  clearanceInventoryItems = {};

  (data || []).forEach(item => {
    clearanceInventoryItems[item.item_name] = {
      id: item.id,
      qty: Number(item.qty || 0),
      latestOrderRef: item.latest_order_ref || "",
      reason: item.reason || "Failed quality check"
    };
  });
}

async function loadProductionJobs() {
  if (IS_ADMIN_PREVIEW) {
    productionJobsLoadFailed = false;
    productionJobs = [
      {
        id: 1,
        item_name: "Jade White Ribbed Base",
        category: "Base",
        quantity: 4,
        stage: "printing",
        printer_id: "a1-mini-2",
        quality_status: "reprint_needed",
        issue_notes: "Layer shift and rough surface",
        started_at: new Date().toISOString()
      },
      {
        id: 2,
        item_name: "Pink Cap + Jade White Letter - A",
        category: "Keycap",
        quantity: 3,
        stage: "picked",
        started_at: new Date(Date.now() - 3600000).toISOString(),
        picked_at: new Date().toISOString()
      }
    ];
    return;
  }

  const { data, error } = await supabase
    .from("production_jobs")
    .select("*")
    .order("started_at", { ascending: true });

  productionJobsLoadFailed = Boolean(error);

  if (error) {
    console.warn("Unable to load production workflow:", error);
    productionJobs = [];
    return;
  }

  productionJobs = data || [];
}

window.removeClearanceInventory = async function(itemName, qtyToRemove = 1) {
  const item = clearanceInventoryItems[itemName];

  if (!item?.qty) return;

  const validation = validateInventoryDecrement(item.qty, qtyToRemove);

  if (!validation.valid) {
    alert(validation.message);
    return;
  }

  const qty = Number(qtyToRemove);
  if (!confirm(`Remove ${qty} ${itemName} from clearance stock?`)) return;

  const { error } = await supabase.rpc(
    "adjust_clearance_inventory",
    {
      p_item_name: itemName,
      p_change: -qty
    }
  );

  if (error) {
    console.error("Unable to update clearance inventory:", error);
    alert(
      "Unable to update clearance stock.\n\n" +
      "Run the supplied clearance SQL once, then try again."
    );
    return;
  }

  if (currentView === "inventory") {
    await renderInventoryWorkspace();
  } else {
    await renderProductionPlanner(latestOrders);
  }
};

window.removeOneClearanceItem = itemName =>
  window.removeClearanceInventory(itemName, 1);

function getInventoryQty(itemName) {
  return inventoryItems[itemName]?.qty || 0;
}

async function addInventory(
  itemName,
  qtyToAdd,
  category,
  shouldRender = true
) {
  const qty = Number(qtyToAdd);

  if (!Number.isInteger(qty) || qty <= 0) {
    alert("Please enter a valid quantity.");
    return false;
  }

  await loadInventoryItems();

  const existingItem = inventoryItems[itemName];

  if (existingItem) {
    const newQty = existingItem.qty + qty;

    const { error } = await supabase
      .from("inventory_items")
      .update({
        qty: newQty,
        category,
        updated_at: new Date().toISOString()
      })
      .eq("id", existingItem.id);

    if (error) {
      console.error(error);
      alert(`Unable to update ${itemName}.`);
      return false;
    }
  } else {
    const { error } = await supabase
      .from("inventory_items")
      .insert({
        item_name: itemName,
        qty,
        category,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error(error);
      alert(`Unable to create ${itemName}.`);
      return false;
    }
  }

  if (shouldRender) {
    if (currentView === "inventory") {
      await renderInventoryWorkspace();
    } else {
      await renderProductionPlanner(latestOrders);
    }
  }

  return true;
}

window.removeInventory = async function(itemName, qtyToRemove = 1) {
  await loadInventoryItems();

  const item = inventoryItems[itemName];
  if (!item || item.qty <= 0) return;

  const validation = validateInventoryDecrement(item.qty, qtyToRemove);

  if (!validation.valid) {
    alert(validation.message);
    return;
  }

  const qty = Number(qtyToRemove);
  if (!confirm(`Subtract ${qty} ${itemName} from normal stock?`)) return;

  const { data, error } = await supabase
    .from("inventory_items")
    .update({
      qty: validation.newQty,
      updated_at: new Date().toISOString()
    })
    .eq("id", item.id)
    .gte("qty", qty)
    .select("id, qty")
    .maybeSingle();

  if (error || !data) {
    console.error("Unable to reduce inventory:", error);
    alert(
      data
        ? `Unable to update ${itemName}.`
        : `${itemName} changed before this update. Refresh and try again.`
    );
    return;
  }

  await renderInventoryWorkspace();
};

window.removeOneInventoryItem = itemName =>
  window.removeInventory(itemName, 1);

async function addCustomInventory(itemName, qtyToAdd, category) {
  const qty = Number(qtyToAdd);

  if (!Number.isInteger(qty) || qty <= 0) {
    alert("Please enter a valid quantity.");
    return;
  }

  await addInventory(itemName, qty, category);
}

window.addCustomInventory = addCustomInventory;

window.addInventory = addInventory;

window.setProductionStageView = async function(stage) {
  if (!["queue", "printing", "picked"].includes(stage)) return;
  productionStageView = stage;
  await renderProductionPlanner(latestOrders);
};

window.setProductionQueueView = async function(view) {
  if (!["batch", "timeline", "bases", "keycaps"].includes(view)) return;
  productionQueueView = view;
  await renderProductionPlanner(latestOrders);
};

window.startProductionJob = async function(
  itemName,
  qtyToPrint,
  category
) {
  const quantity = Number(qtyToPrint);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    alert("Please enter a whole number greater than zero.");
    return;
  }

  if (productionJobsLoadFailed) {
    alert(
      "Set up the production workflow in Supabase before tracking prints."
    );
    return;
  }

  const { error } = await supabase
    .from("production_jobs")
    .insert({
      item_name: itemName,
      category,
      quantity,
      stage: "printing",
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error("Unable to start production job:", error);
    alert("Unable to move this item to Printing.");
    return;
  }

  await renderProductionPlanner(latestOrders);
};

window.startSelectedBaseBatch = async function(button) {
  const jobs = currentBaseBatchPlan
    .filter(item => Number.isInteger(item.quantity) && item.quantity > 0)
    .map(item => ({
      item_name: item.itemName,
      category: "Base",
      quantity: item.quantity,
      stage: "printing",
      updated_at: new Date().toISOString()
    }));

  if (!jobs.length) {
    alert("No bases are left to print for this selected batch.");
    return;
  }

  const total = jobs.reduce((sum, job) => sum + job.quantity, 0);
  if (!confirm(
    `Start the combined base batch?\n\n` +
    `${total} bases across ${jobs.length} colour/shape print group${jobs.length === 1 ? "" : "s"}.`
  )) return;

  const previousLabel = button?.textContent || "Start All Base Groups";
  if (button) {
    button.disabled = true;
    button.textContent = "Starting base batch…";
  }

  if (IS_ADMIN_PREVIEW) {
    const timestamp = new Date().toISOString();
    jobs.forEach((job, index) => {
      productionJobs.push({
        id: `preview-base-batch-${timestamp}-${index}`,
        ...job,
        started_at: timestamp
      });
    });
    await renderProductionPlanner(latestOrders);
    return;
  }

  const { error } = await supabase
    .from("production_jobs")
    .insert(jobs);

  if (error) {
    console.error("Unable to start the base batch:", error);
    alert("Unable to move the combined base batch to Printing.");
    if (button) {
      button.disabled = false;
      button.textContent = previousLabel;
    }
    return;
  }

  await renderProductionPlanner(latestOrders);
};

window.startBaseColourBatch = async function(jobId, button) {
  const group = productionBaseStlJobs.get(jobId);
  if (!group?.components?.length) return;

  const jobs = group.components.map(component => ({
    item_name: component.itemName,
    category: "Base",
    quantity: Math.max(0, Math.floor(Number(
      document.getElementById(component.inputId)?.value || component.toPrint
    ))),
    stage: "printing",
    updated_at: new Date().toISOString()
  })).filter(job => job.quantity > 0);

  if (!jobs.length) {
    alert("Set at least one base before starting this colour batch.");
    return;
  }

  const total = jobs.reduce((sum, job) => sum + job.quantity, 0);
  if (!confirm(
    `Start ${group.baseName} as one plate?\n\n` +
    `${total} bases across ${jobs.length} design${jobs.length === 1 ? "" : "s"}.`
  )) return;

  if (button) {
    button.disabled = true;
    button.textContent = "Starting colour batch…";
  }

  if (IS_ADMIN_PREVIEW) {
    const timestamp = new Date().toISOString();
    productionJobs.push(...jobs.map((job, index) => ({
      id: `preview-base-colour-${timestamp}-${index}`,
      ...job,
      started_at: timestamp
    })));
    await renderProductionPlanner(latestOrders);
    return;
  }

  const { error } = await supabase.from("production_jobs").insert(jobs);
  if (error) {
    console.error("Unable to start base colour batch:", error);
    alert("Unable to move this colour batch to Printing.");
    if (button) {
      button.disabled = false;
      button.textContent = "Start Colour Batch";
    }
    return;
  }

  await renderProductionPlanner(latestOrders);
};

window.downloadSelectedBaseBatchStls = async function(button) {
  const groups = currentBaseColourPlan.filter(group =>
    group.rows.some(item => item.toPrint > 0)
  );
  if (!groups.length) {
    alert("No base STL files are needed for this batch.");
    return;
  }

  if (!confirm(
    `Download ${groups.length} combined base STL file${groups.length === 1 ? "" : "s"}?\n\n` +
    "Each colour becomes one plate file containing both Ribbed and Bubbly designs where needed."
  )) return;

  const previousLabel = button?.textContent || "Download All Base STLs";
  if (button) {
    button.disabled = true;
    button.textContent = "Building base files…";
  }

  try {
    for (const group of groups) {
      await generateBaseColourStl(group.stlJobId);
    }
    if (button) button.textContent = `Downloaded ${groups.length} files ✓`;
  } finally {
    if (button) {
      setTimeout(() => {
        button.disabled = false;
        button.textContent = previousLabel;
      }, 2200);
    }
  }
};

window.updateProductionJobStage = async function(jobId, stage) {
  if (!["printing", "picked"].includes(stage)) return;

  const updates = {
    stage,
    picked_at: stage === "picked" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("production_jobs")
    .update(updates)
    .eq("id", jobId);

  if (error) {
    console.error("Unable to update production job:", error);
    alert("Unable to update this print stage.");
    return;
  }

  await renderProductionPlanner(latestOrders);
};

window.syncProductionJobSelection = function() {
  const checkboxes = Array.from(
    document.querySelectorAll("[data-production-job-select]")
  );
  const selectedCount = checkboxes.filter(
    checkbox => checkbox.checked
  ).length;
  const selectAll = document.getElementById(
    "selectAllProductionJobs"
  );
  const actionButton = document.getElementById(
    "productionBulkAction"
  );

  if (selectAll) {
    selectAll.checked =
      checkboxes.length > 0 &&
      selectedCount === checkboxes.length;
    selectAll.indeterminate =
      selectedCount > 0 &&
      selectedCount < checkboxes.length;
  }

  if (actionButton) {
    const actionStage = actionButton.dataset.stage;
    actionButton.disabled = selectedCount === 0;
    actionButton.textContent = actionStage === "picked"
      ? selectedCount
        ? `Add ${selectedCount} Selected to Inventory`
        : "Add Selected to Inventory"
      : selectedCount
        ? `Mark ${selectedCount} Selected as Picked`
        : "Mark Selected as Picked";
  }
};

window.toggleAllProductionJobs = function(checked) {
  document
    .querySelectorAll("[data-production-job-select]")
    .forEach(checkbox => {
      checkbox.checked = checked;
    });

  window.syncProductionJobSelection();
};

window.markSelectedProductionJobsPicked = async function(button) {
  const selectedIds = Array.from(
    document.querySelectorAll(
      "[data-production-job-select]:checked"
    )
  ).map(checkbox => checkbox.value);

  if (!selectedIds.length) return;

  const selectedJobs = productionJobs.filter(job =>
    selectedIds.includes(String(job.id))
  );

  if (!selectedJobs.length) return;

  const previousLabel =
    button?.textContent || "Mark Selected as Picked";

  if (button) {
    button.disabled = true;
    button.textContent = "Updating…";
  }

  const timestamp = new Date().toISOString();
  const { error } = await supabase
    .from("production_jobs")
    .update({
      stage: "picked",
      picked_at: timestamp,
      updated_at: timestamp
    })
    .in("id", selectedJobs.map(job => job.id));

  if (error) {
    console.error("Unable to update selected print jobs:", error);
    alert("Unable to mark the selected prints as picked.");

    if (button) {
      button.disabled = false;
      button.textContent = previousLabel;
    }
    return;
  }

  await renderProductionPlanner(latestOrders);
};

window.addSelectedProductionJobsToInventory = async function(button) {
  const selectedIds = Array.from(
    document.querySelectorAll(
      "[data-production-job-select]:checked"
    )
  ).map(checkbox => checkbox.value);

  if (!selectedIds.length) return;

  const selectedJobs = productionJobs.filter(job =>
    job.stage === "picked" &&
    selectedIds.includes(String(job.id))
  );

  if (!selectedJobs.length) return;

  const previousLabel =
    button?.textContent || "Add Selected to Inventory";

  if (button) {
    button.disabled = true;
    button.textContent = "Adding to Inventory…";
  }

  const { error } = await supabase.rpc(
    "complete_production_jobs",
    { p_job_ids: selectedJobs.map(job => job.id) }
  );

  if (error) {
    console.error(
      "Unable to add selected prints to inventory:",
      error
    );
    alert(
      "Unable to add the selected prints to inventory.\n\n" +
      "Run the latest supabase/production-workflow.sql, then try again."
    );

    if (button) {
      button.disabled = false;
      button.textContent = previousLabel;
    }
    return;
  }

  await Promise.all([
    loadInventoryItems(),
    loadProductionJobs(),
    loadPrinters()
  ]);
  await renderProductionPlanner(latestOrders);
};

window.markProductionPlatePicked = async function(jobIds, button) {
  const ids = (jobIds || []).map(String);
  if (!ids.length) return;
  const previousLabel = button?.textContent || "Mark Whole Plate Picked";
  if (button) {
    button.disabled = true;
    button.textContent = "Moving plate…";
  }

  if (IS_ADMIN_PREVIEW) {
    const pickedAt = new Date().toISOString();
    productionJobs.forEach(job => {
      if (ids.includes(String(job.id))) {
        job.stage = "picked";
        job.picked_at = pickedAt;
        job.updated_at = pickedAt;
      }
    });
  } else {
    const { error } = await supabase
      .from("production_jobs")
      .update({
        stage: "picked",
        picked_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .in("id", ids);
    if (error) {
      alert("Unable to mark this plate as picked.");
      if (button) {
        button.disabled = false;
        button.textContent = previousLabel;
      }
      return;
    }
    await loadProductionJobs();
  }
  await renderProductionPlanner(latestOrders);
};

window.completeProductionPlate = async function(jobIds, button) {
  const ids = (jobIds || []).map(Number).filter(Number.isFinite);
  if (!ids.length) return;
  const previousLabel = button?.textContent || "Add Whole Plate to Inventory";
  if (button) {
    button.disabled = true;
    button.textContent = "Adding plate…";
  }

  if (IS_ADMIN_PREVIEW) {
    productionJobs = productionJobs.filter(job => !ids.includes(Number(job.id)));
  } else {
    const { error } = await supabase.rpc("complete_production_jobs", {
      p_job_ids: ids
    });
    if (error) {
      alert("Unable to add this whole plate to inventory.");
      if (button) {
        button.disabled = false;
        button.textContent = previousLabel;
      }
      return;
    }
    await Promise.all([loadInventoryItems(), loadProductionJobs()]);
  }
  await renderProductionPlanner(latestOrders);
};

window.cancelProductionJob = async function(jobId) {
  const job = productionJobs.find(
    item => String(item.id) === String(jobId)
  );
  if (!job) return;

  if (!confirm(
    `Move ${job.quantity} × ${job.item_name} back to To Print?`
  )) return;

  const { error } = await supabase
    .from("production_jobs")
    .delete()
    .eq("id", jobId);

  if (error) {
    console.error("Unable to cancel production job:", error);
    alert("Unable to return this item to the print queue.");
    return;
  }

  productionStageView = "queue";
  await renderProductionPlanner(latestOrders);
};

window.completeProductionJob = async function(jobId) {
  const job = productionJobs.find(
    item => String(item.id) === String(jobId)
  );
  if (!job || job.stage !== "picked") return;

  const { error } = await supabase.rpc(
    "complete_production_job",
    { p_job_id: jobId }
  );

  if (error) {
    console.error("Unable to add completed print to inventory:", error);
    alert(
      "Unable to add this print to inventory.\n\n" +
      "Run supabase/production-workflow.sql once, then try again."
    );
    return;
  }

  await Promise.all([
    loadInventoryItems(),
    loadProductionJobs()
  ]);
  await renderProductionPlanner(latestOrders);
};

function getProductionSummary(orders, includeSelectedStatuses = false) {
  const baseTotals = {};
  const keycapGroups = {};

  const activeOrders = orders.filter(order =>
    !order.archived_at &&
    (
      includeSelectedStatuses
        ? !["Completed", "Refunded", "Payment Expired"].includes(order.status)
        : ["Payment Verified", "Printing"].includes(order.status)
    )
  );

  activeOrders.forEach(order => {
    const items = (order.order_data || []).filter(
      item => !item.assembly_completed
    );

    items.forEach((item, itemIndex) => {
      const cleanName = item.clean_name || item.name || "";
      const letters = Array.from(cleanName);
      const design = item.design;

      if (!design) return;

      letters.forEach((letter, index) => {
        const base = design.bases[index % design.bases.length];
        const cap = design.caps[index % design.caps.length];
        const letterColour = design.letters[index % design.letters.length];

        const baseName = base.name || base.hex || base;
        const baseHex = base.hex || base;

        const capName = cap.name || cap.hex || cap;
        const capHex = cap.hex || cap;

        const letterName = letterColour.name || letterColour.hex || letterColour;
        const letterHex = letterColour.hex || letterColour;

        const baseShape =
          design.base_shape?.key ||
          design.baseShape ||
          "ribbed";

        const baseKey = `${baseShape}|${baseName}`;

        if (!baseTotals[baseKey]) {
          baseTotals[baseKey] = {
            name: baseName,
            hex: baseHex,
            baseShape,
            qty: 0
          };
        }

        baseTotals[baseKey].qty += 1;

        const groupKey =
          `${capName} Cap + ${letterName} Letter`;

        if (!keycapGroups[groupKey]) {
          keycapGroups[groupKey] = {
            capName,
            capHex,
            letterName,
            letterHex,
            letters: {},
            owners: {}
          };
        }

        keycapGroups[groupKey].letters[letter] =
          (keycapGroups[groupKey].letters[letter] || 0) + 1;
        const ownerKey = `${String(order.id)}:${itemIndex}`;
        if (!keycapGroups[groupKey].owners[ownerKey]) {
          keycapGroups[groupKey].owners[ownerKey] = {
            orderId: String(order.id || ""),
            orderRef: order.order_ref || "No reference",
            customerName:
              item.group_contributor_name || order.customer_name || "Customer",
            keychainName: item.name || item.clean_name || "Personalised keychain",
            characters: []
          };
        }
        keycapGroups[groupKey].owners[ownerKey].characters.push({
          character: letter
        });
      });
    });
  });

  Object.values(keycapGroups).forEach(group => {
    group.owners = Object.values(group.owners || {});
  });

  return { baseTotals, keycapGroups, count: activeOrders.length };
}

function getOrderPrintableInventoryNeeds(order) {
  const needs = {};

  const addNeed = (itemName, quantity = 1) => {
    needs[itemName] = (needs[itemName] || 0) + quantity;
  };

  (order.order_data || [])
    .filter(item => !item.assembly_completed)
    .forEach(item => {
      const characters = Array.from(
        item.clean_name || sanitizeName(item.name || "")
      );
      const design = item.design || {};
      const bases = Array.isArray(design.bases) ? design.bases : [];
      const caps = Array.isArray(design.caps) ? design.caps : [];
      const letters = Array.isArray(design.letters) ? design.letters : [];

      if (!bases.length || !caps.length || !letters.length) return;

      const baseShape =
        design.base_shape?.key ||
        design.baseShape ||
        "ribbed";

      characters.forEach((character, index) => {
        const base = bases[index % bases.length];
        const cap = caps[index % caps.length];
        const letter = letters[index % letters.length];
        const baseName = base?.name || base?.hex || base;
        const capName = cap?.name || cap?.hex || cap;
        const letterName = letter?.name || letter?.hex || letter;

        addNeed(getBaseInventoryName(baseName, baseShape));
        addNeed(
          getKeycapInventoryName(
            capName,
            letterName,
            character
          )
        );
      });
    });

  return needs;
}

function getProductionTimelineOrders(orders, includeSelectedStatuses = false) {
  const remainingStock = Object.fromEntries(
    Object.entries(inventoryItems).map(([itemName, item]) => [
      itemName,
      Math.max(0, Number(item.qty || 0))
    ])
  );

  return orders
    .filter(order =>
      !order.archived_at &&
      (
        includeSelectedStatuses
          ? !["Completed", "Refunded", "Payment Expired"].includes(order.status)
          : ["Payment Verified", "Printing"].includes(order.status)
      )
    )
    .sort((a, b) => {
      const aDate = String(
        a.requested_completion_date || a.needed_by || "9999-12-31"
      ).slice(0, 10);
      const bDate = String(
        b.requested_completion_date || b.needed_by || "9999-12-31"
      ).slice(0, 10);
      return aDate.localeCompare(bDate);
    })
    .map(order => {
      const dueDate =
        order.requested_completion_date ||
        order.needed_by;
      const daysUntil = getDaysUntil(dueDate);
      const missingParts = [];
      const needs = getOrderPrintableInventoryNeeds(order);
      const totalParts = Object.values(needs).reduce(
        (sum, quantity) => sum + quantity,
        0
      );

      Object.entries(needs).forEach(([itemName, quantity]) => {
        const available = remainingStock[itemName] || 0;
        const reserved = Math.min(available, quantity);
        const missing = quantity - reserved;

        remainingStock[itemName] = available - reserved;

        if (missing > 0) {
          missingParts.push({
            itemName,
            quantity: missing,
            type: itemName.includes(" Cap + ") ? "keycap" : "base"
          });
        }
      });

      return {
        order,
        dueDate,
        daysUntil,
        missingParts,
        totalParts,
        totalMissing: missingParts.reduce(
          (sum, part) => sum + part.quantity,
          0
        )
      };
    });
}

function getUrgentPrintLabel(daysUntil) {
  if (daysUntil < 0) {
    const overdueDays = Math.abs(daysUntil);
    return `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`;
  }
  if (daysUntil === 0) return "Due today";
  if (daysUntil === 1) return "Due tomorrow";
  return `Due in ${daysUntil} days`;
}

function getOrderInventoryNeeds(order) {
  const needs = {};

  function add(itemName, qty) {
    needs[itemName] = (needs[itemName] || 0) + qty;
  }

  (order.order_data || []).forEach(item => {
    const letters = Array.from(item.clean_name || item.name || "");
    const design = item.design;

    if (!design) return;

    letters.forEach((letter, index) => {
      const base = design.bases[index % design.bases.length];
      const cap = design.caps[index % design.caps.length];
      const letterColour = design.letters[index % design.letters.length];

      const baseName = base.name || base.hex || base;
      const capName = cap.name || cap.hex || cap;
      const letterName = letterColour.name || letterColour.hex || letterColour;

      const baseShape =

        design.base_shape?.key ||

        design.baseShape ||

        "ribbed";

      if (!item.base_assembled) {
        add(
          getBaseInventoryName(baseName, baseShape),
          1
        );
      }

      add(

        getKeycapInventoryName(

          capName,

          letterName,

          letter

        ),

        1

      );
    });

    if (!item.base_assembled) {
      add("Mechanical Switch", letters.length);
      add("Metal Large D Ring", 1);
    }
  });
  add(
    "Gifting Bag",
    getOrderGiftingBagCount(order)
  );

  return needs;
}

function getKeychainBaseAssemblyNeeds(item) {
  if (item?.base_assembled) return {};
  const needs = getKeychainPrintablePartNeeds(item, "base");
  const characterCount = Array.from(item?.clean_name || item?.name || "").length;
  if (characterCount > 0) needs["Mechanical Switch"] = characterCount;
  needs["Metal Large D Ring"] = 1;
  return needs;
}

function getKeychainPrintablePartNeeds(
  item,
  partType = "all",
  characterIndex = null
) {
  const needs = {};
  const characters = Array.from(item.clean_name || item.name || "");
  const design = item.design || {};
  const bases = Array.isArray(design.bases) ? design.bases : [];
  const caps = Array.isArray(design.caps) ? design.caps : [];
  const letters = Array.isArray(design.letters) ? design.letters : [];

  if (!characters.length || !bases.length || !caps.length || !letters.length) {
    return needs;
  }

  const indexes = Number.isInteger(characterIndex)
    ? [characterIndex]
    : characters.map((_, index) => index);

  const add = itemName => {
    needs[itemName] = (needs[itemName] || 0) + 1;
  };

  indexes.forEach(index => {
    if (index < 0 || index >= characters.length) return;

    const base = bases[index % bases.length];
    const cap = caps[index % caps.length];
    const letterColour = letters[index % letters.length];
    const baseName = base?.name || base?.hex || base;
    const capName = cap?.name || cap?.hex || cap;
    const letterName =
      letterColour?.name || letterColour?.hex || letterColour;
    const baseShape =
      design.base_shape?.key ||
      design.baseShape ||
      "ribbed";

    if (partType === "base" || partType === "all") {
      add(getBaseInventoryName(baseName, baseShape));
    }

    if (partType === "keycap" || partType === "all") {
      add(
        getKeycapInventoryName(
          capName,
          letterName,
          characters[index]
        )
      );
    }
  });

  return needs;
}

function getOrderRemainingInventoryNeeds(order) {
  return getOrderInventoryNeeds({
    ...order,
    order_data: (order.order_data || []).filter(
      item => !item.assembly_completed
    )
  });
}

function isOrderReadyForAssembly(order) {
  const needs = getOrderInventoryNeeds(order);

  return Object.entries(needs).every(([itemName, qtyNeeded]) => {
    return getInventoryQty(itemName) >= qtyNeeded;
  });
}

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

function sanitizeName(name) {
  return Array.from(name || "")
    .map(char => /[a-z]/i.test(char) ? char.toUpperCase() : char)
    .filter(char => /[A-Z0-9]/.test(char) || specialKeycaps[char])
    .join("");
}

function getLetterOrientation(design) {
  return design?.letter_orientation === "horizontal" ||
    design?.letterOrientation === "horizontal"
    ? "horizontal"
    : "vertical";
}

function getLetterOrientationLabel(design) {
  return getLetterOrientation(design) === "horizontal"
    ? "Horizontal / Sideways"
    : "Vertical / Upright";
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

const PDF_ICON_CODES = {
  "♡": "HT",
  "★": "ST",
  "✿": "FL",
  "🎀": "RB",
  "🐾": "PW",
  "☘": "CL",
  "☁": "CD",
  "🌙": "MN",
  "♪": "MU",
  "⚡": "LT",
  "🔥": "FI",
  "☕": "CF",
  "🦆": "DK",
  "🐱": "CT",
  "✈": "PL",
  "⚽": "SC",
  "🏐": "VB",
  "🏉": "RG",
  "⛷": "SK",
  "🚲": "BI",
  "⛳": "GF",
  "🥒": "PB",
  "🎳": "BW",
  "⚾": "BB",
  "♟": "CH"
};

function getPdfIconCode(character) {
  return PDF_ICON_CODES[character] || "IC";
}

function getPdfIconName(character) {
  const name = specialKeycaps[character] || "icon";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function getPdfIconLegend(item) {
  const characters = Array.from(
    item.clean_name || sanitizeName(item.name || "")
  );
  const seen = new Set();

  return characters
    .filter(character => specialKeycaps[character])
    .filter(character => {
      if (seen.has(character)) return false;
      seen.add(character);
      return true;
    })
    .map(character => `${getPdfIconName(character)} icon`)
    .join(", ");
}

function getPdfReadableItemName(item) {
  return Array.from(item.name || "Personalised keychain")
    .map(character =>
      specialKeycaps[character]
        ? `[${getPdfIconName(character)}]`
        : character
    )
    .join("");
}

const productionStlJobs = new Map();
const productionBaseStlJobs = new Map();
const productionAmsPlateJobs = new Map();
let currentBaseBatchPlan = [];
let currentBaseColourPlan = [];
const productionStlGeometryCache = new Map();
const productionStlLoader = new STLLoader();
const productionStlExporter = new STLExporter();

function getProductionKeycapPath(character) {
  const specialName = specialKeycaps[character];

  return specialName
    ? `/models/keycap - ${specialName}.stl`
    : `/models/keycap-char-${character}.stl`;
}

function safeProductionFileName(value, fallback = "keycaps") {
  const cleaned = String(value || fallback)
    .normalize("NFKD")
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

  return cleaned || fallback;
}

async function loadProductionStlGeometry(path) {
  if (!productionStlGeometryCache.has(path)) {
    productionStlGeometryCache.set(path, (async () => {
      const response = await fetch(path);

      if (!response.ok) {
        throw new Error(`Could not load ${path}`);
      }

      const geometry = productionStlLoader.parse(await response.arrayBuffer());
      geometry.computeBoundingBox();
      return geometry;
    })());
  }

  return (await productionStlGeometryCache.get(path)).clone();
}

function arrangeProductionStlGeometries(
  sourceGeometries,
  maximumColumns = 8,
  spacing = 4
) {
  let widest = 0;
  let deepest = 0;

  sourceGeometries.forEach(geometry => {
    geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    geometry.boundingBox.getSize(size);
    widest = Math.max(widest, size.x);
    deepest = Math.max(deepest, size.y);
  });

  const columns = Math.min(
    maximumColumns,
    Math.max(1, Math.ceil(Math.sqrt(sourceGeometries.length)))
  );
  const cellWidth = widest + spacing;
  const cellDepth = deepest + spacing;

  return sourceGeometries.map((geometry, index) => {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const centreX = (box.min.x + box.max.x) / 2;
    const centreY = (box.min.y + box.max.y) / 2;
    const column = index % columns;
    const row = Math.floor(index / columns);

    geometry.translate(
      column * cellWidth - centreX,
      row * cellDepth - centreY,
      -box.min.z
    );

    return geometry;
  });
}

function downloadProductionStl(geometry, filename) {
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry);
  const binaryStl = productionStlExporter.parse(mesh, { binary: true });
  const blob = new Blob([binaryStl], { type: "model/stl" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

async function generateBaseColourStl(jobId, button) {
  const job = productionBaseStlJobs.get(jobId);

  if (!job) {
    alert("This base print group is no longer available. Please refresh Production.");
    return;
  }

  const components = Array.isArray(job.components)
    ? job.components.map(component => ({
        ...component,
        quantity: Math.max(0, Math.floor(Number(
          document.getElementById(component.inputId)?.value || component.toPrint || 0
        )))
      })).filter(component => component.quantity > 0)
    : [{
        baseShape: job.baseShape || "ribbed",
        quantity: Math.max(0, Math.floor(Number(
          document.getElementById(job.inputId)?.value || job.toPrint || 0
        )))
      }];
  const quantity = components.reduce(
    (sum, component) => sum + component.quantity,
    0
  );

  if (!quantity) {
    alert("Set at least one base before downloading the STL.");
    return;
  }

  const previousLabel = button?.textContent || "Download Base STL";

  if (button) {
    button.disabled = true;
    button.textContent = "Building base plate…";
  }

  try {
    const sourceGeometries = await Promise.all(
      components.flatMap(component =>
        Array.from({ length: component.quantity }, () =>
          loadProductionStlGeometry(
            `/models/base_${component.baseShape === "bubbly" ? "bubbly" : "ribbed"}.stl`
          )
        )
      )
    );

    const arrangedGeometries = arrangeProductionStlGeometries(
      sourceGeometries,
      4,
      5
    );
    const mergedGeometry = mergeGeometries(arrangedGeometries, false);

    if (!mergedGeometry) {
      throw new Error("The selected bases could not be combined.");
    }

    const colourName = safeProductionFileName(job.baseName, "base");
    const shapeCounts = components.map(component =>
      `${component.baseShape === "bubbly" ? "bubbly" : "ribbed"}-${component.quantity}`
    ).join("_");

    downloadProductionStl(
      mergedGeometry,
      `${colourName}-bases_${shapeCounts}_${quantity}-pieces.stl`
    );

    arrangedGeometries.forEach(geometry => geometry.dispose());
    mergedGeometry.dispose();

    if (button) button.textContent = `Downloaded ${quantity} bases ✓`;
    setTimeout(() => {
      if (button) button.textContent = previousLabel;
    }, 2500);
  } catch (error) {
    console.error("Unable to generate base STL:", error);
    alert(`Unable to generate the base STL.\n\n${error.message || error}`);
  } finally {
    if (button) button.disabled = false;
  }
}

window.generateBaseColourStl = generateBaseColourStl;

function splitProductionKeycapGeometry(geometry) {
  const position = geometry.attributes.position;
  const triangleCount = position.count / 3;
  const visited = new Array(triangleCount).fill(false);
  const components = [];
  const vertexMap = new Map();

  const getVertexKey = index => [
    position.getX(index).toFixed(3),
    position.getY(index).toFixed(3),
    position.getZ(index).toFixed(3)
  ].join(",");

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const key = getVertexKey(triangle * 3 + vertex);
      if (!vertexMap.has(key)) vertexMap.set(key, []);
      vertexMap.get(key).push(triangle);
    }
  }

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    if (visited[triangle]) continue;

    const stack = [triangle];
    const component = [];
    visited[triangle] = true;

    while (stack.length) {
      const current = stack.pop();
      component.push(current);

      for (let vertex = 0; vertex < 3; vertex += 1) {
        const key = getVertexKey(current * 3 + vertex);

        (vertexMap.get(key) || []).forEach(neighbour => {
          if (!visited[neighbour]) {
            visited[neighbour] = true;
            stack.push(neighbour);
          }
        });
      }
    }

    components.push(component);
  }

  components.sort((a, b) => b.length - a.length);

  const makeGeometry = triangles => {
    const vertices = [];

    triangles.forEach(triangle => {
      for (let vertex = 0; vertex < 3; vertex += 1) {
        const index = triangle * 3 + vertex;
        vertices.push(
          position.getX(index),
          position.getY(index),
          position.getZ(index)
        );
      }
    });

    const result = new THREE.BufferGeometry();
    result.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    result.computeVertexNormals();
    return result;
  };

  return {
    tile: makeGeometry(components[0] || []),
    letter: makeGeometry(components.slice(1).flat())
  };
}

function prepareProductionKeycapGeometry(
  geometry,
  orientation = "vertical"
) {
  if (orientation !== "horizontal") return geometry;

  const parts = splitProductionKeycapGeometry(geometry);
  parts.letter.computeBoundingBox();

  if (parts.letter.boundingBox) {
    const centre = new THREE.Vector3();
    parts.letter.boundingBox.getCenter(centre);
    parts.letter.translate(-centre.x, -centre.y, 0);
    parts.letter.rotateZ(Math.PI / 2);
    parts.letter.translate(centre.x, centre.y, 0);
  }

  const combined = mergeGeometries(
    [parts.tile, parts.letter],
    false
  );

  geometry.dispose();
  parts.tile.dispose();
  parts.letter.dispose();

  if (!combined) {
    throw new Error("Unable to rotate the selected keycap letter.");
  }

  combined.computeVertexNormals();
  return combined;
}

async function generateKeycapCombinationStl(jobId, button) {
  const job = productionStlJobs.get(jobId);

  if (!job) {
    alert("This colour combination is no longer available. Please refresh Production.");
    return;
  }

  const requestedKeycaps = [];

  job.rows.forEach(row => {
    const input = document.getElementById(row.inputId);
    const quantity = Math.max(0, Math.floor(Number(input?.value || row.toPrint || 0)));

    for (let index = 0; index < quantity; index += 1) {
      requestedKeycaps.push({
        character: row.letter,
        capName: row.capName || job.capName,
        letterName: row.letterName || job.letterName
      });
    }
  });

  if (!requestedKeycaps.length) {
    alert("Set at least one letter quantity before generating the STL.");
    return;
  }

  const previousLabel = button?.textContent || "Generate STL";

  if (button) {
    button.disabled = true;
    button.textContent = "Building print plate…";
  }

  try {
    const sourceGeometries = await Promise.all(
      requestedKeycaps.map(async item => {
        const geometry = await loadProductionStlGeometry(
          getProductionKeycapPath(item.character)
        );

        return geometry;
      })
    );

    const arrangedGeometries = arrangeProductionStlGeometries(
      sourceGeometries,
      8,
      4
    );

    const mergedGeometry = mergeGeometries(arrangedGeometries, false);

    if (!mergedGeometry) {
      throw new Error("The selected keycaps could not be combined.");
    }

    const fileStem = job.fileName
      ? safeProductionFileName(job.fileName, "keycap-plate")
      : `${safeProductionFileName(job.capName, "cap")}-cap_${safeProductionFileName(job.letterName, "letter")}-letter`;

    downloadProductionStl(
      mergedGeometry,
      `${fileStem}_${requestedKeycaps.length}-pieces.stl`
    );

    arrangedGeometries.forEach(geometry => geometry.dispose());
    mergedGeometry.dispose();

    if (button) button.textContent = `Downloaded ${requestedKeycaps.length} pieces ✓`;
    setTimeout(() => {
      if (button) button.textContent = previousLabel;
    }, 2500);
  } catch (error) {
    console.error("Unable to generate keycap STL:", error);
    alert(`Unable to generate the STL file.\n\n${error.message || error}`);
  } finally {
    if (button) button.disabled = false;
  }
}

window.generateKeycapCombinationStl = generateKeycapCombinationStl;

function saveAmsBaseReservation() {
  localStorage.setItem(
    AMS_BASE_RESERVATION_KEY,
    JSON.stringify(amsBaseReservation)
  );
}

window.updateAmsBaseReservation = function() {
  const printerId = String(
    document.getElementById("amsBasePrinter")?.value || ""
  );
  const colourNames = printerId
    ? Array.from(
        document.querySelectorAll(
          'input[name="amsBaseBusyColour"]:checked'
        )
      ).map(input => input.value)
    : [];

  amsBaseReservation = { printerId, colourNames };
  saveAmsBaseReservation();
  renderProductionPlanner(latestOrders);
};

window.clearAmsBaseReservation = function() {
  amsBaseReservation = { printerId: "", colourNames: [] };
  saveAmsBaseReservation();
  renderProductionPlanner(latestOrders);
};

function planAmsLiteKeycapPlates(combinationCards) {
  const colourLimit = 4;
  const suggestedPieceLimit = 56;
  const plates = [];

  const combinations = combinationCards
    .map(card => ({
      ...card,
      pieceCount: card.rows.reduce(
        (sum, row) => sum + Number(row.toPrint || 0),
        0
      ),
      colours: [
        {
          name: card.capName,
          hex: card.capHex
        },
        {
          name: card.letterName,
          hex: card.letterHex
        }
      ].filter(
        (colour, index, all) =>
          all.findIndex(
            other =>
              String(other.name).toLowerCase() ===
              String(colour.name).toLowerCase()
          ) === index
      )
    }))
    .filter(card => card.pieceCount > 0)
    .sort((a, b) => {
      const colourDifference = b.colours.length - a.colours.length;
      return colourDifference || b.pieceCount - a.pieceCount;
    });

  combinations.forEach(combination => {
    const possiblePlates = plates
      .map((plate, index) => {
        const combinedColours = new Map(plate.colours);

        combination.colours.forEach(colour => {
          combinedColours.set(String(colour.name).toLowerCase(), colour);
        });

        return {
          plate,
          index,
          combinedColours,
          addedColours: combinedColours.size - plate.colours.size,
          pieceTotal: plate.pieceCount + combination.pieceCount
        };
      })
      .filter(candidate =>
        candidate.combinedColours.size <= colourLimit &&
        candidate.pieceTotal <= suggestedPieceLimit
      )
      .sort((a, b) =>
        a.addedColours - b.addedColours ||
        b.plate.pieceCount - a.plate.pieceCount
      );

    let selectedPlate = possiblePlates[0]?.plate;

    if (!selectedPlate) {
      selectedPlate = {
        combinations: [],
        colours: new Map(),
        pieceCount: 0
      };
      plates.push(selectedPlate);
    }

    selectedPlate.combinations.push(combination);
    selectedPlate.pieceCount += combination.pieceCount;

    combination.colours.forEach(colour => {
      selectedPlate.colours.set(
        String(colour.name).toLowerCase(),
        colour
      );
    });
  });

  return optimizeAmsPlateSequence(plates);
}

window.startKeycapCombination = async function(jobId, button, printerId = null) {
  const combination = productionStlJobs.get(jobId);

  if (!combination) {
    alert(
      "This keycap combination is no longer available. Please refresh Production."
    );
    return;
  }

  if (productionJobsLoadFailed) {
    alert(
      "Set up the production workflow in Supabase before tracking prints."
    );
    return;
  }

  const jobs = [];
  const startedAt = new Date().toISOString();

  for (const row of combination.rows || []) {
    const input = document.getElementById(row.inputId);
    const quantity = Number(input?.value ?? row.toPrint ?? 0);

    if (!Number.isInteger(quantity) || quantity < 0) {
      alert(
        "Every combination quantity must be a whole number of zero or more."
      );
      return;
    }

    if (quantity > 0) {
      jobs.push({
        item_name: row.itemName,
        category: "Keycap",
        quantity,
        stage: "printing",
        printer_id: printerId || null,
        started_at: startedAt,
        updated_at: new Date().toISOString()
      });
    }
  }

  if (!jobs.length) {
    alert("This combination has no remaining quantities to print.");
    return;
  }

  const previousLabel = button?.textContent || "Start Printing";

  if (button) {
    button.disabled = true;
    button.textContent = "Moving…";
  }

  const { error } = await supabase
    .from("production_jobs")
    .insert(jobs);

  if (error) {
    console.error("Unable to start keycap combination:", error);
    alert("Unable to move this keycap combination to Printing.");

    if (button) {
      button.disabled = false;
      button.textContent = previousLabel;
    }
    return;
  }

  await renderProductionPlanner(latestOrders);
};

window.updateAmsCombinationSelection = function() {
  const selectedCount = document.querySelectorAll(
    ".ams-combination-select:checked"
  ).length;
  const button = document.getElementById("startSelectedAmsCombinations");
  const count = document.getElementById("selectedAmsCombinationCount");

  if (count) count.textContent = String(selectedCount);
  if (button) button.disabled = productionJobsLoadFailed || selectedCount === 0;
};

window.startSelectedKeycapCombinations = async function(button) {
  const selected = Array.from(document.querySelectorAll(
    ".ams-combination-select:checked"
  ));

  if (!selected.length) {
    alert("Select at least one keycap colour combination first.");
    return;
  }

  const jobs = [];
  const plateStartedAt = new Map();

  for (const checkbox of selected) {
    const combination = productionStlJobs.get(checkbox.value);
    if (!combination) continue;
    const plateKey = checkbox.dataset.plateId || checkbox.value;
    if (!plateStartedAt.has(plateKey)) {
      plateStartedAt.set(
        plateKey,
        new Date(Date.now() + plateStartedAt.size).toISOString()
      );
    }

    for (const row of combination.rows || []) {
      const input = document.getElementById(row.inputId);
      const quantity = Number(input?.value ?? row.toPrint ?? 0);

      if (!Number.isInteger(quantity) || quantity < 0) {
        alert("Every selected quantity must be a whole number of zero or more.");
        return;
      }

      if (quantity > 0) {
        jobs.push({
          item_name: row.itemName,
          category: "Keycap",
          quantity,
          stage: "printing",
          printer_id: checkbox.dataset.printerId || null,
          started_at: plateStartedAt.get(plateKey),
          updated_at: new Date().toISOString()
        });
      }
    }
  }

  if (!jobs.length) {
    alert("The selected combinations have no remaining quantities to print.");
    return;
  }

  if (!confirm(
    `Send ${selected.length} selected colour combination${selected.length === 1 ? "" : "s"} to Printing?\n\n` +
    "You will stay on this planning page so you can send another batch."
  )) return;

  const previousLabel = button?.textContent || "Start Selected Combinations";
  if (button) {
    button.disabled = true;
    button.textContent = "Sending selected…";
  }

  if (IS_ADMIN_PREVIEW) {
    jobs.forEach((job, index) => productionJobs.push({
      ...job,
      id: `preview-selected-combination-${Date.now()}-${index}`
    }));
  } else {
    const { error } = await supabase.from("production_jobs").insert(jobs);
    if (error) {
      console.error("Unable to start selected combinations:", error);
      alert("Unable to send the selected combinations to Printing.");
      if (button) {
        button.disabled = false;
        button.textContent = previousLabel;
      }
      return;
    }
  }

  await renderProductionPlanner(latestOrders);
};

window.startAmsLitePlate = async function(plateId, button) {
  const plate = productionAmsPlateJobs.get(plateId);

  if (!plate) {
    alert(
      "This AMS Lite plate is no longer available. Please refresh Production."
    );
    return;
  }

  if (productionJobsLoadFailed) {
    alert(
      "Set up the production workflow in Supabase before tracking prints."
    );
    return;
  }

  const jobs = [];
  const startedAt = new Date().toISOString();

  for (const item of plate.items || []) {
    const input = document.getElementById(item.inputId);
    const quantity = Number(input?.value ?? item.toPrint ?? 0);

    if (!Number.isInteger(quantity) || quantity < 0) {
      alert("Every plate quantity must be a whole number of zero or more.");
      return;
    }

    if (quantity > 0) {
      jobs.push({
        item_name: item.itemName,
        category: "Keycap",
        quantity,
        stage: "printing",
        printer_id: plate.printerId || null,
        started_at: startedAt,
        updated_at: new Date().toISOString()
      });
    }
  }

  if (!jobs.length) {
    alert("This AMS Lite plate has no remaining quantities to print.");
    return;
  }

  const previousLabel = button?.textContent || "Start Printing";

  if (button) {
    button.disabled = true;
    button.textContent = "Moving plate…";
  }

  const { error } = await supabase
    .from("production_jobs")
    .insert(jobs);

  if (error) {
    console.error("Unable to start AMS Lite plate:", error);
    alert("Unable to move this AMS Lite plate to Printing.");

    if (button) {
      button.disabled = false;
      button.textContent = previousLabel;
    }
    return;
  }

  await renderProductionPlanner(latestOrders);
};

window.downloadAmsLitePlateStls = async function(plateId, button) {
  const plate = productionAmsPlateJobs.get(plateId);

  if (!plate) {
    alert("This AMS Lite plate is no longer available. Please refresh Production.");
    return;
  }

  const jobsToDownload = plate.combinationJobIds.filter(jobId => {
    const job = productionStlJobs.get(jobId);
    return job?.rows.some(row => {
      const input = document.getElementById(row.inputId);
      return Math.max(
        0,
        Math.floor(Number(input?.value || row.toPrint || 0))
      ) > 0;
    });
  });

  if (!jobsToDownload.length) {
    alert("This plate has no remaining STL quantities to download.");
    return;
  }

  const previousLabel = button?.textContent || "Download Plate STLs";

  if (button) {
    button.disabled = true;
    button.textContent = `Preparing 1 / ${jobsToDownload.length}…`;
  }

  try {
    for (let index = 0; index < jobsToDownload.length; index += 1) {
      if (button) {
        button.textContent =
          `Preparing ${index + 1} / ${jobsToDownload.length}…`;
      }

      await generateKeycapCombinationStl(
        jobsToDownload[index],
        null
      );
    }

    if (button) {
      button.textContent =
        `Downloaded ${jobsToDownload.length} STL${jobsToDownload.length === 1 ? "" : "s"} ✓`;
    }

    alert(
      `${jobsToDownload.length} separate STL file${jobsToDownload.length === 1 ? " was" : "s were"} downloaded for this AMS Lite plate.\n\n` +
      "Import them onto the same Bambu Studio plate, then assign the four listed filament colours."
    );
  } catch (error) {
    console.error("Unable to download AMS Lite plate STLs:", error);
    alert(
      "Some plate files could not be downloaded. You can still download each exact combination from the groups below."
    );
  } finally {
    if (button) {
      button.disabled = false;
      setTimeout(() => {
        button.textContent = previousLabel;
      }, 2500);
    }
  }
};

function getRushOrderPrintGroups(order, missingParts = null) {
  const baseGroups = {};
  const keycapGroups = {};
  const remainingNeeds = Array.isArray(missingParts)
    ? Object.fromEntries(
        missingParts.map(part => [
          part.itemName,
          Math.max(0, Number(part.quantity || 0))
        ])
      )
    : null;

  const needsPrint = itemName => {
    if (!remainingNeeds) return true;
    if (!remainingNeeds[itemName]) return false;

    remainingNeeds[itemName] -= 1;
    return true;
  };

  getEmailOrderItems(order).forEach(item => {
    const design = item.design || {};
    const characters = Array.from(item.clean_name || sanitizeName(item.name || ""));
    const bases = Array.isArray(design.bases) ? design.bases : [];
    const caps = Array.isArray(design.caps) ? design.caps : [];
    const letters = Array.isArray(design.letters) ? design.letters : [];

    if (!characters.length || !bases.length || !caps.length || !letters.length) return;

    const baseShape = design.base_shape?.key || design.baseShape || "ribbed";
    characters.forEach((character, index) => {
      const base = bases[index % bases.length];
      const cap = caps[index % caps.length];
      const letterColour = letters[index % letters.length];
      const baseName = base?.name || base?.hex || base || "Base";
      const baseHex = base?.hex || base || "#f6a9c2";
      const capName = cap?.name || cap?.hex || cap || "Cap";
      const capHex = cap?.hex || cap || "#ffffff";
      const letterName = letterColour?.name || letterColour?.hex || letterColour || "Letter";
      const letterHex = letterColour?.hex || letterColour || "#332d30";
      const baseKey = `${baseShape}|${baseName}`;
      const keycapKey = `${capName}|${letterName}`;
      const baseInventoryName = getBaseInventoryName(baseName, baseShape);
      const keycapInventoryName = getKeycapInventoryName(
        capName,
        letterName,
        character
      );

      if (needsPrint(baseInventoryName)) {
        if (!baseGroups[baseKey]) {
          baseGroups[baseKey] = {
            baseShape,
            baseName,
            baseHex,
            quantity: 0
          };
        }
        baseGroups[baseKey].quantity += 1;
      }

      if (needsPrint(keycapInventoryName)) {
        if (!keycapGroups[keycapKey]) {
          keycapGroups[keycapKey] = {
            capName,
            capHex,
            letterName,
            letterHex,
            characters: []
          };
        }
        keycapGroups[keycapKey].characters.push(character);
      }
    });
  });

  return {
    bases: Object.values(baseGroups),
    keycaps: Object.values(keycapGroups)
  };
}

function getOrderAmsLitePlatePlan(groups) {
  return planAmsLiteKeycapPlates(
    groups.keycaps.map((group, groupIndex) => ({
      ...group,
      groupIndex,
      rows: [{ toPrint: group.characters.length }]
    }))
  );
}

async function buildRushStlPlate(requests) {
  const sourceGeometries = await Promise.all(
    requests.map(async request => {
      const geometry = await loadProductionStlGeometry(request.path);
      return request.kind === "keycap"
        ? prepareProductionKeycapGeometry(geometry, request.orientation)
        : geometry;
    })
  );

  let widest = 0;
  let deepest = 0;
  sourceGeometries.forEach(geometry => {
    geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    geometry.boundingBox.getSize(size);
    widest = Math.max(widest, size.x);
    deepest = Math.max(deepest, size.y);
  });

  const columns = Math.min(7, Math.ceil(Math.sqrt(sourceGeometries.length)));
  const spacing = 5;
  const arranged = sourceGeometries.map((geometry, index) => {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const centreX = (box.min.x + box.max.x) / 2;
    const centreY = (box.min.y + box.max.y) / 2;
    geometry.translate(
      (index % columns) * (widest + spacing) - centreX,
      Math.floor(index / columns) * (deepest + spacing) - centreY,
      -box.min.z
    );
    return geometry;
  });

  const merged = mergeGeometries(arranged, false);
  if (!merged) throw new Error("The rush-order pieces could not be combined.");
  merged.computeVertexNormals();

  const binaryStl = productionStlExporter.parse(new THREE.Mesh(merged), { binary: true });
  const blob = new Blob([binaryStl], { type: "model/stl" });

  arranged.forEach(geometry => geometry.dispose());
  merged.dispose();
  return blob;
}

function downloadRushStl(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function generateOrderStls(id, button) {
  const order = latestOrders.find(item => String(item.id) === String(id));
  if (!order) return alert("Order could not be found.");

  await loadInventoryItems();

  const selectedScopeActive = productionOrderSelection.size > 0;
  const timelineSourceOrders = selectedScopeActive
    ? latestOrders.filter(order => productionOrderSelection.has(String(order.id)))
    : latestOrders;
  const timelineEntry = getProductionTimelineOrders(
    timelineSourceOrders,
    selectedScopeActive
  )
    .find(entry => String(entry.order.id) === String(id));
  const groups = getRushOrderPrintGroups(
    order,
    timelineEntry?.missingParts || null
  );
  const totalFiles = groups.bases.length + groups.keycaps.length;
  const totalPieces =
    groups.bases.reduce((sum, group) => sum + group.quantity, 0) +
    groups.keycaps.reduce((sum, group) => sum + group.characters.length, 0);
  const keycapPlatePlan = getOrderAmsLitePlatePlan(groups);

  if (!totalFiles || !totalPieces) {
    alert(
      timelineEntry
        ? "Nothing needs printing for this order. Its printed parts are already available."
        : "This order does not contain enough saved design information to generate STL files."
    );
    return;
  }

  const summary = [
    ...groups.bases.map(group =>
      `${group.baseName} ${group.baseShape === "bubbly" ? "Bubbly" : "Ribbed"} Bases × ${group.quantity}`
    ),
    ...keycapPlatePlan.map((plate, plateIndex) =>
      `AMS Plate ${plateIndex + 1}: ${plate.pieceCount} keycaps using ` +
      `${Array.from(plate.colours.values()).map(colour => colour.name).join(", ")}`
    )
  ];

  if (!confirm(
    `Generate only the remaining STLs for ${order.order_ref}?\n\n` +
    summary.join("\n") +
    `\n\n${totalFiles} separate colour/shape file${totalFiles === 1 ? "" : "s"} will download.`
  )) return;

  const previousLabel = button?.textContent || "Generate Order STLs";
  if (button) {
    button.disabled = true;
    button.textContent = "Building remaining STLs…";
  }

  try {
    const reference = safeProductionFileName(order.order_ref, "rush-order");
    const files = [];

    for (const group of groups.bases) {
      const requests = Array.from({ length: group.quantity }, () => ({
        kind: "base",
        path: `/models/base_${group.baseShape === "bubbly" ? "bubbly" : "ribbed"}.stl`
      }));
      const blob = await buildRushStlPlate(requests);
      files.push({
        blob,
        filename: `${reference}_BASE_${safeProductionFileName(group.baseName, "colour")}_${group.baseShape}_${group.quantity}pcs.stl`
      });
    }

    for (
      let plateIndex = 0;
      plateIndex < keycapPlatePlan.length;
      plateIndex += 1
    ) {
      const plate = keycapPlatePlan[plateIndex];

      for (
        let combinationIndex = 0;
        combinationIndex < plate.combinations.length;
        combinationIndex += 1
      ) {
        const combination = plate.combinations[combinationIndex];
        const group = groups.keycaps[combination.groupIndex];
        const requests = group.characters.map(character => ({
          kind: "keycap",
          path: getProductionKeycapPath(character)
        }));
        const blob = await buildRushStlPlate(requests);

        files.push({
          blob,
          filename:
            `${reference}_AMS-PLATE-${plateIndex + 1}_` +
            `${String(combinationIndex + 1).padStart(2, "0")}_` +
            `${safeProductionFileName(group.capName, "cap")}-cap_` +
            `${safeProductionFileName(group.letterName, "letter")}-letter_` +
            `${group.characters.length}pcs.stl`
        });
      }
    }

    files.forEach((file, index) => {
      setTimeout(() => downloadRushStl(file.blob, file.filename), index * 350);
    });

    if (button) button.textContent = `Downloaded ${files.length} STL${files.length === 1 ? "" : "s"} ✓`;
    if (keycapPlatePlan.length) {
      alert(
        `${keycapPlatePlan.length} optimized AMS Lite plate${keycapPlatePlan.length === 1 ? "" : "s"} prepared.\n\n` +
        "Files with the same AMS-PLATE number belong on the same Bambu Studio plate. Each plate uses no more than four filament colours."
      );
    }
    setTimeout(() => {
      if (button) button.textContent = previousLabel;
    }, 3000);
  } catch (error) {
    console.error("Unable to generate rush-order STLs:", error);
    alert(`Unable to generate this order's STL files.\n\n${error.message || error}`);
  } finally {
    if (button) button.disabled = false;
  }
}

window.generateOrderStls = generateOrderStls;

window.generateTimelineAmsPlateStls = async function(
  orderId,
  requestedPlateIndex,
  button
) {
  const order = latestOrders.find(
    item => String(item.id) === String(orderId)
  );

  if (!order) {
    alert("Order could not be found.");
    return;
  }

  await loadInventoryItems();

  const selectedScopeActive = productionOrderSelection.size > 0;
  const timelineSourceOrders = selectedScopeActive
    ? latestOrders.filter(order => productionOrderSelection.has(String(order.id)))
    : latestOrders;
  const timelineEntry = getProductionTimelineOrders(
    timelineSourceOrders,
    selectedScopeActive
  )
    .find(entry => String(entry.order.id) === String(orderId));

  if (!timelineEntry) {
    alert("This order is no longer waiting in the Production Timeline.");
    return;
  }

  const groups = getRushOrderPrintGroups(
    order,
    timelineEntry.missingParts
  );
  const plates = getOrderAmsLitePlatePlan(groups);
  const plateIndex = Number(requestedPlateIndex);
  const plate = plates[plateIndex];

  if (!plate) {
    alert(
      "This plate is no longer needed. Refresh Production to see the latest print plan."
    );
    return;
  }

  const previousLabel = button?.textContent || `Generate Plate ${plateIndex + 1}`;

  if (button) {
    button.disabled = true;
    button.textContent = "Building plate…";
  }

  try {
    const reference = safeProductionFileName(
      order.order_ref,
      "timeline-order"
    );
    const files = [];

    for (
      let combinationIndex = 0;
      combinationIndex < plate.combinations.length;
      combinationIndex += 1
    ) {
      if (button) {
        button.textContent =
          `Building ${combinationIndex + 1}/${plate.combinations.length}…`;
      }

      const combination = plate.combinations[combinationIndex];
      const group = groups.keycaps[combination.groupIndex];
      const requests = group.characters.map(character => ({
        kind: "keycap",
        path: getProductionKeycapPath(character)
      }));
      const blob = await buildRushStlPlate(requests);

      files.push({
        blob,
        filename:
          `${reference}_AMS-PLATE-${plateIndex + 1}_` +
          `${String(combinationIndex + 1).padStart(2, "0")}_` +
          `${safeProductionFileName(group.capName, "cap")}-cap_` +
          `${safeProductionFileName(group.letterName, "letter")}-letter_` +
          `${group.characters.length}pcs.stl`
      });
    }

    files.forEach((file, index) => {
      setTimeout(
        () => downloadRushStl(file.blob, file.filename),
        index * 350
      );
    });

    if (button) {
      button.textContent =
        `Plate ${plateIndex + 1} downloaded ✓`;
    }

    alert(
      `Plate ${plateIndex + 1} is ready.\n\n` +
      `${files.length} STL file${files.length === 1 ? "" : "s"} will download. ` +
      "Import all files with this AMS-PLATE number onto the same Bambu Studio plate."
    );
  } catch (error) {
    console.error("Unable to generate timeline AMS plate:", error);
    alert(
      `Unable to generate Plate ${plateIndex + 1}.\n\n` +
      (error.message || error)
    );
  } finally {
    if (button) {
      button.disabled = false;
      setTimeout(() => {
        button.textContent = previousLabel;
      }, 3000);
    }
  }
};

function createAssemblyMiniPreview(name, design) {
  return Array.from(sanitizeName(name))
    .map((letter, i) => {
      const base = design.bases[i % design.bases.length];
      const cap = design.caps[i % design.caps.length];
      const letterColour = design.letters[i % design.letters.length];

      const baseHex = base.hex || base;
      const capHex = cap.hex || cap;
      const letterHex = letterColour.hex || letterColour;

      return `
        <div class="mini-block" style="background:${baseHex};">
          <div
            class="mini-cap"
            style="background:${capHex}; color:${letterHex};"
          >
            <span style="display:inline-block;transform:${getLetterOrientation(design) === "horizontal" ? "rotate(-90deg)" : "none"};">
              ${displayIcon(letter)}
            </span>
          </div>
        </div>
      `;
    })
    .join("");
}

function getAssemblyColourDetails(value, fallbackName) {
  const hex = value?.hex || value;
  const savedName = String(value?.name || "").trim();
  const matchedColour = ADMIN_COLOUR_OPTIONS.find(colour =>
    String(colour.hex).toLowerCase() === String(hex || "").toLowerCase()
  );

  return {
    name: savedName || matchedColour?.name || String(hex || fallbackName),
    hex: getSafePdfColour(value, "#d9d9d9")
  };
}

function createAssemblyColourGuide(name, design = {}) {
  const characters = Array.from(sanitizeName(name));
  const bases = Array.isArray(design.bases) && design.bases.length
    ? design.bases
    : ["#d9d9d9"];
  const caps = Array.isArray(design.caps) && design.caps.length
    ? design.caps
    : ["#d9d9d9"];
  const letters = Array.isArray(design.letters) && design.letters.length
    ? design.letters
    : ["#d9d9d9"];
  const selectedColourNames = [...bases, ...caps, ...letters]
    .map(colour => getAssemblyColourDetails(colour, "").name.toLowerCase());
  const confusingColourWarnings = [
    ["purple", "indigo purple"],
    ["sunflower yellow", "gold"],
    ["jade white", "white"],
    ["pink", "maroon red"]
  ].filter(pair => pair.some(colour => selectedColourNames.includes(colour)));

  return `
    <div class="assembly-colour-guide">
      <div class="assembly-colour-guide-heading">
        <strong>Exact colours by position</strong>
        <span>Use the names—not just the swatches—to tell similar colours apart.</span>
      </div>
      ${confusingColourWarnings.length ? `
        <div class="assembly-colour-warnings">
          ${confusingColourWarnings.map(([first, second]) => `
            <span>Double-check: ${escapeAdminHtml(first)} vs ${escapeAdminHtml(second)}</span>
          `).join("")}
        </div>
      ` : ""}
      <div class="assembly-colour-guide-rows">
        ${characters.map((character, index) => {
          const base = getAssemblyColourDetails(
            bases[index % bases.length],
            "Base colour"
          );
          const cap = getAssemblyColourDetails(
            caps[index % caps.length],
            "Cap colour"
          );
          const letter = getAssemblyColourDetails(
            letters[index % letters.length],
            "Letter colour"
          );

          return `
            <div class="assembly-colour-row">
              <b>${index + 1}</b>
              <span class="assembly-colour-character">${displayIcon(character)}</span>
              <span><i style="background:${base.hex}"></i><em>Base</em><strong>${escapeAdminHtml(base.name)}</strong></span>
              <span><i style="background:${cap.hex}"></i><em>Cap</em><strong>${escapeAdminHtml(cap.name)}</strong></span>
              <span><i style="background:${letter.hex}"></i><em>Letter</em><strong>${escapeAdminHtml(letter.name)}</strong></span>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

async function renderAssemblyQueue() {
  await loadInventoryItems();

  const candidateOrders = latestOrders
    .filter(order =>
      !order.archived_at && ["Payment Verified", "Printing"].includes(order.status)
    )
    .sort((a, b) =>
      new Date(a.needed_by || "9999-12-31") -
      new Date(b.needed_by || "9999-12-31")
    );

  // Reserve available stock by needed-by date, one keychain at a time.
  // This lets partially ready orders appear without promising the same
  // printed piece to two different keychains.
  const remainingStock = Object.fromEntries(
    Object.entries(inventoryItems).map(([itemName, item]) => [
      itemName,
      Number(item.qty || 0)
    ])
  );

  const assemblyOrders = candidateOrders
    .map(order => {
      const readyItems = [];
      const baseReadyItems = [];
      const waitingItems = [];
      const completedItems = [];

      (order.order_data || []).forEach((item, itemIndex) => {
        if (item.assembly_completed) {
          completedItems.push({ item, itemIndex });
          return;
        }

        const itemNeeds = getOrderInventoryNeeds({
          ...order,
          order_data: [item]
        });

        const hasAllParts = Object.entries(itemNeeds).every(
          ([itemName, qtyNeeded]) =>
            Number(remainingStock[itemName] || 0) >= qtyNeeded
        );

        if (!hasAllParts) {
          const baseNeeds = getKeychainBaseAssemblyNeeds(item);
          const basesCanBeAssembled = item.base_assembled || (
            Object.keys(baseNeeds).length > 0 &&
            Object.entries(baseNeeds).every(
              ([itemName, qtyNeeded]) =>
                Number(remainingStock[itemName] || 0) >= qtyNeeded
            )
          );

          if (basesCanBeAssembled) {
            if (!item.base_assembled) {
              Object.entries(baseNeeds).forEach(([itemName, qtyNeeded]) => {
                remainingStock[itemName] =
                  Number(remainingStock[itemName] || 0) - qtyNeeded;
              });
            }
            baseReadyItems.push({ item, itemIndex });
            return;
          }
          waitingItems.push({ item, itemIndex });
          return;
        }

        Object.entries(itemNeeds).forEach(([itemName, qtyNeeded]) => {
          remainingStock[itemName] =
            Number(remainingStock[itemName] || 0) - qtyNeeded;
        });

        readyItems.push({ item, itemIndex });
      });

      return {
        order,
        readyItems,
        baseReadyItems,
        waitingItems,
        completedItems,
        allCompleted:
          completedItems.length > 0 &&
          completedItems.length === (order.order_data || []).length
      };
    })
    .filter(entry =>
      entry.readyItems.length > 0 ||
      entry.baseReadyItems.length > 0 ||
      entry.completedItems.length > 0
    );

  const readyKeychainCount = assemblyOrders.reduce(
    (sum, entry) => sum + entry.readyItems.length,
    0
  );
  const completedKeychainCount = assemblyOrders.reduce(
    (sum, entry) => sum + entry.completedItems.length,
    0
  );
  const baseReadyKeychainCount = assemblyOrders.reduce(
    (sum, entry) => sum + entry.baseReadyItems.length,
    0
  );

  function renderAssemblyItem(order, item, itemIndex, mode = "ready") {
    const completed = mode === "completed";
    const baseOnly = mode === "base-only";
    const baseShape =
      item.design?.base_shape?.key ||
      item.design?.baseShape ||
      "ribbed";
    const letterOrientation = getLetterOrientation(item.design);
    const characters = Array.from(
      item.clean_name || sanitizeName(item.name || "")
    );

    return `
      <div class="assembly-item ${completed ? "is-complete" : ""}">
        <div class="assembly-item-top">
          <strong>${escapeAdminHtml(item.name || "-")}</strong>

          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${item.group_contributor_name ? `
              <span class="assembly-tag group-contributor-tag">
                For ${escapeAdminHtml(item.group_contributor_name)}
              </span>
            ` : ""}
            ${
              completed
                ? `<span class="assembly-tag assembly-complete-tag">Completed ✓</span>`
                : ""
            }
            <span class="assembly-tag">
              ${sanitizeName(item.name).length} Characters
            </span>

            <span class="assembly-tag">
              ${baseShape === "bubbly" ? "Bubbly Base" : "Ribbed Base"}
            </span>

            <span class="assembly-tag">
              ${letterOrientation === "horizontal" ? "Sideways Letters" : "Upright Letters"}
            </span>

            ${getItemGiftingBagQuantity(item) ? `<span class="assembly-tag">🎁 ${getItemGiftingBagQuantity(item)} Gifting Bag${getItemGiftingBagQuantity(item) === 1 ? "" : "s"}</span>` : ""}
            ${baseOnly ? `<span class="assembly-tag">${item.base_assembled ? "Base assembled & set aside" : "Base parts ready"}</span>` : ""}
          </div>
        </div>

        <div class="mini-chain">
          ${createAssemblyMiniPreview(item.name, item.design)}
        </div>

        ${createAssemblyColourGuide(item.name, item.design)}

        ${
          completed
            ? `
              <p class="assembly-completed-time">
                Completed${item.assembly_completed_at ? ` ${formatDate(item.assembly_completed_at)}` : ""}
              </p>
              <button
                type="button"
                class="rework-action"
                onclick='window.sendKeychainBackToRework(
                  ${JSON.stringify(String(order.id))},
                  ${itemIndex}
                )'
              >
                Not happy with it? Send back to rework
              </button>
            `
            : baseOnly ? `
              <p class="hint">
                ${item.base_assembled
                  ? "The base is already assembled and set aside. This keychain is waiting for its keycaps."
                  : "All base parts and hardware are ready. You can assemble the base now and set it aside while the keycaps print."}
              </p>
              ${item.base_assembled ? "" : `
                <button
                  class="keychain-complete-btn"
                  type="button"
                  onclick="window.markBaseAssemblyComplete('${order.id}', ${itemIndex})"
                >
                  Mark Base Assembled & Set Aside
                </button>
              `}
            ` : `
              <details class="assembly-reprint-controls">
                <summary>Bad print? Send a part back to Production</summary>

                <p class="hint">
                  Choose only the piece that needs printing again.
                </p>

                <label class="clearance-save-option">
                  <input
                    type="checkbox"
                    id="clearance-${order.id}-${itemIndex}"
                    checked
                  >
                  <span>
                    Keep rejected piece in Clearance / Seconds Inventory
                    <small>Untick this only if the piece is completely unusable.</small>
                  </span>
                </label>

                <div class="reprint-part-grid">
                  ${characters.map((character, characterIndex) => `
                    <div class="reprint-character-group">
                      <strong>Position ${characterIndex + 1} - ${displayIcon(character)}</strong>

                      <label class="reprint-checkbox-option">
                        <input type="checkbox" data-reprint-part data-order-id="${escapeAdminHtml(String(order.id))}" data-item-index="${itemIndex}" data-part-type="base" data-character-index="${characterIndex}">
                        <span>Base</span>
                      </label>

                      <label class="reprint-checkbox-option">
                        <input type="checkbox" data-reprint-part data-order-id="${escapeAdminHtml(String(order.id))}" data-item-index="${itemIndex}" data-part-type="keycap" data-character-index="${characterIndex}">
                        <span>Keycap</span>
                      </label>

                      <button
                        type="button"
                        class="reprint-part-btn"
                        onclick="window.sendPrintedPartToReprint('${order.id}', ${itemIndex}, 'base', ${characterIndex}, document.getElementById('clearance-${order.id}-${itemIndex}').checked)"
                      >
                        Reprint Base
                      </button>

                      <button
                        type="button"
                        class="reprint-part-btn"
                        onclick="window.sendPrintedPartToReprint('${order.id}', ${itemIndex}, 'keycap', ${characterIndex}, document.getElementById('clearance-${order.id}-${itemIndex}').checked)"
                      >
                        Reprint Keycap
                      </button>
                    </div>
                  `).join("")}
                </div>

                <button
                  type="button"
                  class="reprint-all-btn"
                  onclick="window.sendSelectedPrintedPartsToReprint('${order.id}', ${itemIndex}, document.getElementById('clearance-${order.id}-${itemIndex}').checked)"
                >
                  Send Checked Parts to Production
                </button>

                <button
                  type="button"
                  class="reprint-all-btn"
                  onclick="window.sendPrintedPartToReprint('${order.id}', ${itemIndex}, 'all', null, document.getElementById('clearance-${order.id}-${itemIndex}').checked)"
                >
                  Reprint All Printed Pieces
                </button>
              </details>

              <button
                class="keychain-complete-btn"
                type="button"
                onclick="window.markKeychainComplete('${order.id}', ${itemIndex})"
              >
                Complete Keychain
              </button>
            `
        }
      </div>
    `;
  }

  const emptyAssemblyMessage = candidateOrders.length
    ? `
      <div class="empty-card">
        <h3>No keychains or complete base sets ready yet</h3>
        <p>Every keychain is still missing either base parts, hardware, or keycaps.</p>
        <p>Use <strong>Add Printed</strong> in Production after each print finishes.</p>
      </div>
    `
    : `
      <div class="empty-card">
        <h3>No paid orders waiting for assembly</h3>
        <p>New paid orders will appear here once their printed parts are ready.</p>
      </div>
    `;

  const assemblyCards = assemblyOrders
    .map(({ order, readyItems, baseReadyItems, waitingItems, completedItems, allCompleted }, index) => {
      const totalItems = (order.order_data || []).length;

      return `
        <details class="assembly-card">
          <summary class="assembly-summary">
            <div>
              <h3>${escapeAdminHtml(order.customer_name || "-")}</h3>
              <p>${escapeAdminHtml(order.order_ref || "-")}</p>
            </div>

            <div class="assembly-meta">
              <span>${completedItems.length}/${totalItems} completed</span>
              ${readyItems.length ? `<span>${readyItems.length} ready now</span>` : ""}
              ${baseReadyItems.length ? `<span>${baseReadyItems.length} base-only ready</span>` : ""}
              <span>${getMethodLabel(order.collection_method)}</span>
              <span>${formatDate(order.needed_by)}</span>
            </div>
          </summary>

          <div class="assembly-body">
            ${renderOrderAlerts(order)}
            ${renderProductionNote(order)}
            ${renderAssemblyChecklist(order)}
            ${
              readyItems.length
                ? `
                  <p class="hint">
                    Complete each keychain after assembling it. Its stock will be deducted immediately.
                  </p>
                  ${readyItems
                    .map(({ item, itemIndex }) =>
                      renderAssemblyItem(order, item, itemIndex, false)
                    )
                    .join("")}
                `
                : ""
            }

            ${baseReadyItems.length ? `
              <div class="assembly-base-ready-section">
                <h4>Bases ready to assemble & set aside</h4>
                ${baseReadyItems.map(({ item, itemIndex }) =>
                  renderAssemblyItem(order, item, itemIndex, "base-only")
                ).join("")}
              </div>
            ` : ""}

            ${
              completedItems.length
                ? `
                  <div class="assembly-completed-section">
                    <h4>Completed keychains</h4>
                    ${completedItems
                      .map(({ item, itemIndex }) =>
                        renderAssemblyItem(order, item, itemIndex, "completed")
                      )
                      .join("")}
                  </div>
                `
                : ""
            }

            ${
              waitingItems.length
                ? `
                  <div class="assembly-waiting-note">
                    <strong>${waitingItems.length} more keychain(s) still waiting for printed parts.</strong>
                    <span>They will appear here automatically when enough stock is added in Production.</span>
                  </div>
                `
                : ""
            }

            ${
              allCompleted
                ? `
                  <button
                    class="ready-btn"
                    onclick="window.moveAssemblyToFulfilment('${order.id}')"
                  >
                    Move Completed Order to Fulfilment
                  </button>
                `
                : `
                  <p class="hint">
                    The final order button appears after every keychain is marked complete.
                  </p>
                `
            }
          </div>
        </details>
      `;
    })
    .join("");

  ordersContainer.innerHTML = `    
    <div class="production-card">
      <div class="production-header">
        <div>
          <h2>Ready Keychains</h2>
          <p class="hint">
            Complete keychains individually so assembled pieces stay clearly tracked.
          </p>
        </div>

        <p class="active-count">
          ${readyKeychainCount} ready · ${baseReadyKeychainCount} base-only · ${completedKeychainCount} completed
        </p>
      </div>

      ${assemblyOrders.length ? assemblyCards : emptyAssemblyMessage}
    </div>
  `;
}

function bindPersistentDetails(scope) {
  ordersContainer
    .querySelectorAll("details[data-collapse-key]")
    .forEach(details => {
      const collapseKey = details.dataset.collapseKey;
      const storageKey = `little-keeps-${scope}-${collapseKey}`;

      try {
        const savedState = localStorage.getItem(storageKey);

        if (savedState === "open") details.open = true;
        if (savedState === "closed") details.open = false;
      } catch (error) {
        console.warn("Unable to restore collapsed section:", error);
      }

      details.addEventListener("toggle", () => {
        try {
          localStorage.setItem(
            storageKey,
            details.open ? "open" : "closed"
          );
        } catch (error) {
          console.warn("Unable to remember collapsed section:", error);
        }
      });
    });
}

async function renderInventoryWorkspace() {
  await Promise.all([
    loadInventoryItems(),
    loadClearanceInventory()
  ]);

  const knownHardwareNames = new Set(
    hardwareItems.map(item => item.itemName)
  );

  const allNormalItems = Object.entries(inventoryItems)
    .map(([itemName, item]) => ({
      itemName,
      qty: Number(item.qty || 0),
      category: item.category || "Other"
    }))
    .sort((a, b) => a.itemName.localeCompare(b.itemName));

  const hardwareRows = hardwareItems.map(hardware => {
    const saved = inventoryItems[hardware.itemName];

    return {
      itemName: hardware.itemName,
      label: hardware.label,
      qty: Number(saved?.qty || 0),
      category: hardware.category
    };
  });

  const baseRows = allNormalItems.filter(item =>
    !knownHardwareNames.has(item.itemName) &&
    (
      String(item.category).toLowerCase() === "base" ||
      (
        item.itemName.endsWith(" Base") &&
        !item.itemName.includes(" Cap + ")
      )
    )
  );

  const keycapRows = allNormalItems.filter(item =>
    !knownHardwareNames.has(item.itemName) &&
    (
      String(item.category).toLowerCase() === "keycap" ||
      item.itemName.includes(" Cap + ")
    )
  );

  const baseShapeInventoryGroups = [
    {
      key: "bubbly",
      title: "Bubbly Bases",
      description: "Finished bubbly bases currently available.",
      rows: baseRows.filter(item => item.itemName.includes(" Bubbly Base"))
    },
    {
      key: "ribbed",
      title: "Ribbed Bases",
      description: "Finished ribbed bases currently available.",
      rows: baseRows.filter(item => !item.itemName.includes(" Bubbly Base"))
    }
  ];

  const keycapColourInventoryGroups = new Map();

  keycapRows.forEach(item => {
    const match = item.itemName.match(
      /^(.*?) Cap \+ (.*?) Letter - (.*)$/
    );
    const capName = match?.[1] || "Other";
    const letterName = match?.[2] || "Other";
    const character = match?.[3] || item.itemName;

    if (!keycapColourInventoryGroups.has(capName)) {
      keycapColourInventoryGroups.set(capName, new Map());
    }

    const letterGroups = keycapColourInventoryGroups.get(capName);

    if (!letterGroups.has(letterName)) {
      letterGroups.set(letterName, []);
    }

    letterGroups.get(letterName).push({
      ...item,
      capName,
      letterName,
      character,
      label: `${displayIcon(character)}`
    });
  });

  const assignedNames = new Set([
    ...hardwareRows.map(item => item.itemName),
    ...baseRows.map(item => item.itemName),
    ...keycapRows.map(item => item.itemName)
  ]);

  const otherRows = allNormalItems.filter(
    item => !assignedNames.has(item.itemName)
  );

  const renderStockRows = rows => rows.map(item => {
    const inputId = `inventory-adjust-${encodeURIComponent(item.itemName)}`;

    return `
      <div class="inventory-stock-row">
        <div class="inventory-item-copy">
          <strong>${escapeAdminHtml(item.label || item.itemName)}</strong>
          <span>${escapeAdminHtml(item.itemName)}</span>
        </div>

        <span class="inventory-quantity">${item.qty}</span>

        <div class="inventory-row-actions">
          <button
            type="button"
            class="inventory-minus-btn"
            ${item.qty <= 0 ? "disabled" : ""}
            onclick='window.removeOneInventoryItem(${JSON.stringify(item.itemName)})'
          >
            -1
          </button>

          <input
            id="${inputId}"
            type="number"
            min="1"
            value="1"
            aria-label="Quantity to adjust"
          >

          <button
            type="button"
            class="inventory-bulk-minus-btn"
            ${item.qty <= 0 ? "disabled" : ""}
            onclick='window.removeInventory(
              ${JSON.stringify(item.itemName)},
              document.getElementById(${JSON.stringify(inputId)}).value
            )'
          >
            Minus
          </button>

          <button
            type="button"
            class="inventory-add-btn"
            onclick='window.addCustomInventory(
              ${JSON.stringify(item.itemName)},
              document.getElementById(${JSON.stringify(inputId)}).value,
              ${JSON.stringify(item.category)}
            )'
          >
            Add
          </button>
        </div>
      </div>
    `;
  }).join("");

  const clearanceRows = Object.entries(clearanceInventoryItems)
    .filter(([, item]) => item.qty > 0)
    .map(([itemName, item]) => {
      const inputId =
        `clearance-adjust-${encodeURIComponent(itemName)}`;

      return `
      <div class="inventory-stock-row clearance-row">
        <div class="inventory-item-copy">
          <strong>${escapeAdminHtml(itemName)}</strong>
          <span>
            ${item.reason ? escapeAdminHtml(item.reason) : "Failed quality check"}
            ${item.latestOrderRef ? ` · From ${escapeAdminHtml(item.latestOrderRef)}` : ""}
          </span>
        </div>

        <span class="inventory-quantity clearance-quantity">${item.qty}</span>

        <div class="inventory-row-actions">
          <button
            type="button"
            class="inventory-minus-btn"
            onclick='window.removeOneClearanceItem(${JSON.stringify(itemName)})'
          >
            -1
          </button>

          <input
            id="${inputId}"
            type="number"
            min="1"
            max="${item.qty}"
            value="1"
            aria-label="Clearance quantity to remove"
          >

          <button
            type="button"
            class="inventory-bulk-minus-btn clearance-remove-btn"
            onclick='window.removeClearanceInventory(
              ${JSON.stringify(itemName)},
              document.getElementById(${JSON.stringify(inputId)}).value
            )'
          >
            Remove
          </button>
        </div>
      </div>
    `;
    })
    .join("");

  const normalTotal = allNormalItems.reduce(
    (sum, item) => sum + item.qty,
    0
  );
  const clearanceTotal = Object.values(clearanceInventoryItems).reduce(
    (sum, item) => sum + Number(item.qty || 0),
    0
  );

  const section = (
    collapseKey,
    title,
    description,
    rows,
    open = false
  ) => `
    <details
      class="inventory-group"
      data-collapse-key="${encodeURIComponent(collapseKey)}"
      ${open ? "open" : ""}
    >
      <summary>
        <div>
          <h3>${title}</h3>
          <p>${description}</p>
        </div>
        <span>${rows.length} item type${rows.length === 1 ? "" : "s"}</span>
      </summary>

      <div class="inventory-group-body">
        ${renderStockRows(rows) || `<p class="inventory-empty">No items saved here yet.</p>`}
      </div>
    </details>
  `;

  const keycapSections = Array.from(
    keycapColourInventoryGroups.entries()
  )
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([capName, letterGroups]) => {
      const combinations = Array.from(letterGroups.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));
      const itemTypeCount = combinations.reduce(
        (sum, [, rows]) => sum + rows.length,
        0
      );
      const pieceCount = combinations.reduce(
        (sum, [, rows]) =>
          sum + rows.reduce((rowSum, row) => rowSum + row.qty, 0),
        0
      );

      return `
        <details
          class="inventory-group inventory-cap-group"
          data-collapse-key="${encodeURIComponent(`keycap-${capName}`)}"
        >
          <summary>
            <div>
              <h3>${escapeAdminHtml(capName)} Caps</h3>
              <p>
                ${itemTypeCount} letter/icon type${itemTypeCount === 1 ? "" : "s"}
                · ${pieceCount} printed piece${pieceCount === 1 ? "" : "s"}
              </p>
            </div>
            <span>${combinations.length} combination${combinations.length === 1 ? "" : "s"}</span>
          </summary>

          <div class="inventory-cap-combinations">
            ${combinations.map(([letterName, rows]) => {
              const combinationPieces = rows.reduce(
                (sum, row) => sum + row.qty,
                0
              );

              return `
                <details
                  class="inventory-combination-group"
                  data-collapse-key="${encodeURIComponent(`keycap-${capName}-${letterName}`)}"
                >
                  <summary>
                    <div>
                      <strong>
                        ${escapeAdminHtml(capName)} Cap +
                        ${escapeAdminHtml(letterName)} Letter/Icon
                      </strong>
                      <small>
                        ${rows.length} character type${rows.length === 1 ? "" : "s"}
                      </small>
                    </div>
                    <span>${combinationPieces} piece${combinationPieces === 1 ? "" : "s"}</span>
                  </summary>

                  <div class="inventory-group-body">
                    ${renderStockRows(rows)}
                  </div>
                </details>
              `;
            }).join("")}
          </div>
        </details>
      `;
    })
    .join("");

  ordersContainer.innerHTML = `
    <div class="inventory-workspace">
      <div class="inventory-overview">
        <div>
          <span>Normal Stock</span>
          <strong>${normalTotal}</strong>
          <small>Ready for customer orders</small>
        </div>

        <div class="clearance-overview">
          <span>Clearance / Seconds</span>
          <strong>${clearanceTotal}</strong>
          <small>Kept separate from normal stock</small>
        </div>
      </div>

      ${section(
        "hardware",
        "Hardware & packaging",
        "Hardware, NFC labels, gifting bags and delivery packaging.",
        hardwareRows,
        true
      )}

      ${baseShapeInventoryGroups.map(group => section(
        `base-${group.key}`,
        group.title,
        group.description,
        group.rows,
        true
      )).join("")}

      ${keycapSections ||
        section(
          "keycap-empty",
          "Printed Keycaps",
          "Finished keycaps grouped by cap colour.",
          []
        )
      }

      ${otherRows.length
        ? section(
            "other",
            "Other Stock",
            "Inventory entries that do not match the standard groups.",
            otherRows
          )
        : ""
      }

      <details
        class="inventory-group clearance-inventory-group"
        data-collapse-key="clearance"
        open
      >
        <summary>
          <div>
            <h3>Clearance / Seconds</h3>
            <p>Usable rejected prints that are not counted towards customer orders.</p>
          </div>
          <span>${clearanceTotal} piece${clearanceTotal === 1 ? "" : "s"}</span>
        </summary>

        <div class="inventory-group-body">
          ${clearanceRows || `<p class="inventory-empty">No clearance pieces saved yet.</p>`}
        </div>
      </details>
    </div>
  `;

  bindPersistentDetails("inventory");
}

async function renderProductionPlanner(orders) {
  await Promise.all([
    loadInventoryItems(),
    loadProductionJobs()
  ]);

  const selectedScopeActive = productionOrderSelection.size > 0;
  const planningOrders = selectedScopeActive
    ? orders.filter(order => productionOrderSelection.has(String(order.id)))
    : orders;
  const { baseTotals, keycapGroups, count } = getProductionSummary(
    planningOrders,
    selectedScopeActive
  );
  const { keycapGroups: allKeycapOwnershipGroups } = getProductionSummary(
    orders,
    true
  );
  const timeEstimateOrders = planningOrders.filter(order =>
    !order.archived_at &&
    (
      selectedScopeActive
        ? !["Completed", "Refunded", "Payment Expired"].includes(order.status)
        : ["Payment Verified", "Printing"].includes(order.status)
    )
  );
  const estimatedKeychainCount = timeEstimateOrders.reduce(
    (sum, order) => sum + (order.order_data || []).filter(
      item => !item.assembly_completed
    ).length,
    0
  );
  const onlinePrinterCount = printers.filter(
    printer => printer.status === "online"
  ).length;
  const productionTimingPolicy = getBulkApprovalPolicy(
    Math.max(1, estimatedKeychainCount)
  );
  const productionTimelineOrders = getProductionTimelineOrders(
    planningOrders,
    selectedScopeActive
  );

  const baseRows = Object.values(baseTotals)
    .map(item => {
      const baseShape = item.baseShape || "ribbed";

      const itemName = getBaseInventoryName(
        item.name,
        baseShape
      );
      const need = item.qty;
      const stock = getInventoryQty(itemName);
      const tracked = getTrackedProductionQuantity(
        productionJobs,
        itemName
      );
      const toPrint = calculateQueuedProductionQuantity(
        need,
        stock,
        tracked
      );

      return { ...item, itemName, need, stock, tracked, toPrint };
    })
    .filter(item => item.toPrint > 0);

  const baseColourGroups = Array.from(
    baseRows.reduce((groups, item) => {
      const key = String(item.name || "Other").trim().toLowerCase();
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: `${item.name} Bases`,
          baseName: item.name,
          hex: item.hex,
          rows: []
        });
      }
      groups.get(key).rows.push(item);
      return groups;
    }, new Map()).values()
  )
    .map(group => ({
      ...group,
      rows: group.rows.sort((a, b) =>
        String(a.baseShape || "ribbed").localeCompare(String(b.baseShape || "ribbed"))
      )
    }))
    .sort((a, b) => String(a.baseName).localeCompare(String(b.baseName)));

  productionStlJobs.clear();
  productionBaseStlJobs.clear();

  baseColourGroups.forEach((group, index) => {
    const stlJobId = `base-colour-${index}`;
    group.stlJobId = stlJobId;

    productionBaseStlJobs.set(stlJobId, {
      baseName: group.baseName,
      components: group.rows.map(item => ({
        itemName: item.itemName,
        baseShape: item.baseShape || "ribbed",
        toPrint: item.toPrint,
        inputId: `printQty-${encodeURIComponent(item.itemName)}`
      }))
    });
  });
  currentBaseColourPlan = baseColourGroups;
  currentBaseBatchPlan = baseRows.map(item => ({
    itemName: item.itemName,
    category: "Base",
    quantity: item.toPrint,
    baseName: item.name,
    baseShape: item.baseShape || "ribbed",
    stlJobId: baseColourGroups.find(group => group.rows.includes(item))?.stlJobId
  }));

  const keycapCombinationCards = Object.entries(keycapGroups).map(([groupKey, group], groupIndex) => {
    const allRows = Object.entries(group.letters)
      .sort((a, b) => b[1] - a[1])
      .map(([letter, qty]) => {
        const itemName = getKeycapInventoryName(
          group.capName,
          group.letterName,
          letter
        );
        const need = qty;
        const stock = getInventoryQty(itemName);
        const tracked = getTrackedProductionQuantity(
          productionJobs,
          itemName
        );
        const toPrint = calculateQueuedProductionQuantity(
          need,
          stock,
          tracked
        );

        return { letter, itemName, need, stock, tracked, toPrint };
      });

    const rows = allRows.filter(row => row.toPrint > 0);
    const printOwners = assignPrintedKeycapsToOwners(
      group.owners || [],
      rows
    );
    const totalNeeded = allRows.reduce((sum, row) => sum + row.need, 0);
    const totalReady = allRows.reduce(
      (sum, row) => sum + Math.min(row.stock, row.need),
      0
    );
    const totalLeft = Math.max(0, totalNeeded - totalReady);
    const progressPercent = totalNeeded
      ? Math.round((totalReady / totalNeeded) * 100)
      : 100;

    if (!rows.length) return null;

    const stlJobId = `keycap-combination-${groupIndex}`;

    productionStlJobs.set(stlJobId, {
      capName: group.capName,
      letterName: group.letterName,
      fileName: `${group.capName}-cap_${group.letterName}-letter`,
      owners: printOwners,
      rows: rows.map(row => ({
        letter: row.letter,
        itemName: row.itemName,
        toPrint: row.toPrint,
        inputId: `printQty-${encodeURIComponent(row.itemName)}`,
        capName: group.capName,
        letterName: group.letterName
      }))
    });

    return {
      capName: group.capName,
      capHex: group.capHex,
      letterName: group.letterName,
      letterHex: group.letterHex,
      stlJobId,
      owners: printOwners,
      rows: rows.map(row => ({
        letter: row.letter,
        itemName: row.itemName,
        toPrint: row.toPrint,
        inputId: `printQty-${encodeURIComponent(row.itemName)}`,
        capName: group.capName,
        letterName: group.letterName
      })),
      html: `
      <details
        class="print-group"
        data-collapse-key="${encodeURIComponent(`keycap-${group.capName}-${group.letterName}`)}"
        open
      >
        <summary>
          <div class="group-summary">
            <div
              class="sample-keycap"
              style="background:${group.capHex}; color:${group.letterHex};"
            >
              A
            </div>

            <div>
              <h4>${group.capName} Cap + ${group.letterName} Letter</h4>
              <p class="hint">
                Letter direction is handled later during assembly.
              </p>
              <p style="margin-bottom:7px;">
                <strong>${totalReady} / ${totalNeeded} ready</strong>
                · ${totalLeft} left
              </p>

              <div
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="${totalNeeded}"
                aria-valuenow="${totalReady}"
                style="
                  width:min(260px, 100%);
                  height:9px;
                  overflow:hidden;
                  border-radius:999px;
                  background:#f3e3ea;
                "
              >
                <div style="
                  width:${progressPercent}%;
                  height:100%;
                  border-radius:inherit;
                  background:linear-gradient(90deg, #ff78a8, #ff4f91);
                  transition:width 0.25s ease;
                "></div>
              </div>

            </div>
          </div>
        </summary>

        ${rows.map(row => `
          <div class="print-check-row">
            <span class="letter-chip">${displayIcon(row.letter)}</span>

            <div style="flex:1;">
              <strong>${displayIcon(row.letter)}</strong>
              <p class="hint">
                Need: ${row.need} · Stock: ${row.stock}
                ${row.tracked ? ` · Tracked: ${row.tracked}` : ""}
                · To Print: ${row.toPrint}
              </p>
            </div>

            <div class="print-qty-control">
              <input
                type="number"
                min="0"
                value="${row.toPrint}"
                id="printQty-${encodeURIComponent(row.itemName)}"
              >

              <button
                class="ready-btn"
                ${productionJobsLoadFailed ? "disabled" : ""}
                onclick='window.startProductionJob(
                  ${JSON.stringify(row.itemName)},
                  document.getElementById(${JSON.stringify(`printQty-${encodeURIComponent(row.itemName)}`)}).value,
                  "Keycap"
                )'
              >
                Start Printing
              </button>
            </div>
          </div>
        `).join("")}

        <div style="padding:14px 0 4px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <button
            type="button"
            class="ready-btn"
            onclick="window.generateKeycapCombinationStl('${stlJobId}', this)"
          >
            Download This Combination
          </button>

          <span class="hint">
            Only ${group.capName} caps with ${group.letterName} letters.
          </span>
        </div>
      </details>
    `
    };
  }).filter(Boolean);

  productionAmsPlateJobs.clear();
  const validBasePrinter = printers.find(printer =>
    printer.status === "online" &&
    String(printer.id) === String(amsBaseReservation.printerId)
  );
  const activeBusyColours = validBasePrinter
    ? amsBaseReservation.colourNames
    : [];
  const {
    ready: freeColourCombinations,
    waiting: waitingForBusyColours
  } = partitionAmsCombinationsByBusyColours(
    keycapCombinationCards,
    activeBusyColours
  );
  const amsLitePlates = planAmsLiteKeycapPlates(
    freeColourCombinations
  );
  const onlinePrinters = printers.filter(printer => printer.status === "online");
  const freeAmsPrinters = getFreeAmsPrinters(
    printers,
    validBasePrinter?.id
  );
  const amsPrinterLanes = freeAmsPrinters.length
    ? distributeAmsPlatesAcrossPrinters(amsLitePlates, freeAmsPrinters)
    : [];
  const scheduledAmsPlates = amsPrinterLanes.flatMap(
    (lane, laneIndex) => lane.plates.map((plate, lanePlateIndex) => ({
      ...plate,
      assignedPrinterId: lane.printer.id,
      assignedPrinterName: lane.printer.name,
      laneIndex,
      lanePlateIndex
    }))
  );
  const amsWaveCount = scheduledAmsPlates.length
    ? Math.max(...scheduledAmsPlates.map(plate => plate.waveIndex)) + 1
    : 0;
  const amsWaves = Array.from(
    { length: amsWaveCount },
    (_, waveIndex) => ({
      waveIndex,
      lanes: amsPrinterLanes.map((lane, laneIndex) => ({
        lane,
        plate: scheduledAmsPlates.find(
          candidate =>
            candidate.laneIndex === laneIndex &&
            candidate.waveIndex === waveIndex
        )
      }))
    })
  );
  const totalAmsSpoolChanges = amsPrinterLanes.reduce(
    (sum, lane) => sum + Number(lane.spoolChanges || 0),
    0
  );

  const amsLitePlanner = keycapCombinationCards.length
    ? `
      <section class="ams-lite-planner">
        <div class="ams-lite-planner-heading">
          <div>
            <span class="optimized-plate-icon" aria-hidden="true">4</span>
            <div>
              <h3>AMS Lite Plate Suggestions</h3>
              <p>
                Reserve one A1 for bases when needed. The remaining keycap
                combinations are rebuilt using only filament colours that are free.
              </p>
            </div>
          </div>
          <div class="ams-change-total">
            <strong>${scheduledAmsPlates.length} plate${scheduledAmsPlates.length === 1 ? "" : "s"} · ${amsPrinterLanes.length} printer lane${amsPrinterLanes.length === 1 ? "" : "s"}</strong>
            <span>${totalAmsSpoolChanges} spool change${totalAmsSpoolChanges === 1 ? "" : "s"} after each printer’s setup</span>
          </div>
        </div>

        <section class="ams-free-colour-control">
          <header>
            <div>
              <span>Base printer reservation</span>
              <h4>Which colours are busy printing bases?</h4>
              <p>Select the A1 running bases, then tick only the spools you do not have a duplicate of.</p>
            </div>
            ${validBasePrinter ? `
              <button type="button" onclick="window.clearAmsBaseReservation()">
                Clear reservation
              </button>
            ` : ""}
          </header>

          <label class="ams-base-printer-select">
            <span>Printer running bases</span>
            <select id="amsBasePrinter" onchange="window.updateAmsBaseReservation()">
              <option value="">Neither — use both A1s for keycaps</option>
              ${onlinePrinters.map(printer => `
                <option
                  value="${escapeAdminHtml(String(printer.id))}"
                  ${String(validBasePrinter?.id || "") === String(printer.id) ? "selected" : ""}
                >
                  ${escapeAdminHtml(printer.name)}
                </option>
              `).join("")}
            </select>
          </label>

          <div class="ams-busy-colour-options ${validBasePrinter ? "" : "is-disabled"}">
            ${ADMIN_COLOUR_OPTIONS.map(colour => `
              <label>
                <input
                  type="checkbox"
                  name="amsBaseBusyColour"
                  value="${escapeAdminHtml(colour.name)}"
                  ${activeBusyColours.some(name => String(name).toLowerCase() === colour.name.toLowerCase()) ? "checked" : ""}
                  ${validBasePrinter ? "" : "disabled"}
                  onchange="window.updateAmsBaseReservation()"
                >
                <i style="background:${colour.hex}"></i>
                <span>${escapeAdminHtml(colour.name)}</span>
              </label>
            `).join("")}
          </div>

          <footer>
            ${validBasePrinter ? `
              <strong>${escapeAdminHtml(validBasePrinter.name)} is reserved for bases.</strong>
              <span>
                ${activeBusyColours.length
                  ? `${activeBusyColours.length} non-duplicate colour${activeBusyColours.length === 1 ? " is" : "s are"} temporarily unavailable.`
                  : "No shared colours are blocked; keycaps may use every filament colour on the other A1."
                }
              </span>
            ` : `
              <strong>Both A1s are available for keycaps.</strong>
              <span>No base-printer colours are reserved.</span>
            `}
          </footer>
        </section>

        ${scheduledAmsPlates.length ? `<div class="ams-mum-mode">
          <span aria-hidden="true">♡</span>
          <div>
            <strong>Simple handover mode</strong>
            <p>Start both plates in each wave together. Complete Wave 1 before Wave 2; only touch slots marked “SWAP”.</p>
          </div>
        </div>` : `
          <div class="ams-printer-fallback-warning">
            ${freeColourCombinations.length
              ? "No online A1 is currently free for keycaps. Clear the base reservation or mark another printer online."
              : "Every remaining keycap combination is waiting for a busy base colour. Untick a colour when that spool becomes free."
            }
          </div>
        `}

        ${printers.length > 1 && onlinePrinters.length < 2 ? `
          <div class="ams-printer-fallback-warning">
            Two-printer split is paused because only ${onlinePrinters.length || "no"} printer${onlinePrinters.length === 1 ? " is" : "s are"} marked online.
            Mark both printers online above to balance plates across two lanes.
          </div>
        ` : ""}

        ${amsPrinterLanes.length ? `<div class="ams-printer-lane-summary">
          ${amsPrinterLanes.map(lane => `
            <article>
              <span class="printer-dot"></span>
              <div>
                <strong>${escapeAdminHtml(lane.printer.name)}</strong>
                <small>${lane.plates.length} plate${lane.plates.length === 1 ? "" : "s"} · ${lane.pieceCount} keycaps · ${lane.spoolChanges} later swap${lane.spoolChanges === 1 ? "" : "s"}</small>
              </div>
            </article>
          `).join("")}
        </div>` : ""}

        ${amsWaves.length ? `<section class="ams-safe-waves">
          <header>
            <div>
              <strong>Two-printer print waves</strong>
              <p>Start both listed plates together. The same colours may run on both printers because each A1 has its own filament supply.</p>
            </div>
            <span>${amsWaveCount} wave${amsWaveCount === 1 ? "" : "s"}</span>
          </header>

          <div class="ams-wave-grid">
            ${amsWaves.map(wave => `
              <article class="ams-wave-row">
                <b>Wave ${wave.waveIndex + 1}</b>
                ${wave.lanes.map(({ lane, plate }) => plate ? `
                  <div class="ams-wave-run">
                    <strong>${escapeAdminHtml(lane.printer.name)}</strong>
                    <span>
                      Plate ${plate.lanePlateIndex + 1} ·
                      ${Array.from(plate.colours.values())
                        .map(colour => escapeAdminHtml(colour.name))
                        .join(", ")}
                    </span>
                  </div>
                ` : `
                  <div class="ams-wave-wait">
                    <strong>${escapeAdminHtml(lane.printer.name)}</strong>
                    <span>DONE — no more plates assigned</span>
                  </div>
                `).join("")}
              </article>
            `).join("")}
          </div>
        </section>` : ""}

        ${scheduledAmsPlates.length ? `<div class="ams-batch-start-bar">
          <div>
            <strong>Send several colour combinations together</strong>
            <span>Tick the combinations below. You will stay on this page after sending them.</span>
          </div>
          <button
            id="startSelectedAmsCombinations"
            type="button"
            class="ready-btn"
            disabled
            onclick="window.startSelectedKeycapCombinations(this)"
          >
            Start Selected (<span id="selectedAmsCombinationCount">0</span>)
          </button>
        </div>` : ""}

        ${scheduledAmsPlates.length ? `<div class="ams-lite-plate-grid">
          ${scheduledAmsPlates.map((plate, plateIndex) => {
            const plateId = `ams-lite-plate-${plateIndex}`;
            const colours = Array.from(plate.colours.values());
            const overSuggestedSize = plate.pieceCount > 56;

            productionAmsPlateJobs.set(plateId, {
              combinationJobIds: plate.combinations.map(
                combination => combination.stlJobId
              ),
              items: plate.combinations.flatMap(combination =>
                combination.rows.map(row => ({
                  itemName: row.itemName,
                  inputId: row.inputId,
                  toPrint: row.toPrint
                }))
              ),
              printerId: plate.assignedPrinterId,
              printerName: plate.assignedPrinterName,
              colourNames: colours.map(colour => colour.name),
              waveIndex: plate.waveIndex
            });

            return `
              <article
                class="ams-lite-plate-card"
                style="grid-column:${plate.laneIndex + 1};grid-row:${plate.waveIndex + 1};"
              >
                <div class="ams-lite-plate-title">
                  <div>
                    <span>${escapeAdminHtml(plate.assignedPrinterName)} · Plate ${plate.lanePlateIndex + 1}</span>
                    <strong>${plate.pieceCount} keycap${plate.pieceCount === 1 ? "" : "s"}</strong>
                  </div>
                  <b>Wave ${plate.waveIndex + 1} · ${colours.length} / 4 AMS slots</b>
                </div>

                <div class="ams-lite-colours">
                  ${colours.map(colour => `
                    <span>
                      <i style="background:${colour.hex};"></i>
                      ${escapeAdminHtml(colour.name)}
                    </span>
                  `).join("")}
                </div>

                <div class="ams-change-instruction ${plate.changeCount ? "has-changes" : "no-changes"}">
                  <strong>
                    ${plate.lanePlateIndex === 0
                      ? "Initial AMS setup"
                      : plate.changeCount
                        ? `${plate.changeCount} spool change${plate.changeCount === 1 ? "" : "s"}`
                        : "No spool changes"
                    }
                  </strong>
                  <span>
                    ${plate.lanePlateIndex === 0
                      ? "Load these colours once before starting."
                      : plate.changeCount
                        ? "Change only the purple SWAP slots below."
                        : "Leave every loaded spool exactly where it is."
                    }
                  </span>
                </div>

                <div class="ams-slot-guide">
                  ${plate.slotAssignments
                    .filter(assignment => assignment.colour)
                    .map(assignment => `
                      <article class="ams-slot-row action-${assignment.action}">
                        <b>Slot ${assignment.slot}</b>
                        <i style="background:${getSafePdfColour(assignment.colour.hex, "#d9d9d9")}"></i>
                        <div>
                          <strong>${escapeAdminHtml(assignment.colour.name)}</strong>
                          <small>
                            ${plate.lanePlateIndex === 0
                              ? "LOAD for first plate"
                              : assignment.action === "keep"
                                ? "KEEP — do not touch"
                                : assignment.previousColour
                                  ? `SWAP out ${escapeAdminHtml(assignment.previousColour.name)}`
                                  : "LOAD into empty slot"
                            }
                          </small>
                        </div>
                      </article>
                    `).join("")}
                </div>

                <div class="ams-lite-combinations">
                  ${plate.combinations.map(combination => `
                    <div class="ams-lite-combination-row">
                      <label class="ams-combination-picker" title="Select this combination for a batch start">
                        <input
                          type="checkbox"
                          class="ams-combination-select"
                          value="${escapeAdminHtml(combination.stlJobId)}"
                          data-printer-id="${escapeAdminHtml(String(plate.assignedPrinterId || ""))}"
                          data-plate-id="${escapeAdminHtml(plateId)}"
                          onchange="window.updateAmsCombinationSelection()"
                        >
                        <span>Select</span>
                      </label>
                      <span class="ams-combination-preview">
                        <i style="background:${combination.capHex};"></i>
                        <i style="background:${combination.letterHex};"></i>
                      </span>

                      <div>
                        <strong>
                          ${escapeAdminHtml(combination.capName)} cap +
                          ${escapeAdminHtml(combination.letterName)} letter
                        </strong>
                        <small>
                          ${combination.pieceCount} piece${combination.pieceCount === 1 ? "" : "s"}
                        </small>
                      </div>

                      <div class="ams-combination-actions">
                        <button
                          type="button"
                          class="stl-download-btn"
                          onclick="window.generateKeycapCombinationStl('${combination.stlJobId}', this)"
                        >
                          STL
                        </button>
                        <button
                          type="button"
                          class="ams-combination-start-btn"
                          ${productionJobsLoadFailed ? "disabled" : ""}
                          onclick='window.startKeycapCombination(
                            ${JSON.stringify(combination.stlJobId)},
                            this,
                            ${JSON.stringify(plate.assignedPrinterId)}
                          )'
                        >
                          Start Printing
                        </button>
                      </div>

                    </div>
                  `).join("")}
                </div>

                ${overSuggestedSize ? `
                  <p class="ams-plate-warning">
                    This group may be too crowded for one Bambu A1 plate.
                    Download the exact combinations separately if needed.
                  </p>
                ` : ""}

                <div class="ams-plate-actions">
                  <button
                    type="button"
                    class="ready-btn ams-download-all-btn"
                    onclick="window.downloadAmsLitePlateStls('${plateId}', this)"
                  >
                    Download ${plate.combinations.length} Plate STL${plate.combinations.length === 1 ? "" : "s"}
                  </button>

                  <button
                    type="button"
                    class="ready-btn ams-start-printing-btn"
                    ${productionJobsLoadFailed ? "disabled" : ""}
                    onclick="window.startAmsLitePlate('${plateId}', this)"
                  >
                    Start on ${escapeAdminHtml(plate.assignedPrinterName)}
                  </button>
                </div>
              </article>
            `;
          }).join("")}
        </div>` : ""}

        ${waitingForBusyColours.length ? `
          <section class="ams-waiting-queue">
            <header>
              <div>
                <span>Waiting for filament</span>
                <h4>${waitingForBusyColours.length} combination${waitingForBusyColours.length === 1 ? "" : "s"} paused</h4>
              </div>
              <strong>Returns automatically when you untick the busy colour</strong>
            </header>
            <div>
              ${waitingForBusyColours.map(combination => `
                <article>
                  <span class="ams-combination-preview">
                    <i style="background:${combination.capHex};"></i>
                    <i style="background:${combination.letterHex};"></i>
                  </span>
                  <div>
                    <strong>${escapeAdminHtml(combination.capName)} cap + ${escapeAdminHtml(combination.letterName)} letter</strong>
                    <small>${combination.rows.reduce((sum, row) => sum + Number(row.toPrint || 0), 0)} piece${combination.rows.reduce((sum, row) => sum + Number(row.toPrint || 0), 0) === 1 ? "" : "s"} · waiting for ${combination.busyColours.map(escapeAdminHtml).join(" + ")}</small>
                  </div>
                  <button type="button" onclick="window.generateKeycapCombinationStl('${combination.stlJobId}', this)">STL</button>
                </article>
              `).join("")}
            </div>
          </section>
        ` : ""}

        <p class="optimized-plate-note">
          Load the listed colours into your AMS Lite, import the downloaded
          STL files onto the same Bambu plate and assign the matching cap and
          letter colours. Your browser may ask permission for multiple downloads.
        </p>
      </section>
    `
    : "";

  const productionTimelineBuckets = [
    {
      key: "overdue",
      label: "Overdue",
      note: "Handle these first",
      matches: entry => entry.daysUntil !== null && entry.daysUntil < 0
    },
    {
      key: "today",
      label: "Today",
      note: "Due today",
      matches: entry => entry.daysUntil === 0
    },
    {
      key: "next",
      label: "Next 3 days",
      note: "Print next",
      matches: entry => entry.daysUntil !== null && entry.daysUntil >= 1 && entry.daysUntil <= 3
    },
    {
      key: "week",
      label: "Later this week",
      note: "Prepare after urgent work",
      matches: entry => entry.daysUntil !== null && entry.daysUntil >= 4 && entry.daysUntil <= 7
    },
    {
      key: "later",
      label: "Later",
      note: "Upcoming orders",
      matches: entry => entry.daysUntil === null || entry.daysUntil > 7
    }
  ];

  const productionTimelinePanel = `
    <section class="production-timeline">
      <div class="production-timeline-heading">
        <div>
          <p>What to work on first</p>
          <h3>Production Timeline</h3>
        </div>
        <strong>${productionTimelineOrders.length} active order${productionTimelineOrders.length === 1 ? "" : "s"}</strong>
      </div>

      <div class="production-timeline-lanes">
        ${productionTimelineBuckets.map(bucket => {
          const entries = productionTimelineOrders.filter(bucket.matches);

          return `
            <details
              class="production-timeline-lane timeline-${bucket.key}"
              data-collapse-key="timeline-${bucket.key}"
              ${entries.length ? "open" : ""}
            >
              <summary>
                <div>
                  <span>${bucket.label}</span>
                  <small>${bucket.note}</small>
                </div>
                <b>${entries.length}</b>
              </summary>

              <div class="production-timeline-list">
                ${entries.map((entry, index) => {
                  const order = entry.order;
                  const customerName =
                    order.customer_name ||
                    order.name ||
                    "Customer";
                  const keychainNames = (order.order_data || [])
                    .filter(item => !item.assembly_completed)
                    .map(item => item.name || item.clean_name)
                    .filter(Boolean);
                  const readyParts = Math.max(
                    0,
                    entry.totalParts - entry.totalMissing
                  );
                  const progress = entry.totalParts
                    ? Math.round((readyParts / entry.totalParts) * 100)
                    : 100;
                  const dueLabel = entry.daysUntil === null
                    ? "No date set"
                    : getUrgentPrintLabel(entry.daysUntil);
                  const remainingPrintGroups = getRushOrderPrintGroups(
                    order,
                    entry.missingParts
                  );
                  const orderAmsPlates = getOrderAmsLitePlatePlan(
                    remainingPrintGroups
                  );

                  return `
                    <article class="production-timeline-order ${entry.daysUntil !== null && entry.daysUntil <= 1 ? "is-critical" : ""}">
                      <div class="timeline-order-position">${index + 1}</div>

                      <div class="timeline-order-copy">
                        <div class="timeline-order-title">
                          <div>
                            <strong>${escapeAdminHtml(order.order_ref || "No reference")}</strong>
                            <span>${escapeAdminHtml(customerName)}</span>
                          </div>
                          <b>${escapeAdminHtml(dueLabel)}</b>
                        </div>

                        <p>
                          ${escapeAdminHtml(keychainNames.join(", ") || "Personalised keychain")}
                          ${entry.dueDate ? ` · Ready by ${escapeAdminHtml(formatDate(entry.dueDate))}` : ""}
                        </p>
                        ${renderOrderAlerts(order, true)}
                        ${renderProductionNote(order, true)}

                        <div class="timeline-progress-row">
                          <div class="timeline-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}">
                            <span style="width:${progress}%"></span>
                          </div>
                          <strong>
                            ${entry.totalMissing
                              ? `${entry.totalMissing} part${entry.totalMissing === 1 ? "" : "s"} to print`
                              : "Printed parts ready"}
                          </strong>
                        </div>

                        ${remainingPrintGroups.bases.length ? `
                          <section class="timeline-base-plan">
                            <header>
                              <span>Bases to print</span>
                              <b>
                                ${remainingPrintGroups.bases.reduce(
                                  (sum, group) => sum + group.quantity,
                                  0
                                )} total
                              </b>
                            </header>

                            <div class="timeline-base-rows">
                              ${remainingPrintGroups.bases.map(group => `
                                <div>
                                  <i style="background:${getSafePdfColour(group.baseHex, "#f6a9c2")}"></i>
                                  <span>
                                    <strong>${escapeAdminHtml(group.baseName)}</strong>
                                    ${group.baseShape === "bubbly" ? "Bubbly" : "Ribbed"} base
                                  </span>
                                  <b>× ${group.quantity}</b>
                                </div>
                              `).join("")}
                            </div>
                          </section>
                        ` : ""}

                        ${orderAmsPlates.length ? `
                          <details class="timeline-ams-plan">
                            <summary>
                              <span>AMS Lite suggestion</span>
                              <b>${orderAmsPlates.length} plate${orderAmsPlates.length === 1 ? "" : "s"}</b>
                            </summary>

                            <div class="timeline-ams-plates">
                              ${orderAmsPlates.map((plate, plateIndex) => {
                                const colours = Array.from(
                                  plate.colours.values()
                                );

                                return `
                                  <article class="timeline-ams-plate">
                                    <header>
                                      <strong>Plate ${plateIndex + 1}</strong>
                                      <span>${plate.pieceCount} keycap${plate.pieceCount === 1 ? "" : "s"} · ${colours.length}/4 slots</span>
                                    </header>

                                    <div class="timeline-ams-colours">
                                      ${colours.map(colour => `
                                        <span>
                                          <i style="background:${getSafePdfColour(colour.hex, "#d9d9d9")}"></i>
                                          ${escapeAdminHtml(colour.name)}
                                        </span>
                                      `).join("")}
                                    </div>

                                    <p>
                                      ${plate.combinations.map(combination =>
                                        `${escapeAdminHtml(combination.capName)} cap + ` +
                                        `${escapeAdminHtml(combination.letterName)} letter ` +
                                        `(${combination.pieceCount})`
                                      ).join(" · ")}
                                    </p>

                                    <button
                                      type="button"
                                      class="timeline-ams-generate"
                                      onclick='window.generateTimelineAmsPlateStls(
                                        ${JSON.stringify(String(order.id))},
                                        ${plateIndex},
                                        this
                                      )'
                                    >
                                      Generate Plate ${plateIndex + 1} STLs
                                    </button>
                                  </article>
                                `;
                              }).join("")}
                            </div>
                          </details>
                        ` : ""}
                      </div>

                      <div class="timeline-order-actions">
                        ${entry.totalMissing ? `
                          <button
                            type="button"
                            onclick='window.generateOrderStls(${JSON.stringify(String(order.id))}, this)'
                          >
                            Generate STLs
                          </button>
                        ` : ""}
                        <button
                          type="button"
                          class="timeline-view-order"
                          onclick='window.focusOrder(${JSON.stringify(String(order.id))})'
                        >
                          View Order
                        </button>
                      </div>
                    </article>
                  `;
                }).join("") || `
                  <p class="timeline-empty">No orders here.</p>
                `}
              </div>
            </details>
          `;
        }).join("")}
      </div>
    </section>
  `;

  const printingJobs = productionJobs.filter(
    job => job.stage === "printing"
  );
  const pickedJobs = productionJobs.filter(
    job => job.stage === "picked"
  );
  const baseQueuedPieces = baseRows.reduce(
    (sum, item) => sum + item.toPrint,
    0
  );
  const keycapQueuedPieces = keycapCombinationCards.reduce(
    (sum, card) =>
      sum + card.rows.reduce(
        (rowSum, row) => rowSum + row.toPrint,
        0
      ),
    0
  );
  const queuedPieces = baseQueuedPieces + keycapQueuedPieces;
  const productionTimeEstimate = calculateProductionTimeEstimate(
    baseQueuedPieces,
    keycapQueuedPieces,
    onlinePrinterCount
  );
  const selectedBatchPanel = selectedScopeActive ? `
    <section class="selected-production-batch">
      <header>
        <div>
          <span>Combined print plan</span>
          <h3>Selected Orders Batch</h3>
          <p>
            Review the selected orders, print every base group in bulk, then
            run all remaining keycaps through the shared AMS Lite suggestions.
          </p>
        </div>
        <strong>${queuedPieces} total pieces</strong>
      </header>

      <section class="batch-plan-step">
        <div class="batch-step-number">1</div>
        <div class="batch-step-content">
          <header>
            <div>
              <h4>Bulk Base Printing</h4>
              <p>
                All ${planningOrders.length} selected orders are combined here.
                Bases are grouped by colour; Ribbed and Bubbly share the same colour plate.
              </p>
            </div>
            <strong>${baseQueuedPieces} bases</strong>
          </header>

          <div class="batch-base-groups">
            ${currentBaseColourPlan.map(group => `
              <article>
                <span class="colour-dot" style="background:${getSafePdfColour(
                  group.hex,
                  "#d9d9d9"
                )}"></span>
                <div>
                  <strong>${escapeAdminHtml(group.label)}</strong>
                  <small>${group.rows.map(item =>
                    `${item.baseShape === "bubbly" ? "Bubbly" : "Ribbed"} × ${item.toPrint}`
                  ).join(" · ")} · one colour plate</small>
                </div>
                <b>× ${group.rows.reduce((sum, item) => sum + item.toPrint, 0)}</b>
                <button
                  type="button"
                  onclick="window.generateBaseColourStl('${group.stlJobId}', this)"
                >
                  STL
                </button>
              </article>
            `).join("") || `<p class="batch-complete-message">✓ All bases are already covered by stock or tracked prints.</p>`}
          </div>

          ${currentBaseColourPlan.length ? `
            <div class="batch-step-actions">
              <button type="button" onclick="window.downloadSelectedBaseBatchStls(this)">
                Download All Combined Base STLs
              </button>
              <button
                type="button"
                class="batch-start-action"
                ${productionJobsLoadFailed ? "disabled" : ""}
                onclick="window.startSelectedBaseBatch(this)"
              >
                Start All Base Groups
              </button>
            </div>
          ` : ""}
        </div>
      </section>

      <section class="batch-plan-step">
        <div class="batch-step-number">2</div>
        <div class="batch-step-content">
          <header>
            <div>
              <h4>All Keycaps · AMS Lite Suggestions</h4>
              <p>
                Keycaps from every selected order are combined, then arranged
                into suggestions using no more than four filament colours per plate.
              </p>
            </div>
            <strong>${keycapQueuedPieces} keycaps</strong>
          </header>
          ${amsLitePlanner || `<p class="batch-complete-message">✓ All keycaps are already covered by stock or tracked prints.</p>`}
        </div>
      </section>

      <footer>
        <button type="button" onclick="window.setProductionQueueView('timeline')">
          Review Selected Orders Again
        </button>
      </footer>
    </section>
  ` : "";

  const renderTrackedJobCards = (jobs, stage) => {
    const groupedJobs = new Map();

    jobs.forEach(job => {
      const isKeycap = job.category === "Keycap";
      const printer = printers.find(item =>
        String(item.id) === String(job.printer_id)
      );
      const startedAt = String(
        job.started_at || job.updated_at || `job-${job.id}`
      );
      const group = isKeycap
        ? {
            key: `10-keycap-plate-${String(job.printer_id || "unassigned")}-${startedAt}`,
            label: `${printer?.name || "Unassigned Printer"} · Keycap Plate`,
            category: "Keycap",
            startedAt,
            printerName: printer?.name || "Unassigned Printer"
          }
        : {
            ...getProductionJobGroup(job.item_name, job.category),
            category: job.category
          };

      if (!groupedJobs.has(group.key)) {
        groupedJobs.set(group.key, {
          ...group,
          jobs: []
        });
      }

      groupedJobs.get(group.key).jobs.push(job);
    });

    const groups = Array.from(groupedJobs.values())
      .sort((a, b) => {
        if (a.category === "Keycap" && b.category === "Keycap") {
          return String(b.startedAt).localeCompare(String(a.startedAt));
        }
        return a.key.localeCompare(b.key);
      });
    const pieceCount = jobs.reduce(
      (sum, job) => sum + Number(job.quantity || 0),
      0
    );

    return `
      <section class="production-stage-panel">
        <div class="production-stage-heading">
          <div>
            <p>${stage === "printing" ? "Currently on a printer" : "Finished printing"}</p>
            <h3>${stage === "printing" ? "Printing Now" : "Picked & Ready"}</h3>
          </div>
          <strong>
            ${pieceCount} piece${pieceCount === 1 ? "" : "s"}
          </strong>
        </div>

        ${jobs.length ? `
          <div class="production-selection-toolbar">
            <label>
              <input
                id="selectAllProductionJobs"
                type="checkbox"
                onchange="window.toggleAllProductionJobs(this.checked)"
              >
              <span>Select all</span>
            </label>

            <button
              id="productionBulkAction"
              type="button"
              data-stage="${stage}"
              disabled
              onclick="${
                stage === "printing"
                  ? "window.markSelectedProductionJobsPicked(this)"
                  : "window.addSelectedProductionJobsToInventory(this)"
              }"
            >
              ${stage === "printing"
                ? "Mark Selected as Picked"
                : "Add Selected to Inventory"
              }
            </button>
          </div>

          <div class="production-job-groups">
            ${groups.map(group => {
              const groupPieces = group.jobs.reduce(
                (sum, job) => sum + Number(job.quantity || 0),
                0
              );
              const combinationLabels = Array.from(new Set(
                group.jobs.map(job =>
                  String(job.item_name || "").split(" - ")[0]
                ).filter(Boolean)
              ));
              const plateOwnerMap = new Map();

              if (group.category === "Keycap") {
                combinationLabels.forEach(combinationLabel => {
                  const ownershipGroup = allKeycapOwnershipGroups[combinationLabel];
                  if (!ownershipGroup) return;

                  const quantitiesByCharacter = new Map();
                  group.jobs
                    .filter(job =>
                      String(job.item_name || "").split(" - ")[0] === combinationLabel
                    )
                    .forEach(job => {
                      const character = String(job.item_name || "").split(" - ").slice(1).join(" - ");
                      quantitiesByCharacter.set(
                        character,
                        (quantitiesByCharacter.get(character) || 0) + Number(job.quantity || 0)
                      );
                    });

                  const owners = assignPrintedKeycapsToOwners(
                    ownershipGroup.owners || [],
                    Array.from(quantitiesByCharacter, ([letter, toPrint]) => ({
                      letter,
                      toPrint
                    }))
                  );

                  owners.forEach(owner => {
                    const ownerKey = `${owner.orderId}:${owner.keychainName}`;
                    if (!plateOwnerMap.has(ownerKey)) {
                      plateOwnerMap.set(ownerKey, {
                        ...owner,
                        characters: []
                      });
                    }
                    plateOwnerMap.get(ownerKey).characters.push(...owner.characters);
                  });
                });
              }

              const plateOwners = Array.from(plateOwnerMap.values());

              return `
                <details class="production-job-group ${group.category === "Keycap" ? "is-keycap-plate" : ""}" open>
                  <summary class="production-job-group-heading">
                    <div>
                      <h4>${escapeAdminHtml(group.label)}</h4>
                      ${group.category === "Keycap" ? `
                        <small>
                          ${stage === "printing" ? "Started" : "Picked"} ${formatDateTime(group.startedAt)}
                          · ${combinationLabels.length} colour combination${combinationLabels.length === 1 ? "" : "s"}
                        </small>
                      ` : ""}
                    </div>
                    <span>
                      ${groupPieces} piece${groupPieces === 1 ? "" : "s"}
                    </span>
                  </summary>

                  ${group.category === "Keycap" ? `
                    <div class="production-plate-actions">
                      <button
                        type="button"
                        onclick='event.stopPropagation(); ${stage === "printing"
                          ? `window.markProductionPlatePicked(${JSON.stringify(group.jobs.map(job => String(job.id)))}, this)`
                          : `window.completeProductionPlate(${JSON.stringify(group.jobs.map(job => String(job.id)))}, this)`
                        }'
                      >
                        ${stage === "printing" ? "Mark Whole Plate Picked" : "Add Whole Plate to Inventory"}
                      </button>
                    </div>
                  ` : ""}

                  ${group.category === "Keycap" ? `
                    <div class="production-plate-combinations">
                      ${combinationLabels.map(label => `<span>${escapeAdminHtml(label)}</span>`).join("")}
                    </div>
                  ` : ""}

                  ${stage === "picked" && group.category === "Keycap" ? `
                    <details class="keycap-owner-guide picked-owner-guide">
                      <summary>Who this plate belongs to</summary>
                      <div>
                        ${plateOwners.map(owner => `
                          <p>
                            <strong>${escapeAdminHtml(owner.orderRef)} · ${escapeAdminHtml(owner.customerName)}</strong>
                            <span>${escapeAdminHtml(owner.keychainName)} — ${owner.characters.map(entry => displayIcon(entry.character)).join(", ")}</span>
                          </p>
                        `).join("") || `<p><span>No order ownership details found.</span></p>`}
                      </div>
                    </details>
                  ` : ""}

                  <div class="production-job-grid">
                    ${group.jobs.map(job => `
                      <article class="production-job-card stage-${stage} has-selection ${
                        ["failed", "reprint_needed"].includes(job.quality_status) ? "has-quality-issue" : ""
                      } ${
                        printers.some(printer => String(printer.id) === String(job.printer_id) && printer.status === "offline")
                          ? "needs-reassignment"
                          : ""
                      }">
                        <label
                          class="production-job-select"
                          title="Select ${escapeAdminHtml(job.item_name)}"
                        >
                          <input
                            type="checkbox"
                            value="${escapeAdminHtml(String(job.id))}"
                            data-production-job-select
                            aria-label="Select ${escapeAdminHtml(job.item_name)}"
                            onchange="window.syncProductionJobSelection()"
                          >
                        </label>

                        <div class="production-job-icon" aria-hidden="true">
                          ${job.category === "Base" ? "◯" : "A"}
                        </div>

                        <div class="production-job-copy">
                          <span>${escapeAdminHtml(job.category)}</span>
                          <h4>${escapeAdminHtml(job.item_name)}</h4>
                          <p>
                            ${stage === "printing" ? "Started" : "Picked"}
                            ${formatDateTime(
                              stage === "printing"
                                ? job.started_at
                                : job.picked_at || job.updated_at
                            )}
                          </p>
                        </div>

                        <strong class="production-job-quantity">
                          × ${Number(job.quantity || 0)}
                        </strong>

                        <div class="production-job-actions">
                          ${stage === "printing" ? `
                            <label class="job-printer-select">
                              <span>Printer</span>
                              <select onchange="window.assignProductionPrinter(${JSON.stringify(job.id)}, this.value)">
                                <option value="">Unassigned</option>
                                ${printers.map(printer => `
                                  <option value="${escapeAdminHtml(String(printer.id))}" ${String(job.printer_id || "") === String(printer.id) ? "selected" : ""}>
                                    ${escapeAdminHtml(printer.name)}${printer.status === "offline" ? " · OFFLINE" : ""}
                                  </option>
                                `).join("")}
                              </select>
                            </label>
                            ${printers.some(printer => String(printer.id) === String(job.printer_id) && printer.status === "offline")
                              ? `<strong class="reassignment-badge">Needs reassignment</strong>`
                              : ""}
                            ${["failed", "reprint_needed"].includes(job.quality_status)
                              ? `<strong class="quality-issue-badge">Quality issue · reprint needed</strong>`
                              : ""}
                            <button
                              type="button"
                              class="production-stage-secondary quality-action"
                              onclick="window.markProductionQualityIssue(${JSON.stringify(job.id)})"
                            >
                              Bad Print / Reprint
                            </button>
                          ` : ""}
                          ${stage === "printing" ? `
                            <button
                              type="button"
                              class="production-stage-primary"
                              onclick="window.updateProductionJobStage(${JSON.stringify(job.id)}, 'picked')"
                            >
                              Picked from Printer
                            </button>
                            <button
                              type="button"
                              class="production-stage-secondary"
                              onclick="window.cancelProductionJob(${JSON.stringify(job.id)})"
                            >
                              Back to To Print
                            </button>
                          ` : `
                            <button
                              type="button"
                              class="production-stage-primary inventory-action"
                              onclick="window.completeProductionJob(${JSON.stringify(job.id)})"
                            >
                              Add to Inventory
                            </button>
                            <button
                              type="button"
                              class="production-stage-secondary"
                              onclick="window.updateProductionJobStage(${JSON.stringify(job.id)}, 'printing')"
                            >
                              Back to Printing
                            </button>
                          `}
                        </div>
                      </article>
                    `).join("")}
                  </div>
                </details>
              `;
            }).join("")}
          </div>
        ` : `
          <div class="production-stage-empty">
            <span>${stage === "printing" ? "🖨️" : "📦"}</span>
            <h3>
              ${stage === "printing"
                ? "Nothing is marked as printing"
                : "No finished prints are waiting"
              }
            </h3>
            <p>
              ${stage === "printing"
                ? "Start an item from the To Print tab and it will stay here until you pick it."
                : "Use “Picked from Printer” when a print finishes, then add it to inventory here."
              }
            </p>
          </div>
        `}
      </section>
    `;
  };

  const trackedStagePanel = productionStageView === "printing"
    ? renderTrackedJobCards(printingJobs, "printing")
    : productionStageView === "picked"
      ? renderTrackedJobCards(pickedJobs, "picked")
      : "";

  ordersContainer.innerHTML = `
    <div class="production-card">
      <div class="production-header">
        <div>
          <h2>Production Planner ♡</h2>
          <p class="hint">Follow the timeline first, then batch the remaining prints by colour.</p>
        </div>

        <p class="active-count">${count} active order(s)</p>
      </div>

      ${productionJobsLoadFailed ? `
        <div class="production-workflow-setup" role="alert">
          Run <strong>supabase/production-workflow.sql</strong> once to
          enable persistent Printing and Picked tracking.
        </div>
      ` : ""}

      ${selectedScopeActive ? `
        <section class="production-selection-scope">
          <div>
            <span>Selected-order planning preview</span>
            <strong>${planningOrders.length} order${planningOrders.length === 1 ? "" : "s"}</strong>
            <p>
              ${planningOrders.map(order =>
                escapeAdminHtml(order.order_ref || order.customer_name || "Order")
              ).join(" · ")}
            </p>
          </div>
          <div>
            <small>
              Quantities and AMS suggestions below are limited to this batch.
              Nothing starts until you use a Start Printing action.
            </small>
            <button type="button" onclick="window.clearProductionOrderSelection()">
              Show All Active Orders
            </button>
          </div>
        </section>
      ` : ""}

      <section class="production-time-estimate">
        <header>
          <div>
            <p>Print-time calculator</p>
            <h3>${queuedPieces} queued piece${queuedPieces === 1 ? "" : "s"}</h3>
            <small>${baseQueuedPieces} bases · ${keycapQueuedPieces} keycaps</small>
          </div>
          <strong>${formatProductionMinutes(productionTimeEstimate.totalPrinterMinutes)} machine time</strong>
        </header>

        <div>
          <article>
            <span>Bases · 25 min each</span>
            <strong>${formatProductionMinutes(productionTimeEstimate.baseMinutes)}</strong>
          </article>
          <article>
            <span>Keycaps · 15 min each</span>
            <strong>${formatProductionMinutes(productionTimeEstimate.keycapMinutes)}</strong>
          </article>
          <article class="is-highlighted">
            <span>Estimated elapsed time</span>
            <strong>${formatProductionMinutes(productionTimeEstimate.estimatedElapsedMinutes)}</strong>
          </article>
        </div>

        <p>
          ${onlinePrinterCount >= 2
            ? `Assumes one printer runs bases while ${onlinePrinterCount - 1} printer${onlinePrinterCount - 1 === 1 ? "" : "s"} run keycaps.`
            : "Assumes sequential printing on one printer."
          }
          Based on the To Print quantities only; pieces already printing are tracked separately.
          Add setup, plate changes, failed prints, assembly and packing separately.
          ${productionTimingPolicy.approvalRequired
            ? `<br><strong>Suggested customer window: ${escapeAdminHtml(productionTimingPolicy.timeframeLabel)}.</strong>`
            : ""
          }
        </p>
      </section>

      <section class="printer-status-board">
        <header>
          <div><p>Capacity check</p><h3>Printers</h3></div>
          <span>${printers.filter(printer => printer.status === "online").length}/${printers.length || 0} online</span>
        </header>
        <div>
          ${printers.map(printer => {
            const affected = productionJobs.filter(job =>
              job.stage === "printing" && String(job.printer_id) === String(printer.id)
            ).length;
            return `
              <article class="${printer.status === "offline" ? "is-offline" : ""}">
                <span class="printer-dot"></span>
                <div>
                  <strong>${escapeAdminHtml(printer.name)}</strong>
                  <small>${printer.status === "offline" ? "OFFLINE" : "Online"} · ${affected} active job${affected === 1 ? "" : "s"}</small>
                  ${printer.issue_notes ? `<p>${escapeAdminHtml(printer.issue_notes)}</p>` : ""}
                </div>
                <button type="button" onclick='window.togglePrinterStatus(${JSON.stringify(String(printer.id))})'>
                  Mark ${printer.status === "offline" ? "online" : "offline"}
                </button>
              </article>
            `;
          }).join("") || `<p class="hint">Run the operations migration to track printer status.</p>`}
        </div>
      </section>

      <nav class="production-stage-tabs" aria-label="Production stages">
        <button
          type="button"
          class="${productionStageView === "queue" ? "active" : ""}"
          onclick="window.setProductionStageView('queue')"
        >
          <span>To Print</span>
          <strong>${queuedPieces}</strong>
        </button>
        <button
          type="button"
          class="${productionStageView === "printing" ? "active" : ""}"
          onclick="window.setProductionStageView('printing')"
        >
          <span>Printing</span>
          <strong>${printingJobs.length}</strong>
        </button>
        <button
          type="button"
          class="${productionStageView === "picked" ? "active" : ""}"
          onclick="window.setProductionStageView('picked')"
        >
          <span>Picked / Ready</span>
          <strong>${pickedJobs.length}</strong>
        </button>
      </nav>

      <div class="production-queue-panel ${productionStageView === "queue" ? "" : "hidden"}">
        <nav class="production-queue-tabs" aria-label="To print sections">
          ${selectedScopeActive ? `
            <button
              type="button"
              class="${productionQueueView === "batch" ? "active" : ""}"
              onclick="window.setProductionQueueView('batch')"
            >
              <span>Combined Batch Plan</span>
              <strong>${queuedPieces}</strong>
            </button>
          ` : ""}
          <button
            type="button"
            class="${productionQueueView === "timeline" ? "active" : ""}"
            onclick="window.setProductionQueueView('timeline')"
          >
            <span>Production Timeline</span>
            <strong>${productionTimelineOrders.length}</strong>
          </button>
          <button
            type="button"
            class="${productionQueueView === "bases" ? "active" : ""}"
            onclick="window.setProductionQueueView('bases')"
          >
            <span>Base Printing</span>
            <strong>${baseQueuedPieces}</strong>
          </button>
          <button
            type="button"
            class="${productionQueueView === "keycaps" ? "active" : ""}"
            onclick="window.setProductionQueueView('keycaps')"
          >
            <span>Keycaps Printing</span>
            <strong>${keycapQueuedPieces}</strong>
          </button>
        </nav>

        ${selectedScopeActive ? `
          <div class="production-queue-section ${productionQueueView === "batch" ? "" : "hidden"}">
            ${selectedBatchPanel}
          </div>
        ` : ""}

        <div class="production-queue-section ${productionQueueView === "timeline" ? "" : "hidden"}">
          ${productionTimelinePanel}
        </div>

        <div class="production-queue-section ${productionQueueView === "bases" ? "" : "hidden"}">
          <h3>Base Printing</h3>

          <p class="hint">Grouped by filament colour. Ribbed and Bubbly designs can print together on one plate.</p>

          <div class="base-shape-grid base-colour-grid">
            ${baseColourGroups.map(group => {
              const piecesLeft = group.rows.reduce((sum, item) => sum + item.toPrint, 0);

              return `
                <details
                  class="print-group base-shape-group base-colour-group"
                  data-collapse-key="base-colour-${encodeURIComponent(group.key)}"
                  open
                >
                  <summary class="base-shape-heading">
                    <span class="colour-dot" style="background:${getSafePdfColour(group.hex, "#d9d9d9")}"></span>
                    <div>
                      <h4>${group.label}</h4>
                      <p class="hint">${piecesLeft} piece${piecesLeft === 1 ? "" : "s"} · one combined colour plate</p>
                    </div>
                  </summary>

                  ${group.rows.map(item => `
                    <div class="print-check-row">
                      <span class="colour-dot" style="background:${item.hex}"></span>

                      <div style="flex:1;">
                        <strong>${item.baseShape === "bubbly" ? "Bubbly" : "Ribbed"} design</strong>
                        <p class="hint">
                          Need: ${item.need} · Stock: ${item.stock}
                          ${item.tracked ? ` · Tracked: ${item.tracked}` : ""}
                          · To Print: ${item.toPrint}
                        </p>
                      </div>

                      <div class="print-qty-control">
                        <input
                          type="number"
                          min="1"
                          value="${item.toPrint}"
                          id="printQty-${encodeURIComponent(item.itemName)}"
                        >

                        <button
                          class="ready-btn"
                          ${productionJobsLoadFailed ? "disabled" : ""}
                          onclick='window.startProductionJob(
                            ${JSON.stringify(item.itemName)},
                            document.getElementById(${JSON.stringify(`printQty-${encodeURIComponent(item.itemName)}`)}).value,
                            "Base"
                          )'
                        >
                          Start Printing
                        </button>

                      </div>
                    </div>

                  `).join("") || `<p class="base-shape-complete">✓ No ${group.label.toLowerCase()} need printing.</p>`}

                  ${group.rows.length ? `
                    <div class="batch-step-actions base-colour-actions">
                      <button
                        type="button"
                        class="stl-download-btn"
                        onclick="window.generateBaseColourStl('${group.stlJobId}', this)"
                      >
                        Download Combined STL
                      </button>
                      <button
                        type="button"
                        class="ready-btn"
                        ${productionJobsLoadFailed ? "disabled" : ""}
                        onclick="window.startBaseColourBatch('${group.stlJobId}', this)"
                      >
                        Start Colour Batch
                      </button>
                    </div>
                  ` : ""}
                </details>
              `;
            }).join("")}
          </div>
        </div>

        <div class="production-queue-section ${productionQueueView === "keycaps" ? "" : "hidden"}">
          <h3>Keycaps Printing</h3>
          ${amsLitePlanner || "<p>No keycaps need printing.</p>"}
        </div>
      </div>

      ${trackedStagePanel}
    </div>
  `;

  bindPersistentDetails("production");
}

function getEmailOrderItems(order) {
  let savedOrderData = order.order_data;

  if (typeof savedOrderData === "string") {
    try {
      savedOrderData = JSON.parse(savedOrderData);
    } catch (error) {
      console.error("Unable to read order_data:", error);
      savedOrderData = [];
    }
  }

  return Array.isArray(savedOrderData)
    ? savedOrderData
    : Array.isArray(savedOrderData?.items)
      ? savedOrderData.items
      : [];
}

function escapeEmailHtml(value) {
  const characters = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };

  return String(value ?? "").replace(
    /[&<>"']/g,
    character => characters[character]
  );
}

function getSafePdfColour(value, fallback) {
  const colour = value?.hex || value;

  return typeof colour === "string" &&
    /^#[0-9a-f]{3,8}$/i.test(colour)
      ? colour
      : fallback;
}

function getPdfColourNames(values) {
  if (!Array.isArray(values) || !values.length) {
    return "Not specified";
  }

  return values
    .map(value => value?.name || value?.hex || value)
    .filter(Boolean)
    .join(", ");
}

function createPdfMiniPreview(item) {
  const design = item.design || {};
  const bases = Array.isArray(design.bases) && design.bases.length
    ? design.bases
    : ["#f6a9c2"];
  const caps = Array.isArray(design.caps) && design.caps.length
    ? design.caps
    : ["#ffffff"];
  const letters = Array.isArray(design.letters) && design.letters.length
    ? design.letters
    : ["#332d30"];

  const characters = Array.from(
    item.clean_name || sanitizeName(item.name || "")
  );
  const letterOrientation = getLetterOrientation(design);

  return characters.map((character, index) => {
    const isIcon = Boolean(specialKeycaps[character]);
    const previewText = isIcon
      ? displayIcon(character)
      : character;
    const base = getSafePdfColour(
      bases[index % bases.length],
      "#f6a9c2"
    );
    const cap = getSafePdfColour(
      caps[index % caps.length],
      "#ffffff"
    );
      const letter = getSafePdfColour(
      letters[index % letters.length],
      "#332d30"
    );

    return `
      <span style="
        display:inline-flex;
        width:38px;
        height:46px;
        margin:3px;
        padding:4px;
        align-items:flex-start;
        justify-content:center;
        box-sizing:border-box;
        border-radius:9px;
        background:${base};
        box-shadow:0 2px 5px rgba(51,45,48,.18);
      ">
        <span style="
          display:flex;
          width:29px;
          height:29px;
          align-items:center;
          justify-content:center;
          box-sizing:border-box;
          border:1px solid rgba(51,45,48,.12);
          border-radius:7px;
          background:${cap};
          color:${letter};
          font-size:${isIcon ? "17px" : "17px"};
          font-weight:700;
          line-height:1;
        "><span style="display:inline-block;transform:${letterOrientation === "horizontal" ? "rotate(-90deg)" : "none"};">${escapeEmailHtml(previewText)}</span></span>
      </span>
    `;
  }).join("");
}

async function generateLegacyRenderedOrderPdf(order, items) {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    position:fixed;
    left:-10000px;
    top:0;
    width:794px;
    box-sizing:border-box;
    padding:44px;
    background:#fff7fb;
    color:#332d30;
    font-family:Arial,Helvetica,sans-serif;
  `;

  const itemCards = items.length
    ? items.map((item, index) => {
        const design = item.design || {};
        const baseShape =
          design.base_shape?.label ||
          (design.base_shape?.key === "bubbly"
            ? "Bubbly Base"
            : "Ribbed Base");
        const baseColours = getPdfColourNames(design.bases);
        const capColours = getPdfColourNames(design.caps);
        const letterColours = getPdfColourNames(design.letters);
        const letterOrientation = getLetterOrientationLabel(design);
        const iconLegend = getPdfIconLegend(item);

        return `
          <div style="
            margin:0 0 14px;
            padding:18px;
            background:#ffffff;
            border:1px solid #f1d7e2;
            border-radius:15px;
            page-break-inside:avoid;
          ">
            <div style="display:flex;justify-content:space-between;gap:20px;">
              <div>
                <div style="font-size:18px;font-weight:700;">
                  ${index + 1}. ${escapeEmailHtml(getPdfReadableItemName(item))}
                </div>
                <div style="margin-top:4px;color:#756b70;font-size:13px;">
                  ${escapeEmailHtml(baseShape)} · ${escapeEmailHtml(letterOrientation)}
                </div>
              </div>
              <div style="color:#ff6799;font-size:18px;font-weight:700;">
                ${escapeEmailHtml(formatMoney(item.price))}
              </div>
            </div>
            <div style="margin-top:14px;white-space:nowrap;">
              ${createPdfMiniPreview(item)}
            </div>
            <div style="
              margin-top:12px;
              color:#756b70;
              font-size:12px;
              line-height:1.7;
            ">
              <strong style="color:#332d30;">Base colours:</strong>
              ${escapeEmailHtml(baseColours)}<br>
              <strong style="color:#332d30;">Cap colours:</strong>
              ${escapeEmailHtml(capColours)}<br>
              <strong style="color:#332d30;">Letter colours:</strong>
              ${escapeEmailHtml(letterColours)}<br>
              <strong style="color:#332d30;">Letter orientation:</strong>
              ${escapeEmailHtml(letterOrientation)}
              ${
                iconLegend
                  ? `<br><strong style="color:#332d30;">Icons:</strong> ${escapeEmailHtml(iconLegend)}`
                  : ""
              }
            </div>
          </div>
        `;
      }).join("")
    : `
        <div style="padding:18px;background:#fff;border-radius:15px;">
          No item details were saved for this order.
        </div>
      `;

  const deliveryText = Number(order.delivery_fee || 0) === 0
    ? "Free"
    : formatMoney(order.delivery_fee);
  const fulfilmentDetails = order.collection_method === "delivery"
    ? `
        <strong>Delivery address:</strong>
        ${escapeEmailHtml(order.delivery_address || "-")}<br>
      `
    : `
        <strong>Pickup location:</strong>
        ${escapeEmailHtml(getPickupLocation(order.collection_method))}<br>
      `;
  const customerNotes =
    order.notes || order.preferred_time || "No additional notes";

  wrapper.innerHTML = `
    <div style="
      overflow:hidden;
      background:#ffffff;
      border:1px solid #f1d7e2;
      border-radius:24px;
    ">
      <div style="padding:30px;text-align:center;background:#ffeaf2;">
        <div style="color:#ff6799;font-size:28px;font-weight:700;">
          Little Keeps
        </div>
        <div style="margin-top:9px;font-size:22px;font-weight:700;">
          Confirmed Order
        </div>
        <div style="margin-top:6px;color:#756b70;font-size:14px;">
          ${escapeEmailHtml(order.order_ref || "-")}
        </div>
      </div>

      <div style="padding:28px;">
        <div style="
          margin-bottom:22px;
          padding:18px;
          background:#fff8fb;
          border-radius:15px;
          font-size:14px;
          line-height:1.75;
        ">
          <div style="margin-bottom:8px;color:#ff6799;font-size:18px;font-weight:700;">
            Customer &amp; Fulfilment Details
          </div>
          <strong>Customer:</strong>
          ${escapeEmailHtml(order.customer_name || "Customer")}<br>
          <strong>Email:</strong>
          ${escapeEmailHtml(order.customer_email || "-")}<br>
          <strong>Contact number:</strong>
          ${escapeEmailHtml(order.customer_phone || "-")}<br>
          <strong>Collection method:</strong>
          ${escapeEmailHtml(getMethodLabel(order.collection_method))}<br>
          ${fulfilmentDetails}
          <strong>${order.order_type === "rush" || order.order_type === "bulk" ? "Preferred completion:" : order.collection_method === "delivery" ? "Estimated dispatch by:" : "Estimated ready by:"}</strong>
          ${escapeEmailHtml(formatDate(order.needed_by))}<br>
          <strong>Notes / preferred timing:</strong>
          ${escapeEmailHtml(customerNotes)}
        </div>

        <div style="margin:0 0 14px;color:#ff6799;font-size:21px;font-weight:700;">
          Your Order
        </div>
        ${itemCards}

        <div style="
          margin-top:22px;
          padding:20px;
          background:#fff8fb;
          border-radius:15px;
          font-size:16px;
          line-height:2;
        ">
          ${Number(order.discount_amount || 0) > 0 ? `
            <div style="display:flex;justify-content:space-between;">
              <span>Original subtotal</span>
              <strong>${escapeEmailHtml(formatMoney(order.original_subtotal))}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;color:#278154;">
              <span>Promo ${escapeEmailHtml(order.promo_code || "")}</span>
              <strong>−${escapeEmailHtml(formatMoney(order.discount_amount))}</strong>
            </div>
          ` : ""}
          <div style="display:flex;justify-content:space-between;">
            <span>${Number(order.discount_amount || 0) > 0 ? "Discounted subtotal" : "Subtotal"}</span>
            <strong>${escapeEmailHtml(formatMoney(order.subtotal))}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span>Delivery</span>
            <strong>${escapeEmailHtml(deliveryText)}</strong>
          </div>
          <div style="
            display:flex;
            justify-content:space-between;
            margin-top:8px;
            padding-top:10px;
            border-top:1px solid #efd8e1;
            color:#ff6799;
            font-size:20px;
          ">
            <strong>Total Paid</strong>
            <strong>${escapeEmailHtml(formatMoney(order.total))}</strong>
          </div>
        </div>

        <div style="margin-top:26px;text-align:center;color:#8b8085;font-size:13px;">
          Made with lots of love and a little click. Little Keeps
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper);

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const canvas = await html2canvas(wrapper, {
      backgroundColor: "#fff7fb",
      logging: false,
      scale: 1.5,
      useCORS: true
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true
    });

    const margin = 8;
    const printableWidth = 210 - margin * 2;
    const printableHeight = 297 - margin * 2;
    const pixelsPerMm = canvas.width / printableWidth;
    const sliceHeight = Math.floor(printableHeight * pixelsPerMm);

    let sourceY = 0;
    let pageNumber = 0;

    while (sourceY < canvas.height) {
      const currentSliceHeight = Math.min(
        sliceHeight,
        canvas.height - sourceY
      );
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = currentSliceHeight;

      const context = pageCanvas.getContext("2d");
      context.fillStyle = "#fff7fb";
      context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      context.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        currentSliceHeight,
        0,
        0,
        canvas.width,
        currentSliceHeight
      );

      if (pageNumber > 0) {
        pdf.addPage();
      }

      const renderedHeight = currentSliceHeight / pixelsPerMm;
      pdf.addImage(
        pageCanvas.toDataURL("image/jpeg", 0.82),
        "JPEG",
        margin,
        margin,
        printableWidth,
        renderedHeight,
        undefined,
        "FAST"
      );

      sourceY += currentSliceHeight;
      pageNumber += 1;
    }

    return pdf.output("datauristring");
  } finally {
    wrapper.remove();
  }
}

function getPdfRgb(value, fallback) {
  let hex = getSafePdfColour(value, fallback).slice(1);

  if (hex.length === 3) {
    hex = hex.split("").map(character => character + character).join("");
  }

  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16)
  ];
}

function getCompactPdfText(value) {
  return String(value ?? "-")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, "*");
}

const compactPdfIconImageCache = new Map();

function getCompactPdfIconImage(character) {
  if (compactPdfIconImageCache.has(character)) {
    return compactPdfIconImageCache.get(character);
  }

  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;

  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font =
    "34px 'Apple Color Emoji', 'Segoe UI Emoji', 'Arial Unicode MS', sans-serif";
  context.fillText(displayIcon(character), 24, 25);

  const image = canvas.toDataURL("image/png");
  compactPdfIconImageCache.set(character, image);
  return image;
}

async function generateCustomerOrderPdf(order, items) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const pink = [255, 103, 153];
  const palePink = [255, 234, 242];
  const softPink = [255, 248, 251];
  const dark = [51, 45, 48];
  const muted = [117, 107, 112];

  function drawPageHeader(showTitle = true) {
    pdf.setFillColor(...palePink);
    pdf.roundedRect(margin, y, contentWidth, showTitle ? 31 : 17, 4, 4, "F");

    pdf.setTextColor(...pink);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(showTitle ? 20 : 14);
    pdf.text("Little Keeps", pageWidth / 2, y + (showTitle ? 10 : 7), {
      align: "center"
    });

    if (showTitle) {
      pdf.setTextColor(...dark);
      pdf.setFontSize(14);
      pdf.text("Confirmed Order", pageWidth / 2, y + 19, {
        align: "center"
      });
      pdf.setTextColor(...muted);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(
        getCompactPdfText(order.order_ref || "-"),
        pageWidth / 2,
        y + 26,
        { align: "center" }
      );
    }

    y += showTitle ? 37 : 23;
  }

  function addPageIfNeeded(requiredHeight) {
    if (y + requiredHeight <= pageHeight - margin) {
      return;
    }

    pdf.addPage();
    y = margin;
    drawPageHeader(false);
  }

  function drawWrappedDetail(label, value) {
    const lines = pdf.splitTextToSize(
      `${label}: ${getCompactPdfText(value || "-")}`,
      contentWidth - 12
    );
    const requiredHeight = lines.length * 4.5 + 1;
    addPageIfNeeded(requiredHeight);
    pdf.setTextColor(...dark);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.text(lines, margin + 6, y);
    y += requiredHeight;
  }

  drawPageHeader(true);

  pdf.setFillColor(...softPink);
  pdf.roundedRect(margin, y, contentWidth, 8, 3, 3, "F");
  pdf.setTextColor(...pink);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Customer & Fulfilment Details", margin + 5, y + 5.5);
  y += 13;

  drawWrappedDetail("Customer", order.customer_name || "Customer");
  drawWrappedDetail("Email", order.customer_email || "-");
  drawWrappedDetail("Contact number", order.customer_phone || "-");
  drawWrappedDetail(
    "Collection method",
    getMethodLabel(order.collection_method)
  );

  if (order.collection_method === "delivery") {
    drawWrappedDetail("Delivery address", order.delivery_address || "-");
  } else {
    drawWrappedDetail(
      "Pickup location",
      getPickupLocation(order.collection_method)
    );
  }

  drawWrappedDetail(
    order.order_type === "rush" || order.order_type === "bulk"
      ? "Preferred completion"
      : order.collection_method === "delivery"
        ? "Estimated dispatch by"
        : "Estimated ready by",
    formatDate(order.needed_by)
  );
  drawWrappedDetail(
    "Notes / preferred timing",
    order.notes || order.preferred_time || "No additional notes"
  );

  y += 4;
  addPageIfNeeded(12);
  pdf.setTextColor(...pink);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text("Your Order", margin, y);
  y += 7;

  items.forEach((item, index) => {
    const design = item.design || {};
    const bases = Array.isArray(design.bases) && design.bases.length
      ? design.bases
      : ["#f6a9c2"];
    const caps = Array.isArray(design.caps) && design.caps.length
      ? design.caps
      : ["#ffffff"];
    const letters = Array.isArray(design.letters) && design.letters.length
      ? design.letters
      : ["#332d30"];
    const baseShape =
      design.base_shape?.label ||
      (design.base_shape?.key === "bubbly"
        ? "Bubbly Base"
        : "Ribbed Base");
    const letterOrientation = getLetterOrientation(design);
    const letterOrientationLabel = getLetterOrientationLabel(design);
    const baseNames = getPdfColourNames(bases);
    const capNames = getPdfColourNames(caps);
    const letterNames = getPdfColourNames(letters);
    const characters = Array.from(
      item.clean_name || sanitizeName(item.name || "")
    );
    const iconLegend = getPdfIconLegend(item);
    const colourLines = [
      ...(item.group_contributor_name
        ? pdf.splitTextToSize(
            `Group member: ${getCompactPdfText(item.group_contributor_name)}`,
            contentWidth - 12
          )
        : []),
      ...pdf.splitTextToSize(
        `Base colours: ${getCompactPdfText(baseNames)}`,
        contentWidth - 12
      ),
      ...pdf.splitTextToSize(
        `Cap colours: ${getCompactPdfText(capNames)}`,
        contentWidth - 12
      ),
      ...pdf.splitTextToSize(
        `Letter colours: ${getCompactPdfText(letterNames)}`,
        contentWidth - 12
      ),
      ...pdf.splitTextToSize(
        `Letter orientation: ${getCompactPdfText(letterOrientationLabel)}`,
        contentWidth - 12
      ),
      ...(iconLegend
        ? pdf.splitTextToSize(
            `Icons: ${getCompactPdfText(iconLegend)}`,
            contentWidth - 12
          )
        : []),
      ...(getItemGiftingBagQuantity(item)
        ? pdf.splitTextToSize(
            `Packaging: ${getItemGiftingBagQuantity(item)} gifting bag${getItemGiftingBagQuantity(item) === 1 ? "" : "s"} supplied separately`,
            contentWidth - 12
          )
        : [])
    ];
    const cardHeight = 34 + colourLines.length * 3.8;

    addPageIfNeeded(cardHeight + 5);
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(241, 215, 226);
    pdf.roundedRect(margin, y, contentWidth, cardHeight, 4, 4, "FD");

    pdf.setTextColor(...dark);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(
      `${index + 1}. ${getCompactPdfText(getPdfReadableItemName(item))}`,
      margin + 5,
      y + 7
    );
    pdf.setTextColor(...pink);
    pdf.text(
      getCompactPdfText(formatMoney(item.price)),
      pageWidth - margin - 5,
      y + 7,
      { align: "right" }
    );

    pdf.setTextColor(...muted);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.text(
      getCompactPdfText(`${baseShape} · ${letterOrientationLabel}`),
      margin + 5,
      y + 12
    );

    let blockX = margin + 5;
    const blockY = y + 16;

    characters.forEach((character, characterIndex) => {
      const baseRgb = getPdfRgb(
        bases[characterIndex % bases.length],
        "#f6a9c2"
      );
      const capRgb = getPdfRgb(
        caps[characterIndex % caps.length],
        "#ffffff"
      );
      const letterRgb = getPdfRgb(
        letters[characterIndex % letters.length],
        "#332d30"
      );

      pdf.setFillColor(...baseRgb);
      pdf.roundedRect(blockX, blockY, 9, 11, 1.5, 1.5, "F");
      pdf.setFillColor(...capRgb);
      pdf.roundedRect(blockX + 1, blockY + 1, 7, 7, 1, 1, "F");
      if (/^[A-Za-z0-9]$/.test(character)) {
        pdf.setTextColor(...letterRgb);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.text(character, blockX + 4.5, blockY + 5.7, {
          align: "center",
          angle: letterOrientation === "horizontal" ? 90 : 0
        });
      } else {
        try {
          pdf.addImage(
            getCompactPdfIconImage(character),
            "PNG",
            blockX + 2,
            blockY + 2,
            5,
            5,
            `little-keeps-${getPdfIconCode(character)}`,
            "FAST",
            letterOrientation === "horizontal" ? 90 : 0
          );
        } catch (error) {
          console.warn("Unable to draw PDF icon:", character, error);
          pdf.setTextColor(...letterRgb);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(5);
          pdf.text(
            getPdfIconName(character).slice(0, 1),
            blockX + 4.5,
            blockY + 5.4,
            {
              align: "center",
              angle: letterOrientation === "horizontal" ? 90 : 0
            }
          );
        }
      }
      blockX += 10.5;
    });

    pdf.setTextColor(...muted);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.text(colourLines, margin + 5, y + 31);
    y += cardHeight + 5;
  });

  if (!items.length) {
    drawWrappedDetail("Order items", "No item details were saved");
  }

  const promoDiscount = Number(order.discount_amount || 0);
  const hasPromoDiscount = promoDiscount > 0;
  const summaryHeight = hasPromoDiscount ? 45 : 33;
  const totalLineY = hasPromoDiscount ? 39 : 27;

  addPageIfNeeded(summaryHeight + 4);
  pdf.setFillColor(...softPink);
  pdf.roundedRect(margin, y, contentWidth, summaryHeight, 4, 4, "F");
  pdf.setTextColor(...dark);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);

  if (hasPromoDiscount) {
    pdf.text("Original subtotal", margin + 6, y + 7);
    pdf.text(
      getCompactPdfText(formatMoney(order.original_subtotal)),
      pageWidth - margin - 6,
      y + 7,
      { align: "right" }
    );
    pdf.setTextColor(39, 129, 84);
    pdf.text(`Promo ${getCompactPdfText(order.promo_code || "")}`, margin + 6, y + 14);
    pdf.text(
      `-${getCompactPdfText(formatMoney(promoDiscount))}`,
      pageWidth - margin - 6,
      y + 14,
      { align: "right" }
    );
    pdf.setTextColor(...dark);
  }

  const subtotalLineY = hasPromoDiscount ? 21 : 8;
  const deliveryLineY = hasPromoDiscount ? 28 : 16;

  pdf.text(hasPromoDiscount ? "Discounted subtotal" : "Subtotal", margin + 6, y + subtotalLineY);
  pdf.text(
    getCompactPdfText(formatMoney(order.subtotal)),
    pageWidth - margin - 6,
    y + subtotalLineY,
    { align: "right" }
  );
  pdf.text("Delivery", margin + 6, y + deliveryLineY);
  pdf.text(
    Number(order.delivery_fee || 0) === 0
      ? "Free"
      : getCompactPdfText(formatMoney(order.delivery_fee)),
    pageWidth - margin - 6,
    y + deliveryLineY,
    { align: "right" }
  );
  pdf.setTextColor(...pink);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Total Paid", margin + 6, y + totalLineY);
  pdf.text(
    getCompactPdfText(formatMoney(order.total)),
    pageWidth - margin - 6,
    y + totalLineY,
    { align: "right" }
  );

  const dataUri = pdf.output("datauristring");
  const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
  console.log(
    "Compact PDF attachment size:",
    `${Math.ceil(base64.length / 1024)} KB base64`
  );

  return base64;
}

async function sendPaymentVerifiedEmail(order) {
  const customerEmail = order.customer_email?.trim();

  if (!customerEmail) {
    throw new Error(
      "The order does not have a customer email address."
    );
  }

  const items = getEmailOrderItems(order);

  const orderList = items.length
    ? items
        .map((item, index) => {
          const name =
            item.name || "Personalised keychain";

          const price = formatMoney(item.price);

          return `${index + 1}. ${name} - ${price}`;
        })
        .join("\n")
    : "No item details available.";

  console.log("Order list being emailed:", orderList);

  // This is intentionally the same generator used by Download PDF below.
  // Keeping one source prevents the customer's attachment from drifting.
  const orderPdf = await generateCustomerOrderPdf(order, items);

  const response = await emailjs.send(
    EMAILJS_SERVICE,
    EMAILJS_PAYMENT_VERIFIED_TEMPLATE,
    {
      to_email: customerEmail,
      customer_name: order.customer_name || "Customer",
      order_ref: order.order_ref || "-",

      order_list: orderList,
      order_pdf: orderPdf,

      original_subtotal_amount: formatMoney(
        order.original_subtotal ?? order.subtotal
      ),
      promo_code: order.promo_code || "",
      discount_amount: Number(order.discount_amount || 0) > 0
        ? `−${formatMoney(order.discount_amount)}`
        : "",
      subtotal_amount: formatMoney(order.subtotal),

      delivery_amount:
        Number(order.delivery_fee || 0) === 0
          ? "Free"
          : formatMoney(order.delivery_fee),

      total_amount: formatMoney(order.total),

      needed_by: formatDate(order.needed_by),

      collection_method: getMethodLabel(
        order.collection_method
      )
    }
  );

  console.log(
    "Verification email sent:",
    response.status,
    response.text
  );
}

async function copyOrderReference(id) {
  const order = latestOrders.find(
    item => String(item.id) === String(id)
  );

  if (!order?.order_ref) {
    alert("Order reference could not be found.");
    return;
  }

  try {
    await navigator.clipboard.writeText(order.order_ref);
    alert(`${order.order_ref} copied.`);
  } catch {
    const input = document.createElement("input");
    input.value = order.order_ref;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    alert(`${order.order_ref} copied.`);
  }
}

async function downloadOrderPdf(id, button) {
  const order = latestOrders.find(
    item => String(item.id) === String(id)
  );

  if (!order) {
    alert("Order could not be found.");
    return;
  }

  const originalLabel = button?.textContent || "Download PDF";

  if (button) {
    button.disabled = true;
    button.textContent = "Preparing PDF…";
  }

  try {
    const items = getEmailOrderItems(order);
    const pdfBase64 = await generateCustomerOrderPdf(order, items);
    const link = document.createElement("a");
    const safeReference = String(order.order_ref || "order")
      .replace(/[^a-z0-9_-]+/gi, "-");

    link.href = `data:application/pdf;base64,${pdfBase64}`;
    link.download = `Little-Keeps-${safeReference}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    console.error("Unable to download order PDF:", error);
    alert("Unable to prepare the PDF. Please try again.");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
}

async function sendPaymentConfirmationEmail(id, button) {
  const order = latestOrders.find(
    item => String(item.id) === String(id)
  );

  if (!order) {
    alert("Order could not be found.");
    return;
  }

  const originalLabel = button?.textContent || "Send Confirmation + PDF";
  if (button) {
    button.disabled = true;
    button.textContent = "Preparing email + PDF…";
  }

  try {
    await sendPaymentVerifiedEmail(order);
    alert(`Confirmation and PDF sent to ${order.customer_email}.`);
  } catch (error) {
    console.error("Unable to send payment confirmation:", error);
    alert(
      "The confirmation email failed to send.\n\n" +
      (error?.text || error?.message || "Unknown email error")
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
}

async function deleteTestOrder(id) {
  const order = latestOrders.find(
    item => String(item.id) === String(id)
  );

  if (!order) {
    alert("Order could not be found.");
    return;
  }

  const enteredReference = prompt(
    `Permanently delete ${order.order_ref}?\n\n` +
    `Type the full order reference to continue.\n` +
    `This permanently removes the order from Supabase.`
  );

  if (enteredReference === null) return;

  if (enteredReference.trim().toUpperCase() !== String(order.order_ref).trim().toUpperCase()) {
    alert("The order reference did not match. Nothing was deleted.");
    return;
  }

  const confirmed = confirm(
    `Permanently delete ${order.order_ref}?\n\n` +
    `Only use this for your own test orders. This cannot be undone.\n` +
    `Deleting an assembled order will not restore inventory automatically.`
  );

  if (!confirmed) return;

  const { data, error } = await supabase
    .from("orders")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("Unable to delete order:", error);
    alert(
      "Supabase blocked the deletion. Run the supplied admin-delete SQL once, then try again."
    );
    return;
  }

  if (!data?.length) {
    alert(
      "The order was not deleted. Supabase does not currently allow delete access for the signed-in admin."
    );
    return;
  }

  latestOrders = latestOrders.filter(
    item => String(item.id) !== String(id)
  );

  renderCurrentView();
  alert(`${order.order_ref} was deleted.`);
}

async function archiveOrder(id) {
  const order = latestOrders.find(item => String(item.id) === String(id));
  if (!order) return alert("Order could not be found.");

  if (!confirm(`Archive ${order.order_ref}?\n\nIt will leave your active workflow but can be restored later.`)) return;

  const { error } = await supabase
    .from("orders")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Unable to archive order:", error);
    alert("Unable to archive this order. Run the supplied operations SQL once, then try again.");
    return;
  }

  await loadOrders();
}

async function restoreOrder(id) {
  const order = latestOrders.find(item => String(item.id) === String(id));
  if (!order) return alert("Order could not be found.");

  const { error } = await supabase
    .from("orders")
    .update({ archived_at: null })
    .eq("id", id);

  if (error) {
    console.error("Unable to restore order:", error);
    alert("Unable to restore this order.");
    return;
  }

  await loadOrders();
}

async function approveSpecialOrder(id) {
  const order = latestOrders.find(item => String(item.id) === String(id));
  if (!order) return alert("Order could not be found.");

  const confirmedDate = prompt(
    "Confirm the completion date (YYYY-MM-DD):",
    String(order.requested_completion_date || order.needed_by || "").slice(0, 10)
  );
  if (confirmedDate === null) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(confirmedDate.trim())) {
    alert("Please enter the date as YYYY-MM-DD.");
    return;
  }

  let rushFee = Number(order.rush_fee || 0);
  if (order.order_type === "rush") {
    const enteredFee = prompt("Rush fee to add ($):", rushFee.toFixed(2));
    if (enteredFee === null) return;
    rushFee = Number(enteredFee);
    if (!Number.isFinite(rushFee) || rushFee < 0) {
      alert("Please enter a valid rush fee.");
      return;
    }
  }

  const originalTotalWithoutRush = Number(order.total || 0) - Number(order.rush_fee || 0);
  let updatedTotal = originalTotalWithoutRush + rushFee;

  if (order.order_type === "bulk") {
    const enteredTotal = prompt(
      "Confirm the final event-order total ($):",
      Number(order.total || 0).toFixed(2)
    );
    if (enteredTotal === null) return;
    updatedTotal = Number(enteredTotal);
    if (!Number.isFinite(updatedTotal) || updatedTotal < 0) {
      alert("Please enter a valid final total.");
      return;
    }
  }
  const { error } = await supabase.from("orders").update({
    needed_by: confirmedDate.trim(),
    rush_fee: rushFee,
    total: updatedTotal,
    review_status: "Approved",
    status: "Pending Payment",
    status_updated_at: new Date().toISOString()
  }).eq("id", id);

  if (error) {
    console.error("Unable to approve request:", error);
    alert("Unable to approve this request. Run the latest operations SQL, then try again.");
    return;
  }

  const requestLabel = order.order_type === "rush" ? "rush order" : "bulk order";
  const message =
    `Hi ${order.customer_name || "there"}! Your Little Keeps ${requestLabel} ${order.order_ref} is approved for ${formatDate(confirmedDate)}. ` +
    `The confirmed total is ${formatMoney(updatedTotal)}. Open https://little-keeps.vercel.app, choose “Check your order status”, and enter your order reference and email to make payment.`;

  try {
    await navigator.clipboard.writeText(message);
  } catch {
    // The request is still approved even when clipboard access is unavailable.
  }

  await loadOrders();

  const whatsappHref = getWhatsAppHref(order.customer_phone);
  if (whatsappHref && confirm("Request approved ✓\n\nThe payment message was copied. Open the customer's WhatsApp now?")) {
    window.open(`${whatsappHref}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  } else {
    alert("Request approved. The payment message has been copied.");
  }
}

async function sendPaymentReminder(id, button) {
  const order = latestOrders.find(item => String(item.id) === String(id));
  if (!order) return alert("Order could not be found.");

  const label = button?.textContent || "Email Payment Reminder";
  if (button) {
    button.disabled = true;
    button.textContent = "Sending…";
  }

  try {
    const { data, error } = await supabase.functions.invoke(
      "send-payment-reminder",
      { body: { order_id: order.id } }
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    alert(`Payment reminder sent to ${order.customer_email}.`);
    await loadOrders();
  } catch (error) {
    console.error("Unable to send payment reminder:", error);
    alert(error?.message || "Unable to send the payment reminder.");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = label;
    }
  }
}

async function refundOrder(id, button) {
  const order = latestOrders.find(item => String(item.id) === String(id));
  if (!order) return alert("Order could not be found.");

  const remaining = Math.max(
    0,
    Number(order.total || 0) - Number(order.refunded_amount || 0)
  );
  const entered = prompt(
    `Refund amount for ${order.order_ref}\nMaximum: ${formatMoney(remaining)}`,
    remaining.toFixed(2)
  );
  if (entered === null) return;

  const amount = Number(entered);
  if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
    return alert(`Enter an amount between $0.01 and ${formatMoney(remaining)}.`);
  }

  const reason = prompt("Reason for refund:", "Customer request");
  if (reason === null) return;

  const isFullRefund = amount >= remaining - 0.005;
  const willRestoreInventory =
    isFullRefund &&
    Boolean(order.inventory_deducted_at) &&
    !order.inventory_restored_at;
  if (!confirm(
    `Refund ${formatMoney(amount)} for ${order.order_ref}?` +
    (willRestoreInventory ? "\n\nThe deducted inventory will also be restored." : "")
  )) return;

  const label = button?.textContent || "Refund";
  if (button) {
    button.disabled = true;
    button.textContent = "Refunding…";
  }

  try {
    const { data, error } = await supabase.functions.invoke("refund-order", {
      body: {
        order_id: order.id,
        amount,
        reason,
        inventory_needs: willRestoreInventory
          ? getOrderInventoryNeeds(order)
          : {}
      }
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    alert(
      `${data.refund_status === "full" ? "Full" : "Partial"} refund completed: ` +
      formatMoney(amount) +
      (data.warning ? `\n\n${data.warning}` : "")
    );
    await loadOrders();
  } catch (error) {
    console.error("Unable to refund order:", error);
    let message = error?.message || "Unable to complete the refund.";

    if (error?.context instanceof Response) {
      try {
        const details = await error.context.clone().json();
        message = details?.error || message;
      } catch {
        // Keep the connection error supplied by Supabase.
      }
    }

    alert(message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = label;
    }
  }
}

async function sendReviewRequest(id, button) {
  const order = latestOrders.find(item => String(item.id) === String(id));
  if (!order) return alert("Order could not be found.");

  const label = button?.textContent || "Send Review Request";
  if (button) {
    button.disabled = true;
    button.textContent = "Sending…";
  }

  try {
    const result = await sendOrderStatusEmail(order, "Completed");
    if (!result.sent) throw new Error(result.reason || "Review email was skipped.");

    const sentAt = new Date().toISOString();
    await supabase
      .from("orders")
      .update({ review_request_sent_at: sentAt })
      .eq("id", order.id);
    alert(`Review request sent to ${order.customer_email}.`);
    await loadOrders();
  } catch (error) {
    console.error("Unable to send review request:", error);
    alert(error?.message || "Unable to send the review request.");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = label;
    }
  }
}

async function cleanupExpiredOrders() {
  if (!confirm("Archive unpaid orders that have been expired for more than 3 days?")) return;

  cleanupExpiredBtn.disabled = true;
  cleanupExpiredBtn.textContent = "Cleaning…";
  try {
    const { data, error } = await supabase.rpc("archive_stale_unpaid_orders");
    if (error) throw error;
    alert(`${Number(data || 0)} expired unpaid order(s) archived.`);
    await loadOrders();
  } catch (error) {
    console.error("Unable to clean expired orders:", error);
    alert("Unable to clean expired orders. Run the supplied customer-care SQL once.");
  } finally {
    cleanupExpiredBtn.disabled = false;
    cleanupExpiredBtn.textContent = "Clean Expired";
  }
}

window.copyOrderReference = copyOrderReference;
window.downloadOrderPdf = downloadOrderPdf;
window.sendPaymentConfirmationEmail = sendPaymentConfirmationEmail;
window.deleteTestOrder = deleteTestOrder;
window.archiveOrder = archiveOrder;
window.restoreOrder = restoreOrder;
window.approveSpecialOrder = approveSpecialOrder;
window.sendPaymentReminder = sendPaymentReminder;
window.refundOrder = refundOrder;
window.sendReviewRequest = sendReviewRequest;
cleanupExpiredBtn.onclick = cleanupExpiredOrders;

window.offerEarlierPickupWhatsApp = async function(id, button) {
  const order = groupLinkedOrdersForAdmin(latestOrders).find(
    item => String(item.id) === String(id)
  );

  if (!order || order.collection_method === "delivery") {
    alert("This earlier-pickup message is only available for pickup orders.");
    return;
  }

  const whatsappHref = getWhatsAppHref(order.customer_phone);
  if (!whatsappHref) {
    alert("This order does not have a valid WhatsApp number.");
    return;
  }

  const customerName = String(order.customer_name || "there").trim();
  const orderRef = String(order.order_ref || "").trim();
  const trackPayUrl = getTrackPayUrl(orderRef);
  const message =
    `Hi ${customerName}! Good news — your Little Keeps order ${orderRef} was completed earlier than expected 🥰\n\n` +
    `If you’d like to collect it earlier, you can choose a new available pickup date and timing through the Track/Pay page here:\n${trackPayUrl}\n\n` +
    `Your Little Keeps order number is *${orderRef}*. The link will fill it in for you; just enter the email used for your order.\n\n` +
    `No worries if you prefer to keep your original pickup timing — it will remain unchanged ♡`;

  try {
    await navigator.clipboard.writeText(message);
  } catch (error) {
    console.warn("Unable to copy earlier-pickup message:", error);
  }

  if (button) {
    const previousLabel = button.textContent;
    button.textContent = "Opening WhatsApp…";
    setTimeout(() => { button.textContent = previousLabel; }, 2200);
  }

  window.open(
    `${whatsappHref}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener"
  );
};

window.copyPickupWhatsAppReminder = async function(id, button) {
  const order = latestOrders.find(
    item => String(item.id) === String(id)
  );

  if (!order) {
    alert("Order could not be found.");
    return;
  }

  const customerName = String(order.customer_name || "there").trim();
  const message =
    `Hi ${customerName}! Your Little Keeps order ${order.order_ref || ""} is ready for pickup at ${getPickupLocation(order.collection_method)} 🩷\n\n` +
    `Your pickup is booked for ${formatDate(order.pickup_scheduled_date)} at ${order.pickup_time_range || "the selected time"}. See you then, thank you!`;

  try {
    await navigator.clipboard.writeText(message);
  } catch (error) {
    console.error("Unable to copy pickup reminder:", error);
    alert("Unable to copy the reminder. Please try again.");
    return;
  }

  if (button) {
    const previousLabel = button.textContent;
    button.textContent = "Copied ✓";
    setTimeout(() => {
      button.textContent = previousLabel;
    }, 2200);
  }

  const whatsappHref = getWhatsAppHref(order.customer_phone);

  if (whatsappHref && confirm("Pickup reminder copied. Open the customer’s WhatsApp now?")) {
    window.open(
      `${whatsappHref}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener"
    );
  }
};

window.startDelivery = async function(id) {
  const order = groupLinkedOrdersForAdmin(latestOrders).find(item => String(item.id) === String(id));
  if (!order) return;
  const courierName = prompt(
    "Courier name (leave blank if Little Keeps is delivering):",
    order.courier_name || ""
  );
  if (courierName === null) return;
  const trackingNumber = prompt("Tracking number (optional):", order.tracking_number || "");
  if (trackingNumber === null) return;
  const trackingUrl = prompt("Tracking link (optional):", order.tracking_url || "");
  if (trackingUrl === null) return;

  const updateData = {
    status: "Out for Delivery",
    status_updated_at: new Date().toISOString(),
    courier_name: courierName.trim(),
    tracking_number: trackingNumber.trim(),
    tracking_url: trackingUrl.trim()
  };
  const { error } = await updateOrderFamily(order, updateData);
  if (error) return alert("Unable to start delivery.");
  await sendOrderStatusEmail({ ...order, ...updateData }, "Out for Delivery");
  await loadOrders();
};

window.completeFulfilment = async function(id) {
  const order = groupLinkedOrdersForAdmin(latestOrders).find(item => String(item.id) === String(id));
  if (!order || !confirm(`Complete ${order.order_ref}?`)) return;
  const updateData = { status: "Completed", status_updated_at: new Date().toISOString() };
  const { error } = await updateOrderFamily(order, updateData);
  if (error) return alert("Unable to complete this order.");
  await sendOrderStatusEmail({ ...order, ...updateData }, "Completed");
  await loadOrders();
};

window.copyHandDeliveredWhatsApp = async function(id, button) {
  const order = groupLinkedOrdersForAdmin(latestOrders).find(item => String(item.id) === String(id));
  if (!order) return;
  const handoffNote = prompt("Optional delivery note (for example: handed to guard / left at door):", "");
  if (handoffNote === null) return;
  const customerName = String(order.customer_name || "there").trim();
  const message =
    `Hi ${customerName}! Your Little Keeps order ${order.order_ref || ""} has been delivered by Little Keeps 🩷` +
    `${handoffNote.trim() ? `\n\nDelivery note: ${handoffNote.trim()}` : ""}` +
    `\n\nThank you so much for supporting Little Keeps!`;
  try {
    await navigator.clipboard.writeText(message);
    if (button) button.textContent = "Copied ✓";
  } catch {
    window.prompt("Copy this WhatsApp message:", message);
  }
  const whatsappHref = getWhatsAppHref(order.customer_phone);
  if (whatsappHref && confirm("Delivered message copied. Open WhatsApp now?")) {
    window.open(`${whatsappHref}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }
};

function getStatusEmailContent(order, status) {
  const isDelivery = order.collection_method === "delivery";

  if (["Pending Pickup", "Ready for Pickup/Delivery"].includes(status) && !isDelivery) {
    return {
          title: "Your order is ready for pickup! 🩷",
          message: "Your personalised Little Keeps order has finished production, passed its quality check and is ready for collection.",
          actionTitle: `${getPickupLocation(order.collection_method)} pickup`,
          actionDetails: `Your pickup is booked for ${formatDate(order.pickup_scheduled_date)} at ${order.pickup_time_range || "the selected time"}.`
        };
  }

  if (status === "Out for Delivery") {
    return {
      title: "Your Little Keeps order has been dispatched! 🩷",
      message: "Your personalised order has finished production, passed its quality check and has been handed over for delivery. Please allow 1–3 days for arrival.",
      actionTitle: order.courier_name ? `Delivery by ${order.courier_name}` : "Delivery update",
      actionDetails: order.tracking_number
        ? `Tracking number: ${order.tracking_number}`
        : "Tracking details will be emailed unless your order is hand delivered. Please allow 1–3 days after dispatch."
    };
  }

  if (status === "Completed") {
    return {
      title: "Your Little Keeps order is complete!",
      message: "Your order has been collected or delivered. Thank you so much for supporting Little Keeps!",
      actionTitle: "Love your Little Keeps order?",
      actionDetails: "We’d be so happy to see your creation! Tap below to share a review or tag us. If anything is not quite right, please reply to this email and we’ll help."
    };
  }

  return null;
}

async function sendOrderStatusEmail(order, status) {
  if (!adminShopSettings.status_emails_enabled) {
    return {
      skipped: true,
      reason: "Status emails are disabled under Settings → Customer updates."
    };
  }

  const templateId = String(adminShopSettings.status_email_template_id || "").trim();
  const content = getStatusEmailContent(order, status);

  if (!templateId) {
    return {
      skipped: true,
      reason: "The EmailJS status-template ID is missing under Settings → Customer updates."
    };
  }

  if (!order.customer_email) {
    return {
      skipped: true,
      reason: "This order does not have a customer email address."
    };
  }

  if (!content) {
    return {
      skipped: true,
      reason: `There is no email content configured for status: ${status}.`
    };
  }

  await emailjs.send(EMAILJS_SERVICE, templateId, {
    to_email: order.customer_email,
    customer_name: order.customer_name || "Customer",
    order_ref: order.order_ref || "-",
    update_title: content.title,
    update_message: content.message,
    action_title: content.actionTitle,
    action_details: content.actionDetails,
    action_button_label:
      ["Pending Pickup", "Ready for Pickup/Delivery"].includes(status) &&
      order.collection_method !== "delivery"
        ? "View Pickup Details"
        : status === "Completed"
          ? "Share Your Review"
          : "View or Manage Your Order",
    action_url:
      status === "Completed"
        ? adminShopSettings.review_url || "https://www.instagram.com/madebylittlekeeps/"
        : `https://little-keeps.vercel.app/?resume_order=${encodeURIComponent(order.order_ref || "")}#orderStatusSection`,
    has_tracking: Boolean(order.tracking_number),
    tracking_number: order.tracking_number || "",
    tracking_url: order.tracking_url || "",
    courier_name: order.courier_name || "",
    collection_method: getMethodLabel(order.collection_method),
    needed_by: formatDate(order.needed_by)
  });

  const { error: historyError } = await supabase
    .from("orders")
    .update({
      status_email_sent_at: new Date().toISOString(),
      status_email_type: status
    })
    .eq("id", order.id);

  if (historyError) {
    console.warn(
      "Status email sent, but its history could not be recorded:",
      historyError
    );
  }

  return { sent: true };
}

async function sendLinkedOrderEmail(order, rootRef, latestDate) {
  if (!adminShopSettings.status_emails_enabled) {
    return { skipped: true, reason: "Status emails are disabled in Settings." };
  }
  const templateId = String(adminShopSettings.status_email_template_id || "").trim();
  if (!templateId || !order.customer_email) {
    return { skipped: true, reason: "The status email template or customer email is missing." };
  }

  await emailjs.send(EMAILJS_SERVICE, templateId, {
    to_email: order.customer_email,
    customer_name: order.customer_name || "Customer",
    order_ref: rootRef,
    update_title: "Your add-on has been linked! 🩷",
    update_message: `Your add-on (${order.order_ref}) is now grouped under ${rootRef}.`,
    action_title: "One combined order",
    action_details: `Both parts now follow the later pickup or dispatch date: ${formatDate(latestDate)}.`,
    action_button_label: "View Your Order",
    action_url: `https://little-keeps.vercel.app/?resume_order=${encodeURIComponent(rootRef)}#orderStatusSection`,
    has_tracking: false,
    tracking_number: "",
    tracking_url: "",
    courier_name: "",
    collection_method: getMethodLabel(order.collection_method),
    needed_by: formatDate(latestDate)
  });

  if (!IS_ADMIN_PREVIEW) {
    await supabase
      .from("orders")
      .update({ link_email_sent_at: new Date().toISOString() })
      .eq("id", order.id);
  }
  return { sent: true };
}

window.resendCurrentStatusEmail = async function(id, button) {
  const order = latestOrders.find(
    item => String(item.id) === String(id)
  );

  if (!order) {
    alert("Order could not be found.");
    return;
  }

  const canResend = order.collection_method === "delivery"
    ? ["Out for Delivery", "Completed"].includes(order.status)
    : ["Pending Pickup", "Completed"].includes(order.status);

  if (!canResend) {
    alert("This order does not currently have a status email to resend.");
    return;
  }

  const previousLabel = button?.textContent || "Resend Status Email";

  if (button) {
    button.disabled = true;
    button.textContent = "Sending…";
  }

  try {
    const result = await sendOrderStatusEmail(order, order.status);

    if (result.sent) {
      alert(`Status email sent to ${order.customer_email}.`);
    } else {
      alert(
        "The status email was not sent.\n\n" +
        (result.reason || "Check Customer updates under Settings.")
      );
    }
  } catch (error) {
    console.error("Unable to resend status email:", error);
    alert(
      "Unable to send the status email.\n\n" +
      (error?.text || error?.message || "Unknown EmailJS error")
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousLabel;
    }
  }
};

async function updateOrderStatus(id, status) {
  const scrollY = window.scrollY;

  const order = latestOrders.find(
    order => String(order.id) === String(id)
  );

  if (!order) {
    alert("Order could not be found.");
    return;
  }

  const previousStatus = order.status;
  const updateData = {
    status,
    status_updated_at: new Date().toISOString()
  };

  if (status === "Out for Delivery" && order.collection_method === "delivery") {
    const courierName = prompt(
      "Courier name (leave blank if you are delivering it yourself):",
      order.courier_name || ""
    );
    if (courierName === null) return;

    const trackingNumber = prompt(
      "Tracking number (optional):",
      order.tracking_number || ""
    );
    if (trackingNumber === null) return;

    const trackingUrl = prompt(
      "Tracking link (optional):",
      order.tracking_url || ""
    );
    if (trackingUrl === null) return;

    updateData.courier_name = courierName.trim();
    updateData.tracking_number = trackingNumber.trim();
    updateData.tracking_url = trackingUrl.trim();
  }

  if (status === "Payment Verified") {
    updateData.payment_type = "Paid";
  }

  const { error } = await updateOrderFamily(order, updateData);

  if (error) {
    console.error("Unable to update status:", error);
    alert("Unable to update status.");
    return;
  }

  const isNewlyVerified =
    previousStatus !== "Payment Verified" &&
    status === "Payment Verified";

  if (isNewlyVerified) {
    try {
      await sendPaymentVerifiedEmail(order);

      alert(
        `Payment verified and email sent to ${order.customer_email}.`
      );
    } catch (error) {
      console.error("Verification email failed:", error);

      alert(
        "Payment was verified, but the customer email failed to send.\n\n" +
        (error?.text || error?.message || "Unknown email error")
      );
    }
  }

  const shouldSendStatusUpdate = previousStatus !== status && (
    status === "Completed" ||
    (order.collection_method === "delivery" && status === "Out for Delivery") ||
    (order.collection_method !== "delivery" && status === "Pending Pickup")
  );

  if (shouldSendStatusUpdate) {
    try {
      const result = await sendOrderStatusEmail({ ...order, ...updateData }, status);
      if (result.sent) {
        if (status === "Completed") {
          await supabase
            .from("orders")
            .update({ review_request_sent_at: new Date().toISOString() })
            .eq("id", id);
        }
        alert(`Status updated and email sent to ${order.customer_email}.`);
      }
    } catch (error) {
      console.error("Status email failed:", error);
      alert("Status was updated, but the customer email failed to send. You can retry after checking the EmailJS template setting.");
    }
  }

  await loadOrders();

  setTimeout(() => {
    window.scrollTo(0, scrollY);
  }, 50);
}

async function updatePaymentType(id, paymentType) {
  const scrollY = window.scrollY;

  const { error } = await supabase
    .from("orders")
    .update({ payment_type: paymentType })
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("Unable to update payment type.");
    return;
  }

  await loadOrders();

  setTimeout(() => {
    window.scrollTo(0, scrollY);
  }, 50);
}

async function deductInventory(itemName, qtyToDeduct) {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("item_name", itemName)
    .single();

  if (error) {
    console.error(error);
    alert(`Unable to find inventory item: ${itemName}`);
    return false;
  }

  const currentQty = Number(data.qty || 0);

if (currentQty < qtyToDeduct) {
  alert(
    `Not enough ${itemName}.\n` +
    `Needed: ${qtyToDeduct}\n` +
    `Available: ${currentQty}`
  );

  return false;
}

const newQty = currentQty - qtyToDeduct;

  const { error: updateError } = await supabase
    .from("inventory_items")
    .update({
      qty: newQty,
      updated_at: new Date().toISOString()
    })
    .eq("item_name", itemName);

  if (updateError) {
    console.error(updateError);
    alert(`Unable to update inventory: ${itemName}`);
    return false;
  }

  return true;
}

async function loadAdminSettings() {
  if (IS_ADMIN_PREVIEW) {
    adminSettingsLoaded = true;
    adminSettingsLoadFailed = false;
    adminReviewsLoadFailed = false;
    adminShopSettings = { ...DEFAULT_ADMIN_SHOP_SETTINGS };
    adminPromoCodes = [];
    adminCustomerReviews = [];
    adminShopClosures = [];
    adminProductCatalog = normalizeProductCatalog(DEFAULT_PRODUCT_CATALOG);
    adminProductsLoadFailed = false;
    return;
  }

  const [
    { data: settings, error: settingsError },
    { data: promos, error: promosError },
    { data: reviews, error: reviewsError },
    { data: products, error: productsError },
    { data: closures, error: closuresError }
  ] = await Promise.all([
    supabase.from("shop_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("promo_codes").select("*").order("created_at", { ascending: false }),
    supabase
      .from("customer_reviews")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("product_catalog")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("shop_closures")
      .select("*")
      .gte("end_date", getSingaporeDateValue())
      .order("start_date", { ascending: true })
  ]);

  if (settingsError) console.warn("Using fallback admin settings:", settingsError);
  if (promosError) console.warn("Promo management is not ready yet:", promosError);
  if (reviewsError) console.warn("Customer review management is not ready yet:", reviewsError);
  if (productsError) console.warn("Product catalogue is not ready yet:", productsError);
  if (closuresError) console.warn("Shop closures could not be loaded:", closuresError);

  adminSettingsLoaded = true;
  adminSettingsLoadFailed = Boolean(settingsError);
  adminReviewsLoadFailed = Boolean(reviewsError);
  adminProductsLoadFailed = Boolean(productsError);
  adminShopSettings = {
    ...DEFAULT_ADMIN_SHOP_SETTINGS,
    ...(settingsError ? {} : (settings || {}))
  };
  adminShopSettings.contact_whatsapp_number = String(
    adminShopSettings.pickup_time_options?.contact_whatsapp_number ||
    adminShopSettings.contact_whatsapp_number ||
    "6585121915"
  ).replace(/\D/g, "") || "6585121915";
  adminShopSettings.bulk_buffer_days = Math.max(0, Number(
    adminShopSettings.pickup_time_options?.bulk_buffer_days ??
    adminShopSettings.bulk_buffer_days ??
    1
  ));
  adminShopSettings.pickup_time_options = normalizePickupTimeOptions(
    adminShopSettings.pickup_time_options
  );
  adminPromoCodes = promos || [];
  adminCustomerReviews = reviews || [];
  adminShopClosures = closures || [];
  adminProductCatalog = normalizeProductCatalog(productsError ? [] : products);
}

function getSingaporeDateValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function requestDueTomorrowTelegramAlerts(orders = []) {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowValue = getSingaporeDateValue(tomorrow);
  const finishedStatuses = new Set([
    "Assembly Complete",
    "Pending Pickup",
    "Pending Delivery",
    "Out for Delivery",
    "Completed",
    "Refunded"
  ]);
  const dueOrders = orders.filter(order => {
    const dueDate = String(
      order.requested_completion_date || order.needed_by || ""
    ).slice(0, 10);
    return (
      !order.archived_at &&
      dueDate === tomorrowValue &&
      !finishedStatuses.has(order.status || "") &&
      order.order_ref &&
      order.customer_email
    );
  });

  await Promise.allSettled(dueOrders.map(order =>
    supabase.functions.invoke("telegram-new-order", {
      body: {
        order_ref: order.order_ref,
        email: order.customer_email,
        source: "due-tomorrow"
      }
    })
  ));
}

async function loadOrders() {
  ordersContainer.innerHTML = `<p class="empty">Loading orders...</p>`;

  if (IS_ADMIN_PREVIEW) {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const previewDesign = {
      bases: [{ name: "Jade White", hex: "#ffffff" }],
      caps: [{ name: "Pink", hex: "#f55a74" }],
      letters: [{ name: "Jade White", hex: "#ffffff" }],
      base_shape: { key: "ribbed" }
    };
    latestOrders = [
      {
        id: "preview-changed-order",
        order_ref: "LK-1042",
        customer_name: "Alicia Tan",
        customer_email: "alicia@example.com",
        customer_phone: "90000001",
        payment_type: "Paid",
        total: 38.4,
        status: "Printing",
        collection_method: "delivery",
        delivery_address: "10 Woodlands Street 12, Singapore 738000",
        needed_by: tomorrow,
        notes: "Added Aiman after payment. Please pass to husband at lobby.",
        production_notes: "Base connected only. Double-check the N cap before adding the keyring.",
        handoff_name: "Safwan",
        handoff_relationship: "Husband",
        update_needs_review: true,
        update_summary: "Add-on: Aiman (+5 printed letters/caps and bases)",
        revision_number: 2,
        assembly_progress: { base_connected: true },
        order_data: [{ name: "AIMAN", clean_name: "AIMAN", design: previewDesign }],
        created_at: new Date().toISOString()
      },
      {
        id: "preview-packed-order",
        order_ref: "LK-1040",
        customer_name: "Nur Syafiqah",
        customer_email: "nur@example.com",
        customer_phone: "90000002",
        payment_type: "Paid",
        total: 28.8,
        status: "Pending Pickup",
        collection_method: "pickup_marsiling",
        delivery_address: "",
        pickup_scheduled_date: tomorrow,
        pickup_time_range: "7:30 PM",
        needed_by: tomorrow,
        special_instructions: "Call before delivery; teacher will receive it.",
        production_notes: "Packed in the pink mailer. Inspect the left edge once more.",
        handoff_name: "Ms Lim",
        handoff_relationship: "Teacher",
        assembly_progress: {
          base_connected: true,
          letters_caps_assembled: true,
          keyring_added: true,
          qc_done: true,
          packed: true
        },
        order_data: [{
          name: "NUR",
          clean_name: "NUR",
          design: previewDesign,
          assembly_completed: true,
          assembly_completed_at: new Date().toISOString()
        }],
        created_at: new Date(Date.now() - 3600000).toISOString()
      }
    ];
    await Promise.all([
      loadInventoryItems(),
      loadProductionJobs(),
      loadPrinters(),
      loadAdminSettings(),
      loadBusinessFinancials(),
      loadBusinessExpenses()
    ]);
    renderCurrentView();
    return;
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);

    ordersContainer.innerHTML = `
      <div class="empty-card">
        <h3>Unable to load orders</h3>
        <p>Please check Supabase permissions or the console error.</p>
      </div>
    `;

    return;
  }

latestOrders = (data || []).map(order =>
  hasExpiredPaymentHold(order)
    ? { ...order, status: "Payment Expired", online_payment_status: "expired" }
    : order
);

void requestDueTomorrowTelegramAlerts(latestOrders);

await Promise.all([
  loadInventoryItems(),
  loadProductionJobs(),
  loadPrinters(),
  loadAdminSettings(),
  loadBusinessFinancials(),
  loadBusinessExpenses()
]);

renderCurrentView();
}

window.updateOrderStatus = updateOrderStatus;
window.updatePaymentType = updatePaymentType;

function syncOrderSelectionToolbar() {
  const count = selectedOrderIds.size;
  const countLabel = document.getElementById("selectedOrderCount");
  const previewButton = document.getElementById("previewSelectedProductionBtn");
  const internalLabelsButton = document.getElementById("printSelectedInternalLabelsBtn");
  const deliveryLabelsButton = document.getElementById("printSelectedDeliveryLabelsBtn");
  const clearButton = document.getElementById("clearOrderSelectionBtn");

  if (countLabel) countLabel.textContent = `${count} selected`;
  if (previewButton) previewButton.disabled = count === 0;
  if (internalLabelsButton) internalLabelsButton.disabled = count === 0;
  if (deliveryLabelsButton) deliveryLabelsButton.disabled = count === 0;
  if (clearButton) clearButton.disabled = count === 0;
  const visibleInputs = Array.from(
    document.querySelectorAll("[data-order-batch-select]")
  );
  const selectAll = document.getElementById("selectAllVisibleOrders");
  if (selectAll) {
    selectAll.checked =
      visibleInputs.length > 0 &&
      visibleInputs.every(input => input.checked);
  }
}

window.toggleOrderSelection = function(orderId, checked) {
  const id = String(orderId);
  if (checked) selectedOrderIds.add(id);
  else selectedOrderIds.delete(id);
  syncOrderSelectionToolbar();
};

window.toggleVisibleOrderSelection = function(orderIds, checked) {
  (orderIds || []).forEach(orderId => {
    const id = String(orderId);
    if (checked) selectedOrderIds.add(id);
    else selectedOrderIds.delete(id);
  });
  document.querySelectorAll("[data-order-batch-select]").forEach(input => {
    input.checked = checked;
  });
  syncOrderSelectionToolbar();
};

window.clearOrderSelection = function() {
  selectedOrderIds.clear();
  document.querySelectorAll("[data-order-batch-select]").forEach(input => {
    input.checked = false;
  });
  const selectAll = document.getElementById("selectAllVisibleOrders");
  if (selectAll) selectAll.checked = false;
  syncOrderSelectionToolbar();
};

window.previewSelectedOrdersProduction = function() {
  const eligibleOrders = getProductionPreviewOrders(
    latestOrders,
    selectedOrderIds
  );

  if (!eligibleOrders.length) {
    alert("Select at least one active order to preview.");
    return;
  }

  productionOrderSelection.clear();
  eligibleOrders.forEach(order =>
    productionOrderSelection.add(String(order.id))
  );
  productionStageView = "queue";
  productionQueueView = "batch";
  currentView = "production";
  setActiveTab(productionViewBtn);
  renderCurrentView();
};

window.clearProductionOrderSelection = function() {
  productionOrderSelection.clear();
  selectedOrderIds.clear();
  productionQueueView = "timeline";
  renderCurrentView();
};

window.saveOrderProductionNote = async function(orderId, note, button) {
  const order = latestOrders.find(item => String(item.id) === String(orderId));
  if (!order) return;

  const previousLabel = button?.textContent || "Save note";
  if (button) {
    button.disabled = true;
    button.textContent = "Saving…";
  }

  if (!IS_ADMIN_PREVIEW) {
    const { error } = await supabase
      .from("orders")
      .update({ production_notes: String(note || "").trim() })
      .eq("id", order.id);
    if (error) {
      alert("Unable to save the production note. Run the latest operations migration first.");
      if (button) {
        button.disabled = false;
        button.textContent = previousLabel;
      }
      return;
    }
  }

  order.production_notes = String(note || "").trim();
  if (button) {
    button.textContent = "Saved ✓";
    setTimeout(() => {
      button.disabled = false;
      button.textContent = previousLabel;
    }, 1200);
  }
};

window.startOrderRework = function(orderId) {
  const order = latestOrders.find(item => String(item.id) === String(orderId));
  const keychains = order?.order_data || [];
  if (!order || !keychains.length) {
    alert("No keychain was found for this order.");
    return;
  }

  let itemIndex = 0;
  if (keychains.length > 1) {
    const choice = prompt(
      "Which keychain should go back to rework?\n\n" +
      keychains.map((item, index) => `${index + 1}. ${item.name || "Keychain"}`).join("\n"),
      "1"
    );
    if (choice === null) return;
    itemIndex = Number(choice) - 1;
    if (!Number.isInteger(itemIndex) || !keychains[itemIndex]) {
      alert("Choose a valid keychain number.");
      return;
    }
  }

  window.sendKeychainBackToRework(orderId, itemIndex);
};

window.sendKeychainBackToRework = async function(orderId, itemIndex) {
  const order = latestOrders.find(item => String(item.id) === String(orderId));
  const index = Number(itemIndex);
  const keychain = order?.order_data?.[index];
  if (!order || !keychain) return;

  const reason = prompt(
    `Send ${keychain.name || "this keychain"} back to Production?\n\n` +
    "QC and Packed will be unticked. The keychain will reopen in Assembly, and its replacement parts will be recalculated.",
    keychain.rework_reason || "Did not pass packing quality check"
  );
  if (reason === null || !reason.trim()) return;

  if (IS_ADMIN_PREVIEW) {
    keychain.assembly_completed = false;
    keychain.assembly_completed_at = null;
    keychain.rework_required = true;
    keychain.rework_reason = reason.trim();
    order.rework_required = true;
    order.rework_reason = reason.trim();
    order.status = "Printing";
    order.assembly_progress = {
      ...normalizeAssemblyProgress(order.assembly_progress),
      qc_done: false,
      packed: false
    };
    order.production_notes = [
      order.production_notes,
      `Rework: ${keychain.name || "Keychain"} — ${reason.trim()}`
    ].filter(Boolean).join("\n");
    renderCurrentView();
    return;
  }

  const { error } = await supabase.rpc(
    "reopen_order_keychain_for_rework",
    {
      p_order_id: String(orderId),
      p_item_index: index,
      p_reason: reason.trim()
    }
  );

  if (error) {
    console.error("Unable to reopen keychain for rework:", error);
    alert(
      "Unable to send this keychain back to Production.\n\n" +
      "Run the latest tomorrow operations SQL, then try again."
    );
    return;
  }

  await loadOrders();
};

window.resolveOrderRework = async function(orderId, button) {
  const order = latestOrders.find(item => String(item.id) === String(orderId));
  if (!order) return;
  if (button) button.disabled = true;

  if (!IS_ADMIN_PREVIEW) {
    const { error } = await supabase
      .from("orders")
      .update({
        rework_required: false,
        rework_resolved_at: new Date().toISOString()
      })
      .eq("id", order.id);
    if (error) {
      alert("Unable to close this rework.");
      if (button) button.disabled = false;
      return;
    }
  }

  order.rework_required = false;
  renderCurrentView();
};

window.updateAssemblyStage = async function(orderId, stage, checked) {
  const order = latestOrders.find(item => String(item.id) === String(orderId));
  if (!order || !ASSEMBLY_STAGES.some(item => item.key === stage)) return;

  const assemblyProgress = {
    ...normalizeAssemblyProgress(order.assembly_progress),
    [stage]: Boolean(checked)
  };
  order.assembly_progress = assemblyProgress;

  if (!IS_ADMIN_PREVIEW) {
    const { error } = await supabase
      .from("orders")
      .update({ assembly_progress: assemblyProgress })
      .eq("id", order.id);
    if (error) {
      alert("Unable to save assembly progress. Run the operations migration first.");
      await loadOrders();
      return;
    }
  }
  renderCurrentView();
};

window.acknowledgeOrderUpdate = async function(orderId, button) {
  const order = latestOrders.find(item => String(item.id) === String(orderId));
  if (!order) return;
  if (button) button.disabled = true;

  if (!IS_ADMIN_PREVIEW) {
    const { error } = await supabase
      .from("orders")
      .update({
        update_needs_review: false,
        update_reviewed_at: new Date().toISOString()
      })
      .eq("id", order.id);
    if (error) {
      alert("Unable to acknowledge this update.");
      if (button) button.disabled = false;
      return;
    }
  }

  order.update_needs_review = false;
  renderCurrentView();
};

window.linkOrderAsAddOn = async function(orderId, button) {
  const order = latestOrders.find(item => String(item.id) === String(orderId));
  if (!order) return;
  const parentRef = prompt(
    `Which original order should ${order.order_ref} be linked to?`,
    ""
  )?.trim().toUpperCase();
  if (!parentRef) return;
  if (button) button.disabled = true;

  if (IS_ADMIN_PREVIEW) {
    order.linked_order_ref = parentRef;
    order.linked_at = new Date().toISOString();
    renderCurrentView();
    return;
  }

  const { data, error } = await supabase.rpc("admin_link_order_add_on", {
    p_child_id: String(order.id),
    p_parent_order_ref: parentRef
  });
  if (error || !data?.ok) {
    alert(error?.message || "Unable to link these orders. Both must still be before Printing.");
    if (button) button.disabled = false;
    return;
  }

  let emailResult = { skipped: true };
  try {
    emailResult = await sendLinkedOrderEmail(order, data.order_ref, data.latest_date);
  } catch (emailError) {
    console.warn("Orders linked, but the customer email failed:", emailError);
  }

  alert(
    `Linked under ${data.order_ref}. Both orders now use ${formatDate(data.latest_date)}.` +
    (emailResult.sent ? " The customer was emailed." : " The customer email was not sent; you can email them from the order card.")
  );
  await loadOrders();
};

window.unlinkOrderAddOn = async function(orderId, button) {
  const order = latestOrders.find(item => String(item.id) === String(orderId));
  if (!order?.linked_order_ref) return;
  if (!confirm(`Unlink ${order.order_ref} from ${order.linked_order_ref}?`)) return;
  if (button) button.disabled = true;

  if (IS_ADMIN_PREVIEW) {
    order.linked_order_ref = null;
    renderCurrentView();
    return;
  }

  const { error } = await supabase.rpc("admin_unlink_order_add_on", {
    p_child_id: String(order.id)
  });
  if (error) {
    alert(error.message || "Unable to unlink this add-on.");
    if (button) button.disabled = false;
    return;
  }
  await loadOrders();
};

function buildBasketLabelPdf(orders) {
  const labels = orders.map(getInternalBasketLabelData);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [100, 150],
    compress: true
  });
  const pageWidth = 100;
  const margin = 7;
  const contentWidth = pageWidth - margin * 2;
  const dark = [45, 40, 43];
  const muted = [102, 91, 97];
  const pink = [239, 79, 136];
  const palePink = [255, 234, 242];

  labels.forEach((label, index) => {
    if (index > 0) pdf.addPage([100, 150], "portrait");

    pdf.setFillColor(...palePink);
    pdf.rect(0, 0, pageWidth, 22, "F");
    pdf.setTextColor(...pink);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("Little Keeps", margin, 10);
    pdf.setTextColor(...muted);
    pdf.setFontSize(8);
    pdf.text("INTERNAL BASKET LABEL", margin, 16);
    pdf.setTextColor(...dark);
    pdf.setFontSize(10);
    pdf.text(getCompactPdfText(label.orderRef), pageWidth - margin, 11, {
      align: "right"
    });

    let y = 30;
    pdf.setTextColor(...pink);
    pdf.setFontSize(8);
    pdf.text(label.method.toUpperCase(), margin, y);
    y += 7;

    pdf.setTextColor(...dark);
    pdf.setFontSize(17);
    const recipientLines = pdf.splitTextToSize(
      getCompactPdfText(label.customer),
      contentWidth
    ).slice(0, 2);
    pdf.text(recipientLines, margin, y);
    y += recipientLines.length * 7 + 1;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    const appointment = label.method === "Pickup"
      ? `Pickup: ${label.pickupDate ? formatDate(label.pickupDate) : "Date not set"}${label.pickupTime ? ` at ${label.pickupTime}` : ""}`
      : `Ready by: ${label.neededBy ? formatDate(label.neededBy) : "Not set"}`;
    pdf.text(getCompactPdfText(appointment), margin, y);
    y += 8;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("ITEMS", margin, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    label.items.slice(0, 8).forEach(item => {
      const line = `${item.quantity} x ${item.name}${item.summary ? ` - ${item.summary}` : ""}`;
      const lines = pdf.splitTextToSize(getCompactPdfText(line), contentWidth).slice(0, 2);
      pdf.text(lines, margin, y);
      y += lines.length * 4.6 + 1;
    });

    const detailsY = Math.max(108, Math.min(124, y + 4));
    pdf.setDrawColor(220, 207, 213);
    pdf.line(margin, detailsY, pageWidth - margin, detailsY);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...muted);
    pdf.setFontSize(8.5);

    const noteLines = pdf.splitTextToSize(
      getCompactPdfText(label.notes ? `Notes: ${label.notes}` : "Notes: -"),
      contentWidth
    ).slice(0, 3);
    pdf.text(noteLines, margin, detailsY + 7);

    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...dark);
    pdf.setFontSize(8);
    pdf.text(
      "WORKSHOP USE ONLY · KEEP ORDER TOGETHER",
      pageWidth / 2,
      143,
      { align: "center" }
    );
  });

  pdf.setProperties({
    title: labels.length === 1
      ? `${labels[0].orderRef} Basket Label`
      : `Little Keeps Basket Labels (${labels.length})`,
    subject: "Internal workshop basket labels",
    author: "Little Keeps"
  });
  if (typeof pdf.autoPrint === "function") pdf.autoPrint();
  return pdf;
}

function buildHandDeliveryLabelPdf(orders) {
  const labels = orders.map(getHandDeliveryLabelData);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [100, 150],
    compress: true
  });
  const pageWidth = 100;
  const margin = 7;
  const contentWidth = pageWidth - margin * 2;
  const navy = [29, 54, 72];
  const muted = [91, 108, 119];
  const pink = [239, 79, 136];
  const paleBlue = [237, 248, 253];
  const palePink = [255, 238, 244];

  labels.forEach((label, index) => {
    if (index > 0) pdf.addPage([100, 150], "portrait");

    pdf.setFillColor(...paleBlue);
    pdf.rect(0, 0, pageWidth, 25, "F");
    pdf.setTextColor(...pink);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.text("Little Keeps", margin, 10);
    pdf.setTextColor(...navy);
    pdf.setFontSize(10);
    pdf.text("HAND DELIVERY", margin, 18);
    pdf.setFontSize(10);
    pdf.text(getCompactPdfText(label.orderRef), pageWidth - margin, 11, {
      align: "right"
    });

    let y = 34;
    pdf.setTextColor(...muted);
    pdf.setFontSize(8);
    pdf.text("DELIVER TO", margin, y);
    y += 7;

    pdf.setTextColor(...navy);
    pdf.setFontSize(17);
    const customerLines = pdf.splitTextToSize(
      getCompactPdfText(label.customer),
      contentWidth
    ).slice(0, 2);
    pdf.text(customerLines, margin, y);
    y += customerLines.length * 7 + 2;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(getCompactPdfText(`Tel: ${label.phone}`), margin, y);
    y += 9;

    pdf.setDrawColor(204, 221, 230);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 8;

    pdf.setTextColor(...muted);
    pdf.setFontSize(8);
    pdf.text("DELIVERY ADDRESS", margin, y);
    y += 7;
    pdf.setTextColor(...navy);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    const addressLines = pdf.splitTextToSize(
      getCompactPdfText(label.address),
      contentWidth
    ).slice(0, 5);
    pdf.text(addressLines, margin, y);
    y += addressLines.length * 5.5 + 5;

    if (label.handoffName) {
      pdf.setFillColor(...paleBlue);
      const handoffText = `Hand to: ${label.handoffName}${label.handoffPhone ? ` · ${label.handoffPhone}` : ""}`;
      const handoffLines = pdf.splitTextToSize(
        getCompactPdfText(handoffText),
        contentWidth - 8
      ).slice(0, 2);
      const handoffHeight = 9 + handoffLines.length * 4.5;
      pdf.roundedRect(margin, y, contentWidth, handoffHeight, 2, 2, "F");
      pdf.setTextColor(...navy);
      pdf.setFontSize(9);
      pdf.text(handoffLines, margin + 4, y + 7);
      y += handoffHeight + 5;
    }

    const notesY = Math.max(108, Math.min(119, y));
    pdf.setFillColor(...palePink);
    pdf.roundedRect(margin, notesY, contentWidth, 21, 2, 2, "F");
    pdf.setTextColor(...pink);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("DELIVERY INSTRUCTIONS", margin + 4, notesY + 6);
    pdf.setTextColor(...navy);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    const noteLines = pdf.splitTextToSize(
      getCompactPdfText(label.deliveryNotes || "No special instructions"),
      contentWidth - 8
    ).slice(0, 3);
    pdf.text(noteLines, margin + 4, notesY + 12);

    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...navy);
    pdf.setFontSize(8);
    pdf.text("PERSONALISED ITEM · PLEASE HANDLE WITH CARE", pageWidth / 2, 143, {
      align: "center"
    });
  });

  pdf.setProperties({
    title: labels.length === 1
      ? `${labels[0].orderRef} Hand-Delivery Label`
      : `Little Keeps Hand-Delivery Labels (${labels.length})`,
    subject: "Little Keeps hand-delivery labels",
    author: "Little Keeps"
  });
  if (typeof pdf.autoPrint === "function") pdf.autoPrint();
  return pdf;
}

function printBasketLabels(orderIds) {
  const requestedIds = new Set(orderIds.map(String));
  const orders = groupLinkedOrdersForAdmin(latestOrders).filter(order =>
    requestedIds.has(String(order.id))
  );

  if (!orders.length) {
    alert("Select at least one order for a basket label.");
    return;
  }

  const pdf = buildBasketLabelPdf(orders);
  const pdfUrl = pdf.output("bloburl");
  const printWindow = window.open(pdfUrl, "_blank");

  if (!printWindow) {
    const filename = orders.length === 1
      ? `${safeProductionFileName(orders[0].order_ref, "basket")}-basket-label.pdf`
      : `little-keeps-${orders.length}-basket-labels.pdf`;
    pdf.save(filename);
    alert("The printable label PDF was downloaded because the print window was blocked.");
  }
}

window.printBasketLabel = function(orderId) {
  printBasketLabels([orderId]);
};

window.printSelectedOrderBasketLabels = function() {
  printBasketLabels(Array.from(selectedOrderIds));
};

window.printSelectedBasketLabels = function() {
  const orderIds = Array.from(
    document.querySelectorAll("[data-label-order-id]:checked")
  ).map(input => input.dataset.labelOrderId);
  printBasketLabels(orderIds);
};

window.printAllBasketLabels = function() {
  const orderIds = groupLinkedOrdersForAdmin(latestOrders)
    .filter(order =>
      !order.archived_at &&
      FULFILMENT_STATUSES.includes(order.status)
    )
    .map(order => order.id);
  printBasketLabels(orderIds);
};

function printHandDeliveryLabels(orderIds) {
  const requestedIds = new Set((orderIds || []).map(String));
  const orders = groupLinkedOrdersForAdmin(latestOrders).filter(order =>
    requestedIds.has(String(order.id)) &&
    order.collection_method === "delivery"
  );

  if (!orders.length) {
    alert("Select at least one delivery order for a hand-delivery label.");
    return;
  }

  const pdf = buildHandDeliveryLabelPdf(orders);
  const pdfUrl = pdf.output("bloburl");
  const printWindow = window.open(pdfUrl, "_blank");

  if (!printWindow) {
    const filename = orders.length === 1
      ? `${safeProductionFileName(orders[0].order_ref, "delivery")}-hand-delivery-label.pdf`
      : `little-keeps-${orders.length}-hand-delivery-labels.pdf`;
    pdf.save(filename);
    alert("The printable hand-delivery label PDF was downloaded because the print window was blocked.");
  }
}

window.printHandDeliveryLabel = function(orderId) {
  printHandDeliveryLabels([orderId]);
};

window.printSelectedOrderHandDeliveryLabels = function() {
  printHandDeliveryLabels(Array.from(selectedOrderIds));
};

window.printSelectedHandDeliveryLabels = function() {
  const orderIds = Array.from(
    document.querySelectorAll("[data-label-order-id]:checked")
  ).map(input => input.dataset.labelOrderId);
  printHandDeliveryLabels(orderIds);
};

window.printAllHandDeliveryLabels = function() {
  const orderIds = groupLinkedOrdersForAdmin(latestOrders)
    .filter(order =>
      !order.archived_at &&
      FULFILMENT_STATUSES.includes(order.status) &&
      order.collection_method === "delivery"
    )
    .map(order => order.id);
  printHandDeliveryLabels(orderIds);
};

window.openSelectedDeliveryRoute = function() {
  const addresses = Array.from(
    document.querySelectorAll("[data-route-address]:checked")
  ).map(input => input.dataset.routeAddress);
  const url = buildGoogleMapsRouteUrl(addresses);

  if (!url) {
    alert("Select at least one delivery stop.");
    return;
  }
  window.open(url, "_blank", "noopener");
};

window.assignProductionPrinter = async function(jobId, printerId) {
  if (IS_ADMIN_PREVIEW) {
    const job = productionJobs.find(item => String(item.id) === String(jobId));
    if (job) job.printer_id = printerId || null;
    await renderProductionPlanner(latestOrders);
    return;
  }
  const { error } = await supabase
    .from("production_jobs")
    .update({ printer_id: printerId || null, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) {
    alert("Unable to assign this printer. Run the operations migration first.");
    return;
  }
  await renderProductionPlanner(latestOrders);
};

window.markProductionQualityIssue = async function(jobId) {
  const notes = prompt("What went wrong with this print?", "Poor print quality");
  if (notes === null) return;

  if (IS_ADMIN_PREVIEW) {
    const job = productionJobs.find(item => String(item.id) === String(jobId));
    if (job) {
      job.quality_status = "reprint_needed";
      job.issue_notes = notes.trim();
    }
    await renderProductionPlanner(latestOrders);
    return;
  }
  const { error } = await supabase
    .from("production_jobs")
    .update({
      quality_status: "reprint_needed",
      issue_notes: notes.trim(),
      updated_at: new Date().toISOString()
    })
    .eq("id", jobId);
  if (error) {
    alert("Unable to flag this reprint. Run the operations migration first.");
    return;
  }
  await renderProductionPlanner(latestOrders);
};

window.togglePrinterStatus = async function(printerId) {
  const printer = printers.find(item => String(item.id) === String(printerId));
  if (!printer) return;
  const status = printer.status === "offline" ? "online" : "offline";

  if (!IS_ADMIN_PREVIEW) {
    const { error } = await supabase
      .from("printers")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", printer.id);
    if (error) {
      alert("Unable to update printer status.");
      return;
    }
  }
  printer.status = status;
  renderCurrentView();
};

function setActiveTab(activeTab) {

    todayViewBtn.classList.remove("active");
    ordersViewBtn.classList.remove("active");
    scheduleViewBtn.classList.remove("active");
    productionViewBtn.classList.remove("active");
    assemblyViewBtn.classList.remove("active");
    fulfilmentViewBtn.classList.remove("active");
    inventoryViewBtn.classList.remove("active");
    financeViewBtn.classList.remove("active");
    settingsViewBtn.classList.remove("active");

    activeTab.classList.add("active");

}

todayViewBtn.onclick = () => {
  currentView = "today";
  setActiveTab(todayViewBtn);
  renderCurrentView();
};

ordersViewBtn.onclick = () => {
  currentView = "orders";
  setActiveTab(ordersViewBtn);
  renderCurrentView();
};

scheduleViewBtn.onclick = () => {
  currentView = "schedule";
  setActiveTab(scheduleViewBtn);
  renderCurrentView();
};

productionViewBtn.onclick = () => {
  currentView = "production";
  setActiveTab(productionViewBtn);
  renderCurrentView();
};

assemblyViewBtn.onclick = () => {
  currentView = "assembly";
  setActiveTab(assemblyViewBtn);
  renderCurrentView();
};

fulfilmentViewBtn.onclick = () => {
  currentView = "fulfilment";
  setActiveTab(fulfilmentViewBtn);
  renderCurrentView();
};

inventoryViewBtn.onclick = () => {
  currentView = "inventory";
  setActiveTab(inventoryViewBtn);
  renderCurrentView();
};

financeViewBtn.onclick = async () => {
  currentView = "finance";
  setActiveTab(financeViewBtn);

  if (
    !businessFinancialsLoaded ||
    !businessExpensesLoaded ||
    !businessSubscriptionsLoaded
  ) {
    ordersContainer.innerHTML =
      `<p class="empty">Loading business finances...</p>`;
    await Promise.all([
      loadBusinessFinancials(),
      loadBusinessExpenses(),
      loadBusinessSubscriptions()
    ]);
  }

  renderCurrentView();
};

settingsViewBtn.onclick = async () => {
  currentView = "settings";
  setActiveTab(settingsViewBtn);

  if (!adminSettingsLoaded) {
    ordersContainer.innerHTML = `<p class="empty">Loading shop settings...</p>`;
    await loadAdminSettings();
  }

  renderCurrentView();
};

orderViewFilter.addEventListener("change", () => renderOrders(latestOrders));
orderSearch.addEventListener("input", () => renderOrders(latestOrders));
statusFilter.addEventListener("change", () => renderOrders(latestOrders));
paymentFilter.addEventListener("change", () => renderOrders(latestOrders));
fulfilmentFilter.addEventListener("change", () => renderOrders(latestOrders));
orderDateSort.addEventListener("change", () => renderOrders(latestOrders));

refreshBtn.onclick = loadOrders;
workshopNotesToggle.onclick = () => {
  const hidden = workshopNotesBody.hidden;
  workshopNotesBody.hidden = !hidden;
  workshopNotesToggle.setAttribute("aria-expanded", String(hidden));
};
workshopNotesInput.addEventListener("input", () => {
  workshopNotesSaveState.textContent = "Unsaved";
  clearTimeout(workshopNotesSaveTimer);
  workshopNotesSaveTimer = setTimeout(saveWorkshopNotes, 650);
});
await loadWorkshopNotes();
if (window.matchMedia("(max-width: 760px)").matches) {
  workshopNotesBody.hidden = true;
  workshopNotesToggle.setAttribute("aria-expanded", "false");
}
loadOrders();
