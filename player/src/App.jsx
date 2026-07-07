import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { DIRECTIONS, EVENTS, ROUND_PHASES } from "../../shared/constants.js";
import { WALL_COUNT, hasEnclosedCell, isInteriorWall, uniqueWalls, wallKey } from "../../shared/maze.js";

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
        <span>
          {submitted
            ? "Đã nộp mê cung. Chờ các đội còn lại."
            : mode === "wall"
              ? "Bấm vào cạnh giữa các ô để đặt đúng 20 tường nội bộ."
              : "Chọn ô xuất phát và ô đích cho đội kế tiếp."}
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
    <div className="game-board" aria-label="Bàn mê cung đã khám phá">
      {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
        const x = index % BOARD_SIZE;
        const y = Math.floor(index / BOARD_SIZE);
        const key = `${x}:${y}`;
        const known = discovered.has(key);
        const current = key === positionKey;
        const classes = ["game-cell"];
        if (known) classes.push("known");
        if (current) classes.push("current");

        return (
          <div className={classes.join(" ")} key={key}>
            {current ? "Bạn" : known ? "" : "?"}
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
    ? "Đúng. Đội đã di chuyển."
    : result.blocked
      ? `${result.correct ? "Đúng" : "Sai"}, nhưng bị chặn.`
      : "Sai đáp án.";

  return (
    <section className={`game-card result-card ${result.success ? "success" : "miss"}`}>
      <div>
        <p>Kết quả lượt</p>
        <h2>{title}</h2>
      </div>
      <dl className="result-grid">
        <div>
          <dt>Đáp án</dt>
          <dd>{result.correct ? "Đúng" : "Sai"}</dd>
        </div>
        <div>
          <dt>Đường đi</dt>
          <dd>{result.blocked ? formatBlockedReason(result.blockedReason) : "Thông"}</dd>
        </div>
        <div>
          <dt>Điểm</dt>
          <dd>+{result.scoreDelta}</dd>
        </div>
      </dl>
    </section>
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

const GameplayPanel = ({ state, lastResult, onChooseDirection, onAnswer }) => {
  const round = state.round;
  const pending = round?.pendingAnswer;
  const question = round?.currentQuestion;
  const result = pending?.result || lastResult;
  const movementOpen = round?.phase === ROUND_PHASES.MOVEMENT;
  const waitingForAnswer = Boolean(question && pending && !pending.answered);
  const waitingForOthers = movementOpen && pending?.answered;
  const canChooseDirection = movementOpen && !pending;

  return (
    <section className="gameplay">
      <div className="game-main">
        <section className="game-card map-card">
          <div className="section-head">
          <p>Vòng {round?.roundNumber || 1} / {phaseLabels[round?.phase] || "Di chuyển"}</p>
          <h2>Mê cung đã khám phá</h2>
          </div>
          <GameplayBoard team={state.team} />
        </section>

        <section className="game-card move-card">
          <div className="section-head">
            <p>Di chuyển</p>
            <h2>{canChooseDirection ? "Chọn hướng đi" : "Trạng thái lượt"}</h2>
          </div>
          <DirectionControls
            disabled={!canChooseDirection}
            onChooseDirection={onChooseDirection}
            pendingDirection={pending?.direction}
          />
          <div className="turn-note">
            {canChooseDirection && "Chọn một hướng để nhận câu hỏi."}
            {waitingForAnswer && `Đã khóa hướng: ${directionLabels[pending.direction]}. Trả lời để di chuyển.`}
            {waitingForOthers && "Đã xong lượt. Đang chờ các đội còn lại."}
            {round?.phase === ROUND_PHASES.AUCTION && "Đã chuyển sang phần đấu giá. Giao diện đặt giá sẽ được thêm ở mốc sau."}
            {round?.phase === ROUND_PHASES.COMBAT && "Đã chuyển sang phần chiến đấu."}
          </div>
        </section>
      </div>

      <QuestionCard answered={Boolean(pending?.answered)} onAnswer={onAnswer} question={question} />
      <ResultCard result={result} />
      <Leaderboard teams={state.leaderboard || []} />
    </section>
  );
};

export default function App() {
  const [teamCode, setTeamCode] = useState("");
  const [state, setState] = useState(null);
  const [localError, setLocalError] = useState("");
  const [lastResult, setLastResult] = useState(null);
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

  const visibleError = localError || state?.error;

  return (
    <main>
      <section className="panel">
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
            </div>

            {!state.setup?.complete ? (
              <SetupBoard state={state} onSubmit={submitMaze} />
            ) : (
              <GameplayPanel
                lastResult={lastResult}
                onAnswer={answerQuestion}
                onChooseDirection={chooseDirection}
                state={state}
              />
            )}
          </>
        )}
      </section>
    </main>
  );
}
