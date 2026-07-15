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
      <p class="eyebrow">Little Keeps</p>
      <h1>Workshop ♡</h1>
      <p>Manage orders, printing and pickups in one place.</p>
          <button id="logoutBtn">Logout</button>
    </header>

    <section id="stats" class="stats-grid"></section>

        <div class="workshop-tabs">
        <button id="ordersViewBtn" class="workshop-tab active">Orders</button>
        <button id="productionViewBtn" class="workshop-tab">Production</button>
        <button id="assemblyViewBtn" class="workshop-tab">Assembly</button>
        </div>

        <div class="section-title">
        <h2 id="sectionTitle">Orders</h2>

        <div class="admin-actions" id="ordersActions">
            <a class="new-order-btn" href="./index.html?manual=true">
            + New Manual Order
            </a>

            <button id="refreshBtn" title="Refresh Orders">
                ↻
            </button>
        </div>
        </div>

      <div id="orderFilters" class="order-filters">
        <input id="orderSearch" placeholder="Search order ref or customer...">

        <select id="orderViewFilter">
          <option value="active">Active Orders</option>
          <option value="all">All Orders</option>
          <option value="completed">Completed Only</option>
        </select>

        <select id="statusFilter">
          <option value="all">All Status</option>
          <option value="Pending Payment">Pending Payment</option>
          <option value="Payment Verification">Pending Verification</option>
          <option value="Payment Verified">Payment Verified</option>
          <option value="Printing">Printing</option>
          <option value="Ready for Pickup/Delivery">Ready for Pickup/Delivery</option>
          <option value="Completed">Completed</option>
        </select>

        <select id="paymentFilter">
          <option value="all">All Payment</option>
          <option value="Pending">Pending</option>
          <option value="Paid">Paid</option>
          <option value="Free">Free</option>
          <option value="Giveaway">Giveaway</option>
          <option value="Replacement">Replacement</option>
        </select>
      </div>
        <div id="orders">
          <p class="empty">Loading orders...</p>
        </div>
    </section>
  </main>
