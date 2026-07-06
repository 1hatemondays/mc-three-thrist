import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMazeSubmission,
  getSetupSummary,
  validateMazeSubmission
} from "./setupLogic.js";

const walls = [
  ...Array.from({ length: 6 }, (_, x) => ({ x, y: 1, side: "top" })),
  ...Array.from({ length: 6 }, (_, x) => ({ x, y: 3, side: "top" })),
  ...Array.from({ length: 6 }, (_, x) => ({ x, y: 5, side: "top" })),
  { x: 2, y: 1, side: "left" },
  { x: 4, y: 3, side: "left" }
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
  setup: { submissions: {}, complete: false }
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
    /20 walls/
  );
});

test("counts opposite sides of the same edge as one wall", () => {
  const result = validateMazeSubmission({
    boardSize: 6,
    walls: [{ x: 0, y: 0, side: "bottom" }, ...walls],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 5, y: 5 }
  });

  assert.equal(result.ok, true);
  assert.equal(result.maze.walls.length, 20);
});

test("rejects a maze that fully encloses any cell", () => {
  const boxedTopLeft = [
    ...walls.slice(0, 19),
    { x: 1, y: 0, side: "left" }
  ];

  assert.match(
    validateMazeSubmission({
      boardSize: 6,
      walls: boxedTopLeft,
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 5, y: 5 }
    }).error,
    /fully enclosed/
  );
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