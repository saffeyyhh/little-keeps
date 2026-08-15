function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function normalizePromoCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function getPromoEligibility(promo, subtotal, now = new Date()) {
  if (!promo) {
    return { allowed: false, reason: "invalid" };
  }

  const currentTime = now instanceof Date ? now : new Date(now);
  const startsAt = promo.startsAt ? new Date(promo.startsAt) : null;
  const endsAt = promo.endsAt ? new Date(promo.endsAt) : null;

  if (startsAt && currentTime < startsAt) {
    return { allowed: false, reason: "not_started" };
  }
  if (endsAt && currentTime >= endsAt) {
    return { allowed: false, reason: "expired" };
  }
  if (Number(subtotal || 0) < Number(promo.minimumSpend || 0)) {
    return { allowed: false, reason: "minimum_spend" };
  }

  return { allowed: true, reason: "" };
}

export function calculatePromoDiscount(promo, subtotal, now = new Date()) {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  if (!getPromoEligibility(promo, safeSubtotal, now).allowed) return 0;

  const rawDiscount = promo.discountType === "fixed"
    ? Number(promo.discountValue || 0)
    : safeSubtotal * (Number(promo.discountValue || 0) / 100);

  return roundMoney(Math.min(safeSubtotal, Math.max(0, rawDiscount)));
}
