export const getAuctionOutcomes = (result) => {
  if (Array.isArray(result?.outcomes)) return result.outcomes;

  return (result?.winners || []).map((winner) => ({
    itemId: winner.itemId,
    itemName: winner.itemName,
    symbol: "?",
    color: "#f0b94b",
    minPrice: null,
    bids: [{ teamId: winner.teamId, teamName: winner.teamName, amount: winner.amount, won: true }],
    winner
  }));
};

export const getPersonalAuctionSummary = (result, teamId) => {
  if (!result || !teamId) return null;

  const teamResult = result.teamResults?.find((team) => team.teamId === teamId);
  const items = teamResult?.items || (result.winners || [])
    .filter((winner) => winner.teamId === teamId)
    .map(({ itemId, itemName, amount }) => ({ itemId, itemName, amount }));
  const status = teamResult?.status || (items.length ? "won" : "no_win");

  if (items.length) {
    return {
      status: "won",
      heading: `Đội bạn nhận ${items.length} vật phẩm`,
      message: items.map((item) => item.itemName).join(" · "),
      items
    };
  }

  return {
    status,
    heading: "Đội bạn không nhận được vật phẩm",
    message: status === "skipped"
      ? "Đội bạn đã bỏ qua vòng đấu giá này."
      : "Đội bạn không thắng giá ở vòng này.",
    items: []
  };
};
