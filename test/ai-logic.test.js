import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAiDesignSuggestions } from "../src/ai-logic.js";

test("AI design ideas are restricted to current stock and allowed icons", () => {
  const stock = [{ name: "Pink", hex: "#FFAAAA" }, { name: "White", hex: "#FFFFFF" }, { name: "Black", hex: "#000000" }];
  const result = normalizeAiDesignSuggestions([
    { title: "Cute", base_hex: "#ffaaaa", cap_hex: "#ffffff", letter_hex: "#000000", icon: "♡" },
    { title: "Invented", base_hex: "#123456", cap_hex: "#ffffff", letter_hex: "#000000", icon: "★" }
  ], stock, ["♡"]);
  assert.equal(result.length, 1);
  assert.equal(result[0].baseHex, "#FFAAAA");
  assert.equal(result[0].icon, "♡");
});
