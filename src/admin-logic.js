export function calculateBusinessFinancials({
  printerSpend,
  filamentAccessoriesSpend,
  totalRevenue
}) {
  const roundMoney = value =>
    Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const safePrinterSpend = roundMoney(
    Math.max(0, Number(printerSpend) || 0)
  );
  const safeFilamentSpend = roundMoney(Math.max(
    0,
    Number(filamentAccessoriesSpend) || 0
  ));
  const safeRevenue = roundMoney(
    Math.max(0, Number(totalRevenue) || 0)
  );
  const totalInvestment = roundMoney(
    safePrinterSpend + safeFilamentSpend
  );
  const recoveryPercentage = totalInvestment > 0
    ? (safeRevenue / totalInvestment) * 100
    : 0;

  return {
    printerSpend: safePrinterSpend,
    filamentAccessoriesSpend: safeFilamentSpend,
    totalRevenue: safeRevenue,
    totalInvestment,
    recoveryPercentage,
    recoveryProgress: Math.min(100, recoveryPercentage),
    netCashPosition: roundMoney(safeRevenue - totalInvestment)
  };
}

export function calculatePaidOrderRevenue(orders = []) {
  const revenue = orders.reduce((sum, order) => {
    if (!["Paid", "Refunded"].includes(order?.payment_type)) {
      return sum;
    }

    const total = Math.max(0, Number(order.total) || 0);
    const refunded = Math.max(0, Number(order.refunded_amount) || 0);

    return sum + Math.max(0, total - refunded);
  }, 0);

  return Math.round((revenue + Number.EPSILON) * 100) / 100;
}

export function calculateSubscriptionSummary(subscriptions = []) {
  const active = subscriptions.filter(subscription =>
    String(subscription?.status || "active").toLowerCase() === "active"
  );
  const monthlyTotal = active.reduce(
    (sum, subscription) => sum + Math.max(0, Number(subscription.monthly_amount) || 0),
    0
  );
  const roundMoney = value =>
    Math.round((Number(value) + Number.EPSILON) * 100) / 100;

  return {
    activeCount: active.length,
    monthlyTotal: roundMoney(monthlyTotal),
    yearlyEstimate: roundMoney(monthlyTotal * 12)
  };
}

export function calculateGiftingBagTotal(quantity = 0, unitPrice = 0.5) {
  const safeQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
  const safeUnitPrice = Math.max(0, Number(unitPrice) || 0);

  return Math.round((safeQuantity * safeUnitPrice + Number.EPSILON) * 100) / 100;
}

export function getGiftingBagSelectionLimit(keychainQuantity = 0, stockQuantity = 0) {
  const stock = Math.max(0, Math.floor(Number(stockQuantity) || 0));

  return stock;
}

export function getBulkApprovalPolicy(quantity = 1) {
  const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));

  if (safeQuantity >= 151) {
    return {
      quantity: safeQuantity,
      approvalRequired: false,
      minLeadDays: 42,
      minWorkingDays: 30,
      timeframeLabel: "approximately 4–6 weeks"
    };
  }

  if (safeQuantity >= 101) {
    return {
      quantity: safeQuantity,
      approvalRequired: false,
      minLeadDays: 28,
      minWorkingDays: 20,
      timeframeLabel: "approximately 3–4 weeks"
    };
  }

  if (safeQuantity >= 76) {
    return {
      quantity: safeQuantity,
      approvalRequired: false,
      minLeadDays: 21,
      minWorkingDays: 15,
      timeframeLabel: "approximately 2–3 weeks"
    };
  }

  if (safeQuantity >= 51) {
    return {
      quantity: safeQuantity,
      approvalRequired: false,
      minLeadDays: 14,
      minWorkingDays: 10,
      timeframeLabel: "approximately 1.5–2 weeks"
    };
  }

  if (safeQuantity >= 30) {
    return {
      quantity: safeQuantity,
      approvalRequired: false,
      minLeadDays: 14,
      minWorkingDays: 10,
      timeframeLabel: "at least 14 days"
    };
  }

  if (safeQuantity >= 15) {
    return {
      quantity: safeQuantity,
      approvalRequired: false,
      minLeadDays: 7,
      minWorkingDays: 7,
      timeframeLabel: "at least 7 working days"
    };
  }

  return {
    quantity: safeQuantity,
    approvalRequired: false,
    minLeadDays: 0,
    minWorkingDays: 0,
    timeframeLabel: ""
  };
}

export function calculateProductionTimeEstimate(
  baseQuantity = 0,
  keycapQuantity = 0,
  onlinePrinterCount = 1,
  baseMinutesPerPiece = 25,
  keycapMinutesPerPiece = 15
) {
  const safeBaseQuantity = Math.max(0, Math.floor(Number(baseQuantity) || 0));
  const safeKeycapQuantity = Math.max(0, Math.floor(Number(keycapQuantity) || 0));
  const printers = Math.max(0, Math.floor(Number(onlinePrinterCount) || 0));
  const baseMinutes = safeBaseQuantity * Math.max(0, Number(baseMinutesPerPiece) || 0);
  const keycapMinutes = safeKeycapQuantity * Math.max(0, Number(keycapMinutesPerPiece) || 0);
  const totalPrinterMinutes = baseMinutes + keycapMinutes;
  const keycapPrinterCount = Math.max(1, printers - 1);
  const estimatedElapsedMinutes = printers >= 2
    ? Math.max(baseMinutes, Math.ceil(keycapMinutes / keycapPrinterCount))
    : totalPrinterMinutes;

  return {
    baseQuantity: safeBaseQuantity,
    keycapQuantity: safeKeycapQuantity,
    baseMinutes,
    keycapMinutes,
    totalPrinterMinutes,
    estimatedElapsedMinutes,
    onlinePrinterCount: printers
  };
}

