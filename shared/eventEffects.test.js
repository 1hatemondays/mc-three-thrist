import assert from "node:assert/strict";
import test from "node:test";
import { EVENT_TILE_TYPES, SUPPORT_ITEM_TYPES } from "./gameContent.js";
import { normalizeCombatEffect, normalizeRoundEffect, normalizeSupportEffect } from "./eventEffects.js";

test("normalizes global meteor and monster effects with shield outcomes", () => {
  const meteor = normalizeRoundEffect({
    teamId: "team1",
    event: {
      type: EVENT_TILE_TYPES.METEOR_STRIKE,
      name: "Mưa sao băng",
      message: "Tất cả đội mất 10 máu",
      outcomes: [
        { teamId: "team1", shielded: false, hpLoss: 10 },
        { teamId: "team2", shielded: true }
      ]
    }
  }, "team2");

  assert.equal(meteor.kind, "meteor");
  assert.equal(meteor.currentTeamShielded, true);
  assert.deepEqual(meteor.shieldedTeamIds, ["team2"]);

  const monster = normalizeRoundEffect({
    teamId: "team1",
    event: { type: EVENT_TILE_TYPES.MONSTER_ATTACK, outcomes: [] }
  });
  assert.equal(monster.kind, "monster");
});

test("normalizes freeze roles without exposing private team data", () => {
  const result = {
    type: SUPPORT_ITEM_TYPES.FREEZE_OPPONENT,
    sourceTeamId: "team1",
    sourceTeamName: "Alpha",
    targetTeamId: "team2",
    targetTeamName: "Beta",
    resolvedAt: 123
  };

  assert.equal(normalizeSupportEffect(result, "team2").role, "target");
  assert.equal(normalizeSupportEffect(result, "team1").role, "source");
  assert.equal(normalizeSupportEffect(result, "team3").role, "viewer");
});

test("normalizes a shielded combat result for the losing team", () => {
  const effect = normalizeCombatEffect({
    winnerId: "team2",
    winnerName: "Beta",
    loserId: "team1",
    loserName: "Alpha",
    attackerBet: 5,
    defenderBet: 10,
    hpLoss: 0,
    shielded: true,
    resolvedAt: 456
  }, "team1");

  assert.equal(effect.kind, "shield");
  assert.equal(effect.role, "protected");
});
