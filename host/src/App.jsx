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
const pointKey = (point) => (point ? `${point.x}:${point.y}` : "");
const teamColor = (index) => TEAM_COLORS[index % TEAM_COLORS.length];
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

const GuideScreen = ({ state }) => {
  const teams = state?.teams || [];
  const round = state?.round;
  const setupStarted = Boolean(state?.setup?.started);

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
        <div className="guide-map" aria-label={"B\u1ea3n \u0111\u1ed3 ch\u00ednh 6x6"}>
          {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
            const x = index % BOARD_SIZE;
            const y = Math.floor(index / BOARD_SIZE);
            const cellTeams = teams.filter((team) => team.position?.x === x && team.position?.y === y);

            return (
              <div className="guide-cell" key={x + ":" + y}>
                <span className="guide-coord">{x + 1}.{y + 1}</span>
                <div className="guide-markers">
                  {cellTeams.map((team) => {
                    const realIndex = teams.findIndex((item) => item.id === team.id);
                    return (
                      <span
                        className="team-marker"
                        key={team.id}
                        style={{ "--team-color": teamColor(realIndex) }}
                        title={team.name}
                      >
                        {realIndex + 1}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <aside className="guide-panel">
          <h2>{"V\u1ecb tr\u00ed \u0111\u1ed9i"}</h2>
          {teams.map((team, index) => (
            <div className="guide-team" key={team.id}>
              <span className="team-marker" style={{ "--team-color": teamColor(index) }}>
                {index + 1}
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
          <p>{"Đối kháng"}</p>
          <strong>{combat.result ? combat.result.winnerName + " thắng" : combat.submittedCount + "/2 đội đã đặt"}</strong>
          <small>{combat.result ? (combat.result.shielded ? "Lá chắn đã chặn sát thương" : combat.result.loserName + " mất " + combat.result.hpLoss + " máu") : "Điểm đặt đang được giữ kín."}</small>
        </section>
      )}
    </div>
  );
};

export default function App() {
  const [state, setState] = useState(null);
  const [teamCountDraft, setTeamCountDraft] = useState("4");
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SERVER_URL, { auth: { role: "host" } });
    socketRef.current = socket;

    socket.on(EVENTS.GAME_STATE, (nextState) => {
      console.log("host game:state", nextState);
      setState(nextState);
      if (nextState?.config?.teamCount) setTeamCountDraft(String(nextState.config.teamCount));
    });

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, []);

  const teams = state?.teams || [];
  const submitted = new Set(Object.keys(state?.setup?.submissions || {}));
  const setupPreviews = state?.setup?.previews || {};
  const setupStarted = Boolean(state?.setup?.started);
  const isSetupReview = !setupStarted;
  const canConfigureTeams = Boolean(state && !setupStarted && submitted.size === 0);
  const canStartGame = Boolean(state?.setup?.complete && !setupStarted);
  const isGuideScreen = window.location.pathname.replace(/\/+$/, "") === "/guide";

  const updateTeamCount = (event) => {
    event.preventDefault();
    socketRef.current?.emit(EVENTS.SETUP_SET_TEAM_COUNT, { teamCount: Number(teamCountDraft) });
  };

  const startGame = () => {
    socketRef.current?.emit(EVENTS.SETUP_START_GAME);
  };


  if (isGuideScreen) return <GuideScreen state={state} />;

  return (
    <main>
      <header className="topbar">
        <div>
          <p>{"M\u00e0n h\u00ecnh host"}</p>
          <h1>{APP_TITLE}</h1>
        </div>

        <form className="admin-controls" onSubmit={updateTeamCount}>
          <label htmlFor="teamCount">{"S\u1ed1 \u0111\u1ed9i"}</label>
          <input
            disabled={!canConfigureTeams}
            id="teamCount"
            min="2"
            onChange={(event) => setTeamCountDraft(event.target.value)}
            type="number"
            value={teamCountDraft}
          />
          <button disabled={!canConfigureTeams} type="submit">
            {"C\u1eadp nh\u1eadt"}
          </button>
          <button disabled={!canStartGame} onClick={startGame} type="button">
            {"B\u1eaft \u0111\u1ea7u"}
          </button>
          <a className="guide-link" href="/guide" rel="noreferrer" target="_blank">
            {"M\u00e0n d\u1eabn"}
          </a>
        </form>

        <span>
          {state
            ? submitted.size + "/" + teams.length + " \u0111\u1ed9i \u0111\u00e3 n\u1ed9p m\u00ea cung"
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
