import assert from "node:assert/strict";
import test from "node:test";
import { ROUND_PHASES } from "../shared/constants.js";
import { SUPPORT_ITEM_TYPES } from "../shared/gameContent.js";
import { getHostAuctionState, getPlayerAuctionState, submitAuctionBid } from "./auctionLogic.js";

const makeTeam = (id, score = 50) => ({
  id,
  name: id,
  hp: 100,
  score,
  position: { x: 0, y: 0 },
  startPoint: { x: 0, y: 0 },
  endPoint: { x: 5, y: 5 },
  walls: [],
  discoveredCells: [{ x: 0, y: 0 }],
  supportItems: []
});

const makeState = () => ({
  config: { boardSize: 6, teamCount: 3 },
  teams: [makeTeam("team1"), makeTeam("team2"), makeTeam("team3", 5)],
  setup: { complete: true, started: true },
  round: {
    roundNumber: 2,
    phase: ROUND_PHASES.AUCTION,
    pendingAnswers: {},
    currentQuestion: null,
    eventTiles: [],
    pendingEvents: {},
    auction: { bids: {}, result: null },
    messages: {}
  }
});

test("auction exposes starting prices but never exposes sealed bids", () => {
  const state = makeState();
  const playerAuction = getPlayerAuctionState(state, "team1");

  assert.equal(playerAuction.items.find((item) => item.type === SUPPORT_ITEM_TYPES.DIRECTION_HINT).minPrice, 10);
  assert.equal(playerAuction.items.find((item) => item.type === SUPPORT_ITEM_TYPES.SHIELD).minPrice, 20);
  assert.equal(playerAuction.items.find((item) => item.type === SUPPORT_ITEM_TYPES.DOUBLE_SCORE).minPrice, 20);
  assert.equal(playerAuction.items.find((item) => item.type === SUPPORT_ITEM_TYPES.FREEZE_OPPONENT).minPrice, 25);
  assert.equal(playerAuction.items.find((item) => item.type === SUPPORT_ITEM_TYPES.TRAP).minPrice, 25);
  assert.equal(playerAuction.items.find((item) => item.type === SUPPORT_ITEM_TYPES.METEOR_SHOWER).minPrice, 30);

  assert.equal(submitAuctionBid(state, "team1", { itemId: SUPPORT_ITEM_TYPES.DIRECTION_HINT, amount: 9 }).ok, false);
  assert.equal(submitAuctionBid(state, "team1", { itemId: SUPPORT_ITEM_TYPES.DIRECTION_HINT, amount: 10 }).ok, true);

  const hostAuction = getHostAuctionState(state);
  assert.equal(hostAuction.submittedCount, 1);
  assert.equal(hostAuction.bids, undefined);
  assert.equal(hostAuction.result, null);

  const ownAuction = getPlayerAuctionState(state, "team1");
  assert.deepEqual(ownAuction.myBid, { itemId: SUPPORT_ITEM_TYPES.DIRECTION_HINT, amount: 10, skipped: false });
});

test("auction resolves after every team bids and awards highest sealed bids", () => {
  const state = makeState();

  submitAuctionBid(state, "team1", { itemId: SUPPORT_ITEM_TYPES.SHIELD, amount: 20 });
  submitAuctionBid(state, "team2", { itemId: SUPPORT_ITEM_TYPES.SHIELD, amount: 25 });
  const result = submitAuctionBid(state, "team3", { skip: true });

  assert.equal(result.ok, true);
  assert.equal(result.resolved, true);
  assert.equal(state.round.phase, ROUND_PHASES.MOVEMENT);
  assert.equal(state.round.roundNumber, 3);
  assert.equal(state.teams[1].score, 25);
  assert.equal(state.teams[1].supportItems[0].type, SUPPORT_ITEM_TYPES.SHIELD);
  assert.equal(state.teams[0].supportItems.length, 0);
  assert.equal(state.round.auction.result.winners[0].teamId, "team2");
  assert.equal(state.round.auction.bids, undefined);

  const shieldOutcome = result.result.outcomes.find((outcome) => outcome.itemId === SUPPORT_ITEM_TYPES.SHIELD);
  assert.deepEqual(shieldOutcome.winner, {
    teamId: "team2",
    teamName: "team2",
    itemId: SUPPORT_ITEM_TYPES.SHIELD,
    itemName: "Lá chắn",
    amount: 25
  });
  assert.deepEqual(shieldOutcome.bids, [
    { teamId: "team2", teamName: "team2", amount: 25, won: true },
    { teamId: "team1", teamName: "team1", amount: 20, won: false }
  ]);

  const directionOutcome = result.result.outcomes.find(
    (outcome) => outcome.itemId === SUPPORT_ITEM_TYPES.DIRECTION_HINT
  );
  assert.equal(directionOutcome.winner, null);
  assert.deepEqual(directionOutcome.bids, []);

  assert.deepEqual(result.result.teamResults, [
    { teamId: "team1", teamName: "team1", status: "no_win", items: [] },
    {
      teamId: "team2",
      teamName: "team2",
      status: "won",
      items: [{ itemId: SUPPORT_ITEM_TYPES.SHIELD, itemName: "Lá chắn", amount: 25 }]
    },
    { teamId: "team3", teamName: "team3", status: "skipped", items: [] }
  ]);
});
