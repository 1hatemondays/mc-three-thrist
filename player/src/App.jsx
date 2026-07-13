import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { DIRECTIONS, EVENTS, ROUND_PHASES } from "../../shared/constants.js";
import { EVENT_TILE_TYPES, SUPPORT_ITEM_TYPES, getEventTileMeta } from "../../shared/gameContent.js";
import { WALL_COUNT, hasEnclosedCell, isMazeConnected, isInteriorWall, uniqueWalls, wallKey } from "../../shared/maze.js";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  `${window.location.protocol}//${window.location.hostname === "0.0.0.0" ? "localhost" : window.location.hostname}:3000`;
const BOARD_SIZE = 6;
const APP_TITLE = "M\u00ea Cung Tri Th\u1ee9c";

const emptyDraft = () => ({ walls: [], startPoint: null, endPoint: null });
const pointKey = (point) => (point ? `${point.x}:${point.y}` : "");
const normalizeTeamCode = (value) => value.replace(/\s+/g, "").toLowerCase();
const directionLabels = {
  [DIRECTIONS.UP]: "Lên",
  [DIRECTIONS.RIGHT]: "Phải",
  [DIRECTIONS.DOWN]: "Xuống",
  [DIRECTIONS.LEFT]: "Trái"
};
const directionSymbols = {
  [DIRECTIONS.UP]: "↑",
  [DIRECTIONS.RIGHT]: "→",
  [DIRECTIONS.DOWN]: "↓",
  [DIRECTIONS.LEFT]: "←"
};
const phaseLabels = {
  [ROUND_PHASES.MOVEMENT]: "Di chuyển",
  [ROUND_PHASES.AUCTION]: "Đấu giá",
  [ROUND_PHASES.COMBAT]: "Chiến đấu"
};
const INTERIOR_EDGES = [
  ...Array.from({ length: BOARD_SIZE }, (_, y) =>
    Array.from({ length: BOARD_SIZE - 1 }, (_, index) => ({
      x: index + 1,
      y,
      side: "left",
      orientation: "vertical"
    }))
  ).flat(),
  ...Array.from({ length: BOARD_SIZE - 1 }, (_, index) =>
    Array.from({ length: BOARD_SIZE }, (_, x) => ({
      x,
      y: index + 1,
      side: "top",
      orientation: "horizontal"
    }))
  ).flat()
];
const BORDER_SEGMENTS = [
  ...Array.from({ length: BOARD_SIZE }, (_, x) => ({ x, y: 0, side: "top", orientation: "horizontal" })),
  ...Array.from({ length: BOARD_SIZE }, (_, x) => ({
    x,
    y: BOARD_SIZE - 1,
    side: "bottom",
    orientation: "horizontal"
  })),
  ...Array.from({ length: BOARD_SIZE }, (_, y) => ({ x: 0, y, side: "left", orientation: "vertical" })),
  ...Array.from({ length: BOARD_SIZE }, (_, y) => ({
    x: BOARD_SIZE - 1,
    y,
    side: "right",
    orientation: "vertical"
  }))
];

const edgeGridPosition = (edge) =>
  edge.orientation === "vertical"
    ? { gridColumn: edge.side === "left" ? edge.x * 2 + 1 : BOARD_SIZE * 2 + 1, gridRow: edge.y * 2 + 2 }
    : { gridColumn: edge.x * 2 + 2, gridRow: edge.side === "top" ? edge.y * 2 + 1 : BOARD_SIZE * 2 + 1 };

const formatBlockedReason = (reason) => {
  if (reason === "border") return "Biên mê cung";
  if (reason === "wall") return "Tường ẩn";
  return "Bị chặn";
};

