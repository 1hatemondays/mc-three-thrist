import { DIRECTIONS, ROUND_PHASES } from "../shared/constants.js";
import { SUPPORT_ITEM_TYPES, getSupportItemMeta } from "../shared/gameContent.js";
import { hasWall } from "../shared/maze.js";
import { isGameOver } from "./gameOver.js";
import { startMeteorShower } from "./meteorLogic.js";
import { addRoundMessage, ensureRoundCollections, finishTeamTurn, maybeFinishMovementRound, spendTurnEnergy } from "./roundFlow.js";

const directionRules = [
  { direction: DIRECTIONS.UP, label: "trên", dx: 0, dy: -1, side: "top" },
  { direction: DIRECTIONS.RIGHT, label: "phải", dx: 1, dy: 0, side: "right" },
  { direction: DIRECTIONS.DOWN, label: "dưới", dx: 0, dy: 1, side: "bottom" },
  { direction: DIRECTIONS.LEFT, label: "trái", dx: -1, dy: 0, side: "left" }
];

const findTeam = (state, teamId) => state.teams.find((team) => team.id === teamId);
const pointInside = (point, boardSize) =>
  Number.isInteger(point?.x) && Number.isInteger(point?.y) && point.x >= 0 && point.y >= 0 && point.x < boardSize && point.y < boardSize;

const choose = (items, random = Math.random) => {
  if (!items.length) return null;
  return items[Math.min(Math.floor(random() * items.length), items.length - 1)];
};

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

const edgeHint = (team, boardSize, random = Math.random) => {
  const discoveredCells = new Set((team.discoveredCells || []).map((point) => point.x + ":" + point.y));
  const routes = directionRules.map((rule) => {
    const target = { x: team.position.x + rule.dx, y: team.position.y + rule.dy };
    const blocked = !pointInside(target, boardSize) || hasWall(team.walls || [], boardSize, team.position.x, team.position.y, rule.side);

    return {
      ...rule,
      target,
      blocked,
      unexplored: !blocked && !discoveredCells.has(target.x + ":" + target.y)
    };
  });
  const unexploredOpenRoutes = routes.filter((route) => route.unexplored);
  const openRoutes = routes.filter((route) => !route.blocked);
  const route = choose(unexploredOpenRoutes.length ? unexploredOpenRoutes : openRoutes.length ? openRoutes : routes, random);

  return {
    direction: route.direction,
    blocked: route.blocked,
    target: route.target,
    unexplored: route.unexplored,
    text: route.blocked
      ? "Hướng " + route.label + " bị chặn bởi tường hoặc biên."
      : "Hướng " + route.label + " đang mở" + (route.unexplored ? " và dẫn tới ô chưa khám phá." : ".")
  };
};


