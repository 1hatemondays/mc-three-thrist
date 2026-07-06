import { EVENTS } from "../../shared/constants.js";

export const registerSetupHandlers = (_io, socket) => {
  socket.on(EVENTS.SETUP_SUBMIT_MAZE, (_payload) => {
    // TODO: validate wall count/start/end points, assign submitted maze to an opponent, then emit filtered state.
  });
};
