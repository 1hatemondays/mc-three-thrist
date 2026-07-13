import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { EVENTS } from "../../shared/constants.js";
import { getEventTileMeta } from "../../shared/gameContent.js";
import { hasWall } from "../../shared/maze.js";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  `${window.location.protocol}//${window.location.hostname === "0.0.0.0" ? "localhost" : window.location.hostname}:3000`;
const BOARD_SIZE = 6;
const APP_TITLE = "M\u00ea Cung Tri Th\u1ee9c";

const TEAM_COLORS = ["#f0b94b", "#65c8a2", "#ef8f6b", "#7bb7ff", "#d995ff", "#f4e06d", "#8bd6e8", "#f7a6c8"];
const TEAM_ICONS = ["♠", "♥", "◆", "♣", "★", "✦", "●", "▲"];
// Ô sự kiện trên màn TV hiển thị đồng nhất, không lộ loại — giữ tính bí ẩn.
const MYSTERY_EVENT = { symbol: "?", color: "#d995ff" };
const CONFETTI_COUNT = 60;
const CONFETTI_COLORS = ["#f0b94b", "#65c8a2", "#ef8f6b", "#7bb7ff", "#d995ff", "#fff9e9"];
const pointKey = (point) => (point ? `${point.x}:${point.y}` : "");
const teamColor = (index) => TEAM_COLORS[index % TEAM_COLORS.length];
const teamIcon = (index) => TEAM_ICONS[index % TEAM_ICONS.length];

// Confetti tất định theo `seed` để mỗi lần thắng tạo lại một lớp mảnh giấy mới.
const Confetti = ({ seed, count = CONFETTI_COUNT }) => {
  if (!seed) return null;

  const rand = (i, salt) => {
    const v = Math.sin(i * 127.1 + salt * 311.7 + seed * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };

  const pieces = Array.from({ length: count }, (_, i) => (
    <div
      className="tv-confetti-piece"
      key={seed + "-" + i}
      style={{
        left: (rand(i, 1) * 100).toFixed(1) + "%",
        width: 7 + rand(i, 2) * 6,
        height: 11 + rand(i, 3) * 8,
        background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        transform: "rotate(" + Math.round(rand(i, 4) * 360) + "deg)",
        animation:
          "evConf " + (1.5 + rand(i, 5) * 1.2).toFixed(2) + "s linear " + (rand(i, 6) * 0.7).toFixed(2) + "s forwards"
      }}
    />
  ));

  return (
    <div className="tv-confetti" key={"conf-" + seed}>
      {pieces}
    </div>
  );
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

const Board = ({ cardLabel, eventTiles = [], metaLabel, submitted, team }) => {
  const startKey = pointKey(team.startPoint);
  const endKey = pointKey(team.endPoint);
  const positionKey = pointKey(team.position);
  const walls = team.walls || [];

  return (
    <section className="team-card">
      <header>
        <div>
          <strong>{cardLabel}</strong>
          <small>{metaLabel}</small>
        </div>
        <span className={submitted ? "status ready" : "status"}>{submitted ? "Đã nộp" : "Đang chờ"}</span>
      </header>

      <div className="board" aria-label={`${cardLabel} maze`}>
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
          const x = index % BOARD_SIZE;
          const y = Math.floor(index / BOARD_SIZE);
          const key = `${x}:${y}`;
          const eventTile = eventTiles.find((tile) => tile.x === x && tile.y === y);
          const eventMeta = eventTile ? getEventTileMeta(eventTile.type) : null;
          const classes = ["board-cell"];
          if (key === startKey) classes.push("start");
          if (key === endKey) classes.push("end");
          if (key === positionKey) classes.push("active");

          return (
            <div className={classes.join(" ")} key={key} style={{ gridColumn: x * 2 + 2, gridRow: y * 2 + 2 }}>
              {eventMeta && (
                <span className="event-marker board-event" style={{ "--event-color": eventMeta.color }} title={eventMeta.name}>
                  {eventMeta.symbol}
                </span>
              )}
              {key === startKey ? "S" : key === endKey ? "E" : ""}
            </div>
          );
        })}

        {BORDER_SEGMENTS.map((edge) => (
          <div
            aria-hidden="true"
            className={`board-edge border ${edge.orientation}`}
            key={`border-${edge.side}-${edge.x}-${edge.y}`}
            style={edgeGridPosition(edge)}
          />
        ))}

        {INTERIOR_EDGES.map((edge) => {
          const active = hasWall(walls, BOARD_SIZE, edge.x, edge.y, edge.side);
          return (
            <div
              aria-hidden="true"
              className={`board-edge ${edge.orientation}${active ? " active" : ""}`}
              key={`edge-${edge.side}-${edge.x}-${edge.y}`}
              style={edgeGridPosition(edge)}
            />
          );
        })}
      </div>
    </section>
  );
};

