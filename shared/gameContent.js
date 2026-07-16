export const EVENT_TILE_TYPES = {
  DUEL: "duel",
  POSITION_SWAP: "position_swap",
  MYSTERY_BOX: "mystery_box",
  TELEPORT: "teleport",
  KNOWLEDGE: "knowledge"
};

export const SUPPORT_ITEM_TYPES = {
  DIRECTION_HINT: "direction_hint",
  SHIELD: "shield",
  DOUBLE_SCORE: "double_score",
  FREEZE_OPPONENT: "freeze_opponent",
  TRAP: "trap",
  GUIDING_STAR: "guiding_star"
};

export const EVENT_TILE_CATALOG = [
  {
    type: EVENT_TILE_TYPES.DUEL,
    name: "Ô đối kháng",
    symbol: "VS",
    color: "#ef8f6b",
    lucideIcon: "swords",
    description: "Kích hoạt đối kháng với một đội khác."
  },
  {
    type: EVENT_TILE_TYPES.POSITION_SWAP,
    name: "Trao đổi vị trí",
    symbol: "SW",
    color: "#7bb7ff",
    lucideIcon: "repeat-2",
    description: "Có thể đổi vị trí với một đội khác hoặc bỏ qua."
  },
  {
    type: EVENT_TILE_TYPES.MYSTERY_BOX,
    name: "Hộp bí ẩn",
    symbol: "?",
    color: "#d995ff",
    lucideIcon: "gift",
    description: "Nhận ngẫu nhiên một vật phẩm hỗ trợ miễn phí."
  },
  {
    type: EVENT_TILE_TYPES.TELEPORT,
    name: "Dịch chuyển",
    symbol: "TP",
    color: "#65c8a2",
    lucideIcon: "sparkles",
    description: "Di chuyển đến một ô bất kì."
  },
  {
    type: EVENT_TILE_TYPES.KNOWLEDGE,
    name: "Tri thức",
    symbol: "2X",
    color: "#f0b94b",
    lucideIcon: "brain",
    description: "Trả lời câu hỏi khó; đúng thì nhận thêm 10 điểm."
  }
];

export const SUPPORT_ITEM_CATALOG = [
  {
    type: SUPPORT_ITEM_TYPES.DIRECTION_HINT,
    name: "Gợi ý hướng",
    symbol: "H",
    color: "#f4e06d",
    lucideIcon: "lightbulb",
    minPrice: 10,
    description: "Gợi ý một hướng mở, ưu tiên dẫn đến ô chưa khám phá."
  },
  {
    type: SUPPORT_ITEM_TYPES.SHIELD,
    name: "Lá chắn",
    symbol: "SH",
    color: "#8bd6e8",
    lucideIcon: "shield-check",
    minPrice: 20,
    description: "Tự động miễn một lần thua đối kháng hoặc dính cạm bẫy."
  },
  {
    type: SUPPORT_ITEM_TYPES.DOUBLE_SCORE,
    name: "Nhân đôi điểm",
    symbol: "2X",
    color: "#f0b94b",
    lucideIcon: "badge-plus",
    minPrice: 20,
    description: "Nhân đôi điểm cho lần di chuyển đúng kế tiếp."
  },
  {
    type: SUPPORT_ITEM_TYPES.FREEZE_OPPONENT,
    name: "Đóng băng đối thủ",
    symbol: "FR",
    color: "#7bb7ff",
    lucideIcon: "snowflake",
    minPrice: 25,
    description: "Chọn một đội khác và làm họ mất lượt hiện tại."
  },
  {
    type: SUPPORT_ITEM_TYPES.TRAP,
    name: "Cạm bẫy",
    symbol: "TR",
    color: "#ef8f6b",
    lucideIcon: "triangle-alert",
    minPrice: 25,
    description: "Đặt cạm bẫy ở một ô; đội bước vào bị trừ 1 điểm."
  },
  {
    type: SUPPORT_ITEM_TYPES.GUIDING_STAR,
    name: "Sao dẫn đường",
    symbol: "ST",
    color: "#fff0bd",
    lucideIcon: "goal",
    minPrice: 15,
    description: "Cho biết đội đang xa hay gần đích."
  }
];

export const AUCTION_ITEM_CATALOG = SUPPORT_ITEM_CATALOG;

export const getEventTileMeta = (type) => EVENT_TILE_CATALOG.find((item) => item.type === type) || null;
export const getSupportItemMeta = (type) => SUPPORT_ITEM_CATALOG.find((item) => item.type === type) || null;
