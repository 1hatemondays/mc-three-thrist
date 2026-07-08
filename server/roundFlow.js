import { ROUND_PHASES } from "../shared/constants.js";

export const makeAuctionState = () => ({ bids: {}, result: null });

export const ensureRoundCollections = (state) => {
  state.round.pendingEvents = state.round.pendingEvents || {};
  state.round.traps = state.round.traps || [];
  state.round.messages = state.round.messages || {};
  state.round.auction = state.round.auction || makeAuctionState();
};

export const addRoundMessage = (state, teamId, message) => {
  ensureRoundCollections(state);
  state.round.messages[teamId] = state.round.messages[teamId] || [];
  state.round.messages[teamId].unshift({
    id: Date.now() + ":" + state.round.messages[teamId].length,
    ...message
  });
  state.round.messages[teamId] = state.round.messages[teamId].slice(0, 5);
};

export const beginAuction = (state) => {
  ensureRoundCollections(state);
  state.round.phase = ROUND_PHASES.AUCTION;
  state.round.auction = makeAuctionState();
};

export const finishMovementRound = (state) => {
  ensureRoundCollections(state);
  state.round.roundNumber = (state.round.roundNumber || 1) + 1;
  state.round.pendingAnswers = {};
  state.round.currentQuestion = null;
  state.round.pendingEvents = {};
  beginAuction(state);
  return true;
};

export const maybeFinishMovementRound = (state) => {
  if (!state.teams.every((team) => state.round.pendingAnswers[team.id]?.answered)) return false;
  return finishMovementRound(state);
};
