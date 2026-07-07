import { WALL_COUNT, WALL_SIDES, hasEnclosedCell, isInteriorWall, uniqueWalls } from "../shared/maze.js";

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
    return { ok: false, error: "Ô xuất phát phải nằm trong bàn chơi." };
  }

  if (!isPoint(endPoint, boardSize)) {
    return { ok: false, error: "Ô đích phải nằm trong bàn chơi." };
  }

  if (samePoint(startPoint, endPoint)) {
    return { ok: false, error: "Ô xuất phát và ô đích phải khác nhau." };
  }

  if (!Array.isArray(walls)) {
    return { ok: false, error: `Mê cung cần đúng ${WALL_COUNT} tường.` };
  }

  for (const wall of walls) {
    if (!isPoint(wall, boardSize) || !SIDES.has(wall.side)) {
      return { ok: false, error: "Mỗi tường phải có x, y và cạnh hợp lệ." };
    }
  }

  const cleanWalls = uniqueWalls(walls, boardSize);
  const interiorWalls = cleanWalls.filter((wall) => isInteriorWall(wall, boardSize));

  if (interiorWalls.length !== WALL_COUNT) {
    return { ok: false, error: `Mê cung cần đúng ${WALL_COUNT} tường nội bộ.` };
  }

  if (hasEnclosedCell(interiorWalls, boardSize)) {
    return { ok: false, error: "Không được bao kín hoàn toàn một ô bằng tường." };
  }

  return {
    ok: true,
    maze: {
      walls: interiorWalls,
      startPoint: cleanPoint(startPoint),
      endPoint: cleanPoint(endPoint)
    }
  };
};

export const applyMazeSubmission = (state, sourceTeamId, payload) => {
  const sourceIndex = state.teams.findIndex((team) => team.id === sourceTeamId);

  if (sourceIndex === -1) {
    return { ok: false, error: "Hãy vào đội trước khi nộp mê cung." };
  }

  if (state.teams.length < 2) {
    return { ok: false, error: "Thiết lập mê cung cần ít nhất 2 đội." };
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

export const getHostSetupPreviewMap = (state) => {
  const previews = {};

  for (const [sourceTeamId, submission] of Object.entries(state.setup?.submissions || {})) {
    const targetTeam = state.teams.find((team) => team.id === submission.targetTeamId);
    if (!targetTeam) continue;

    previews[sourceTeamId] = {
      sourceTeamId,
      targetTeamId: submission.targetTeamId,
      walls: targetTeam.walls,
      startPoint: targetTeam.startPoint,
      endPoint: targetTeam.endPoint,
      position: targetTeam.position
    };
  }

  return previews;
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
