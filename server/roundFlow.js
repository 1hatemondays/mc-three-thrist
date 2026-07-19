import { ROUND_PHASES, TURN_ENERGY_MAX } from "../shared/constants.js";

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

const turnOrderOf = (state) =>
  state.round.turnOrder?.length ? state.round.turnOrder : state.teams.map((team) => team.id);

export const setActiveTurn = (state, teamId) => {
  state.round.activeTeamId = teamId || null;
  state.round.questionControl = null;
  state.round.turnEnergy = teamId
    ? { teamId, remaining: TURN_ENERGY_MAX, max: TURN_ENERGY_MAX }
    : null;
};

export const ensureTurnEnergy = (state, teamId) => {
  if (!teamId) return null;
  if (state.round.turnEnergy?.teamId !== teamId) {
    state.round.turnEnergy = { teamId, remaining: TURN_ENERGY_MAX, max: TURN_ENERGY_MAX };
  }
  return state.round.turnEnergy;
};

export const spendTurnEnergy = (state, teamId, amount = 1) => {
  const energy = ensureTurnEnergy(state, teamId);
  if (!energy) return { ok: false, error: "Không có lượt đang hoạt động." };
  if (energy.remaining < amount) return { ok: false, error: "Đội đã hết năng lượng cho lượt này." };
  energy.remaining -= amount;
  return { ok: true, energy };
};

export const finishTeamTurn = (state, teamId, result = null) => {
  const team = state.teams.find((item) => item.id === teamId);
  state.round.pendingAnswers[teamId] = {
    teamId,
    direction: null,
    question: null,
    answered: true,
    result: result || { teamId, success: false, newPosition: team?.position || null, scoreDelta: 0 }
  };
  return maybeFinishMovementRound(state);
};

const consumeSkippedTurns = (state) => {
  for (const teamId of turnOrderOf(state)) {
    if (state.round.pendingAnswers[teamId]?.answered) continue;
    const team = state.teams.find((item) => item.id === teamId);
    const skipTurns = Number(team?.effects?.skipTurns) || 0;
    if (!team || skipTurns < 1) continue;

    team.effects.skipTurns = skipTurns - 1;
    state.round.pendingAnswers[teamId] = {
      teamId,
      direction: null,
      question: null,
      answered: true,
      result: { teamId, success: false, skipped: true, newPosition: team.position, scoreDelta: 0 }
    };
    addRoundMessage(state, teamId, { title: "M\u1ea5t l\u01b0\u1ee3t", text: "H\u00ecnh ph\u1ea1t \u0110\u1ea5u tr\u00ed \u0111\u00e3 \u0111\u01b0\u1ee3c th\u1ef1c hi\u1ec7n." });
  }
};

export const beginAuction = (state) => {
  ensureRoundCollections(state);
  state.round.phase = ROUND_PHASES.AUCTION;
  setActiveTurn(state, null);
  state.round.auction = makeAuctionState();
};

export const finishMovementRound = (state) => {
  ensureRoundCollections(state);
  const completedRound = state.round.roundNumber || 1;
  state.round.pendingAnswers = {};
  state.round.currentQuestion = null;
  state.round.pendingEvents = {};
  if (completedRound % 2 === 0) {
    beginAuction(state);
  } else {
    state.round.roundNumber = completedRound + 1;
    state.round.phase = ROUND_PHASES.MOVEMENT;
    setActiveTurn(state, turnOrderOf(state)[0] || null);
    maybeFinishMovementRound(state);
  }
  return true;
};

export const maybeFinishMovementRound = (state) => {
  consumeSkippedTurns(state);
  const nextTeamId = turnOrderOf(state).find(
    (teamId) => !state.round.pendingAnswers[teamId]?.answered
  );
  if (nextTeamId) {
    if (state.round.activeTeamId !== nextTeamId) setActiveTurn(state, nextTeamId);
    else ensureTurnEnergy(state, nextTeamId);
    return false;
  }

  return finishMovementRound(state);
};
