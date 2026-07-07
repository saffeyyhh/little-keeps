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

          <select id="statusFilter">
            <option value="all">All Status</option>
            <option value="Pending Payment">Pending Payment</option>
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
let productionProgress = {};
let collapsedGroups =
    JSON.parse(localStorage.getItem("collapsedGroups") || "{}");

async function loadProductionProgress() {
  const { data, error } = await supabase
    .from("production_progress")
    .select("*");

  if (error) {
    console.error(error);
    return;
  }

  productionProgress = {};

  data.forEach(row => {
    productionProgress[`${row.group_key}|${row.item_key}`] = row.completed;
  });
}

function getCustomerSummaryHtml(order) {
  let html = "";

  (order.order_data || []).forEach(item => {
    const design = item.design;

    html += `
      <div style="background:white;border:1px solid #eee;border-radius:16px;padding:14px;margin:12px 0;">
        <h3 style="margin:0 0 8px;">${item.name}</h3>

        <div>
          ${createEmailMiniPreview(item.name, design)}
        </div>

        <p style="margin:10px 0 0;">
          <b>$${Number(item.price).toFixed(2)}</b>
        </p>
      </div>
    `;
  });

  return html;
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

async function saveProductionProgress(groupKey, itemKey, completed) {
  const { error } = await supabase
    .from("production_progress")
    .upsert({
      group_key: groupKey,
      item_key: itemKey,
      completed
    }, {
      onConflict: "group_key,item_key"
    });

  if (error) {
    console.error(error);
    alert("Unable to save checkbox.");
  }
}

window.toggleProductionItem = async function(groupKey, itemKey, checked) {
  await saveProductionProgress(groupKey, itemKey, checked);
  productionProgress[`${groupKey}|${itemKey}`] = checked;
};

window.toggleProductionGroup = async function(groupKey, itemKeys, checked) {
  for (const itemKey of itemKeys) {
    await saveProductionProgress(groupKey, itemKey, checked);
    productionProgress[`${groupKey}|${itemKey}`] = checked;
  }

  renderProductionPlanner(latestOrders);
};

window.saveCollapse = function(groupKey, isOpen){

    collapsedGroups[groupKey] = !isOpen;

    localStorage.setItem(
        "collapsedGroups",
        JSON.stringify(collapsedGroups)
    );

};

window.markReady = async function(id) {
  const order = latestOrders.find(order => String(order.id) === String(id));

  if (!order) return;

  const totalLetters = (order.order_data || []).reduce((sum, item) => {
    return sum + (item.clean_name || item.name || "").length;
  }, 0);

  const keychainCount = (order.order_data || []).length;

  const ok = confirm(
    `Mark this order as ready?\n\nThis will deduct:\n- ${totalLetters} mechanical switch(es)\n- ${keychainCount} key ring(s)\n- ${keychainCount} jump ring(s)`
  );

  if (!ok) return;

  await deductInventory("Mechanical Switch", totalLetters);
  await deductInventory("Key Ring", keychainCount);
  await deductInventory("Jump Ring", keychainCount);

  const { error } = await supabase
    .from("orders")
    .update({ status: "Ready for Pickup/Delivery" })
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("Unable to update order status.");
    return;
  }

  latestOrders = latestOrders.filter(order => order.id !== id);

  currentView = "assembly";
  setActiveTab(assemblyViewBtn);
  await renderAssemblyQueue();
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
  const statusValue = statusFilter.value;
  const paymentValue = paymentFilter.value;

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      (order.order_ref || "").toLowerCase().includes(searchText) ||
      (order.customer_name || "").toLowerCase().includes(searchText) ||
      (order.customer_email || "").toLowerCase().includes(searchText);

    const matchesStatus =
      statusValue === "all" || order.status === statusValue;

    const matchesPayment =
      paymentValue === "all" || order.payment_type === paymentValue;

    return matchesSearch && matchesStatus && matchesPayment;
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
    <article class="order-card">
      <div class="order-top">
        <div>
          <h3>${order.order_ref}</h3>
          <p>${order.customer_name || "-"}</p>
        </div>

        <select
          class="status-select"
          onchange="window.updateOrderStatus('${order.id}', this.value)"
        >
          <option value="Pending Payment" ${order.status === "Pending Payment" ? "selected" : ""}>Pending Payment</option>
          <option value="Payment Verified" ${order.status === "Payment Verified" ? "selected" : ""}>Payment Verified</option>
          <option value="Printing" ${order.status === "Printing" ? "selected" : ""}>Printing</option>
          <option value="Ready for Pickup/Delivery" ${order.status === "Ready for Pickup/Delivery" ? "selected" : ""}>Ready for Pickup/Delivery</option>
          <option value="Completed" ${order.status === "Completed" ? "selected" : ""}>Completed</option>
        </select>
      </div>

      <div class="order-preview-list">
        ${(order.order_data || []).map(item => `
          <div class="order-preview-item">
            <strong>${item.name}</strong>
            <div class="mini-chain">
              ${createAssemblyMiniPreview(item.name, item.design)}
            </div>
          </div>
        `).join("")}
      </div>

      <div class="order-info">
        <div>
          <span>Needed By</span>
          <strong>${formatDate(order.needed_by)}</strong>
        </div>

        <div>
          <span>Method</span>
          <strong>${getMethodLabel(order.collection_method)}</strong>
        </div>

        <div>
          <span>Total</span>
          <strong>${formatMoney(order.total)}</strong>
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
    </article>
  `).join("");
}

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

        if (!baseTotals[baseName]) {
          baseTotals[baseName] = {
            name: baseName,
            hex: baseHex,
            qty: 0
          };
        }

        baseTotals[baseName].qty += 1;

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

function isOrderReadyForAssembly(order) {
  const items = order.order_data || [];

  for (const item of items) {
    const cleanName = item.clean_name || item.name || "";
    const letters = Array.from(cleanName);
    const design = item.design;

    if (!design) return false;

    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i];

      const base = design.bases[i % design.bases.length];
      const cap = design.caps[i % design.caps.length];
      const letterColour = design.letters[i % design.letters.length];

      const baseName = base.name || base.hex || base;
      const capName = cap.name || cap.hex || cap;
      const letterName = letterColour.name || letterColour.hex || letterColour;

      const baseDone = productionProgress[`Base Printing|${baseName}`];

      const keycapGroup = `${capName} Cap + ${letterName} Letter`;
      const keycapDone = productionProgress[`${keycapGroup}|${letter}`];

      if (!baseDone || !keycapDone) {
        return false;
      }
    }
  }

  return true;
}

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

      return `
        <div class="mini-block" style="background:${base.hex};">
          <div
            class="mini-cap"
            style="background:${cap.hex}; color:${letterColour.hex};"
          >
            ${displayIcon(letter)}
          </div>
        </div>
      `;
    })
    .join("");
}

async function renderAssemblyQueue() {

  await loadProductionProgress();

  const readyOrders = latestOrders.filter(order =>
    ["Payment Verified", "Printing"].includes(order.status) &&
    isOrderReadyForAssembly(order)
  );

  ordersContainer.innerHTML = `
    <div class="production-card">
      <div class="production-header">
        <div>
          <h2>Assembly Queue</h2>
          <p class="hint">Orders shown here have all bases and keycaps printed.</p>
        </div>

        <p class="active-count">${readyOrders.length} order(s)</p>
      </div>

      ${
        readyOrders.length === 0
          ? `
            <div class="empty-card">
              <h3>No orders ready for assembly yet</h3>
              <p>Complete the production checklist first.</p>
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
                ${(order.order_data || []).map(item => `
                <div class="assembly-item">
                    <div class="assembly-item-top">
                    <strong>${item.name}</strong>

                    <span class="assembly-tag">
                        ${sanitizeName(item.name).length} Letters
                    </span>
                    </div>

                    <div class="mini-chain">
                    ${createAssemblyMiniPreview(item.name, item.design)}
                    </div>
                </div>
                `).join("")}

                <button
                  class="ready-btn"
                  onclick="console.log('clicked assembly', '${order.id}'); window.markReady('${order.id}')"
                >
                  Assembly Complete
                </button>
              </div>
            </details>
          `).join("")
      }

      <button id="backToOrdersBtn">Back to Orders</button>
    </div>
  `;

  document.getElementById("backToOrdersBtn").onclick = () => {
    renderStats(latestOrders);
    renderOrders(latestOrders);
  };
}

async function renderProductionPlanner(orders) {
  await loadProductionProgress();

  const { baseTotals, keycapGroups, count } = getProductionSummary(orders);

  const baseItemKeys = Object.values(baseTotals).map(item => item.name);

  ordersContainer.innerHTML = `
    <div class="production-card">
      <div class="production-header">
        <div>
          <h2>Production Planner ♡</h2>
          <p class="hint">
            Showing orders with status: Payment Verified or Printing.
          </p>
        </div>

        <p class="active-count">
          ${count} active order(s)
        </p>
      </div>

      <h3>Base Printing</h3>

      <div class="print-group">
        <div class="print-group-top">
          <h4>Base Colours</h4>

          <label class="select-all">
            <input
              type="checkbox"
              onchange='window.toggleProductionGroup(
                "Base Printing",
                ${JSON.stringify(baseItemKeys)},
                this.checked
              )'
            >
            Select All
          </label>
        </div>

        ${Object.values(baseTotals).map(item => {
          const groupKey = "Base Printing";
          const itemKey = item.name;
          const checked = productionProgress[`${groupKey}|${itemKey}`];

          return `
            <label class="print-check-row">
              <input
                type="checkbox"
                ${checked ? "checked" : ""}
                onchange='window.toggleProductionItem(
                  "Base Printing",
                  ${JSON.stringify(itemKey)},
                  this.checked
                )'
              >

              <span class="colour-dot" style="background:${item.hex}"></span>
              <span>${item.name}</span>
              <strong>${item.qty}</strong>
            </label>
          `;
        }).join("") || "<p>No bases to print.</p>"}
      </div>

