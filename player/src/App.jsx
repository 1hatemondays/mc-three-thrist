import React, { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { EVENTS } from "../../shared/constants.js";
import { WALL_COUNT, WALL_SIDES, hasEnclosedCell, uniqueWalls, wallKey } from "../../shared/maze.js";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  `${window.location.protocol}//${window.location.hostname === "0.0.0.0" ? "localhost" : window.location.hostname}:3000`;
const BOARD_SIZE = 6;

const emptyDraft = () => ({ walls: [], startPoint: null, endPoint: null });
const pointKey = (point) => (point ? `${point.x}:${point.y}` : "");
const normalizeTeamCode = (value) => value.replace(/\s+/g, "").toLowerCase();

const SetupBoard = ({ state, onSubmit }) => {
  const [draft, setDraft] = useState(emptyDraft);
  const [mode, setMode] = useState("wall");
  const [wallSide, setWallSide] = useState("top");
  const setup = state.setup;
  const submitted = Boolean(setup?.mySubmission);
  const startKey = pointKey(draft.startPoint);
  const endKey = pointKey(draft.endPoint);
  const canSubmit =
    !submitted && draft.walls.length === WALL_COUNT && draft.startPoint && draft.endPoint && startKey !== endKey;

  useEffect(() => {
    setDraft(emptyDraft());
  }, [state.team.id]);

  const selectCell = (x, y) => {
    if (submitted) return;

    if (mode === "start") {
      setDraft((current) => ({ ...current, startPoint: { x, y } }));
      return;
    }

    if (mode === "end") {
      setDraft((current) => ({ ...current, endPoint: { x, y } }));
      return;
    }

    const nextWall = { x, y, side: wallSide };
    const key = wallKey(nextWall, BOARD_SIZE);

    setDraft((current) => {
      const exists = current.walls.some((wall) => wallKey(wall, BOARD_SIZE) === key);
      if (exists) {
        return { ...current, walls: current.walls.filter((wall) => wallKey(wall, BOARD_SIZE) !== key) };
      }

      if (current.walls.length >= WALL_COUNT) return current;

      const nextWalls = uniqueWalls([...current.walls, nextWall], BOARD_SIZE);
      if (hasEnclosedCell(nextWalls, BOARD_SIZE)) return current;

      return { ...current, walls: nextWalls };
    });
  };

  const cellClass = (x, y) => {
    const classes = ["setup-cell"];
    if (startKey === `${x}:${y}`) classes.push("is-start");
    if (endKey === `${x}:${y}`) classes.push("is-end");

    for (const side of WALL_SIDES) {
      if (hasWall(draft.walls, BOARD_SIZE, x, y, side)) classes.push(`wall-${side}`);
    }

    return classes.join(" ");
  };

  return (
    <section className="setup-panel">
      <div className="setup-head">
        <div>
          <p>Maze setup</p>
          <h2>Build a board for the next team</h2>
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
            {tool === "wall" ? "Wall" : tool === "start" ? "Start" : "End"}
          </button>
        ))}
      </div>

      {mode === "wall" && (
        <div className="toolbar side-toolbar" aria-label="Wall side">
          {WALL_SIDES.map((side) => (
            <button
              className={wallSide === side ? "tool active" : "tool"}
              key={side}
              onClick={() => setWallSide(side)}
              type="button"
            >
              {side}
            </button>
          ))}
        </div>
      )}

      <div className="setup-board" aria-label="Maze setup board">
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
          const x = index % BOARD_SIZE;
          const y = Math.floor(index / BOARD_SIZE);
          return (
            <button
              className={cellClass(x, y)}
              disabled={submitted}
              key={`${x}:${y}`}
              onClick={() => selectCell(x, y)}
              type="button"
            >
              {startKey === `${x}:${y}` ? "S" : endKey === `${x}:${y}` ? "E" : ""}
            </button>
          );
        })}
      </div>

      <div className="setup-actions">
        <span>{submitted ? "Maze submitted. Waiting for other teams." : "Pick start, end, and exactly 20 walls."}</span>
        <button disabled={!canSubmit} onClick={() => onSubmit(draft)} type="button">
          Submit maze
        </button>
      </div>
    </section>
  );
};

export default function App() {
  const [teamCode, setTeamCode] = useState("");
  const [state, setState] = useState(null);
  const [localError, setLocalError] = useState("");
  const socket = useMemo(() => io(SERVER_URL, { autoConnect: false, reconnectionAttempts: 3 }), []);
  const [socketStatus, setSocketStatus] = useState(socket.connected ? "connected" : "connecting");

  useEffect(() => {
    const onState = (nextState) => {
      console.log("player game:state", nextState);
      setState(nextState);
      setLocalError("");
    };
    const onConnect = () => {
      setSocketStatus("connected");
      setLocalError("");
    };
    const onDisconnect = () => setSocketStatus("disconnected");
    const onConnectError = () => {
      setSocketStatus("disconnected");
      setLocalError("Cannot connect to the server. Run npm run dev, then refresh this page.");
    };

    socket.on(EVENTS.GAME_STATE, onState);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.connect();

    return () => {
      socket.off(EVENTS.GAME_STATE, onState);
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
      setLocalError("Server is not connected yet. Run npm run dev, then refresh this page.");
      return;
    }

    if (!id) {
      setLocalError("Enter a team code first.");
      return;
    }

    setLocalError("");
    socket.emit(EVENTS.TEAM_JOIN, { teamId: id });
  };

  const submitMaze = (draft) => {
    socket.emit(EVENTS.SETUP_SUBMIT_MAZE, draft);
  };

  const visibleError = localError || state?.error;

  return (
    <main>
      <section className="panel">
        <p>Player screen</p>
        <h1>Mê Cung Tri Thức</h1>
        <div className={socketStatus === "connected" ? "connection online" : "connection"}>
          Server: {socketStatus}
        </div>

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

        {visibleError && <div className="error">{visibleError}</div>}

        {state?.team && (
          <>
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

            {!state.setup?.complete ? (
              <SetupBoard state={state} onSubmit={submitMaze} />
            ) : (
              <div className="state-card">
                <h2>Setup complete</h2>
                <p>Your maze is hidden until movement begins.</p>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}