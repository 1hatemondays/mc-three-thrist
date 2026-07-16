const rankingEntry = (team, placement, reachedEnd) => ({
  placement,
  teamId: team.id,
  teamName: team.name,
  score: team.score,
  hp: team.hp,
  reachedEnd
});

export const isGameOver = (state) => Boolean(state?.gameOver);

export const buildGameOver = (state, winnerId) => {
  const winner = state.teams.find((team) => team.id === winnerId);
  if (!winner) return null;

  const others = state.teams
    .filter((team) => team.id !== winnerId)
    .sort((a, b) => b.score - a.score || b.hp - a.hp || a.name.localeCompare(b.name));

  return {
    winnerId: winner.id,
    winnerName: winner.name,
    rankings: [
      rankingEntry(winner, 1, true),
      ...others.map((team, index) => rankingEntry(team, index + 2, false))
    ]
  };
};

export const finishGame = (state, winnerId) => {
  if (state.gameOver) return state.gameOver;

  const gameOver = buildGameOver(state, winnerId);
  if (!gameOver) return null;

  state.gameOver = gameOver;
  state.round.currentQuestion = null;
  state.round.pendingAnswers = {};
  state.round.pendingEvents = {};
  return gameOver;
};
