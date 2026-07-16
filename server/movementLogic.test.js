
test("prison event ends the triggering team's turn", () => {
  const state = makeState();
  state.round.eventTiles = [{ type: EVENT_TILE_TYPES.PRISON, x: 1, y: 0 }];

  chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);
  const result = answerQuestion(state, "team1", { answerIndex: 1 });

  assert.equal(result.result.event.endsTurn, true);
  assert.equal(state.round.pendingAnswers.team1.answered, true);
  assert.equal(state.round.activeTeamId, "team2");
});
import assert from "node:assert/strict";
import test from "node:test";
import { MOVE_SCORE, ROUND_PHASES } from "../shared/constants.js";
import { EVENT_TILE_TYPES } from "../shared/gameContent.js";
import {
  answerQuestion,
  chooseMoveQuestion,
  getPlayerRoundState,
  stripQuestionAnswer
} from "./movementLogic.js";

const questions = [
  {
    id: "q1",
    text: "Question 1",
    choices: ["A", "B", "C", "D"],
    correctIndex: 1
  }
];

const makeTeam = (id, position = { x: 0, y: 0 }) => ({
  id,
  name: id,
  hp: 100,
  score: 0,
  position: { ...position },
  startPoint: { ...position },
  endPoint: { x: 5, y: 5 },
  walls: [],
  discoveredCells: [{ ...position }],
  revealedWalls: [],
  supportItems: []
});

const makeState = () => ({
  config: { boardSize: 6, teamCount: 2 },
  teams: [makeTeam("team1"), makeTeam("team2", { x: 0, y: 1 })],
  setup: { submissions: { team1: {}, team2: {} }, complete: true, started: true },
  gameOver: null,
  round: {
    roundNumber: 1,
    phase: ROUND_PHASES.MOVEMENT,
    pendingAnswers: {},
    currentQuestion: null,
    eventTiles: [],
    pendingEvents: {}
  }
});

test("prevents movement before the host starts the game", () => {
  const state = makeState();
  state.setup.started = false;

  assert.match(
    chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0).error,
    /bắt đầu/i
  );
});

test("chooses a movement question without exposing hidden answer or event tiles", () => {
  const state = makeState();
  state.round.eventTiles = [{ type: EVENT_TILE_TYPES.DUEL, x: 1, y: 0 }];
  const result = chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);
  const publicRound = getPlayerRoundState(state.round, "team1");

  assert.equal(result.ok, true);
  assert.equal(state.round.pendingAnswers.team1.direction, "right");
  assert.equal(state.round.pendingAnswers.team1.question.correctIndex, 1);
  assert.equal(stripQuestionAnswer(result.question).correctIndex, undefined);
  assert.equal(publicRound.currentQuestion.correctIndex, undefined);
  assert.equal(publicRound.eventTiles, undefined);
});

test("moves instantly through an already explored square without question or score", () => {
  const state = makeState();
  state.teams[0].discoveredCells.push({ x: 1, y: 0 });

  const result = chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);

  assert.equal(result.ok, true);
  assert.equal(result.instant, true);
  assert.equal(result.result.freeMove, true);
  assert.equal(result.result.usedQuestion, false);
  assert.equal(result.result.scoreDelta, 0);
  assert.equal(state.round.pendingAnswers.team1, undefined);
  assert.deepEqual(state.teams[0].position, { x: 1, y: 0 });
});

test("moving back to a previously visited square after a normal move is instant and question-free", () => {
  const state = makeState();

  chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);
  answerQuestion(state, "team1", { answerIndex: 1 });

  const backtrack = chooseMoveQuestion(state, "team1", { direction: "left" }, questions, () => 0);

  assert.equal(backtrack.ok, true);
  assert.equal(backtrack.instant, true);
  assert.equal(backtrack.result.freeMove, true);
  assert.equal(backtrack.result.usedQuestion, false);
  assert.equal(backtrack.result.scoreDelta, 0);
  assert.equal(state.round.pendingAnswers.team1, undefined);
  assert.deepEqual(state.teams[0].position, { x: 0, y: 0 });
});

test("reveals a wall immediately and keeps the target square hidden", () => {
  const state = makeState();
  state.teams[0].walls = [{ x: 1, y: 0, side: "left" }];

  const result = chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);

  assert.equal(result.ok, true);
  assert.equal(result.instant, true);
  assert.equal(result.result.blocked, true);
  assert.equal(result.result.usedQuestion, false);
  assert.equal(result.result.freeMove, true);
  assert.deepEqual(state.teams[0].position, { x: 0, y: 0 });
  assert.deepEqual(state.teams[0].discoveredCells, [{ x: 0, y: 0 }]);
  assert.deepEqual(state.teams[0].revealedWalls, [{ x: 1, y: 0, side: "left" }]);
  assert.equal(state.round.pendingAnswers.team1.answered, true);
});

test("correct open moves score 10 and keep the turn alive", () => {
  const state = makeState();

  chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);
  const result = answerQuestion(state, "team1", { answerIndex: 1 });

  assert.equal(result.ok, true);
  assert.equal(result.result.success, true);
  assert.equal(result.result.scoreDelta, MOVE_SCORE);
  assert.deepEqual(state.teams[0].position, { x: 1, y: 0 });
  assert.equal(state.teams[0].score, MOVE_SCORE);
  assert.equal(state.round.pendingAnswers.team1, undefined);
  assert.equal(chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0).ok, true);
});

