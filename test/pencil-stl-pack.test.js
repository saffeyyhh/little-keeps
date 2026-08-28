import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPencilStlManifest,
  buildPencilStlPackPlan
} from "../src/pencil-stl-pack.js";

test("builds the exact raised-character and eraser STL list", () => {
  const plan = buildPencilStlPackPlan({
    order: { order_ref: "LK-123" },
    item: {
      name: "AB",
      design: {
        bases: [{ name: "Yellow" }, { name: "Pink" }],
        caps: [{ name: "White" }],
        letters: [{ name: "Black" }],
        pencil: {
          ending_style: "eraser",
          wood: { name: "Desert Tan" },
          tip: { name: "Black" },
          ferrule: { name: "Silver" },
          eraser: { name: "Pink" }
        }
      }
    },
    quantity: 2
  });

  assert.deepEqual(plan.blocks.map(block => block.characterFile), [
    "Letter A (Raised).stl",
    "Letter B (Raised).stl"
  ]);
  assert.ok(plan.requiredFiles.includes("Pencil Body.stl"));
  assert.ok(plan.requiredFiles.includes("Blanked Customizable TOP.stl"));
  assert.ok(plan.requiredFiles.includes("Ferrule.stl"));
  assert.ok(plan.requiredFiles.includes("Eraser.stl"));
  assert.equal(plan.parts.find(part => part.role === "Pencil block" && part.colour === "Yellow").pieces, 2);
  assert.match(buildPencilStlManifest(plan), /Finished pencils required: 2/);
});

test("uses the single-colour end cap and rejects unsupported characters", () => {
  const plan = buildPencilStlPackPlan({
    item: {
      name: "A1★",
      design: { pencil: { ending_style: "endCap", end_cap: { name: "Blue" } } }
    }
  });

  assert.ok(plan.requiredFiles.includes("Pencil End Cap - Single Color.stl"));
  assert.ok(!plan.requiredFiles.includes("Eraser.stl"));
  assert.ok(plan.requiredFiles.includes("Number 1 (Raised).stl"));
  assert.ok(plan.requiredFiles.includes("Symbol Star (Raised).stl"));
  assert.throws(
    () => buildPencilStlPackPlan({ item: { name: "A🙂", design: {} } }),
    /Missing licensed STL mapping/
  );
});
