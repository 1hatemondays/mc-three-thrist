import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { EVENTS } from "../../shared/constants.js";
import { GameOverOverlay } from "../../shared/GameOverOverlay.jsx";
import { BombOverlay } from "../../shared/BombOverlay.jsx";
import { MeteorShowerOverlay } from "../../shared/MeteorShowerOverlay.jsx";
import { FinalKahootLeaderboard, FinalStatsCard } from "../../shared/FinalStats.jsx";
import { EVENT_TILE_TYPES, getEventTileMeta } from "../../shared/gameContent.js";
import { hasWall } from "../../shared/maze.js";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.DEV
    ? `${window.location.protocol}//${window.location.hostname === "0.0.0.0" ? "localhost" : window.location.hostname}:3000`
    : window.location.origin);
const GUIDE_URL = `${import.meta.env.BASE_URL}guide`;
const BOARD_SIZE = 6;
const APP_TITLE = "M\u00ea Cung Tri Th\u1ee9c";
const HOST_ACCESS_KEY_STORAGE = "maze-of-knowledge:host-access-key";

const loadHostAccessKey = () => {
  try {
    return window.sessionStorage.getItem(HOST_ACCESS_KEY_STORAGE) || "";
  } catch {
    return "";
  }
};

const saveHostAccessKey = (accessKey) => {
  try {
    window.sessionStorage.setItem(HOST_ACCESS_KEY_STORAGE, accessKey);
  } catch {
    // The current tab can stay unlocked even when storage is unavailable.
  }
};

const clearHostAccessKey = () => {
  try {
    window.sessionStorage.removeItem(HOST_ACCESS_KEY_STORAGE);
  } catch {
    // Nothing else is required when storage is unavailable.
  }
};

