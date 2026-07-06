import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { EVENTS } from "../../shared/constants.js";
import { WALL_SIDES } from "../../shared/maze.js";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  `${window.location.protocol}//${window.location.hostname === "0.0.0.0" ? "localhost" : window.location.hostname}:3000`;
const BOARD_SIZE = 6;

const pointKey = (point) => (point ? `${point.x}:${point.y}` : "");

const Board = ({ team, submitted }) => {
  const startKey = pointKey(team.startPoint);
  const endKey = pointKey(team.endPoint);
  const positionKey = pointKey(team.position);

  return (
    <section className="team-card">
      <header>
        <div>
          <strong>{team.name}</strong>
          <small>{team.startPoint ? "Board ready" : "Waiting for maze"}</small>
        </div>
        <span className={submitted ? "status ready" : "status"}>{submitted ? "Submitted" : "Pending"}</span>
      </header>

      <div className="board" aria-label={`${team.name} maze`}>
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
          const x = index % BOARD_SIZE;
          const y = Math.floor(index / BOARD_SIZE);
          const key = `${x}:${y}`;
          const classes = ["cell"];
          if (key === startKey) classes.push("start");
          if (key === endKey) classes.push("end");
          if (key === positionKey) classes.push("active");
          for (const side of WALL_SIDES) {
            if (hasWall(team.walls || [], BOARD_SIZE, x, y, side)) classes.push(`wall-${side}`);
          }

          return (
            <div className={classes.join(" ")} key={key}>
              {key === startKey ? "S" : key === endKey ? "E" : ""}
            </div>
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

  return (
    <main>
      <header className="topbar">
        <div>
          <p>Host screen</p>
          <h1>Mê Cung Tri Thức</h1>
        </div>
        <span>
          {state ? `${submitted.size}/${teams.length} maze setups` : "Connecting..."}
        </span>
      </header>

      <section className="layout">
        <div className="maps">
          {teams.map((team) => (
            <Board key={team.id} submitted={submitted.has(team.id)} team={team} />
          ))}
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