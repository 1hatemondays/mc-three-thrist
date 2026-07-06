import { WALL_COUNT, WALL_SIDES, hasEnclosedCell, uniqueWalls } from "../shared/maze.js";

const SIDES = new Set(WALL_SIDES);

const isPoint = (point, boardSize) =>
  point &&
  Number.isInteger(point.x) &&
  Number.isInteger(point.y) &&
  point.x >= 0 &&
  point.y >= 0 &&
  point.x < boardSize &&
  point.y < boardSize;

const samePoint = (a, b) => a.x === b.x && a.y === b.y;

const cleanPoint = ({ x, y }) => ({ x, y });

export const validateMazeSubmission = ({ boardSize, walls, startPoint, endPoint }) => {
  if (!isPoint(startPoint, boardSize)) {
    return { ok: false, error: "Start point must be inside the board." };
  }

  if (!isPoint(endPoint, boardSize)) {
    return { ok: false, error: "End point must be inside the board." };
  }

  if (samePoint(startPoint, endPoint)) {
    return { ok: false, error: "Start and end point must be different." };
  }

  if (!Array.isArray(walls)) {
    return { ok: false, error: `Maze setup requires exactly ${WALL_COUNT} walls.` };
  }

  for (const wall of walls) {
    if (!isPoint(wall, boardSize) || !SIDES.has(wall.side)) {
      return { ok: false, error: "Every wall must have x, y, and a valid side." };
    }
  }

  const cleanWalls = uniqueWalls(walls, boardSize);

  if (cleanWalls.length !== WALL_COUNT) {
    return { ok: false, error: `Maze setup requires exactly ${WALL_COUNT} walls.` };
  }

  if (hasEnclosedCell(cleanWalls, boardSize)) {
    return { ok: false, error: "A cell cannot be fully enclosed by walls." };
  }

  return {
    ok: true,
    maze: {
      walls: cleanWalls,
      startPoint: cleanPoint(startPoint),
      endPoint: cleanPoint(endPoint)
    }
  };
};

export const applyMazeSubmission = (state, sourceTeamId, payload) => {
  const sourceIndex = state.teams.findIndex((team) => team.id === sourceTeamId);

  if (sourceIndex === -1) {
    return { ok: false, error: "Join a team before submitting a maze." };
  }

  if (state.teams.length < 2) {
    return { ok: false, error: "Maze setup needs at least 2 teams." };
  }

  const validated = validateMazeSubmission({
    boardSize: state.config.boardSize,
    ...payload
  });

  if (!validated.ok) return validated;

  const targetTeam = state.teams[(sourceIndex + 1) % state.teams.length];
  targetTeam.walls = validated.maze.walls;
  targetTeam.startPoint = validated.maze.startPoint;
  targetTeam.endPoint = validated.maze.endPoint;
  targetTeam.position = validated.maze.startPoint;
  targetTeam.discoveredCells = [validated.maze.startPoint];

  state.setup.submissions[sourceTeamId] = {
    sourceTeamId,
    targetTeamId: targetTeam.id
  };
  state.setup.complete = Object.keys(state.setup.submissions).length === state.teams.length;

  return { ok: true, targetTeamId: targetTeam.id };
};

export const getSetupSummary = (state, teamId) => {
  const submissions = state.setup?.submissions || {};
  const assignedBy = Object.values(submissions).find((item) => item.targetTeamId === teamId);
  const team = state.teams.find((item) => item.id === teamId);

  return {
    complete: Boolean(state.setup?.complete),
    submittedTeamIds: Object.keys(submissions),
    mySubmission: Boolean(submissions[teamId]),
    assignedBoardReady: Boolean(team?.startPoint),
    assignedByTeamId: assignedBy?.sourceTeamId || null
  };
};