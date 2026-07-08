import { DIRECTIONS, MOVE_SCORE, ROUND_PHASES } from "../shared/constants.js";
import { hasWall } from "../shared/maze.js";

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

  if (!isSetupReady(state)) {
    return { ok: false, error: "Phần di chuyển bắt đầu sau khi host bấm Bắt đầu." };
  }

  if (state.round.phase !== ROUND_PHASES.MOVEMENT) {
    return { ok: false, error: "Hiện chưa mở phần di chuyển." };
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

const allTeamsDone = (state) =>
  state.teams.every((team) => state.round.pendingAnswers[team.id]?.answered);

export const answerQuestion = (state, teamId, payload) => {
  const team = findTeam(state, teamId);
  if (!team) return { ok: false, error: "Hãy vào đội trước khi trả lời." };

  if (state.round.phase !== ROUND_PHASES.MOVEMENT) {
    return { ok: false, error: "Hiện không có câu hỏi di chuyển nào đang mở." };
  }

  const pending = state.round.pendingAnswers[teamId];
  if (!pending) return { ok: false, error: "Hãy chọn hướng trước khi trả lời." };
  if (pending.answered) return { ok: false, error: "Câu hỏi này đã được trả lời." };

  const answerIndex = Number(payload?.answerIndex);
  if (!Number.isInteger(answerIndex)) {
    return { ok: false, error: "Chỉ số đáp án phải là số nguyên." };
  }

  const movement = previewMove(team, state.config.boardSize, pending.direction);
  const correct = answerIndex === pending.question.correctIndex;
  const success = correct && !movement.blocked;

  if (success) {
    team.position = movement.newPosition;
    team.score += MOVE_SCORE;
    addDiscoveredCell(team, movement.newPosition);
  }

  const result = {
    teamId,
    direction: pending.direction,
    correct,
    blocked: movement.blocked,
    blockedReason: movement.reason,
    success,
    newPosition: team.position,
    scoreDelta: success ? MOVE_SCORE : 0
  };

  pending.answered = true;
  pending.result = result;

  if (allTeamsDone(state)) {
    state.round.phase = ROUND_PHASES.AUCTION;
  }

  return {
    ok: true,
    result,
    roundComplete: state.round.phase === ROUND_PHASES.AUCTION
  };
};