<h3>Keycap Printing</h3>

<div class="keycap-grid">
  ${Object.entries(keycapGroups)

.sort((a, b) => {

    const getProgress = ([groupKey, group]) => {

        const total = Object.keys(group.letters).length;

        const done = Object.keys(group.letters)
            .filter(letter =>
                productionProgress[`${groupKey}|${letter}`]
            ).length;

        return done / total;

    };

    const pa = getProgress(a);
    const pb = getProgress(b);

    // Unfinished groups first
    if (pa !== pb) return pa - pb;

    // If same progress, sort alphabetically
    return a[0].localeCompare(b[0]);

})

.map(([groupKey, group]) => {
    const sortedLetters = Object.entries(group.letters)
      .sort((a, b) => b[1] - a[1]);

    const itemKeys = sortedLetters.map(([letter]) => letter);
    const totalItems = sortedLetters.length;

    const completedItems = sortedLetters.filter(([letter]) =>
      productionProgress[`${groupKey}|${letter}`]
    ).length;

    const progressPercent =
      totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

    return `
        <details
            class="print-group ${completedItems === totalItems ? "completed-group" : ""}"
            ${collapsedGroups[groupKey] ? "" : "open"}
            ontoggle="window.saveCollapse('${groupKey}', this.open)"
        >
        <summary>
          <div class="group-summary">
            <div class="sample-keycap" style="background:${group.capHex}; color:${group.letterHex};">
              A
            </div>

            <div>
              <h4>${group.capName} Cap + ${group.letterName} Letter</h4>
              <p>${completedItems} / ${totalItems} item types completed</p>
            </div>
          </div>

          <div class="progress-bar">
            <div style="width:${progressPercent}%"></div>
          </div>
        </summary>

        <label class="select-all">
          <input
            type="checkbox"
            ${completedItems === totalItems ? "checked" : ""}
            onchange='window.toggleProductionGroup(
              ${JSON.stringify(groupKey)},
              ${JSON.stringify(itemKeys)},
              this.checked
            )'
          >
          Select All
        </label>

        ${sortedLetters.map(([letter, qty]) => {
          const checked = productionProgress[`${groupKey}|${letter}`];

          return `
            <label class="print-check-row">
              <input
                type="checkbox"
                ${checked ? "checked" : ""}
                onchange='window.toggleProductionItem(
                  ${JSON.stringify(groupKey)},
                  ${JSON.stringify(letter)},
                  this.checked
                )'
              >

              <span class="letter-chip">${letter}</span>
              <span>Letter</span>
              <strong>${qty}</strong>
            </label>
          `;
        }).join("")}
      </details>
    `;
  }).join("") || "<p>No keycaps to print.</p>"}
