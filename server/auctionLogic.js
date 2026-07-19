import { ROUND_PHASES } from "../shared/constants.js";
import { AUCTION_ITEM_CATALOG, getSupportItemMeta } from "../shared/gameContent.js";
import { isGameOver } from "./gameOver.js";
import { makeAuctionState } from "./roundFlow.js";
import { grantSupportItem } from "./supportLogic.js";

const findTeam = (state, teamId) => state.teams.find((team) => team.id === teamId);
const auctionItems = () => AUCTION_ITEM_CATALOG.map(({ type, name, symbol, color, minPrice, description }) => ({ type, name, symbol, color, minPrice, description }));
const submittedCount = (state) => Object.keys(state.round.auction?.bids || {}).length;

export const getPlayerAuctionState = (state, teamId) => {
  const bid = state.round.auction?.bids?.[teamId];
  return {
    items: auctionItems(),
    submittedCount: submittedCount(state),
    totalTeams: state.teams.length,
    myBid: bid ? { itemId: bid.itemId || null, amount: bid.amount || 0, skipped: Boolean(bid.skipped) } : null,
    result: state.round.auction?.result || null
  };
};

export const getHostAuctionState = (state) => ({
  items: auctionItems(),
  submittedCount: submittedCount(state),
  totalTeams: state.teams.length,
  result: state.round.auction?.result || null
});

const resolveAuction = (state) => {
  const winners = [];
  const outcomes = [];
  const bids = state.round.auction.bids;

  for (const item of auctionItems()) {
    const publicBids = Object.entries(bids)
      .filter(([, bid]) => !bid.skipped && bid.itemId === item.type)
      .map(([teamId, bid]) => {
        const teamIndex = state.teams.findIndex((team) => team.id === teamId);
        const team = state.teams[teamIndex];
        return { teamId, teamName: team?.name || teamId, amount: bid.amount, teamIndex };
      })
      .sort((a, b) => b.amount - a.amount || a.teamIndex - b.teamIndex);

    const best = publicBids[0] || null;
    const team = best ? findTeam(state, best.teamId) : null;
    let winner = null;

    if (best && team && team.score >= best.amount) {
      team.score -= best.amount;
      grantSupportItem(team, item.type);
      winner = { teamId: team.id, teamName: team.name, itemId: item.type, itemName: item.name, amount: best.amount };
      winners.push(winner);
    }

    outcomes.push({
      itemId: item.type,
      itemName: item.name,
      symbol: item.symbol,
      color: item.color,
      minPrice: item.minPrice,
      bids: publicBids.map(({ teamIndex, ...bid }) => ({ ...bid, won: winner?.teamId === bid.teamId })),
      winner
    });
  }

  const teamResults = state.teams.map((team) => {
    const items = winners
      .filter((winner) => winner.teamId === team.id)
      .map(({ itemId, itemName, amount }) => ({ itemId, itemName, amount }));
    const status = items.length ? "won" : bids[team.id]?.skipped ? "skipped" : "no_win";
    return { teamId: team.id, teamName: team.name, status, items };
  });

  state.round.auction = { result: { winners, outcomes, teamResults } };
  state.round.roundNumber += 1;
  state.round.phase = ROUND_PHASES.MOVEMENT;
  state.round.activeTeamId = state.round.turnOrder?.[0] || state.teams[0]?.id || null;
  return state.round.auction.result;
};

export const submitAuctionBid = (state, teamId, payload = {}) => {
  if (isGameOver(state)) return { ok: false, error: "Trò chơi đã kết thúc." };
  if (state.round.phase !== ROUND_PHASES.AUCTION) return { ok: false, error: "Hiện không phải vòng đấu giá." };
  state.round.auction = state.round.auction || makeAuctionState();
  if (state.round.auction.bids?.[teamId]) return { ok: false, error: "Đội đã gửi giá đấu." };

  const team = findTeam(state, teamId);
  if (!team) return { ok: false, error: "Hãy vào đội trước khi đấu giá." };

  if (payload.skip) {
    state.round.auction.bids[teamId] = { skipped: true };
  } else {
    const meta = getSupportItemMeta(payload.itemId);
    const amount = Number(payload.amount);
    if (!meta) return { ok: false, error: "Vật phẩm đấu giá không hợp lệ." };
    if (!Number.isInteger(amount) || amount < meta.minPrice) return { ok: false, error: "Giá đấu phải từ " + meta.minPrice + " điểm." };
    if (amount > team.score) return { ok: false, error: "Không đủ điểm để đấu giá." };
    state.round.auction.bids[teamId] = { itemId: meta.type, amount };
  }

  if (submittedCount(state) === state.teams.length) {
    const result = resolveAuction(state);
    return { ok: true, resolved: true, result };
  }

  return { ok: true, resolved: false };
};
