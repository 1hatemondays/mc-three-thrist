import { EVENTS } from "../../shared/constants.js";
import { gameState, resetGameState } from "../gameState.js";
import { showGameOverLeaderboard } from "../gameOver.js";
import { applyMazeSubmission, configureTeamCount, retractMazeSubmission, setTurnOrder, startGame } from "../setupLogic.js";
import { emitAllStates, emitHostError, emitPlayerError } from "../socketState.js";

export const registerSetupHandlers = (io, socket) => {
  socket.on(EVENTS.SETUP_SET_TEAM_COUNT, (payload = {}) => {
    if (socket.data.role !== "host") return;

    const result = configureTeamCount(gameState, payload);

    if (!result.ok) {
      emitHostError(socket, result.error);
      return;
    }

    emitAllStates(io);
  });

  socket.on(EVENTS.SETUP_SET_TURN_ORDER, (payload = {}) => {
    if (socket.data.role !== "host") return;

    const result = setTurnOrder(gameState, payload);

    if (!result.ok) {
      emitHostError(socket, result.error);
      return;
    }

    emitAllStates(io);
  });

  socket.on(EVENTS.SETUP_START_GAME, () => {
    if (socket.data.role !== "host") return;

    const result = startGame(gameState);

    if (!result.ok) {
      emitHostError(socket, result.error);
      return;
    }

    emitAllStates(io);
  });

  socket.on(EVENTS.GAME_OVER_SHOW_LEADERBOARD, () => {
    if (socket.data.role !== "host") return;

    const result = showGameOverLeaderboard(gameState);

    if (!result.ok) {
      emitHostError(socket, result.error);
      return;
    }

    emitAllStates(io);
  });

  socket.on(EVENTS.GAME_RESTART, () => {
    if (socket.data.role !== "host") return;

    resetGameState();
    io.emit(EVENTS.GAME_RESTART);
    emitAllStates(io);
  });

  socket.on(EVENTS.SETUP_SUBMIT_MAZE, (payload = {}) => {
    const result = applyMazeSubmission(gameState, socket.data.teamId, payload);

    if (!result.ok) {
      emitPlayerError(socket, result.error);
      return;
    }

    emitAllStates(io);
  });

  socket.on(EVENTS.SETUP_UNREADY_MAZE, () => {
    const result = retractMazeSubmission(gameState, socket.data.teamId);

    if (!result.ok) {
      emitPlayerError(socket, result.error);
      return;
    }

    emitAllStates(io);
  });
};