export function formatProductionMinutes(minutes = 0) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (!hours) return `${remainingMinutes} min`;
  if (!remainingMinutes) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}

export function getTrackedProductionQuantity(jobs = [], itemName) {
  return jobs.reduce((sum, job) => {
    if (
      job?.item_name !== itemName ||
      !["printing", "picked"].includes(job?.stage)
    ) {
      return sum;
    }

    return sum + Math.max(0, Number(job.quantity) || 0);
  }, 0);
}

export function calculateQueuedProductionQuantity(
  requiredQuantity,
  inventoryQuantity,
  trackedQuantity
) {
  const required = Math.max(0, Number(requiredQuantity) || 0);
  const inventory = Math.max(0, Number(inventoryQuantity) || 0);
  const tracked = Math.max(0, Number(trackedQuantity) || 0);

  return Math.max(0, required - inventory - tracked);
}

export function supportsBaseOnlyAssembly(productKey) {
  return ![
    "standard-name-keychain",
    "ai-photo-keepsake",
    "custom-pencil-clicker"
  ].includes(String(productKey || ""));
}

export function buildPencilCharacterPlates(parts = [], capacity = 56) {
  const safeCapacity = Math.max(1, Math.floor(Number(capacity) || 56));
  const colourGroups = new Map();

  parts
    .filter(part => part?.roleKey === "character" && Number(part.toPrint) > 0)
    .forEach(part => {
      const topColourName = String(part.topColourName || "Selected");
      const characterColourName = String(part.characterColourName || "Selected");
      const key = `${topColourName}|${characterColourName}`;
      if (!colourGroups.has(key)) {
        colourGroups.set(key, {
          roleKey: "character",
          type: part.type || "Pencil",
          roleLabel: "Character Tops",
          colourName: `${topColourName} top + ${characterColourName} character`,
          topColourName,
          characterColourName,
          topColour: part.topColour || part.colour,
          characterColour: part.characterColour,
          parts: []
        });
      }
      colourGroups.get(key).parts.push(part);
    });

  return Array.from(colourGroups.values()).flatMap(group => {
    const plates = [];
    let rows = [];
    let quantity = 0;

    group.parts
      .slice()
      .sort((a, b) => String(a.sourceName).localeCompare(String(b.sourceName)))
      .forEach(part => {
        let remaining = Math.max(0, Math.floor(Number(part.toPrint) || 0));
        while (remaining > 0) {
          const taken = Math.min(remaining, safeCapacity - quantity);
          rows.push({ ...part, quantity: taken });
          quantity += taken;
          remaining -= taken;

          if (quantity === safeCapacity) {
            plates.push({ ...group, rows, quantity });
            rows = [];
            quantity = 0;
          }
        }
      });

    if (quantity > 0) plates.push({ ...group, rows, quantity });
    return plates.map((plate, index, all) => ({
      ...plate,
      platePart: index + 1,
      plateTotal: all.length
    }));
  });
}

export function buildPencilSingleColourPlates(parts = [], capacity = 36) {
  const safeCapacity = Math.max(1, Math.floor(Number(capacity) || 36));
  const partColourGroups = new Map();
  const roleLabels = {
    base: "Clicker Blocks",
    wood: "Wood Noses",
    tip: "Pencil Tips",
    metal: "Metal Bands",
    eraser: "Erasers",
    endCap: "End Caps"
  };

  parts
    .filter(part => part?.roleKey !== "character" && Number(part.toPrint) > 0)
    .forEach(part => {
      const roleKey = String(part.roleKey || "part");
      const colourName = String(
        part.colourName || part.colour?.name || part.colour?.hex || part.colour || "Selected"
      );
      const key = `${roleKey}|${colourName}`;
      if (!partColourGroups.has(key)) {
        partColourGroups.set(key, {
          roleKey,
          type: part.type || "Pencil",
          roleLabel: roleLabels[roleKey] || part.label || "Pencil Parts",
          colourName,
          topColour: part.colour,
          parts: []
        });
      }
      partColourGroups.get(key).parts.push(part);
    });

  return Array.from(partColourGroups.values()).flatMap(group => {
    const plates = [];
    let rows = [];
    let quantity = 0;

    group.parts
      .slice()
      .sort((a, b) => String(a.sourceName).localeCompare(String(b.sourceName)))
      .forEach(part => {
        let remaining = Math.max(0, Math.floor(Number(part.toPrint) || 0));
        while (remaining > 0) {
          const taken = Math.min(remaining, safeCapacity - quantity);
          rows.push({ ...part, quantity: taken });
          quantity += taken;
          remaining -= taken;
          if (quantity === safeCapacity) {
            plates.push({ ...group, rows, quantity });
            rows = [];
            quantity = 0;
          }
        }
      });

    if (quantity > 0) plates.push({ ...group, rows, quantity });
    return plates.map((plate, index, all) => ({
      ...plate,
      platePart: index + 1,
      plateTotal: all.length
    }));
  });
}