</div>
  `;

  document.getElementById("backToOrdersBtn").onclick = () => {
    renderStats(latestOrders);
    renderOrders(latestOrders);
  };
}

async function sendPaymentVerifiedEmail(order) {
  try {
    await emailjs.send(
      EMAILJS_SERVICE,
      EMAILJS_PAYMENT_VERIFIED_TEMPLATE,
      {
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        order_ref: order.order_ref,
        total_amount: formatMoney(order.total),
        needed_by: formatDate(order.needed_by),
        collection_method: getMethodLabel(order.collection_method),

        customer_summary: getCustomerSummaryHtml(order)
      }
    );
  } catch (err) {
    console.error(err);
    alert("Payment verified, but email failed to send.");
  }
}

async function updateOrderStatus(id, status) {
  const scrollY = window.scrollY;

  const order = latestOrders.find(order => String(order.id) === String(id));

  const updateData = { status };

  if (status === "Payment Verified") {
    updateData.payment_type = "Paid";
  }

  const { error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("Unable to update status.");
    return;
  }

  if (
    order?.status === "Pending Payment" &&
    status === "Payment Verified" &&
    order.customer_email
  ) {
    await sendPaymentVerifiedEmail(order);
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

  const newQty = Math.max(0, Number(data.qty || 0) - qtyToDeduct);

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

orderSearch.addEventListener("input", () => renderOrders(latestOrders));
statusFilter.addEventListener("change", () => renderOrders(latestOrders));
paymentFilter.addEventListener("change", () => renderOrders(latestOrders));

refreshBtn.onclick = loadOrders;
loadOrders();
