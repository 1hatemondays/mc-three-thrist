# Score And Auction Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authoritative, animated score feedback and complete auction-result reveals to player and host views without regressing current gameplay.

**Architecture:** Extend the post-resolution auction payload while preserving its existing `winners` field and sealed-bid boundary. Add focused shared React components for score and auction presentation, then integrate them into the existing player, host, and guide layouts.

**Tech Stack:** Node.js, React 18, Socket.io, Vite, CSS, Node test runner

## Global Constraints

- Preserve all current game rules, event names, reconnect behavior, and question-bank changes.
- Never expose bids before auction resolution.
- Add no third-party dependency.
- Support responsive player screens and `prefers-reduced-motion`.
- Run the full server suite and both production builds before completion.

---

### Task 1: Public Auction Result Contract

**Files:**
- Modify: `server/auctionLogic.test.js`
- Modify: `server/auctionLogic.js`

**Interfaces:**
- Consumes: private `state.round.auction.bids`, `state.teams`, and `AUCTION_ITEM_CATALOG`.
- Produces: `{ winners, outcomes, teamResults }`, retaining the existing winner object shape.

- [ ] **Step 1: Write failing auction-result tests**

Assert that resolved results include every catalog item, losing bids, the winning bid, and `won`/`no_win`/`skipped` team summaries, while unresolved host/player state still omits bids.

- [ ] **Step 2: Verify the tests fail for missing fields**

Run: `node --test server/auctionLogic.test.js`

Expected: existing tests pass and new assertions fail because `outcomes` and `teamResults` are absent.

- [ ] **Step 3: Build the public result before clearing private bids**

Create catalog-ordered outcomes and team summaries inside `resolveAuction`. Keep scoring, tie resolution, item grants, round increment, and active-team selection unchanged.

- [ ] **Step 4: Verify the auction tests pass**

Run: `node --test server/auctionLogic.test.js`

Expected: all auction tests pass with zero failures.

### Task 2: Shared Score Animation

**Files:**
- Create: `shared/scoreEffects.js`
- Create: `shared/scoreEffects.test.js`
- Create: `shared/AnimatedScore.jsx`
- Create: `shared/scoreEffects.css`

**Interfaces:**
- Produces: `getScoreDelta(previous, next)`, `nextDisplayedScore(current, target)`, and `<AnimatedScore value={number} />`.

- [ ] **Step 1: Write failing pure-logic tests**

Cover positive, negative, unchanged, invalid, and converging display-step cases.

- [ ] **Step 2: Verify RED**

Run: `node --test shared/scoreEffects.test.js`

Expected: fail because `shared/scoreEffects.js` does not exist.

- [ ] **Step 3: Implement minimal pure helpers and React component**

The component skips animation on first render, counts toward each authoritative value, displays a signed delta, and emits fixed ember spans for deterministic rendering.

- [ ] **Step 4: Add responsive and reduced-motion CSS**

Use the existing gold, coral, ink, and paper variables; keep all particles pointer-free and contained.

- [ ] **Step 5: Verify GREEN**

Run: `node --test shared/scoreEffects.test.js`

Expected: all score-effect logic tests pass.

### Task 3: Shared Auction Reveal

**Files:**
- Create: `shared/auctionReveal.js`
- Create: `shared/auctionReveal.test.js`
- Create: `shared/AuctionRevealOverlay.jsx`
- Create: `shared/auctionReveal.css`

**Interfaces:**
- Produces: `getPersonalAuctionSummary(result, teamId)` and `<AuctionRevealOverlay result currentTeamId mode onClose />`.

- [ ] **Step 1: Write failing summary tests**

Cover a team winning multiple items, winning none, skipping, and missing/legacy result data.

- [ ] **Step 2: Verify RED**

Run: `node --test shared/auctionReveal.test.js`

Expected: fail because `shared/auctionReveal.js` does not exist.

- [ ] **Step 3: Implement minimal summary logic and staged overlay**

Reveal catalog item cards on a timer, expose winner/loser information after each opening phase, finish with team summaries, provide a close button, and auto-dismiss after the summary.

- [ ] **Step 4: Add overlay animation and accessibility CSS**

Use semantic dialog/status markup, focusable close control, viewport-safe scrolling, mobile layout, and reduced-motion fallbacks.

- [ ] **Step 5: Verify GREEN**

Run: `node --test shared/auctionReveal.test.js`

Expected: all auction reveal logic tests pass.

### Task 4: Player And Host Integration

**Files:**
- Modify: `player/src/App.jsx`
- Modify: `player/src/styles.css`
- Modify: `host/src/App.jsx`
- Modify: `host/src/styles.css`

**Interfaces:**
- Consumes: `AnimatedScore`, `AuctionRevealOverlay`, existing `game:state`, and existing `auction:result`.

- [ ] **Step 1: Replace raw player score and old popup**

Render `AnimatedScore` in the player score metric. Replace `AuctionResultPopup` with the shared overlay and pass the current team id.

- [ ] **Step 2: Integrate host and guide score displays**

Show authoritative scores with `AnimatedScore` in the host leaderboard and guide team list without removing current turn/position information.

- [ ] **Step 3: Replace the host auction banner**

Store `auction:result` in host state, render the shared TV overlay in both host routes, and keep other event/combat banners unchanged.

- [ ] **Step 4: Build both frontends**

Run: `npm.cmd run build`

Expected: host and player Vite builds both exit 0.

### Task 5: Regression And Visual Verification

**Files:**
- Verify only; fix scoped issues in files from Tasks 1-4 if found.

- [ ] **Step 1: Run all automated tests**

Run: `npm.cmd test`

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run a fresh production build**

Run: `npm.cmd run build`

Expected: both builds exit 0 without errors.

- [ ] **Step 3: Browser-check player and host views**

Start the existing development stack, trigger positive/negative score changes and an auction result, then inspect desktop host and mobile player viewports. Confirm no overlap, readable personal summary, correct team/item mapping, close/auto-dismiss behavior, and no interruption to the next movement round.

## Plan Self-Review

- Spec coverage: every design requirement maps to Tasks 1-5.
- Placeholder scan: no TBD/TODO or deferred implementation language remains.
- Type consistency: `outcomes`, `teamResults`, `AnimatedScore`, and `AuctionRevealOverlay` names are consistent across producers and consumers.
- Regression boundary: the plan explicitly preserves gameplay logic and requires the full existing test suite plus both builds.

