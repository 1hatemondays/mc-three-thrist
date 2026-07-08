import { EVENTS } from "../../shared/constants.js";
import { gameState } from "../gameState.js";
import { resolvePendingEvent } from "../eventLogic.js";
import { emitAllStates, emitPlayerError } from "../socketState.js";

export const registerEventHandlers = (io, socket) => {
  socket.on(EVENTS.EVENT_RESOLVE, (payload = {}) => {
    const result = resolvePendingEvent(gameState, socket.data.teamId, payload);

    if (!result.ok) {
      emitPlayerError(socket, result.error);
      return;
    }

    emitAllStates(io);
  });
};
