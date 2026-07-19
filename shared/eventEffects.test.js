import assert from "node:assert/strict";
import test from "node:test";
import { EVENT_TILE_TYPES, SUPPORT_ITEM_TYPES } from "./gameContent.js";
import * as eventEffects from "./eventEffects.js";

const { normalizeCombatEffect, normalizeRoundEffect, normalizeSupportEffect } = eventEffects;

test("builds a persistent frozen alert until the skipped turn clears", () => {
  assert.equal(typeof eventEffects.getActivePlayerAlert, "function");
  const alert = eventEffects.getActivePlayerAlert({
    team: { statusEffects: { skipTurns: 0 } },
    round: { pendingAnswer: { result: { frozen: true } }, pendingEvent: null }
  });

  assert.equal(alert.kind, "freeze");
  assert.equal(alert.title, "Bạn đang bị đóng băng");
  assert.match(alert.message, /mất một lượt/i);
});

test("builds an active event alert while an event needs player action", () => {
  const alert = eventEffects.getActivePlayerAlert({
    team: { statusEffects: { skipTurns: 0 } },
    round: {
      pendingAnswer: null,
      pendingEvent: {
        type: EVENT_TILE_TYPES.TELEPORT,
        name: "Dịch chuyển",
        description: "Chọn vị trí mới hoặc ở lại."
      }
    }
  });

  assert.equal(alert.kind, EVENT_TILE_TYPES.TELEPORT);
  assert.equal(alert.title, "Bạn đang gặp: Dịch chuyển");
  assert.equal(alert.message, "Chọn vị trí mới hoặc ở lại.");
});

test("keeps a lost-turn alert visible before and during the skipped turn", () => {
  const queued = eventEffects.getActivePlayerAlert({
    team: { statusEffects: { skipTurns: 1 } },
    round: { pendingAnswer: null, pendingEvent: null }
  });
  const consumed = eventEffects.getActivePlayerAlert({
    team: { statusEffects: { skipTurns: 0 } },
    round: { pendingAnswer: { result: { skipped: true } }, pendingEvent: null }
  });

  assert.equal(queued.kind, "skip-turn");
  assert.equal(consumed.kind, "skip-turn");
});

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
