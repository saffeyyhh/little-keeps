import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_COLOUR_OPTIONS,
  normalizeColourOptions
} from "../src/colour-catalog.js";

test("normalizes editable colours and preserves their order", () => {
  assert.deepEqual(normalizeColourOptions([
    { name: " Peach ", hex: "#fab", material_type: "matte", roll_count: 2, active: true },
    { name: "Sky", colour: "#12abef", material_type: "basic", roll_count: 1, active: false }
  ]), [
    { name: "Peach", hex: "#FFAABB", material_type: "MATTE", roll_count: 2, active: true },
    { name: "Sky", hex: "#12ABEF", material_type: "BASIC", roll_count: 1, active: false }
  ]);
});

test("drops duplicate or invalid colour entries", () => {
  assert.deepEqual(normalizeColourOptions([
    { name: "Pink", hex: "#F55A74" },
    { name: "pink", hex: "#000000" },
    { name: "Black", hex: "#F55A74" },
    { name: "Broken", hex: "pink" }
  ]), [
    { name: "Pink", hex: "#F55A74", material_type: "BASIC", roll_count: 1, active: true }
  ]);
});

test("uses the built-in palette when no saved colours exist", () => {
  assert.equal(normalizeColourOptions(null).length, DEFAULT_COLOUR_OPTIONS.length);
});
