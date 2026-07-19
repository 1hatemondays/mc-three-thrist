import { MOVE_SCORE, ROUND_PHASES } from "../shared/constants.js";
import {
  EVENT_TILE_CATALOG,
  EVENT_TILE_TYPES,
  SUPPORT_ITEM_CATALOG,
  getEventTileMeta
} from "../shared/gameContent.js";
import { finishGameIfNeeded, isGameOver } from "./gameOver.js";
import { startCombat } from "./combatLogic.js";
import { hardQuestionBank, questionBank } from "./questionBank.js";
import { addRoundMessage } from "./roundFlow.js";
import { consumeShield, grantSupportItem } from "./supportLogic.js";

const pointKey = ({ x, y }) => x + ":" + y;
const BOMB_TIME_MS = 10000;
const BOMB_DAMAGE = 30;


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

const recordAnswer = (team, correct) => {
  team.answerStats = team.answerStats || { correct: 0, wrong: 0 };
  if (correct) team.answerStats.correct += 1;
  else team.answerStats.wrong += 1;
};

const publicMeta = (meta) => ({
  type: meta.type,
  name: meta.name,
  symbol: meta.symbol,
  color: meta.color,
  lucideIcon: meta.lucideIcon
});

const consumeEventTile = (state, tile) => {
  state.round.eventTiles = (state.round.eventTiles || []).filter((candidate) => {
    if (tile.id && candidate.id) return candidate.id !== tile.id;
    return !(candidate.x === tile.x && candidate.y === tile.y && candidate.type === tile.type);
  });
};

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

const applyShieldedGlobalEffect = (state, title, applyEffect) =>
  state.teams.map((team) => {
    const shield = consumeShield(team);
    const outcome = shield
      ? { teamId: team.id, shielded: true }
      : { teamId: team.id, shielded: false, ...applyEffect(team) };

    addRoundMessage(state, team.id, {
      title,
      text: shield ? "L\u00e1 ch\u1eafn \u0111\u00e3 b\u1ea3o v\u1ec7 \u0111\u1ed9i." : outcome.message
    });
    delete outcome.message;
    return outcome;
  });

