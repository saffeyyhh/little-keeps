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

export function getProductionJobGroup(itemName, category) {
  if (category === "Base") {
    return {
      key: "00-bases",
      label: "Bases"
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

export const ASSEMBLY_STAGES = [
  { key: "base_connected", label: "Base Connected" },
  { key: "letters_caps_assembled", label: "Letters/Caps Assembled" },
  { key: "keyring_added", label: "Keyring Added" },
  { key: "qc_done", label: "QC Done" },
  { key: "packed", label: "Packed" }
];

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

  return orders.filter(order =>
    selected.has(String(order?.id)) &&
    !order?.archived_at &&
    !["Completed", "Refunded", "Payment Expired"].includes(order?.status)
  );
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

export function distributeAmsPlatesAcrossPrinters(
  plates = [],
  availablePrinters = []
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

  return preparedLanes.map(lane => {
    return {
      ...lane,
      plates: lane.plates.map((plate, waveIndex) => ({
        ...plate,
        waveIndex
      }))
    };
  });
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
