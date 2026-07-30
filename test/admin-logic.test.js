import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateQueuedProductionQuantity,
  calculateBusinessFinancials,
  calculatePaidOrderRevenue,
  getDeliveryRouteGroup,
  getProductionJobGroup,
  getTrackedProductionQuantity,
  validateInventoryDecrement
} from "../src/admin-logic.js";

test("calculates the initial Little Keeps financial position", () => {
  const result = calculateBusinessFinancials({
    printerSpend: 934,
    filamentAccessoriesSpend: 628.36,
    totalRevenue: 363.26
  });

  assert.equal(result.totalInvestment, 1562.36);
  assert.equal(result.netCashPosition, -1199.1);
  assert.ok(Math.abs(result.recoveryPercentage - 23.2507233) < 0.000001);
  assert.equal(result.recoveryProgress, result.recoveryPercentage);
});

test("caps the visual recovery bar while retaining recovery above 100%", () => {
  const result = calculateBusinessFinancials({
    printerSpend: 500,
    filamentAccessoriesSpend: 500,
    totalRevenue: 1250
  });

  assert.equal(result.recoveryPercentage, 125);
  assert.equal(result.recoveryProgress, 100);
  assert.equal(result.netCashPosition, 250);
});

test("calculates actual paid revenue and subtracts refunds", () => {
  assert.equal(calculatePaidOrderRevenue([
    { payment_type: "Paid", total: 300, refunded_amount: 25 },
    { payment_type: "Paid", total: 88.26 },
    { payment_type: "Refunded", total: 50, refunded_amount: 50 },
    { payment_type: "Pending", total: 999 },
    { payment_type: "Free", total: 20 }
  ]), 363.26);
});

test("excludes printing and picked quantities from the production queue", () => {
  const jobs = [
    { item_name: "Pink Base", quantity: 3, stage: "printing" },
    { item_name: "Pink Base", quantity: 2, stage: "picked" },
    { item_name: "Pink Base", quantity: 8, stage: "inventoried" },
    { item_name: "Blue Base", quantity: 9, stage: "printing" }
  ];
  const tracked = getTrackedProductionQuantity(jobs, "Pink Base");

  assert.equal(tracked, 5);
  assert.equal(calculateQueuedProductionQuantity(12, 2, tracked), 5);
  assert.equal(calculateQueuedProductionQuantity(5, 4, 3), 0);
});

test("groups tracked keycaps by cap colour and keeps bases together", () => {
  assert.deepEqual(
    getProductionJobGroup(
      "Pink Cap + Jade White Letter - A",
      "Keycap"
    ),
    {
      key: "10-pink",
      label: "Pink Caps"
    }
  );

  assert.deepEqual(
    getProductionJobGroup("Jade White Ribbed Base", "Base"),
    {
      key: "00-bases",
      label: "Bases"
    }
  );
});

test("groups nearby deliveries by Singapore postal sector", () => {
  const woodlands = getDeliveryRouteGroup(
    "10 Woodlands Street 12, Singapore 738000"
  );
  const marsiling = getDeliveryRouteGroup(
    "20 Marsiling Lane #02-01 S(739111)"
  );
  const missingPostalCode = getDeliveryRouteGroup(
    "Please call before delivery"
  );

  assert.equal(woodlands.key, "sector-73");
  assert.equal(marsiling.key, "sector-73");
  assert.equal(woodlands.postalCode, "738000");
  assert.equal(missingPostalCode.key, "sector-unknown");
});

test("allows a valid inventory decrement", () => {
  assert.deepEqual(validateInventoryDecrement(12, 5), {
    valid: true,
    newQty: 7
  });
});

test("rejects decrements that would make inventory negative", () => {
  assert.deepEqual(validateInventoryDecrement(3, 4), {
    valid: false,
    message: "Only 3 available. You cannot subtract 4."
  });
});

test("rejects zero, negative and fractional decrements", () => {
  assert.equal(validateInventoryDecrement(5, 0).valid, false);
  assert.equal(validateInventoryDecrement(5, -1).valid, false);
  assert.equal(validateInventoryDecrement(5, 1.5).valid, false);
});
