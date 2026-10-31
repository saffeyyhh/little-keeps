import test from "node:test";
import assert from "node:assert/strict";

import { getUnavailableReadyMadeColours } from "../src/ready-made-stock.js";

const colours = [
  { name: "Pink", hex: "#F45174", active: true },
  { name: "Cyan", hex: "#118FD1", active: true },
  { name: "Black", hex: "#000000", active: false }
];

test("ready-made products ignore internal placeholder colours", () => {
  assert.deepEqual(getUnavailableReadyMadeColours({
    Finish: "With keychain"
  }, colours, []), []);
});

test("ready-made products validate only customer-facing colour choices", () => {
  assert.deepEqual(getUnavailableReadyMadeColours({
    "Leg colour": "Pink",
    Finish: "Without keychain"
  }, colours, []), []);
  assert.deepEqual(getUnavailableReadyMadeColours({
    "Leg colour": "Cyan"
  }, colours, ["cyan"]), ["Cyan"]);
  assert.deepEqual(getUnavailableReadyMadeColours({
    "Leg colour": "Black"
  }, colours, []), ["Black"]);
});
