import "./admin.css";
import { createClient } from "@supabase/supabase-js";
import emailjs from "@emailjs/browser";

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

const EMAILJS_SERVICE = "service_joll6ie";
const EMAILJS_TEMPLATE = "template_3kt0yd9";
const EMAILJS_PUBLIC = "dRppqgrkwps-kd6W-";


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

function escapeEmailHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCustomerSummaryHtml(order) {
  const items = Array.isArray(order.order_data)
    ? order.order_data
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

        <p><strong>Subtotal:</strong><br>${formatMoney(order.subtotal)}</p>
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

  const keycapGroupHtml = Object.entries(keycapGroups).map(([groupKey, group]) => {
    const rows = Object.entries(group.letters)
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
      })
      .filter(row => row.toPrint > 0);

    if (!rows.length) return "";

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
              <p>Only showing letters that still need printing</p>
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

async function sendPaymentVerifiedEmail(order) {
  const customerEmail = order.customer_email?.trim();

  if (!customerEmail) {
    throw new Error(
      "The order does not have a customer email address."
    );
  }

  const response = await emailjs.send(
    EMAILJS_SERVICE,
    EMAILJS_PAYMENT_VERIFIED_TEMPLATE,
    {
      to_email: customerEmail,
      customer_name: order.customer_name || "Customer",
      order_ref: order.order_ref || "-",
      total_amount: formatMoney(order.total),
      needed_by: formatDate(order.needed_by),
      collection_method: getMethodLabel(
        order.collection_method
      ),
      customer_summary: getCustomerSummaryHtml(order)
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
