import "./admin.css";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jetamtthfenjyzcdklqm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_IXgEB4mpCTF3zOhkulGOYw_fcDwgiHf";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.querySelector("#app").innerHTML = `
  <main class="admin-page">
    <header class="admin-header">
      <p class="eyebrow">Little Keeps</p>
      <h1>Workshop ♡</h1>
      <p>Manage orders, printing and pickups in one place.</p>
    </header>

    <section id="stats" class="stats-grid"></section>

    <section class="orders-section">
        <div class="section-title">
        <h2>Orders</h2>

        <div class="admin-actions">
            <a class="new-order-btn" href="./index.html?manual=true">
            + New Manual Order
            </a>

            <button id="refreshBtn">Refresh</button>
        </div>
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

async function updateOrderStatus(orderId, newStatus) {
  const { error } = await supabase
    .from("orders")
    .update({ status: newStatus })
    .eq("id", orderId);

  if (error) {
    console.error(error);
    alert("Unable to update status.");
    return;
  }

  loadOrders();
}

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

function getStatusClass(status) {
  const value = (status || "").toLowerCase();

  if (value.includes("printing")) return "status-printing";
  if (value.includes("ready")) return "status-ready";
  if (value.includes("completed")) return "status-completed";

  return "status-pending";
}

function getMethodLabel(method) {
  return method === "delivery" ? "Delivery" : "Pickup";
}

function renderStats(orders) {
  const totalOrders = orders.length;

  const pending = orders.filter(order =>
    (order.status || "").toLowerCase() === "pending"
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
  if (!orders.length) {
    ordersContainer.innerHTML = `
      <div class="empty-card">
        <h3>No orders yet ♡</h3>
        <p>New Little Keeps orders will appear here.</p>
      </div>
    `;
    return;
  }

  async function updateOrderStatus(id, status) {

    const { error } = await supabase
        .from("orders")
        .update({
            status: status
        })
        .eq("id", id);

    if(error){

        console.error(error);

        return;

    }

    loadOrders();

}

window.updateOrderStatus = updateOrderStatus;

  ordersContainer.innerHTML = orders.map(order => `
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
        <option value="Pending Payment" ${order.status === "Pending Payment" ? "selected" : ""}>
            Pending Payment
        </option>

        <option value="Payment Verified" ${order.status === "Payment Verified" ? "selected" : ""}>
            Payment Verified
        </option>

        <option value="Printing" ${order.status === "Printing" ? "selected" : ""}>
            Printing
        </option>

        <option value="Ready for Pickup/Delivery" ${order.status === "Ready for Pickup/Delivery" ? "selected" : ""}>
            Ready for Pickup/Delivery
        </option>

        <option value="Completed" ${order.status === "Completed" ? "selected" : ""}>
            Completed
        </option>

        </select>
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

window.updateOrderStatus = updateOrderStatus;

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

  renderStats(data || []);
  renderOrders(data || []);
}

async function updatePaymentType(id, paymentType) {
  const { error } = await supabase
    .from("orders")
    .update({ payment_type: paymentType })
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("Unable to update payment type.");
    return;
  }

  loadOrders();
}

window.updatePaymentType = updatePaymentType;

refreshBtn.onclick = loadOrders;

loadOrders();