import { EVENTS, ROUND_PHASES } from "../../shared/constants.js";
import { gameState } from "../gameState.js";
import { resolveBombAnswer, resolveBombTimeout, resolvePendingEvent } from "../eventLogic.js";
import { emitAllStates, emitPlayerError } from "../socketState.js";

let bombTimer = null;

export const scheduleBombTimeout = (io) => {
  clearTimeout(bombTimer);
  const bomb = gameState.round.bomb;
  if (gameState.round.phase !== ROUND_PHASES.BOMB || !bomb?.deadline) return;

  bombTimer = setTimeout(() => {
    const result = resolveBombTimeout(gameState);
    if (!result) {
      scheduleBombTimeout(io);
      return;
    }
    emitAllStates(io);
  }, Math.max(0, bomb.deadline - Date.now() + 5));
};

export const registerEventHandlers = (io, socket) => {
  socket.on(EVENTS.EVENT_RESOLVE, (payload = {}) => {
    const result = gameState.round.phase === ROUND_PHASES.BOMB
      ? resolveBombAnswer(gameState, socket.data.teamId, payload)
      : resolvePendingEvent(gameState, socket.data.teamId, payload);

    if (!result.ok) {
      emitPlayerError(socket, result.error);
      return;
    }

    emitAllStates(io);
    scheduleBombTimeout(io);
  });
};
