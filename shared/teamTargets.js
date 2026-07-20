export const getOpponentTeams = (teams = [], currentTeamId) => {
  const seen = new Set();

  return teams.reduce((opponents, team) => {
    const id = typeof team?.id === "string" ? team.id : "";
    if (!id || id === currentTeamId || seen.has(id)) return opponents;
    seen.add(id);
    opponents.push({ id, name: typeof team.name === "string" && team.name ? team.name : id });
    return opponents;
  }, []);
};
