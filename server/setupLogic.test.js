import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMazeSubmission,
  configureTeamCount,
  getHostSetupPreviewMap,
  getSetupSummary,
  startGame,
  validateMazeSubmission
} from "./setupLogic.js";

const walls = [
  { x: 4, y: 0, side: "left" },
  { x: 2, y: 2, side: "left" },
  { x: 5, y: 3, side: "left" },
  { x: 0, y: 5, side: "top" },
  { x: 1, y: 2, side: "left" },
  { x: 2, y: 0, side: "left" },
  { x: 4, y: 5, side: "top" },
  { x: 5, y: 1, side: "left" },
  { x: 2, y: 4, side: "top" },
  { x: 5, y: 1, side: "top" },
  { x: 2, y: 1, side: "left" },
  { x: 5, y: 5, side: "top" },
  { x: 4, y: 1, side: "left" },
  { x: 1, y: 3, side: "left" },
  { x: 3, y: 0, side: "left" },
  { x: 2, y: 3, side: "left" },
  { x: 4, y: 3, side: "left" },
  { x: 2, y: 5, side: "top" },
  { x: 3, y: 5, side: "top" },
  { x: 1, y: 2, side: "top" }
];

const blockedPathWalls = [
  { x: 1, y: 0, side: "left" },
  { x: 1, y: 1, side: "left" },
  { x: 1, y: 2, side: "left" },
  { x: 1, y: 3, side: "left" },
  { x: 1, y: 4, side: "left" },
  { x: 1, y: 5, side: "left" },
  { x: 4, y: 0, side: "left" },
  { x: 3, y: 0, side: "left" },
  { x: 3, y: 5, side: "left" },
  { x: 2, y: 1, side: "top" },
  { x: 2, y: 2, side: "left" },
  { x: 2, y: 4, side: "top" },
  { x: 3, y: 1, side: "left" },
  { x: 3, y: 3, side: "top" },
  { x: 5, y: 2, side: "top" },
  { x: 5, y: 0, side: "left" },
  { x: 3, y: 2, side: "top" },
  { x: 5, y: 3, side: "top" },
  { x: 3, y: 4, side: "top" },
  { x: 2, y: 2, side: "top" }
];

const makeState = () => ({
  config: { boardSize: 6, teamCount: 3 },
  teams: ["team1", "team2", "team3"].map((id) => ({
    id,
    position: { x: 0, y: 0 },
    startPoint: null,
    endPoint: null,
    walls: [],
    discoveredCells: []
  })),
  setup: { submissions: {}, complete: false, started: false }
});

test("configures any classroom team count before setup starts", () => {
  const state = makeState();

  const result = configureTeamCount(state, { teamCount: 6 });

  assert.equal(result.ok, true);
  assert.equal(state.config.teamCount, 6);
  assert.deepEqual(state.teams.map((team) => team.id), ["team1", "team2", "team3", "team4", "team5", "team6"]);
  assert.deepEqual(state.setup, { submissions: {}, complete: false, started: false });
});

test("starts the game only after every team has submitted a maze", () => {
  const state = makeState();

  assert.match(startGame(state).error, /ch\u01b0a \u0111\u1ee7/i);

  for (const team of state.teams) {
    applyMazeSubmission(state, team.id, {
      walls,
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 5, y: 5 }
    });
  }

  const result = startGame(state);

  assert.equal(result.ok, true);
  assert.equal(state.setup.complete, true);
  assert.equal(state.setup.started, true);
});

test("does not reroll event tiles after the game already started", () => {
  const state = makeState();
  const fixedTiles = [{ type: "duel", x: 2, y: 2 }];

  state.setup.complete = true;
  state.setup.started = true;
  state.round = {
    roundNumber: 1,
    phase: "movement",
    pendingAnswers: {},
    currentQuestion: null,
    eventTiles: fixedTiles,
    pendingEvents: {}
  };
  for (const team of state.teams) {
    team.startPoint = { x: 0, y: 0 };
  }

  const result = startGame(state);

  assert.equal(result.ok, true);
  assert.strictEqual(state.round.eventTiles, fixedTiles);
});

test("validates one complete 6x6 maze setup submission", () => {
  assert.equal(
    validateMazeSubmission({
      boardSize: 6,
      walls,
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 5, y: 5 }
    }).ok,
    true
  );

  assert.match(
    validateMazeSubmission({
      boardSize: 6,
      walls: walls.slice(0, 19),
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 5, y: 5 }
    }).error,
    /20 tường nội bộ/i
  );
});

test("counts opposite sides of the same edge as one wall", () => {
  const result = validateMazeSubmission({
    boardSize: 6,
    walls: [{ x: 3, y: 0, side: "right" }, ...walls],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 5, y: 5 }
  });

  assert.equal(result.ok, true);
  assert.equal(result.maze.walls.length, 20);
});

test("requires exactly 20 interior walls and does not count border walls", () => {
  const result = validateMazeSubmission({
    boardSize: 6,
    walls: [{ x: 0, y: 0, side: "top" }, ...walls.slice(0, 19)],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 5, y: 5 }
  });

  assert.match(result.error, /20 tường nội bộ/i);
});

test("rejects a maze that fully encloses any cell", () => {
  const boxedTopLeft = [
    { x: 1, y: 0, side: "left" },
    { x: 0, y: 1, side: "top" },
    ...walls.slice(0, 18)
  ];

  assert.match(
    validateMazeSubmission({
      boardSize: 6,
      walls: boxedTopLeft,
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 5, y: 5 }
    }).error,
    /bao kín/
  );
});

test("rejects a maze that blocks every path from start to end", () => {
  const result = validateMazeSubmission({
    boardSize: 6,
    walls: blockedPathWalls,
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 5, y: 5 }
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /li\u00ean th\u00f4ng/i);
});

test("rejects a maze that disconnects any board area before start and end matter", () => {
  const result = validateMazeSubmission({
    boardSize: 6,
    walls: blockedPathWalls,
    startPoint: { x: 1, y: 0 },
    endPoint: { x: 5, y: 5 }
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /li\u00ean th\u00f4ng/i);
});

test("assigns a submitted maze to the next team without leaking hidden fields", () => {
  const state = makeState();

  const result = applyMazeSubmission(state, "team1", {
    walls,
    startPoint: { x: 0, y: 1 },
    endPoint: { x: 5, y: 4 }
  });

  assert.equal(result.ok, true);
  assert.equal(result.targetTeamId, "team2");
  assert.deepEqual(state.teams[1].position, { x: 0, y: 1 });
  assert.deepEqual(state.teams[1].endPoint, { x: 5, y: 4 });
  assert.equal(state.setup.submissions.team1.targetTeamId, "team2");

  const summary = getSetupSummary(state, "team2");
  assert.equal(summary.assignedBoardReady, true);
  assert.equal("walls" in summary, false);
  assert.equal("endPoint" in summary, false);
});

test("builds host setup previews keyed by the submitting team", () => {
  const state = makeState();

  applyMazeSubmission(state, "team1", {
    walls,
    startPoint: { x: 0, y: 1 },
    endPoint: { x: 5, y: 4 }
  });

  const previews = getHostSetupPreviewMap(state);

  assert.deepEqual(previews.team1.startPoint, { x: 0, y: 1 });
  assert.deepEqual(previews.team1.endPoint, { x: 5, y: 4 });
  assert.equal(previews.team1.targetTeamId, "team2");
  assert.deepEqual(previews.team1.walls, state.teams[1].walls);
  assert.equal(previews.team2, undefined);
});