export const useSupportItem = (state, teamId, payload = {}, random = Math.random) => {
  if (isGameOver(state)) return { ok: false, error: "Trò chơi đã kết thúc." };
  ensureRoundCollections(state);
  const team = findTeam(state, teamId);
  if (!team) return { ok: false, error: "Hãy vào đội trước khi dùng vật phẩm." };

  const item = team.supportItems.find((entry) => entry.instanceId === payload.itemInstanceId || entry.type === payload.itemInstanceId);
  if (!item) return { ok: false, error: "Không tìm thấy vật phẩm." };

  if (item.type === SUPPORT_ITEM_TYPES.SHIELD) {
    addRoundMessage(state, teamId, { title: "Lá chắn", text: "Lá chắn sẽ tự động kích hoạt khi cần." });
    return { ok: true, result: { type: item.type } };
  }

  if (state.round.phase !== ROUND_PHASES.MOVEMENT || state.round.activeTeamId !== teamId) {
    return { ok: false, error: "Chỉ được dùng vật phẩm chủ động trong lượt của đội." };
  }
  if (state.round.turnEnergy?.teamId === teamId && state.round.turnEnergy.remaining < 1) {
    return { ok: false, error: "Đội đã hết năng lượng cho lượt này." };
  }

  const spendItemEnergy = () => spendTurnEnergy(state, teamId);
  const finishIfEnergyEmpty = (spent, result = null) =>
    spent.energy.remaining <= 0 ? finishTeamTurn(state, teamId, result) : false;

  if (item.type === SUPPORT_ITEM_TYPES.DIRECTION_HINT) {
    const spent = spendItemEnergy();
    if (!spent.ok) return spent;
    takeItem(team, item.instanceId);
    const hint = edgeHint(team, state.config.boardSize, random);
    addRoundMessage(state, teamId, { title: "Gợi ý hướng", text: hint.text });
    const result = { type: item.type, hint };
    return { ok: true, result, roundComplete: finishIfEnergyEmpty(spent, { teamId, success: false, itemUsed: item.type, scoreDelta: 0 }) };
  }

  if (item.type === SUPPORT_ITEM_TYPES.METEOR_SHOWER) {
    const started = startMeteorShower(state, teamId);
    if (!started.ok) return started;
    const spent = spendItemEnergy();
    if (!spent.ok) return spent;
    takeItem(team, item.instanceId);
    const result = { type: item.type };
    return { ok: true, result, roundComplete: finishIfEnergyEmpty(spent, { teamId, success: false, itemUsed: item.type, scoreDelta: 0 }) };
  }

  if (item.type === SUPPORT_ITEM_TYPES.DOUBLE_SCORE) {
    const spent = spendItemEnergy();
    if (!spent.ok) return spent;
    takeItem(team, item.instanceId);
    team.effects = { ...(team.effects || {}), doubleScore: true };
    addRoundMessage(state, teamId, { title: "Nhân đôi điểm", text: "Lần di chuyển đúng kế tiếp sẽ được +20 điểm." });
    const result = { type: item.type };
    return { ok: true, result, roundComplete: finishIfEnergyEmpty(spent, { teamId, success: false, itemUsed: item.type, scoreDelta: 0 }) };
  }

  if (item.type === SUPPORT_ITEM_TYPES.TRAP) {
    const point = { x: Number(payload.x), y: Number(payload.y) };
    if (!pointInside(point, state.config.boardSize)) return { ok: false, error: "Vị trí cạm bẫy không hợp lệ." };
    const spent = spendItemEnergy();
    if (!spent.ok) return spent;
    takeItem(team, item.instanceId);
    state.round.traps.push({ x: point.x, y: point.y, ownerTeamId: teamId });
    addRoundMessage(state, teamId, { title: "Cạm bẫy", text: "Đã đặt cạm bẫy tại (" + (point.x + 1) + ", " + (point.y + 1) + ")." });
    const result = { type: item.type, point };
    return { ok: true, result, roundComplete: finishIfEnergyEmpty(spent, { teamId, success: false, itemUsed: item.type, scoreDelta: 0 }) };
  }

  if (item.type === SUPPORT_ITEM_TYPES.FREEZE_OPPONENT) {
    if (state.round.phase !== ROUND_PHASES.MOVEMENT) return { ok: false, error: "Chỉ được đóng băng trong pha di chuyển." };
    const target = findTeam(state, payload.targetTeamId);
    if (!target || target.id === teamId) return { ok: false, error: "Hãy chọn đối thủ hợp lệ." };
    const spent = spendItemEnergy();
    if (!spent.ok) return spent;
    takeItem(team, item.instanceId);
    state.round.pendingAnswers[target.id] = {
      teamId: target.id,
      direction: null,
      question: null,
      answered: true,
      result: { teamId: target.id, success: false, frozen: true, newPosition: target.position, scoreDelta: 0 }
    };
    addRoundMessage(state, target.id, { title: "Bị đóng băng", text: "Đội bị mất lượt hiện tại." });
    maybeFinishMovementRound(state);
    const result = { type: item.type, targetTeamId: target.id };
    return { ok: true, result, roundComplete: finishIfEnergyEmpty(spent, { teamId, success: false, itemUsed: item.type, scoreDelta: 0 }) };
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
