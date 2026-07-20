import { ROUND_PHASES } from "../shared/constants.js";
import { drawQuestions, questionBank } from "./questionBank.js";
import { addRoundMessage, maybeFinishMovementRound } from "./roundFlow.js";

const QUESTION_COUNT = 10;
const COUNTDOWN_MS = 3000;
const ANSWER_TIME_MS = 10000;
const WINNER_BONUS = 50;
const LOSER_HP_LOSS = 15;

const findTeam = (state, teamId) => state.teams.find((team) => team.id === teamId);
const publicQuestion = (question) => {
  if (!question) return null;
  const { correctIndex, ...safeQuestion } = question;
  return safeQuestion;
};

const recordAnswer = (team, correct) => {
  team.answerStats = team.answerStats || { correct: 0, wrong: 0 };
  if (correct) team.answerStats.correct += 1;
  else team.answerStats.wrong += 1;
};

export const startMeteorShower = (
  state,
  activatorId,
  questions = questionBank,
  random = Math.random,
  now = Date.now()
) => {
  if (state.round.phase !== ROUND_PHASES.MOVEMENT) {
    return { ok: false, error: "\u0110\u1ea5u tr\u00ed ch\u1ec9 d\u00f9ng \u0111\u01b0\u1ee3c trong pha di chuy\u1ec3n." };
  }
  if (!findTeam(state, activatorId)) {
    return { ok: false, error: "Kh\u00f4ng t\u00ecm th\u1ea5y \u0111\u1ed9i k\u00edch ho\u1ea1t." };
  }
  if (!Array.isArray(questions) || questions.length < QUESTION_COUNT) {
    return { ok: false, error: "C\u1ea7n \u00edt nh\u1ea5t 10 c\u00e2u h\u1ecfi \u0111\u1ec3 b\u1eaft \u0111\u1ea7u \u0110\u1ea5u tr\u00ed." };
  }

  state.round.phase = ROUND_PHASES.METEOR_SHOWER;
  state.round.meteorShower = {
    activatorId,
    questions: drawQuestions(state, "normal", questions, QUESTION_COUNT, random),
    questionIndex: 0,
    totalQuestions: QUESTION_COUNT,
    countdownEndsAt: now + COUNTDOWN_MS,
    answerDeadline: 0,
    buzzerTeamId: null,
    scores: Object.fromEntries(state.teams.map((team) => [team.id, 0])),
    lastAnswer: null,
    result: null
  };

  for (const team of state.teams) {
    addRoundMessage(state, team.id, {
      title: "\u0110\u1ea5u tr\u00ed",
      text: "10 c\u00e2u h\u1ecfi tranh quy\u1ec1n. Ch\u1edd 3-2-1 r\u1ed3i nh\u1ea5n ph\u00edm c\u00e1ch."
    });
  }
  return { ok: true };
};

export const getMeteorShowerState = (state, teamId = null, now = Date.now()) => {
  const meteor = state.round.meteorShower;
  if (!meteor) return null;
  const active = state.round.phase === ROUND_PHASES.METEOR_SHOWER;
  const buzzer = findTeam(state, meteor.buzzerTeamId);

  return {
    active,
    activatorId: meteor.activatorId,
    questionNumber: Math.min(meteor.questionIndex + 1, meteor.totalQuestions),
    totalQuestions: meteor.totalQuestions,
    question: active ? publicQuestion(meteor.questions[meteor.questionIndex]) : null,
    countdownMs: active ? Math.max(0, meteor.countdownEndsAt - now) : 0,
    answerCountdownMs: active && meteor.buzzerTeamId ? Math.max(0, (meteor.answerDeadline || 0) - now) : 0,
    answerTimeMs: ANSWER_TIME_MS,
    buzzerTeamId: meteor.buzzerTeamId,
    buzzerTeamName: buzzer?.name || null,
    canAnswer: Boolean(active && teamId && meteor.buzzerTeamId === teamId),
    scores: state.teams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      correctCount: meteor.scores[team.id] || 0
    })),
    lastAnswer: meteor.lastAnswer,
    result: meteor.result
  };
};

export const submitMeteorBuzz = (state, teamId, now = Date.now()) => {
  const meteor = state.round.meteorShower;
  if (state.round.phase !== ROUND_PHASES.METEOR_SHOWER || !meteor) {
    return { ok: false, error: "Hi\u1ec7n kh\u00f4ng c\u00f3 \u0110\u1ea5u tr\u00ed." };
  }
  if (!findTeam(state, teamId)) return { ok: false, error: "\u0110\u1ed9i kh\u00f4ng h\u1ee3p l\u1ec7." };
  if (now < meteor.countdownEndsAt) return { ok: false, error: "Ch\u01b0a h\u1ebft hi\u1ec7u l\u1ec7nh 3-2-1." };
  if (meteor.buzzerTeamId) return { ok: false, error: "\u0110\u00e3 c\u00f3 \u0111\u1ed9i gi\u00e0nh quy\u1ec1n tr\u1ea3 l\u1eddi." };

  meteor.buzzerTeamId = teamId;
  meteor.answerDeadline = now + ANSWER_TIME_MS;
  return { ok: true };
};

