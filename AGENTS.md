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
  walls: [ {x, y, side} ],   // 20 INTERIOR walls placed by the opposing team; outer border walls are implicit
  discoveredCells: [ {x,y} ],// cells already visited/known — only this part is sent to the client
  revealedWalls: [ {x,y,side} ], // walls/borders this team has actually bumped into and discovered
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

1. **Setup**: All teams log into the player app with a team code. Each team places exactly **20 interior walls** and picks a start/end point for a 6x6 board. The **outer border is always walled by default** and does **not** count toward the 20-wall limit. Wall placement should be **click-based on the shared edge lines between cells**, and clicking the same interior edge again should toggle that wall off so teams can easily fix layouts. The board a team creates is assigned by the server to an OPPONENT team, not to the team that created it. (Pairing logic must work for any team count, not just 4 — e.g. pair teams in a rotation or round-robin depending on N.)
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
- Maze setup rules are: **20 interior walls only**, **implicit outer border walls**, and **edge-click toggling** in the player UI.
- During setup review on the host screen, a team card should show the maze **submitted by that team**, while also indicating which opponent that maze will be assigned to.
- Implement in this order: maze setup → movement + questions → leaderboard → auction → combat. Only build auction/combat once the core loop is stable.

## 8. Out of scope

- No long-term user accounts, no email/password login — a simple team code is enough.
- No need to persist history across multiple sessions — each play session is independent.
- No need for responsive design beyond common phone screen sizes.

## 9. Current implemented behavior snapshot (updated 2026-07-15)

- **Dynamic teams**: teams are created from player joins, not from a hardcoded team count. The entered **team name** is also the visible display name, and the normalized version is used as the runtime team id / reconnect code.
- **Reconnect flow**: the player app stores the joined team locally and can reconnect back into the same team after disconnect/reload.
- **Maze assignment**: completed mazes are assigned **randomly to other teams** with no self-assignment. Players should not be told which opponent received the maze they designed.
- **Setup input UX**: maze walls are placed by clicking the **shared interior edge** between cells; clicking again toggles the wall off. Outer border walls are implicit and do not count toward the 20-wall limit.
- **Host setup review**: the host review card should show the maze **submitted by that team**, not the maze assigned to that team.
- **Movement rule update**:
  - moving into an **unexplored open cell** still requires answering a question;
  - moving into an **already explored cell** is a **free move** with **no question and no score gain**;
  - walking into a **wall or border** is resolved immediately with **no question**, ends the turn, and reveals that wall for that team.
- **Player fog-of-war truth**: explored cells and discovered walls come from **server state**, not client-side guesswork. A cell only becomes clear when the player has actually been on it; a wall can be revealed independently by colliding with it.
- **Player movement viewport**:
  - the movement screen is a zoomed square viewport centered on the player;
  - the **player stays centered** while the background grid moves;
  - hidden cells use a **smoke texture fog** (`player/src/assets/smoke-2.png`, currently sourced from the transparent `smoke_2_nobg.png` asset);
  - fog between adjacent hidden cells should blend by **natural spill/overflow**, not by separate connector overlays.
- **Known wall persistence**: once a player reveals a wall, it should persist in that player's movement viewport on later turns.
- **Event tiles are one-time**: when a team lands on an event tile and the event triggers, that tile is **consumed/removed** from `round.eventTiles` so it disappears from host/player state and cannot be triggered again.
