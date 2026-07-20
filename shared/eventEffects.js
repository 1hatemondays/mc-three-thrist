import { EVENT_TILE_TYPES, SUPPORT_ITEM_TYPES } from "./gameContent.js";

const effectId = (prefix, value) => `${prefix}:${value || Date.now()}`;

export const normalizeRoundEffect = (result, currentTeamId = null) => {
  const event = result?.event;
  if (!event) return null;

  const kind = event.type === EVENT_TILE_TYPES.METEOR_STRIKE
    ? "meteor"
    : event.type === EVENT_TILE_TYPES.MONSTER_ATTACK
      ? "monster"
      : null;
  if (!kind) return null;

  const outcomes = Array.isArray(event.outcomes) ? event.outcomes : [];
  const ownOutcome = currentTeamId ? outcomes.find((outcome) => outcome.teamId === currentTeamId) : null;

  return {
    id: effectId(kind, result.clientNonce || event.resolvedAt || result.teamId),
    kind,
    title: event.name || (kind === "meteor" ? "Mưa sao băng" : "Quái vật tấn công"),
    message: event.message || "",
    outcomes,
    shieldedTeamIds: outcomes.filter((outcome) => outcome.shielded).map((outcome) => outcome.teamId),
    currentTeamShielded: Boolean(ownOutcome?.shielded)
  };
};

export const normalizeSupportEffect = (result, currentTeamId = null) => {
  if (result?.type !== SUPPORT_ITEM_TYPES.FREEZE_OPPONENT) return null;

  const role = currentTeamId === result.targetTeamId
    ? "target"
    : currentTeamId === result.sourceTeamId
      ? "source"
      : "viewer";

  return {
    id: effectId("freeze", result.resolvedAt || result.targetTeamId),
    kind: "freeze",
    role,
    sourceTeamId: result.sourceTeamId,
    sourceTeamName: result.sourceTeamName,
    targetTeamId: result.targetTeamId,
    targetTeamName: result.targetTeamName
  };
};

export const normalizeCombatEffect = (result, currentTeamId = null) => {
  if (!result?.winnerId || !result?.loserId) return null;
  const protectedTeam = Boolean(result.shielded && currentTeamId === result.loserId);

  return {
    ...result,
    id: effectId("combat", result.resolvedAt || result.winnerId),
    kind: result.shielded ? "shield" : "combat",
    role: protectedTeam ? "protected" : currentTeamId === result.winnerId ? "winner" : currentTeamId === result.loserId ? "loser" : "viewer"
  };
};

export const getActivePlayerAlert = (state) => {
  const turnResult = state?.round?.pendingAnswer?.result;
  if (turnResult?.frozen) {
    return {
      kind: "freeze",
      type: SUPPORT_ITEM_TYPES.FREEZE_OPPONENT,
      symbol: "ĐÓNG",
      color: "#7bb7ff",
      title: "Bạn đang bị đóng băng",
      message: "Bạn bị mất một lượt. Thông báo này sẽ giữ nguyên cho đến khi đội được đi tiếp."
    };
  }

  if (turnResult?.skipped || Number(state?.team?.statusEffects?.skipTurns) > 0) {
    return {
      kind: "skip-turn",
      type: EVENT_TILE_TYPES.PRISON,
      symbol: "DỪNG",
      color: "#ef8f6b",
      title: "Bạn đang bị mất lượt",
      message: "Hình phạt mất lượt đang có hiệu lực và sẽ tự biến mất khi đội được đi tiếp."
    };
  }

  const pendingEvent = state?.round?.pendingEvent;
  if (!pendingEvent) return null;

  return {
    kind: pendingEvent.type,
    type: pendingEvent.type,
    symbol: pendingEvent.symbol,
    color: pendingEvent.color,
    title: `Bạn đang gặp: ${pendingEvent.name}`,
    message: pendingEvent.description || "Hãy xử lý sự kiện này trước khi tiếp tục di chuyển."
  };
};
