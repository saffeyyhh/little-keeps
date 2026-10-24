import test from "node:test";
import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const modelRoot = fileURLToPath(new URL("../public/models/normal-grid/", import.meta.url));

test("includes every exact normal-grid base and A-Z cap used by the preview", async () => {
  const baseNames = [
    "3-l",
    "4-square",
    "4-t",
    "4-inverted-t",
    "6-grid",
    "9-grid",
    "12-grid"
  ];
  const letters = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  const paths = [
    ...baseNames.map(name => `${modelRoot}/normal-grid-base-${name}.stl`),
    ...letters.map(letter => `${modelRoot}/normal-grid-cap-${letter}.stl`)
  ];

  const sizes = await Promise.all(paths.map(async path => (await stat(path)).size));
  assert.equal(paths.length, 33);
  assert.ok(sizes.every(size => size > 84));
});
