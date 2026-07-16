import assert from "node:assert/strict";
import test from "node:test";
import { MOVE_SCORE, ROUND_PHASES } from "../shared/constants.js";
import { SUPPORT_ITEM_TYPES } from "../shared/gameContent.js";
import { answerQuestion, chooseMoveQuestion } from "./movementLogic.js";
import { useSupportItem } from "./supportLogic.js";

const questions = [{ id: "q1", text: "Q", choices: ["A", "B"], correctIndex: 0 }];

const item = (type) => ({ type, instanceId: type + ":1", name: type, symbol: "I", color: "#fff" });
const makeTeam = (id, position = { x: 0, y: 0 }) => ({
  id,
  name: id,
  hp: 100,
  score: 30,
  position: { ...position },
  startPoint: { ...position },
  endPoint: { x: 5, y: 5 },
  walls: [],
  discoveredCells: [{ ...position }],
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
    traps: [],
    messages: {}
  }
});

test("double score item doubles the next successful move only", () => {
  const state = makeState();
  state.teams[0].supportItems.push(item(SUPPORT_ITEM_TYPES.DOUBLE_SCORE));

  assert.equal(useSupportItem(state, "team1", { itemInstanceId: SUPPORT_ITEM_TYPES.DOUBLE_SCORE + ":1" }).ok, true);
  chooseMoveQuestion(state, "team1", { direction: "right" }, questions, () => 0);
  const result = answerQuestion(state, "team1", { answerIndex: 0 });

  assert.equal(result.result.scoreDelta, MOVE_SCORE * 2);
  assert.equal(state.teams[0].score, 50);
  assert.equal(state.teams[0].supportItems.length, 0);
  assert.equal(state.teams[0].effects?.doubleScore, false);
});

test("trap subtracts one point unless a shield absorbs it", () => {
  const state = makeState();
  state.teams[0].supportItems.push(item(SUPPORT_ITEM_TYPES.TRAP));
  state.teams[1].supportItems.push(item(SUPPORT_ITEM_TYPES.SHIELD));

  assert.equal(useSupportItem(state, "team1", { itemInstanceId: SUPPORT_ITEM_TYPES.TRAP + ":1", x: 1, y: 0 }).ok, true);
  state.round.turnOrder = ["team2", "team1"];
  state.round.activeTeamId = "team2";
  chooseMoveQuestion(state, "team2", { direction: "right" }, questions, () => 0);
  const result = answerQuestion(state, "team2", { answerIndex: 0 });

  assert.equal(result.result.trap.blockedByShield, true);
  assert.equal(state.teams[1].score, 40);
  assert.equal(state.teams[1].supportItems.length, 0);
  assert.equal(state.round.traps.length, 0);
});

test("freeze item immediately ends the target team's current movement turn", () => {
  const state = makeState();
  state.teams[0].supportItems.push(item(SUPPORT_ITEM_TYPES.FREEZE_OPPONENT));

  const result = useSupportItem(state, "team1", {
    itemInstanceId: SUPPORT_ITEM_TYPES.FREEZE_OPPONENT + ":1",
    targetTeamId: "team2"
  });

  assert.equal(result.ok, true);
  assert.equal(state.round.pendingAnswers.team2.answered, true);
  assert.equal(chooseMoveQuestion(state, "team2", { direction: "right" }, questions, () => 0).ok, false);
});

test("direction hint creates a private notice", () => {
  const state = makeState();
  state.teams[0].supportItems.push(item(SUPPORT_ITEM_TYPES.DIRECTION_HINT));

  assert.equal(useSupportItem(state, "team1", { itemInstanceId: SUPPORT_ITEM_TYPES.DIRECTION_HINT + ":1" }).ok, true);

  assert.equal(state.round.messages.team1.length, 1);
  assert.equal(typeof state.round.messages.team1[0].text, "string");
});

test("meteor shower item starts the shared quiz and is consumed", () => {
  const state = makeState();
  state.teams[0].supportItems.push(item(SUPPORT_ITEM_TYPES.METEOR_SHOWER));

  assert.equal(useSupportItem(state, "team1", { itemInstanceId: SUPPORT_ITEM_TYPES.METEOR_SHOWER + ":1" }).ok, true);
  assert.equal(state.round.phase, ROUND_PHASES.METEOR_SHOWER);
  assert.equal(state.teams[0].supportItems.length, 0);
});
