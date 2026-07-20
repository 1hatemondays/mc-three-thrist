import React from "react";
import "./eventEffects.css";

const SNOW = Array.from({ length: 20 }, (_, index) => index);
const METEORS = Array.from({ length: 9 }, (_, index) => index);

const ShieldImpact = ({ teamName }) => (
  <div className="live-shield-impact" aria-hidden="true">
    <div className="live-shield-spear"><i /><span /></div>
    <div className="live-shield-body"><span>CHẮN</span></div>
    <div className="live-shield-sparks">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>
    <strong>{teamName ? `Lá chắn bảo vệ ${teamName}` : "Lá chắn đã chặn sát thương"}</strong>
  </div>
);

const FreezeEffect = ({ effect }) => (
  <>
    <div className="live-snow" aria-hidden="true">
      {SNOW.map((flake) => (
        <i
          key={flake}
          style={{
            "--snow-delay": `${(flake % 8) * -0.37}s`,
            "--snow-duration": `${2.2 + (flake % 5) * 0.34}s`,
            "--snow-left": `${(flake * 41) % 103}%`,
            "--snow-size": `${18 + (flake % 5) * 8}px`
          }}
        >❄</i>
      ))}
    </div>
    <div className="live-freeze-card">
      <small>{effect.role === "target" ? "ĐỘI BẠN BỊ CHỌN" : "ĐÓNG BĂNG ĐỐI THỦ"}</small>
      <strong>{effect.targetTeamName || "Đội đối thủ"}</strong>
      <span>ĐÓNG BĂNG · MẤT LƯỢT</span>
    </div>
  </>
);

const MeteorEffect = ({ effect }) => (
  <>
    <div className="live-meteor-field" aria-hidden="true">
      {METEORS.map((meteor) => (
        <i
          key={meteor}
          style={{
            "--meteor-i": meteor,
            "--meteor-top": `${(meteor * 13) % 86}%`,
            "--meteor-left": `${(meteor * 17) % 72}%`,
          }}
        />
      ))}
      <span className="live-blast-core" />
      <span className="live-shockwave first" />
      <span className="live-shockwave second" />
    </div>
    {effect.currentTeamShielded ? <ShieldImpact /> : (
      <div className="live-effect-banner danger">
        <strong>MƯA SAO BĂNG</strong>
        <span>{effect.message || "Tất cả đội mất 10 máu"}</span>
      </div>
    )}
  </>
);

const MonsterEffect = ({ effect }) => (
  <>
    <div className="live-claw-flash" aria-hidden="true" />
    <div className="live-claws" aria-hidden="true"><i /><i /><i /></div>
    {effect.currentTeamShielded ? <ShieldImpact /> : (
      <div className="live-monster-card">
        <small>ĐÒN TẤN CÔNG TOÀN BẢN ĐỒ</small>
        <strong>QUÁI VẬT TẤN CÔNG</strong>
        <span>{effect.message || "Mỗi đội nộp 10 điểm hoặc mất 10 máu"}</span>
      </div>
    )}
  </>
);

export const EventEffectOverlay = ({ effect }) => {
  if (!effect) return null;

  return (
    <div
      aria-atomic="true"
      aria-live="assertive"
      className={`live-effect-overlay is-${effect.kind}`}
      key={effect.id}
      role="status"
    >
      {effect.kind === "freeze" && <FreezeEffect effect={effect} />}
      {effect.kind === "meteor" && <MeteorEffect effect={effect} />}
      {effect.kind === "monster" && <MonsterEffect effect={effect} />}
      {effect.kind === "shield" && <ShieldImpact teamName={effect.loserName} />}
    </div>
  );
};
