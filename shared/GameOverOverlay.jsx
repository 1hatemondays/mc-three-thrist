import React, { useEffect, useState } from "react";
import "./gameOver.css";

const PARTICLE_COUNT = 28;

export const GameOverOverlay = ({ gameOver, currentTeamId }) => {
  const [dismissedKey, setDismissedKey] = useState("");

  useEffect(() => {
    if (!gameOver || gameOver.stage === "leaderboard") return undefined;
    const key = `${gameOver.winnerId}:${gameOver.stage || "stats"}`;
    setDismissedKey("");
    const timer = setTimeout(() => setDismissedKey(key), 2600);
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

      <section className="game-over-card">
        <header className="game-over-heading">
          <p>{label}</p>
          <h2 id="gameOverTitle"><span>GAME</span> <strong>OVER</strong></h2>
        </header>

        <div className="game-over-champion">
          <span>{"NH\u00c0 V\u00d4 \u0110\u1ecaCH"}</span>
          <strong>{gameOver.winnerName}</strong>
          <p>{"\u0110\u00e3 t\u00ecm th\u1ea5y \u0111\u00edch \u0111\u1ebfn trong m\u00ea cung."}</p>
        </div>

        <div className="game-over-standings">
          <h3>{"K\u1ebft qu\u1ea3 chung cu\u1ed9c"}</h3>
          <ol>
            {(gameOver.rankings || []).map((team, index) => (
              <li className={team.teamId === gameOver.winnerId ? "is-winner" : ""} key={team.teamId}>
                <b>{String(team.placement || index + 1).padStart(2, "0")}</b>
                <span>{team.teamName}</span>
                <small>{team.score} {"\u0111i\u1ec3m"} / {team.hp} {"m\u00e1u"}</small>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
};
