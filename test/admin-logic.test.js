import test from "node:test";
import assert from "node:assert/strict";

import {
  assignPrintedKeycapsToOwners,
  flattenSharedGroupContributions,
  calculateQueuedProductionQuantity,
  calculateBusinessFinancials,
  calculateGiftingBagTotal,
  calculatePaidOrderRevenue,
  calculateProductionTimeEstimate,
  calculateSubscriptionSummary,
  ASSEMBLY_STAGES,
  buildGoogleMapsRouteUrl,
  canOrderAcceptAddOn,
  canCancelEasyParcelShipment,
  distributeAmsPlatesAcrossPrinters,
  getFreeAmsPrinters,
  getEasyParcelQuotePrices,
  getBulkApprovalPolicy,
  getGiftingBagSelectionLimit,
  getHandDeliveryLabelData,
  getInternalBasketLabelData,
  groupLinkedOrdersForAdmin,
  getDeliveryRouteGroup,
  getPickupTimeRanges,
  getKeychainTurnaround,
  getOperationalBuckets,
  getProductionPreviewOrders,
  getProductionJobGroup,
  getTrackedProductionQuantity,
  normalizeAssemblyProgress,
  assessRushDateCapacity,
  formatDateRange,
  formatEasyParcelReceiver,
  formatEasyParcelDeliveryDuration,
  getEasyParcelVolumetricWeight,
  getCustomerDueDate,
  formatProductionMinutes,
  isOrderReminderFinishedOrExpired,
  isPickupDay,
  isSharedGroupCancelledOrExpired,
  optimizeAmsPlateSequence,
  pickRandomDesignColourSets,
  pickRandomDesignColours,
  partitionAmsCombinationsByBusyColours,
  sortEasyParcelQuotesByPrice,
  isEasyParcelPickupQuote,
  validateInventoryDecrement
} from "../src/admin-logic.js";

test("allows add-ons only before an order enters printing", () => {
  assert.equal(canOrderAcceptAddOn("Pending Payment"), true);
  assert.equal(canOrderAcceptAddOn("Payment Verified"), true);
  assert.equal(canOrderAcceptAddOn("Printing"), false);
  assert.equal(canOrderAcceptAddOn("Assembly Complete"), false);
  assert.equal(canOrderAcceptAddOn("Completed"), false);
});

test("sorts EasyParcel quotes by the final payable price", () => {
  const quotes = [
    { courier: { service_id: "a" }, pricing: { total_amount: 4.69 } },
    { courier: { service_id: "b" }, pricing: { total_amount: 3.94 } },
    { courier: { service_id: "c" }, pricing: { total_amount: 4.34 } }
  ];

  assert.deepEqual(
    sortEasyParcelQuotesByPrice(quotes).map(quote => quote.courier.service_id),
    ["b", "c", "a"]
  );
});

test("keeps EasyParcel's website rate separate from its payable total", () => {
  assert.deepEqual(
    getEasyParcelQuotePrices({
      pricing: { currency: "SGD", base_price: 3.75, total_amount: 3.94 }
    }),
    { currency: "SGD", headline: 3.75, payable: 3.94, apiTotal: 3.94, tax: 0, addOns: 0 }
  );
});

test("does not include unselected EasyParcel tracking features in the booking estimate", () => {
  assert.deepEqual(
    getEasyParcelQuotePrices({
      pricing: {
        currency: "SGD",
        shipment_price: 3.65,
        shipment_tax: 0,
        total_features_price: 0.19,
        total_features_tax: 0,
        total_amount: 3.84
      }
    }),
    { currency: "SGD", headline: 3.65, payable: 3.65, apiTotal: 3.84, tax: 0, addOns: 0.19 }
  );
});

test("formats EasyParcel delivery duration objects and JSON strings", () => {
  assert.equal(formatEasyParcelDeliveryDuration({ type: "days", value: "1" }), "1 day");
  assert.equal(formatEasyParcelDeliveryDuration('{"type":"days","value":"1-3"}'), "1-3 days");
});

test("calculates Singapore volumetric weight and identifies pickup services", () => {
  assert.equal(getEasyParcelVolumetricWeight(35, 35, 10), 2.45);
  assert.equal(isEasyParcelPickupQuote({ courier: { is_pickup: true } }), true);
  assert.equal(isEasyParcelPickupQuote({ courier: { is_pickup: false } }), false);
});