const SetupBoard = ({ state, onSubmit }) => {
  const [draft, setDraft] = useState(emptyDraft);
  const [mode, setMode] = useState("wall");
  const [draftError, setDraftError] = useState("");
  const setup = state.setup;
  const submitted = Boolean(setup?.mySubmission);
  const startKey = pointKey(draft.startPoint);
  const endKey = pointKey(draft.endPoint);
  const endpointsReady = Boolean(draft.startPoint && draft.endPoint && startKey !== endKey);
  const mazeConnected = isMazeConnected(draft.walls, BOARD_SIZE);
  const canSubmit = !submitted && draft.walls.length === WALL_COUNT && endpointsReady && mazeConnected;
  const waitingForHostStart = setup?.complete && !setup?.started;

  useEffect(() => {
    setDraft(emptyDraft());
    setDraftError("");
  }, [state.team.id]);

  const selectCell = (x, y) => {
    if (submitted) return;
    setDraftError("");

    if (mode === "start") {
      setDraft((current) => ({ ...current, startPoint: { x, y } }));
      return;
    }

    if (mode === "end") {
      setDraft((current) => ({ ...current, endPoint: { x, y } }));
    }
  };

  const cellClass = (x, y) => {
    const classes = ["setup-cell"];
    if (startKey === `${x}:${y}`) classes.push("is-start");
    if (endKey === `${x}:${y}`) classes.push("is-end");
    return classes.join(" ");
  };

  const toggleEdge = (edge) => {
    if (submitted || mode !== "wall") return;

    const key = wallKey(edge, BOARD_SIZE);
    const exists = draft.walls.some((wall) => wallKey(wall, BOARD_SIZE) === key);

    if (exists) {
      setDraft({ ...draft, walls: draft.walls.filter((wall) => wallKey(wall, BOARD_SIZE) !== key) });
      setDraftError("");
      return;
    }

    if (draft.walls.length >= WALL_COUNT) {
      setDraftError(`Ch\u1ec9 \u0111\u01b0\u1ee3c \u0111\u1eb7t \u0111\u00fang ${WALL_COUNT} t\u01b0\u1eddng n\u1ed9i b\u1ed9.`);
      return;
    }

    const nextWalls = uniqueWalls([...draft.walls, edge], BOARD_SIZE).filter((wall) =>
      isInteriorWall(wall, BOARD_SIZE)
    );

    if (hasEnclosedCell(nextWalls, BOARD_SIZE)) {
      setDraftError("T\u01b0\u1eddng n\u00e0y bao k\u00edn ho\u00e0n to\u00e0n m\u1ed9t \u00f4. H\u00e3y m\u1edf \u00edt nh\u1ea5t m\u1ed9t c\u1ea1nh cho \u00f4 \u0111\u00f3.");
      return;
    }

    if (!isMazeConnected(nextWalls, BOARD_SIZE)) {
      setDraftError("T\u01b0\u1eddng n\u00e0y ch\u1eb7n t\u00e1ch m\u1ed9t khu v\u1ef1c kh\u1ecfi m\u00ea cung. H\u00e3y \u0111\u1ec3 m\u1ecdi \u00f4 c\u00f2n th\u00f4ng nhau.");
      return;
    }

    setDraft({ ...draft, walls: nextWalls });
    setDraftError("");
  };

  return (
    <section className="setup-panel">
      <div className="setup-head">
        <div>
          <p>Thiết lập mê cung</p>
          <h2>Tạo bàn chơi cho đội kế tiếp</h2>
        </div>
        <strong>{draft.walls.length}/{WALL_COUNT} walls</strong>
      </div>

      <div className="toolbar" aria-label="Setup tools">
        {["wall", "start", "end"].map((tool) => (
          <button
            className={mode === tool ? "tool active" : "tool"}
            key={tool}
            onClick={() => setMode(tool)}
            type="button"
          >
            {tool === "wall" ? "Tường" : tool === "start" ? "Xuất phát" : "Đích"}
          </button>
        ))}
      </div>

      <div className="setup-board" aria-label="Bàn thiết lập mê cung">
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
          const x = index % BOARD_SIZE;
          const y = Math.floor(index / BOARD_SIZE);
          return (
            <button
              className={cellClass(x, y)}
              disabled={submitted || mode === "wall"}
              key={`${x}:${y}`}
              onClick={() => selectCell(x, y)}
              style={{ gridColumn: x * 2 + 2, gridRow: y * 2 + 2 }}
              type="button"
            >
              {startKey === `${x}:${y}` ? "S" : endKey === `${x}:${y}` ? "E" : ""}
            </button>
          );
        })}

        {BORDER_SEGMENTS.map((edge) => (
          <div
            aria-hidden="true"
            className={`setup-edge border ${edge.orientation}`}
            key={`border-${edge.side}-${edge.x}-${edge.y}`}
            style={edgeGridPosition(edge)}
          />
        ))}

        {INTERIOR_EDGES.map((edge) => {
          const active = draft.walls.some((wall) => wallKey(wall, BOARD_SIZE) === wallKey(edge, BOARD_SIZE));
          return (
            <button
              aria-label={`Bật tắt tường ${edge.orientation} tại ${edge.x},${edge.y}`}
              className={`setup-edge ${edge.orientation}${active ? " active" : ""}`}
              disabled={submitted || mode !== "wall"}
              key={`edge-${edge.side}-${edge.x}-${edge.y}`}
              onClick={() => toggleEdge(edge)}
              style={edgeGridPosition(edge)}
              type="button"
            />
          );
        })}
      </div>

      <div className="setup-actions">
        <span className={draftError ? "setup-error" : ""}>
          {draftError
            ? draftError
            : submitted
              ? waitingForHostStart
                ? "\u0110\u1ee7 m\u00ea cung r\u1ed3i. Ch\u1edd host b\u1ea5m B\u1eaft \u0111\u1ea7u."
                : "\u0110\u00e3 n\u1ed9p m\u00ea cung. Ch\u1edd c\u00e1c \u0111\u1ed9i c\u00f2n l\u1ea1i."
              : !mazeConnected
                ? "M\u00ea cung ph\u1ea3i li\u00ean th\u00f4ng, kh\u00f4ng \u0111\u01b0\u1ee3c ch\u1eb7n t\u00e1ch khu v\u1ef1c."
                : mode === "wall"
                  ? "B\u1ea5m v\u00e0o c\u1ea1nh gi\u1eefa c\u00e1c \u00f4 \u0111\u1ec3 \u0111\u1eb7t \u0111\u00fang 20 t\u01b0\u1eddng n\u1ed9i b\u1ed9."
                  : "Ch\u1ecdn \u00f4 xu\u1ea5t ph\u00e1t v\u00e0 \u00f4 \u0111\u00edch cho \u0111\u1ed9i k\u1ebf ti\u1ebfp."}
        </span>
        <button disabled={!canSubmit} onClick={() => onSubmit(draft)} type="button">
          Nộp mê cung
        </button>
      </div>
    </section>
  );
};

