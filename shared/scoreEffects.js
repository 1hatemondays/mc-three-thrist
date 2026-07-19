const toFiniteScore = (value) => {
  const score = typeof value === "number" ? value : Number(value);
  return Number.isFinite(score) ? Math.round(score) : null;
};

export const normalizeScore = (value) => toFiniteScore(value) ?? 0;

export const getScoreDelta = (previous, next) => {
  const previousScore = toFiniteScore(previous);
  const nextScore = toFiniteScore(next);
  return previousScore === null || nextScore === null ? 0 : nextScore - previousScore;
};

export const nextDisplayedScore = (current, target) => {
  const currentScore = toFiniteScore(current);
  const targetScore = toFiniteScore(target);
  if (currentScore === null || targetScore === null || currentScore === targetScore) {
    return currentScore ?? targetScore ?? 0;
  }

  const difference = targetScore - currentScore;
  const step = Math.max(1, Math.ceil(Math.abs(difference) / 8));
  const next = currentScore + Math.sign(difference) * step;
  return difference > 0 ? Math.min(next, targetScore) : Math.max(next, targetScore);
};
