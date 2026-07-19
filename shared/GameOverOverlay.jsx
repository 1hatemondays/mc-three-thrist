import React, { useEffect, useState } from "react";
import "./gameOver.css";

const PARTICLE_COUNT = 48;
const HERALDS = [
  { side: "left", delay: "0s", note: "♪" },
  { side: "right", delay: "-0.8s", note: "♫" },
  { side: "top", delay: "-1.4s", note: "♬" }
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
          <i
            key={index}
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
        <h2 id="gameOverTitle">KẾT THÚC TRÒ CHƠI</h2>

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
              <span className="herald-wing left" />
              <span className="herald-head" />
              <span className="herald-body" />
              <span className="herald-wing right" />
              <span className="herald-horn" />
              <b>{herald.note}</b>
            </i>
          ))}
        </div>

        <div className="game-over-winner-banner">
          <small>NHÀ VÔ ĐỊCH</small>
          <strong>{gameOver.winnerName}</strong>
          <span>Đã tìm thấy đích đến trong mê cung</span>
        </div>
      </section>
    </div>
  );
};
