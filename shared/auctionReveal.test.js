import assert from "node:assert/strict";
import test from "node:test";
import { getAuctionOutcomes, getPersonalAuctionSummary } from "./auctionReveal.js";

const wonItems = [
  { itemId: "shield", itemName: "Lá chắn", amount: 25 },
  { itemId: "double_score", itemName: "Nhân đôi điểm", amount: 30 }
];

test("personal auction summary highlights every item won by the current team", () => {
  const result = {
    winners: [],
    teamResults: [{ teamId: "team1", teamName: "Đội Một", status: "won", items: wonItems }]
  };

  assert.deepEqual(getPersonalAuctionSummary(result, "team1"), {
    status: "won",
    heading: "Đội bạn nhận 2 vật phẩm",
    message: "Lá chắn · Nhân đôi điểm",
    items: wonItems
  });
});

test("personal auction summary distinguishes losing and skipped teams", () => {
  const result = {
    winners: [],
    teamResults: [
      { teamId: "team1", teamName: "Đội Một", status: "no_win", items: [] },
      { teamId: "team2", teamName: "Đội Hai", status: "skipped", items: [] }
    ]
  };

  assert.equal(getPersonalAuctionSummary(result, "team1").message, "Đội bạn không thắng giá ở vòng này.");
  assert.equal(getPersonalAuctionSummary(result, "team2").message, "Đội bạn đã bỏ qua vòng đấu giá này.");
});

test("personal auction summary remains compatible with the legacy winners-only result", () => {
  const result = {
    winners: [{ teamId: "team1", teamName: "Đội Một", itemId: "shield", itemName: "Lá chắn", amount: 25 }]
  };

  assert.equal(getPersonalAuctionSummary(result, "team1").status, "won");
  assert.equal(getPersonalAuctionSummary(result, "team2").status, "no_win");
  assert.equal(getPersonalAuctionSummary(null, "team1"), null);
});

test("legacy winners are converted into revealable outcomes", () => {
  const winner = { teamId: "team1", teamName: "Đội Một", itemId: "shield", itemName: "Lá chắn", amount: 25 };
  assert.deepEqual(getAuctionOutcomes({ winners: [winner] }), [
    {
      itemId: "shield",
      itemName: "Lá chắn",
      symbol: "?",
      color: "#f0b94b",
      minPrice: null,
      bids: [{ teamId: "team1", teamName: "Đội Một", amount: 25, won: true }],
      winner
    }
  ]);
});
