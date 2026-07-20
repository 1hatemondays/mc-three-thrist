import { EVENTS } from "../../shared/constants.js";
import { gameState } from "../gameState.js";
import { resolveMeteorAnswerTimeout, submitMeteorAnswer, submitMeteorBuzz } from "../meteorLogic.js";
import { emitAllStates, emitPlayerError } from "../socketState.js";

let meteorAnswerTimer = null;

export const scheduleMeteorAnswerTimeout = (io) => {
  clearTimeout(meteorAnswerTimer);
  const meteor = gameState.round.meteorShower;
  if (!meteor?.buzzerTeamId || !meteor.answerDeadline || meteor.result) return;

  meteorAnswerTimer = setTimeout(() => {
    const result = resolveMeteorAnswerTimeout(gameState);
    if (!result) return;
    emitAllStates(io);
  }, Math.max(0, meteor.answerDeadline - Date.now() + 5));
};

export const registerMeteorHandlers = (io, socket) => {
  socket.on(EVENTS.METEOR_BUZZ, () => {
    const result = submitMeteorBuzz(gameState, socket.data.teamId);
    if (!result.ok) {
      emitPlayerError(socket, result.error);
      return;
    }
    scheduleMeteorAnswerTimeout(io);
    emitAllStates(io);
  });

  socket.on(EVENTS.METEOR_ANSWER, (payload = {}) => {
    const result = submitMeteorAnswer(gameState, socket.data.teamId, payload);
    if (!result.ok) {
      emitPlayerError(socket, result.error);
      return;
    }
    clearTimeout(meteorAnswerTimer);
    emitAllStates(io);
  });
};
