import { EVENTS } from "../../shared/constants.js";
import { gameState } from "../gameState.js";
import { applyMazeSubmission } from "../setupLogic.js";
import { emitAllStates, emitPlayerError } from "../socketState.js";

export const registerSetupHandlers = (io, socket) => {
  socket.on(EVENTS.SETUP_SUBMIT_MAZE, (payload = {}) => {
    const result = applyMazeSubmission(gameState, socket.data.teamId, payload);

    if (!result.ok) {
      emitPlayerError(socket, result.error);
      return;
    }

    emitAllStates(io);
  });
};
