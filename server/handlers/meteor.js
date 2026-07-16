import { EVENTS } from "../../shared/constants.js";
import { gameState } from "../gameState.js";
import { submitMeteorAnswer, submitMeteorBuzz } from "../meteorLogic.js";
import { emitAllStates, emitPlayerError } from "../socketState.js";

export const registerMeteorHandlers = (io, socket) => {
  socket.on(EVENTS.METEOR_BUZZ, () => {
    const result = submitMeteorBuzz(gameState, socket.data.teamId);
    if (!result.ok) {
      emitPlayerError(socket, result.error);
      return;
    }
    emitAllStates(io);
  });

  socket.on(EVENTS.METEOR_ANSWER, (payload = {}) => {
    const result = submitMeteorAnswer(gameState, socket.data.teamId, payload);
    if (!result.ok) {
      emitPlayerError(socket, result.error);
      return;
    }
    emitAllStates(io);
  });
};
