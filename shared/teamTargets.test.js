import assert from "node:assert/strict";
import test from "node:test";
import { getOpponentTeams } from "./teamTargets.js";

test("freeze target choices keep every other public team", () => {
  const teams = [
    { id: "team1", name: "Alpha" },
    { id: "team2", name: "Beta" },
    { id: "team3", name: "Gamma" }
  ];

  assert.deepEqual(getOpponentTeams(teams, "team1"), [
    { id: "team2", name: "Beta" },
    { id: "team3", name: "Gamma" }
  ]);
});

test("freeze target choices ignore malformed and duplicate teams", () => {
  assert.deepEqual(
    getOpponentTeams([
      { id: "team1", name: "Alpha" },
      { id: "team2", name: "Beta", score: 90 },
      { id: "team2", name: "Beta duplicate" },
      null
    ], "team1"),
    [{ id: "team2", name: "Beta" }]
  );
});
