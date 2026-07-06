import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { EVENTS } from "../../shared/constants.js";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

const Board = ({ team }) => (
  <section className="team-card">
    <header>
      <strong>{team.name}</strong>
      <span>{team.score} pts</span>
    </header>
    <div className="board" aria-label={`${team.name} placeholder maze`}>
      {Array.from({ length: 36 }, (_, index) => (
        <div
          className={index === 0 ? "cell active" : "cell"}
          key={index}
        />
      ))}
    </div>
  </section>
);

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

  return (
    <main>
      <header className="topbar">
        <div>
          <p>Host screen</p>
          <h1>Mê Cung Tri Thức</h1>
        </div>
        <span>{state ? `${teams.length} teams` : "Connecting..."}</span>
      </header>

      <section className="layout">
        <div className="maps">
          {teams.map((team) => (
            <Board key={team.id} team={team} />
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
        </aside>
      </section>
    </main>
  );
}
