import React, { useEffect, useState } from "react";
import "./meteorShower.css";

const STREAKS = 14;

export const MeteorShowerOverlay = ({ meteor, currentTeamId, onAnswer, onBuzz }) => {
  const [clock, setClock] = useState({ phase: null, questionNumber: null, deadline: 0 });
  const [now, setNow] = useState(Date.now());
  const [showResult, setShowResult] = useState(false);
  const answerActive = Boolean(meteor?.active && meteor.buzzerTeamId);
  const clockPhase = answerActive ? "answer" : "buzz";
  const activeCountdownMs = answerActive ? meteor?.answerCountdownMs || 0 : meteor?.countdownMs || 0;

  useEffect(() => {
    if (!meteor?.active) return;
    setClock({
      phase: clockPhase,
      questionNumber: meteor.questionNumber,
      deadline: Date.now() + activeCountdownMs
    });
    setNow(Date.now());
  }, [activeCountdownMs, clockPhase, meteor?.active, meteor?.questionNumber]);

  useEffect(() => {
    if (!meteor?.active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [meteor?.active]);

  useEffect(() => {
    if (meteor?.active) {
      setShowResult(false);
      return undefined;
    }
    if (!meteor?.result?.completedAt) return undefined;
    setShowResult(true);
    const timer = setTimeout(() => setShowResult(false), 5500);
    return () => clearTimeout(timer);
  }, [meteor?.active, meteor?.result?.completedAt]);

  const remainingMs =
    clock.questionNumber === meteor?.questionNumber && clock.phase === clockPhase
      ? Math.max(0, clock.deadline - now)
      : Math.max(0, activeCountdownMs);
  const countdown = Math.ceil(remainingMs / 1000);
  const answerProgress = answerActive
    ? Math.max(0, Math.min(100, (remainingMs / (meteor.answerTimeMs || 10000)) * 100))
    : 0;
  const buzzOpen = Boolean(meteor?.active && !answerActive && remainingMs === 0 && !meteor.buzzerTeamId);

  useEffect(() => {
    if (!buzzOpen || !onBuzz) return undefined;
    const handleKey = (event) => {
      if (event.code !== "Space" || event.repeat) return;
      event.preventDefault();
      onBuzz();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [buzzOpen, onBuzz]);

  if (!meteor || (!meteor.active && !showResult)) return null;

  const myBuzz = meteor.buzzerTeamId === currentTeamId;
  const result = meteor.result;

  return (
    <div
      aria-labelledby="meteorTitle"
      aria-modal="true"
      className={"meteor-overlay" + (result && !meteor.active ? " is-result" : "")}
      role="dialog"
    >
      <div aria-hidden="true" className="meteor-sky">
        {Array.from({ length: STREAKS }, (_, index) => (
          <i key={index} style={{ "--meteor-delay": (index % 7) * 0.34 + "s", "--meteor-top": (index * 17) % 92 + "%" }} />
        ))}
      </div>

      <section className="meteor-card">
        <header className="meteor-heading">
          <div>
            <p>{"V\u1eadt ph\u1ea9m \u0111\u1eb7c bi\u1ec7t"}</p>
            <h2 id="meteorTitle">ĐẤU <strong>TRÍ</strong></h2>
          </div>
          {!result && (
            <span className="meteor-progress">
              {String(meteor.questionNumber).padStart(2, "0")} / {meteor.totalQuestions}
            </span>
          )}
        </header>

        {result && !meteor.active ? (
          <div className="meteor-finale">
            <span>{"QU\u00c1N QU\u00c2N"}</span>
            <strong>{result.winnerName}</strong>
            <p>+{result.bonus} {"\u0111i\u1ec3m"} · {"C\u00e1c \u0111\u1ed9i c\u00f2n l\u1ea1i m\u1ea5t "}{result.hpLoss} {"máu"} {"v\u00e0 1 l\u01b0\u1ee3t"}</p>
          </div>
        ) : (
          <>
            <div className="meteor-question">
              <small>{"C\u00c2U "}{meteor.questionNumber}</small>
              <h3>{meteor.question?.text}</h3>
            </div>

            <div className="meteor-action">
              <p className="meteor-rules">
                <strong>Luật tranh quyền</strong>
                <span>Chờ đếm ngược 3 giây, sau đó bấm PHÍM CÁCH để giành quyền trả lời.</span>
              </p>
              {remainingMs > 0 ? (
                <div className="meteor-countdown" aria-live="assertive">
                  <small>{"CHU\u1ea8N B\u1eca"}</small>
                  <strong>{Math.min(3, Math.max(1, countdown))}</strong>
                </div>
              ) : meteor.buzzerTeamId ? (
                <div className={"meteor-buzz-winner" + (myBuzz ? " is-mine" : "")}>
                  <small>{myBuzz ? "\u0110\u1ed8I B\u1ea0N GI\u00c0NH QUY\u1ec0N" : "QUY\u1ec0N TR\u1ea2 L\u1edcI"}</small>
                  <strong>{meteor.buzzerTeamName}</strong>
                  <div className="meteor-answer-timer" aria-label={`Còn ${Math.max(0, countdown)} giây trả lời`}>
                    <b>{Math.max(0, countdown)}s</b>
                    <span><i style={{ "--combat-time": `${answerProgress}%` }} /></span>
                    <em>hết giờ = sai</em>
                  </div>
                </div>
              ) : (
                <button className="meteor-space" disabled={!onBuzz} onClick={onBuzz} type="button">
                  <kbd>PHÍM CÁCH</kbd>
                  <span>{"NH\u1ea4N NGAY"}</span>
                </button>
              )}
            </div>

            <div className="meteor-choices">
              {(meteor.question?.choices || []).map((choice, index) => (
                <button
                  disabled={!meteor.canAnswer || !onAnswer || (answerActive && remainingMs <= 0)}
                  aria-disabled={!meteor.canAnswer || !onAnswer || (answerActive && remainingMs <= 0)}
                  key={meteor.question.id + ":" + index}
                  onClick={() => onAnswer(index)}
                  type="button"
                >
                  <b>{String.fromCharCode(65 + index)}</b>
                  <span>{choice}</span>
                </button>
              ))}
            </div>

            {meteor.lastAnswer && (
              <p className={"meteor-last-answer " + (meteor.lastAnswer.correct ? "correct" : "wrong")}>
                {meteor.lastAnswer.teamName} · {meteor.lastAnswer.correct ? "\u0110\u00fang" : "Sai"}
              </p>
            )}
          </>
        )}

        <aside className="meteor-scores">
          <p>{"S\u1ed1 c\u00e2u \u0111\u00fang"}</p>
          {(meteor.scores || []).map((score) => (
            <div className={score.teamId === result?.winnerId ? "winner" : ""} key={score.teamId}>
              <span>{score.teamName}</span>
              <strong>{score.correctCount}</strong>
            </div>
          ))}
        </aside>
      </section>
    </div>
  );
};