`;

const ordersContainer = document.getElementById("orders");
const statsContainer = document.getElementById("stats");
const refreshBtn = document.getElementById("refreshBtn");
const ordersViewBtn = document.getElementById("ordersViewBtn");
const productionViewBtn = document.getElementById("productionViewBtn");
const sectionTitle = document.getElementById("sectionTitle");
const ordersActions = document.getElementById("ordersActions");
const assemblyViewBtn = document.getElementById("assemblyViewBtn");

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

let currentView = "orders";
let latestOrders = [];

let inventoryItems = {};

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

  orderFilters.style.display = currentView === "orders" ? "flex" : "none";
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
}

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

  for (const [itemName, qty] of Object.entries(needs)) {
    const deducted = await deductInventory(itemName, qty);

    if (!deducted) {
      alert(
        `Stopped because ${itemName} could not be deducted.`
      );
      return;
    }
  }

  const { error } = await supabase
    .from("orders")
    .update({
      status: "Ready for Pickup/Delivery"
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("Unable to update order status.");
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

function getMethodLabel(method) {
  return method === "delivery" ? "Delivery" : "Pickup";
}

function renderStats(orders) {
  const totalOrders = orders.length;

  const pending = orders.filter(order =>
    (order.status || "").toLowerCase().includes("pending")
  ).length;

  const revenue = orders.reduce((sum, order) => {
    if (
      order.payment_type === "Free" ||
      order.payment_type === "Giveaway" ||
      order.payment_type === "Replacement"
    ) {
      return sum;
    }

    return sum + Number(order.total || 0);
  }, 0);

  const deliveryOrders = orders.filter(
    order => order.collection_method === "delivery"
  ).length;

  statsContainer.innerHTML = `
    <div class="stat-card">
      <span>Total Orders</span>
      <strong>${totalOrders}</strong>
    </div>

    <div class="stat-card">
      <span>Pending</span>
      <strong>${pending}</strong>
    </div>

    <div class="stat-card">
      <span>Revenue</span>
      <strong>${formatMoney(revenue)}</strong>
    </div>

    <div class="stat-card">
      <span>Delivery</span>
      <strong>${deliveryOrders}</strong>
    </div>
  `;
}

function renderOrders(orders) {
  const searchText = orderSearch.value.toLowerCase();
  const orderViewValue = orderViewFilter.value;
  const statusValue = statusFilter.value;
  const paymentValue = paymentFilter.value;

  const activeStatuses = [
    "Pending Payment",
    "Payment Verification",
    "Payment Verified",
    "Printing",
    "Ready for Pickup/Delivery"
  ];

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      (order.order_ref || "").toLowerCase().includes(searchText) ||
      (order.customer_name || "").toLowerCase().includes(searchText) ||
      (order.customer_email || "").toLowerCase().includes(searchText);

    const matchesOrderView =
      orderViewValue === "all" ||
      (orderViewValue === "active" && activeStatuses.includes(order.status)) ||
      (orderViewValue === "completed" && order.status === "Completed");

    const matchesStatus =
      statusValue === "all" || order.status === statusValue;

    const matchesPayment =
      paymentValue === "all" || order.payment_type === paymentValue;

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

  ordersContainer.innerHTML = filteredOrders.map(order => `
    <details class="order-card">
      <summary class="order-summary">
        <div>
          <h3>${order.order_ref}</h3>
          <p>${order.customer_name || "-"}</p>
        </div>

        <div class="order-summary-meta">
          <strong>${formatMoney(order.total)}</strong>
          <span>${order.status || "-"}</span>
          <span>${getMethodLabel(order.collection_method)}</span>
        </div>
      </summary>

      <div class="order-detail-grid">
        <p><strong>Customer Name:</strong><br>${order.customer_name || "-"}</p>
        <p><strong>Email:</strong><br>${order.customer_email || "-"}</p>
        <p><strong>Phone:</strong><br>${order.customer_phone || "-"}</p>
        <p><strong>Order Ref:</strong><br>${order.order_ref || "-"}</p>

        <p><strong>Collection Method:</strong><br>${getMethodLabel(order.collection_method)}</p>
        <p><strong>Needed By:</strong><br>${formatDate(order.needed_by)}</p>

        ${
          order.collection_method === "delivery"
            ? `
              <p class="full-row">
                <strong>Delivery Address:</strong><br>
                ${order.delivery_address || "-"}
              </p>
            `
            : `
              <p class="full-row">
                <strong>Pickup Location:</strong><br>
                Woodlands MRT
              </p>
            `
        }

        <p class="full-row">
          <strong>Customer Notes / Preferred Timing:</strong><br>
          ${order.notes || order.preferred_time || "-"}
        </p>

        ${Number(order.discount_amount || 0) > 0 ? `
          <p><strong>Original Subtotal:</strong><br>${formatMoney(order.original_subtotal)}</p>
          <p><strong>Promo Code:</strong><br>${order.promo_code || "-"}</p>
          <p><strong>Promo Discount:</strong><br>−${formatMoney(order.discount_amount)}</p>
          <p><strong>Discounted Subtotal:</strong><br>${formatMoney(order.subtotal)}</p>
        ` : `
          <p><strong>Subtotal:</strong><br>${formatMoney(order.subtotal)}</p>
        `}
        <p><strong>Delivery Fee:</strong><br>${formatMoney(order.delivery_fee)}</p>
        <p><strong>Total:</strong><br>${formatMoney(order.total)}</p>
        <p><strong>Order Source:</strong><br>${order.order_source || "-"}</p>
      </div>

      <div class="order-info">
  <div>
    <span>Status</span>
    <select
      class="status-select"
      onchange="window.updateOrderStatus('${order.id}', this.value)"
    >
      <option value="Pending Payment" ${order.status === "Pending Payment" ? "selected" : ""}>Pending Payment</option>
      <option value="Payment Verification" ${order.status === "Payment Verification" ? "selected" : ""}>Payment Verification</option>
      <option value="Payment Verified" ${order.status === "Payment Verified" ? "selected" : ""}>Payment Verified</option>
      <option value="Printing" ${order.status === "Printing" ? "selected" : ""}>Printing</option>
      <option value="Ready for Pickup/Delivery" ${order.status === "Ready for Pickup/Delivery" ? "selected" : ""}>Ready for Pickup/Delivery</option>
      <option value="Completed" ${order.status === "Completed" ? "selected" : ""}>Completed</option>
    </select>
  </div>

  <div>
    <span>Payment</span>
    <select
      class="status-select"
      onchange="window.updatePaymentType('${order.id}', this.value)"
    >
      <option value="Pending" ${order.payment_type === "Pending" ? "selected" : ""}>Pending</option>
      <option value="Paid" ${order.payment_type === "Paid" ? "selected" : ""}>Paid</option>
      <option value="Free" ${order.payment_type === "Free" ? "selected" : ""}>Free</option>
      <option value="Giveaway" ${order.payment_type === "Giveaway" ? "selected" : ""}>Giveaway</option>
      <option value="Replacement" ${order.payment_type === "Replacement" ? "selected" : ""}>Replacement</option>
    </select>
  </div>
