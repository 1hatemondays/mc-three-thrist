import { EVENTS, ROOMS } from "../shared/constants.js";
import { gameState, getHostState, getPlayerState } from "./gameState.js";

export const emitAllStates = (io) => {
  io.to(ROOMS.HOSTS).emit(EVENTS.GAME_STATE, getHostState());

  for (const team of gameState.teams) {
    io.to(ROOMS.team(team.id)).emit(EVENTS.GAME_STATE, getPlayerState(team.id));
  }
};

export const emitHostError = (socket, message) => {
  socket.emit(EVENTS.GAME_STATE, {
    ...getHostState(),
    error: message
  });
};

export const emitPlayerError = (socket, message) => {
  const teamId = socket.data.teamId;
  socket.emit(EVENTS.GAME_STATE, {
    ...(teamId ? getPlayerState(teamId) : {}),
    error: message
  });
};

export const emitRoundResult = (io, result) => {
  io.to(ROOMS.HOSTS).emit(EVENTS.ROUND_RESULT, result);

  for (const team of gameState.teams) {
    io.to(ROOMS.team(team.id)).emit(EVENTS.ROUND_RESULT, result);
  }
};

export const emitGameOver = (io, gameOver) => {
  io.to(ROOMS.HOSTS).emit(EVENTS.GAME_OVER, gameOver);

  for (const team of gameState.teams) {
    io.to(ROOMS.team(team.id)).emit(EVENTS.GAME_OVER, gameOver);
  }
};
