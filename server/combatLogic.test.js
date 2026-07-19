import assert from "node:assert/strict";
import test from "node:test";
import { ROUND_PHASES } from "../shared/constants.js";
import { EVENT_TILE_TYPES, SUPPORT_ITEM_TYPES } from "../shared/gameContent.js";
import { applyEventTileEffect, resolvePendingEvent } from "./eventLogic.js";
import { getHostCombatState, getPlayerCombatState, submitCombatBet } from "./combatLogic.js";

const makeTeam = (id, score = 50) => ({
  id,
  name: id,
  hp: 100,
  score,
  position: { x: 0, y: 0 },
  startPoint: { x: 0, y: 0 },
  endPoint: { x: 5, y: 5 },
  walls: [],
  discoveredCells: [{ x: 0, y: 0 }],
  supportItems: []
});
const makeState = () => ({
  config: { boardSize: 6, teamCount: 2 },
  teams: [makeTeam("team1"), makeTeam("team2")],
  setup: { complete: true, started: true },
  round: {
    roundNumber: 2,
    phase: ROUND_PHASES.MOVEMENT,
    pendingAnswers: {},
    currentQuestion: null,
    eventTiles: [],
    pendingEvents: {},
    messages: {}
  }
});

test("duel event lets the triggering team choose an opponent and resolves HP loss", () => {
  const state = makeState();
  state.teams.push(makeTeam("team3"));
  const event = applyEventTileEffect(state, "team1", { type: EVENT_TILE_TYPES.DUEL, x: 1, y: 0 }, () => 0);

  assert.equal(event.type, EVENT_TILE_TYPES.DUEL);
  assert.equal(state.round.phase, ROUND_PHASES.MOVEMENT);
  assert.equal(state.round.pendingEvents.team1.type, EVENT_TILE_TYPES.DUEL);
  assert.deepEqual(
    event.options.map((option) => option.id),
    ["team2", "team3"]
  );

  const chosen = resolvePendingEvent(state, "team1", { targetTeamId: "team2" });
  assert.equal(chosen.ok, true);
  assert.equal(state.round.phase, ROUND_PHASES.COMBAT);
  assert.equal(state.round.combat.attackerId, "team1");
  assert.equal(state.round.combat.defenderId, "team2");

  const playerCombat = getPlayerCombatState(state, "team1");
  const unrelatedCombat = getPlayerCombatState(state, "team3");
  const hostCombat = getHostCombatState(state);
  assert.equal(playerCombat.opponentName, "team2");
  assert.deepEqual(playerCombat.attacker, { id: "team1", name: "team1" });
  assert.equal(playerCombat.maxBid, 50);
  assert.equal(unrelatedCombat, null);
  assert.deepEqual(hostCombat.attacker, { id: "team1", name: "team1" });
  assert.equal("bets" in playerCombat, false);
  assert.equal("bets" in hostCombat, false);

  assert.equal(submitCombatBet(state, "team1", { amount: 5 }).resolved, false);
  const result = submitCombatBet(state, "team2", { amount: 20 });

  assert.equal(result.resolved, true);
  assert.equal(state.round.phase, ROUND_PHASES.MOVEMENT);
  assert.equal(state.round.combat.result.winnerId, "team2");
  assert.equal(state.teams[0].hp, 85);
  assert.equal(state.round.combat.bets, undefined);
});

test("shield blocks one combat loss", () => {
  const state = makeState();
  state.teams[0].supportItems.push({ type: SUPPORT_ITEM_TYPES.SHIELD, instanceId: "shield:1" });
  applyEventTileEffect(state, "team1", { type: EVENT_TILE_TYPES.DUEL, x: 1, y: 0 }, () => 0);
  resolvePendingEvent(state, "team1", { targetTeamId: "team2" });

  submitCombatBet(state, "team1", { amount: 5 });
  submitCombatBet(state, "team2", { amount: 10 });

  assert.equal(state.teams[0].hp, 100);
  assert.equal(state.teams[0].supportItems.length, 0);
  assert.equal(state.round.combat.result.shielded, true);
});
