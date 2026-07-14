import { getPlayerRoundState } from "./movementLogic.js";
import { getHostAuctionState, getPlayerAuctionState } from "./auctionLogic.js";
import { getHostCombatState, getPlayerCombatState } from "./combatLogic.js";
import { getHostSetupPreviewMap, getSetupSummary } from "./setupLogic.js";

const cleanTeamName = (teamName) => String(teamName || "").trim().replace(/\s+/g, " ").slice(0, 40);

const teamNameFromId = (teamId, index) => {
  const match = /^team(\d+)$/i.exec(teamId);
  if (match) return `Đội ${match[1]}`;
  if (index >= 0) return `Đội ${index + 1}`;
  return teamId.toUpperCase();
};

const makeTeam = (teamId, index, teamName) => ({
  id: teamId,
  name: cleanTeamName(teamName) || teamNameFromId(teamId, index),
  hp: 100,
  score: 0,
  position: { x: 0, y: 0 },
  startPoint: null,
  endPoint: null,
  walls: [],
  discoveredCells: [{ x: 0, y: 0 }],
  supportItems: [],
  effects: {}
});

export const gameState = {
  config: {
    teamCount: 0,
    boardSize: 6
  },
  teams: [],
  setup: {
    submissions: {},
    complete: false,
    started: false
  },
  round: {
    roundNumber: 1,
    phase: "movement",
    pendingAnswers: {},
    currentQuestion: null,
    eventTiles: [],
    pendingEvents: {}
  }
};

export const findTeam = (teamId) => gameState.teams.find((team) => team.id === teamId);

export const normalizeTeamId = (teamId) => String(teamId || "").replace(/\s+/g, "").toLowerCase();

export const ensureTeam = (state, teamId, teamName) => {
  const existing = state.teams.find((team) => team.id === teamId);
  if (existing) {
    const nextName = cleanTeamName(teamName);
    const setupLocked = state.setup?.started || Object.keys(state.setup?.submissions || {}).length > 0;
    if (nextName && !setupLocked) existing.name = nextName;
    return existing;
  }

  const team = makeTeam(teamId, state.teams.length, teamName);
  state.teams.push(team);
  state.config.teamCount = state.teams.length;
  return team;
};

export const getHostState = () => ({
  ...gameState,
  round: {
    ...gameState.round,
    auction: getHostAuctionState(gameState),
    combat: getHostCombatState(gameState)
  },
  setup: {
    ...gameState.setup,
    previews: getHostSetupPreviewMap(gameState)
  }
});

export const getPlayerState = (teamId) => {
  const team = findTeam(teamId);
  if (!team) return null;
  return {
    config: gameState.config,
    team: {
      id: team.id,
      name: team.name,
      hp: team.hp,
      score: team.score,
      position: team.position,
      startPoint: team.startPoint,
      discoveredCells: team.discoveredCells,
      supportItems: team.supportItems
    },
    leaderboard: gameState.teams.map(({ id, name, hp, score }) => ({ id, name, hp, score })),
    round: {
      ...getPlayerRoundState(gameState.round, teamId),
      auction: getPlayerAuctionState(gameState, teamId),
      combat: getPlayerCombatState(gameState, teamId),
      messages: gameState.round.messages?.[teamId] || []
    },
    setup: getSetupSummary(gameState, teamId)
  };
};
