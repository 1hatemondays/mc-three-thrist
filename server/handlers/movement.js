import { EVENTS } from "../../shared/constants.js";

export const registerMovementHandlers = (_io, socket) => {
  socket.on(EVENTS.MOVE_CHOOSE, (_payload) => {
    // TODO: validate direction, check hidden walls server-side, choose a question, and emit round:question.
  });

  socket.on(EVENTS.QUESTION_ANSWER, (_payload) => {
    // TODO: grade answer server-side, update position/score only when movement and answer are valid.
  });
};
