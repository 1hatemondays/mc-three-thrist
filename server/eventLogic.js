import { MOVE_SCORE } from "../shared/constants.js";
import {
  EVENT_TILE_CATALOG,
  EVENT_TILE_TYPES,
  SUPPORT_ITEM_CATALOG,
  getEventTileMeta
} from "../shared/gameContent.js";
import { startCombat } from "./combatLogic.js";
import { hardQuestionBank } from "./questionBank.js";
import { addRoundMessage } from "./roundFlow.js";
import { grantSupportItem } from "./supportLogic.js";

const pointKey = ({ x, y }) => x + ":" + y;

const allCells = (boardSize) =>
  Array.from({ length: boardSize * boardSize }, (_, index) => ({
    x: index % boardSize,
    y: Math.floor(index / boardSize)
  }));

const choose = (items, random = Math.random) => {
  if (!items.length) return null;
  return items[Math.min(Math.floor(random() * items.length), items.length - 1)];
};

const discover = (team, point) => {
  if (!team.discoveredCells.some((cell) => cell.x === point.x && cell.y === point.y)) {
    team.discoveredCells.push({ ...point });
  }
};

const publicMeta = (meta) => ({
  type: meta.type,
  name: meta.name,
  symbol: meta.symbol,
  color: meta.color,
  lucideIcon: meta.lucideIcon
});

export const createEventTiles = (boardSize, random = Math.random, excludedPoints = []) => {
  const used = new Set(excludedPoints.map(pointKey));
  const cells = allCells(boardSize);

  return EVENT_TILE_CATALOG.map((meta) => {
    const available = cells.filter((cell) => !used.has(pointKey(cell)));
    const point = choose(available, random) || choose(cells, random);
    used.add(pointKey(point));

    return {
      id: meta.type + ":" + point.x + ":" + point.y,
      type: meta.type,
      x: point.x,
      y: point.y
    };
  });
};

export const refreshRoundEventTiles = (state, random = Math.random) => {
  state.round.eventTiles = createEventTiles(
    state.config.boardSize,
    random,
    state.teams.map((team) => team.position)
  );
};

export const findEventTileAt = (eventTiles = [], point) =>
  eventTiles.find((tile) => tile.x === point.x && tile.y === point.y) || null;

const makeEventResult = (tile, extra = {}) => {
  const meta = getEventTileMeta(tile.type);
  return {
    ...publicMeta(meta),
    x: tile.x,
    y: tile.y,
    ...extra
  };
};

export const applyEventTileEffect = (state, teamId, tile, random = Math.random) => {
  if (!tile) return null;

  const team = state.teams.find((item) => item.id === teamId);
  if (!team) return null;

  if (tile.type === EVENT_TILE_TYPES.MYSTERY_BOX) {
    const itemMeta = choose(SUPPORT_ITEM_CATALOG, random);
    const item = grantSupportItem(team, itemMeta.type);

    return makeEventResult(tile, {
      item,
      message: "Nh\u1eadn v\u1eadt ph\u1ea9m: " + item.name
    });
  }

  if (tile.type === EVENT_TILE_TYPES.TELEPORT) {
    const point = choose(allCells(state.config.boardSize), random);
    team.position = point;
    discover(team, point);

    return makeEventResult(tile, {
      newPosition: point,
      message: "D\u1ecbch chuy\u1ec3n \u0111\u1ebfn (" + (point.x + 1) + ", " + (point.y + 1) + ")"
    });
  }

  if (tile.type === EVENT_TILE_TYPES.KNOWLEDGE) {
    const question = choose(hardQuestionBank, random);
    state.round.pendingEvents = state.round.pendingEvents || {};
    state.round.pendingEvents[teamId] = {
      type: EVENT_TILE_TYPES.KNOWLEDGE,
      question
    };

    return makeEventResult(tile, {
      message: "Trả lời câu hỏi khó để nhận thêm 10 điểm"
    });
  }

  if (tile.type === EVENT_TILE_TYPES.POSITION_SWAP) {
    const options = state.teams
      .filter((item) => item.id !== teamId)
      .map(({ id, name, position }) => ({ id, name, position }));

    state.round.pendingEvents = state.round.pendingEvents || {};
    state.round.pendingEvents[teamId] = {
      type: EVENT_TILE_TYPES.POSITION_SWAP,
      options
    };

    return makeEventResult(tile, {
      options,
      message: "C\u00f3 th\u1ec3 trao \u0111\u1ed5i v\u1ecb tr\u00ed ho\u1eb7c b\u1ecf qua"
    });
  }

  if (tile.type === EVENT_TILE_TYPES.DUEL) {
    const combat = startCombat(state, teamId, random);
    return makeEventResult(tile, {
      opponentId: combat?.opponentId || null,
      opponentName: combat?.opponentName || null,
      message: combat ? "Đối kháng với " + combat.opponentName : "Không có đối thủ"
    });
  }

  return makeEventResult(tile);
};

