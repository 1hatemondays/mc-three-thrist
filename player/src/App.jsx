import React, { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { EVENTS } from "../../shared/constants.js";
import { WALL_COUNT, hasEnclosedCell, isInteriorWall, uniqueWalls, wallKey } from "../../shared/maze.js";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  `${window.location.protocol}//${window.location.hostname === "0.0.0.0" ? "localhost" : window.location.hostname}:3000`;
const BOARD_SIZE = 6;
const APP_TITLE = "M\u00ea Cung Tri Th\u1ee9c";

const emptyDraft = () => ({ walls: [], startPoint: null, endPoint: null });
const pointKey = (point) => (point ? `${point.x}:${point.y}` : "");
const normalizeTeamCode = (value) => value.replace(/\s+/g, "").toLowerCase();
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

const SetupBoard = ({ state, onSubmit }) => {
  const [draft, setDraft] = useState(emptyDraft);
  const [mode, setMode] = useState("wall");
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

    setDraft((current) => {
      const exists = current.walls.some((wall) => wallKey(wall, BOARD_SIZE) === key);
      if (exists) {
        return { ...current, walls: current.walls.filter((wall) => wallKey(wall, BOARD_SIZE) !== key) };
      }

      if (current.walls.length >= WALL_COUNT) return current;

      const nextWalls = uniqueWalls([...current.walls, edge], BOARD_SIZE).filter((wall) =>
        isInteriorWall(wall, BOARD_SIZE)
      );
      if (hasEnclosedCell(nextWalls, BOARD_SIZE)) return current;

      return { ...current, walls: nextWalls };
    });
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

      <div className="setup-board" aria-label="Maze setup board">
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
              aria-label={`Toggle ${edge.orientation} wall at ${edge.x},${edge.y}`}
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
        <span>
          {submitted
            ? "Maze submitted. Waiting for other teams."
            : mode === "wall"
              ? "Click the shared gaps to toggle exactly 20 interior walls."
              : "Pick the start and end cells for the next team."}
        </span>
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
        <h1>{APP_TITLE}</h1>
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