const TEAM_COLORS = ["#f0b94b", "#65c8a2", "#ef8f6b", "#7bb7ff", "#d995ff", "#f4e06d", "#8bd6e8", "#f7a6c8"];
const TEAM_ICONS = ["♠", "♥", "◆", "♣", "★", "✦", "●", "▲"];
// Ô sự kiện trên màn TV hiển thị đồng nhất, không lộ loại — giữ tính bí ẩn.
const MYSTERY_EVENT = { symbol: "?", color: "#d995ff" };
const GLOBAL_EVENT_TYPES = new Set([
  EVENT_TILE_TYPES.MONSTER_ATTACK,
  EVENT_TILE_TYPES.METEOR_STRIKE,
  EVENT_TILE_TYPES.BLESSING
]);
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
const EventAnnouncement = ({ banner }) => {
  if (!banner) return null;
  const eventClass = banner.type ? " event-" + banner.type : "";

  return (
    <div
      aria-atomic="true"
      aria-live="assertive"
      className={"tv-event-layer" + (banner.global ? " global" : "") + eventClass}
      role="status"
    >
      <div className="tv-banner" key={banner.key}>
        <span className="tv-banner-icon" style={{ background: banner.color || "#f0b94b" }}>
          {banner.symbol}
        </span>
        <div>
          <strong>{banner.title}</strong>
          <span>{banner.text}</span>
        </div>
      </div>
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

      <div className="board" aria-label={`${cardLabel} mê cung`}>
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

const GuideScreen = ({ state, activeTeam, banner, confettiSeed, flashSeed, onOpenQuestion, onRevealQuestion, onShowLeaderboard }) => {
  const teams = state?.teams || [];
  const round = state?.round;
  const gameOver = state?.gameOver || null;
  const rankingRows = gameOver?.rankings || teams;
  const setupStarted = Boolean(state?.setup?.started);
  const eventTiles = setupStarted ? round?.eventTiles || [] : [];

  return (
    <main className="guide-screen">
      <GameOverOverlay gameOver={state?.gameOver} />
      <BombOverlay bomb={state?.round?.bomb} />
      <MeteorShowerOverlay meteor={state?.round?.meteorShower} />
      <header className="guide-top">
        <div>
          <p>Màn dẫn trò chơi</p>
          <h1>{APP_TITLE}</h1>
        </div>
        <strong>
          {state
            ? gameOver
              ? "Chung cuộc"
              : setupStarted
              ? "Vòng " + (round?.roundNumber || 1)
              : "Đang thiết lập"
            : "Đang kết nối..."}
        </strong>
      </header>

      <section className="guide-layout">
        <div className="guide-map-wrap">
          <div className="guide-map" aria-label="Bản đồ chính 6x6">
            {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
              const x = index % BOARD_SIZE;
              const y = Math.floor(index / BOARD_SIZE);
              const cellTeams = teams.filter((team) => team.position?.x === x && team.position?.y === y);
              const visibleTeams = cellTeams.slice(0, 4);
              const extraTeamCount = Math.max(0, cellTeams.length - visibleTeams.length);
              const eventTile = eventTiles.find((tile) => tile.x === x && tile.y === y);
              const bobDelay = ((index % 7) * 0.25).toFixed(2) + "s";

              return (
                <div
                  className={"guide-cell" + (cellTeams.length > 1 ? " has-stack" : "")}
                  key={x + ":" + y}
                  style={{ gridColumn: x * 2 + 2, gridRow: y * 2 + 2 }}
                >
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
                    {visibleTeams.map((team) => {
                      const realIndex = teams.findIndex((item) => item.id === team.id);
                      return (
                        <span
                          className={"team-marker round" + (cellTeams.length === 1 ? " bob" : " mini")}
                          key={team.id}
                          style={{ "--team-color": teamColor(realIndex), animationDelay: bobDelay }}
                          title={team.name}
                        >
                          {teamIcon(realIndex)}
                        </span>
                      );
                    })}
                    {extraTeamCount > 0 && <span className="team-marker-overflow">+{extraTeamCount}</span>}
                  </div>
                </div>
              );
            })}

            {BORDER_SEGMENTS.map((edge) => (
              <div
                aria-hidden="true"
                className={`guide-edge border ${edge.orientation}`}
                key={`guide-border-${edge.side}-${edge.x}-${edge.y}`}
                style={edgeGridPosition(edge)}
              />
            ))}

            {INTERIOR_EDGES.map((edge) => (
              <div
                aria-hidden="true"
                className={`guide-edge ${edge.orientation}`}
                key={`guide-edge-${edge.side}-${edge.x}-${edge.y}`}
                style={edgeGridPosition(edge)}
              />
            ))}
          </div>

          <Confetti seed={confettiSeed} />
          {flashSeed ? <div className="tv-flash" key={"flash-" + flashSeed} /> : null}
          <EventAnnouncement banner={banner} />
        </div>

        <aside className="guide-panel">
          <HostRoundBoxes
            activeTeam={activeTeam}
            gameOver={gameOver}
            onOpenQuestion={onOpenQuestion}
            onRevealQuestion={onRevealQuestion}
            onShowLeaderboard={onShowLeaderboard}
            round={round}
          />
          <h2>{gameOver ? "Xếp hạng chung cuộc" : "Vị trí đội"}</h2>
          {rankingRows.map((team, index) => (
            <div className="guide-team" key={team.teamId || team.id}>
              <span className="team-marker round" style={{ "--team-color": teamColor(index) }}>
                {teamIcon(index)}
              </span>
              <div>
                <strong>{gameOver ? "#" + team.placement + " · " + team.teamName : team.name}</strong>
                <small>
                  {gameOver
                    ? team.score + " điểm / " + team.hp + " máu"
                    : "(" + ((team.position?.x ?? 0) + 1) + ", " + ((team.position?.y ?? 0) + 1) + ")"}
                </small>
              </div>
            </div>
          ))}
        </aside>
      </section>
    </main>
  );
};

