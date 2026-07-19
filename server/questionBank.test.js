import test from "node:test";
import assert from "node:assert/strict";
import { drawQuestion, drawQuestions } from "./questionBank.js";

const questions = [
  { id: "q1", text: "Câu 1" },
  { id: "q2", text: "Câu 2" },
  { id: "q3", text: "Câu 3" }
];

test("drawQuestion does not repeat questions inside the same bank cycle", () => {
  const state = {};

  assert.equal(drawQuestion(state, "normal", questions, () => 0).id, "q1");
  assert.equal(drawQuestion(state, "normal", questions, () => 0).id, "q2");
  assert.equal(drawQuestion(state, "normal", questions, () => 0).id, "q3");
});

test("drawQuestions returns a unique batch and marks the bank as used", () => {
  const state = {};
  const picked = drawQuestions(state, "normal", questions, 3, () => 0);

  assert.deepEqual(picked.map((question) => question.id), ["q1", "q2", "q3"]);
  assert.deepEqual(state.usedQuestionIds.normal, ["q1", "q2", "q3"]);
});

test("normal and hard banks track used questions independently", () => {
  const state = {};

  assert.equal(drawQuestion(state, "normal", questions, () => 0).id, "q1");
  assert.equal(drawQuestion(state, "hard", questions, () => 0).id, "q1");
  assert.deepEqual(state.usedQuestionIds.normal, ["q1"]);
  assert.deepEqual(state.usedQuestionIds.hard, ["q1"]);
});
