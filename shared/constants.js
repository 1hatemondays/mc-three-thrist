export const EVENTS = {
  TEAM_JOIN: "team:join",
  SETUP_SUBMIT_MAZE: "setup:submitMaze",
  SETUP_UNREADY_MAZE: "setup:unreadyMaze",
  SETUP_SET_TEAM_COUNT: "setup:setTeamCount",
  SETUP_START_GAME: "setup:startGame",
  SETUP_SET_TURN_ORDER: "setup:setTurnOrder",
  MOVE_CHOOSE: "move:choose",
  QUESTION_OPEN: "question:open",
  QUESTION_ANSWER: "question:answer",
  QUESTION_REVEAL: "question:reveal",
  AUCTION_BID: "auction:bid",
  COMBAT_BET: "combat:bet",
  EVENT_RESOLVE: "event:resolve",
  SUPPORT_USE: "support:use",
  SUPPORT_RESULT: "support:result",
  METEOR_BUZZ: "meteor:buzz",
  METEOR_ANSWER: "meteor:answer",
  GAME_OVER_SHOW_LEADERBOARD: "gameOver:showLeaderboard",
  GAME_RESTART: "game:restart",
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
  COMBAT: "combat",
  GAME_OVER: "gameOver",
  METEOR_SHOWER: "meteorShower",
  BOMB: "bomb"
};

export const DIRECTIONS = {
  UP: "up",
  RIGHT: "right",
  DOWN: "down",
  LEFT: "left"
};

export const MOVE_SCORE = 10;
export const TURN_ENERGY_MAX = 3;
