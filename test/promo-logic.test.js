import test from "node:test";
import assert from "node:assert/strict";

import {
  calculatePromoDiscount,
  getPromoEligibility,
  normalizePromoCode
} from "../src/promo-logic.js";

const activePromo = {
  discountType: "percent",
  discountValue: 10,
  minimumSpend: 20,
  startsAt: "2026-08-01T00:00:00.000Z",
  endsAt: "2026-09-01T00:00:00.000Z"
};

test("normalizes customer promo-code input", () => {
  assert.equal(normalizePromoCode("  little keeps  "), "LITTLEKEEPS");
});

test("applies percentage and fixed promo discounts", () => {
  const now = new Date("2026-08-15T00:00:00.000Z");
  assert.equal(calculatePromoDiscount(activePromo, 48, now), 4.8);
  assert.equal(calculatePromoDiscount({
    ...activePromo,
    discountType: "fixed",
    discountValue: 8
  }, 48, now), 8);
});

test("enforces promo dates and minimum spend", () => {
  assert.equal(
    getPromoEligibility(activePromo, 48, new Date("2026-07-31T00:00:00.000Z")).reason,
    "not_started"
  );
  assert.equal(
    getPromoEligibility(activePromo, 48, new Date("2026-09-01T00:00:00.000Z")).reason,
    "expired"
  );
  assert.equal(
    getPromoEligibility(activePromo, 10, new Date("2026-08-15T00:00:00.000Z")).reason,
    "minimum_spend"
  );
});

test("never discounts below zero even with an oversized promo", () => {
  const now = new Date("2026-08-15T00:00:00.000Z");
  assert.equal(calculatePromoDiscount({
    ...activePromo,
    minimumSpend: 0,
    discountValue: 250
  }, 12, now), 12);
});
