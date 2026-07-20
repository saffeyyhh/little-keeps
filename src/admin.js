import "./admin.css";
import { createClient } from "@supabase/supabase-js";
import emailjs from "@emailjs/browser";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const SUPABASE_URL = "https://jetamtthfenjyzcdklqm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_IXgEB4mpCTF3zOhkulGOYw_fcDwgiHf";

const EMAILJS_SERVICE = "service_joll6ie";
const EMAILJS_PUBLIC = "dRppqgrkwps-kd6W-";
const EMAILJS_PAYMENT_VERIFIED_TEMPLATE = "template_liazurv";


emailjs.init(EMAILJS_PUBLIC);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { data: sessionData } = await supabase.auth.getSession();

if (!sessionData.session) {
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
        <p class="eyebrow">Little Keeps</p>
        <h1>Workshop <span aria-hidden="true">♡</span></h1>
        <p>Your orders, production and fulfilment control centre.</p>
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
        <span aria-hidden="true">✨</span> Today
      </button>
      <button id="ordersViewBtn" class="workshop-tab" type="button">
        <span aria-hidden="true">📋</span> Orders
      </button>
      <button id="productionViewBtn" class="workshop-tab" type="button">
        <span aria-hidden="true">🖨️</span> Production
      </button>
      <button id="assemblyViewBtn" class="workshop-tab" type="button">
        <span aria-hidden="true">🧩</span> Assembly
      </button>
      <button id="settingsViewBtn" class="workshop-tab" type="button">
        <span aria-hidden="true">⚙️</span> Settings
      </button>
    </nav>

    <section class="workspace-panel">
      <div class="section-title">
        <div>
          <p class="section-kicker">Daily workspace</p>
          <h2 id="sectionTitle">Orders</h2>
        </div>

        <div class="admin-actions" id="ordersActions">
          <a class="new-order-btn" href="./index.html?manual=true">
            + Manual Order
          </a>

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
            <option value="Payment Verified">Ready to print</option>
            <option value="Printing">Printing</option>
            <option value="Ready for Pickup/Delivery">Ready</option>
            <option value="Out for Delivery">Out for Delivery</option>
            <option value="Completed">Completed</option>
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
      </div>

      <div id="orders">
        <p class="empty">Loading orders...</p>
      </div>
    </section>
  </main>
`;

const ordersContainer = document.getElementById("orders");
const statsContainer = document.getElementById("stats");
const operationsSummary = document.getElementById("operationsSummary");
const refreshBtn = document.getElementById("refreshBtn");
const todayViewBtn = document.getElementById("todayViewBtn");
const ordersViewBtn = document.getElementById("ordersViewBtn");
const productionViewBtn = document.getElementById("productionViewBtn");
const sectionTitle = document.getElementById("sectionTitle");
const ordersActions = document.getElementById("ordersActions");
const assemblyViewBtn = document.getElementById("assemblyViewBtn");
const settingsViewBtn = document.getElementById("settingsViewBtn");

const orderFilters = document.getElementById("orderFilters");
const orderSearch = document.getElementById("orderSearch");
const orderViewFilter = document.getElementById("orderViewFilter");
const statusFilter = document.getElementById("statusFilter");
const paymentFilter = document.getElementById("paymentFilter");

const logoutBtn = document.getElementById("logoutBtn");

const { data: { session } } = await supabase.auth.getSession();


console.log(session);

logoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  location.reload();
};

let currentView = "today";
let latestOrders = [];

let inventoryItems = {};
let adminShopSettings = {};
let adminPromoCodes = [];

const ACTIVE_ORDER_STATUSES = [
  "Rush Review",
  "Bulk Review",
  "Pending Payment",
  "Payment Verification",
  "Payment Verified",
  "Printing",
  "Ready for Pickup/Delivery",
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
    itemName: "Key Ring",
    label: "Key Ring",
    category: "Hardware"
  },
  {
    itemName: "Jump Ring",
    label: "Jump Ring",
    category: "Hardware"
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
  "Payment Verification": { percent: 15, label: "Checking payment" },
  "Payment Verified": { percent: 30, label: "Ready for production" },
  "Printing": { percent: 58, label: "Printing parts" },
  "Ready for Pickup/Delivery": { percent: 84, label: "Ready to fulfil" },
  "Out for Delivery": { percent: 94, label: "Out for delivery" },
  "Completed": { percent: 100, label: "Completed" }
};

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
      </span>
      <span class="today-order-right">
        <b>${escapeAdminHtml(due.label)}</b>
        <small>${escapeAdminHtml(order.status || "-")}</small>
      </span>
    </button>
  `;
}

