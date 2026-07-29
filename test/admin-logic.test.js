import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateQueuedProductionQuantity,
  calculateBusinessFinancials,
  calculatePaidOrderRevenue,
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
