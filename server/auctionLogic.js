import { ROUND_PHASES } from "../shared/constants.js";
import { AUCTION_ITEM_CATALOG, getSupportItemMeta } from "../shared/gameContent.js";
import { isGameOver } from "./gameOver.js";
import { addRoundMessage, makeAuctionState } from "./roundFlow.js";
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

  for (const item of auctionItems()) {
    let best = null;
    for (const [teamId, bid] of Object.entries(state.round.auction.bids)) {
      if (bid.skipped || bid.itemId !== item.type) continue;
      const teamIndex = state.teams.findIndex((team) => team.id === teamId);
      if (!best || bid.amount > best.amount || (bid.amount === best.amount && teamIndex < best.teamIndex)) {
        best = { teamId, amount: bid.amount, teamIndex };
      }
    }
    if (!best) continue;

    const team = findTeam(state, best.teamId);
    if (!team || team.score < best.amount) continue;
    team.score -= best.amount;
    const supportItem = grantSupportItem(team, item.type);
    winners.push({ teamId: team.id, teamName: team.name, itemId: item.type, itemName: item.name, amount: best.amount });
    addRoundMessage(state, team.id, { title: "Thắng đấu giá", text: "Nhận " + supportItem.name + " với giá " + best.amount + " điểm." });
  }

  state.round.auction = { result: { winners } };
  state.round.phase = ROUND_PHASES.MOVEMENT;
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