function renderTodayWorkspace(orders) {
  const priority = getPriorityOrders(orders);
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
  const fulfilment = priority.filter(order =>
    ["Ready for Pickup/Delivery", "Out for Delivery"].includes(order.status)
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

    ${lowStock.length ? `
      <div class="stock-alert">
        <strong>Low-stock reminder</strong>
        <span>${lowStock.map(item => `${escapeAdminHtml(item.label)}: ${item.qty}`).join(" · ")}</span>
      </div>
    ` : ""}

    <div class="today-grid">
      ${section("Rush & bulk requests", "⚡", specialRequests, "No special requests need review.")}
      ${section("Due today or tomorrow", "⏰", dueNow, "Nothing urgent—lovely!")}
      ${section("Payment attention", "💳", awaitingPayment, "No payments need attention.")}
      ${section("Print & assemble", "🖨️", production, "Production is caught up.")}
      ${section("Pickup & delivery", "📦", fulfilment, "Nothing is waiting for fulfilment.")}
    </div>
  `;
}

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

function renderSettingsWorkspace() {
  const checked = value => value ? "checked" : "";

  ordersContainer.innerHTML = `
    <form id="shopSettingsForm" class="settings-workspace">
      <div class="settings-intro">
        <div>
          <h2>Run the shop without editing code</h2>
          <p class="hint">Pricing, capacity, turnaround, email updates and stock reminders are controlled here.</p>
        </div>
        <button class="ready-btn" type="submit">Save Settings</button>
      </div>

      <div class="settings-grid">
        <section class="settings-card">
          <h3>Pricing</h3>
          <div class="settings-fields two-columns">
            ${settingNumber("usual_base_price", "Usual price ($)", "0.10")}
            ${settingNumber("launch_base_price", "Launch price ($)", "0.10")}
            ${settingNumber("included_characters", "Characters included")}
            ${settingNumber("extra_character_price", "Extra character ($)", "0.10")}
            ${settingNumber("delivery_fee", "Delivery fee ($)", "0.10")}
            ${settingNumber("free_delivery_threshold", "Free delivery from ($)", "0.10")}
          </div>
          <label class="settings-toggle"><input name="launch_price_enabled" type="checkbox" ${checked(adminShopSettings.launch_price_enabled)}> Show launch price and crossed-out usual price</label>
        </section>

        <section class="settings-card">
          <h3>Capacity & turnaround</h3>
          <div class="settings-fields two-columns">
            ${settingNumber("max_orders_per_date", "Orders allowed per date")}
            ${settingNumber("large_order_quantity", "Large order starts at")}
            ${settingNumber("bulk_order_quantity", "Bulk request starts at")}
            ${settingNumber("standard_min_working_days", "Normal minimum days")}
            ${settingNumber("standard_max_working_days", "Normal maximum days")}
            ${settingNumber("large_min_working_days", "Large minimum days")}
            ${settingNumber("large_max_working_days", "Large maximum days")}
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
            ${settingNumber("key_ring_low_stock", "Warn when key rings reach")}
            ${settingNumber("jump_ring_low_stock", "Warn when jump rings reach")}
          </div>
        </section>

        <section class="settings-card">
          <h3>Customer updates</h3>
          <label class="settings-toggle"><input name="status_emails_enabled" type="checkbox" ${checked(adminShopSettings.status_emails_enabled)}> Automatically email important status changes</label>
          <label class="settings-field">
            <span>EmailJS status-template ID</span>
            <input name="status_email_template_id" value="${escapeAdminHtml(adminShopSettings.status_email_template_id || "")}" placeholder="template_xxxxxxx">
          </label>
          <p class="hint">Use the supplied status email HTML in EmailJS, then paste that template ID here.</p>
        </section>

        <section class="settings-card settings-card-wide">
          <h3>Online payment</h3>
          <div class="payment-readiness">
            <div>
              <strong>${adminShopSettings.stripe_enabled ? "Stripe PayNow enabled" : "Manual PayNow remains active"}</strong>
              <p class="hint">Stripe securely creates the exact PayNow amount and verifies successful payments automatically.</p>
            </div>
            <label class="settings-toggle"><input name="stripe_enabled" type="checkbox" ${checked(adminShopSettings.stripe_enabled)}> Enable Stripe PayNow checkout</label>
          </div>
        </section>
      </div>

      <section class="settings-card promo-manager">
        <div class="settings-card-heading">
          <div><h3>Promo codes</h3><p class="hint">Add several codes and switch them on or off anytime.</p></div>
        </div>
        <div class="promo-create-row">
          <input id="promoCodeInput" placeholder="CODE" maxlength="30">
          <input id="promoLabelInput" placeholder="Label, e.g. Teacher's Day">
          <select id="promoTypeInput"><option value="percent">Percent off</option><option value="fixed">Fixed amount</option></select>
          <input id="promoValueInput" type="number" min="0.01" step="0.01" placeholder="Value">
          <input id="promoMinimumInput" type="number" min="0" step="0.01" value="0" placeholder="Minimum spend">
          <button class="ready-btn" type="button" onclick="window.addPromoCode()">Add Code</button>
        </div>
        <div class="promo-admin-list">
          ${adminPromoCodes.map(promo => `
            <div class="promo-admin-row">
              <div><strong>${escapeAdminHtml(promo.code)}</strong><span>${escapeAdminHtml(promo.label || "Promo")}</span></div>
              <span>${promo.discount_type === "fixed" ? formatMoney(promo.discount_value) : `${Number(promo.discount_value)}%`} off</span>
              <span>Min. ${formatMoney(promo.minimum_spend)}</span>
              <button type="button" class="${promo.active ? "archive-action" : ""}" onclick='window.togglePromoCode(${JSON.stringify(promo.code)}, ${!promo.active})'>${promo.active ? "Pause" : "Enable"}</button>
            </div>
          `).join("") || `<p class="today-empty">No promo codes yet.</p>`}
        </div>
      </section>
    </form>
  `;

  document.getElementById("shopSettingsForm").addEventListener("submit", saveShopSettings);
}

async function saveShopSettings(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const numberFields = [
    "usual_base_price", "launch_base_price", "included_characters", "extra_character_price",
    "delivery_fee", "free_delivery_threshold", "max_orders_per_date", "large_order_quantity",
    "bulk_order_quantity",
    "standard_min_working_days", "standard_max_working_days", "large_min_working_days",
    "large_max_working_days", "rush_fee_small", "rush_fee_large", "rush_max_missing_parts",
    "rush_max_active_orders", "mechanical_switch_low_stock", "key_ring_low_stock", "jump_ring_low_stock"
  ];
  const updates = { id: 1 };
  numberFields.forEach(name => { updates[name] = Number(form.get(name)); });
  updates.launch_price_enabled = form.has("launch_price_enabled");
  updates.status_emails_enabled = form.has("status_emails_enabled");
  updates.stripe_enabled = form.has("stripe_enabled");
  updates.status_email_template_id = String(form.get("status_email_template_id") || "").trim();
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase.from("shop_settings").upsert(updates).select().single();
  if (error) {
    console.error("Unable to save settings:", error);
    alert("Unable to save settings. Run the supplied operations SQL once, then try again.");
    return;
  }

  adminShopSettings = data;
  alert("Shop settings saved ✓");
  renderSettingsWorkspace();
}

async function addPromoCode() {
  const code = document.getElementById("promoCodeInput").value.trim().toUpperCase();
  const label = document.getElementById("promoLabelInput").value.trim() || code;
  const discountType = document.getElementById("promoTypeInput").value;
  const discountValue = Number(document.getElementById("promoValueInput").value);
  const minimumSpend = Number(document.getElementById("promoMinimumInput").value || 0);

  if (!/^[A-Z0-9_-]+$/.test(code) || discountValue <= 0) {
    alert("Enter a valid code and discount value.");
    return;
  }

  const { error } = await supabase.from("promo_codes").upsert({
    code, label, discount_type: discountType, discount_value: discountValue,
    minimum_spend: minimumSpend, active: true, updated_at: new Date().toISOString()
  });
  if (error) {
    console.error("Unable to add promo:", error);
    alert("Unable to save the promo code. Check the supplied SQL has been run.");
    return;
  }

  await loadAdminSettings();
  renderSettingsWorkspace();
}

async function togglePromoCode(code, active) {
  const { error } = await supabase.from("promo_codes").update({
    active, updated_at: new Date().toISOString()
  }).eq("code", code);
  if (error) return alert("Unable to update that promo code.");
  await loadAdminSettings();
  renderSettingsWorkspace();
}

window.addPromoCode = addPromoCode;
window.togglePromoCode = togglePromoCode;

window.markReady = async function(id) {
  const order = latestOrders.find(
    order => String(order.id) === String(id)
  );

  if (!order) return;

  await loadInventoryItems();

  const needs = getOrderInventoryNeeds(order);

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

  const ok = confirm(
    `Mark ${order.order_ref} as ready?\n\n` +
    `This will deduct the printed parts and hardware for this order only.`
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

  try {
    await sendOrderStatusEmail(
      { ...order, status: "Ready for Pickup/Delivery" },
      "Ready for Pickup/Delivery"
    );
  } catch (error) {
    console.error("Ready email failed:", error);
    alert("Order is ready and stock was deducted, but the customer email failed to send.");
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

function getMethodLabel(method) {
  return method === "delivery" ? "Delivery" : "Pickup";
}

function escapeAdminHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getOrderCharacterCount(order) {
  return (order.order_data || []).reduce((sum, item) => {
    return sum + Array.from(item.clean_name || sanitizeName(item.name || "")).length;
  }, 0);
}

function getOrderKeychainCount(order) {
  return (order.order_data || []).length;
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

function getDaysUntil(dateValue) {
  if (!dateValue) return null;

  const dueDate = new Date(`${String(dateValue).slice(0, 10)}T23:59:59`);

  if (Number.isNaN(dueDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.ceil((dueDate - today) / 86400000);
}

function getDuePresentation(order) {
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
    order => order.status === "Ready for Pickup/Delivery"
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
    order => order.status === "Ready for Pickup/Delivery"
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

function renderOrders(orders) {
  const searchText = orderSearch.value.toLowerCase();
  const orderViewValue = orderViewFilter.value;
  const statusValue = statusFilter.value;
  const paymentValue = paymentFilter.value;

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      (order.order_ref || "").toLowerCase().includes(searchText) ||
      (order.customer_name || "").toLowerCase().includes(searchText) ||
      (order.customer_email || "").toLowerCase().includes(searchText);

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

    return matchesSearch && matchesOrderView && matchesStatus && matchesPayment;
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

  ordersContainer.innerHTML = filteredOrders.map(order => {
    const due = getDuePresentation(order);
    const orderId = String(order.id);
    const orderRef = escapeAdminHtml(order.order_ref || "-");
    const customerName = escapeAdminHtml(order.customer_name || "-");
    const customerEmail = escapeAdminHtml(order.customer_email || "-");
    const customerPhone = escapeAdminHtml(order.customer_phone || "-");
    const keychainCount = getOrderKeychainCount(order);
    const characterCount = getOrderCharacterCount(order);
    const whatsappHref = getWhatsAppHref(order.customer_phone);

    return `
    <details class="order-card ${due.className} ${order.archived_at ? "is-archived" : ""}" data-order-id="${escapeAdminHtml(orderId)}" data-status="${escapeAdminHtml(order.status || "")}">
      <summary class="order-summary">
        <div class="order-summary-customer">
          <p class="order-ref-label">${orderRef}</p>
          <h3>${customerName}</h3>
          <div class="order-summary-badges">
            <span class="order-status-badge">${escapeAdminHtml(order.status || "-")}</span>
            <span class="due-badge ${due.className}">${escapeAdminHtml(due.label)}</span>
            ${order.archived_at ? `<span class="archive-badge">Archived</span>` : ""}
          </div>
          ${renderProgressBar(order, true)}
        </div>

        <div class="order-summary-meta">
          <strong>${formatMoney(order.total)}</strong>
          <span>${keychainCount} keychain${keychainCount === 1 ? "" : "s"}</span>
          <span>${characterCount} character${characterCount === 1 ? "" : "s"} · ${getMethodLabel(order.collection_method)}</span>
        </div>
      </summary>

      <div class="order-detail-grid">
        <p><strong>Customer Name</strong><br>${customerName}</p>
        <p><strong>Email</strong><br>${customerEmail}</p>
        <p><strong>Phone</strong><br>${customerPhone}</p>
        <p><strong>Order Reference</strong><br>${orderRef}</p>

        <p><strong>Collection Method</strong><br>${getMethodLabel(order.collection_method)}</p>
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
                Woodlands MRT
              </p>
            `
        }

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
        ${Number(order.rush_fee || 0) > 0 ? `<p><strong>Rush Fee</strong><br>${formatMoney(order.rush_fee)}</p>` : ""}
        <p><strong>Total</strong><br>${formatMoney(order.total)}</p>
        <p><strong>Order Source</strong><br>${escapeAdminHtml(order.order_source || "-")}</p>
      </div>

      <div class="order-quick-actions">
        ${["Rush Review", "Bulk Review"].includes(order.status) ? `
          <button type="button" class="approve-request-action" onclick='window.approveSpecialOrder(${JSON.stringify(orderId)})'>
            Approve Request
          </button>
        ` : ""}

        <button type="button" onclick='window.copyOrderReference(${JSON.stringify(orderId)})'>
          Copy Reference
        </button>

        ${order.customer_email ? `
          <a href="mailto:${encodeURIComponent(order.customer_email)}?subject=${encodeURIComponent(`Little Keeps order ${order.order_ref || ""}`)}">
            Email Customer
          </a>
        ` : ""}

        ${order.customer_email && (order.payment_type === "Paid" || order.status === "Payment Verified") ? `
          <button type="button" class="approve-request-action" onclick='window.sendPaymentConfirmationEmail(${JSON.stringify(orderId)}, this)'>
            Send Confirmation + PDF
          </button>
        ` : ""}

        ${whatsappHref ? `
          <a href="${whatsappHref}" target="_blank" rel="noopener">
            WhatsApp
          </a>
        ` : ""}

        <button type="button" onclick='window.downloadOrderPdf(${JSON.stringify(orderId)}, this)'>
          Download PDF
        </button>

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
      onchange="window.updateOrderStatus('${order.id}', this.value)"
    >
      ${order.status === "Rush Review" ? `<option value="Rush Review" selected>Rush request — review</option>` : ""}
      ${order.status === "Bulk Review" ? `<option value="Bulk Review" selected>Bulk request — review</option>` : ""}
      ${order.status === "Payment Verification" ? `<option value="Payment Verification" selected>Manual payment — check</option>` : ""}
      <option value="Pending Payment" ${order.status === "Pending Payment" ? "selected" : ""}>Awaiting payment</option>
      <option value="Payment Verified" ${order.status === "Payment Verified" ? "selected" : ""}>Paid — ready to print</option>
      <option value="Printing" ${order.status === "Printing" ? "selected" : ""}>Printing</option>
      <option value="Ready for Pickup/Delivery" ${order.status === "Ready for Pickup/Delivery" ? "selected" : ""}>${order.collection_method === "delivery" ? "Ready for delivery" : "Ready for pickup"}</option>
      ${order.collection_method === "delivery" ? `<option value="Out for Delivery" ${order.status === "Out for Delivery" ? "selected" : ""}>Out for Delivery</option>` : ""}
      <option value="Completed" ${order.status === "Completed" ? "selected" : ""}>Completed</option>
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

          <span class="assembly-tag">
            ${baseShape === "bubbly" ? "Bubbly Base" : "Ribbed Base"}
          </span>

          <span class="assembly-tag">
            ${letterOrientation === "horizontal" ? "Sideways Letters" : "Upright Letters"}
          </span>
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

function getBaseInventoryName(baseName, baseShape = "ribbed") {
  const shapeLabel =
    baseShape === "bubbly" ? "Bubbly" : "Ribbed";

  return `${baseName} ${shapeLabel} Base`;
}

function getKeycapInventoryName(
  capName,
  letterName,
  character,
  orientation = "vertical"
) {
  const orientationSuffix =
    orientation === "horizontal" ? " - Sideways" : "";

  return `${capName} Cap + ${letterName} Letter - ${character}${orientationSuffix}`;
}

async function loadInventoryItems() {
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

function getInventoryQty(itemName) {
  return inventoryItems[itemName]?.qty || 0;
}

async function addInventory(itemName, qtyToAdd, category) {
  const qty = Number(qtyToAdd);

  if (!Number.isInteger(qty) || qty <= 0) {
    alert("Please enter a valid quantity.");
    return;
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
      return;
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
      return;
    }
  }

  await renderProductionPlanner(latestOrders);
}

async function addCustomInventory(itemName, qtyToAdd, category) {
  const qty = Number(qtyToAdd);

  if (!Number.isInteger(qty) || qty <= 0) {
    alert("Please enter a valid printed quantity.");
    return;
  }

  await addInventory(itemName, qty, category);
}

window.addCustomInventory = addCustomInventory;

window.addInventory = addInventory;

function getProductionSummary(orders) {
  const baseTotals = {};
  const keycapGroups = {};

  const activeOrders = orders.filter(order =>
    !order.archived_at && ["Payment Verified", "Printing"].includes(order.status)
  );

  activeOrders.forEach(order => {
    const items = order.order_data || [];

    items.forEach(item => {
      const cleanName = item.clean_name || item.name || "";
      const letters = Array.from(cleanName);
      const design = item.design;

      if (!design) return;

      const letterOrientation = getLetterOrientation(design);

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
          `${capName} Cap + ${letterName} Letter|${letterOrientation}`;

        if (!keycapGroups[groupKey]) {
          keycapGroups[groupKey] = {
            capName,
            capHex,
            letterName,
            letterHex,
            letterOrientation,
            letters: {}
          };
        }

        keycapGroups[groupKey].letters[letter] =
          (keycapGroups[groupKey].letters[letter] || 0) + 1;
      });
    });
  });

  return { baseTotals, keycapGroups, count: activeOrders.length };
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

    const letterOrientation = getLetterOrientation(design);

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

      add(

        getBaseInventoryName(baseName, baseShape),

        1

      );

      add(

        getKeycapInventoryName(

          capName,

          letterName,

          letter,

          letterOrientation

        ),

        1

      );
    });
  });

  add("Mechanical Switch", (order.order_data || []).reduce((sum, item) => {
    return sum + (item.clean_name || item.name || "").length;
  }, 0));

  add("Key Ring", (order.order_data || []).length);
  add("Jump Ring", (order.order_data || []).length);

  return needs;
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

const productionStlJobs = new Map();
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
        letterOrientation:
          row.letterOrientation || job.letterOrientation || "vertical"
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

        return prepareProductionKeycapGeometry(
          geometry,
          item.letterOrientation
        );
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

    const columns = Math.min(8, Math.ceil(Math.sqrt(sourceGeometries.length)));
    const spacing = 4;
    const cellWidth = widest + spacing;
    const cellDepth = deepest + spacing;

    const arrangedGeometries = sourceGeometries.map((geometry, index) => {
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

    const mergedGeometry = mergeGeometries(arrangedGeometries, false);

    if (!mergedGeometry) {
      throw new Error("The selected keycaps could not be combined.");
    }

    mergedGeometry.computeVertexNormals();

    const mesh = new THREE.Mesh(mergedGeometry);
    const binaryStl = productionStlExporter.parse(mesh, { binary: true });
    const blob = new Blob([binaryStl], { type: "model/stl" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const capName = safeProductionFileName(job.capName, "cap");
    const letterName = safeProductionFileName(job.letterName, "letter");

    link.href = downloadUrl;
    const orientationName =
      job.letterOrientation === "horizontal" ? "sideways" : "upright";

    link.download = `${capName}-cap_${letterName}-letter_${orientationName}_${requestedKeycaps.length}-pieces.stl`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

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

function getRushOrderPrintGroups(order) {
  const baseGroups = {};
  const keycapGroups = {};

  getEmailOrderItems(order).forEach(item => {
    const design = item.design || {};
    const characters = Array.from(item.clean_name || sanitizeName(item.name || ""));
    const bases = Array.isArray(design.bases) ? design.bases : [];
    const caps = Array.isArray(design.caps) ? design.caps : [];
    const letters = Array.isArray(design.letters) ? design.letters : [];

    if (!characters.length || !bases.length || !caps.length || !letters.length) return;

    const baseShape = design.base_shape?.key || design.baseShape || "ribbed";
    const letterOrientation = getLetterOrientation(design);

    characters.forEach((character, index) => {
      const base = bases[index % bases.length];
      const cap = caps[index % caps.length];
      const letterColour = letters[index % letters.length];
      const baseName = base?.name || base?.hex || base || "Base";
      const capName = cap?.name || cap?.hex || cap || "Cap";
      const letterName = letterColour?.name || letterColour?.hex || letterColour || "Letter";
      const baseKey = `${baseShape}|${baseName}`;
      const keycapKey = `${capName}|${letterName}|${letterOrientation}`;

      if (!baseGroups[baseKey]) {
        baseGroups[baseKey] = { baseShape, baseName, quantity: 0 };
      }
      baseGroups[baseKey].quantity += 1;

      if (!keycapGroups[keycapKey]) {
        keycapGroups[keycapKey] = {
          capName,
          letterName,
          letterOrientation,
          characters: []
        };
      }
      keycapGroups[keycapKey].characters.push(character);
    });
  });

  return {
    bases: Object.values(baseGroups),
    keycaps: Object.values(keycapGroups)
  };
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

  const groups = getRushOrderPrintGroups(order);
  const totalFiles = groups.bases.length + groups.keycaps.length;
  const totalPieces =
    groups.bases.reduce((sum, group) => sum + group.quantity, 0) +
    groups.keycaps.reduce((sum, group) => sum + group.characters.length, 0);

  if (!totalFiles || !totalPieces) {
    alert("This order does not contain enough saved design information to generate STL files.");
    return;
  }

  const summary = [
    ...groups.bases.map(group =>
      `${group.baseName} ${group.baseShape === "bubbly" ? "Bubbly" : "Ribbed"} Bases × ${group.quantity}`
    ),
    ...groups.keycaps.map(group =>
      `${group.capName} Cap + ${group.letterName} Letter (${group.letterOrientation === "horizontal" ? "Sideways" : "Upright"}) × ${group.characters.length}`
    )
  ];

  if (!confirm(
    `Generate rush-order STLs for ${order.order_ref}?\n\n` +
    summary.join("\n") +
    `\n\n${totalFiles} separate colour/shape file${totalFiles === 1 ? "" : "s"} will download.`
  )) return;

  const previousLabel = button?.textContent || "Generate Order STLs";
  if (button) {
    button.disabled = true;
    button.textContent = "Building rush STLs…";
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

    for (const group of groups.keycaps) {
      const requests = group.characters.map(character => ({
        kind: "keycap",
        path: getProductionKeycapPath(character),
        orientation: group.letterOrientation
      }));
      const blob = await buildRushStlPlate(requests);
      files.push({
        blob,
        filename: `${reference}_KEYCAP_${safeProductionFileName(group.capName, "cap")}_${safeProductionFileName(group.letterName, "letter")}_${group.letterOrientation}_${group.characters.length}pcs.stl`
      });
    }

    files.forEach((file, index) => {
      setTimeout(() => downloadRushStl(file.blob, file.filename), index * 350);
    });

    if (button) button.textContent = `Downloaded ${files.length} STL${files.length === 1 ? "" : "s"} ✓`;
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
            <span style="display:inline-block;transform:${getLetterOrientation(design) === "horizontal" ? "rotate(90deg)" : "none"};">
              ${displayIcon(letter)}
            </span>
          </div>
        </div>
      `;
    })
    .join("");
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

  const readyOrders = candidateOrders.filter(order => {
    const needs = getOrderInventoryNeeds(order);

    return Object.entries(needs).every(([itemName, qtyNeeded]) => {
      return getInventoryQty(itemName) >= qtyNeeded;
    });
  });

  ordersContainer.innerHTML = `    
  <div class="production-card">
      <div class="production-header">
        <div>
          <h2>Assembly Queue</h2>
          <p class="hint">
            Printed stock is reserved by needed-by date.
          </p>
        </div>

        <p class="active-count">${readyOrders.length} order(s)</p>
      </div>

      ${
        readyOrders.length === 0
          ? `
            <div class="empty-card">
              <h3>No orders ready for assembly yet</h3>
              <p>Print the missing parts shown in Production first.</p>
            </div>
          `
          : readyOrders.map((order, index) => `
            <details class="assembly-card" ${index === 0 ? "open" : ""}>
              <summary class="assembly-summary">
                <div>
                  <h3>${order.customer_name || "-"}</h3>
                  <p>${order.order_ref}</p>
                </div>

                <div class="assembly-meta">
                  <span>${(order.order_data || []).length} keychain(s)</span>
                  <span>${getMethodLabel(order.collection_method)}</span>
                  <span>${formatDate(order.needed_by)}</span>
                </div>
              </summary>

              <div class="assembly-body">
                ${(order.order_data || []).map(item => {
                  const baseShape =
                    item.design?.base_shape?.key ||
                    item.design?.baseShape ||
                    "ribbed";
                  const letterOrientation = getLetterOrientation(item.design);

                  return `
                    <div class="assembly-item">
                      <div class="assembly-item-top">
                        <strong>${item.name}</strong>

                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                          <span class="assembly-tag">
                            ${sanitizeName(item.name).length} Letters
                          </span>

                          <span class="assembly-tag">
                            ${baseShape === "bubbly" ? "Bubbly Base" : "Ribbed Base"}
                          </span>

                          <span class="assembly-tag">
                            ${letterOrientation === "horizontal" ? "Sideways Letters" : "Upright Letters"}
                          </span>
                        </div>
                      </div>

                      <div class="mini-chain">
                        ${createAssemblyMiniPreview(item.name, item.design)}
                      </div>
                    </div>
                  `;
                }).join("")}

                <button
                  class="ready-btn"
                  onclick="window.markReady('${order.id}')"
                >
                  Assembly Complete
                </button>
              </div>
            </details>
          `).join("")
      }
    </div>
  `;
}