test("only offers EasyParcel cancellation before parcel handover", () => {
  assert.equal(canCancelEasyParcelShipment("Schedule In Arrangement"), true);
  assert.equal(canCancelEasyParcelShipment("To Be Collected"), true);
  assert.equal(canCancelEasyParcelShipment("Collected"), false);
  assert.equal(canCancelEasyParcelShipment("Delivery In Transit"), false);
});

test("uses the three promised keychain turnaround tiers", () => {
  assert.deepEqual(getKeychainTurnaround(1), {
    quantity: 1,
    tier: "small",
    minDays: 2,
    maxDays: 3
  });
  assert.equal(getKeychainTurnaround(3).tier, "small");
  assert.deepEqual(getKeychainTurnaround(4), {
    quantity: 4,
    tier: "medium",
    minDays: 3,
    maxDays: 4
  });
  assert.equal(getKeychainTurnaround(6).tier, "medium");
  assert.deepEqual(getKeychainTurnaround(7), {
    quantity: 7,
    tier: "large",
    minDays: 4,
    maxDays: 5
  });
});

test("shows a single estimate when both dates are the same", () => {
  assert.equal(formatDateRange("11 Aug", "11 Aug"), "11 Aug");
  assert.equal(formatDateRange("11 Aug", "13 Aug"), "11 Aug–13 Aug");
});

test("uses a later pickup appointment as the customer due date", () => {
  assert.equal(getCustomerDueDate("2026-08-14", "2026-08-16"), "2026-08-16");
  assert.equal(getCustomerDueDate("2026-08-14", "2026-08-12"), "2026-08-14");
  assert.equal(getCustomerDueDate("2026-08-14", ""), "2026-08-14");
});

test("offers pickup only on Wednesdays, Fridays, and weekends", () => {
  assert.equal(isPickupDay("2026-08-05"), true);
  assert.equal(isPickupDay("2026-08-07"), true);
  assert.equal(isPickupDay("2026-08-08"), true);
  assert.equal(isPickupDay("2026-08-09"), true);
  assert.equal(isPickupDay("2026-08-06"), false);
  assert.deepEqual(getPickupTimeRanges("2026-08-05"), [
    "7:00 PM",
    "7:30 PM",
    "8:00 PM"
  ]);
  assert.deepEqual(getPickupTimeRanges("2026-08-08", {
    weekday: ["6:45 PM"],
    weekend: ["11:15 AM", "4:00 PM"]
  }), ["11:15 AM", "4:00 PM"]);
  assert.equal(getPickupTimeRanges("2026-08-06").length, 0);
});

test("allows one extra rush order on a date with up to two normal orders", () => {
  assert.equal(assessRushDateCapacity(1, 0).allowed, true);
  assert.equal(assessRushDateCapacity(2, 0).allowed, true);
  assert.equal(assessRushDateCapacity(3, 0).allowed, false);
  assert.equal(assessRushDateCapacity(1, 1).allowed, false);
});

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

test("summarises only active monthly subscriptions", () => {
  assert.deepEqual(calculateSubscriptionSummary([
    { name: "Patreon licence", monthly_amount: 12.5, status: "active" },
    { name: "Meshy AI", monthly_amount: 25, status: "active" },
    { name: "Old tool", monthly_amount: 9, status: "cancelled" }
  ]), {
    activeCount: 2,
    monthlyTotal: 37.5,
    yearlyEstimate: 450
  });
});

test("prices gifting bags at fifty cents each", () => {
  assert.equal(calculateGiftingBagTotal(0), 0);
  assert.equal(calculateGiftingBagTotal(1), 0.5);
  assert.equal(calculateGiftingBagTotal(3), 1.5);
  assert.equal(calculateGiftingBagTotal(-2), 0);
});

test("allows any gifting bag quantity up to live stock", () => {
  assert.equal(getGiftingBagSelectionLimit(1, 10), 10);
  assert.equal(getGiftingBagSelectionLimit(4, 10), 10);
  assert.equal(getGiftingBagSelectionLimit(7, 3), 3);
  assert.equal(getGiftingBagSelectionLimit(7, 0), 0);
});

