const envNumber = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

export const config = {
  host: process.env.HOST || "0.0.0.0",
  port: envNumber("PORT", 3000),
  teamCount: envNumber("TEAM_COUNT", 4),
  hostAccessKey: process.env.HOST_ACCESS_KEY || ""
};
