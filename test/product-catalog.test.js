import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PRODUCT_CATALOG,
  formatProductUnitsSold,
  MODULAR_PRODUCT_KEY,
  PENCIL_PRODUCT_KEY,
  READY_MADE_PRODUCT_TYPE,
  PHOTO_PRODUCT_KEY,
  SOLID_PRODUCT_KEY,
  STANDARD_PRODUCT_KEY,
  applyProductCatalogOverrides,
  applyProductStatusOverrides,
  calculateProductProductionEstimate,
  calculateProductUnitPrice,
  getProductByKey,
  normalizeProductCatalogOverrides,
  normalizeProductStatusOverrides,
  normalizeProductCatalog,
  normalizeProductOptions,
  isReadyMadeProduct
} from "../src/product-catalog.js";

test("normalizes ready-made product options and stock", () => {
  const catalogue = normalizeProductCatalog([{
    product_key: "ready-strawberry-cat",
    product_type: READY_MADE_PRODUCT_TYPE,
    name: "Strawberry Cat",
    status: "active",
    usual_base_price: "8.90",
    launch_base_price: "8.90",
    stock_quantity: "12",
    options: [
      { name: "Finish", values: ["Keychain", "Bag tag", "Keychain"] },
      { name: "", values: ["Ignore"] }
    ]
  }]);
  const product = catalogue.find(item => item.product_key === "ready-strawberry-cat");

  assert.equal(isReadyMadeProduct(product), true);
  assert.equal(product.stock_quantity, 12);
  assert.deepEqual(product.options, [{ name: "Finish", values: ["Keychain", "Bag tag"] }]);
});

test("limits product options to usable named choices", () => {
  assert.deepEqual(normalizeProductOptions([
    { name: " Colour ", values: [" Pink ", "", "Blue"] },
    null
  ]), [{ name: "Colour", values: ["Pink", "Blue"] }]);
});

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
  const pencil = getProductByKey(catalogue, PENCIL_PRODUCT_KEY);

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
  assert.equal(pencil.name, "Custom Pencil Clicker Keychain");
  assert.equal(pencil.status, "coming_soon");
  assert.equal(pencil.price_visible, false);
  assert.equal(pencil.included_characters, 6);
  assert.equal(pencil.extra_character_price, 0.2);
  assert.equal(pencil.extra_base_colour_price, 0.5);
  assert.equal(pencil.extra_cap_colour_price, 0.3);
  assert.equal(pencil.extra_letter_colour_price, 0.2);
  assert.equal(pencil.maximum_characters, 10);
});

test("upgrades the pencil's original flat pricing to the main clicky structure", () => {
  const pencil = getProductByKey(normalizeProductCatalog([{
    product_key: PENCIL_PRODUCT_KEY,
    included_characters: 10,
    extra_character_price: 0,
    extra_base_colour_price: 0,
    extra_cap_colour_price: 0,
    extra_letter_colour_price: 0
  }]), PENCIL_PRODUCT_KEY);

  assert.equal(pencil.included_characters, 6);
  assert.equal(pencil.extra_character_price, 0.2);
  assert.equal(pencil.extra_base_colour_price, 0.5);
  assert.equal(pencil.extra_cap_colour_price, 0.3);
  assert.equal(pencil.extra_letter_colour_price, 0.2);
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
  assert.equal(solid.name, "Compact Solid Clicky Keychain");
  assert.equal(solid.minimum_characters, 1);
  assert.equal(solid.maximum_characters, 10);
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

test("applies saved product visibility independently of pricing", () => {
  const catalogue = applyProductStatusOverrides(DEFAULT_PRODUCT_CATALOG, {
    [PENCIL_PRODUCT_KEY]: "hidden"
  });

  assert.equal(getProductByKey(catalogue, PENCIL_PRODUCT_KEY).status, "hidden");
  assert.equal(getProductByKey(catalogue, MODULAR_PRODUCT_KEY).status, "active");
});

test("always shows pricing when a product is available", () => {
  const catalogue = applyProductStatusOverrides(normalizeProductCatalog([{
    product_key: PENCIL_PRODUCT_KEY,
    status: "coming_soon",
    price_visible: false
  }]), {
    [PENCIL_PRODUCT_KEY]: "active"
  });

  const pencil = getProductByKey(catalogue, PENCIL_PRODUCT_KEY);
  assert.equal(pencil.status, "active");
  assert.equal(pencil.price_visible, true);
});

test("ignores invalid product visibility overrides", () => {
  assert.deepEqual(normalizeProductStatusOverrides({
    [PENCIL_PRODUCT_KEY]: "deleted",
    [SOLID_PRODUCT_KEY]: "coming_soon"
  }), {
    [SOLID_PRODUCT_KEY]: "coming_soon"
  });
});

test("preserves pricing when the product table cannot save", () => {
  const catalogue = applyProductCatalogOverrides(DEFAULT_PRODUCT_CATALOG, {
    [PENCIL_PRODUCT_KEY]: {
      price_visible: true,
      usual_base_price: 10.9,
      launch_base_price: 8.9,
      launch_price_enabled: true
    }
  });
  const pencil = getProductByKey(catalogue, PENCIL_PRODUCT_KEY);

  assert.equal(pencil.price_visible, true);
  assert.equal(pencil.usual_base_price, 10.9);
  assert.equal(pencil.launch_base_price, 8.9);
});

test("normalizes saved product pricing overrides", () => {
  assert.deepEqual(normalizeProductCatalogOverrides({
    [SOLID_PRODUCT_KEY]: { price_visible: true }
  }), {
    [SOLID_PRODUCT_KEY]: {
      product_key: SOLID_PRODUCT_KEY,
      price_visible: true
    }
  });
});
