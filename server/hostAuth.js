import { timingSafeEqual } from "node:crypto";

export const isValidHostAccessKey = (providedKey, expectedKey) => {
  if (
    typeof providedKey !== "string" ||
    typeof expectedKey !== "string" ||
    !/^\d{4}$/.test(providedKey) ||
    !/^\d{4}$/.test(expectedKey)
  ) {
    return false;
  }

  const provided = Buffer.from(providedKey);
  const expected = Buffer.from(expectedKey);

  return provided.length === expected.length && timingSafeEqual(provided, expected);
};
