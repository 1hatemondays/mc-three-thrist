import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTeamId } from "./gameState.js";

test("normalizes classroom-friendly team codes", () => {
  assert.equal(normalizeTeamId("team1"), "team1");
  assert.equal(normalizeTeamId("team 1"), "team1");
  assert.equal(normalizeTeamId(" TEAM 1 "), "team1");
});