export const applyEventTileEffect = (state, teamId, tile, random = Math.random) => {
  if (!tile) return null;

  const team = state.teams.find((item) => item.id === teamId);
  if (!team) return null;

  consumeEventTile(state, tile);

  if (tile.type === EVENT_TILE_TYPES.MYSTERY_BOX) {
    const itemMeta = choose(SUPPORT_ITEM_CATALOG, random);
    const item = grantSupportItem(team, itemMeta.type);

    return makeEventResult(tile, {
      item,
      message: "Nh\u1eadn v\u1eadt ph\u1ea9m: " + item.name
    });
  }

  if (tile.type === EVENT_TILE_TYPES.TELEPORT) {
    state.round.pendingEvents = state.round.pendingEvents || {};
    state.round.pendingEvents[teamId] = { type: EVENT_TILE_TYPES.TELEPORT };

    return makeEventResult(tile, {
      message: "Ch\u1ecdn \u00f4 mu\u1ed1n d\u1ecbch chuy\u1ec3n \u0111\u1ebfn ho\u1eb7c \u1edf l\u1ea1i"
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

  if (tile.type === EVENT_TILE_TYPES.MONSTER_ATTACK) {
    const outcomes = applyShieldedGlobalEffect(state, "Qu\u00e1i v\u1eadt t\u1ea5n c\u00f4ng", (target) => {
      if (target.score >= 10) {
        target.score -= 10;
        return { scoreLoss: 10, hpLoss: 0, message: "M\u1ea5t 10 \u0111i\u1ec3m." };
      }
      target.hp = Math.max(0, target.hp - 10);
      return { scoreLoss: 0, hpLoss: 10, message: "Kh\u00f4ng \u0111\u1ee7 \u0111i\u1ec3m, m\u1ea5t 10 HP." };
    });
    return makeEventResult(tile, { outcomes, message: "T\u1ea5t c\u1ea3 \u0111\u1ed9i ph\u1ea3i n\u1ed9p 10 \u0111i\u1ec3m ho\u1eb7c m\u1ea5t 10 HP" });
  }

  if (tile.type === EVENT_TILE_TYPES.METEOR_STRIKE) {
    const outcomes = applyShieldedGlobalEffect(state, "M\u01b0a sao b\u0103ng", (target) => {
      target.hp = Math.max(0, target.hp - 10);
      return { hpLoss: 10, message: "M\u1ea5t 10 HP." };
    });
    return makeEventResult(tile, { outcomes, message: "T\u1ea5t c\u1ea3 \u0111\u1ed9i m\u1ea5t 10 HP" });
  }

  if (tile.type === EVENT_TILE_TYPES.BLESSING) {
    for (const target of state.teams) {
      target.hp += 10;
      addRoundMessage(state, target.id, { title: "Ban ph\u01b0\u1edbc", text: "H\u1ed3i 10 HP." });
    }
    return makeEventResult(tile, { message: "T\u1ea5t c\u1ea3 \u0111\u1ed9i h\u1ed3i 10 HP" });
  }

  if (tile.type === EVENT_TILE_TYPES.PRISON) {
    addRoundMessage(state, teamId, { title: "Nh\u1ed1t t\u00f9", text: "\u0110\u1ed9i b\u1ecb m\u1ea5t l\u01b0\u1ee3t hi\u1ec7n t\u1ea1i." });
    return makeEventResult(tile, { endsTurn: true, message: "\u0110\u1ed9i b\u1ecb m\u1ea5t l\u01b0\u1ee3t" });
  }

  if (tile.type === EVENT_TILE_TYPES.BOMB) {
    state.round.phase = ROUND_PHASES.BOMB;
    state.round.bomb = {
      holderTeamId: teamId,
      question: choose(questionBank, random),
      deadline: Date.now() + BOMB_TIME_MS,
      passCount: 0,
      lastPass: null,
      result: null
    };
    return makeEventResult(tile, { message: "Bom \u0111\u00e3 b\u1eaft \u0111\u1ea7u trong tay " + team.name });
  }

  if (tile.type === EVENT_TILE_TYPES.DUEL) {
    const options = state.teams
      .filter((item) => item.id !== teamId)
      .map(({ id, name }) => ({ id, name }));
    state.round.pendingEvents = state.round.pendingEvents || {};
    state.round.pendingEvents[teamId] = {
      type: EVENT_TILE_TYPES.DUEL,
      options
    };
    return makeEventResult(tile, {
      options,
      message: "Chọn một đội để đối kháng."
    });
  }

  return makeEventResult(tile);
};


const nextBombHolder = (state, teamId) => {
  const order = state.round.turnOrder?.length
    ? state.round.turnOrder
    : state.teams.map((team) => team.id);
  const index = order.indexOf(teamId);
  return order[(index + 1) % order.length];
};

const explodeBomb = (state, teamId, reason) => {
  const bomb = state.round.bomb;
  const team = state.teams.find((item) => item.id === teamId);
  if (!bomb || !team) return null;

  team.hp = Math.max(0, team.hp - BOMB_DAMAGE);
  bomb.question = null;
  bomb.deadline = 0;
  bomb.result = {
    loserTeamId: team.id,
    loserTeamName: team.name,
    hpLoss: BOMB_DAMAGE,
    reason,
    explodedAt: Date.now()
  };
  state.round.phase = ROUND_PHASES.MOVEMENT;
  addRoundMessage(state, team.id, {
    title: "Bom ph\u00e1t n\u1ed5",
    text: "M\u1ea5t 30 HP v\u00ec " + (reason === "timeout" ? "h\u1ebft th\u1eddi gian." : "tr\u1ea3 l\u1eddi sai.")
  });
  return bomb.result;
};

export const getBombState = (state, teamId = null, now = Date.now()) => {
  const bomb = state.round.bomb;
  if (!bomb) return null;
  const holder = state.teams.find((team) => team.id === bomb.holderTeamId);
  const active = state.round.phase === ROUND_PHASES.BOMB;
  return {
    active,
    holderTeamId: bomb.holderTeamId,
    holderTeamName: holder?.name || null,
    question: active && bomb.question ? stripQuestionAnswer(bomb.question) : null,
    countdownMs: active ? Math.max(0, bomb.deadline - now) : 0,
    passCount: bomb.passCount,
    lastPass: bomb.lastPass,
    canAnswer: Boolean(active && teamId === bomb.holderTeamId),
    result: bomb.result
  };
};

export const resolveBombTimeout = (state, now = Date.now()) => {
  const bomb = state.round.bomb;
  if (state.round.phase !== ROUND_PHASES.BOMB || !bomb || now < bomb.deadline) return null;
  return explodeBomb(state, bomb.holderTeamId, "timeout");
};

export const resolveBombAnswer = (state, teamId, payload = {}, random = Math.random, now = Date.now()) => {
  const bomb = state.round.bomb;
  if (state.round.phase !== ROUND_PHASES.BOMB || !bomb) {
    return { ok: false, error: "Hi\u1ec7n kh\u00f4ng c\u00f3 Bom." };
  }
  if (teamId !== bomb.holderTeamId) {
    return { ok: false, error: "Bom kh\u00f4ng \u1edf trong tay \u0111\u1ed9i n\u00e0y." };
  }
  if (now >= bomb.deadline) {
    return { ok: true, exploded: true, result: explodeBomb(state, teamId, "timeout") };
  }

  const answerIndex = Number(payload.answerIndex);
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= bomb.question.choices.length) {
    return { ok: false, error: "\u0110\u00e1p \u00e1n kh\u00f4ng h\u1ee3p l\u1ec7." };
  }
  if (answerIndex !== bomb.question.correctIndex) {
    const team = state.teams.find((item) => item.id === teamId);
    if (team) recordAnswer(team, false);
    return { ok: true, exploded: true, result: explodeBomb(state, teamId, "wrong") };
  }

  const team = state.teams.find((item) => item.id === teamId);
  if (team) recordAnswer(team, true);
  const nextTeamId = nextBombHolder(state, teamId);
  const nextTeam = state.teams.find((team) => team.id === nextTeamId);
  bomb.holderTeamId = nextTeamId;
  bomb.question = choose(questionBank, random);
  bomb.deadline = now + BOMB_TIME_MS;
  bomb.passCount += 1;
  bomb.lastPass = { fromTeamId: teamId, toTeamId: nextTeamId, toTeamName: nextTeam?.name || nextTeamId };
  return { ok: true, exploded: false, nextTeamId };
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
  if (isGameOver(state)) return { ok: false, error: "Trò chơi đã kết thúc." };
  const pending = state.round.pendingEvents?.[teamId];
  if (!pending) return { ok: false, error: "Kh\u00f4ng c\u00f3 s\u1ef1 ki\u1ec7n n\u00e0o \u0111ang ch\u1edd." };

  if (pending.type === EVENT_TILE_TYPES.KNOWLEDGE) {
    const team = state.teams.find((item) => item.id === teamId);
    const correct = Number(payload.answerIndex) === pending.question.correctIndex;
    let scoreDelta = 0;
    if (team) recordAnswer(team, correct);
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

  if (pending.type === EVENT_TILE_TYPES.DUEL) {
    const target = state.teams.find((item) => item.id === payload.targetTeamId && item.id !== teamId);
    if (!target) return { ok: false, error: "Hãy chọn đội đối kháng hợp lệ." };
    const combat = startCombat(state, teamId, target.id);
    if (!combat) return { ok: false, error: "Không thể bắt đầu đối kháng." };
    delete state.round.pendingEvents[teamId];
    return {
      ok: true,
      result: {
        type: pending.type,
        targetTeamId: target.id,
        targetName: target.name,
        message: "Đã chọn đối kháng với " + target.name
      }
    };
  }

  if (pending.type === EVENT_TILE_TYPES.TELEPORT) {
    if (payload.action === "skip") {
      delete state.round.pendingEvents[teamId];
      return { ok: true, result: { type: pending.type, skipped: true } };
    }

    const team = state.teams.find((item) => item.id === teamId);
    const point = { x: payload.position?.x, y: payload.position?.y };
    const validPoint =
      Number.isInteger(point.x) &&
      Number.isInteger(point.y) &&
      point.x >= 0 &&
      point.y >= 0 &&
      point.x < state.config.boardSize &&
      point.y < state.config.boardSize;

    if (!team || !validPoint) {
      return { ok: false, error: "H\u00e3y ch\u1ecdn t\u1ecda \u0111\u1ed9 h\u1ee3p l\u1ec7 \u0111\u1ec3 d\u1ecbch chuy\u1ec3n." };
    }

    team.position = point;
    discover(team, point);
    const gameOver = finishGameIfNeeded(state, teamId);
    delete state.round.pendingEvents[teamId];

    return {
      ok: true,
      result: {
        type: pending.type,
        newPosition: point,
        gameOver,
        message: "D\u1ecbch chuy\u1ec3n \u0111\u1ebfn (" + (point.x + 1) + ", " + (point.y + 1) + ")"
      }
    };
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
  const gameOver = finishGameIfNeeded(state, teamId);
  delete state.round.pendingEvents[teamId];

  return {
    ok: true,
    result: {
      type: pending.type,
      targetTeamId: target.id,
      targetName: target.name,
      gameOver,
      message: "\u0110\u00e3 trao \u0111\u1ed5i v\u1ecb tr\u00ed v\u1edbi " + target.name
    }
  };
};

export const serializeEventTiles = (eventTiles = []) =>
  eventTiles.map((tile) => ({
    ...tile,
    meta: getEventTileMeta(tile.type)
  }));
