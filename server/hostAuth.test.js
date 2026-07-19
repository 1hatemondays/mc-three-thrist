import assert from "node:assert/strict";
import test from "node:test";
import { isValidHostAccessKey } from "./hostAuth.js";

test("accepts only the exact host access key", () => {
  assert.equal(isValidHostAccessKey("6194", "6194"), true);
  assert.equal(isValidHostAccessKey("6195", "6194"), false);
  assert.equal(isValidHostAccessKey("619", "6194"), false);
  assert.equal(isValidHostAccessKey("61945", "6194"), false);
  assert.equal(isValidHostAccessKey("61a4", "6194"), false);
});

test("rejects missing or invalid host access key values", () => {
  assert.equal(isValidHostAccessKey(undefined, "6194"), false);
  assert.equal(isValidHostAccessKey("6194", ""), false);
  assert.equal(isValidHostAccessKey(6194, "6194"), false);
});
