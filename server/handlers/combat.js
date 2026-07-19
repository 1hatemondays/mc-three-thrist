import { EVENTS } from "../../shared/constants.js";
import { resolveCombatTimeout, submitCombatBet } from "../combatLogic.js";
import { gameState } from "../gameState.js";
import { emitAllStates, emitPlayerError } from "../socketState.js";

let combatTimer = null;

export const scheduleCombatTimeout = (io) => {
  clearTimeout(combatTimer);
  const combat = gameState.round.combat;
  if (!combat?.deadline || combat.result) return;

  combatTimer = setTimeout(() => {
    const result = resolveCombatTimeout(gameState);
    if (!result) return;
    io.emit(EVENTS.COMBAT_RESULT, result);
    emitAllStates(io);
  }, Math.max(0, combat.deadline - Date.now() + 5));
};

export const registerCombatHandlers = (io, socket) => {
  socket.on(EVENTS.COMBAT_BET, (payload = {}) => {
    const result = submitCombatBet(gameState, socket.data.teamId, payload);

    if (!result.ok) {
      emitPlayerError(socket, result.error);
      return;
    }

    if (result.resolved) {
      clearTimeout(combatTimer);
      io.emit(EVENTS.COMBAT_RESULT, result.result);
    } else {
      scheduleCombatTimeout(io);
    }
    emitAllStates(io);
  });
};