</div>
<div class="order-preview-list">
  ${(order.order_data || []).map(item => {
    const baseShape =
      item.design?.base_shape?.key ||
      item.design?.baseShape ||
      "ribbed";

    return `
      <div class="order-preview-item">
        <div class="assembly-item-top">
          <strong>${item.name}</strong>

          <span class="assembly-tag">
            ${baseShape === "bubbly" ? "Bubbly Base" : "Ribbed Base"}
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
  `).join("");
}

function getBaseInventoryName(baseName, baseShape = "ribbed") {
  const shapeLabel =
    baseShape === "bubbly" ? "Bubbly" : "Ribbed";

  return `${baseName} ${shapeLabel} Base`;
}

function getKeycapInventoryName(capName, letterName, character) {
  return `${capName} Cap + ${letterName} Letter - ${character}`;
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
    ["Payment Verified", "Printing"].includes(order.status)
  );

  activeOrders.forEach(order => {
    const items = order.order_data || [];

    items.forEach(item => {
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

        const groupKey = `${capName} Cap + ${letterName} Letter`;

        if (!keycapGroups[groupKey]) {
          keycapGroups[groupKey] = {
            capName,
            capHex,
            letterName,
            letterHex,
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

          letter

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

async function generateKeycapCombinationStl(jobId, button) {
  const job = productionStlJobs.get(jobId);

  if (!job) {
    alert("This colour combination is no longer available. Please refresh Production.");
    return;
  }

  const requestedCharacters = [];

  job.rows.forEach(row => {
    const input = document.getElementById(row.inputId);
    const quantity = Math.max(0, Math.floor(Number(input?.value || row.toPrint || 0)));

    for (let index = 0; index < quantity; index += 1) {
      requestedCharacters.push(row.letter);
    }
  });

  if (!requestedCharacters.length) {
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
      requestedCharacters.map(character =>
        loadProductionStlGeometry(getProductionKeycapPath(character))
      )
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
    link.download = `${capName}-cap_${letterName}-letter_${requestedCharacters.length}-pieces.stl`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

    arrangedGeometries.forEach(geometry => geometry.dispose());
    mergedGeometry.dispose();

    if (button) button.textContent = `Downloaded ${requestedCharacters.length} pieces ✓`;
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
            ${displayIcon(letter)}
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
      ["Payment Verified", "Printing"].includes(order.status)
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

  productionStlJobs.clear();

  const keycapGroupHtml = Object.entries(keycapGroups).map(([groupKey, group], groupIndex) => {
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
      rows: rows.map(row => ({
        letter: row.letter,
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

      <div class="print-group">
        ${baseRows.map(item => `
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
        `).join("") || "<p>No bases need printing.</p>"}
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
        ">${escapeEmailHtml(displayIcon(character))}</span>
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
                  ${escapeEmailHtml(baseShape)}
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
              ${escapeEmailHtml(letterColours)}
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
          <strong>Needed by:</strong>
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

  drawWrappedDetail("Needed by", formatDate(order.needed_by));
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
    pdf.text(getCompactPdfText(baseShape), margin + 5, y + 12);

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
          align: "center"
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
            "FAST"
          );
        } else {
          pdf.setTextColor(...letterRgb);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(7);
          pdf.text("*", blockX + 4.5, blockY + 5.7, {
            align: "center"
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
  const updateData = { status };

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

renderCurrentView();
}

window.updateOrderStatus = updateOrderStatus;
window.updatePaymentType = updatePaymentType;

function setActiveTab(activeTab) {

    ordersViewBtn.classList.remove("active");
    productionViewBtn.classList.remove("active");
    assemblyViewBtn.classList.remove("active");

    activeTab.classList.add("active");

}

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

orderViewFilter.addEventListener("change", () => renderOrders(latestOrders));
orderSearch.addEventListener("input", () => renderOrders(latestOrders));
statusFilter.addEventListener("change", () => renderOrders(latestOrders));
paymentFilter.addEventListener("change", () => renderOrders(latestOrders));

refreshBtn.onclick = loadOrders;
loadOrders();
