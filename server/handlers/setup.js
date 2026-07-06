import { EVENTS, ROOMS } from "../../shared/constants.js";
import { gameState, getHostState, getPlayerState } from "../gameState.js";
import { applyMazeSubmission } from "../setupLogic.js";

const emitAllStates = (io) => {
  io.to(ROOMS.HOSTS).emit(EVENTS.GAME_STATE, getHostState());

  for (const team of gameState.teams) {
    io.to(ROOMS.team(team.id)).emit(EVENTS.GAME_STATE, getPlayerState(team.id));
  }
};

const emitPlayerError = (socket, message) => {
  const teamId = socket.data.teamId;
  socket.emit(EVENTS.GAME_STATE, {
    ...(teamId ? getPlayerState(teamId) : {}),
    error: message
  });
};

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
