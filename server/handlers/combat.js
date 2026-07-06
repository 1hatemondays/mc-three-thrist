import { EVENTS } from "../../shared/constants.js";

export const registerCombatHandlers = (_io, socket) => {
  socket.on(EVENTS.COMBAT_BET, (_payload) => {
    // TODO: validate combat bet, resolve opponent betting result, then apply HP/turn effects server-side.
  });
};
