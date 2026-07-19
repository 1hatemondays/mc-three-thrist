import React, { useEffect, useRef, useState } from "react";
import { getScoreDelta, nextDisplayedScore, normalizeScore } from "./scoreEffects.js";

const EMBERS = Array.from({ length: 7 }, (_, index) => index);

export const AnimatedScore = ({ className = "", value }) => {
  const target = normalizeScore(value);
  const [displayValue, setDisplayValue] = useState(target);
  const [burst, setBurst] = useState(null);
  const previousValueRef = useRef(target);
  const burstIdRef = useRef(0);

  useEffect(() => {
    const previous = previousValueRef.current;
    const delta = getScoreDelta(previous, target);
    previousValueRef.current = target;

    if (!delta) {
      setDisplayValue(target);
      return undefined;
    }

    const reducedMotion =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      setDisplayValue(target);
      setBurst(null);
      return undefined;
    }

    burstIdRef.current += 1;
    setBurst({ delta, id: burstIdRef.current });

    const countTimer = window.setInterval(() => {
      setDisplayValue((current) => {
        const next = nextDisplayedScore(current, target);
        if (next === target) window.clearInterval(countTimer);
        return next;
      });
    }, 48);
    const burstTimer = window.setTimeout(() => setBurst(null), 1550);

    return () => {
      window.clearInterval(countTimer);
      window.clearTimeout(burstTimer);
    };
  }, [target]);

  const classes = ["score-effect", className].filter(Boolean).join(" ");

  return (
    <span className={classes} data-score-effect>
      <span className="score-effect-value">{displayValue}</span>
      {burst && (
        <span
          aria-atomic="true"
          aria-live="polite"
          className={"score-burst " + (burst.delta > 0 ? "gain" : "loss")}
          key={burst.id}
          role="status"
        >
          <span className="score-burst-aura" />
          <span className="score-burst-label">{burst.delta > 0 ? "+" : ""}{burst.delta}</span>
          <span aria-hidden="true" className="score-embers">
            {EMBERS.map((ember) => <i key={ember} />)}
          </span>
        </span>
      )}
    </span>
  );
};
