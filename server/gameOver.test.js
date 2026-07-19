import assert from "node:assert/strict";
import test from "node:test";
import { ROUND_PHASES } from "../shared/constants.js";
import { buildGameOver, finishGame, getPlayerGameOverState, showGameOverLeaderboard } from "./gameOver.js";

const makeTeam = (overrides = {}) => ({
  id: overrides.id || "team1",
  name: overrides.name || overrides.id || "team1",
  hp: overrides.hp ?? 100,
  score: overrides.score ?? 0,
  position: overrides.position || { x: 0, y: 0 },
  startPoint: overrides.startPoint || { x: 0, y: 0 },
  endPoint: overrides.endPoint || { x: 5, y: 5 },
  walls: overrides.walls || [],
  discoveredCells: overrides.discoveredCells || [{ x: 0, y: 0 }],
  revealedWalls: overrides.revealedWalls || [],
  answerStats: overrides.answerStats || { correct: 0, wrong: 0 }
});

const makeState = () => ({
  config: { boardSize: 6, teamCount: 3 },
  teams: [
    makeTeam({
      id: "team1",
      name: "Alpha",
      score: 10,
      hp: 70,
      position: { x: 5, y: 5 },
      walls: [{ x: 1, y: 0, side: "left" }],
      discoveredCells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 5 }],
      revealedWalls: [{ x: 1, y: 0, side: "left" }],
      answerStats: { correct: 2, wrong: 1 }
    }),
    makeTeam({
      id: "team2",
      name: "Beta",
      score: 80,
      hp: 90,
      discoveredCells: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
      answerStats: { correct: 5, wrong: 0 }
    }),
    makeTeam({
      id: "team3",
      name: "Gamma",
      score: 80,
      hp: 100,
      discoveredCells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }],
      answerStats: { correct: 4, wrong: 2 }
    })
  ],
  gameOver: null,
  round: {
    phase: ROUND_PHASES.MOVEMENT,
    activeTeamId: "team1",
    currentQuestion: { id: "q1" },
    pendingAnswers: { team1: { answered: false } },
    pendingEvents: { team2: { type: "knowledge" } }
  }
});

test("game over ranks the finisher first, then others by points and explored cells", () => {
  const state = makeState();

  const gameOver = buildGameOver(state, "team1");

  assert.equal(gameOver.stage, "stats");
  assert.deepEqual(
    gameOver.rankings.map((entry) => entry.teamId),
    ["team1", "team3", "team2"]
  );
  assert.equal(gameOver.rankings[1].exploredCount, 4);
  assert.equal(gameOver.rankings[2].exploredCount, 2);
});

test("game over summaries include each team's full map and statistic snapshot", () => {
  const state = makeState();

  const gameOver = buildGameOver(state, "team1");
  const alpha = gameOver.summaries.find((summary) => summary.teamId === "team1");

  assert.deepEqual(alpha.walls, [{ x: 1, y: 0, side: "left" }]);
  assert.deepEqual(alpha.revealedWalls, [{ x: 1, y: 0, side: "left" }]);
  assert.equal(alpha.exploredCount, 3);
  assert.equal(alpha.correctAnswers, 2);
  assert.equal(alpha.wrongAnswers, 1);
  assert.equal(alpha.score, 10);
  assert.equal(alpha.hp, 70);
});

test("player game-over state exposes only that team's full summary", () => {
  const state = makeState();
  const gameOver = buildGameOver(state, "team1");

  const playerGameOver = getPlayerGameOverState(gameOver, "team2");

  assert.equal(playerGameOver.winnerId, "team1");
  assert.equal(playerGameOver.rankings.length, 3);
  assert.equal(playerGameOver.summary.teamId, "team2");
  assert.equal(playerGameOver.summary.teamName, "Beta");
  assert.equal(playerGameOver.summaries, undefined);
});

test("finishing the game clears active round data and host can advance to leaderboard", () => {
  const state = makeState();

  const gameOver = finishGame(state, "team1");

  assert.equal(state.round.phase, ROUND_PHASES.GAME_OVER);
  assert.equal(state.round.activeTeamId, null);
  assert.deepEqual(state.round.pendingAnswers, {});
  assert.deepEqual(state.round.pendingEvents, {});
  assert.equal(gameOver.stage, "stats");
  assert.equal(showGameOverLeaderboard(state).gameOver.stage, "leaderboard");
});
