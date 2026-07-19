import React, { useEffect, useState } from "react";
import bombIcon from "./assets/bomb.svg";
import "./bomb.css";

export const BombOverlay = ({ bomb, currentTeamId, onAnswer }) => {
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (!bomb?.active) return;
    setDeadline(Date.now() + (bomb.countdownMs || 0));
    setNow(Date.now());
  }, [bomb?.active, bomb?.holderTeamId]);

  useEffect(() => {
    if (!bomb?.active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [bomb?.active]);

  useEffect(() => {
    if (bomb?.active) {
      setShowResult(false);
      return undefined;
    }
    if (!bomb?.result?.explodedAt) return undefined;
    setShowResult(true);
    const timer = setTimeout(() => setShowResult(false), 5500);
    return () => clearTimeout(timer);
  }, [bomb?.active, bomb?.result?.explodedAt]);

  if (!bomb || (!bomb.active && !showResult)) return null;

  const result = bomb.result;
  const remainingMs = bomb.active ? Math.max(0, deadline - now) : 0;
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const progress = Math.max(0, Math.min(100, remainingMs / 100));
  const canAnswer = Boolean(bomb.canAnswer && onAnswer && remainingMs > 0);

  return (
    <div aria-labelledby="bombTitle" aria-modal="true" className={"bomb-overlay" + (result ? " exploded" : "") + (canAnswer ? " can-answer" : "")} role="dialog">
      <section className="bomb-card">
        <header className="bomb-heading">
          <div>
            <p>{"S\u1ef1 ki\u1ec7n kh\u1ea9n c\u1ea5p"}</p>
            <h2 id="bombTitle">BOM <strong>HẸN GIỜ</strong></h2>
          </div>
          <span>{bomb.passCount || 0} {"l\u1ea7n chuy\u1ec3n"}</span>
        </header>

        {result && !bomb.active ? (
          <div className="bomb-result">
            <span aria-hidden="true"><img alt="" src={bombIcon} /></span>
            <h3>{result.loserTeamName}</h3>
            <p>
              {result.reason === "timeout" ? "H\u1ebft 10 gi\u00e2y" : "Tr\u1ea3 l\u1eddi sai"}
              {" · M\u1ea5t "}{result.hpLoss} {"máu"}
            </p>
          </div>
        ) : (
          <>
            <div className="bomb-timer" aria-live="assertive">
              <div className="bomb-fuse" style={{ "--bomb-progress": progress + "%" }} />
              <img alt="" aria-hidden="true" className="bomb-svg" src={bombIcon} />
              <strong>{String(seconds).padStart(2, "0")}</strong>
              <small>GIÂY</small>
            </div>

            <div className="bomb-holder">
              <small>{"BOM \u0110ANG TRONG TAY"}</small>
              <strong>{bomb.holderTeamName}</strong>
              {bomb.canAnswer
                ? <p>{"Bom \u0111ang \u1edf trong tay \u0111\u1ed9i b\u1ea1n. Ch\u1ecdn \u0111\u00e1p \u00e1n tr\u01b0\u1edbc khi bom n\u1ed5."}</p>
                : <p>{"Ch\u1edd \u0111\u1ed9i c\u1ea7m bom tr\u1ea3 l\u1eddi."}</p>}
            </div>

            <div className="bomb-question">
              <h3>{bomb.question?.text}</h3>
              <div>
                {(bomb.question?.choices || []).map((choice, index) => (
                  <button
                    disabled={!canAnswer}
                    key={bomb.question.id + ":" + index}
                    onClick={() => onAnswer(index)}
                    type="button"
                  >
                    <b>{String.fromCharCode(65 + index)}</b>
                    <span>{choice}</span>
                  </button>
                ))}
              </div>
            </div>

            {bomb.lastPass && (
              <p className="bomb-pass">
                {"Chuy\u1ec3n bom th\u00e0nh c\u00f4ng \u2192 "}<strong>{bomb.lastPass.toTeamName}</strong>
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
};
