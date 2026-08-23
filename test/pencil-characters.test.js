import test from "node:test";
import assert from "node:assert/strict";

import {
  PENCIL_SYMBOLS,
  getPencilCharacterStlName,
  sanitizePencilCharacters
} from "../src/pencil-characters.js";

test("pencil accepts only characters supplied by its STL set", () => {
  assert.equal(sanitizePencilCharacters("Ab3♡🎀🦋+"), "AB3♡🦋+");
  assert.equal(sanitizePencilCharacters("cat🐱"), "CAT");
});

test("every pencil symbol maps to its supplied raised STL", () => {
  Object.entries(PENCIL_SYMBOLS).forEach(([symbol, name]) => {
    assert.equal(getPencilCharacterStlName(symbol), `Symbol ${name} (Raised).stl`);
  });
  assert.equal(getPencilCharacterStlName("a"), "Letter A (Raised).stl");
  assert.equal(getPencilCharacterStlName("7"), "Number 7 (Raised).stl");
  assert.equal(getPencilCharacterStlName("🎀"), "");
});
