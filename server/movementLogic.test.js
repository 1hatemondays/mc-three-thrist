import assert from "node:assert/strict";
import test from "node:test";
import { MOVE_SCORE, ROUND_PHASES } from "../shared/constants.js";
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
  supportItems: []
});

const makeState = () => ({
  config: { boardSize: 6, teamCount: 2 },
  teams: [makeTeam("team1"), makeTeam("team2", { x: 0, y: 1 })],
  setup: { submissions: { team1: {}, team2: {} }, complete: true, started: true },
  round: {
    roundNumber: 1,
    phase: ROUND_PHASES.MOVEMENT,
    pendingAnswers: {},
    currentQuestion: null
  }
});

test("prevents movement before the host starts the game", () => {
  const state = makeState();
  state.setup.started = false;

  assert.match(
    chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0).error,
    /b\u1eaft \u0111\u1ea7u/i
  );
});

test("chooses a movement question without exposing the correct answer publicly", () => {
  const state = makeState();
  const result = chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);

  assert.equal(result.ok, true);
  assert.equal(state.round.pendingAnswers.team1.direction, "right");
  assert.equal(state.round.pendingAnswers.team1.question.correctIndex, 1);
  assert.equal(stripQuestionAnswer(result.question).correctIndex, undefined);
  assert.equal(getPlayerRoundState(state.round, "team1").currentQuestion.correctIndex, undefined);
});

test("moves and scores only when the answer is correct and the path is open", () => {
  const state = makeState();

  chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);
  const result = answerQuestion(state, "team1", { answerIndex: 1 });

  assert.equal(result.ok, true);
  assert.equal(result.result.success, true);
  assert.deepEqual(state.teams[0].position, { x: 1, y: 0 });
  assert.equal(state.teams[0].score, MOVE_SCORE);
  assert.deepEqual(state.teams[0].discoveredCells.at(-1), { x: 1, y: 0 });
});

test("does not move when the answer is wrong", () => {
  const state = makeState();

  chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);
  const result = answerQuestion(state, "team1", { answerIndex: 0 });

  assert.equal(result.result.correct, false);
  assert.equal(result.result.success, false);
  assert.deepEqual(state.teams[0].position, { x: 0, y: 0 });
  assert.equal(state.teams[0].score, 0);
});

test("blocks movement through implicit outer borders", () => {
  const state = makeState();

  chooseMoveQuestion(state, "team1", { direction: "up" }, questions, () => 0);
  const result = answerQuestion(state, "team1", { answerIndex: 1 });

  assert.equal(result.result.correct, true);
  assert.equal(result.result.blocked, true);
  assert.equal(result.result.blockedReason, "border");
  assert.equal(result.result.success, false);
  assert.deepEqual(state.teams[0].position, { x: 0, y: 0 });
});

test("blocks movement through maze walls even when the answer is correct", () => {
  const state = makeState();
  state.teams[0].walls = [{ x: 1, y: 0, side: "left" }];

  chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);
  const result = answerQuestion(state, "team1", { answerIndex: 1 });

  assert.equal(result.result.correct, true);
  assert.equal(result.result.blocked, true);
  assert.equal(result.result.blockedReason, "wall");
  assert.equal(result.result.success, false);
  assert.deepEqual(state.teams[0].position, { x: 0, y: 0 });
});

test("moves to auction phase after every team finishes the movement round", () => {
  const state = makeState();

  chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);
  answerQuestion(state, "team1", { answerIndex: 1 });
  assert.equal(state.round.phase, ROUND_PHASES.MOVEMENT);

  chooseMoveQuestion(state, "team2", { direction: "right" }, questions, () => 0);
  const result = answerQuestion(state, "team2", { answerIndex: 1 });

  assert.equal(result.roundComplete, true);
  assert.equal(state.round.phase, ROUND_PHASES.AUCTION);
});

test("prevents a team from choosing twice in the same round", () => {
  const state = makeState();

  chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);
  assert.match(
    chooseMoveQuestion(state, "team1", { direction: "down" }, questions, () => 0).error,
    /câu hỏi hiện tại/i
  );

  answerQuestion(state, "team1", { answerIndex: 1 });
  assert.match(
    chooseMoveQuestion(state, "team1", { direction: "down" }, questions, () => 0).error,
    /đã hoàn thành lượt hiện tại/i
  );
});