const HostRoundBoxes = ({ activeTeam, gameOver, onOpenQuestion, onRevealQuestion, onShowLeaderboard, round }) => {
  if (!round) return null;
  const auction = round.auction;
  const combat = round.combat;
  const questionControl = round.questionControl;
  const correctChoice = questionControl?.question?.choices?.[questionControl.question.correctIndex];

  return (
    <div className="host-boxes">
      {gameOver && (
        <section className="host-box game-over-box">
          <p>Kết thúc</p>
          <strong>{gameOver.winnerName} về đích đầu tiên</strong>
          <small>
            {gameOver.stage === "leaderboard"
              ? "Đang chiếu bảng xếp hạng kiểu Kahoot."
              : "Đang xem thống kê từng đội."}
          </small>
          {gameOver.stage !== "leaderboard" && (
            <button className="host-box-action" onClick={onShowLeaderboard} type="button">
              Hiện bảng xếp hạng cuối
            </button>
          )}
        </section>
      )}

      <section className="host-box">
        <p>{"Pha hiện tại"}</p>
        <strong>
          {gameOver ? "Trò chơi kết thúc" : round.phase === "auction" ? "Đấu giá kín" : round.phase === "combat" ? "Đối kháng" : round.phase === "meteorShower" ? "Đấu trí" : round.phase === "bomb" ? "Bom" : "Di chuyển"}
        </strong>
        <small>{"Vòng " + (round.roundNumber || 1)}</small>
      </section>

      {!gameOver && (
        <section className="host-box active-spotlight">
          <p>{"Đội đang lượt"}</p>
          <strong>{activeTeam?.name || "Chưa có đội đang lượt"}</strong>
          <small>
            {round.turnEnergy
              ? "Năng lượng " + round.turnEnergy.remaining + "/" + round.turnEnergy.max
              : "Chờ lượt mới"}
          </small>
        </section>
      )}

      {questionControl && !gameOver && (
        <section className="host-box host-question-box">
          <p>{"Câu hỏi người dẫn"}</p>
          <strong>{questionControl.question?.text}</strong>
          <ol>
            {(questionControl.question?.choices || []).map((choice, index) => (
              <li className={questionControl.reveal && index === questionControl.question.correctIndex ? "correct" : ""} key={choice}>
                {String.fromCharCode(65 + index)}. {choice}
              </li>
            ))}
          </ol>
          {!questionControl.answerOpen && !questionControl.answered && (
            <button className="host-box-action" onClick={onOpenQuestion} type="button">Mở trả lời</button>
          )}
          {questionControl.answered && !questionControl.reveal && (
            <button className="host-box-action" onClick={onRevealQuestion} type="button">Hiện đáp án</button>
          )}
          {questionControl.reveal && <small>{"Đáp án đúng: " + correctChoice}</small>}
        </section>
      )}

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
            <b>ĐẤU</b>
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
                : combat.result.winnerName + " thắng đối kháng"
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
  const [hostAccessKey, setHostAccessKey] = useState(loadHostAccessKey);
  const [hostKeyDraft, setHostKeyDraft] = useState("");
  const [hostAuthError, setHostAuthError] = useState("");
  const socketRef = useRef(null);
  const teamsRef = useRef([]);
  const bannerTimerRef = useRef(null);

  useEffect(() => {
    if (!hostAccessKey) return undefined;

    const socket = io(SERVER_URL, {
      auth: { role: "host", accessKey: hostAccessKey }
    });
    socketRef.current = socket;

    const showBanner = (banner, celebrate) => {
      clearTimeout(bannerTimerRef.current);
      setTvBanner({ ...banner, key: Date.now() });
      setFlashSeed((n) => n + 1);
      if (celebrate) setConfettiSeed((n) => n + 1);
      bannerTimerRef.current = setTimeout(() => setTvBanner(null), 4300);
    };

    const onState = (nextState) => {
      console.log("host game:state", nextState);
      setState(nextState);
      teamsRef.current = nextState?.teams || [];
    };

    const onRoundResult = (result) => {
      const team = teamsRef.current.find((item) => item.id === result?.teamId);
      const teamName = team?.name || "Một đội";

      if (result?.event) {
        const event = result.event;
        showBanner({
          title: teamName + " kích hoạt " + event.name + "!",
          text: event.message || event.name,
          color: event.color,
          symbol: event.symbol,
          type: event.type,
          global: GLOBAL_EVENT_TYPES.has(event.type)
        }, event.type === EVENT_TILE_TYPES.BLESSING);
        return;
      }

      if (result?.blockedReason === "wall" || result?.blockedReason === "border") {
        showBanner({
          title: teamName + " chạm tường!",
          text: "Lượt này bị chặn lại.",
          color: "#bd473f",
          symbol: "TƯỜNG"
        });
        return;
      }

      if (result?.success) {
        showBanner({
          title: teamName + " di chuyển tiếp!",
          text: "Đã mở thêm đường đi.",
          color: "#65c8a2",
          symbol: "ĐI"
        });
        return;
      }

      if (result) {
        showBanner({
          title: teamName + " không được di chuyển!",
          text: "Cần chờ lượt kế tiếp.",
          color: "#f0b94b",
          symbol: "DỪNG"
        });
      }
    };

    const onCombatResult = (combat) => {
      if (!combat) return;
      showBanner(
        {
          title: (combat.winnerName || "Một đội") + " thắng đối kháng!",
          text: combat.shielded
            ? (combat.loserName || "Đối thủ") + " được lá chắn bảo vệ."
            : "Hai đội đã phân thắng bại.",
          color: "#ef8f6b",
          symbol: "ĐẤU"
        },
        true
      );
    };

    const onConnectError = (error) => {
      if (!["host_access_denied", "host_access_not_configured"].includes(error?.message)) return;

      clearHostAccessKey();
      setState(null);
      setHostAccessKey("");
      setHostAuthError(
        error.message === "host_access_not_configured"
          ? "M\u00e1y ch\u1ee7 ch\u01b0a c\u1ea5u h\u00ecnh m\u00e3 truy c\u1eadp ng\u01b0\u1eddi d\u1eabn."
          : "M\u00e3 truy c\u1eadp kh\u00f4ng \u0111\u00fang."
      );
    };

    const onGameRestart = () => {
      try {
        window.localStorage.clear();
      } catch {
        // Reload still returns the host to a clean game.
      }
      window.location.reload();
    };

    socket.on(EVENTS.GAME_STATE, onState);
    socket.on(EVENTS.ROUND_RESULT, onRoundResult);
    socket.on(EVENTS.GAME_RESTART, onGameRestart);
    socket.on(EVENTS.COMBAT_RESULT, onCombatResult);
    socket.on("connect_error", onConnectError);

    return () => {
      clearTimeout(bannerTimerRef.current);
      socket.off(EVENTS.GAME_STATE, onState);
      socket.off(EVENTS.ROUND_RESULT, onRoundResult);
      socket.off(EVENTS.GAME_RESTART, onGameRestart);
      socket.off(EVENTS.COMBAT_RESULT, onCombatResult);
      socket.off("connect_error", onConnectError);
      socketRef.current = null;
      socket.disconnect();
    };
  }, [hostAccessKey]);

  const unlockHost = (event) => {
    event.preventDefault();
    const accessKey = hostKeyDraft.trim();

    if (!/^\d{4}$/.test(accessKey)) {
      setHostAuthError("M\u00e3 truy c\u1eadp g\u1ed3m 4 ch\u1eef s\u1ed1.");
      return;
    }

    saveHostAccessKey(accessKey);
    setHostAuthError("");
    setHostKeyDraft("");
    setHostAccessKey(accessKey);
  };

  const lockHost = () => {
    clearHostAccessKey();
    setState(null);
    setHostAuthError("");
    setHostAccessKey("");
  };

  const teams = state?.teams || [];
  const submitted = new Set(Object.keys(state?.setup?.submissions || {}));
  const setupPreviews = state?.setup?.previews || {};
  const setupStarted = Boolean(state?.setup?.started);
  const gameOver = state?.gameOver || null;
  const rankingRows = gameOver?.rankings || teams.map((team) => ({ teamId: team.id, teamName: team.name, score: team.score, hp: team.hp }));
  const isSetupReview = !setupStarted;
  const canStartGame = Boolean(state?.setup?.complete && !setupStarted);
  const isGuideScreen = window.location.pathname.replace(/\/+$/, "").endsWith("/guide");
  const turnOrder = state?.round?.turnOrder?.length
    ? state.round.turnOrder
    : teams.map((team) => team.id);
  const orderedTeams = turnOrder
    .map((teamId) => teams.find((team) => team.id === teamId))
    .filter(Boolean);

  const moveTeam = (index, offset) => {
    const nextOrder = [...turnOrder];
    [nextOrder[index], nextOrder[index + offset]] = [nextOrder[index + offset], nextOrder[index]];
    socketRef.current?.emit(EVENTS.SETUP_SET_TURN_ORDER, { teamIds: nextOrder });
  };


  const startGame = () => {
    socketRef.current?.emit(EVENTS.SETUP_START_GAME);
  };

  const showFinalLeaderboard = () => {
    socketRef.current?.emit(EVENTS.GAME_OVER_SHOW_LEADERBOARD);
  };

  const openQuestion = () => {
    socketRef.current?.emit(EVENTS.QUESTION_OPEN);
  };

  const revealQuestion = () => {
    socketRef.current?.emit(EVENTS.QUESTION_REVEAL);
  };

  const restartGame = () => {
    if (window.confirm("Khởi động lại sẽ xóa toàn bộ đội, mê cung và tiến trình hiện tại. Tiếp tục?")) {
      socketRef.current?.emit(EVENTS.GAME_RESTART);
    }
  };


  if (!hostAccessKey) {
    return (
      <main className="host-auth-shell">
        <form className="host-auth-panel" onSubmit={unlockHost}>
          <p>{"M\u00e0n h\u00ecnh qu\u1ea3n tr\u1ecb"}</p>
          <h1>{APP_TITLE}</h1>
          <label htmlFor="host-access-key">{"M\u00e3 truy c\u1eadp ng\u01b0\u1eddi d\u1eabn"}</label>
          <input
            autoComplete="current-password"
            autoFocus
            id="host-access-key"
            inputMode="numeric"
            maxLength={4}
            onChange={(event) => setHostKeyDraft(event.target.value)}
            pattern="[0-9]{4}"
            placeholder={"Nh\u1eadp m\u00e3"}
            type="password"
            value={hostKeyDraft}
          />
          {hostAuthError && <div className="host-auth-error">{hostAuthError}</div>}
          <button type="submit">{"M\u1edf kh\u00f3a"}</button>
        </form>
      </main>
    );
  }

  if (isGuideScreen) {
    return (
      <GuideScreen
        activeTeam={teams.find((team) => team.id === state?.round?.activeTeamId)}
        banner={tvBanner}
        confettiSeed={confettiSeed}
        flashSeed={flashSeed}
        onOpenQuestion={openQuestion}
        onRevealQuestion={revealQuestion}
        onShowLeaderboard={showFinalLeaderboard}
        state={state}
      />
    );
  }

  return (
    <main>
      <GameOverOverlay gameOver={state?.gameOver} />
      <BombOverlay bomb={state?.round?.bomb} />
      <MeteorShowerOverlay meteor={state?.round?.meteorShower} />
      <Confetti seed={confettiSeed} />
      {flashSeed ? <div className="tv-flash" key={"flash-" + flashSeed} /> : null}
      <EventAnnouncement banner={tvBanner} />
      <header className="topbar">
        <div>
          <p>{"M\u00e0n h\u00ecnh ng\u01b0\u1eddi d\u1eabn"}</p>
          <h1>{APP_TITLE}</h1>
        </div>

        <div className="admin-controls">
          <span className="joined-pill">{teams.length + " đội đã vào"}</span>
          <button disabled={!canStartGame} onClick={startGame} type="button">
            {"B\u1eaft \u0111\u1ea7u"}
          </button>
          <a className="guide-link" href={GUIDE_URL} rel="noreferrer" target="_blank">
            {"M\u00e0n d\u1eabn"}
          </a>
          <button className="lock-host-button" onClick={lockHost} type="button">
            {"Kh\u00f3a ng\u01b0\u1eddi d\u1eabn"}
          </button>
          <button className="restart-button" onClick={restartGame} type="button">
            {"Khởi động lại"}
          </button>
        </div>

          <span>
          {state
            ? gameOver
              ? "Trò chơi đã kết thúc"
              : teams.length + " đội đã vào / " + submitted.size + " đội đã nộp mê cung"
            : "\u0110ang k\u1ebft n\u1ed1i..."}
        </span>
      </header>

      {state?.error && <div className="host-error">{state.error}</div>}

      <section className="layout">
        <div className={gameOver ? "maps final-host-stage" : "maps"}>
          {gameOver?.stage === "leaderboard" ? (
            <FinalKahootLeaderboard rankings={gameOver.rankings || []} />
          ) : gameOver ? (
            (gameOver.summaries || []).map((summary) => (
              <FinalStatsCard key={summary.teamId} summary={summary} titlePrefix="Tổng kết" />
            ))
          ) : (
            teams.map((team) => {
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

              return (
                <Board
                  cardLabel={team.name}
                  key={team.id}
                  metaLabel={
                    preview
                      ? "\u0110\u00e3 n\u1ed9p - chia ng\u1eabu nhi\u00ean khi \u0111\u1ee7 \u0111\u1ed9i"
                      : "\u0110ang ch\u1edd n\u1ed9p"
                  }
                  submitted={submitted.has(team.id)}
                  team={preview || { ...team, walls: [], startPoint: null, endPoint: null }}
                />
              );
            })
          )}
        </div>

        <aside className="leaderboard">
          <h2>{gameOver ? "Xếp hạng chung cuộc" : "Trạng thái đội"}</h2>
          {rankingRows.map((team, index) => (
            <div className={"rank" + (gameOver && index === 0 ? " winner" : state?.round?.activeTeamId === (team.teamId || team.id) ? " is-active" : "")} key={team.teamId || team.id}>
              <span>{gameOver ? "#" + (team.placement || index + 1) + " · " + team.teamName : team.name}</span>
              <strong>
                {gameOver
                  ? team.score + " \u0111i\u1ec3m / " + team.hp + " m\u00e1u"
                  : state?.round?.activeTeamId === (team.teamId || team.id)
                    ? "\u0110ang l\u00ean s\u00f3ng"
                    : "Chờ lượt"}
              </strong>
            </div>
          ))}

          {!gameOver && (
            <>
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

              <h2 className="setup-title">{"Th\u1ee9 t\u1ef1 l\u01b0\u1ee3t ch\u01a1i"}</h2>
              <div className="turn-order">
                {orderedTeams.map((team, index) => (
                  <div
                    className={"rank turn-order-row" + (state?.round?.activeTeamId === team.id ? " is-active" : "")}
                    key={team.id + "-turn"}
                  >
                    <span><b>{index + 1}</b>{team.name}</span>
                    {setupStarted ? (
                      <strong>{state?.round?.activeTeamId === team.id ? "\u0110ang l\u01b0\u1ee3t" : "Ch\u1edd"}</strong>
                    ) : (
                      <div className="turn-order-actions">
                        <button
                          aria-label={"\u0110\u01b0a " + team.name + " l\u00ean"}
                          disabled={index === 0}
                          onClick={() => moveTeam(index, -1)}
                          type="button"
                        >{"\u2191"}</button>
                        <button
                          aria-label={"\u0110\u01b0a " + team.name + " xu\u1ed1ng"}
                          disabled={index === orderedTeams.length - 1}
                          onClick={() => moveTeam(index, 1)}
                          type="button"
                        >{"\u2193"}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {teams.map((team) => (
                <div className="rank" key={team.id + "-setup"}>
                  <span>{team.name}</span>
                  <strong>{submitted.has(team.id) ? "\u0110\u00e3 n\u1ed9p" : "\u0110ang ch\u1edd"}</strong>
                </div>
              ))}
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
