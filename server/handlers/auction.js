import { EVENTS } from "../../shared/constants.js";

export const registerAuctionHandlers = (_io, socket) => {
  socket.on(EVENTS.AUCTION_BID, (_payload) => {
    // TODO: collect sealed bids without broadcasting amounts, resolve winners after all teams bid or timer ends.
  });
};