test("reaching a team's end point immediately ends the game and ranks that team first", () => {
  const state = makeState();
  state.teams[0].endPoint = { x: 1, y: 0 };
  state.teams[1].score = 40;
  state.teams[0].score = 10;

  chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);
  const result = answerQuestion(state, "team1", { answerIndex: 1 });

  assert.equal(state.round.phase, ROUND_PHASES.GAME_OVER);
  assert.equal(result.ok, true);
  assert.equal(result.result.success, true);
  assert.equal(state.gameOver?.winnerId, "team1");
  assert.equal(state.gameOver?.rankings?.[0]?.teamId, "team1");
  assert.equal(state.gameOver?.rankings?.[0]?.placement, 1);
  assert.equal(state.gameOver?.rankings?.[1]?.teamId, "team2");
  assert.equal(state.gameOver?.rankings?.[1]?.placement, 2);
  assert.equal(result.result.gameOver?.winnerName, "team1");
  assert.match(
    chooseMoveQuestion(state, "team2", { direction: "right" }, questions, () => 0).error,
    /kết thúc/i
  );
});

test("event tiles trigger after a successful move without changing the base move score", () => {
  const state = makeState();
  state.round.eventTiles = [{ id: "knowledge:1:0", type: EVENT_TILE_TYPES.KNOWLEDGE, x: 1, y: 0 }];

  chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);
  const result = answerQuestion(state, "team1", { answerIndex: 1 });

  assert.equal(result.result.success, true);
  assert.equal(result.result.event.type, EVENT_TILE_TYPES.KNOWLEDGE);
  assert.equal(result.result.scoreDelta, MOVE_SCORE);
  assert.equal(state.teams[0].score, MOVE_SCORE);
  assert.deepEqual(state.round.eventTiles, []);
});

test("wrong answers end only that team's turn", () => {
  const state = makeState();

  chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);
  const result = answerQuestion(state, "team1", { answerIndex: 0 });

  assert.equal(result.result.correct, false);
  assert.equal(result.result.success, false);
  assert.deepEqual(state.teams[0].position, { x: 0, y: 0 });
  assert.equal(state.teams[0].score, 0);
  assert.equal(state.round.pendingAnswers.team1.answered, true);
  assert.equal(state.round.phase, ROUND_PHASES.MOVEMENT);
});

test("hitting an implicit border ends the team's turn", () => {
  const state = makeState();

  const result = chooseMoveQuestion(state, "team1", { direction: "up" }, questions, () => 0);

  assert.equal(result.instant, true);
  assert.equal(result.result.correct, true);
  assert.equal(result.result.blocked, true);
  assert.equal(result.result.blockedReason, "border");
  assert.equal(result.result.success, false);
  assert.deepEqual(state.teams[0].position, { x: 0, y: 0 });
  assert.equal(state.round.pendingAnswers.team1.answered, true);
});

test("hitting a maze wall ends the team's turn", () => {
  const state = makeState();
  state.teams[0].walls = [{ x: 1, y: 0, side: "left" }];

  const result = chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);

  assert.equal(result.instant, true);
  assert.equal(result.result.correct, true);
  assert.equal(result.result.blocked, true);
  assert.equal(result.result.blockedReason, "wall");
  assert.equal(result.result.success, false);
  assert.deepEqual(state.teams[0].position, { x: 0, y: 0 });
  assert.equal(state.round.pendingAnswers.team1.answered, true);
});

test("starts a sealed auction after every two completed movement rounds", () => {
  const state = makeState();
  const eventTiles = [{ type: EVENT_TILE_TYPES.DUEL, x: 3, y: 3 }];
  state.round.eventTiles = eventTiles;

  chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);
  answerQuestion(state, "team1", { answerIndex: 0 });
  assert.equal(state.round.roundNumber, 1);

  chooseMoveQuestion(state, "team2", { direction: "right" }, questions, () => 0);
  const result = answerQuestion(state, "team2", { answerIndex: 0 });

  assert.equal(result.roundComplete, true);
  assert.equal(state.round.roundNumber, 2);
  assert.equal(state.round.phase, ROUND_PHASES.MOVEMENT);

  chooseMoveQuestion(state, "team1", { direction: "down" }, questions, () => 0);
  answerQuestion(state, "team1", { answerIndex: 0 });
  assert.equal(state.round.roundNumber, 2);

  chooseMoveQuestion(state, "team2", { direction: "down" }, questions, () => 0);
  const secondResult = answerQuestion(state, "team2", { answerIndex: 0 });

  assert.equal(secondResult.roundComplete, true);
  assert.equal(state.round.roundNumber, 2);
  assert.equal(state.round.phase, ROUND_PHASES.AUCTION);
  assert.deepEqual(state.round.pendingAnswers, {});
  assert.deepEqual(state.round.eventTiles, eventTiles);
  assert.deepEqual(state.round.auction.bids, {});
});

test("prevents a team from choosing while answering or after its turn ended", () => {
  const state = makeState();

  chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);
  assert.match(
    chooseMoveQuestion(state, "team1", { direction: "down" }, questions, () => 0).error,
    /câu hỏi hiện tại/i
  );

  answerQuestion(state, "team1", { answerIndex: 0 });
  assert.match(
    chooseMoveQuestion(state, "team1", { direction: "down" }, questions, () => 0).error,
    /hoàn thành lượt/i
  );
});

test("only the active team can move and a failed turn advances to the next team", () => {
  const state = makeState();

  assert.match(
    chooseMoveQuestion(state, "team2", { direction: "right" }, questions, () => 0).error,
    /Ch\u01b0a \u0111\u1ebfn l\u01b0\u1ee3t/i
  );

  chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);
  answerQuestion(state, "team1", { answerIndex: 0 });

  assert.equal(state.round.activeTeamId, "team2");
  assert.equal(chooseMoveQuestion(state, "team2", { direction: "right" }, questions, () => 0).ok, true);
});
