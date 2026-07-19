import { EVENTS } from "../../shared/constants.js";
import { gameState } from "../gameState.js";
import { useSupportItem } from "../supportLogic.js";
import { emitAllStates, emitPlayerError } from "../socketState.js";

export const registerSupportHandlers = (io, socket) => {
  socket.on(EVENTS.SUPPORT_USE, (payload = {}) => {
    const result = useSupportItem(gameState, socket.data.teamId, payload);

    if (!result.ok) {
      emitPlayerError(socket, result.error);
      return;
    }

    io.emit(EVENTS.SUPPORT_RESULT, result.result);
    emitAllStates(io);
  });
};
