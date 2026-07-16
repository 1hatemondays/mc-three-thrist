export const EVENT_TILE_TYPES = {
  DUEL: "duel",
  POSITION_SWAP: "position_swap",
  MYSTERY_BOX: "mystery_box",
  TELEPORT: "teleport",
  KNOWLEDGE: "knowledge",
  MONSTER_ATTACK: "monster_attack",
  METEOR_STRIKE: "meteor_strike",
  PRISON: "prison",
  BOMB: "bomb",
  BLESSING: "blessing"
};

export const SUPPORT_ITEM_TYPES = {
  DIRECTION_HINT: "direction_hint",
  SHIELD: "shield",
  DOUBLE_SCORE: "double_score",
  FREEZE_OPPONENT: "freeze_opponent",
  TRAP: "trap",
  METEOR_SHOWER: "meteor_shower"
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
  },
  {
    type: EVENT_TILE_TYPES.MONSTER_ATTACK,
    name: "Qu\u00e1i v\u1eadt t\u1ea5n c\u00f4ng",
    symbol: "MV",
    color: "#bd473f",
    lucideIcon: "skull",
    description: "M\u1ed7i \u0111\u1ed9i tr\u1eeb 10 \u0111i\u1ec3m; kh\u00f4ng \u0111\u1ee7 \u0111i\u1ec3m th\u00ec m\u1ea5t 10 HP. L\u00e1 ch\u1eafn s\u1ebd b\u1ea3o v\u1ec7."
  },
  {
    type: EVENT_TILE_TYPES.METEOR_STRIKE,
    name: "M\u01b0a sao b\u0103ng",
    symbol: "☄",
    color: "#ff784f",
    lucideIcon: "sparkles",
    description: "T\u1ea5t c\u1ea3 \u0111\u1ed9i m\u1ea5t 10 HP; L\u00e1 ch\u1eafn s\u1ebd b\u1ea3o v\u1ec7."
  },
  {
    type: EVENT_TILE_TYPES.PRISON,
    name: "Nh\u1ed1t t\u00f9",
    symbol: "TU",
    color: "#777066",
    lucideIcon: "lock-keyhole",
    description: "\u0110\u1ed9i b\u01b0\u1edbc v\u00e0o b\u1ecb m\u1ea5t l\u01b0\u1ee3t hi\u1ec7n t\u1ea1i."
  },
  {
    type: EVENT_TILE_TYPES.BOMB,
    name: "Bom",
    symbol: "BO",
    color: "#1d3329",
    lucideIcon: "bomb",
    description: "Tr\u1ea3 l\u1eddi trong 10 gi\u00e2y \u0111\u1ec3 chuy\u1ec3n bom; sai ho\u1eb7c h\u1ebft gi\u1edd m\u1ea5t 30 HP."
  },
  {
    type: EVENT_TILE_TYPES.BLESSING,
    name: "Ban ph\u01b0\u1edbc",
    symbol: "+",
    color: "#65c8a2",
    lucideIcon: "heart-handshake",
    description: "T\u1ea5t c\u1ea3 \u0111\u1ed9i h\u1ed3i 10 HP, c\u00f3 th\u1ec3 v\u01b0\u1ee3t 100 HP."
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
    description: "Tự động miễn một lần chịu sát thương từ đối kháng, cạm bẫy hoặc sự kiện toàn bản đồ."
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
    type: SUPPORT_ITEM_TYPES.METEOR_SHOWER,
    name: "\u0110\u1ea5u tr\u00ed",
    symbol: "DT",
    color: "#ff784f",
    lucideIcon: "sparkles",
    minPrice: 30,
    description: "10 c\u00e2u h\u1ecfi tranh quy\u1ec1n b\u1eb1ng ph\u00edm Space; th\u1eafng +50 \u0111i\u1ec3m."
  }
];

export const AUCTION_ITEM_CATALOG = SUPPORT_ITEM_CATALOG;

export const getEventTileMeta = (type) => EVENT_TILE_CATALOG.find((item) => item.type === type) || null;
export const getSupportItemMeta = (type) => SUPPORT_ITEM_CATALOG.find((item) => item.type === type) || null;
