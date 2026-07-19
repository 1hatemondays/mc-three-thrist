import { ROUND_PHASES } from "../shared/constants.js";

const answerStatsFor = (team) => ({
  correctAnswers: team.answerStats?.correct || 0,
  wrongAnswers: team.answerStats?.wrong || 0
});

const mapPoint = (point) => (point ? { x: point.x, y: point.y } : null);
const mapWall = (wall) => ({ x: wall.x, y: wall.y, side: wall.side });

const exploredCountFor = (team) => team.discoveredCells?.length || 0;

const rankingEntry = (team, placement, reachedEnd) => ({
  placement,
  teamId: team.id,
  teamName: team.name,
  score: team.score,
  hp: team.hp,
  exploredCount: exploredCountFor(team),
  ...answerStatsFor(team),
  reachedEnd
});

const teamSummary = (team, placement, reachedEnd) => ({
  ...rankingEntry(team, placement, reachedEnd),
  position: mapPoint(team.position),
  startPoint: mapPoint(team.startPoint),
  endPoint: mapPoint(team.endPoint),
  walls: (team.walls || []).map(mapWall),
  discoveredCells: (team.discoveredCells || []).map(mapPoint),
  revealedWalls: (team.revealedWalls || []).map(mapWall)
});

export const isGameOver = (state) => Boolean(state?.gameOver);

export const buildGameOver = (state, winnerId) => {
  const winner = state.teams.find((team) => team.id === winnerId);
  if (!winner) return null;

  const others = state.teams
    .filter((team) => team.id !== winnerId)
    .sort(
      (a, b) =>
        b.score - a.score ||
        exploredCountFor(b) - exploredCountFor(a) ||
        b.hp - a.hp ||
        a.name.localeCompare(b.name)
    );
  const rankedTeams = [winner, ...others];

  return {
    stage: "stats",
    winnerId: winner.id,
    winnerName: winner.name,
    reason: "reached-end",
    rankings: rankedTeams.map((team, index) => rankingEntry(team, index + 1, team.id === winner.id)),
    summaries: rankedTeams.map((team, index) => teamSummary(team, index + 1, team.id === winner.id))
  };
};

export const getPlayerGameOverState = (gameOver, teamId) => {
  if (!gameOver) return null;
  const { summaries, ...publicGameOver } = gameOver;
  return {
    ...publicGameOver,
    summary: summaries?.find((summary) => summary.teamId === teamId) || null
  };
};

export const finishGame = (state, winnerId) => {
  if (state.gameOver) return state.gameOver;

  const gameOver = buildGameOver(state, winnerId);
  if (!gameOver) return null;

  state.gameOver = gameOver;
  state.round.phase = ROUND_PHASES.GAME_OVER;
  state.round.activeTeamId = null;
  state.round.currentQuestion = null;
  state.round.pendingAnswers = {};
  state.round.pendingEvents = {};
  return gameOver;
};

export const showGameOverLeaderboard = (state) => {
  if (!state.gameOver) return { ok: false, error: "Trò chơi chưa kết thúc." };
  state.gameOver.stage = "leaderboard";
  return { ok: true, gameOver: state.gameOver };
};

export const finishGameIfNeeded = (state, preferredWinnerId) => {
  if (state.gameOver) return state.gameOver;
  const reached = state.teams.filter((team) =>
    team.endPoint && team.position.x === team.endPoint.x && team.position.y === team.endPoint.y
  );
  const winner = reached.find((team) => team.id === preferredWinnerId) || reached[0];
  return winner ? finishGame(state, winner.id) : null;
};
