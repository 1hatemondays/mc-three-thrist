import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { EVENTS } from "../../shared/constants.js";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

export default function App() {
  const [teamCode, setTeamCode] = useState("");
  const [state, setState] = useState(null);
  const socket = useMemo(() => io(SERVER_URL), []);

  useEffect(() => {
    socket.on(EVENTS.GAME_STATE, (nextState) => {
      console.log("player game:state", nextState);
      setState(nextState);
    });

    return () => socket.disconnect();
  }, [socket]);

  const joinTeam = (event) => {
    event.preventDefault();
    socket.emit(EVENTS.TEAM_JOIN, { teamId: teamCode });
  };

  return (
    <main>
      <section className="panel">
        <p>Player screen</p>
        <h1>Mê Cung Tri Thức</h1>

        <form onSubmit={joinTeam}>
          <label htmlFor="teamCode">Team code</label>
          <div className="join-row">
            <input
              id="teamCode"
              placeholder="team1"
              value={teamCode}
              onChange={(event) => setTeamCode(event.target.value)}
            />
            <button type="submit">Join</button>
          </div>
        </form>

        {state?.error && <div className="error">{state.error}</div>}

        {state?.team && (
          <div className="state-card">
            <h2>{state.team.name}</h2>
            <dl>
              <div>
                <dt>Score</dt>
                <dd>{state.team.score}</dd>
              </div>
              <div>
                <dt>HP</dt>
                <dd>{state.team.hp}</dd>
              </div>
              <div>
                <dt>Position</dt>
                <dd>{state.team.position.x}, {state.team.position.y}</dd>
              </div>
            </dl>
          </div>
        )}
      </section>
    </main>
  );
}