test("auto-accepts available event dates while keeping safe lead times", () => {
  assert.deepEqual(getBulkApprovalPolicy(14), {
    quantity: 14,
    approvalRequired: false,
    minLeadDays: 0,
    minWorkingDays: 0,
    timeframeLabel: ""
  });
  assert.deepEqual(getBulkApprovalPolicy(15), {
    quantity: 15,
    approvalRequired: false,
    minLeadDays: 7,
    minWorkingDays: 7,
    timeframeLabel: "at least 7 working days"
  });
  assert.deepEqual(getBulkApprovalPolicy(30), {
    quantity: 30,
    approvalRequired: false,
    minLeadDays: 14,
    minWorkingDays: 10,
    timeframeLabel: "at least 14 days"
  });
  assert.deepEqual(getBulkApprovalPolicy(51), {
    quantity: 51,
    approvalRequired: false,
    minLeadDays: 14,
    minWorkingDays: 10,
    timeframeLabel: "approximately 1.5–2 weeks"
  });
  assert.equal(getBulkApprovalPolicy(75).timeframeLabel, "approximately 1.5–2 weeks");
  assert.deepEqual(getBulkApprovalPolicy(100), {
    quantity: 100,
    approvalRequired: false,
    minLeadDays: 21,
    minWorkingDays: 15,
    timeframeLabel: "approximately 2–3 weeks"
  });
  assert.deepEqual(getBulkApprovalPolicy(150), {
    quantity: 150,
    approvalRequired: false,
    minLeadDays: 28,
    minWorkingDays: 20,
    timeframeLabel: "approximately 3–4 weeks"
  });
  assert.deepEqual(getBulkApprovalPolicy(151), {
    quantity: 151,
    approvalRequired: false,
    minLeadDays: 42,
    minWorkingDays: 30,
    timeframeLabel: "approximately 4–6 weeks"
  });
});

