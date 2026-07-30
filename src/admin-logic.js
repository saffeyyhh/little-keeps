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