const GameplayBoard = ({ team }) => {
  const discovered = new Set((team.discoveredCells || []).map(pointKey));
  const positionKey = pointKey(team.position);

  return (
    <div className="game-board" aria-label="B\u00e0n m\u00ea cung \u0111\u00e3 kh\u00e1m ph\u00e1">
      {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
        const x = index % BOARD_SIZE;
        const y = Math.floor(index / BOARD_SIZE);
        const key = x + ":" + y;
        const known = discovered.has(key);
        const current = key === positionKey;
        const classes = ["game-cell"];
        if (known) classes.push("known");
        if (current) classes.push("current");

        return (
          <div className={classes.join(" ")} key={key}>
            {current ? "B\u1ea1n" : known ? "" : "?"}
          </div>
        );
      })}
    </div>
  );
};

const DirectionControls = ({ disabled, pendingDirection, onChooseDirection }) => (
  <div className="direction-pad" aria-label="Điều khiển di chuyển">
    {Object.values(DIRECTIONS).map((direction) => (
      <button
        aria-label={`Đi ${directionLabels[direction]}`}
        className={`direction-button ${direction}${pendingDirection === direction ? " selected" : ""}`}
        disabled={disabled}
        key={direction}
        onClick={() => onChooseDirection(direction)}
        type="button"
      >
        <span aria-hidden="true">{directionSymbols[direction]}</span>
        <small>{directionLabels[direction]}</small>
      </button>
    ))}
  </div>
);

const QuestionCard = ({ question, answered, onAnswer }) => {
  if (!question) return null;

  return (
    <section className="game-card question-card">
      <div className="section-head">
        <p>Câu hỏi</p>
        <h2>{question.text}</h2>
      </div>

      <div className="choices">
        {question.choices.map((choice, index) => (
          <button disabled={answered} key={`${question.id}-${choice}`} onClick={() => onAnswer(index)} type="button">
            <strong>{String.fromCharCode(65 + index)}</strong>
            <span>{choice}</span>
          </button>
        ))}
      </div>
    </section>
  );
};

const ResultCard = ({ result }) => {
  if (!result) return null;

  const title = result.success
    ? "\u0110\u00fang. \u0110\u1ed9i \u0111\u00e3 di chuy\u1ec3n."
    : result.blocked
      ? (result.correct ? "\u0110\u00fang" : "Sai") + ", nh\u01b0ng b\u1ecb ch\u1eb7n."
      : "Sai \u0111\u00e1p \u00e1n.";
  const event = result.event;

  return (
    <section className={"game-card result-card " + (result.success ? "success" : "miss")}>
      <div>
        <p>{"K\u1ebft qu\u1ea3 l\u01b0\u1ee3t"}</p>
        <h2>{title}</h2>
      </div>
      <dl className="result-grid">
        <div>
          <dt>{"\u0110\u00e1p \u00e1n"}</dt>
          <dd>{result.correct ? "\u0110\u00fang" : "Sai"}</dd>
        </div>
        <div>
          <dt>{"\u0110\u01b0\u1eddng \u0111i"}</dt>
          <dd>{result.blocked ? formatBlockedReason(result.blockedReason) : "Th\u00f4ng"}</dd>
        </div>
        <div>
          <dt>{"\u0110i\u1ec3m"}</dt>
          <dd>+{result.scoreDelta}</dd>
        </div>
      </dl>
      {event && (
        <div className="event-result">
          <span className="game-event" style={{ "--event-color": event.color }}>
            {event.symbol}
          </span>
          <div>
            <strong>{event.name}</strong>
            <small>{event.message || "\u0110\u00e3 k\u00edch ho\u1ea1t \u00f4 s\u1ef1 ki\u1ec7n."}</small>
            {event.item && <small>{"V\u1eadt ph\u1ea9m: " + event.item.name}</small>}
          </div>
        </div>
      )}
    </section>
  );
};