export function getProductionJobGroup(itemName, category) {
  if (String(itemName || "").startsWith("Pencil ")) {
    const role = String(itemName || "")
      .match(/^Pencil\s+(Character Top|Base|Wood|Tip|Metal|Eraser|End Cap)\b/i)?.[1]
      || "Part";
    return {
      key: `20-pencil-${role.toLowerCase().replace(/\s+/g, "-")}`,
      label: `Pencil · ${role}`
    };
  }

  if (category === "Base") {
    const baseName = String(itemName || "")
      .replace(/\s+(?:Bubbly|Ribbed)\s+Base$/i, "")
      .replace(/\s+Base$/i, "")
      .trim() || "Other";

    return {
      key: `00-base-${baseName.toLowerCase()}`,
      label: `${baseName} Bases`
    };
  }

  const capMatch = String(itemName || "")
    .match(/^(.+?)\s+Cap\s*\+/i);
  const capName = capMatch?.[1]?.trim();

  return {
    key: capName
      ? `10-${capName.toLowerCase()}`
      : "99-other-keycaps",
    label: capName ? `${capName} Caps` : "Other Keycaps"
  };
}

export function getDeliveryRouteGroup(deliveryAddress) {
  const address = String(deliveryAddress || "");
  const postalMatch = address.match(/(?:^|\D)(\d{6})(?:\D|$)/);
  const postalCode = postalMatch?.[1] || "";
  const sector = postalCode.slice(0, 2);

  return {
    key: sector ? `sector-${sector}` : "sector-unknown",
    label: sector
      ? `Nearby deliveries · Postal sector ${sector}`
      : "Delivery addresses without a postal code",
    note: sector
      ? "Ordered by postal code for easier hand-delivery planning."
      : "Add a six-digit postal code to include these in a nearby group.",
    postalCode,
    sortValue: sector ? Number(sector) : Number.MAX_SAFE_INTEGER
  };
}

export function formatEasyParcelReceiver(order = {}) {
  const name = String(order.customer_name || "").trim();
  const address = String(order.delivery_address || "").trim();
  const rawPhone = String(order.customer_phone || "").trim();
  const digits = rawPhone.replace(/\D/g, "");
  const phone = digits.length === 8
    ? `+65${digits}`
    : digits.length === 10 && digits.startsWith("65")
      ? `+${digits}`
      : rawPhone;
  const hasSingapore = /\bsingapore\b/i.test(address);

  return [
    name,
    address,
    address && !hasSingapore ? "Singapore" : "",
    phone
  ].filter(Boolean).join("\n");
}

export const ASSEMBLY_STAGES = [
  { key: "base_connected", label: "Base Connected" },
  { key: "letters_caps_assembled", label: "Letters/Caps Assembled" },
  { key: "keyring_added", label: "Keyring Added" },
  { key: "qc_done", label: "QC Done" },
  { key: "packed", label: "Packed" }
];

const ADD_ON_BLOCKED_STATUSES = new Set([
  "Printing",
  "Assembly Complete",
  "Ready for Pickup/Delivery",
  "Pending Pickup",
  "Pending Delivery",
  "Out for Delivery",
  "Completed",
  "Refunded",
  "Cancelled",
  "Rejected",
  "Payment Failed",
  "Payment Expired"
]);

export function canOrderAcceptAddOn(status) {
  return !ADD_ON_BLOCKED_STATUSES.has(String(status || ""));
}

export function normalizeAssemblyProgress(progress = {}) {
  const source = progress && typeof progress === "object" ? progress : {};

  return Object.fromEntries(
    ASSEMBLY_STAGES.map(stage => [stage.key, Boolean(source[stage.key])])
  );
}

