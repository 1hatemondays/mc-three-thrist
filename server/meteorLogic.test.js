import assert from "node:assert/strict";
import test from "node:test";
import { ROUND_PHASES } from "../shared/constants.js";
import {
  getMeteorShowerState,
  startMeteorShower,
  submitMeteorAnswer,
  submitMeteorBuzz
} from "./meteorLogic.js";

const makeTeam = (id) => ({
  id,
  name: id,
  hp: 100,
  score: 0,
  position: { x: 0, y: 0 },
  effects: {},
  supportItems: []
});

const makeState = () => ({
  config: { boardSize: 6, teamCount: 3 },
  teams: [makeTeam("team1"), makeTeam("team2"), makeTeam("team3")],
  setup: { complete: true, started: true },
  round: {
    roundNumber: 1,
    phase: ROUND_PHASES.MOVEMENT,
    turnOrder: ["team1", "team2", "team3"],
    activeTeamId: "team1",
    pendingAnswers: {},
    pendingEvents: {},
    messages: {}
  }
});

const questions = Array.from({ length: 10 }, (_, index) => ({
  id: "q" + index,
  text: "Question " + index,
  choices: ["A", "B"],
  correctIndex: 0
}));

test("meteor shower runs 10 sealed buzzer questions and applies rewards", () => {
  const state = makeState();
  assert.equal(startMeteorShower(state, "team1", questions, () => 0, 1000).ok, true);
  assert.equal(state.round.phase, ROUND_PHASES.METEOR_SHOWER);
  assert.equal(getMeteorShowerState(state, "team1", 1000).question.correctIndex, undefined);
  assert.equal(submitMeteorBuzz(state, "team2", 3999).ok, false);

  let now = 4000;
  for (let index = 0; index < 10; index += 1) {
    const teamId = index < 6 ? "team2" : "team1";
    assert.equal(submitMeteorBuzz(state, teamId, now).ok, true);
    const result = submitMeteorAnswer(state, teamId, { answerIndex: 0 }, now);
    assert.equal(result.ok, true);
    now += 3000;
  }

  const meteor = getMeteorShowerState(state, "team1", now);
  assert.equal(state.round.phase, ROUND_PHASES.MOVEMENT);
  assert.equal(meteor.result.winnerId, "team2");
  assert.equal(state.teams[1].score, 50);
  assert.equal(state.teams[0].hp, 85);
  assert.equal(state.teams[2].hp, 85);
  assert.equal(state.round.pendingAnswers.team1.result.skipped, true);
  assert.equal(state.round.pendingAnswers.team3.result.skipped, true);
  assert.equal(state.round.activeTeamId, "team2");
});
