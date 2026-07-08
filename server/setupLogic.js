import { WALL_COUNT, WALL_SIDES, hasEnclosedCell, isMazeConnected, isInteriorWall, uniqueWalls } from "../shared/maze.js";
import { refreshRoundEventTiles } from "./eventLogic.js";

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

const makeTeam = (index) => ({
  id: `team${index + 1}`,
  name: `Đội ${index + 1}`,
  hp: 100,
  score: 0,
  position: { x: 0, y: 0 },
  startPoint: null,
  endPoint: null,
  walls: [],
  discoveredCells: [{ x: 0, y: 0 }],
  supportItems: [],
  effects: {}
});

const makeRound = () => ({
  roundNumber: 1,
  phase: "movement",
  pendingAnswers: {},
  currentQuestion: null,
  eventTiles: [],
  pendingEvents: {},
  auction: { bids: {}, result: null },
  combat: null,
  traps: [],
  messages: {}
});

export const configureTeamCount = (state, payload = {}) => {
  const teamCount = Number(payload.teamCount);

  if (!Number.isInteger(teamCount) || teamCount < 2) {
    return { ok: false, error: "Số đội phải là số nguyên từ 2 trở lên." };
  }

  if (state.setup?.started || Object.keys(state.setup?.submissions || {}).length > 0) {
    return { ok: false, error: "Chỉ được đổi số đội trước khi có đội nộp mê cung." };
  }

  state.config.teamCount = teamCount;
  state.teams = Array.from({ length: teamCount }, (_, index) => makeTeam(index));
  state.setup = { submissions: {}, complete: false, started: false };
  state.round = makeRound();

  return { ok: true };
};

export const startGame = (state) => {
  if (state.setup?.started) return { ok: true };

  if (!state.setup?.complete || !state.teams.every((team) => team.startPoint)) {
    return { ok: false, error: "Chưa đủ mê cung để bắt đầu." };
  }

  state.round = state.round || makeRound();
  state.round.pendingEvents = state.round.pendingEvents || {};
  state.round.eventTiles = state.round.eventTiles || [];
  state.round.auction = state.round.auction || { bids: {}, result: null };
  state.round.traps = state.round.traps || [];
  state.round.messages = state.round.messages || {};
  state.setup.started = true;
  refreshRoundEventTiles(state);
  return { ok: true };
};

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

  if (!isMazeConnected(interiorWalls, boardSize)) {
    return { ok: false, error: "Mê cung phải liên thông, không được chặn tách bất kỳ khu vực nào." };
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

  if (state.setup?.started) {
    return { ok: false, error: "Tr\u00f2 ch\u01a1i \u0111\u00e3 b\u1eaft \u0111\u1ea7u, kh\u00f4ng th\u1ec3 n\u1ed9p l\u1ea1i m\u00ea cung." };
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
    started: Boolean(state.setup?.started),
    submittedTeamIds: Object.keys(submissions),
    mySubmission: Boolean(submissions[teamId]),
    assignedBoardReady: Boolean(team?.startPoint),
    assignedByTeamId: assignedBy?.sourceTeamId || null
  };
};