const finishMeteorShower = (state, now) => {
  const meteor = state.round.meteorShower;
  const orderedIds = [...new Set([...(state.round.turnOrder || []), ...state.teams.map((team) => team.id)])];
  const winnerId = orderedIds.reduce(
    (bestId, teamId) => (meteor.scores[teamId] > meteor.scores[bestId] ? teamId : bestId),
    orderedIds[0]
  );
  const winner = findTeam(state, winnerId);
  winner.score += WINNER_BONUS;

  const losers = state.teams.filter((team) => team.id !== winnerId).map((team) => {
    team.hp = Math.max(0, team.hp - LOSER_HP_LOSS);
    team.effects = { ...(team.effects || {}), skipTurns: (team.effects?.skipTurns || 0) + 1 };
    addRoundMessage(state, team.id, {
      title: "Thua \u0110\u1ea5u tr\u00ed",
      text: "M\u1ea5t 15 m\u00e1u v\u00e0 1 l\u01b0\u1ee3t."
    });
    return { teamId: team.id, teamName: team.name };
  });
  addRoundMessage(state, winnerId, { title: "Th\u1eafng \u0110\u1ea5u tr\u00ed", text: "Nh\u1eadn th\u01b0\u1edfng 50 \u0111i\u1ec3m." });

  meteor.questions = [];
  meteor.buzzerTeamId = null;
  meteor.answerDeadline = 0;
  meteor.countdownEndsAt = 0;
  meteor.result = {
    winnerId,
    winnerName: winner.name,
    bonus: WINNER_BONUS,
    hpLoss: LOSER_HP_LOSS,
    losers,
    completedAt: now
  };
  state.round.phase = ROUND_PHASES.MOVEMENT;
  maybeFinishMovementRound(state);
  return meteor.result;
};

const resolveMeteorAnswer = (state, teamId, correct, now, reason = "answer") => {
  const meteor = state.round.meteorShower;
  if (correct) meteor.scores[teamId] += 1;
  const team = findTeam(state, teamId);
  recordAnswer(team, correct);
  meteor.lastAnswer = { teamId, teamName: team.name, correct, timeout: reason === "timeout" };

  if (meteor.questionIndex + 1 === meteor.totalQuestions) {
    return { ok: true, completed: true, result: finishMeteorShower(state, now), timeout: reason === "timeout" };
  }

  meteor.questionIndex += 1;
  meteor.countdownEndsAt = now + COUNTDOWN_MS;
  meteor.answerDeadline = 0;
  meteor.buzzerTeamId = null;
  return { ok: true, completed: false, correct, timeout: reason === "timeout" };
};

export const submitMeteorAnswer = (state, teamId, payload = {}, now = Date.now()) => {
  const meteor = state.round.meteorShower;
  if (state.round.phase !== ROUND_PHASES.METEOR_SHOWER || !meteor) {
    return { ok: false, error: "Hi\u1ec7n kh\u00f4ng c\u00f3 c\u00e2u h\u1ecfi \u0110\u1ea5u tr\u00ed." };
  }
  if (meteor.buzzerTeamId !== teamId) return { ok: false, error: "\u0110\u1ed9i ch\u01b0a gi\u00e0nh quy\u1ec1n tr\u1ea3 l\u1eddi." };

  const question = meteor.questions[meteor.questionIndex];
  if (meteor.answerDeadline && now >= meteor.answerDeadline) {
    return resolveMeteorAnswer(state, teamId, false, now, "timeout");
  }

  const answerIndex = Number(payload.answerIndex);
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= question.choices.length) {
    return { ok: false, error: "\u0110\u00e1p \u00e1n kh\u00f4ng h\u1ee3p l\u1ec7." };
  }

  const correct = answerIndex === question.correctIndex;
  return resolveMeteorAnswer(state, teamId, correct, now);
};

export const resolveMeteorAnswerTimeout = (state, now = Date.now()) => {
  const meteor = state.round.meteorShower;
  if (state.round.phase !== ROUND_PHASES.METEOR_SHOWER || !meteor) return null;
  if (!meteor.buzzerTeamId || !meteor.answerDeadline || now < meteor.answerDeadline) return null;
  return resolveMeteorAnswer(state, meteor.buzzerTeamId, false, now, "timeout");
};