export function buildGoogleMapsRouteUrl(addresses = []) {
  const stops = addresses
    .map(address => String(address || "").trim())
    .filter(Boolean);

  if (!stops.length) return "";

  const params = new URLSearchParams({
    api: "1",
    travelmode: "driving"
  });

  if (stops.length === 1) {
    params.set("destination", stops[0]);
  } else {
    params.set("origin", stops[0]);
    params.set("destination", stops.at(-1));
    if (stops.length > 2) {
      params.set("waypoints", stops.slice(1, -1).join("|"));
    }
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function getOperationalBuckets(orders = [], now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const dayDifference = value => {
    if (!value) return null;
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return Math.round((date - start) / 86400000);
  };

  const active = orders.filter(order =>
    !order?.archived_at &&
    !["Completed", "Refunded", "Payment Expired"].includes(order?.status)
  );

  return {
    overdue: active.filter(order => {
      const days = dayDifference(order.requested_completion_date || order.needed_by);
      return days !== null && days < 0;
    }),
    dueTomorrow: active.filter(order =>
      dayDifference(order.requested_completion_date || order.needed_by) === 1
    ),
    notDelivered: active.filter(order =>
      order.collection_method === "delivery" && order.status !== "Completed"
    ),
    needsReview: active.filter(order => Boolean(order.update_needs_review)),
    rework: active.filter(order => Boolean(order.rework_required)),
    assemblyInProgress: active.filter(order => {
      const progress = normalizeAssemblyProgress(order.assembly_progress);
      const complete = Object.values(progress).filter(Boolean).length;
      return complete > 0 && !progress.packed;
    }),
    packed: active.filter(order =>
      normalizeAssemblyProgress(order.assembly_progress).packed
    ),
    pickup: active.filter(order => order.collection_method !== "delivery"),
    delivery: active.filter(order => order.collection_method === "delivery")
  };
}

export function getProductionPreviewOrders(orders = [], selectedIds = []) {
  const selected = new Set(Array.from(selectedIds, id => String(id)));
  const selectedRootRefs = new Set(
    orders
      .filter(order => selected.has(String(order?.id)))
      .map(order => String(order?.linked_order_ref || order?.order_ref || "").trim().toLowerCase())
      .filter(Boolean)
  );

  return orders.filter(order =>
    (
      selected.has(String(order?.id)) ||
      selectedRootRefs.has(
        String(order?.linked_order_ref || order?.order_ref || "").trim().toLowerCase()
      )
    ) &&
    !order?.archived_at &&
    !["Completed", "Refunded", "Payment Expired"].includes(order?.status)
  );
}

export function getKeychainTurnaround(quantity = 1) {
  const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));

  if (safeQuantity <= 3) {
    return { quantity: safeQuantity, tier: "small", minDays: 2, maxDays: 3 };
  }

  if (safeQuantity <= 6) {
    return { quantity: safeQuantity, tier: "medium", minDays: 3, maxDays: 4 };
  }

  return { quantity: safeQuantity, tier: "large", minDays: 4, maxDays: 5 };
}

export function formatDateRange(startValue, endValue, formatter) {
  const format = typeof formatter === "function"
    ? formatter
    : value => String(value || "");
  const start = format(startValue);
  const end = format(endValue);

  return start === end ? start : `${start}–${end}`;
}

export function getCustomerDueDate(productionDate, pickupDate = "") {
  const production = String(productionDate || "").slice(0, 10);
  const pickup = String(pickupDate || "").slice(0, 10);

  if (!production) return pickup;
  if (!pickup) return production;
  return pickup > production ? pickup : production;
}

