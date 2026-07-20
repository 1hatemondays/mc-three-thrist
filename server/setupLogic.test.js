import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMazeSubmission,
  getHostSetupPreviewMap,
  getSetupSummary,
  retractMazeSubmission,
  startGame,
  setTurnOrder,
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

test("does not mark setup complete until every joined team submits", () => {
  const state = {
    config: { boardSize: 6, teamCount: 4 },
    teams: ["team1", "team2", "team3", "team4"].map((id) => ({
      id,
      position: { x: 0, y: 0 },
      startPoint: null,
      endPoint: null,
      walls: [],
      discoveredCells: []
    })),
    setup: { submissions: {}, complete: false, started: false }
  };

  applyMazeSubmission(state, "team1", {
    walls,
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 5, y: 5 }
  });
  applyMazeSubmission(state, "team2", {
    walls,
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 5, y: 5 }
  });

  assert.equal(state.setup.complete, false);
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

test("randomly assigns completed maze submissions without self assignment or player leaks", () => {
  const state = makeState();

  const result = applyMazeSubmission(state, "team1", {
    walls,
    startPoint: { x: 0, y: 1 },
    endPoint: { x: 5, y: 4 }
  });
  applyMazeSubmission(state, "team2", {
    walls,
    startPoint: { x: 1, y: 1 },
    endPoint: { x: 4, y: 4 }
  });
  applyMazeSubmission(state, "team3", {
    walls,
    startPoint: { x: 2, y: 1 },
    endPoint: { x: 3, y: 4 }
  });

  assert.equal(result.ok, true);
  assert.equal("targetTeamId" in result, false);
  assert.equal(state.setup.complete, true);

  const assignedTargets = Object.values(state.setup.submissions).map((submission) => submission.targetTeamId);
  assert.deepEqual(new Set(assignedTargets), new Set(["team1", "team2", "team3"]));
  for (const submission of Object.values(state.setup.submissions)) {
    assert.notEqual(submission.sourceTeamId, submission.targetTeamId);
  }

  const summary = getSetupSummary(state, "team2");
  assert.equal(summary.assignedBoardReady, true);
  assert.equal("assignedByTeamId" in summary, false);
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
  assert.equal("targetTeamId" in previews.team1, false);
  assert.deepEqual(previews.team1.walls, walls);
  assert.equal(state.teams[1].startPoint, null);
  assert.equal(previews.team2, undefined);

});

test("lets a submitted team unready before the game starts and clears pending assignments", () => {
  const state = makeState();

  for (const team of state.teams) {
    applyMazeSubmission(state, team.id, {
      walls,
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 5, y: 5 }
    });
  }

  assert.equal(state.setup.complete, true);
  assert.equal(getSetupSummary(state, "team1").mySubmission, true);
  assert.equal(state.teams.every((team) => team.startPoint), true);

  const result = retractMazeSubmission(state, "team1");

  assert.equal(result.ok, true);
  assert.equal(state.setup.complete, false);
  assert.equal(getSetupSummary(state, "team1").mySubmission, false);
  assert.equal(state.setup.submissions.team1, undefined);
  assert.equal(state.teams.every((team) => team.startPoint === null), true);
  assert.equal(Object.values(state.setup.submissions).some((submission) => "targetTeamId" in submission), false);
});

test("host can set the turn order before the game starts", () => {
  const state = makeState();
  const teamIds = ["team3", "team1", "team2"];

  assert.equal(setTurnOrder(state, { teamIds }).ok, true);
  assert.deepEqual(state.round.turnOrder, teamIds);
  assert.equal(state.round.activeTeamId, null);

  state.setup.complete = true;
  state.teams.forEach((team) => {
    team.startPoint = { x: 0, y: 0 };
  });
  assert.equal(startGame(state).ok, true);
  assert.equal(state.round.activeTeamId, "team3");
  assert.equal(setTurnOrder(state, { teamIds: [...teamIds].reverse() }).ok, false);
  assert.deepEqual(state.round.turnOrder, teamIds);
});
