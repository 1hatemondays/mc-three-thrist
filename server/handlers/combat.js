import { EVENTS } from "../../shared/constants.js";
import { submitCombatBet } from "../combatLogic.js";
import { gameState } from "../gameState.js";
import { emitAllStates, emitPlayerError } from "../socketState.js";

export const registerCombatHandlers = (io, socket) => {
  socket.on(EVENTS.COMBAT_BET, (payload = {}) => {
    const result = submitCombatBet(gameState, socket.data.teamId, payload);

    if (!result.ok) {
      emitPlayerError(socket, result.error);
      return;
    }

    if (result.resolved) io.emit(EVENTS.COMBAT_RESULT, result.result);
    emitAllStates(io);
  });
};
