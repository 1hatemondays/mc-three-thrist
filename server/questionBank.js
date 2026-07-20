import fs from "node:fs";

const QUESTIONS_PATH = new URL("./data/questions.json", import.meta.url);
const HARD_QUESTIONS_PATH = new URL("./data/hardQuestions.json", import.meta.url);

export const loadQuestionBank = () => {
  const raw = fs.readFileSync(QUESTIONS_PATH, "utf8");
  const questions = JSON.parse(raw);

  if (!Array.isArray(questions)) {
    throw new Error("Ngân hàng câu hỏi phải là một mảng.");
  }

  return questions;
};

export const questionBank = loadQuestionBank();
export const hardQuestionBank = JSON.parse(fs.readFileSync(HARD_QUESTIONS_PATH, "utf8"));

const questionKey = (question, index) => question?.id || question?.text || String(index);

const usedSetFor = (state, bankKey) => {
  state.usedQuestionIds = state.usedQuestionIds || {};
  state.usedQuestionIds[bankKey] = state.usedQuestionIds[bankKey] || [];
  return new Set(state.usedQuestionIds[bankKey]);
};

const saveUsedSet = (state, bankKey, usedSet) => {
  state.usedQuestionIds = state.usedQuestionIds || {};
  state.usedQuestionIds[bankKey] = [...usedSet];
};

export const drawQuestion = (state, bankKey, questions, random = Math.random) => {
  if (!Array.isArray(questions) || questions.length === 0) return null;

  const used = usedSetFor(state, bankKey);
  let pool = questions
    .map((question, index) => ({ question, key: questionKey(question, index) }))
    .filter((entry) => !used.has(entry.key));

  if (!pool.length) {
    used.clear();
    pool = questions.map((question, index) => ({ question, key: questionKey(question, index) }));
  }

  const index = Math.min(Math.floor(random() * pool.length), pool.length - 1);
  const entry = pool[index];
  used.add(entry.key);
  saveUsedSet(state, bankKey, used);
  return entry.question;
};

export const drawQuestions = (state, bankKey, questions, count, random = Math.random) => {
  if (!Array.isArray(questions) || questions.length === 0 || count < 1) return [];

  const entries = questions.map((question, index) => ({ question, key: questionKey(question, index) }));
  const used = usedSetFor(state, bankKey);
  const picked = [];
  const pickedKeys = new Set();

  while (picked.length < count && picked.length < entries.length) {
    let pool = entries.filter((entry) => !used.has(entry.key) && !pickedKeys.has(entry.key));
    if (!pool.length) {
      used.clear();
      pool = entries.filter((entry) => !pickedKeys.has(entry.key));
    }

    if (!pool.length) break;
    const index = Math.min(Math.floor(random() * pool.length), pool.length - 1);
    const entry = pool[index];
    used.add(entry.key);
    pickedKeys.add(entry.key);
    picked.push(entry.question);
  }

  saveUsedSet(state, bankKey, used);
  return picked;
};
