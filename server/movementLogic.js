import { DIRECTIONS, MOVE_SCORE, ROUND_PHASES } from "../shared/constants.js";
import { canonicalWall, hasWall, wallKey } from "../shared/maze.js";
import { applyEventTileEffect, findEventTileAt, getPlayerPendingEvent } from "./eventLogic.js";
import { finishGameIfNeeded, isGameOver } from "./gameOver.js";
import { maybeFinishMovementRound } from "./roundFlow.js";
import { applyTrapAtPosition } from "./supportLogic.js";

const DIRECTION_RULES = {
  [DIRECTIONS.UP]: { dx: 0, dy: -1, side: "top" },
  [DIRECTIONS.RIGHT]: { dx: 1, dy: 0, side: "right" },
  [DIRECTIONS.DOWN]: { dx: 0, dy: 1, side: "bottom" },
  [DIRECTIONS.LEFT]: { dx: -1, dy: 0, side: "left" }
};

export const stripQuestionAnswer = (question) => {
  if (!question) return null;

  const { correctIndex, ...publicQuestion } = question;
  return publicQuestion;
};

export const getPlayerRoundState = (round, teamId) => {
  const pending = round.pendingAnswers?.[teamId] || null;

  return {
    roundNumber: round.roundNumber,
    phase: round.phase,
    turnOrder: round.turnOrder || [],
    activeTeamId: round.activeTeamId || null,
    pendingEvent: getPlayerPendingEvent(round, teamId),
    currentQuestion: pending && !pending.answered ? stripQuestionAnswer(pending.question) : null,
    pendingAnswer: pending
      ? {
          direction: pending.direction,
          answered: pending.answered,
          result: pending.result || null
        }
      : null
  };
};

export const normalizeDirection = (direction) => String(direction || "").trim().toLowerCase();

const findTeam = (state, teamId) => state.teams.find((team) => team.id === teamId);

const isSetupReady = (state) => state.setup?.started && state.teams.every((team) => team.startPoint);

const chooseQuestion = (questions, random = Math.random) => {
  if (!Array.isArray(questions) || questions.length === 0) {
    return null;
  }

  const index = Math.min(Math.floor(random() * questions.length), questions.length - 1);
  return questions[index];
};

export const chooseMoveQuestion = (state, teamId, payload, questions, random) => {
  const team = findTeam(state, teamId);
  if (!team) return { ok: false, error: "Hãy vào đội trước khi chọn hướng đi." };
  if (isGameOver(state)) return { ok: false, error: "Trò chơi đã kết thúc." };

  if (!isSetupReady(state)) {
    return { ok: false, error: "Phần di chuyển bắt đầu sau khi host bấm Bắt đầu." };
  }
  const turnOrder = state.round.turnOrder?.length
    ? state.round.turnOrder
    : state.teams.map((item) => item.id);
  state.round.turnOrder = turnOrder;
  state.round.activeTeamId = state.round.activeTeamId || turnOrder[0] || null;

  if (state.round.phase !== ROUND_PHASES.MOVEMENT) {
    return { ok: false, error: "Hiện chưa mở phần di chuyển." };
  }

  if (state.round.pendingEvents?.[teamId]) {
    return { ok: false, error: "H?y x? l? s? ki?n hi?n t?i tr??c khi ?i ti?p." };
  }

  const existing = state.round.pendingAnswers[teamId];
  if (existing && !existing.answered) {
    return { ok: false, error: "Hãy trả lời câu hỏi hiện tại trước khi chọn hướng khác." };
  }

  if (existing?.answered) {
    return { ok: false, error: "Đội này đã hoàn thành lượt hiện tại." };
  }

  const direction = normalizeDirection(payload?.direction);
  if (!DIRECTION_RULES[direction]) {
    return { ok: false, error: "Hãy chọn hướng hợp lệ: lên, phải, xuống hoặc trái." };
  }
  if (state.round.activeTeamId !== teamId) {
    return { ok: false, error: "Ch\u01b0a \u0111\u1ebfn l\u01b0\u1ee3t c\u1ee7a \u0111\u1ed9i n\u00e0y." };
  }

  const movement = previewMove(team, state.config.boardSize, direction);
  const revisitingKnownCell = !movement.blocked && hasDiscoveredCell(team, movement.newPosition);

  if (revisitingKnownCell) {
    state.round.currentQuestion = null;
    return {
      ok: true,
      instant: true,
      result: resolveMovement(state, team, teamId, direction, {
        usedQuestion: false,
        correct: true,
        awardScore: false
      })
    };
  }

  if (movement.blocked) {
    const result = resolveMovement(state, team, teamId, direction, {
      usedQuestion: false,
      correct: true,
      awardScore: false
    });

    state.round.pendingAnswers[teamId] = {
      teamId,
      direction,
      question: null,
      answered: true,
      result
    };
    state.round.currentQuestion = null;

    return { ok: true, instant: true, result, roundComplete: maybeFinishMovementRound(state) };
  }

  const question = chooseQuestion(questions, random);
  if (!question) {
    return { ok: false, error: "Ngân hàng câu hỏi đang trống." };
  }

  state.round.pendingAnswers[teamId] = {
    teamId,
    direction,
    question,
    answered: false,
    result: null
  };
  state.round.currentQuestion = question;

  return { ok: true, teamId, direction, question };
};