const GuideScreen = ({ state, banner, confettiSeed, flashSeed }) => {
  const teams = state?.teams || [];
  const round = state?.round;
  const setupStarted = Boolean(state?.setup?.started);
  const eventTiles = setupStarted ? round?.eventTiles || [] : [];

  return (
    <main className="guide-screen">
      <header className="guide-top">
        <div>
          <p>{"M\u00e0n d\u1eabn tr\u00f2 ch\u01a1i"}</p>
          <h1>{APP_TITLE}</h1>
        </div>
        <strong>
          {state
            ? setupStarted
              ? "V\u00f2ng " + (round?.roundNumber || 1)
              : "\u0110ang thi\u1ebft l\u1eadp"
            : "\u0110ang k\u1ebft n\u1ed1i..."}
        </strong>
      </header>

      <section className="guide-layout">
        <div className="guide-map-wrap">
          <div className="guide-map" aria-label={"B\u1ea3n \u0111\u1ed3 ch\u00ednh 6x6"}>
            {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
              const x = index % BOARD_SIZE;
              const y = Math.floor(index / BOARD_SIZE);
              const cellTeams = teams.filter((team) => team.position?.x === x && team.position?.y === y);
              const eventTile = eventTiles.find((tile) => tile.x === x && tile.y === y);
              const bobDelay = ((index % 7) * 0.25).toFixed(2) + "s";

              return (
                <div className="guide-cell" key={x + ":" + y}>
                  <span className="guide-coord">{x + 1}.{y + 1}</span>
                  {eventTile && !cellTeams.length && (
                    <span className="guide-event-marker" style={{ animationDelay: bobDelay }} title="Ô sự kiện bí ẩn">
                      <span className="guide-event-ring" style={{ borderColor: MYSTERY_EVENT.color, animationDelay: bobDelay }} />
                      <span className="event-marker mystery" style={{ "--event-color": MYSTERY_EVENT.color }}>
                        {MYSTERY_EVENT.symbol}
                      </span>
                    </span>
                  )}
                  <div className="guide-markers">
                    {cellTeams.map((team) => {
                      const realIndex = teams.findIndex((item) => item.id === team.id);
                      return (
                        <span
                          className="team-marker round bob"
                          key={team.id}
                          style={{ "--team-color": teamColor(realIndex), animationDelay: bobDelay }}
                          title={team.name}
                        >
                          {teamIcon(realIndex)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <Confetti seed={confettiSeed} />
          {flashSeed ? <div className="tv-flash" key={"flash-" + flashSeed} /> : null}

          {banner && (
            <div className="tv-banner" key={banner.key}>
              <span className="tv-banner-icon" style={{ background: banner.color || "#f0b94b" }}>
                {banner.symbol}
              </span>
              <div>
                <strong>{banner.title}</strong>
                <span>{banner.text}</span>
              </div>
            </div>
          )}
        </div>

        <aside className="guide-panel">
          <h2>{"V\u1ecb tr\u00ed \u0111\u1ed9i"}</h2>
          {teams.map((team, index) => (
            <div className="guide-team" key={team.id}>
              <span className="team-marker round" style={{ "--team-color": teamColor(index) }}>
                {teamIcon(index)}
              </span>
              <div>
                <strong>{team.name}</strong>
                <small>
                  ({(team.position?.x ?? 0) + 1}, {(team.position?.y ?? 0) + 1}) / {team.score} {"\u0111i\u1ec3m"}
                </small>
              </div>
            </div>
          ))}
        </aside>
      </section>
    </main>
  );
};

const HostRoundBoxes = ({ round }) => {
  if (!round) return null;
  const auction = round.auction;
  const combat = round.combat;

  return (
    <div className="host-boxes">
      <section className="host-box">
        <p>{"Pha hiện tại"}</p>
        <strong>{round.phase === "auction" ? "Đấu giá kín" : round.phase === "combat" ? "Đối kháng" : "Di chuyển"}</strong>
        <small>{"Vòng " + (round.roundNumber || 1)}</small>
      </section>

      {auction && (round.phase === "auction" || auction.result) && (
        <section className="host-box auction-box">
          <p>{"Đấu giá"}</p>
          <strong>{auction.submittedCount + "/" + auction.totalTeams + " đội đã gửi"}</strong>
          {auction.result?.winners?.length ? (
            auction.result.winners.map((winner) => (
              <small key={winner.teamId + winner.itemId}>{winner.teamName + " thắng " + winner.itemName}</small>
            ))
          ) : (
            <small>{"Không hiển thị giá cho tới khi chốt."}</small>
          )}
        </section>
      )}

      {combat && (round.phase === "combat" || combat.result) && (
        <section className="host-box combat-box">
          <div className="combat-box-head">
            <p>Đối kháng trực tiếp</p>
            <span>{combat.result ? "Kết quả" : combat.submittedCount + "/2 đã khóa"}</span>
          </div>
          <div className="combat-matchup">
            <strong>{combat.attacker?.name || "Đội thách đấu"}</strong>
            <b>VS</b>
            <strong>{combat.defender?.name || "Đội phòng thủ"}</strong>
          </div>
          {!combat.result && (
            <div className="combat-box-progress" aria-label={combat.submittedCount + " trên 2 đội đã đặt cược"}>
              <span className={combat.submittedCount > 0 ? "locked" : ""} />
              <span className={combat.submittedCount > 1 ? "locked" : ""} />
            </div>
          )}
          <small>
            {combat.result
              ? combat.result.shielded
                ? combat.result.winnerName + " thắng · lá chắn đã chặn sát thương"
                : combat.result.winnerName + " thắng · " + combat.result.loserName + " mất " + combat.result.hpLoss + " HP"
              : "Điểm cược đang được niêm phong."}
          </small>
        </section>
      )}
    </div>
  );
};

export default function App() {
  const [state, setState] = useState(null);
  const [tvBanner, setTvBanner] = useState(null);
  const [confettiSeed, setConfettiSeed] = useState(0);
  const [flashSeed, setFlashSeed] = useState(0);
  const socketRef = useRef(null);
  const teamsRef = useRef([]);
  const bannerTimerRef = useRef(null);

  useEffect(() => {
    const socket = io(SERVER_URL, { auth: { role: "host" } });
    socketRef.current = socket;

    const showBanner = (banner, celebrate) => {
      clearTimeout(bannerTimerRef.current);
      setTvBanner({ ...banner, key: Date.now() });
      if (celebrate) {
        setConfettiSeed((n) => n + 1);
        setFlashSeed((n) => n + 1);
      }
      bannerTimerRef.current = setTimeout(() => setTvBanner(null), 4300);
    };

    const onState = (nextState) => {
      console.log("host game:state", nextState);
      setState(nextState);
      teamsRef.current = nextState?.teams || [];
    };

    const onRoundResult = (result) => {
      if (!result?.event) return;
      const team = teamsRef.current.find((item) => item.id === result.teamId);
      const event = result.event;
      showBanner({
        title: (team?.name || "Một đội") + " kích hoạt " + event.name + "!",
        text: event.message || event.name,
        color: event.color,
        symbol: event.symbol
      });
    };

    const onCombatResult = (combat) => {
      if (!combat) return;
      showBanner(
        {
          title: (combat.winnerName || "Một đội") + " thắng đối kháng!",
          text: combat.shielded
            ? (combat.loserName || "Đối thủ") + " được lá chắn bảo vệ."
            : (combat.loserName || "Đối thủ") + " mất " + (combat.hpLoss ?? 0) + " máu.",
          color: "#ef8f6b",
          symbol: "VS"
        },
        true
      );
    };

    socket.on(EVENTS.GAME_STATE, onState);
    socket.on(EVENTS.ROUND_RESULT, onRoundResult);
    socket.on(EVENTS.COMBAT_RESULT, onCombatResult);

    return () => {
      clearTimeout(bannerTimerRef.current);
      socket.off(EVENTS.GAME_STATE, onState);
      socket.off(EVENTS.ROUND_RESULT, onRoundResult);
      socket.off(EVENTS.COMBAT_RESULT, onCombatResult);
      socketRef.current = null;
      socket.disconnect();
    };
  }, []);

  const teams = state?.teams || [];
  const submitted = new Set(Object.keys(state?.setup?.submissions || {}));
  const setupPreviews = state?.setup?.previews || {};
  const setupStarted = Boolean(state?.setup?.started);
  const isSetupReview = !setupStarted;
  const canStartGame = Boolean(state?.setup?.complete && !setupStarted);
  const isGuideScreen = window.location.pathname.replace(/\/+$/, "") === "/guide";

  const startGame = () => {
    socketRef.current?.emit(EVENTS.SETUP_START_GAME);
  };


  if (isGuideScreen) {
    return (
      <GuideScreen
        banner={tvBanner}
        confettiSeed={confettiSeed}
        flashSeed={flashSeed}
        state={state}
      />
    );
  }

  return (
    <main>
      <header className="topbar">
        <div>
          <p>{"M\u00e0n h\u00ecnh host"}</p>
          <h1>{APP_TITLE}</h1>
        </div>

        <div className="admin-controls">
          <span className="joined-pill">{teams.length + " đội đã vào"}</span>
          <button disabled={!canStartGame} onClick={startGame} type="button">
            {"B\u1eaft \u0111\u1ea7u"}
          </button>
          <a className="guide-link" href="/guide" rel="noreferrer" target="_blank">
            {"M\u00e0n d\u1eabn"}
          </a>
        </div>

        <span>
          {state
            ? teams.length + " đội đã vào / " + submitted.size + " đội đã nộp mê cung"
            : "\u0110ang k\u1ebft n\u1ed1i..."}
        </span>
      </header>

      {state?.error && <div className="host-error">{state.error}</div>}

      <section className="layout">
        <div className="maps">
          {teams.map((team) => {
            if (!isSetupReview) {
              return (
                <Board
                  cardLabel={team.name}
                  key={team.id}
                  metaLabel={team.startPoint ? "\u0110\u00e3 s\u1eb5n s\u00e0ng" : "\u0110ang ch\u1edd m\u00ea cung"}
                  eventTiles={state?.round?.eventTiles || []}
                  submitted={submitted.has(team.id)}
                  team={team}
                />
              );
            }

            const preview = setupPreviews[team.id];
            const targetName = teams.find((item) => item.id === preview?.targetTeamId)?.name;

            return (
              <Board
                cardLabel={team.name}
                key={team.id}
                metaLabel={
                  preview
                    ? "T\u1ea1o m\u00ea cung cho " + (targetName || preview.targetTeamId)
                    : "\u0110ang ch\u1edd n\u1ed9p"
                }
                submitted={submitted.has(team.id)}
                team={preview || { ...team, walls: [], startPoint: null, endPoint: null }}
              />
            );
          })}
        </div>

        <aside className="leaderboard">
          <HostRoundBoxes round={state?.round} />

          <h2>{"B\u1ea3ng \u0111i\u1ec3m"}</h2>
          {teams.map((team) => (
            <div className="rank" key={team.id}>
              <span>{team.name}</span>
              <strong>{team.score} {"\u0111i\u1ec3m"} / {team.hp} {"m\u00e1u"}</strong>
            </div>
          ))}

          <h2 className="setup-title">{"Thi\u1ebft l\u1eadp"}</h2>
          <div className="rank">
            <span>{"Tr\u1ea1ng th\u00e1i"}</span>
            <strong>
              {setupStarted
                ? "\u0110ang ch\u01a1i"
                : state?.setup?.complete
                  ? "Ch\u1edd b\u1eaft \u0111\u1ea7u"
                  : "\u0110ang n\u1ed9p m\u00ea cung"}
            </strong>
          </div>
          {teams.map((team) => (
            <div className="rank" key={team.id + "-setup"}>
              <span>{team.name}</span>
              <strong>{submitted.has(team.id) ? "\u0110\u00e3 n\u1ed9p" : "\u0110ang ch\u1edd"}</strong>
            </div>
          ))}
        </aside>
      </section>
    </main>
  );
}
