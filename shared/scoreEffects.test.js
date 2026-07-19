import assert from "node:assert/strict";
import test from "node:test";
import { getScoreDelta, nextDisplayedScore, normalizeScore } from "./scoreEffects.js";

test("score deltas preserve positive, negative and unchanged values", () => {
  assert.equal(getScoreDelta(20, 30), 10);
  assert.equal(getScoreDelta(30, 12), -18);
  assert.equal(getScoreDelta(12, 12), 0);
});

test("invalid score values do not create false score effects", () => {
  assert.equal(normalizeScore("25"), 25);
  assert.equal(normalizeScore(Number.NaN), 0);
  assert.equal(getScoreDelta(undefined, 10), 0);
  assert.equal(getScoreDelta(10, Infinity), 0);
});

test("displayed score steps toward the target without overshooting", () => {
  assert.equal(nextDisplayedScore(10, 20), 12);
  assert.equal(nextDisplayedScore(19, 20), 20);
  assert.equal(nextDisplayedScore(20, 10), 18);
  assert.equal(nextDisplayedScore(11, 10), 10);
  assert.equal(nextDisplayedScore(10, 10), 10);
});
