import { DIRECTIONS, MOVE_SCORE, ROUND_PHASES } from "../shared/constants.js";
import { canonicalWall, hasWall, wallKey } from "../shared/maze.js";
import { applyEventTileEffect, findEventTileAt, getPlayerPendingEvent } from "./eventLogic.js";
import { finishGameIfNeeded, isGameOver } from "./gameOver.js";
import { drawQuestion } from "./questionBank.js";
import { ensureTurnEnergy, finishTeamTurn, maybeFinishMovementRound, spendTurnEnergy } from "./roundFlow.js";
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
  const questionControl = round.questionControl?.teamId === teamId ? round.questionControl : null;

  return {
    roundNumber: round.roundNumber,
    phase: round.phase,
    turnOrder: round.turnOrder || [],
    activeTeamId: round.activeTeamId || null,
    turnEnergy: round.turnEnergy?.teamId === teamId ? round.turnEnergy : null,
    questionControl: questionControl
      ? {
          answerOpen: Boolean(questionControl.answerOpen),
          answered: Boolean(questionControl.answered),
          reveal: Boolean(questionControl.reveal),
          correct: questionControl.reveal ? questionControl.correct : null,
          correctIndex: questionControl.reveal ? questionControl.question?.correctIndex : null
        }
      : null,
    pendingEvent: getPlayerPendingEvent(round, teamId),
    currentQuestion:
      pending && !pending.answered && questionControl?.answerOpen
        ? stripQuestionAnswer(pending.question)
        : null,
    pendingAnswer: pending
      ? {
          direction: pending.direction,
          answered: pending.answered,
          waitingForHost: Boolean(!pending.answered && !questionControl?.answerOpen),
          result: pending.result || null
        }
      : null
  };
};

export const normalizeDirection = (direction) => String(direction || "").trim().toLowerCase();

const findTeam = (state, teamId) => state.teams.find((team) => team.id === teamId);

const isSetupReady = (state) => state.setup?.started && state.teams.every((team) => team.startPoint);

export const chooseMoveQuestion = (state, teamId, payload, questions, random) => {
  const team = findTeam(state, teamId);
  if (!team) return { ok: false, error: "Hãy vào đội trước khi chọn hướng đi." };
  if (isGameOver(state)) return { ok: false, error: "Trò chơi đã kết thúc." };

  if (!isSetupReady(state)) {
    return { ok: false, error: "Phần di chuyển bắt đầu sau khi người dẫn bấm Bắt đầu." };
  }
  const turnOrder = state.round.turnOrder?.length
    ? state.round.turnOrder
    : state.teams.map((item) => item.id);
  state.round.turnOrder = turnOrder;
  state.round.activeTeamId = state.round.activeTeamId || turnOrder[0] || null;
  ensureTurnEnergy(state, state.round.activeTeamId);

  if (state.round.phase !== ROUND_PHASES.MOVEMENT) {
    return { ok: false, error: "Hiện chưa mở phần di chuyển." };
  }

  if (state.round.pendingEvents?.[teamId]) {
    return { ok: false, error: "Hãy xử lý sự kiện hiện tại trước khi đi tiếp." };
  }

  if (state.round.questionControl?.teamId === teamId && state.round.questionControl.answered && !state.round.questionControl.reveal) {
    return { ok: false, error: "Chờ người dẫn hiện đáp án trước khi đi tiếp." };
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
    state.round.questionControl = null;
    const result = resolveMovement(state, team, teamId, direction, {
      usedQuestion: false,
      correct: true,
      awardScore: false
    });
    if (result.event?.endsTurn) {
      return { ok: true, instant: true, result, roundComplete: finishTeamTurn(state, teamId, result) };
    }
    return {
      ok: true,
      instant: true,
      result
    };
  }

  if (movement.blocked) {
    const spent = spendTurnEnergy(state, teamId);
    if (!spent.ok) return spent;
    const result = resolveMovement(state, team, teamId, direction, {
      usedQuestion: false,
      correct: true,
      awardScore: false
    });

    state.round.questionControl = null;
    state.round.currentQuestion = null;

    const roundComplete = spent.energy.remaining <= 0
      ? finishTeamTurn(state, teamId, result)
      : false;
    return { ok: true, instant: true, result, roundComplete };
  }

  const question = drawQuestion(state, "normal", questions, random);
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
  state.round.questionControl = {
    teamId,
    direction,
    question,
    answerOpen: false,
    answered: false,
    answerIndex: null,
    correct: null,
    result: null,
    reveal: false
  };

  return { ok: true, teamId, direction, question };
};

export const openQuestionForAnswer = (state, teamId = null) => {
  const control = state.round.questionControl;
  if (!control || control.answered) return { ok: false, error: "Không có câu hỏi đang chờ mở." };
  if (teamId && control.teamId !== teamId) return { ok: false, error: "Câu hỏi không thuộc đội này." };
  control.answerOpen = true;
  return { ok: true, question: stripQuestionAnswer(control.question) };
};

export const revealQuestionExplanation = (state) => {
  const control = state.round.questionControl;
  if (!control || !control.answered) return { ok: false, error: "Chưa có kết quả câu hỏi để hiện đáp án." };
  control.reveal = true;
  return { ok: true, questionControl: control };
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

const recordAnswer = (team, correct) => {
  team.answerStats = team.answerStats || { correct: 0, wrong: 0 };
  if (correct) team.answerStats.correct += 1;
  else team.answerStats.wrong += 1;
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
  const control = state.round.questionControl;
  if (!control?.answerOpen || control.teamId !== teamId) {
    return { ok: false, error: "Người dẫn chưa mở quyền trả lời câu hỏi này." };
  }
  const spent = spendTurnEnergy(state, teamId);
  if (!spent.ok) return spent;
  recordAnswer(team, correct);
  const result = resolveMovement(state, team, teamId, pending.direction, {
    usedQuestion: true,
    correct,
    awardScore: true
  });

  const turnEnded = Boolean(result.event?.endsTurn);
  const energyEnded = spent.energy.remaining <= 0;
  let roundComplete = false;

  state.round.questionControl = {
    ...control,
    answered: true,
    answerIndex,
    correct,
    result,
    reveal: false
  };

  if (turnEnded || energyEnded) {
    pending.answered = true;
    pending.result = result;

    roundComplete = finishTeamTurn(state, teamId, result);
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
