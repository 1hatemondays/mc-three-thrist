export const EVENTS = {
  TEAM_JOIN: "team:join",
  SETUP_SUBMIT_MAZE: "setup:submitMaze",
  SETUP_SET_TEAM_COUNT: "setup:setTeamCount",
  SETUP_START_GAME: "setup:startGame",
  MOVE_CHOOSE: "move:choose",
  QUESTION_ANSWER: "question:answer",
  AUCTION_BID: "auction:bid",
  COMBAT_BET: "combat:bet",
  GAME_STATE: "game:state",
  ROUND_QUESTION: "round:question",
  ROUND_RESULT: "round:result",
  AUCTION_RESULT: "auction:result",
  COMBAT_RESULT: "combat:result",
  GAME_OVER: "game:over"
};

export const ROOMS = {
  HOSTS: "hosts",
  team: (teamId) => `team:${teamId}`
};

export const ROUND_PHASES = {
  MOVEMENT: "movement",
  AUCTION: "auction",
  COMBAT: "combat"
};

export const DIRECTIONS = {
  UP: "up",
  RIGHT: "right",
  DOWN: "down",
  LEFT: "left"
};

export const MOVE_SCORE = 10;