export const getPlayerPendingEvent = (round, teamId) => {
  const pending = round.pendingEvents?.[teamId];
  if (!pending) return null;
  const meta = getEventTileMeta(pending.type);

  return {
    ...publicMeta(meta),
    options: pending.options || [],
    question: pending.question ? stripQuestionAnswer(pending.question) : null
  };
};

const stripQuestionAnswer = (question) => {
  const { correctIndex, ...publicQuestion } = question;
  return publicQuestion;
};

export const resolvePendingEvent = (state, teamId, payload = {}) => {
  const pending = state.round.pendingEvents?.[teamId];
  if (!pending) return { ok: false, error: "Kh\u00f4ng c\u00f3 s\u1ef1 ki\u1ec7n n\u00e0o \u0111ang ch\u1edd." };

  if (pending.type === EVENT_TILE_TYPES.KNOWLEDGE) {
    const team = state.teams.find((item) => item.id === teamId);
    const correct = Number(payload.answerIndex) === pending.question.correctIndex;
    let scoreDelta = 0;
    if (correct) {
      team.score += MOVE_SCORE;
      scoreDelta = MOVE_SCORE;
    }
    delete state.round.pendingEvents[teamId];
    addRoundMessage(state, teamId, {
      title: "Tri thức",
      text: correct ? "Trả lời đúng câu hỏi khó, nhận thêm 10 điểm." : "Trả lời sai câu hỏi khó."
    });
    return { ok: true, result: { type: pending.type, correct, scoreDelta } };
  }

  if (pending.type !== EVENT_TILE_TYPES.POSITION_SWAP) {
    delete state.round.pendingEvents[teamId];
    return { ok: true, result: { type: pending.type } };
  }

  if (payload.action === "skip") {
    delete state.round.pendingEvents[teamId];
    return { ok: true, result: { type: pending.type, skipped: true } };
  }

  const team = state.teams.find((item) => item.id === teamId);
  const target = state.teams.find((item) => item.id === payload.targetTeamId && item.id !== teamId);

  if (!team || !target) {
    return { ok: false, error: "H\u00e3y ch\u1ecdn \u0111\u1ed9i h\u1ee3p l\u1ec7 \u0111\u1ec3 trao \u0111\u1ed5i." };
  }

  const original = team.position;
  team.position = target.position;
  target.position = original;
  discover(team, team.position);
  discover(target, target.position);
  delete state.round.pendingEvents[teamId];

  return {
    ok: true,
    result: {
      type: pending.type,
      targetTeamId: target.id,
      targetName: target.name,
      message: "\u0110\u00e3 trao \u0111\u1ed5i v\u1ecb tr\u00ed v\u1edbi " + target.name
    }
  };
};

export const serializeEventTiles = (eventTiles = []) =>
  eventTiles.map((tile) => ({
    ...tile,
    meta: getEventTileMeta(tile.type)
  }));
