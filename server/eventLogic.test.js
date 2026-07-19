
test("global hazard events respect shields, points, health and blessing overflow", () => {
  const monster = makeState();
  monster.teams[0].supportItems.push({ type: SUPPORT_ITEM_TYPES.SHIELD, instanceId: "shield:1" });
  monster.teams[1].score = 10;

  applyEventTileEffect(monster, "team1", { type: EVENT_TILE_TYPES.MONSTER_ATTACK, x: 1, y: 0 });

  assert.equal(monster.teams[0].supportItems.length, 0);
  assert.equal(monster.teams[0].hp, 100);
  assert.equal(monster.teams[1].score, 0);
  assert.equal(monster.teams[1].hp, 100);
  assert.equal(monster.teams[2].hp, 90);

  const meteor = makeState();
  meteor.teams[0].supportItems.push({ type: SUPPORT_ITEM_TYPES.SHIELD, instanceId: "shield:2" });
  applyEventTileEffect(meteor, "team1", { type: EVENT_TILE_TYPES.METEOR_STRIKE, x: 1, y: 0 });
  assert.equal(meteor.teams[0].hp, 100);
  assert.equal(meteor.teams[1].hp, 90);
  assert.equal(meteor.teams[2].hp, 90);

  applyEventTileEffect(meteor, "team1", { type: EVENT_TILE_TYPES.BLESSING, x: 2, y: 0 });
  assert.equal(meteor.teams[0].hp, 110);
  assert.equal(meteor.teams[1].hp, 100);
});

test("prison marks the triggering event as turn-ending", () => {
  const state = makeState();
  const event = applyEventTileEffect(state, "team1", { type: EVENT_TILE_TYPES.PRISON, x: 1, y: 0 });
  assert.equal(event.endsTurn, true);
});

test("bomb passes on a correct answer and explodes on wrong answer or timeout", () => {
  const state = makeState();
  applyEventTileEffect(state, "team1", { type: EVENT_TILE_TYPES.BOMB, x: 1, y: 0 }, () => 0);

  const firstDeadline = state.round.bomb.deadline;
  assert.equal(state.round.phase, "bomb");
  assert.equal(getBombState(state, "team1", firstDeadline - 1).question.correctIndex, undefined);

  const passed = resolveBombAnswer(state, "team1", { answerIndex: 1 }, () => 0, firstDeadline - 1);
  assert.equal(passed.nextTeamId, "team2");
  assert.equal(state.round.bomb.holderTeamId, "team2");

  const secondDeadline = state.round.bomb.deadline;
  const exploded = resolveBombAnswer(state, "team2", { answerIndex: 0 }, () => 0, secondDeadline - 1);
  assert.equal(exploded.exploded, true);
  assert.equal(state.teams[1].hp, 70);
  assert.equal(state.round.phase, "movement");

  const timeoutState = makeState();
  applyEventTileEffect(timeoutState, "team1", { type: EVENT_TILE_TYPES.BOMB, x: 1, y: 0 }, () => 0);
  assert.equal(resolveBombTimeout(timeoutState, timeoutState.round.bomb.deadline).hpLoss, 30);
  assert.equal(timeoutState.teams[0].hp, 70);
});
import assert from "node:assert/strict";
import test from "node:test";
import { EVENT_TILE_TYPES, SUPPORT_ITEM_TYPES } from "../shared/gameContent.js";
import {
  applyEventTileEffect,
  getBombState,
  resolveBombAnswer,
  resolveBombTimeout,
  createEventTiles,
  resolvePendingEvent
} from "./eventLogic.js";

const sequenceRandom = (values) => {
  let index = 0;
  return () => values[index++ % values.length];
};

const makeTeam = (id, position) => ({
  id,
  name: id,
  hp: 100,
  score: 0,
  position: { ...position },
  startPoint: { ...position },
  endPoint: { x: 5, y: 5 },
  walls: [],
  discoveredCells: [{ ...position }],
  supportItems: [],
  effects: {}
});

const makeState = () => ({
  config: { boardSize: 6, teamCount: 3 },
  teams: [makeTeam("team1", { x: 0, y: 0 }), makeTeam("team2", { x: 2, y: 0 }), makeTeam("team3", { x: 4, y: 0 })],
  round: {
    roundNumber: 1,
    phase: "movement",
    pendingAnswers: {},
    currentQuestion: null,
    eventTiles: [],
    turnOrder: ["team1", "team2", "team3"],
    pendingEvents: {}
  }
});

