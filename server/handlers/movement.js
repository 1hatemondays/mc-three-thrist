import { EVENTS } from "../../shared/constants.js";
import { gameState } from "../gameState.js";
import { answerQuestion, chooseMoveQuestion, openQuestionForAnswer, revealQuestionExplanation, stripQuestionAnswer } from "../movementLogic.js";
import { scheduleBombTimeout } from "./event.js";
import { questionBank } from "../questionBank.js";
import { emitAllStates, emitGameOver, emitPlayerError, emitRoundResult } from "../socketState.js";

export const registerMovementHandlers = (io, socket) => {
  socket.on(EVENTS.MOVE_CHOOSE, (payload = {}) => {
    const result = chooseMoveQuestion(gameState, socket.data.teamId, payload, questionBank);

    if (!result.ok) {
      emitPlayerError(socket, result.error);
      return;
    }

    if (result.instant) {
      emitRoundResult(io, result.result);
      scheduleBombTimeout(io);
      emitAllStates(io);
      if (result.result.gameOver) emitGameOver(io, result.result.gameOver);
      return;
    }

    emitAllStates(io);
  });

  socket.on(EVENTS.QUESTION_OPEN, () => {
    if (socket.data.role !== "host") return;
    const result = openQuestionForAnswer(gameState);
    if (!result.ok) return;
    emitAllStates(io);
  });

  socket.on(EVENTS.QUESTION_REVEAL, () => {
    if (socket.data.role !== "host") return;
    const result = revealQuestionExplanation(gameState);
    if (!result.ok) return;
    emitAllStates(io);
  });

  socket.on(EVENTS.QUESTION_ANSWER, (payload = {}) => {
    const result = answerQuestion(gameState, socket.data.teamId, payload);

    if (!result.ok) {
      emitPlayerError(socket, result.error);
      return;
    }

    emitRoundResult(io, result.result);
    emitAllStates(io);
    scheduleBombTimeout(io);
    if (result.result.gameOver) emitGameOver(io, result.result.gameOver);
  });
};
