import React from "react";
import { hasWall } from "./maze.js";
import "./finalStats.css";

const DEFAULT_BOARD_SIZE = 6;

const pointKey = (point) => (point ? `${point.x}:${point.y}` : "");
const samePoint = (a, b) => a && b && a.x === b.x && a.y === b.y;

const boardGridStyle = (boardSize) => ({
  gridTemplateColumns:
    `var(--final-maze-edge) repeat(${boardSize - 1}, minmax(0, 1fr) var(--final-maze-edge)) minmax(0, 1fr) var(--final-maze-edge)`,
  gridTemplateRows:
    `var(--final-maze-edge) repeat(${boardSize - 1}, minmax(0, 1fr) var(--final-maze-edge)) minmax(0, 1fr) var(--final-maze-edge)`
});

const cellGridPosition = (x, y) => ({ gridColumn: x * 2 + 2, gridRow: y * 2 + 2 });

const edgeGridPosition = (edge, boardSize) =>
  edge.orientation === "vertical"
    ? { gridColumn: edge.side === "left" ? edge.x * 2 + 1 : boardSize * 2 + 1, gridRow: edge.y * 2 + 2 }
    : { gridColumn: edge.x * 2 + 2, gridRow: edge.side === "top" ? edge.y * 2 + 1 : boardSize * 2 + 1 };

const interiorEdgesFor = (boardSize) => [
  ...Array.from({ length: boardSize }, (_, y) =>
    Array.from({ length: boardSize - 1 }, (_, index) => ({
      x: index + 1,
      y,
      side: "left",
      orientation: "vertical"
    }))
  ).flat(),
  ...Array.from({ length: boardSize - 1 }, (_, index) =>
    Array.from({ length: boardSize }, (_, x) => ({
      x,
      y: index + 1,
      side: "top",
      orientation: "horizontal"
    }))
  ).flat()
];

const borderSegmentsFor = (boardSize) => [
  ...Array.from({ length: boardSize }, (_, x) => ({ x, y: 0, side: "top", orientation: "horizontal" })),
  ...Array.from({ length: boardSize }, (_, x) => ({
    x,
    y: boardSize - 1,
    side: "bottom",
    orientation: "horizontal"
  })),
  ...Array.from({ length: boardSize }, (_, y) => ({ x: 0, y, side: "left", orientation: "vertical" })),
  ...Array.from({ length: boardSize }, (_, y) => ({
    x: boardSize - 1,
    y,
    side: "right",
    orientation: "vertical"
  }))
];

const pathConnectorSides = (path, index) => {
  const current = path[index];
  const sides = [];

  for (const neighbor of [path[index - 1], path[index + 1]]) {
    if (!current || !neighbor) continue;
    const dx = neighbor.x - current.x;
    const dy = neighbor.y - current.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) continue;
    if (dx === 1) sides.push("right");
    if (dx === -1) sides.push("left");
    if (dy === 1) sides.push("bottom");
    if (dy === -1) sides.push("top");
  }

  return [...new Set(sides)];
};

