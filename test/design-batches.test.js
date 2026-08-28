import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDesignBatchNames,
  getDesignBatchGroups,
  parseDesignBatchNames
} from "../src/design-batches.js";

test("turns blank-line-separated names into design batches", () => {
  const entries = parseDesignBatchNames("Amy\nBen\n\nCara\nDan\n\nEli");
  assert.deepEqual(entries.map(item => item.designBatchId), [
    "batch-1", "batch-1", "batch-2", "batch-2", "batch-3"
  ]);
});

test("formats design batches without losing their separators", () => {
  const entries = parseDesignBatchNames("Amy\nBen\n\nCara\nDan");
  assert.equal(formatDesignBatchNames(entries), "Amy\nBen\n\nCara\nDan");
  assert.equal(getDesignBatchGroups(entries).length, 2);
});
