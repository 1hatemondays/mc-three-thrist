import { WALL_COUNT, WALL_SIDES, hasEnclosedCell, isMazeConnected, isInteriorWall, uniqueWalls } from "../shared/maze.js";
import { refreshRoundEventTiles } from "./eventLogic.js";
import { setActiveTurn } from "./roundFlow.js";

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
  revealedWalls: [],
  supportItems: [],
  effects: {},
  answerStats: { correct: 0, wrong: 0 }
});

const cloneMaze = (maze) => ({
  walls: maze.walls.map((wall) => ({ ...wall })),
  startPoint: cleanPoint(maze.startPoint),
  endPoint: cleanPoint(maze.endPoint)
});

const assignMazeToTeam = (team, maze) => {
  team.walls = maze.walls.map((wall) => ({ ...wall }));
  team.startPoint = cleanPoint(maze.startPoint);
  team.endPoint = cleanPoint(maze.endPoint);
  team.position = cleanPoint(maze.startPoint);
  team.discoveredCells = [cleanPoint(maze.startPoint)];
  team.revealedWalls = [];
  team.answerStats = { correct: 0, wrong: 0 };
};

const shuffle = (items, random = Math.random) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export const finalizeMazeAssignments = (state, random = Math.random) => {
  const submissions = state.setup?.submissions || {};
  if (state.teams.length < 2 || Object.keys(submissions).length !== state.teams.length) {
    return { ok: false, error: "Chưa đủ mê cung để chia ngẫu nhiên." };
  }

  const orderedSourceIds = shuffle(state.teams.map((team) => team.id), random);

  orderedSourceIds.forEach((sourceTeamId, index) => {
    const targetTeamId = orderedSourceIds[(index + 1) % orderedSourceIds.length];
    const submission = submissions[sourceTeamId];
    const targetTeam = state.teams.find((team) => team.id === targetTeamId);
    if (!submission || !targetTeam) return;

    assignMazeToTeam(targetTeam, submission.maze);
    submission.targetTeamId = targetTeamId;
  });

  return { ok: true };
};

const makeRound = (turnOrder = []) => ({
  roundNumber: 1,
  phase: "movement",
  turnOrder: [...turnOrder],
  activeTeamId: null,
  pendingAnswers: {},
  currentQuestion: null,
  eventTiles: [],
  pendingEvents: {},
  questionControl: null,
  turnEnergy: null,
  auction: { bids: {}, result: null },
  combat: null,
  meteorShower: null,
  bomb: null,
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
  state.gameOver = null;
  state.round = makeRound(state.teams.map((team) => team.id));

  return { ok: true };
};

export const startGame = (state) => {
  if (state.setup?.started) return { ok: true };

  if (!state.setup?.complete || !state.teams.every((team) => team.startPoint)) {
    return { ok: false, error: "Chưa đủ mê cung để bắt đầu." };
  }

  const teamIds = state.teams.map((team) => team.id);
  state.round = state.round || makeRound(teamIds);
  const savedOrder = state.round.turnOrder || [];
  state.round.turnOrder =
    savedOrder.length === teamIds.length &&
    savedOrder.every((teamId) => teamIds.includes(teamId))
      ? savedOrder
      : teamIds;
  setActiveTurn(state, state.round.turnOrder[0] || null);
  state.round.pendingEvents = state.round.pendingEvents || {};
  state.round.eventTiles = state.round.eventTiles || [];
  state.round.auction = state.round.auction || { bids: {}, result: null };
  state.round.meteorShower = state.round.meteorShower || null;
  state.round.bomb = state.round.bomb || null;
  state.round.traps = state.round.traps || [];
  state.round.messages = state.round.messages || {};
  state.gameOver = null;
  state.setup.started = true;
  refreshRoundEventTiles(state);
  return { ok: true };
};

export const setTurnOrder = (state, payload = {}) => {
  if (state.setup?.started) {
    return { ok: false, error: "Ch\u1ec9 \u0111\u01b0\u1ee3c \u0111\u1ed5i th\u1ee9 t\u1ef1 tr\u01b0\u1edbc khi tr\u00f2 ch\u01a1i b\u1eaft \u0111\u1ea7u." };
  }

  const teamIds = payload.teamIds;
  const knownIds = state.teams.map((team) => team.id);
  if (
    !Array.isArray(teamIds) ||
    teamIds.length !== knownIds.length ||
    new Set(teamIds).size !== knownIds.length ||
    !teamIds.every((teamId) => knownIds.includes(teamId))
  ) {
    return { ok: false, error: "Th\u1ee9 t\u1ef1 ch\u01a1i kh\u00f4ng h\u1ee3p l\u1ec7." };
  }

  state.round = state.round || makeRound();
  state.round.turnOrder = [...teamIds];
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

  if (state.setup?.submissions?.[sourceTeamId]) {
    return { ok: false, error: "Đội đã nộp mê cung rồi." };
  }

  const validated = validateMazeSubmission({
    boardSize: state.config.boardSize,
    ...payload
  });

  if (!validated.ok) return validated;

  state.setup.submissions[sourceTeamId] = {
    sourceTeamId,
    maze: cloneMaze(validated.maze)
  };
  state.setup.complete = Object.keys(state.setup.submissions).length === state.teams.length;
  if (state.setup.complete) {
    finalizeMazeAssignments(state);
  }

  return { ok: true };
};

export const getHostSetupPreviewMap = (state) => {
  const previews = {};

  for (const [sourceTeamId, submission] of Object.entries(state.setup?.submissions || {})) {
    if (!submission.maze) continue;

    previews[sourceTeamId] = {
      sourceTeamId,
      walls: submission.maze.walls,
      startPoint: submission.maze.startPoint,
      endPoint: submission.maze.endPoint,
      position: submission.maze.startPoint
    };
  }

  return previews;
};

export const getSetupSummary = (state, teamId) => {
  const submissions = state.setup?.submissions || {};
  const team = state.teams.find((item) => item.id === teamId);

  return {
    complete: Boolean(state.setup?.complete),
    started: Boolean(state.setup?.started),
    submittedTeamIds: Object.keys(submissions),
    mySubmission: Boolean(submissions[teamId]),
    assignedBoardReady: Boolean(team?.startPoint)
  };
};
