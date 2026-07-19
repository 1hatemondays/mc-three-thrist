import assert from "node:assert/strict";
import test from "node:test";
import { MOVE_SCORE, ROUND_PHASES } from "../shared/constants.js";
import { EVENT_TILE_TYPES } from "../shared/gameContent.js";
import { applyEventTileEffect, getPlayerPendingEvent, resolvePendingEvent } from "./eventLogic.js";
import { hardQuestionBank } from "./questionBank.js";

const makeState = () => ({
  config: { boardSize: 6, teamCount: 2 },
  teams: [
    { id: "team1", name: "team1", hp: 100, score: 10, position: { x: 1, y: 0 }, endPoint: { x: 5, y: 5 }, discoveredCells: [], supportItems: [] },
    { id: "team2", name: "team2", hp: 100, score: 0, position: { x: 0, y: 0 }, endPoint: { x: 5, y: 5 }, discoveredCells: [], supportItems: [] }
  ],
  round: { roundNumber: 2, phase: ROUND_PHASES.MOVEMENT, pendingEvents: {}, messages: {} }
});

test("knowledge event asks a hard question and doubles the move reward on correct answer", () => {
  const state = makeState();
  const event = applyEventTileEffect(state, "team1", { type: EVENT_TILE_TYPES.KNOWLEDGE, x: 1, y: 0 }, () => 0);

  assert.equal(event.type, EVENT_TILE_TYPES.KNOWLEDGE);
  const pending = getPlayerPendingEvent(state.round, "team1");
  assert.equal(pending.question.correctIndex, undefined);

  const result = resolvePendingEvent(state, "team1", { answerIndex: hardQuestionBank[0].correctIndex });

  assert.equal(result.ok, true);
  assert.equal(result.result.correct, true);
  assert.equal(result.result.scoreDelta, MOVE_SCORE);
  assert.equal(state.teams[0].score, 20);
  assert.equal(state.round.pendingEvents.team1, undefined);
});