const PendingEventCard = ({ event, onResolve }) => {
  if (!event) return null;

  if (event.question) {
    return (
      <section className="game-card pending-event-card">
        <div className="section-head">
          <p>{"Sự kiện"}</p>
          <h2>{event.name}</h2>
        </div>
        <div className="pending-event-body">
          <span className="game-event" style={{ "--event-color": event.color }}>
            {event.symbol}
          </span>
          <p>{event.question.text}</p>
        </div>
        <div className="choices compact-choices">
          {event.question.choices.map((choice, index) => (
            <button key={event.question.id + choice} onClick={() => onResolve({ answerIndex: index })} type="button">
              <strong>{String.fromCharCode(65 + index)}</strong>
              <span>{choice}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="game-card pending-event-card">
      <div className="section-head">
        <p>{"Sự kiện"}</p>
        <h2>{event.name}</h2>
      </div>
      <div className="pending-event-body">
        <span className="game-event" style={{ "--event-color": event.color }}>
          {event.symbol}
        </span>
        <p>{"Chọn đội để trao đổi vị trí, hoặc bỏ qua sự kiện này."}</p>
      </div>
      <div className="event-actions">
        {(event.options || []).map((option) => (
          <button key={option.id} onClick={() => onResolve({ action: "swap", targetTeamId: option.id })} type="button">
            {option.name}
          </button>
        ))}
        <button className="secondary-button" onClick={() => onResolve({ action: "skip" })} type="button">
          {"Bỏ qua"}
        </button>
      </div>
    </section>
  );
};

const NoticePanel = ({ messages = [] }) => {
  if (!messages.length) return null;

  return (
    <section className="notice-stack" aria-label="Thông báo">
      {messages.map((message) => (
        <article className="notice-box" key={message.id || message.title + message.text}>
          <strong>{message.title}</strong>
          <span>{message.text}</span>
        </article>
      ))}
    </section>
  );
};

const AuctionPanel = ({ auction, active, onBid }) => {
  const items = auction?.items || [];
  const [itemId, setItemId] = useState(items[0]?.type || "");
  const selected = items.find((item) => item.type === itemId) || items[0];
  const [amount, setAmount] = useState(selected?.minPrice || 0);

  useEffect(() => {
    if (!items.length) return;
    const next = items.find((item) => item.type === itemId) || items[0];
    setItemId(next.type);
    setAmount(next.minPrice);
  }, [active, items.length]);

  useEffect(() => {
    if (selected) setAmount(selected.minPrice);
  }, [itemId]);

  if (!active && !auction?.result) return null;

  return (
    <section className="game-card auction-panel">
      <div className="section-head">
        <p>{"Đấu giá kín"}</p>
        <h2>{active ? "Chọn vật phẩm muốn đấu" : "Kết quả đấu giá"}</h2>
      </div>

      {active && (
        <>
          <div className="auction-progress">
            {auction.submittedCount}/{auction.totalTeams} {"đội đã gửi giá"}
          </div>
          <div className="auction-items">
            {items.map((item) => (
              <button
                className={item.type === itemId ? "auction-item-card active" : "auction-item-card"}
                disabled={Boolean(auction.myBid)}
                key={item.type}
                onClick={() => setItemId(item.type)}
                type="button"
              >
                <span style={{ "--item-color": item.color }}>{item.symbol}</span>
                <strong>{item.name}</strong>
                <small>{"Khởi điểm " + item.minPrice + " điểm"}</small>
              </button>
            ))}
          </div>
          {auction.myBid ? (
            <div className="notice-box compact">
              <strong>{"Đã gửi giá"}</strong>
              <span>{auction.myBid.skipped ? "Đội đã bỏ qua vòng đấu giá." : "Giá đã được niêm phong, chờ các đội khác."}</span>
            </div>
          ) : (
            <div className="bid-box">
              <label htmlFor="auctionAmount">{"Giá đấu"}</label>
              <input id="auctionAmount" min={selected?.minPrice || 0} onChange={(event) => setAmount(event.target.value)} type="number" value={amount} />
              <button onClick={() => onBid({ itemId, amount: Number(amount) })} type="button">{"Gửi giá"}</button>
              <button className="secondary-button" onClick={() => onBid({ skip: true })} type="button">{"Bỏ qua"}</button>
            </div>
          )}
        </>
      )}

      {auction?.result?.winners?.length ? (
        <div className="result-list">
          {auction.result.winners.map((winner) => (
            <div className="leader-row" key={winner.teamId + winner.itemId}>
              <span>{winner.teamName}</span>
              <strong>{winner.itemName} / {winner.amount} điểm</strong>
            </div>
          ))}
        </div>
      ) : auction?.result ? (
        <p className="empty-note">{"Không có đội nào thắng vật phẩm."}</p>
      ) : null}
    </section>
  );
};

const CombatTeamCard = ({ mark, role, team, result }) => {
  const winner = result?.winnerId === team?.id;
  const loser = result?.loserId === team?.id;
  const hp = Math.max(0, Math.min(100, team?.hp || 0));

  return (
    <article className={"combat-team-card" + (winner ? " is-winner" : "") + (loser ? " is-loser" : "")}>
      <div className="combat-team-top">
        <span className="combat-team-mark">{mark}</span>
        <span>{role}</span>
      </div>
      <strong>{team?.name || "Đang chọn đội"}</strong>
      <div className="combat-team-stats">
        <span>{team?.score ?? 0} điểm</span>
        <span>{hp} HP</span>
      </div>
      <div className="combat-hp" aria-label={(team?.name || "Đội") + " còn " + hp + " máu"}>
        <span style={{ "--hp-width": hp + "%" }} />
      </div>
      {winner && <em>Thắng</em>}
      {loser && <em>Thua</em>}
    </article>
  );
};

const CombatPanel = ({ combat, active, currentTeamId, onBet }) => {
  const dialogRef = useRef(null);
  const [amount, setAmount] = useState(0);
  const myTeam = [combat?.attacker, combat?.defender].find((team) => team?.id === currentTeamId);
  const maxBid = myTeam?.score || 0;
  const bid = Number(amount);
  const canSubmit = Number.isInteger(bid) && bid >= 0 && bid <= maxBid;

  useEffect(() => {
    setAmount(0);
  }, [active, combat?.attacker?.id, combat?.defender?.id]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!active || !dialog || dialog.open) return undefined;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [active]);

  if (!combat || !active) return null;

  const result = combat.result;
  const title = result
    ? "Kết quả đối kháng"
    : combat.involved
      ? "Khóa điểm, giành lợi thế"
      : "Theo dõi trận đối kháng";

  const setPreset = (ratio) => setAmount(Math.floor(maxBid * ratio));

  return (
    <dialog
      aria-labelledby="combatTitle"
      className="combat-modal"
      onCancel={(event) => event.preventDefault()}
      ref={dialogRef}
    >
    <section className="game-card combat-panel" aria-live="polite">
      <header className="combat-head">
        <div>
          <p className="combat-kicker"><span>VS</span> Ô đối kháng · cược kín</p>
          <h2 id="combatTitle">{title}</h2>
        </div>
        <span className="combat-status">
          {result ? "Đã phân thắng bại" : combat.submittedCount + "/2 đã khóa"}
        </span>
      </header>

      <div className="combat-arena">
        <CombatTeamCard mark="ATK" role="Thách đấu" team={combat.attacker} result={result} />
        <div className="combat-versus" aria-hidden="true">VS</div>
        <CombatTeamCard mark="DEF" role="Phòng thủ" team={combat.defender} result={result} />
      </div>

      {active && combat.involved && !combat.submitted && (
        <form
          className="combat-bet"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) onBet({ amount: bid });
          }}
        >
          <div className="combat-bet-copy">
            <div>
              <span>Lượt của đội bạn</span>
              <strong>Đặt bao nhiêu điểm?</strong>
            </div>
            <small>Tối đa {maxBid} điểm</small>
          </div>

          <div className="combat-amount-row">
            <label htmlFor="combatAmount">Mức cược</label>
            <input
              id="combatAmount"
              inputMode="numeric"
              max={maxBid}
              min="0"
              onChange={(event) => setAmount(event.target.value)}
              step="1"
              type="number"
              value={amount}
            />
            <span>điểm</span>
          </div>

          <div className="combat-presets" aria-label="Chọn nhanh mức cược">
            <button onClick={() => setPreset(0.25)} type="button">25%</button>
            <button onClick={() => setPreset(0.5)} type="button">50%</button>
            <button onClick={() => setPreset(1)} type="button">Tất tay</button>
          </div>

          <button className="combat-submit" disabled={!canSubmit} type="submit">
            Khóa điểm cược
          </button>
          <p className="combat-rule">Điểm cược được giữ kín. Cược cao hơn thắng; hòa thì đội thách đấu thắng.</p>
        </form>
      )}

      {active && (!combat.involved || combat.submitted) && (
        <div className="combat-waiting">
          <span className="combat-lock" aria-hidden="true">{combat.submitted ? "✓" : "•••"}</span>
          <div>
            <strong>{combat.submitted ? "Đã khóa điểm cược" : "Đang theo dõi trực tiếp"}</strong>
            <p>
              {combat.submitted
                ? "Chờ đối thủ hoàn tất lựa chọn."
                : "Hai đội đang đặt điểm; mức cược vẫn được niêm phong."}
            </p>
          </div>
          <div className="combat-locks" aria-label={combat.submittedCount + " trên 2 đội đã đặt cược"}>
            <span className={combat.submittedCount > 0 ? "locked" : ""} />
            <span className={combat.submittedCount > 1 ? "locked" : ""} />
          </div>
        </div>
      )}

      {result && (
        <div className={"combat-result" + (result.shielded ? " is-shielded" : "")}>
          <span className="combat-result-seal">{result.shielded ? "SH" : "KO"}</span>
          <div>
            <small>Kết quả chung cuộc</small>
            <strong>{result.winnerName} chiến thắng</strong>
            <p>
              {result.shielded
                ? "Lá chắn của " + result.loserName + " đã chặn toàn bộ sát thương."
                : result.loserName + " mất " + result.hpLoss + " HP."}
            </p>
          </div>
        </div>
      )}
    </section>
    </dialog>
  );
};