test("creates one random visible tile for each event type without duplicates", () => {
  const tiles = createEventTiles(6, sequenceRandom([0, 0.1, 0.2, 0.3, 0.4]), [{ x: 0, y: 0 }]);
  const keys = new Set(tiles.map((tile) => tile.x + ":" + tile.y));

  assert.equal(tiles.length, Object.keys(EVENT_TILE_TYPES).length);
  assert.equal(keys.size, tiles.length);
  assert.equal(tiles.some((tile) => tile.x === 0 && tile.y === 0), false);
});

test("mystery box grants one free support item", () => {
  const state = makeState();
  const result = applyEventTileEffect(
    state,
    "team1",
    { type: EVENT_TILE_TYPES.MYSTERY_BOX, x: 1, y: 0 },
    sequenceRandom([0])
  );

  assert.equal(result.type, EVENT_TILE_TYPES.MYSTERY_BOX);
  assert.equal(state.teams[0].supportItems.length, 1);
  assert.equal(state.teams[0].supportItems[0].type, SUPPORT_ITEM_TYPES.DIRECTION_HINT);
});

test("triggering an event consumes that event tile", () => {
  const state = makeState();
  state.round.eventTiles = [{ id: "knowledge:1:0", type: EVENT_TILE_TYPES.KNOWLEDGE, x: 1, y: 0 }];

  const result = applyEventTileEffect(state, "team1", state.round.eventTiles[0]);

  assert.equal(result.type, EVENT_TILE_TYPES.KNOWLEDGE);
  assert.deepEqual(state.round.eventTiles, []);
});

test("teleport event moves the team to a random cell and discovers it", () => {
  const state = makeState();
  const result = applyEventTileEffect(
    state,
    "team1",
    { type: EVENT_TILE_TYPES.TELEPORT, x: 1, y: 0 },
    sequenceRandom([0.99])
  );

  assert.equal(result.type, EVENT_TILE_TYPES.TELEPORT);
  assert.deepEqual(state.teams[0].position, { x: 5, y: 5 });
  assert.deepEqual(state.teams[0].discoveredCells.at(-1), { x: 5, y: 5 });
});


test("teleporting onto the end point finishes the game", () => {
  const state = makeState();

  const result = applyEventTileEffect(
    state,
    "team1",
    { type: EVENT_TILE_TYPES.TELEPORT, x: 1, y: 0 },
    sequenceRandom([0.99])
  );

  assert.equal(result.gameOver.winnerId, "team1");
  assert.equal(state.round.phase, "gameOver");
});
test("position swap event waits for the team to choose or skip", () => {
  const state = makeState();
  const eventResult = applyEventTileEffect(state, "team1", { type: EVENT_TILE_TYPES.POSITION_SWAP, x: 1, y: 0 });

  assert.equal(eventResult.type, EVENT_TILE_TYPES.POSITION_SWAP);
  assert.equal(state.round.pendingEvents.team1.type, EVENT_TILE_TYPES.POSITION_SWAP);

  const result = resolvePendingEvent(state, "team1", { action: "swap", targetTeamId: "team2" });

  assert.equal(result.ok, true);
  assert.deepEqual(state.teams[0].position, { x: 2, y: 0 });
  assert.deepEqual(state.teams[1].position, { x: 0, y: 0 });
  assert.equal(state.round.pendingEvents.team1, undefined);
});

test("knowledge event does not change the base move score", () => {
  const state = makeState();
  state.teams[0].score = 10;

  const result = applyEventTileEffect(state, "team1", { type: EVENT_TILE_TYPES.KNOWLEDGE, x: 1, y: 0 });

  assert.equal(result.scoreDelta, undefined);
  assert.equal(state.teams[0].score, 10);
});

test("knowledge and bomb questions update answer statistics", () => {
  const knowledge = makeState();
  applyEventTileEffect(knowledge, "team1", { type: EVENT_TILE_TYPES.KNOWLEDGE, x: 1, y: 0 });
  resolvePendingEvent(knowledge, "team1", { answerIndex: knowledge.round.pendingEvents.team1.question.correctIndex });
  assert.deepEqual(knowledge.teams[0].answerStats, { correct: 1, wrong: 0 });

  const bomb = makeState();
  applyEventTileEffect(bomb, "team1", { type: EVENT_TILE_TYPES.BOMB, x: 1, y: 0 }, () => 0);
  resolveBombAnswer(bomb, "team1", { answerIndex: 0 }, () => 0, bomb.round.bomb.deadline - 1);
  assert.deepEqual(bomb.teams[0].answerStats, { correct: 0, wrong: 1 });
});
