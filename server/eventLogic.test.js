import assert from "node:assert/strict";
import test from "node:test";
import { EVENT_TILE_TYPES, SUPPORT_ITEM_TYPES } from "../shared/gameContent.js";
import {
  applyEventTileEffect,
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
  supportItems: []
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
