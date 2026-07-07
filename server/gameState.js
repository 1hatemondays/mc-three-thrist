import { config } from "./config.js";
import { getHostSetupPreviewMap, getSetupSummary } from "./setupLogic.js";

const makeTeam = (index) => ({
  id: `team${index + 1}`,
  name: `Team ${index + 1}`,
  hp: 100,
  score: 0,
  position: { x: 0, y: 0 },
  startPoint: null,
  endPoint: null,
  walls: [],
  discoveredCells: [{ x: 0, y: 0 }],
  supportItems: []
});

export const gameState = {
  config: {
    teamCount: config.teamCount,
    boardSize: 6
  },
  teams: Array.from({ length: config.teamCount }, (_, index) => makeTeam(index)),
  setup: {
    submissions: {},
    complete: false
  },
  round: {
    roundNumber: 1,
    phase: "movement",
    pendingAnswers: {},
    currentQuestion: null
  }
};

export const findTeam = (teamId) => gameState.teams.find((team) => team.id === teamId);

export const normalizeTeamId = (teamId) => String(teamId || "").replace(/\s+/g, "").toLowerCase();

export const getHostState = () => ({
  ...gameState,
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
    round: gameState.round,
    setup: getSetupSummary(gameState, teamId)
  };
};
