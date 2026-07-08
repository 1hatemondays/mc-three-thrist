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