test("estimates base and keycap printer time for a bulk order", () => {
  const estimate = calculateProductionTimeEstimate(106, 50, 2);

  assert.equal(estimate.baseQuantity, 106);
  assert.equal(estimate.keycapQuantity, 50);
  assert.equal(estimate.baseMinutes, 2650);
  assert.equal(estimate.keycapMinutes, 750);
  assert.equal(estimate.totalPrinterMinutes, 3400);
  assert.equal(estimate.estimatedElapsedMinutes, 2650);
  assert.equal(formatProductionMinutes(estimate.totalPrinterMinutes), "56 hr 40 min");
  assert.equal(formatProductionMinutes(estimate.estimatedElapsedMinutes), "44 hr 10 min");
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

test("groups tracked keycaps and bases by colour", () => {
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
      key: "00-base-jade white",
      label: "Jade White Bases"
    }
  );

  assert.deepEqual(
    getProductionJobGroup("Jade White Bubbly Base", "Base"),
    getProductionJobGroup("Jade White Ribbed Base", "Base")
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

test("formats receiver details for EasyParcel Smart Address", () => {
  assert.equal(
    formatEasyParcelReceiver({
      customer_name: "Alicia Tan",
      delivery_address: "10 Woodlands Street 12 #03-04, 738000",
      customer_phone: "8512 1915"
    }),
    "Alicia Tan\n10 Woodlands Street 12 #03-04, 738000\nSingapore\n+6585121915"
  );

  assert.equal(
    formatEasyParcelReceiver({
      customer_name: "Ben",
      delivery_address: "20 Marsiling Lane, Singapore 739111",
      customer_phone: "+65 9123 4567"
    }),
    "Ben\n20 Marsiling Lane, Singapore 739111\n+6591234567"
  );
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

test("includes linked add-ons when their root order is selected", () => {
  const result = getProductionPreviewOrders([
    { id: 1, order_ref: "LK-100", status: "Printing" },
    { id: 2, order_ref: "LK-101", linked_order_ref: "LK-100", status: "Printing" },
    { id: 3, order_ref: "LK-102", status: "Printing" }
  ], ["1"]);

  assert.deepEqual(result.map(order => order.id), [1, 2]);
});

test("groups linked add-ons beneath one public order reference", () => {
  const result = groupLinkedOrdersForAdmin([
    { id: 1, order_ref: "LK-100", subtotal: 10, total: 12.5, order_data: [{ name: "A" }] },
    { id: 2, order_ref: "LK-101", linked_order_ref: "lk-100", subtotal: 4, total: 4, order_data: [{ name: "B" }] }
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].order_ref, "LK-100");
  assert.equal(result[0].linked_children.length, 1);
  assert.equal(result[0].order_data.length, 2);
  assert.equal(result[0].total, 16.5);
});

test("chooses a complete contrasting random colour set", () => {
  const values = [0, 0, 0];
  const result = pickRandomDesignColours({
    baseColours: ["pink", "blue"],
    capColours: ["pink", "white"],
    letterColours: ["pink", "white", "gold"],
    random: () => values.shift()
  });

  assert.deepEqual(result, { base: "pink", cap: "white", letter: "gold" });
});

test("creates alternating surprise palettes only when the customer opts in", () => {
  const single = pickRandomDesignColourSets({
    baseColours: ["pink", "blue"],
    capColours: ["white", "gold"],
    letterColours: ["purple", "yellow"],
    characterCount: 6,
    allowMultiple: false,
    random: () => 0
  });
  assert.deepEqual(single, {
    bases: ["pink"],
    caps: ["white"],
    letters: ["purple"]
  });

  const mixed = pickRandomDesignColourSets({
    baseColours: ["pink", "blue"],
    capColours: ["white", "gold"],
    letterColours: ["purple", "yellow"],
    characterCount: 6,
    allowMultiple: true,
    random: () => 0
  });
  assert.deepEqual(mixed, {
    bases: ["pink", "blue"],
    caps: ["white", "gold"],
    letters: ["purple", "yellow"]
  });
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
  ], { pink: 2, white: 1, black: 1 });

  const waves = new Map();
  lanes.forEach(lane => lane.plates.forEach(plate => {
    if (!waves.has(plate.waveIndex)) waves.set(plate.waveIndex, []);
    waves.get(plate.waveIndex).push(plate);
  }));

  assert.equal(waves.size, 2);
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
  ], { pink: 2, white: 1, gold: 1, black: 1 });

  const scheduled = lanes.flatMap(lane => lane.plates);
  const pinkWaves = scheduled
    .filter(plate => Array.from(plate.colours.values())
      .some(colour => colour.name === "Pink"))
    .map(plate => plate.waveIndex);

  assert.ok(pinkWaves.some(
    (wave, index) => pinkWaves.indexOf(wave) !== index
  ));
});

test("does not use one filament roll on both printers in the same wave", () => {
  const lanes = distributeAmsPlatesAcrossPrinters([
    { id: "pink-a", pieceCount: 40, colours: [{ name: "Pink" }] },
    { id: "pink-b", pieceCount: 35, colours: [{ name: "Pink" }] }
  ], [
    { id: "p1", name: "Printer 1" },
    { id: "p2", name: "Printer 2" }
  ], { pink: 1 });

  const pinkWaves = lanes.flatMap(lane => lane.plates)
    .map(plate => plate.waveIndex);

  assert.equal(new Set(pinkWaves).size, 2);
});

test("keeps combinations using a base printer colour in a waiting queue", () => {
  const combinations = [
    {
      id: "pink-white",
      capName: "Pink",
      letterName: "Jade White",
      rows: [{ toPrint: 3 }]
    },
    { id: "black-gold", capName: "Black", letterName: "Gold" },
    { id: "pink-pink", capName: "Pink", letterName: "Pink" }
  ];
  const result = partitionAmsCombinationsByBusyColours(
    combinations,
    ["pink"]
  );

  assert.deepEqual(result.ready.map(item => item.id), ["black-gold"]);
  assert.deepEqual(result.waiting.map(item => item.id), [
    "pink-white",
    "pink-pink"
  ]);
  assert.deepEqual(result.waiting[1].busyColours, ["Pink"]);
  assert.equal(result.waiting[0].pieceCount, 3);
});

test("reserves the base printer and leaves the other online A1 for AMS", () => {
  const printers = [
    { id: "a1", name: "Whimsy Daisy", status: "online" },
    { id: "a2", name: "Little Keeps", status: "online" },
    { id: "a3", name: "Offline backup", status: "offline" }
  ];

  assert.deepEqual(
    getFreeAmsPrinters(printers, "a1").map(printer => printer.id),
    ["a2"]
  );
  assert.deepEqual(
    getFreeAmsPrinters(printers).map(printer => printer.id),
    ["a1", "a2"]
  );
});

test("assigns only newly printed keycaps to order owners", () => {
  const owners = [
    {
      orderRef: "LK-1",
      characters: [
        { character: "A" },
        { character: "B" }
      ]
    },
    {
      orderRef: "LK-2",
      characters: [
        { character: "A" },
        { character: "C" }
      ]
    }
  ];

  assert.deepEqual(assignPrintedKeycapsToOwners(owners, [
    { letter: "A", toPrint: 1 },
    { letter: "C", toPrint: 1 }
  ]), [
    {
      orderRef: "LK-1",
      characters: [{ character: "A" }]
    },
    {
      orderRef: "LK-2",
      characters: [{ character: "C" }]
    }
  ]);
});

test("prepares an internal basket label without courier details", () => {
  assert.deepEqual(getInternalBasketLabelData({
    id: 42,
    order_ref: " LK-1042 ",
    customer_name: " Alicia Tan ",
    customer_phone: " 9123 4567 ",
    customer_email: "private@example.com",
    collection_method: "pickup",
    pickup_scheduled_date: "2026-08-08",
    pickup_time_range: "2:00 PM",
    needed_by: "2026-08-03",
    production_note: "Basket 3",
    order_data: [{ name: "Articulated Keychain", quantity: 2, custom_name: "CAT" }]
  }), {
    orderId: "42",
    orderRef: "LK-1042",
    customer: "Alicia Tan",
    method: "Pickup",
    pickupDate: "2026-08-08",
    pickupTime: "2:00 PM",
    neededBy: "2026-08-03",
    items: [{ name: "Articulated Keychain", quantity: 2, summary: "CAT" }],
    notes: "Basket 3"
  });
});

test("combines shared group designs while preserving each contributor", () => {
  assert.deepEqual(flattenSharedGroupContributions([
    {
      contributor_name: "Alicia",
      items: [{
        name: "NUR",
        quantity: 2,
        design: {
          base_shape: "bubbly",
          letter_orientation: "horizontal",
          font_size_mm: 30,
          nfc: {
            enabled: true,
            content_type: "pet",
            payload: "https://example.com/milo"
          },
          bases: ["#ffffff"],
          caps: ["#f55a74"],
          letters: ["#332d30"]
        }
      }]
    },
    {
      contributor_name: "Mei",
      items: [{ name: "KAI", quantity: 1, design: {} }]
    }
  ]), [
    {
      name: "NUR",
      quantity: 2,
      groupContributorName: "Alicia",
      custom: {
        baseShape: "bubbly",
        letterOrientation: "horizontal",
        fontSize: 30,
        nfcEnabled: true,
        nfcType: "pet",
        nfcPayload: "https://example.com/milo",
        photo: null,
        bases: ["#ffffff"],
        caps: ["#f55a74"],
        letters: ["#332d30"]
      }
    },
    {
      name: "KAI",
      quantity: 1,
      groupContributorName: "Mei",
      custom: {
        baseShape: "ribbed",
        letterOrientation: "vertical",
        fontSize: 24,
        nfcEnabled: false,
        nfcType: "guardian",
        nfcPayload: "",
        photo: null,
        bases: [],
        caps: [],
        letters: []
      }
    }
  ]);
});

test("prepares a hand-delivery label with recipient and delivery details", () => {
  assert.deepEqual(getHandDeliveryLabelData({
    id: 43,
    order_ref: " LK-1043 ",
    customer_name: " Alicia Tan ",
    customer_phone: " 9123 4567 ",
    customer_email: "private@example.com",
    collection_method: "delivery",
    delivery_address: " 10 Woodlands Street 12, #03-04, Singapore 738000 ",
    special_instructions: "Call before delivery",
    handoff_name: "Mei Lin",
    handoff_phone: "9000 1111",
    handoff_notes: "Hand to the guard",
    notes: "Call before delivery"
  }), {
    orderId: "43",
    orderRef: "LK-1043",
    customer: "Alicia Tan",
    phone: "9123 4567",
    address: "10 Woodlands Street 12, #03-04, Singapore 738000",
    handoffName: "Mei Lin",
    handoffPhone: "9000 1111",
    deliveryNotes: "Call before delivery · Hand to the guard"
  });
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

test("clears finished and expired customer reminders", () => {
  const now = new Date("2026-08-10T09:30:00+08:00").getTime();

  assert.equal(isOrderReminderFinishedOrExpired({ status: "Payment Expired" }, now), true);
  assert.equal(isOrderReminderFinishedOrExpired({ payment_type: "Paid" }, now), true);
  assert.equal(isOrderReminderFinishedOrExpired({
    status: "Pending Payment",
    payment_expires_at: "2026-08-10T09:29:59+08:00"
  }, now), true);
  assert.equal(isOrderReminderFinishedOrExpired({
    status: "Pending Payment",
    payment_expires_at: "2026-08-10T09:31:00+08:00"
  }, now), false);
});

test("clears cancelled and expired group links", () => {
  const now = new Date("2026-08-10T09:30:00+08:00").getTime();

  assert.equal(isSharedGroupCancelledOrExpired({ status: "cancelled" }, now), true);
  assert.equal(isSharedGroupCancelledOrExpired({
    status: "open",
    expires_at: "2026-08-10T09:29:59+08:00"
  }, now), true);
  assert.equal(isSharedGroupCancelledOrExpired({
    status: "open",
    expires_at: "2026-08-10T09:31:00+08:00"
  }, now), false);
});
