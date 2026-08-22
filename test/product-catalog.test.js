import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PRODUCT_CATALOG,
  formatProductUnitsSold,
  MODULAR_PRODUCT_KEY,
  PHOTO_PRODUCT_KEY,
  SOLID_PRODUCT_KEY,
  STANDARD_PRODUCT_KEY,
  calculateProductProductionEstimate,
  calculateProductUnitPrice,
  getProductByKey,
  normalizeProductCatalog
} from "../src/product-catalog.js";

test("formats product social proof by keychain quantity", () => {
  assert.equal(formatProductUnitsSold(1), "1 keychain sold ♡");
  assert.equal(formatProductUnitsSold(248), "248 keychains sold ♡");
});

test("keeps launch-ready products live and unfinished products safely hidden", () => {
  const catalogue = normalizeProductCatalog([]);
  const modular = getProductByKey(catalogue, MODULAR_PRODUCT_KEY);
  const solid = getProductByKey(catalogue, SOLID_PRODUCT_KEY);
  const standard = getProductByKey(catalogue, STANDARD_PRODUCT_KEY);
  const photo = getProductByKey(catalogue, PHOTO_PRODUCT_KEY);

  assert.equal(modular.name, "Chunky Modular Clicky Keychain");
  assert.equal(modular.status, "active");
  assert.equal(modular.price_visible, true);
  assert.equal(solid.status, "coming_soon");
  assert.equal(solid.price_visible, false);
  assert.equal(standard.name, "Customised Name Keychain");
  assert.equal(standard.status, "coming_soon");
  assert.equal(standard.price_visible, false);
  assert.equal(photo.status, "coming_soon");
  assert.equal(photo.price_visible, false);
  assert.equal(photo.minimum_working_days, 4);
  assert.equal(photo.maximum_working_days, 5);
});

test("upgrades the old modular product name without changing custom names", () => {
  const legacy = getProductByKey(normalizeProductCatalog([{
    product_key: MODULAR_PRODUCT_KEY,
    name: "Modular Clicky Keychain"
  }]), MODULAR_PRODUCT_KEY);
  const custom = getProductByKey(normalizeProductCatalog([{
    product_key: MODULAR_PRODUCT_KEY,
    name: "My Custom Product Name"
  }]), MODULAR_PRODUCT_KEY);
  const shortChunky = getProductByKey(normalizeProductCatalog([{
    product_key: MODULAR_PRODUCT_KEY,
    name: "Chunky Clicky Keychain"
  }]), MODULAR_PRODUCT_KEY);
  const oldBaseName = getProductByKey(normalizeProductCatalog([{
    product_key: MODULAR_PRODUCT_KEY,
    name: "Modular Base Clicky Keychain"
  }]), MODULAR_PRODUCT_KEY);

  assert.equal(legacy.name, "Chunky Modular Clicky Keychain");
  assert.equal(shortChunky.name, "Chunky Modular Clicky Keychain");
  assert.equal(oldBaseName.name, "Chunky Modular Clicky Keychain");
  assert.equal(custom.name, "My Custom Product Name");
});

test("calculates modular pricing from its own product rules", () => {
  const modular = getProductByKey(DEFAULT_PRODUCT_CATALOG, MODULAR_PRODUCT_KEY);

  assert.equal(calculateProductUnitPrice({
    product: modular,
    characterCount: 6,
    baseColourCount: 1,
    capColourCount: 1,
    letterColourCount: 1
  }), 3.2);

  assert.equal(calculateProductUnitPrice({
    product: modular,
    characterCount: 8,
    baseColourCount: 2,
    capColourCount: 2,
    letterColourCount: 2
  }), 4.6);
});

test("stores production timing separately for each product", () => {
  const modular = getProductByKey(DEFAULT_PRODUCT_CATALOG, MODULAR_PRODUCT_KEY);
  const estimate = calculateProductProductionEstimate(modular, 6, 2);

  assert.deepEqual(estimate, {
    productKey: MODULAR_PRODUCT_KEY,
    quantity: 2,
    characterCount: 6,
    baseMinutes: 300,
    keycapMinutes: 180,
    assemblyMinutes: 0,
    totalMinutes: 480
  });
});

test("merges saved product settings over safe defaults", () => {
  const catalogue = normalizeProductCatalog([{
    product_key: SOLID_PRODUCT_KEY,
    status: "active",
    price_visible: true,
    launch_base_price: "4.10"
  }]);
  const solid = getProductByKey(catalogue, SOLID_PRODUCT_KEY);

  assert.equal(solid.status, "active");
  assert.equal(solid.price_visible, true);
  assert.equal(solid.launch_base_price, 4.1);
  assert.equal(solid.name, "Solid Clicky Keychain");
});

test("keeps optional product lead times empty unless configured", () => {
  const catalogue = normalizeProductCatalog([{
    product_key: MODULAR_PRODUCT_KEY,
    minimum_working_days: null,
    maximum_working_days: null
  }]);
  const modular = getProductByKey(catalogue, MODULAR_PRODUCT_KEY);

  assert.equal(modular.minimum_working_days, null);
  assert.equal(modular.maximum_working_days, null);
});
