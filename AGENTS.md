# AGENTS.md — Web Game Show "Maze of Knowledge"

This document describes the whole project so an AI coding assistant (Claude Code, Cursor, etc.) has full context before generating any code. This is a course project for MLN122 (Marxist-Leninist Political Economy), meant to be played live in a classroom.

## 1. Overview

- **Name**: Maze of Knowledge (Mê Cung Tri Thức)
- **Genre**: Realtime team-based educational web game show, played live in class.
- **Number of teams**: Configurable, not fixed. The class is split into N teams depending on class size (the proposal used 4 as an example, but the team count must be a setting, not hardcoded).
- **Display setup**: One large shared TV screen for the whole class (host view), while each team uses its own phone/laptop to play (player view).
- **Network**: Runs on the classroom's LAN (server runs on one laptop, all devices join the same wifi). No need to deploy publicly, no domain/HTTPS required, no persistent database — state only needs to exist for the duration of one session.

## 2. Technical architecture

Three independent components communicating over Socket.io (realtime WebSocket):

```
[Player app] <--socket--> [Server: Node.js + Express + Socket.io] <--socket--> [Host app]
  (N teams)                 (single source of truth, holds all state)          (TV, display only)
```

- **The server is the sole authority.** All game logic (validating moves, grading answers, computing score/HP, running auctions and combat) runs on the server; client input is never trusted directly.
- **Each team's maze must stay hidden from its opponent** until the opponent actually reaches that cell. Never send an opponent's full maze to the client in any form (including hiding it via CSS) — only send the portion that has been "discovered" so far.
- **Auctions must be sealed-bid**: the server only broadcasts results after every team has submitted a bid (or time runs out); no team's bid should leak to others while bidding is still open.
- No database — all state lives in an in-memory object on the server. Optionally export it to a JSON file periodically as a backup in case the server crashes mid-session.

### Suggested tech stack
- Backend: Node.js, Express, Socket.io
- Frontend (both host and player): React (Vite); can be one app with different routes (`/host`, `/player/:teamId`) or two separate apps
- Frontend state management: React Context or Zustand (lightweight, sufficient)
- TypeScript is not mandatory, but recommended if the team is comfortable with it

## 3. Suggested folder structure

```
/server
  index.js               # sets up Express + Socket.io
  gameState.js            # global state object: teams, mazes, currentRound...
  config.js                # game settings, including TEAM_COUNT (configurable, not hardcoded)
  handlers/
    setup.js               # handles maze drawing, start/end point selection
    movement.js             # handles direction choice, wall checks, answer grading
    auction.js               # handles bidding for support items
    combat.js                 # handles combat/betting events
  data/
    questions.json            # question bank for Marxist-Leninist Political Economy
/host
  src/App.jsx                 # TV view: all teams' maps, leaderboard, current question
/player
  src/App.jsx                  # phone view: direction controls, answering questions, bidding
/shared
  constants.js                  # shared socket event names used by both sides, avoids typo'd strings
```

## 4. Core data model

```js
// Game config
{
  teamCount: 4          // set at session setup time based on actual class size, NOT hardcoded
}

// Team
{
  id: "team1",
  name: "Team 1",
  hp: 100,
  score: 0,
  position: { x: 0, y: 0 },
  startPoint: { x, y },
  endPoint: { x, y },        // this team's own end point (set by the opposing team), hidden from itself
  walls: [ {x, y, side} ],   // 20 walls placed by the OPPOSING team for this team's board
  discoveredCells: [ {x,y} ],// cells already visited/known — only this part is sent to the client
  supportItems: []            // support items won via auction
}

// Round state
{
  roundNumber: 1,
  phase: "movement" | "auction" | "combat",
  pendingAnswers: {},         // which teams have answered this round
  currentQuestion: { id, text, choices, correctIndex }
}
```

## 5. Game flow

1. **Setup**: All teams log into the player app with a team code. Each team places 20 walls and picks a start/end point for a 6x6 board — this board is assigned by the server to an OPPONENT team, not to the team that created it. (Pairing logic must work for any team count, not just 4 — e.g. pair teams in a rotation or round-robin depending on N.)
2. **Round start**: The server sends each team the 6x6 board it received from its opponent, but with walls and end point hidden.
3. **Each turn (round)**:
   - Each team picks a direction (client sends `move:choose`).
   - The server shows that team a random question.
   - The team answers (`question:answer`).
   - If the direction is valid (no wall) and the answer is correct → server updates position, adds score, and pushes the new state to both player and host.
   - If the team hits a wall → they lose their turn for that round, even if the answer was correct.
4. **After all teams finish their turn**: enter the auction phase — teams spend points to bid on support items (direction hint, 50/50, retry answer, combat shield, HP refill). The server collects sealed bids, determines winners, deducts points, and grants items.
5. **Combat event tile**: when a team lands on a combat tile, the server picks an opponent (random or by fixed rule) and opens a betting phase; the losing team loses HP or a turn.
6. **End of game**: the first team to reach its end point, or when time runs out, the server ranks teams by score + remaining HP and sends the final results to the host display.

## 6. Socket.io event list (define shared names in `shared/constants.js`)

**Client → Server**
- `team:join` `{ teamId }`
- `setup:submitMaze` `{ walls, startPoint, endPoint }`
- `move:choose` `{ direction }`
- `question:answer` `{ answerIndex }`
- `auction:bid` `{ itemId, amount }`
- `combat:bet` `{ amount }`

**Server → Client (broadcast or sent per team)**
- `game:state` — full state for host, filtered state (opponent info hidden) for each player
- `round:question` `{ question }`
- `round:result` `{ teamId, success, newPosition }`
- `auction:result` `{ winnerId, itemId }`
- `combat:result` `{ winnerId, loserId, effect }`
- `game:over` `{ rankings }`

## 7. Coding conventions

- The server never trusts client input directly for anything that affects win/loss (score, position, correct answer) — it always recomputes these itself.
- Each socket handler should be its own file; avoid one giant `index.js`.
- Use shared constants for event names (`shared/constants.js`), never hardcode the same string in multiple places.
- Keep team count as a runtime config value (set once at session setup based on actual class size), not a hardcoded constant anywhere in game logic, pairing, or UI layout.
- Implement in this order: maze setup → movement + questions → leaderboard → auction → combat. Only build auction/combat once the core loop is stable.

## 8. Out of scope

- No long-term user accounts, no email/password login — a simple team code is enough.
- No need to persist history across multiple sessions — each play session is independent.
- No need for responsive design beyond common phone screen sizes.
