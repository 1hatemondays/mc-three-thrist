import assert from "node:assert/strict";
import test from "node:test";
import { MOVE_SCORE, ROUND_PHASES } from "../shared/constants.js";
import { SUPPORT_ITEM_TYPES } from "../shared/gameContent.js";
import { answerQuestion, chooseMoveQuestion, openQuestionForAnswer } from "./movementLogic.js";
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
    activeTeamId: "team1",
    turnEnergy: { teamId: "team1", remaining: 3, max: 3 },
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
  openQuestionForAnswer(state, "team1");
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
  state.round.turnEnergy = { teamId: "team2", remaining: 3, max: 3 };
  chooseMoveQuestion(state, "team2", { direction: "right" }, questions, () => 0);
  openQuestionForAnswer(state, "team2");
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

test("direction hint prioritizes an open route to an unexplored cell", () => {
  const state = makeState();
  const team = state.teams[0];
  team.position = { x: 1, y: 1 };
  team.discoveredCells = [{ x: 1, y: 1 }, { x: 1, y: 0 }];
  team.walls = [
    { x: 1, y: 1, side: "left" },
    { x: 1, y: 1, side: "right" }
  ];
  team.supportItems.push(item(SUPPORT_ITEM_TYPES.DIRECTION_HINT));

  const result = useSupportItem(
    state,
    "team1",
    { itemInstanceId: SUPPORT_ITEM_TYPES.DIRECTION_HINT + ":1" },
    () => 0
  );

  assert.equal(result.ok, true);
  assert.equal(result.result.hint.direction, "down");
  assert.equal(result.result.hint.blocked, false);
  assert.equal(result.result.hint.unexplored, true);
  assert.deepEqual(result.result.hint.target, { x: 1, y: 2 });
});

test("direction hint randomizes between equally useful open routes", () => {
  const state = makeState();
  const team = state.teams[0];
  team.position = { x: 1, y: 1 };
  team.discoveredCells = [{ x: 1, y: 1 }];
  team.supportItems.push(item(SUPPORT_ITEM_TYPES.DIRECTION_HINT));

  const result = useSupportItem(
    state,
    "team1",
    { itemInstanceId: SUPPORT_ITEM_TYPES.DIRECTION_HINT + ":1" },
    () => 0.99
  );

  assert.equal(result.ok, true);
  assert.equal(result.result.hint.direction, "left");
  assert.equal(result.result.hint.unexplored, true);
});

test("using an active item does not spend turn energy", () => {
  const state = makeState();
  state.teams[0].supportItems.push(
    item(SUPPORT_ITEM_TYPES.DIRECTION_HINT),
    { ...item(SUPPORT_ITEM_TYPES.TRAP), instanceId: SUPPORT_ITEM_TYPES.TRAP + ":2" }
  );

  const used = useSupportItem(state, "team1", { itemInstanceId: SUPPORT_ITEM_TYPES.DIRECTION_HINT + ":1" });

  assert.equal(used.ok, true);
  assert.equal(state.round.turnEnergy.remaining, 3);

  state.round.turnEnergy.remaining = 0;
  const trap = useSupportItem(state, "team1", {
    itemInstanceId: SUPPORT_ITEM_TYPES.TRAP + ":2",
    x: 1,
    y: 0
  });

  assert.equal(trap.ok, true);
  assert.equal(state.round.turnEnergy.remaining, 0);
  assert.deepEqual(state.round.traps, [{ x: 1, y: 0, ownerTeamId: "team1" }]);
});
