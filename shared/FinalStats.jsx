import React from "react";
import { hasWall } from "./maze.js";
import "./finalStats.css";

const DEFAULT_BOARD_SIZE = 6;
const SIDES = ["top", "right", "bottom", "left"];

const pointKey = (point) => (point ? `${point.x}:${point.y}` : "");
const samePoint = (a, b) => a && b && a.x === b.x && a.y === b.y;

const wallStyleFor = (summary, boardSize, x, y) => {
  const walls = summary?.walls || [];
  const borderColor = "var(--final-wall, #173529)";
  const gridColor = "var(--final-grid, rgba(23, 53, 41, 0.18))";
  const style = {};

  for (const side of SIDES) {
    const border =
      (side === "top" && y === 0) ||
      (side === "left" && x === 0) ||
      (side === "right" && x === boardSize - 1) ||
      (side === "bottom" && y === boardSize - 1) ||
      hasWall(walls, boardSize, x, y, side);
    style[`border${side[0].toUpperCase()}${side.slice(1)}Color`] = border ? borderColor : gridColor;
    style[`border${side[0].toUpperCase()}${side.slice(1)}Width`] = border ? "4px" : "1px";
  }

  return style;
};

export const FinalStatsCard = ({ summary, boardSize = DEFAULT_BOARD_SIZE, titlePrefix = "Thống kê đội" }) => {
  if (!summary) return null;

  const explored = new Set((summary.discoveredCells || []).map(pointKey));

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

      <div className="final-map" aria-label={"Bản đồ tổng kết của " + summary.teamName}>
        {Array.from({ length: boardSize * boardSize }, (_, index) => {
          const x = index % boardSize;
          const y = Math.floor(index / boardSize);
          const point = { x, y };
          const isExplored = explored.has(pointKey(point));
          return (
            <div
              className={"final-map-cell" + (isExplored ? " explored" : "")}
              key={x + ":" + y}
              style={wallStyleFor(summary, boardSize, x, y)}
            >
              {samePoint(point, summary.startPoint) && <span className="final-map-token start">S</span>}
              {samePoint(point, summary.endPoint) && <span className="final-map-token end">E</span>}
              {samePoint(point, summary.position) && <span className="final-map-token current">●</span>}
              {isExplored && <i className="final-path-dot" />}
            </div>
          );
        })}
      </div>
    </section>
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
