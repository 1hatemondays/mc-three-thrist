import { ROUND_PHASES } from "../shared/constants.js";
import { isGameOver } from "./gameOver.js";
import { addRoundMessage } from "./roundFlow.js";
import { consumeShield } from "./supportLogic.js";

const choose = (items, random = Math.random) => {
  if (!items.length) return null;
  return items[Math.min(Math.floor(random() * items.length), items.length - 1)];
};
const findTeam = (state, teamId) => state.teams.find((team) => team.id === teamId);
const publicTeam = (team) => team && ({ id: team.id, name: team.name, hp: team.hp, score: team.score });

export const startCombat = (state, attackerId, random = Math.random) => {
  if (isGameOver(state)) return null;
  const attacker = findTeam(state, attackerId);
  const defender = choose(state.teams.filter((team) => team.id !== attackerId), random);
  if (!attacker || !defender) return null;

  state.round.phase = ROUND_PHASES.COMBAT;
  state.round.combat = {
    attackerId: attacker.id,
    defenderId: defender.id,
    bets: {},
    result: null
  };
  addRoundMessage(state, attacker.id, { title: "Đối kháng", text: "Đấu với " + defender.name + ". Hãy đặt điểm." });
  addRoundMessage(state, defender.id, { title: "Đối kháng", text: attacker.name + " thách đấu. Hãy đặt điểm." });

  return { opponentId: defender.id, opponentName: defender.name };
};

const publicCombatResult = (combat) => combat?.result || null;

export const getPlayerCombatState = (state, teamId) => {
  const combat = state.round.combat;
  if (!combat) return null;
  const involved = teamId === combat.attackerId || teamId === combat.defenderId;
  const attacker = findTeam(state, combat.attackerId);
  const defender = findTeam(state, combat.defenderId);
  const opponentId = teamId === combat.attackerId ? combat.defenderId : combat.attackerId;
  const opponent = findTeam(state, opponentId);
  return {
    active: state.round.phase === ROUND_PHASES.COMBAT,
    involved,
    opponentId: involved ? opponentId : null,
    attacker: publicTeam(attacker),
    defender: publicTeam(defender),
    opponentName: involved ? opponent?.name || opponentId : null,
    submitted: Boolean(combat.bets?.[teamId]),
    submittedCount: Object.keys(combat.bets || {}).length,
    result: publicCombatResult(combat)
  };
};

export const getHostCombatState = (state) => {
  const combat = state.round.combat;
  if (!combat) return null;
  return {
    active: state.round.phase === ROUND_PHASES.COMBAT,
    attacker: publicTeam(findTeam(state, combat.attackerId)),
    defender: publicTeam(findTeam(state, combat.defenderId)),
    submittedCount: Object.keys(combat.bets || {}).length,
    result: publicCombatResult(combat)
  };
};

export const submitCombatBet = (state, teamId, payload = {}) => {
  if (isGameOver(state)) return { ok: false, error: "Trò chơi đã kết thúc." };
  const combat = state.round.combat;
  if (state.round.phase !== ROUND_PHASES.COMBAT || !combat) return { ok: false, error: "Hiện không có đối kháng." };
  if (![combat.attackerId, combat.defenderId].includes(teamId)) return { ok: false, error: "Đội không tham gia đối kháng này." };
  if (combat.bets[teamId]) return { ok: false, error: "Đội đã đặt điểm." };

  const team = findTeam(state, teamId);
  const amount = Number(payload.amount);
  if (!Number.isInteger(amount) || amount < 0) return { ok: false, error: "Mức đặt phải là số nguyên không âm." };
  if (amount > team.score) return { ok: false, error: "Không đủ điểm để đặt." };

  combat.bets[teamId] = { amount };
  if (!combat.bets[combat.attackerId] || !combat.bets[combat.defenderId]) return { ok: true, resolved: false };

  const attacker = findTeam(state, combat.attackerId);
  const defender = findTeam(state, combat.defenderId);
  const attackerBet = combat.bets[combat.attackerId].amount;
  const defenderBet = combat.bets[combat.defenderId].amount;
  attacker.score -= attackerBet;
  defender.score -= defenderBet;

  const winner = defenderBet > attackerBet ? defender : attacker;
  const loser = winner.id === attacker.id ? defender : attacker;
  const damage = Math.abs(attackerBet - defenderBet);
  const shield = damage > 0 ? consumeShield(loser) : null;
  if (!shield) loser.hp = Math.max(0, loser.hp - damage);

  combat.result = {
    winnerId: winner.id,
    winnerName: winner.name,
    loserId: loser.id,
    loserName: loser.name,
    hpLoss: shield ? 0 : damage,
    shielded: Boolean(shield)
  };
  delete combat.bets;
  state.round.phase = ROUND_PHASES.MOVEMENT;
  addRoundMessage(state, winner.id, { title: "Thắng đối kháng", text: "Đội thắng đối kháng." });
  addRoundMessage(state, loser.id, { title: "Thua đối kháng", text: shield ? "Lá chắn đã chặn sát thương." : "Mất " + damage + " máu." });
  return { ok: true, resolved: true, result: combat.result };
};