const Leaderboard = ({ teams }) => {
  const rankedTeams = [...teams].sort((a, b) => b.score - a.score || b.hp - a.hp || a.name.localeCompare(b.name));

  return (
    <section className="game-card compact-leaderboard">
      <div className="section-head">
        <p>Bảng điểm</p>
        <h2>Xếp hạng đội chơi</h2>
      </div>
      {rankedTeams.map((team, index) => (
        <div className="leader-row" key={team.id}>
          <span>{index + 1}. {team.name}</span>
          <strong>{team.score} điểm / {team.hp} máu</strong>
        </div>
      ))}
    </section>
  );
};

const SupportInventory = ({ currentTeamId, items = [], onUse, teams = [] }) => {
  const opponents = teams.filter((team) => team.id !== currentTeamId);
  const [targets, setTargets] = useState({});
  const [traps, setTraps] = useState({});

  const trapDraft = (item) => traps[item.instanceId] || { x: 1, y: 1 };
  const targetDraft = (item) => targets[item.instanceId] || opponents[0]?.id || "";

  return (
    <div className="support-inventory">
      <h3>{"Vật phẩm hỗ trợ"}</h3>
      {items.length ? (
        <div className="support-list rich">
          {items.map((item) => (
            <article className="support-item-card" key={item.instanceId || item.type}>
              <span className="support-token" style={{ "--item-color": item.color }}>{item.symbol}</span>
              <div>
                <strong>{item.name}</strong>
                <small>{item.description}</small>
              </div>
              {item.type === SUPPORT_ITEM_TYPES.SHIELD ? (
                <em>{"Tự kích hoạt"}</em>
              ) : item.type === SUPPORT_ITEM_TYPES.FREEZE_OPPONENT ? (
                <div className="item-use-row">
                  <select value={targetDraft(item)} onChange={(event) => setTargets({ ...targets, [item.instanceId]: event.target.value })}>
                    {opponents.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                  </select>
                  <button onClick={() => onUse({ itemInstanceId: item.instanceId, targetTeamId: targetDraft(item) })} type="button">{"Dùng"}</button>
                </div>
              ) : item.type === SUPPORT_ITEM_TYPES.TRAP ? (
                <div className="item-use-row trap-row">
                  <input min="1" max="6" type="number" value={trapDraft(item).x} onChange={(event) => setTraps({ ...traps, [item.instanceId]: { ...trapDraft(item), x: event.target.value } })} />
                  <input min="1" max="6" type="number" value={trapDraft(item).y} onChange={(event) => setTraps({ ...traps, [item.instanceId]: { ...trapDraft(item), y: event.target.value } })} />
                  <button onClick={() => onUse({ itemInstanceId: item.instanceId, x: Number(trapDraft(item).x) - 1, y: Number(trapDraft(item).y) - 1 })} type="button">{"Đặt"}</button>
                </div>
              ) : (
                <button onClick={() => onUse({ itemInstanceId: item.instanceId })} type="button">{"Dùng"}</button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p>{"Chưa có vật phẩm."}</p>
      )}
    </div>
  );
};

const GameplayPanel = ({ state, lastResult, onAuctionBid, onChooseDirection, onAnswer, onCombatBet, onResolveEvent }) => {
  const round = state.round;
  const pending = round?.pendingAnswer;
  const question = round?.currentQuestion;
  const result = pending?.result || lastResult;
  const movementOpen = round?.phase === ROUND_PHASES.MOVEMENT;
  const waitingForAnswer = Boolean(question && pending && !pending.answered);
  const waitingForOthers = movementOpen && pending?.answered;
  const canChooseDirection = movementOpen && !pending;

  return (
    <section className="gameplay two-col">
      <div className="gameplay-left">
        <section className="game-card map-card">
          <div className="section-head">
            <p>{"V\u00f2ng " + (round?.roundNumber || 1) + " / " + (phaseLabels[round?.phase] || "Di chuy\u1ec3n")}</p>
            <h2>{"M\u00ea cung \u0111\u00e3 kh\u00e1m ph\u00e1"}</h2>
          </div>
          <GameplayBoard team={state.team} />
        </section>

        <section className="game-card move-card">
          <div className="section-head">
            <p>{"Di chuy\u1ec3n"}</p>
            <h2>{canChooseDirection ? "Ch\u1ecdn h\u01b0\u1edbng \u0111i" : "Tr\u1ea1ng th\u00e1i l\u01b0\u1ee3t"}</h2>
          </div>
          <DirectionControls
            disabled={!canChooseDirection}
            onChooseDirection={onChooseDirection}
            pendingDirection={pending?.direction}
          />
          <div className="turn-note">
            {canChooseDirection && "Ch\u1ecdn m\u1ed9t h\u01b0\u1edbng \u0111\u1ec3 nh\u1eadn c\u00e2u h\u1ecfi."}
            {waitingForAnswer && "\u0110\u00e3 kh\u00f3a h\u01b0\u1edbng: " + directionLabels[pending.direction] + ". Tr\u1ea3 l\u1eddi \u0111\u1ec3 di chuy\u1ec3n."}
            {waitingForOthers && "\u0110\u00e3 xong l\u01b0\u1ee3t. \u0110ang ch\u1edd c\u00e1c \u0111\u1ed9i c\u00f2n l\u1ea1i."}
            {round?.phase === ROUND_PHASES.AUCTION && "Đang mở vòng đấu giá kín."}
            {round?.phase === ROUND_PHASES.COMBAT && "Đang mở đối kháng kín."}
          </div>
        </section>
      </div>

      <div className="gameplay-right">
        <QuestionCard answered={Boolean(pending?.answered)} onAnswer={onAnswer} question={question} />
        <PendingEventCard event={round?.pendingEvent} onResolve={onResolveEvent} />
        <AuctionPanel active={round?.phase === ROUND_PHASES.AUCTION} auction={round?.auction} onBid={onAuctionBid} />
        <CombatPanel
          active={round?.phase === ROUND_PHASES.COMBAT}
          combat={round?.combat}
          currentTeamId={state.team.id}
          onBet={onCombatBet}
        />
        <ResultCard result={result} />
        <NoticePanel messages={round?.messages || []} />
        <Leaderboard teams={state.leaderboard || []} />
      </div>
    </section>
  );
};

const EVENT_TICKER_TEXT = "★ SỰ KIỆN ".repeat(8);
const EVENT_FLIP_DELAY = 1200;

const EventReveal = ({ reveal, onClose }) => {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!reveal) return undefined;
    setFlipped(false);
    const timer = setTimeout(() => setFlipped(true), EVENT_FLIP_DELAY);
    return () => clearTimeout(timer);
  }, [reveal?.nonce]);

  if (!reveal) return null;

  const event = reveal.event;
  const meta = getEventTileMeta(event.type) || {};
  const color = event.color || meta.color || "#f0b94b";
  const symbol = event.symbol || meta.symbol || "?";
  const name = event.name || meta.name || "Sự kiện";
  const desc = meta.description || event.message || "Đã kích hoạt ô sự kiện.";

  // Với các sự kiện xử lý ngay (không có bước tiếp theo), hiện luôn kết quả trong thẻ.
  let outcome = null;
  if (event.item) {
    outcome = { badge: { symbol: event.item.symbol, color: event.item.color }, text: "Nhận: " + event.item.name };
  } else if (event.newPosition) {
    outcome = { text: "Dịch chuyển tới (" + (event.newPosition.x + 1) + ", " + (event.newPosition.y + 1) + ")" };
  } else if (event.opponentName) {
    outcome = { text: "Đấu với " + event.opponentName };
  }

  const hasChallenge =
    event.type === EVENT_TILE_TYPES.KNOWLEDGE || event.type === EVENT_TILE_TYPES.POSITION_SWAP;

  return (
    <div className="event-overlay" role="dialog" aria-label={name}>
      <div className="event-ticker">
        <div className="event-ticker-track">
          <span>{EVENT_TICKER_TEXT}</span>
          <span>{EVENT_TICKER_TEXT}</span>
        </div>
      </div>
      <div className="event-stage">
        {!flipped ? (
          <>
            <div className="event-card waiting">
              <span>?</span>
            </div>
            <p className="event-wait-note">{"Đội của bạn vừa trúng ô sự kiện..."}</p>
          </>
        ) : (
          <>
            <div className="event-card flipped" style={{ "--event-color": color }}>
              <span className="event-card-icon">{symbol}</span>
            </div>
            <h2 className="event-name">{name}</h2>
            <p className="event-desc">{desc}</p>
            {outcome && (
              <div className="event-outcome">
                {outcome.badge && (
                  <span className="event-outcome-badge" style={{ "--event-color": outcome.badge.color }}>
                    {outcome.badge.symbol}
                  </span>
                )}
                <span>{outcome.text}</span>
              </div>
            )}
            <button className="event-start" onClick={onClose} type="button">
              {hasChallenge ? "Bắt đầu thử thách" : "Tiếp tục"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [teamCode, setTeamCode] = useState("");
  const [state, setState] = useState(null);
  const [localError, setLocalError] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [reveal, setReveal] = useState(null);
  const teamIdRef = useRef(null);
  const socket = useMemo(() => io(SERVER_URL, { autoConnect: false, reconnectionAttempts: 3 }), []);
  const [socketStatus, setSocketStatus] = useState(socket.connected ? "đã kết nối" : "đang kết nối");

  useEffect(() => {
    const onState = (nextState) => {
      console.log("player game:state", nextState);
      setState(nextState);
      setLocalError("");
      teamIdRef.current = nextState?.team?.id || teamIdRef.current;
      if (nextState?.team && nextState.round?.pendingAnswer?.result) {
        setLastResult(nextState.round.pendingAnswer.result);
      }
    };
    const onRoundResult = (result) => {
      if (result?.teamId === teamIdRef.current) {
        setLastResult(result);
        if (result.event) {
          setReveal({ event: result.event, nonce: Date.now() });
        }
      }
    };
    const onConnect = () => {
      setSocketStatus("đã kết nối");
      setLocalError("");
    };
    const onDisconnect = () => setSocketStatus("mất kết nối");
    const onConnectError = () => {
      setSocketStatus("mất kết nối");
      setLocalError("Không thể kết nối máy chủ. Hãy chạy npm run dev rồi tải lại trang.");
    };

    socket.on(EVENTS.GAME_STATE, onState);
    socket.on(EVENTS.ROUND_RESULT, onRoundResult);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.connect();

    return () => {
      socket.off(EVENTS.GAME_STATE, onState);
      socket.off(EVENTS.ROUND_RESULT, onRoundResult);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.disconnect();
    };
  }, [socket]);

  const joinTeam = (event) => {
    event.preventDefault();
    const id = normalizeTeamCode(teamCode);

    if (!socket.connected) {
      setLocalError("Chưa kết nối máy chủ. Hãy chạy npm run dev rồi tải lại trang.");
      return;
    }

    if (!id) {
      setLocalError("Nhập mã đội trước.");
      return;
    }

    setLocalError("");
    setLastResult(null);
    socket.emit(EVENTS.TEAM_JOIN, { teamId: id });
  };

  const submitMaze = (draft) => {
    socket.emit(EVENTS.SETUP_SUBMIT_MAZE, draft);
  };

  const chooseDirection = (direction) => {
    setLastResult(null);
    socket.emit(EVENTS.MOVE_CHOOSE, { direction });
  };

  const answerQuestion = (answerIndex) => {
    socket.emit(EVENTS.QUESTION_ANSWER, { answerIndex });
  };

  const resolveEvent = (payload) => {
    socket.emit(EVENTS.EVENT_RESOLVE, payload);
  };

  const submitAuctionBid = (payload) => {
    socket.emit(EVENTS.AUCTION_BID, payload);
  };

  const submitCombatBet = (payload) => {
    socket.emit(EVENTS.COMBAT_BET, payload);
  };

  const useSupport = (payload) => {
    socket.emit(EVENTS.SUPPORT_USE, payload);
  };

  const visibleError = localError || state?.error;

  return (
    <main>
      <EventReveal reveal={reveal} onClose={() => setReveal(null)} />
      <section className={state?.setup?.started ? "panel playing" : "panel"}>
        <p>Màn hình đội chơi</p>
        <h1>{APP_TITLE}</h1>
        <div className={socketStatus === "đã kết nối" ? "connection online" : "connection"}>
          Máy chủ: {socketStatus}
        </div>

        <form onSubmit={joinTeam}>
          <label htmlFor="teamCode">Mã đội</label>
          <div className="join-row">
            <input
              id="teamCode"
              placeholder="team1"
              value={teamCode}
              onChange={(event) => setTeamCode(event.target.value)}
            />
            <button type="submit">Vào đội</button>
          </div>
        </form>

        {visibleError && <div className="error">{visibleError}</div>}

        {state?.team && (
          <>
            <div className="state-card">
              <h2>{state.team.name}</h2>
              <dl>
                <div>
                  <dt>Điểm</dt>
                  <dd>{state.team.score}</dd>
                </div>
                <div>
                  <dt>Máu</dt>
                  <dd>{state.team.hp}</dd>
                </div>
                <div>
                  <dt>Vị trí</dt>
                  <dd>{state.team.position.x}, {state.team.position.y}</dd>
                </div>
              </dl>
              <SupportInventory
                currentTeamId={state.team.id}
                items={state.team.supportItems || []}
                onUse={useSupport}
                teams={state.teams || []}
              />
            </div>

            {!state.setup?.started ? (
              <SetupBoard state={state} onSubmit={submitMaze} />
            ) : (
              <GameplayPanel
                lastResult={lastResult}
                onAnswer={answerQuestion}
                onAuctionBid={submitAuctionBid}
                onChooseDirection={chooseDirection}
                onCombatBet={submitCombatBet}
                onResolveEvent={resolveEvent}
                state={state}
              />
            )}
          </>
        )}
      </section>
    </main>
  );
}
