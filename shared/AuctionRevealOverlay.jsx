import React, { useEffect, useRef, useState } from "react";
import { getAuctionOutcomes, getPersonalAuctionSummary } from "./auctionReveal.js";

const AuctionBidRows = ({ bids }) => (
  <div className="auction-reveal-bids">
    {bids.length ? bids.map((bid) => (
      <div className={bid.won ? "auction-reveal-bid is-winner" : "auction-reveal-bid is-loser"} key={bid.teamId}>
        <span>{bid.teamName}</span>
        <strong>{bid.amount} điểm</strong>
      </div>
    )) : <span className="auction-reveal-empty">Không có đội đặt giá</span>}
  </div>
);

const AuctionOutcomeCard = ({ outcome, opening, revealed }) => (
  <article
    className={"auction-reveal-item" + (opening ? " is-opening" : "") + (revealed ? " is-revealed" : "")}
    style={{ "--auction-item-color": outcome.color || "#f0b94b" }}
  >
    <div className="auction-reveal-item-head">
      <span className="auction-reveal-symbol">{outcome.symbol || "?"}</span>
      <div>
        <h3>{outcome.itemName}</h3>
        {outcome.minPrice !== null && <small>Khởi điểm {outcome.minPrice} điểm</small>}
      </div>
    </div>

    {!revealed ? (
      <div className="auction-reveal-opening"><i /><span>Đang mở giá...</span></div>
    ) : (
      <>
        <div className={outcome.winner ? "auction-reveal-stamp is-won" : "auction-reveal-stamp is-empty"}>
          {outcome.winner ? `${outcome.winner.teamName} thắng` : "Không có người thắng"}
        </div>
        <AuctionBidRows bids={outcome.bids || []} />
      </>
    )}
  </article>
);

const TeamSummary = ({ result }) => {
  const teams = result?.teamResults || [];
  if (!teams.length) return null;

  return (
    <div className="auction-team-results">
      {teams.map((team) => (
        <div className={"auction-team-result is-" + team.status} key={team.teamId}>
          <span>{team.teamName}</span>
          <strong>
            {team.items?.length
              ? team.items.map((item) => `${item.itemName} (-${item.amount})`).join(" · ")
              : team.status === "skipped" ? "Bỏ qua · giữ nguyên điểm" : "Không thắng · giữ nguyên điểm"}
          </strong>
        </div>
      ))}
    </div>
  );
};

export const AuctionRevealOverlay = ({ currentTeamId = null, mode = "player", onClose, result }) => {
  const outcomes = getAuctionOutcomes(result);
  const totalSteps = Math.max(1, outcomes.length * 2 + 1);
  const [stage, setStage] = useState(1);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!result) return undefined;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let closeTimer;
    setStage(reducedMotion ? totalSteps : 1);

    if (reducedMotion || outcomes.length === 0) {
      closeTimer = window.setTimeout(() => closeRef.current?.(), 9000);
      return () => window.clearTimeout(closeTimer);
    }

    const interval = window.setInterval(() => {
      setStage((current) => {
        const next = Math.min(totalSteps, current + 1);
        if (next === totalSteps) {
          window.clearInterval(interval);
          closeTimer = window.setTimeout(() => closeRef.current?.(), 6500);
        }
        return next;
      });
    }, mode === "host" ? 850 : 720);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(closeTimer);
    };
  }, [result, mode, outcomes.length, totalSteps]);

  if (!result) return null;

  const summaryVisible = stage >= totalSteps;
  const personal = mode === "player" ? getPersonalAuctionSummary(result, currentTeamId) : null;

  return (
    <div aria-labelledby="auctionRevealTitle" aria-modal="true" className={`auction-reveal-overlay mode-${mode}`} role="dialog">
      <section className="auction-reveal-shell">
        <header className="auction-reveal-header">
          <div>
            <p>Phiên đấu giá kín đã chốt</p>
            <h2 id="auctionRevealTitle">Kết quả đấu giá</h2>
          </div>
          <button aria-label="Đóng kết quả đấu giá" className="auction-reveal-close" onClick={onClose} title="Đóng" type="button">×</button>
        </header>

        <div className="auction-reveal-progress" aria-hidden="true">
          <span style={{ width: `${Math.min(100, (stage / totalSteps) * 100)}%` }} />
        </div>

        <div className="auction-reveal-items">
          {outcomes.map((outcome, index) => {
            const openingAt = index * 2 + 1;
            if (stage < openingAt) return null;
            return (
              <AuctionOutcomeCard
                key={outcome.itemId}
                opening={stage === openingAt}
                outcome={outcome}
                revealed={stage >= openingAt + 1}
              />
            );
          })}
        </div>

        {summaryVisible && (
          <section className="auction-reveal-summary">
            <div className="auction-reveal-summary-title">
              <span>Tổng kết</span>
              <strong>{result.winners?.length ? `${result.winners.length} vật phẩm đã có chủ` : "Không có vật phẩm được trao"}</strong>
            </div>
            {personal && (
              <div className={"auction-personal-result is-" + personal.status}>
                <span>Kết quả của bạn</span>
                <strong>{personal.heading}</strong>
                <small>{personal.message}</small>
              </div>
            )}
            <TeamSummary result={result} />
          </section>
        )}
      </section>
    </div>
  );
};