async function renderProductionPlanner(orders) {
  await loadInventoryItems();

  const { baseTotals, keycapGroups, count } = getProductionSummary(orders);

  const baseRows = Object.values(baseTotals)
    .map(item => {
      const baseShape = item.baseShape || "ribbed";

      const itemName = getBaseInventoryName(
        item.name,
        baseShape
      );
      const need = item.qty;
      const stock = getInventoryQty(itemName);
      const toPrint = Math.max(0, need - stock);

      return { ...item, itemName, need, stock, toPrint };
    })
    .filter(item => item.toPrint > 0);

  const baseShapeGroups = [
    { key: "bubbly", label: "Bubbly Bases" },
    { key: "ribbed", label: "Ribbed Bases" }
  ].map(group => ({
    ...group,
    rows: baseRows
      .filter(item => (item.baseShape || "ribbed").toLowerCase() === group.key)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
  }));

  productionStlJobs.clear();

  const keycapGroupHtml = Object.entries(keycapGroups).map(([groupKey, group], groupIndex) => {
    const allRows = Object.entries(group.letters)
      .sort((a, b) => b[1] - a[1])
      .map(([letter, qty]) => {
    const itemName = getKeycapInventoryName(
      group.capName,
      group.letterName,
      letter,
      group.letterOrientation
    );
        const need = qty;
        const stock = getInventoryQty(itemName);
        const toPrint = Math.max(0, need - stock);

        return { letter, itemName, need, stock, toPrint };
      });

    const rows = allRows.filter(row => row.toPrint > 0);
    const totalNeeded = allRows.reduce((sum, row) => sum + row.need, 0);
    const totalReady = allRows.reduce(
      (sum, row) => sum + Math.min(row.stock, row.need),
      0
    );
    const totalLeft = Math.max(0, totalNeeded - totalReady);
    const progressPercent = totalNeeded
      ? Math.round((totalReady / totalNeeded) * 100)
      : 100;

    if (!rows.length) return "";

    const stlJobId = `keycap-combination-${groupIndex}`;

    productionStlJobs.set(stlJobId, {
      capName: group.capName,
      letterName: group.letterName,
      letterOrientation: group.letterOrientation,
      rows: rows.map(row => ({
        letter: row.letter,
        letterOrientation: group.letterOrientation,
        toPrint: row.toPrint,
        inputId: `printQty-${encodeURIComponent(row.itemName)}`
      }))
    });

    return `
      <details class="print-group" open>
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
                ${group.letterOrientation === "horizontal" ? "Horizontal / Sideways" : "Vertical / Upright"}
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
                Need: ${row.need} · Stock: ${row.stock} · To Print: ${row.toPrint}
              </p>
            </div>

            <div class="print-qty-control">
              <input
                type="number"
                min="1"
                value="${row.toPrint}"
                id="printQty-${encodeURIComponent(row.itemName)}"
              >

              <button
                class="ready-btn"
                onclick='window.addCustomInventory(
                  ${JSON.stringify(row.itemName)},
                  document.getElementById(${JSON.stringify(`printQty-${encodeURIComponent(row.itemName)}`)}).value,
                  "Keycap"
                )'
              >
                Add Printed
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
            Generate STL
          </button>

          <span class="hint">
            Uses the quantities above and arranges all pieces on one print plate.
          </span>
        </div>
      </details>
    `;
  }).join("");

  ordersContainer.innerHTML = `
    <div class="production-card">
      <div class="production-header">
        <div>
          <h2>Production Planner ♡</h2>
          <p class="hint">Only items that still need printing are shown.</p>
        </div>

        <p class="active-count">${count} active order(s)</p>
      </div>

      <h3>Base Printing</h3>

      <div class="base-shape-grid">
        ${baseShapeGroups.map(group => {
          const piecesLeft = group.rows.reduce((sum, item) => sum + item.toPrint, 0);

          return `
            <section class="print-group base-shape-group base-shape-${group.key}">
              <div class="base-shape-heading">
                <div>
                  <h4>${group.label}</h4>
                  <p class="hint">${piecesLeft} piece${piecesLeft === 1 ? "" : "s"} left to print</p>
                </div>
              </div>

              ${group.rows.map(item => `
                <div class="print-check-row">
                  <span class="colour-dot" style="background:${item.hex}"></span>

                  <div style="flex:1;">
                    <strong>${item.itemName}</strong>
                    <p class="hint">
                      Need: ${item.need} · Stock: ${item.stock} · To Print: ${item.toPrint}
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
                      onclick='window.addCustomInventory(
                        ${JSON.stringify(item.itemName)},
                        document.getElementById(${JSON.stringify(`printQty-${encodeURIComponent(item.itemName)}`)}).value,
                        "Base"
                      )'
                    >
                      Add Printed
                    </button>
                  </div>
                </div>
              `).join("") || `<p class="base-shape-complete">✓ No ${group.label.toLowerCase()} need printing.</p>`}
            </section>
          `;
        }).join("")}
      </div>

      <h3>Hardware Stock</h3>

<div class="print-group">
  ${hardwareItems.map(item => {
    const stock = getInventoryQty(item.itemName);

    return `
      <div class="print-check-row">

        <div style="flex:1;">
          <strong>${item.label}</strong>
          <p class="hint">
            Current Stock: ${stock}
          </p>
        </div>

        <div class="print-qty-control">
          <input
            type="number"
            min="1"
            value="1"
            id="hardware-${encodeURIComponent(item.itemName)}"
          >

          <button
            class="ready-btn"
            onclick='window.addCustomInventory(
              ${JSON.stringify(item.itemName)},
              document.getElementById(${JSON.stringify(`hardware-${encodeURIComponent(item.itemName)}`)}).value,
              "Hardware"
            )'
          >
            Add Stock
          </button>
        </div>

      </div>
    `;
  }).join("")}
</div>

      <h3>Keycap Printing</h3>

      <div class="keycap-grid">
        ${keycapGroupHtml || "<p>No keycaps need printing.</p>"}
      </div>
    </div>
  `;
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
          font-size:17px;
          font-weight:700;
          line-height:1;
        "><span style="display:inline-block;transform:${letterOrientation === "horizontal" ? "rotate(90deg)" : "none"};">${escapeEmailHtml(displayIcon(character))}</span></span>
      </span>
    `;
  }).join("");
}

async function generateOrderPdfAttachment(order, items) {
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
                  ${index + 1}. ${escapeEmailHtml(item.name || "Personalised keychain")}
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
        <strong>Pickup location:</strong> Woodlands MRT<br>
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

async function generateCompactOrderPdfAttachment(order, items) {
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
  const pdfIconCache = new Map();

  function getPdfIconImage(character) {
    if (pdfIconCache.has(character)) {
      return pdfIconCache.get(character);
    }

    const iconCanvas = document.createElement("canvas");
    iconCanvas.width = 48;
    iconCanvas.height = 48;

    const context = iconCanvas.getContext("2d");

    if (!context) {
      return null;
    }

    context.clearRect(0, 0, 48, 48);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font =
      '32px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    context.fillText(displayIcon(character), 24, 25);

    const image = iconCanvas.toDataURL("image/png");
    pdfIconCache.set(character, image);
    return image;
  }

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
    drawWrappedDetail("Pickup location", "Woodlands MRT");
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
    const colourLines = [
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
      )
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
      `${index + 1}. ${getCompactPdfText(item.name || "Personalised keychain")}`,
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

    const characters = Array.from(
      item.clean_name || sanitizeName(item.name || "")
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
          angle: letterOrientation === "horizontal" ? -90 : 0
        });
      } else {
        const iconImage = getPdfIconImage(character);

        if (iconImage) {
          const iconAlias =
            `icon-${character.codePointAt(0).toString(16)}`;

          pdf.addImage(
            iconImage,
            "PNG",
            blockX + 1.35,
            blockY + 1.15,
            6.3,
            6.3,
            iconAlias,
            "FAST",
            letterOrientation === "horizontal" ? -90 : 0
          );
        } else {
          pdf.setTextColor(...letterRgb);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(7);
          pdf.text("*", blockX + 4.5, blockY + 5.7, {
            align: "center",
            angle: letterOrientation === "horizontal" ? -90 : 0
          });
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

          return `${index + 1}. ${name} — ${price}`;
        })
        .join("\n")
    : "No item details available.";

  console.log("Order list being emailed:", orderList);

  const orderPdf = await generateCompactOrderPdfAttachment(order, items);

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
    const pdfBase64 = await generateCompactOrderPdfAttachment(order, items);
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
  const updatedTotal = originalTotalWithoutRush + rushFee;
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

window.copyOrderReference = copyOrderReference;
window.downloadOrderPdf = downloadOrderPdf;
window.sendPaymentConfirmationEmail = sendPaymentConfirmationEmail;
window.deleteTestOrder = deleteTestOrder;
window.archiveOrder = archiveOrder;
window.restoreOrder = restoreOrder;
window.approveSpecialOrder = approveSpecialOrder;

function getStatusEmailContent(order, status) {
  const isDelivery = order.collection_method === "delivery";

  if (status === "Ready for Pickup/Delivery") {
    return isDelivery
      ? {
          title: "Your order is ready for delivery!",
          message: "Your Little Keeps order has finished production and is packed safely. We’ll arrange its delivery shortly.",
          actionTitle: "What happens next",
          actionDetails: "Watch for another update when your order is handed to the courier or begins delivery."
        }
      : {
          title: "Your order is ready for pickup!",
          message: "Your Little Keeps order has finished production and is ready for collection.",
          actionTitle: "Pickup",
          actionDetails: "Pickup is at Woodlands MRT. Please reply to arrange a suitable collection time."
        };
  }

  if (status === "Out for Delivery") {
    return {
      title: "Your order is out for delivery!",
      message: "Your Little Keeps order is on its way to you.",
      actionTitle: order.courier_name ? `Delivery by ${order.courier_name}` : "Delivery update",
      actionDetails: order.tracking_number
        ? `Tracking number: ${order.tracking_number}`
        : "This order is being delivered personally, so a courier tracking number may not be available."
    };
  }

  if (status === "Completed") {
    return {
      title: "Your Little Keeps order is complete!",
      message: "Your order has been collected or delivered. Thank you so much for supporting Little Keeps!",
      actionTitle: "Thank you ♡",
      actionDetails: "If anything is not quite right, please reply to this email and we’ll help."
    };
  }

  return null;
}

async function sendOrderStatusEmail(order, status) {
  if (!adminShopSettings.status_emails_enabled) return { skipped: true };

  const templateId = String(adminShopSettings.status_email_template_id || "").trim();
  const content = getStatusEmailContent(order, status);
  if (!templateId || !content || !order.customer_email) return { skipped: true };

  await emailjs.send(EMAILJS_SERVICE, templateId, {
    to_email: order.customer_email,
    customer_name: order.customer_name || "Customer",
    order_ref: order.order_ref || "-",
    update_title: content.title,
    update_message: content.message,
    action_title: content.actionTitle,
    action_details: content.actionDetails,
    has_tracking: Boolean(order.tracking_number),
    tracking_number: order.tracking_number || "",
    tracking_url: order.tracking_url || "",
    courier_name: order.courier_name || "",
    collection_method: getMethodLabel(order.collection_method),
    needed_by: formatDate(order.needed_by)
  });

  return { sent: true };
}

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

  const { error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", id);

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

  const shouldSendStatusUpdate =
    previousStatus !== status &&
    ["Ready for Pickup/Delivery", "Out for Delivery", "Completed"].includes(status);

  if (shouldSendStatusUpdate) {
    try {
      const result = await sendOrderStatusEmail({ ...order, ...updateData }, status);
      if (result.sent) alert(`Status updated and email sent to ${order.customer_email}.`);
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
  const defaults = {
    id: 1,
    usual_base_price: 3.90,
    launch_base_price: 3.20,
    launch_price_enabled: true,
    included_characters: 6,
    extra_character_price: 0.20,
    delivery_fee: 2.50,
    free_delivery_threshold: 50,
    max_orders_per_date: 5,
    large_order_quantity: 5,
    bulk_order_quantity: 10,
    standard_min_working_days: 2,
    standard_max_working_days: 3,
    large_min_working_days: 3,
    large_max_working_days: 4,
    rush_fee_small: 5,
    rush_fee_large: 8,
    rush_max_missing_parts: 60,
    rush_max_active_orders: 5,
    mechanical_switch_low_stock: 100,
    key_ring_low_stock: 20,
    jump_ring_low_stock: 20,
    status_emails_enabled: false,
    status_email_template_id: "",
    stripe_enabled: false
  };

  const [{ data: settings, error: settingsError }, { data: promos, error: promosError }] = await Promise.all([
    supabase.from("shop_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("promo_codes").select("*").order("created_at", { ascending: false })
  ]);

  if (settingsError) console.warn("Using fallback admin settings:", settingsError);
  if (promosError) console.warn("Promo management is not ready yet:", promosError);

  adminShopSettings = { ...defaults, ...(settings || {}) };
  adminPromoCodes = promos || [];
}

async function loadOrders() {
  ordersContainer.innerHTML = `<p class="empty">Loading orders...</p>`;

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

latestOrders = data || [];

await Promise.all([
  loadInventoryItems(),
  loadAdminSettings()
]);

renderCurrentView();
}

window.updateOrderStatus = updateOrderStatus;
window.updatePaymentType = updatePaymentType;

function setActiveTab(activeTab) {

    todayViewBtn.classList.remove("active");
    ordersViewBtn.classList.remove("active");
    productionViewBtn.classList.remove("active");
    assemblyViewBtn.classList.remove("active");
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

settingsViewBtn.onclick = () => {
  currentView = "settings";
  setActiveTab(settingsViewBtn);
  renderCurrentView();
};

orderViewFilter.addEventListener("change", () => renderOrders(latestOrders));
orderSearch.addEventListener("input", () => renderOrders(latestOrders));
statusFilter.addEventListener("change", () => renderOrders(latestOrders));
paymentFilter.addEventListener("change", () => renderOrders(latestOrders));

refreshBtn.onclick = loadOrders;
loadOrders();
