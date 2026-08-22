import test from "node:test";
import assert from "node:assert/strict";
import {
  mapArtworkClustersToFilaments,
  normalizePhotoFilamentPalette
} from "../src/photo-palette.js";

test("normalizes only named BASIC and MATTE photo filaments", () => {
  assert.deepEqual(normalizePhotoFilamentPalette([
    { name: " Black ", hex: "#000", material_type: "basic" },
    { name: "Cream", colour: "#F6E4C8", materialType: "matte" },
    { name: "Duplicate", hex: "#000000" }
  ]), [
    { name: "Black", hex: "#000000", material_type: "BASIC" },
    { name: "Cream", hex: "#F6E4C8", material_type: "MATTE" }
  ]);
});

test("maps artwork clusters to unique stocked filament colours", () => {
  const mapped = mapArtworkClustersToFilaments([
    [4, 5, 6],
    [244, 226, 195],
    [115, 76, 48]
  ], [
    { name: "Black", hex: "#000000", material_type: "BASIC" },
    { name: "Cream", hex: "#F6E4C8", material_type: "MATTE" },
    { name: "Brown", hex: "#744B30", material_type: "MATTE" },
    { name: "Pink", hex: "#F55A74", material_type: "BASIC" }
  ]);
  assert.deepEqual(mapped.map(item => item.name), ["Black", "Cream", "Brown"]);
  assert.equal(new Set(mapped.map(item => item.hex)).size, mapped.length);
});
