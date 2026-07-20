import React, { useEffect, useState } from "react";
import angelIcon from "./assets/angel.svg";
import "./gameOver.css";

const PARTICLE_COUNT = 48;
const HERALDS = [
  { side: "left", delay: "0s", note: "\u266a" },
  { side: "right", delay: "-0.8s", note: "\u266b" },
  { side: "top", delay: "-1.4s", note: "\u266c" }
];

export const GameOverOverlay = ({ gameOver, currentTeamId }) => {
  const [dismissedKey, setDismissedKey] = useState("");

  useEffect(() => {
    if (!gameOver || gameOver.stage === "leaderboard") return undefined;
    const key = `${gameOver.winnerId}:${gameOver.stage || "stats"}`;
    setDismissedKey("");
    const timer = setTimeout(() => setDismissedKey(key), 5200);
    return () => clearTimeout(timer);
  }, [gameOver?.winnerId, gameOver?.stage]);

  if (!gameOver) return null;
  const overlayKey = `${gameOver.winnerId}:${gameOver.stage || "stats"}`;
  if (gameOver.stage === "leaderboard" || dismissedKey === overlayKey) return null;

  const isWinner = currentTeamId === gameOver.winnerId;
  const label = isWinner
    ? "\u0110\u1ed9i b\u1ea1n \u0111\u00e3 chi\u1ebfn th\u1eafng"
    : "Tr\u1eadn \u0111\u1ea5u \u0111\u00e3 k\u1ebft th\u00fac";

  return (
    <div aria-labelledby="gameOverTitle" aria-modal="true" className="game-over-overlay" role="dialog">
      <div aria-hidden="true" className="game-over-particles">
        {Array.from({ length: PARTICLE_COUNT }, (_, index) => (
          <img
            alt=""
            key={index}
            src={angelIcon}
            style={{
              "--go-delay": (index % 9) * 0.11 + "s",
              "--go-left": (index * 37) % 101 + "%",
              "--go-spin": index * 31 + "deg"
            }}
          />
        ))}
      </div>

      <section className="game-over-stage">
        <p className="game-over-kicker">{label}</p>
        <h2 id="gameOverTitle">{"K\u1ebeT TH\u00daC TR\u00d2 CH\u01a0I"}</h2>

        <div className="game-over-rays" aria-hidden="true" />
        <div className="game-over-trophy" aria-hidden="true">
          <i className="game-over-trophy-left" />
          <i className="game-over-trophy-right" />
          <span><b>1</b></span>
          <i className="game-over-trophy-stem" />
          <i className="game-over-trophy-base" />
        </div>

        <div className="game-over-heralds" aria-hidden="true">
          {HERALDS.map((herald) => (
            <i className={`game-over-herald is-${herald.side}`} key={herald.side} style={{ "--herald-delay": herald.delay }}>
              <img alt="" src={angelIcon} />
              <b>{herald.note}</b>
            </i>
          ))}
        </div>

        <div className="game-over-winner-banner">
          <small>{"NH\u00c0 V\u00d4 \u0110\u1ecaCH"}</small>
          <strong>{gameOver.winnerName}</strong>
          <span>{"\u0110\u00e3 t\u00ecm th\u1ea5y \u0111\u00edch \u0111\u1ebfn trong m\u00ea cung"}</span>
        </div>
      </section>
    </div>
  );
};