const addDiscoveredCell = (team, point) => {
  const exists = team.discoveredCells.some((cell) => cell.x === point.x && cell.y === point.y);
  if (!exists) team.discoveredCells.push({ ...point });
};

const hasDiscoveredCell = (team, point) =>
  team.discoveredCells.some((cell) => cell.x === point.x && cell.y === point.y);

const addRevealedWall = (team, boardSize, wall) => {
  const revealed = canonicalWall(wall, boardSize);
  const key = wallKey(revealed, boardSize);
  if (team.revealedWalls?.some((item) => wallKey(item, boardSize) === key)) return;
  team.revealedWalls = [...(team.revealedWalls || []), revealed];
};

export const previewMove = (team, boardSize, direction) => {
  const rule = DIRECTION_RULES[direction];
  if (!rule) return { blocked: true, reason: "invalid-direction", newPosition: team.position };

  const { x, y } = team.position;
  const newPosition = { x: x + rule.dx, y: y + rule.dy };
  const outsideBoard =
    newPosition.x < 0 ||
    newPosition.y < 0 ||
    newPosition.x >= boardSize ||
    newPosition.y >= boardSize;

  if (outsideBoard) {
    return { blocked: true, reason: "border", newPosition: team.position };
  }

  if (hasWall(team.walls, boardSize, x, y, rule.side)) {
    return { blocked: true, reason: "wall", newPosition: team.position };
  }

  return { blocked: false, reason: null, newPosition };
};

const resolveMovement = (state, team, teamId, direction, { usedQuestion, correct, awardScore }) => {
  const movement = previewMove(team, state.config.boardSize, direction);
  const success = Boolean(correct) && !movement.blocked;
  let scoreDelta = 0;
  let event = null;
  let trap = null;
  let gameOver = null;

  if (movement.blocked && ["wall", "border"].includes(movement.reason)) {
    addRevealedWall(team, state.config.boardSize, {
      x: team.position.x,
      y: team.position.y,
      side: DIRECTION_RULES[direction]?.side
    });
  }

  if (success) {
    team.position = movement.newPosition;
    if (awardScore) {
      const moveScore = team.effects?.doubleScore ? MOVE_SCORE * 2 : MOVE_SCORE;
      if (team.effects?.doubleScore) team.effects.doubleScore = false;
      team.score += moveScore;
      scoreDelta = moveScore;
    }
    addDiscoveredCell(team, movement.newPosition);
    gameOver = finishGameIfNeeded(state, teamId);

    if (!gameOver) {
      trap = applyTrapAtPosition(state, teamId);
      scoreDelta += trap?.scoreDelta || 0;

      const eventTile = findEventTileAt(state.round.eventTiles, team.position);
      event = applyEventTileEffect(state, teamId, eventTile);
      scoreDelta += event?.scoreDelta || 0;
      gameOver = state.gameOver || null;
    }
  }

  return {
    teamId,
    direction,
    correct,
    usedQuestion,
    freeMove: !usedQuestion,
    blocked: movement.blocked,
    blockedReason: movement.reason,
    success,
    newPosition: team.position,
    scoreDelta,
    event,
    trap,
    gameOver
  };
};

export const answerQuestion = (state, teamId, payload) => {
  const team = findTeam(state, teamId);
  if (!team) return { ok: false, error: "Hãy vào đội trước khi trả lời." };
  if (isGameOver(state)) return { ok: false, error: "Trò chơi đã kết thúc." };

  if (state.round.phase !== ROUND_PHASES.MOVEMENT) {
    return { ok: false, error: "Hiện không có câu hỏi di chuyển nào đang mở." };
  }

  const pending = state.round.pendingAnswers[teamId];
  if (!pending) return { ok: false, error: "Hãy chọn hướng trước khi trả lời." };
  if (pending.answered) return { ok: false, error: "Câu hỏi này đã được trả lời." };
  if (state.round.activeTeamId && state.round.activeTeamId !== teamId) {
    return { ok: false, error: "Ch\u01b0a \u0111\u1ebfn l\u01b0\u1ee3t c\u1ee7a \u0111\u1ed9i n\u00e0y." };
  }

  const answerIndex = Number(payload?.answerIndex);
  if (!Number.isInteger(answerIndex)) {
    return { ok: false, error: "Chỉ số đáp án phải là số nguyên." };
  }

  const correct = answerIndex === pending.question.correctIndex;
  const result = resolveMovement(state, team, teamId, pending.direction, {
    usedQuestion: true,
    correct,
    awardScore: true
  });

  const turnEnded = !result.success || Boolean(result.event?.endsTurn);
  let roundComplete = false;

  if (turnEnded) {
    pending.answered = true;
    pending.result = result;

    roundComplete = maybeFinishMovementRound(state);
  } else {
    delete state.round.pendingAnswers[teamId];
    state.round.currentQuestion = null;
  }

  return {
    ok: true,
    result,
    roundComplete
  };
};
