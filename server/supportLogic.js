import { DIRECTIONS, ROUND_PHASES } from "../shared/constants.js";
import { SUPPORT_ITEM_TYPES, getSupportItemMeta } from "../shared/gameContent.js";
import { hasWall } from "../shared/maze.js";
import { addRoundMessage, ensureRoundCollections, maybeFinishMovementRound } from "./roundFlow.js";

const directionRules = [
  { direction: DIRECTIONS.UP, label: "trên", dx: 0, dy: -1, side: "top" },
  { direction: DIRECTIONS.RIGHT, label: "phải", dx: 1, dy: 0, side: "right" },
  { direction: DIRECTIONS.DOWN, label: "dưới", dx: 0, dy: 1, side: "bottom" },
  { direction: DIRECTIONS.LEFT, label: "trái", dx: -1, dy: 0, side: "left" }
];

const findTeam = (state, teamId) => state.teams.find((team) => team.id === teamId);
const pointInside = (point, boardSize) =>
  Number.isInteger(point?.x) && Number.isInteger(point?.y) && point.x >= 0 && point.y >= 0 && point.x < boardSize && point.y < boardSize;

export const makeSupportItem = (type, suffix = Date.now()) => {
  const meta = getSupportItemMeta(type);
  if (!meta) return null;
  return {
    type: meta.type,
    name: meta.name,
    symbol: meta.symbol,
    color: meta.color,
    lucideIcon: meta.lucideIcon,
    description: meta.description,
    instanceId: meta.type + ":" + suffix
  };
};

export const grantSupportItem = (team, type) => {
  const item = makeSupportItem(type, team.supportItems.length + ":" + Date.now());
  if (item) team.supportItems.push(item);
  return item;
};

const takeItem = (team, itemInstanceId) => {
  const index = team.supportItems.findIndex((item) => item.instanceId === itemInstanceId || item.type === itemInstanceId);
  if (index === -1) return null;
  return team.supportItems.splice(index, 1)[0];
};

export const consumeShield = (team) => {
  const index = team.supportItems.findIndex((item) => item.type === SUPPORT_ITEM_TYPES.SHIELD);
  if (index === -1) return null;
  return team.supportItems.splice(index, 1)[0];
};

const edgeHint = (team, boardSize) => {
  const rule = directionRules[0];
  const target = { x: team.position.x + rule.dx, y: team.position.y + rule.dy };
  const blocked = !pointInside(target, boardSize) || hasWall(team.walls || [], boardSize, team.position.x, team.position.y, rule.side);
  return {
    direction: rule.direction,
    blocked,
    text: "Cạnh " + rule.label + (blocked ? " có tường hoặc biên." : " không có tường.")
  };
};

const starMessage = (team) => {
  const distance = Math.abs((team.endPoint?.x ?? team.position.x) - team.position.x) + Math.abs((team.endPoint?.y ?? team.position.y) - team.position.y);
  if (distance <= 3) return "Sao dẫn đường: đội đang gần đích.";
  if (distance <= 6) return "Sao dẫn đường: đội đang ở khoảng giữa.";
  return "Sao dẫn đường: đội còn xa đích.";
};

export const useSupportItem = (state, teamId, payload = {}) => {
  ensureRoundCollections(state);
  const team = findTeam(state, teamId);
  if (!team) return { ok: false, error: "Hãy vào đội trước khi dùng vật phẩm." };

  const item = team.supportItems.find((entry) => entry.instanceId === payload.itemInstanceId || entry.type === payload.itemInstanceId);
  if (!item) return { ok: false, error: "Không tìm thấy vật phẩm." };

  if (item.type === SUPPORT_ITEM_TYPES.SHIELD) {
    addRoundMessage(state, teamId, { title: "Lá chắn", text: "Lá chắn sẽ tự động kích hoạt khi cần." });
    return { ok: true, result: { type: item.type } };
  }

  if (item.type === SUPPORT_ITEM_TYPES.DIRECTION_HINT) {
    takeItem(team, item.instanceId);
    const hint = edgeHint(team, state.config.boardSize);
    addRoundMessage(state, teamId, { title: "Gợi ý hướng", text: hint.text });
    return { ok: true, result: { type: item.type, hint } };
  }

  if (item.type === SUPPORT_ITEM_TYPES.GUIDING_STAR) {
    takeItem(team, item.instanceId);
    const text = starMessage(team);
    addRoundMessage(state, teamId, { title: "Sao dẫn đường", text });
    return { ok: true, result: { type: item.type, text } };
  }

  if (item.type === SUPPORT_ITEM_TYPES.DOUBLE_SCORE) {
    takeItem(team, item.instanceId);
    team.effects = { ...(team.effects || {}), doubleScore: true };
    addRoundMessage(state, teamId, { title: "Nhân đôi điểm", text: "Lần di chuyển đúng kế tiếp sẽ được +20 điểm." });
    return { ok: true, result: { type: item.type } };
  }

  if (item.type === SUPPORT_ITEM_TYPES.TRAP) {
    const point = { x: Number(payload.x), y: Number(payload.y) };
    if (!pointInside(point, state.config.boardSize)) return { ok: false, error: "Vị trí cạm bẫy không hợp lệ." };
    takeItem(team, item.instanceId);
    state.round.traps.push({ x: point.x, y: point.y, ownerTeamId: teamId });
    addRoundMessage(state, teamId, { title: "Cạm bẫy", text: "Đã đặt cạm bẫy tại (" + (point.x + 1) + ", " + (point.y + 1) + ")." });
    return { ok: true, result: { type: item.type, point } };
  }

  if (item.type === SUPPORT_ITEM_TYPES.FREEZE_OPPONENT) {
    if (state.round.phase !== ROUND_PHASES.MOVEMENT) return { ok: false, error: "Chỉ được đóng băng trong pha di chuyển." };
    const target = findTeam(state, payload.targetTeamId);
    if (!target || target.id === teamId) return { ok: false, error: "Hãy chọn đối thủ hợp lệ." };
    takeItem(team, item.instanceId);
    state.round.pendingAnswers[target.id] = {
      teamId: target.id,
      direction: null,
      question: null,
      answered: true,
      result: { teamId: target.id, success: false, frozen: true, newPosition: target.position, scoreDelta: 0 }
    };
    addRoundMessage(state, target.id, { title: "Bị đóng băng", text: "Đội bị mất lượt hiện tại." });
    const roundComplete = maybeFinishMovementRound(state);
    return { ok: true, result: { type: item.type, targetTeamId: target.id }, roundComplete };
  }

  return { ok: false, error: "Vật phẩm chưa hỗ trợ." };
};

export const applyTrapAtPosition = (state, teamId) => {
  ensureRoundCollections(state);
  const team = findTeam(state, teamId);
  if (!team) return null;
  const trapIndex = state.round.traps.findIndex((trap) => trap.x === team.position.x && trap.y === team.position.y);
  if (trapIndex === -1) return null;

  const [trap] = state.round.traps.splice(trapIndex, 1);
  const shield = consumeShield(team);
  if (shield) {
    addRoundMessage(state, teamId, { title: "Lá chắn", text: "Lá chắn đã chặn một cạm bẫy." });
    return { ...trap, scoreDelta: 0, blockedByShield: true };
  }

  team.score = Math.max(0, team.score - 1);
  addRoundMessage(state, teamId, { title: "Dính cạm bẫy", text: "Đội bị trừ 1 điểm." });
  return { ...trap, scoreDelta: -1, blockedByShield: false };
};
