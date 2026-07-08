import { EVENTS } from "../../shared/constants.js";
import { submitAuctionBid } from "../auctionLogic.js";
import { gameState } from "../gameState.js";
import { emitAllStates, emitPlayerError } from "../socketState.js";

export const registerAuctionHandlers = (io, socket) => {
  socket.on(EVENTS.AUCTION_BID, (payload = {}) => {
    const result = submitAuctionBid(gameState, socket.data.teamId, payload);

    if (!result.ok) {
      emitPlayerError(socket, result.error);
      return;
    }

    if (result.resolved) io.emit(EVENTS.AUCTION_RESULT, result.result);
    emitAllStates(io);
  });
};
