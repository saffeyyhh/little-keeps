import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateQueuedProductionQuantity,
  calculateBusinessFinancials,
  calculatePaidOrderRevenue,
  ASSEMBLY_STAGES,
  buildGoogleMapsRouteUrl,
  distributeAmsPlatesAcrossPrinters,
  getDeliveryRouteGroup,
  getOperationalBuckets,
  getProductionPreviewOrders,
  getProductionJobGroup,
  getTrackedProductionQuantity,
  normalizeAssemblyProgress,
  optimizeAmsPlateSequence,
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

test("normalizes every assembly checkpoint without trusting unknown fields", () => {
  const progress = normalizeAssemblyProgress({
    base_connected: true,
    packed: 1,
    unknown: true
  });

  assert.deepEqual(Object.keys(progress), ASSEMBLY_STAGES.map(stage => stage.key));
  assert.equal(progress.base_connected, true);
  assert.equal(progress.letters_caps_assembled, false);
  assert.equal(progress.packed, true);
  assert.equal(progress.unknown, undefined);
});

test("builds a Google Maps route from selected delivery stops", () => {
  const url = new URL(buildGoogleMapsRouteUrl([
    "10 Woodlands Street 12, Singapore 738000",
    "20 Marsiling Lane, Singapore 739111",
    "1 Admiralty Drive, Singapore 757713"
  ]));

  assert.equal(url.hostname, "www.google.com");
  assert.equal(url.searchParams.get("origin"), "10 Woodlands Street 12, Singapore 738000");
  assert.equal(url.searchParams.get("destination"), "1 Admiralty Drive, Singapore 757713");
  assert.equal(url.searchParams.get("waypoints"), "20 Marsiling Lane, Singapore 739111");
});

test("prioritizes tomorrow, updates, assembly, packed and delivery work", () => {
  const orders = [
    {
      id: 1,
      status: "Printing",
      needed_by: "2026-07-31",
      collection_method: "delivery",
      update_needs_review: true,
      rework_required: true,
      assembly_progress: { base_connected: true }
    },
    {
      id: 2,
      status: "Ready for Pickup/Delivery",
      needed_by: "2026-07-30",
      collection_method: "pickup",
      assembly_progress: { packed: true }
    }
  ];
  const buckets = getOperationalBuckets(orders, new Date("2026-07-30T12:00:00+08:00"));

  assert.deepEqual(buckets.dueTomorrow.map(order => order.id), [1]);
  assert.deepEqual(buckets.needsReview.map(order => order.id), [1]);
  assert.deepEqual(buckets.rework.map(order => order.id), [1]);
  assert.deepEqual(buckets.assemblyInProgress.map(order => order.id), [1]);
  assert.deepEqual(buckets.packed.map(order => order.id), [2]);
  assert.deepEqual(buckets.delivery.map(order => order.id), [1]);
});

test("keeps only selected active orders in a production preview", () => {
  const result = getProductionPreviewOrders([
    { id: 1, status: "Printing" },
    { id: 2, status: "Pending Payment" },
    { id: 3, status: "Completed" },
    { id: 4, status: "Printing", archived_at: "2026-07-30" }
  ], ["1", "3", "4"]);

  assert.deepEqual(result.map(order => order.id), [1]);
});

test("orders AMS plates to preserve colours and keeps shared colours in their slots", () => {
  const plates = optimizeAmsPlateSequence([
    {
      id: "pink-gold",
      pieceCount: 10,
      colours: [
        { name: "Pink", hex: "#f55a74" },
        { name: "Gold", hex: "#e4bd68" }
      ]
    },
    {
      id: "black-white",
      pieceCount: 10,
      colours: [
        { name: "Black", hex: "#000000" },
        { name: "White", hex: "#ffffff" }
      ]
    },
    {
      id: "pink-white",
      pieceCount: 10,
      colours: [
        { name: "Pink", hex: "#f55a74" },
        { name: "White", hex: "#ffffff" }
      ]
    }
  ]);

  const ids = plates.map(plate => plate.id);
  assert.equal(ids.indexOf("pink-white"), 0);
  assert.equal(plates[1].changeCount, 1);

  const firstPinkSlot = plates[0].slotAssignments
    .find(item => item.colour?.name === "Pink")?.slot;
  const secondPinkSlot = plates[1].slotAssignments
    .find(item => item.colour?.name === "Pink")?.slot;
  assert.equal(firstPinkSlot, secondPinkSlot);
});

test("balances AMS plates across two printer lanes", () => {
  const lanes = distributeAmsPlatesAcrossPrinters([
    { id: "a", pieceCount: 50, colours: [{ name: "Pink" }] },
    { id: "b", pieceCount: 45, colours: [{ name: "White" }] },
    { id: "c", pieceCount: 20, colours: [{ name: "Pink" }] },
    { id: "d", pieceCount: 15, colours: [{ name: "White" }] }
  ], [
    { id: "p1", name: "Printer 1" },
    { id: "p2", name: "Printer 2" }
  ]);

  assert.equal(lanes.length, 2);
  assert.deepEqual(
    lanes.map(lane => lane.pieceCount).sort((a, b) => a - b),
    [65, 65]
  );
  assert.ok(lanes.every(lane => lane.plates.length === 2));
});

test("keeps both printers running even when their plates share colours", () => {
  const lanes = distributeAmsPlatesAcrossPrinters([
    { id: "pink-large", pieceCount: 50, colours: [{ name: "Pink" }] },
    { id: "pink-small", pieceCount: 45, colours: [{ name: "Pink" }] },
    { id: "white", pieceCount: 40, colours: [{ name: "White" }] },
    { id: "black", pieceCount: 35, colours: [{ name: "Black" }] }
  ], [
    { id: "p1", name: "Printer 1" },
    { id: "p2", name: "Printer 2" }
  ]);

  const waves = new Map();
  lanes.forEach(lane => lane.plates.forEach(plate => {
    if (!waves.has(plate.waveIndex)) waves.set(plate.waveIndex, []);
    waves.get(plate.waveIndex).push(plate);
  }));

  assert.equal(waves.size, 2);
  assert.ok(Array.from(waves.values()).every(wave => wave.length === 2));
  assert.ok(Array.from(waves.values()).every(wave => wave.length === 2));
});

test("allows the same filament colour on both printers in one wave", () => {
  const lanes = distributeAmsPlatesAcrossPrinters([
    {
      id: "pink-a",
      pieceCount: 40,
      colours: [{ name: "Pink" }, { name: "White" }]
    },
    {
      id: "pink-b",
      pieceCount: 35,
      colours: [{ name: "Pink" }, { name: "Gold" }]
    },
    {
      id: "black",
      pieceCount: 30,
      colours: [{ name: "Black" }]
    }
  ], [
    { id: "p1", name: "Printer 1" },
    { id: "p2", name: "Printer 2" }
  ]);

  const scheduled = lanes.flatMap(lane => lane.plates);
  const pinkWaves = scheduled
    .filter(plate => Array.from(plate.colours.values())
      .some(colour => colour.name === "Pink"))
    .map(plate => plate.waveIndex);

  assert.ok(pinkWaves.some(
    (wave, index) => pinkWaves.indexOf(wave) !== index
  ));
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
