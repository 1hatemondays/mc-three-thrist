import assert from "node:assert/strict";
import test from "node:test";
import { ROUND_PHASES } from "../shared/constants.js";
import { ensureTeam, gameState, getPlayerState, normalizeTeamId } from "./gameState.js";

test("normalizes classroom-friendly team codes", () => {
  assert.equal(normalizeTeamId("team1"), "team1");
  assert.equal(normalizeTeamId("team 1"), "team1");
  assert.equal(normalizeTeamId(" TEAM 1 "), "team1");
});

test("creates dynamic teams on join and keeps the joined count in config", () => {
  const state = {
    config: { boardSize: 6, teamCount: 0 },
    teams: [],
    setup: { submissions: {}, complete: false, started: false },
    round: {}
  };

  const team1 = ensureTeam(state, "team1");
  const team7 = ensureTeam(state, "team7");
  const sameTeam1 = ensureTeam(state, "team1");

  assert.equal(team1.id, "team1");
  assert.equal(team1.name, "Đội 1");
  assert.equal(team7.id, "team7");
  assert.equal(team7.name, "Đội 7");
  assert.strictEqual(sameTeam1, team1);
  assert.deepEqual(
    state.teams.map((team) => team.id),
    ["team1", "team7"]
  );
  assert.equal(state.config.teamCount, 2);
});

test("player state includes auction data when movement round advances to auction", () => {
  gameState.config = { boardSize: 6, teamCount: 2 };
  gameState.teams = [];
  gameState.setup = { submissions: {}, complete: true, started: true };
  ensureTeam(gameState, "team1");
  ensureTeam(gameState, "team2");
  gameState.round = {
    roundNumber: 2,
    phase: ROUND_PHASES.AUCTION,
    pendingAnswers: {},
    currentQuestion: null,
    pendingEvents: {},
    auction: { bids: {}, result: null },
    combat: null,
    traps: [],
    messages: {}
  };

  const playerState = getPlayerState("team1");

  assert.equal(playerState.round.phase, ROUND_PHASES.AUCTION);
  assert.equal(playerState.round.auction.totalTeams, 2);
  assert.equal(playerState.round.auction.submittedCount, 0);
  assert.ok(playerState.round.auction.items.length > 0);
});