export function isPickupDay(dateValue) {
  const date = new Date(`${String(dateValue).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  return [0, 3, 5, 6].includes(date.getDay());
}

export const DEFAULT_PICKUP_TIME_OPTIONS = Object.freeze({
  weekday: Object.freeze(["7:00 PM", "7:30 PM", "8:00 PM"]),
  weekend: Object.freeze(["10:00 AM", "2:00 PM", "7:00 PM"])
});

export function normalizePickupTimeOptions(options = {}) {
  const normalizeList = (value, fallback) => {
    const source = Array.isArray(value) ? value : [];
    const cleaned = Array.from(new Set(source
      .map(item => String(item || "").trim())
      .filter(Boolean)));
    return cleaned.length ? cleaned : [...fallback];
  };

  return {
    weekday: normalizeList(options?.weekday, DEFAULT_PICKUP_TIME_OPTIONS.weekday),
    weekend: normalizeList(options?.weekend, DEFAULT_PICKUP_TIME_OPTIONS.weekend)
  };
}

export function getPickupTimeRanges(
  dateValue,
  configuredOptions = DEFAULT_PICKUP_TIME_OPTIONS
) {
  if (!isPickupDay(dateValue)) return [];

  const date = new Date(`${String(dateValue).slice(0, 10)}T12:00:00`);
  const day = date.getDay();
  const options = normalizePickupTimeOptions(configuredOptions);

  return day === 0 || day === 6
    ? options.weekend
    : options.weekday;
}

export function pickRandomDesignColours({
  baseColours = [],
  capColours = [],
  letterColours = [],
  random = Math.random
} = {}) {
  const choose = (list, avoid = []) => {
    const usable = list.filter(item => item && !avoid.includes(item));
    const pool = usable.length ? usable : list.filter(Boolean);
    if (!pool.length) return "#FFFFFF";
    const index = Math.min(pool.length - 1, Math.floor(Math.max(0, random()) * pool.length));
    return pool[index];
  };
  const base = choose(baseColours);
  const cap = choose(capColours, [base]);
  const letter = choose(letterColours, [base, cap]);

  return { base, cap, letter };
}

export function pickRandomDesignColourSets({
  baseColours = [],
  capColours = [],
  letterColours = [],
  characterCount = 1,
  allowMultiple = false,
  random = Math.random
} = {}) {
  const primary = pickRandomDesignColours({
    baseColours,
    capColours,
    letterColours,
    random
  });
  const colourSlots = allowMultiple && Number(characterCount) > 1 ? 2 : 1;
  const buildSet = (primaryColour, choices) => {
    if (colourSlots === 1) return [primaryColour];
    const alternatives = choices.filter(
      colour => colour && colour.toLowerCase() !== primaryColour.toLowerCase()
    );
    if (!alternatives.length) return [primaryColour];
    const index = Math.min(
      alternatives.length - 1,
      Math.floor(Math.max(0, random()) * alternatives.length)
    );
    return [primaryColour, alternatives[index]];
  };

  return {
    bases: buildSet(primary.base, baseColours),
    caps: buildSet(primary.cap, capColours),
    letters: buildSet(primary.letter, letterColours)
  };
}

export function groupLinkedOrdersForAdmin(orders = []) {
  const key = value => String(value || "").trim().toLowerCase();
  const roots = new Map();
  const children = [];

  orders.forEach(order => {
    if (order?.linked_order_ref) children.push(order);
    else roots.set(key(order?.order_ref), { ...order, linked_children: [] });
  });

  children.forEach(child => {
    const root = roots.get(key(child.linked_order_ref));
    if (!root) return;
    root.linked_children.push(child);
    root.order_data = [
      ...(Array.isArray(root.order_data) ? root.order_data : []),
      ...(Array.isArray(child.order_data) ? child.order_data : [])
    ];
    root.subtotal = Number(root.subtotal || 0) + Number(child.subtotal || 0);
    root.total = Number(root.total || 0) + Number(child.total || 0);
  });

  const orphanChildren = children.filter(child => !roots.has(key(child.linked_order_ref)));
  return [...roots.values(), ...orphanChildren];
}

export function assessRushDateCapacity(orderCount = 0, rushOrderCount = 0) {
  const total = Math.max(0, Math.floor(Number(orderCount) || 0));
  const rushes = Math.max(0, Math.floor(Number(rushOrderCount) || 0));

  if (rushes > 0) {
    return { allowed: false, reason: "A rush order is already booked for this date." };
  }

  if (total <= 2) {
    return {
      allowed: true,
      reason: total === 2
        ? "The additional rush slot is available."
        : "Rush capacity is available."
    };
  }

  return { allowed: false, reason: "Rush capacity is full for this date." };
}

export function optimizeAmsPlateSequence(plates = [], slotCount = 4) {
  const normaliseColour = colour => ({
    name: String(colour?.name || colour || "Unknown"),
    hex: colour?.hex || "#d9d9d9"
  });
  const colourKey = colour => normaliseColour(colour).name.toLowerCase();
  const getColours = plate => {
    const source = plate?.colours instanceof Map
      ? Array.from(plate.colours.values())
      : Array.isArray(plate?.colours)
        ? plate.colours
        : [];
    return source.map(normaliseColour);
  };
  const getColourKeys = plate =>
    new Set(getColours(plate).map(colourKey));

  const remaining = plates.map((plate, originalIndex) => ({
    ...plate,
    originalIndex
  }));
  if (!remaining.length) return [];

  const frequency = new Map();
  remaining.forEach(plate => {
    getColourKeys(plate).forEach(key => {
      frequency.set(key, (frequency.get(key) || 0) + 1);
    });
  });

  remaining.sort((a, b) => {
    const reuseA = Array.from(getColourKeys(a))
      .reduce((sum, key) => sum + (frequency.get(key) || 0), 0);
    const reuseB = Array.from(getColourKeys(b))
      .reduce((sum, key) => sum + (frequency.get(key) || 0), 0);
    return reuseB - reuseA ||
      Number(b.pieceCount || 0) - Number(a.pieceCount || 0);
  });

  const ordered = [remaining.shift()];
  while (remaining.length) {
    const currentKeys = getColourKeys(ordered.at(-1));
    remaining.sort((a, b) => {
      const keysA = getColourKeys(a);
      const keysB = getColourKeys(b);
      const overlapA = Array.from(keysA)
        .filter(key => currentKeys.has(key)).length;
      const overlapB = Array.from(keysB)
        .filter(key => currentKeys.has(key)).length;
      const futureReuseA = Array.from(keysA)
        .reduce((sum, key) => sum + (frequency.get(key) || 0), 0);
      const futureReuseB = Array.from(keysB)
        .reduce((sum, key) => sum + (frequency.get(key) || 0), 0);

      return overlapB - overlapA ||
        futureReuseB - futureReuseA ||
        Number(b.pieceCount || 0) - Number(a.pieceCount || 0);
    });
    ordered.push(remaining.shift());
  }

  let slots = Array(slotCount).fill(null);

  return ordered.map((plate, plateIndex) => {
    const colours = getColours(plate);
    const desired = new Map(
      colours.map(colour => [colourKey(colour), colour])
    );
    const nextSlots = [...slots];
    const assigned = new Set();

    nextSlots.forEach((colour, slotIndex) => {
      if (colour && desired.has(colourKey(colour))) {
        assigned.add(colourKey(colour));
      } else {
        nextSlots[slotIndex] = null;
      }
    });

    const newColours = colours
      .filter(colour => !assigned.has(colourKey(colour)))
      .sort((a, b) =>
        (frequency.get(colourKey(b)) || 0) -
          (frequency.get(colourKey(a)) || 0) ||
        a.name.localeCompare(b.name)
      );

    newColours.forEach(colour => {
      const emptyIndex = nextSlots.findIndex(item => item === null);
      if (emptyIndex !== -1) nextSlots[emptyIndex] = colour;
    });

    const slotAssignments = nextSlots.map((colour, slotIndex) => {
      const previousColour = slots[slotIndex];
      const isSame =
        previousColour &&
        colour &&
        colourKey(previousColour) === colourKey(colour);

      return {
        slot: slotIndex + 1,
        colour,
        previousColour,
        action: !colour
          ? "empty"
          : isSame
            ? "keep"
            : previousColour
              ? "swap"
              : "load"
      };
    });
    const changeCount = plateIndex === 0
      ? 0
      : slotAssignments.filter(item =>
          item.action === "swap" || item.action === "load"
        ).length;

    slots = nextSlots;

    return {
      ...plate,
      slotAssignments,
      changeCount
    };
  });
}

export function splitAmsCombinationsByPlateCapacity(
  combinations = [],
  maxPiecesPerPlate = 56
) {
  const capacity = Math.max(
    1,
    Math.floor(Number(maxPiecesPerPlate) || 56)
  );

  return combinations.flatMap(combination => {
    const chunks = [];
    let rows = [];
    let pieceCount = 0;

    const finishChunk = () => {
      if (!pieceCount) return;
      chunks.push({ rows, pieceCount });
      rows = [];
      pieceCount = 0;
    };

    (combination?.rows || []).forEach(row => {
      let remaining = Math.max(
        0,
        Math.floor(Number(row?.toPrint) || 0)
      );

      while (remaining > 0) {
        const available = capacity - pieceCount;
        const quantity = Math.min(remaining, available);

        rows.push({
          ...row,
          toPrint: quantity
        });
        pieceCount += quantity;
        remaining -= quantity;

        if (pieceCount >= capacity) finishChunk();
      }
    });

    finishChunk();

    if (chunks.length <= 1) {
      return chunks.length
        ? [{ ...combination, ...chunks[0] }]
        : [];
    }

    return chunks.map((chunk, index) => ({
      ...combination,
      ...chunk,
      rows: chunk.rows.map(row => ({ ...row, inputId: "" })),
      sourceStlJobId: combination.stlJobId,
      stlJobId: `${combination.stlJobId}-plate-${index + 1}`,
      splitPart: index + 1,
      splitTotal: chunks.length
    }));
  });
}

export function partitionAmsCombinationsByBusyColours(
  combinations = [],
  busyColourNames = []
) {
  const colourKey = value =>
    String(value?.name || value || "").trim().toLowerCase();
  const busyKeys = new Set(
    busyColourNames.map(colourKey).filter(Boolean)
  );
  const ready = [];
  const waiting = [];

  combinations.forEach(combination => {
    const colours = Array.isArray(combination?.colours)
      ? combination.colours
      : [combination?.capName, combination?.letterName];
    const blockedNames = colours
      .map(colour => String(colour?.name || colour || "").trim())
      .filter((name, index, all) =>
        name &&
        busyKeys.has(colourKey(name)) &&
        all.findIndex(other => colourKey(other) === colourKey(name)) === index
      );

    if (blockedNames.length) {
      waiting.push({
        ...combination,
        pieceCount: Number.isFinite(Number(combination?.pieceCount))
          ? Number(combination.pieceCount)
          : Array.isArray(combination?.rows)
            ? combination.rows.reduce(
                (sum, row) => sum + Number(row?.toPrint || 0),
                0
              )
            : 0,
        busyColours: blockedNames
      });
    } else {
      ready.push(combination);
    }
  });

  return { ready, waiting };
}

export function getFreeAmsPrinters(printers = [], basePrinterId = null) {
  const reservedId = String(basePrinterId || "");

  return printers.filter(printer =>
    printer?.status === "online" &&
    (!reservedId || String(printer.id) !== reservedId)
  );
}

export function assignPrintedKeycapsToOwners(owners = [], rows = []) {
  const remainingByCharacter = new Map(
    rows.map(row => [
      String(row?.letter || ""),
      Math.max(0, Math.floor(Number(row?.toPrint) || 0))
    ])
  );

  return owners.map(owner => ({
    ...owner,
    characters: (owner?.characters || []).filter(entry => {
      const character = String(entry?.character || "");
      const remaining = remainingByCharacter.get(character) || 0;
      if (remaining <= 0) return false;
      remainingByCharacter.set(character, remaining - 1);
      return true;
    })
  })).filter(owner => owner.characters.length > 0);
}

export function indexKeycapOwnershipGroupsByLabel(groups = {}) {
  return Object.values(groups || {}).reduce((indexed, group) => {
    if (!group?.capName || !group?.letterName) return indexed;
    indexed[`${group.capName} Cap + ${group.letterName} Letter`] = group;
    return indexed;
  }, {});
}

export function flattenSharedGroupContributions(contributions = []) {
  return (Array.isArray(contributions) ? contributions : []).flatMap(contribution =>
    (Array.isArray(contribution?.items) ? contribution.items : [])
      .filter(item => item?.name)
      .map(item => ({
        name: item.name,
        quantity: Math.min(250, Math.max(1, Math.floor(Number(item.quantity) || 1))),
        groupContributorName: contribution.contributor_name || "Group member",
        custom: {
          baseShape: item.design?.base_shape || "ribbed",
          letterOrientation: item.design?.letter_orientation || "vertical",
          fontSize: Number(item.design?.font_size_mm || 24),
          nfcEnabled: Boolean(item.design?.nfc?.enabled),
          nfcType: item.design?.nfc?.content_type || "guardian",
          nfcPayload: item.design?.nfc?.payload || "",
          photo: item.design?.photo || null,
          pencil: item.design?.pencil || null,
          bases: Array.isArray(item.design?.bases) ? item.design.bases : [],
          caps: Array.isArray(item.design?.caps) ? item.design.caps : [],
          letters: Array.isArray(item.design?.letters) ? item.design.letters : []
        }
      }))
  );
}

export function getInternalBasketLabelData(order = {}) {
  const text = value => String(value || "").trim();
  const items = (Array.isArray(order.order_data) ? order.order_data : []).map(item => ({
    name: text(item?.name || item?.product_name) || "Custom keychain",
    quantity: Math.max(1, Number(item?.quantity) || 1),
    summary: text(item?.summary || item?.design_summary || item?.custom_name)
  }));

  return {
    orderId: text(order.id),
    orderRef: text(order.order_ref) || "No order reference",
    customer: text(order.customer_name) || "Customer",
    method: order.collection_method === "delivery" ? "Delivery" : "Pickup",
    pickupDate: text(order.pickup_scheduled_date),
    pickupTime: text(order.pickup_time_range),
    neededBy: text(order.requested_completion_date || order.needed_by),
    items,
    notes: text(order.order_notes || order.production_note || order.notes)
  };
}

export function getHandDeliveryLabelData(order = {}) {
  const text = value => String(value || "").trim();
  const deliveryNotes = [
    order.special_instructions,
    order.handoff_notes,
    order.notes,
    order.preferred_time
  ]
    .map(text)
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(" · ");

  return {
    orderId: text(order.id),
    orderRef: text(order.order_ref) || "No order reference",
    customer: text(order.customer_name) || "Customer",
    phone: text(order.customer_phone) || "No contact number",
    address: text(order.delivery_address) || "Delivery address missing",
    handoffName: text(order.handoff_name),
    handoffPhone: text(order.handoff_phone),
    deliveryNotes
  };
}

export function distributeAmsPlatesAcrossPrinters(
  plates = [],
  availablePrinters = [],
  colourRollCounts = {}
) {
  const printers = availablePrinters.length
    ? availablePrinters
    : [{ id: null, name: "Printer" }];
  const lanes = printers.map(printer => ({
    printer,
    plates: [],
    pieceCount: 0
  }));

  [...plates]
    .sort((a, b) =>
      Number(b.pieceCount || 0) - Number(a.pieceCount || 0)
    )
    .forEach(plate => {
      const selectedLane = lanes
        .slice()
        .sort((a, b) =>
          a.pieceCount - b.pieceCount ||
          a.plates.length - b.plates.length
        )[0];
      selectedLane.plates.push(plate);
      selectedLane.pieceCount += Number(plate.pieceCount || 0);
    });

  const preparedLanes = lanes
    .filter(lane => lane.plates.length)
    .map(lane => {
      const orderedPlates = optimizeAmsPlateSequence(lane.plates);
      return {
        ...lane,
        plates: orderedPlates,
        spoolChanges: orderedPlates.reduce(
          (sum, plate) => sum + Number(plate.changeCount || 0),
          0
        )
      };
    })
    .sort((a, b) =>
      String(a.printer.name).localeCompare(String(b.printer.name))
    );

  const availableRollsFor = colourName => {
    const key = String(colourName || "").trim().toLowerCase();
    const savedValue = colourRollCounts instanceof Map
      ? colourRollCounts.get(key) ?? colourRollCounts.get(colourName)
      : colourRollCounts?.[key] ?? colourRollCounts?.[colourName];
    return Math.max(1, Math.floor(Number(savedValue) || 1));
  };
  const plateColourNames = plate => {
    const colours = plate?.colours instanceof Map
      ? Array.from(plate.colours.values())
      : Array.isArray(plate?.colours)
        ? plate.colours
        : [];
    return Array.from(new Set(
      colours
        .map(colour => String(colour?.name || colour || "").trim().toLowerCase())
        .filter(Boolean)
    ));
  };
  const scheduledByLane = preparedLanes.map(() => []);
  const nextPlateIndexes = preparedLanes.map(() => 0);
  let waveIndex = 0;

  while (nextPlateIndexes.some((index, laneIndex) =>
    index < preparedLanes[laneIndex].plates.length
  )) {
    const rollUsage = new Map();
    let scheduledThisWave = 0;
    const laneOrder = preparedLanes.map((_, index) =>
      (index + waveIndex) % preparedLanes.length
    );

    laneOrder.forEach(laneIndex => {
      const plate = preparedLanes[laneIndex].plates[nextPlateIndexes[laneIndex]];
      if (!plate) return;
      const colourNames = plateColourNames(plate);
      const hasEnoughRolls = colourNames.every(colourName =>
        Number(rollUsage.get(colourName) || 0) + 1 <= availableRollsFor(colourName)
      );
      if (!hasEnoughRolls && scheduledThisWave > 0) return;

      colourNames.forEach(colourName => {
        rollUsage.set(colourName, Number(rollUsage.get(colourName) || 0) + 1);
      });
      scheduledByLane[laneIndex].push({ ...plate, waveIndex });
      nextPlateIndexes[laneIndex] += 1;
      scheduledThisWave += 1;
    });

    waveIndex += 1;
  }

  return preparedLanes.map((lane, laneIndex) => ({
    ...lane,
    plates: scheduledByLane[laneIndex]
  }));
}

export function validateInventoryDecrement(currentQty, requestedQty) {
  const available = Number(currentQty);
  const requested = Number(requestedQty);

  if (!Number.isInteger(requested) || requested <= 0) {
    return {
      valid: false,
      message: "Please enter a whole number greater than zero."
    };
  }

  if (!Number.isFinite(available) || available < 0) {
    return {
      valid: false,
      message: "The current inventory quantity is invalid."
    };
  }

  if (requested > available) {
    return {
      valid: false,
      message: `Only ${available} available. You cannot subtract ${requested}.`
    };
  }

  return {
    valid: true,
    newQty: available - requested
  };
}

function firstPositiveAmount(...values) {
  const amount = values
    .map(value => Number(value))
    .find(value => Number.isFinite(value) && value > 0);
  return amount ?? 0;
}

export function getEasyParcelQuotePrices(quote = {}) {
  const pricing = quote?.pricing || {};
  const apiTotal = firstPositiveAmount(
    pricing.total_amount,
    pricing.payable_amount,
    pricing.grand_total,
    pricing.total,
    pricing.amount
  );
  const headline = firstPositiveAmount(
    pricing.shipment_price,
    pricing.discounted_amount,
    pricing.discounted_price,
    pricing.promo_amount,
    pricing.rate_amount,
    pricing.base_amount,
    pricing.base_price,
    pricing.shipping_fee,
    pricing.price,
    apiTotal
  );
  const tax = Math.max(0, Number(pricing.shipment_tax || 0));
  const addOns = Math.max(0, Number(pricing.total_features_price || 0)) +
    Math.max(0, Number(pricing.total_features_tax || 0));
  const withoutOptionalFeatures = apiTotal > 0
    ? Math.max(0, apiTotal - addOns)
    : headline + tax;

  return {
    currency: String(pricing.currency || pricing.currency_code || "SGD"),
    headline,
    payable: withoutOptionalFeatures || headline,
    apiTotal: apiTotal || withoutOptionalFeatures || headline,
    tax,
    addOns
  };
}

export function formatEasyParcelDeliveryDuration(value) {
  if (!value) return "Delivery estimate not supplied";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "Delivery estimate not supplied";
    try {
      return formatEasyParcelDeliveryDuration(JSON.parse(trimmed));
    } catch {
      return trimmed;
    }
  }
  if (typeof value !== "object") return String(value);
  const amount = String(value.value ?? "").trim();
  if (!amount) return "Delivery estimate not supplied";
  const unit = String(value.type || "days").toLowerCase().replace(/s$/, "");
  return `${amount} ${unit}${amount === "1" ? "" : "s"}`;
}

export function getEasyParcelVolumetricWeight(length, width, height) {
  const dimensions = [length, width, height].map(Number);
  if (dimensions.some(value => !Number.isFinite(value) || value <= 0)) return 0;
  return Math.round((dimensions[0] * dimensions[1] * dimensions[2] / 5000) * 100) / 100;
}

export function isEasyParcelPickupQuote(quote = {}) {
  return quote?.courier?.is_pickup === true || quote?.courier?.is_pickup === 1;
}

export function canCancelEasyParcelShipment(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return true;
  return ["schedule", "arrangement", "pending", "to be collected", "submitted", "booked", "created"]
    .some(value => normalized.includes(value));
}

export function sortEasyParcelQuotesByPrice(quotes = []) {
  return [...quotes].sort((left, right) => {
    const leftPrice = getEasyParcelQuotePrices(left).payable || Number.POSITIVE_INFINITY;
    const rightPrice = getEasyParcelQuotePrices(right).payable || Number.POSITIVE_INFINITY;
    return leftPrice - rightPrice;
  });
}

export function isOrderReminderFinishedOrExpired(order, now = Date.now()) {
  if (!order) return false;
  if (
    order.payment_type === "Paid" ||
    order.online_payment_status === "completed" ||
    ["Completed", "Cancelled", "Refunded", "Payment Expired"].includes(order.status)
  ) return true;

  const expiresAt = new Date(order.payment_expires_at || "").getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

export function isSharedGroupCancelledOrExpired(group, now = Date.now()) {
  if (!group) return true;
  if (group.status === "cancelled") return true;
  const expiresAt = new Date(group.expires_at || "").getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now;
}