export const FinalStatsCard = ({ summary, boardSize = DEFAULT_BOARD_SIZE, titlePrefix = "Thống kê đội" }) => {
  if (!summary) return null;

  const path = summary.discoveredCells || [];
  const explored = new Map(path.map((point, index) => [pointKey(point), index]));
  const interiorEdges = interiorEdgesFor(boardSize);
  const borderSegments = borderSegmentsFor(boardSize);

  return (
    <section className="final-stats-card">
      <header className="final-stats-head">
        <div>
          <p>{titlePrefix}</p>
          <h2>#{summary.placement} · {summary.teamName}</h2>
        </div>
        <strong>{summary.reachedEnd ? "Về đích" : "Tổng kết"}</strong>
      </header>

      <div className="final-stat-grid">
        <div>
          <span>Điểm</span>
          <strong>{summary.score}</strong>
        </div>
        <div>
          <span>Máu</span>
          <strong>{summary.hp}</strong>
        </div>
        <div>
          <span>Ô đã khám phá</span>
          <strong>{summary.exploredCount}</strong>
        </div>
        <div>
          <span>Đúng / Sai</span>
          <strong>{summary.correctAnswers} / {summary.wrongAnswers}</strong>
        </div>
      </div>

      <div className="final-map" style={boardGridStyle(boardSize)} aria-label={"Bản đồ tổng kết của " + summary.teamName}>
        {Array.from({ length: boardSize * boardSize }, (_, index) => {
          const x = index % boardSize;
          const y = Math.floor(index / boardSize);
          const point = { x, y };
          const pathIndex = explored.get(pointKey(point));
          const isExplored = pathIndex !== undefined;
          return (
            <div
              className={"final-map-cell" + (isExplored ? " explored" : "")}
              key={x + ":" + y}
              style={cellGridPosition(x, y)}
            >
              {isExplored && (
                <i className="final-path-route">
                  {pathConnectorSides(path, pathIndex).map((side) => (
                    <span className={"to-" + side} key={side} />
                  ))}
                </i>
              )}
              {isExplored && <i className="final-path-dot">{pathIndex + 1}</i>}
              <span className="final-map-tokens">
                {samePoint(point, summary.startPoint) && <span className="final-map-token start">XP</span>}
                {samePoint(point, summary.endPoint) && <span className="final-map-token end">Đ</span>}
                {samePoint(point, summary.position) && <span className="final-map-token current">●</span>}
              </span>
            </div>
          );
        })}

        {borderSegments.map((edge) => (
          <div
            aria-hidden="true"
            className={`final-map-edge border ${edge.orientation}`}
            key={`border-${edge.side}-${edge.x}-${edge.y}`}
            style={edgeGridPosition(edge, boardSize)}
          />
        ))}

        {interiorEdges.map((edge) => {
          const active = hasWall(summary.walls || [], boardSize, edge.x, edge.y, edge.side);
          return (
            <div
              aria-hidden="true"
              className={`final-map-edge ${edge.orientation}${active ? " active" : ""}`}
              key={`edge-${edge.side}-${edge.x}-${edge.y}`}
              style={edgeGridPosition(edge, boardSize)}
            />
          );
        })}
      </div>
    </section>
  );
};

export const FinalStatsScreen = ({
  boardSize = DEFAULT_BOARD_SIZE,
  children,
  gameOver,
  mode = "player",
  onBack,
  onShowLeaderboard,
  summary
}) => {
  if (!gameOver) return null;
  const isLeaderboard = gameOver.stage === "leaderboard";
  const summaries = summary ? [summary] : gameOver.summaries || [];

  return (
    <main className={`final-screen final-screen-${mode}`}>
      <header className="final-screen-head">
        <div>
          <p>Kết thúc trò chơi</p>
          <h1>{gameOver.winnerName} về đích đầu tiên</h1>
        </div>
        <div className="final-screen-actions">
          {onShowLeaderboard && !isLeaderboard && (
            <button onClick={onShowLeaderboard} type="button">
              Hiện bảng xếp hạng cuối
            </button>
          )}
          {onBack && (
            <button className="final-back-button" onClick={onBack} type="button">
              <span aria-hidden="true">←</span> Quay về
            </button>
          )}
        </div>
      </header>

      {children}

      {isLeaderboard ? (
        <FinalKahootLeaderboard rankings={gameOver.rankings || []} />
      ) : (
        <section className={summary ? "final-screen-stats single" : "final-screen-stats"}>
          {summaries.map((item) => (
            <FinalStatsCard boardSize={boardSize} key={item.teamId} summary={item} titlePrefix={summary ? "Tổng kết đội bạn" : "Tổng kết"} />
          ))}
        </section>
      )}
    </main>
  );
};

export const FinalKahootLeaderboard = ({ rankings = [] }) => {
  const maxScore = Math.max(1, ...rankings.map((entry) => Math.max(0, entry.score || 0)));

  return (
    <section className="final-kahoot-board">
      <header>
        <p>Bảng xếp hạng cuối</p>
        <h2>Ai là nhà vô địch?</h2>
      </header>
      <div className="final-bars" role="list">
        {rankings.map((entry, index) => (
          <article className={index === 0 ? "final-bar-card winner" : "final-bar-card"} key={entry.teamId} role="listitem">
            <div className="final-bar-track">
              <span style={{ "--bar-height": `${Math.max(12, ((entry.score || 0) / maxScore) * 100)}%` }} />
            </div>
            <b>#{entry.placement || index + 1}</b>
            <strong>{entry.teamName}</strong>
            <small>{entry.score} điểm · {entry.exploredCount || 0} ô</small>
          </article>
        ))}
      </div>
    </section>
  );
};
