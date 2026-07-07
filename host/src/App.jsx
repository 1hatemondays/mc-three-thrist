import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { EVENTS } from "../../shared/constants.js";
import { hasWall } from "../../shared/maze.js";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  `${window.location.protocol}//${window.location.hostname === "0.0.0.0" ? "localhost" : window.location.hostname}:3000`;
const BOARD_SIZE = 6;
const APP_TITLE = "M\u00ea Cung Tri Th\u1ee9c";

const pointKey = (point) => (point ? `${point.x}:${point.y}` : "");
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

const Board = ({ cardLabel, metaLabel, submitted, team }) => {
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
        <span className={submitted ? "status ready" : "status"}>{submitted ? "Submitted" : "Pending"}</span>
      </header>

      <div className="board" aria-label={`${cardLabel} maze`}>
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
          const x = index % BOARD_SIZE;
          const y = Math.floor(index / BOARD_SIZE);
          const key = `${x}:${y}`;
          const classes = ["board-cell"];
          if (key === startKey) classes.push("start");
          if (key === endKey) classes.push("end");
          if (key === positionKey) classes.push("active");

          return (
            <div className={classes.join(" ")} key={key} style={{ gridColumn: x * 2 + 2, gridRow: y * 2 + 2 }}>
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

export default function App() {
  const [state, setState] = useState(null);

  useEffect(() => {
    const socket = io(SERVER_URL, { auth: { role: "host" } });

    socket.on(EVENTS.GAME_STATE, (nextState) => {
      console.log("host game:state", nextState);
      setState(nextState);
    });

    return () => socket.disconnect();
  }, []);

  const teams = state?.teams || [];
  const submitted = new Set(Object.keys(state?.setup?.submissions || {}));
  const setupPreviews = state?.setup?.previews || {};
  const isSetupReview = !state?.setup?.complete;

  return (
    <main>
      <header className="topbar">
        <div>
          <p>Host screen</p>
          <h1>{APP_TITLE}</h1>
        </div>
        <span>
          {state ? `${submitted.size}/${teams.length} maze setups` : "Connecting..."}
        </span>
      </header>

      <section className="layout">
        <div className="maps">
          {teams.map((team) => {
            if (!isSetupReview) {
              return (
                <Board
                  cardLabel={team.name}
                  key={team.id}
                  metaLabel={team.startPoint ? "Board ready" : "Waiting for maze"}
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
                    ? `Builds ${targetName || preview.targetTeamId}`
                    : "Waiting for submission"
                }
                submitted={submitted.has(team.id)}
                team={preview || { ...team, walls: [], startPoint: null, endPoint: null }}
              />
            );
          })}
        </div>

        <aside className="leaderboard">
          <h2>Leaderboard</h2>
          {teams.map((team) => (
            <div className="rank" key={team.id}>
              <span>{team.name}</span>
              <strong>{team.score} pts / {team.hp} HP</strong>
            </div>
          ))}

          <h2 className="setup-title">Setup</h2>
          {teams.map((team) => (
            <div className="rank" key={`${team.id}-setup`}>
              <span>{team.name}</span>
              <strong>{submitted.has(team.id) ? "Submitted" : "Pending"}</strong>
            </div>
          ))}
        </aside>
      </section>
    </main>
  );
}
