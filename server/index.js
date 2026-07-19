import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { EVENTS, ROOMS } from "../shared/constants.js";
import { config } from "./config.js";
import { ensureTeam, findTeam, gameState, getHostState, getPlayerState, normalizeTeamId } from "./gameState.js";
import { registerAuctionHandlers } from "./handlers/auction.js";
import { registerCombatHandlers } from "./handlers/combat.js";
import { registerEventHandlers } from "./handlers/event.js";
import { registerMovementHandlers } from "./handlers/movement.js";
import { registerMeteorHandlers } from "./handlers/meteor.js";
import { registerSetupHandlers } from "./handlers/setup.js";
import { registerSupportHandlers } from "./handlers/support.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const hostDist = path.resolve(serverDirectory, "../host/dist");
const playerDist = path.resolve(serverDirectory, "../player/dist");
const hasFrontendBuilds =
  existsSync(path.join(hostDist, "index.html")) &&
  existsSync(path.join(playerDist, "index.html"));

app.use(cors());
app.use(express.json());

if (hasFrontendBuilds) {
  app.use("/host", express.static(hostDist));
  app.use("/player", express.static(playerDist));

  app.get(["/host", "/host/*"], (_req, res) => {
    res.sendFile(path.join(hostDist, "index.html"));
  });

  app.get(["/player", "/player/*"], (_req, res) => {
    res.sendFile(path.join(playerDist, "index.html"));
  });
}

app.get("/", (req, res) => {
  const host = req.hostname === "0.0.0.0" ? "localhost" : req.hostname;
  const playerUrl = hasFrontendBuilds ? "/player/" : `http://${host}:5174/`;
  const hostUrl = hasFrontendBuilds ? "/host/" : `http://${host}:5173/`;
  const guideUrl = hasFrontendBuilds ? "/host/guide" : `http://${host}:5173/guide`;

  res.type("html").send(`<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>M\u00ea Cung Tri Th\u1ee9c</title>
  </head>
  <body>
    <h1>M\u00ea Cung Tri Th\u1ee9c</h1>
    <p>M\u1edf giao di\u1ec7n tr\u00f2 ch\u01a1i:</p>
    <ul>
      <li><a href="${playerUrl}">M\u00e0n h\u00ecnh \u0111\u1ed9i ch\u01a1i</a></li>
      <li><a href="${hostUrl}">M\u00e0n h\u00ecnh host</a></li>
      <li><a href="${guideUrl}">M\u00e0n h\u00ecnh d\u1eabn tr\u00f2 ch\u01a1i</a></li>
    </ul>
    <p>Ki\u1ec3m tra m\u00e1y ch\u1ee7: <a href="/health">/health</a></p>
  </body>
</html>`);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, teams: getHostState().teams.length });
});

const emitHostState = () => {
  io.to(ROOMS.HOSTS).emit(EVENTS.GAME_STATE, getHostState());
};

io.on("connection", (socket) => {
  if (socket.handshake.auth?.role === "host") {
    socket.data.role = "host";
    socket.join(ROOMS.HOSTS);
    socket.emit(EVENTS.GAME_STATE, getHostState());
  }

  socket.on(EVENTS.TEAM_JOIN, ({ teamId, teamName } = {}) => {
    const id = normalizeTeamId(teamId);
    if (!id) {
      socket.emit(EVENTS.GAME_STATE, {
        error: "Nh\u1eadp t\u00ean \u0111\u1ed9i tr\u01b0\u1edbc khi v\u00e0o."
      });
      return;
    }

    if (gameState.setup?.started && !findTeam(id)) {
      socket.emit(EVENTS.GAME_STATE, {
        error: "Tr\u00f2 ch\u01a1i \u0111\u00e3 b\u1eaft \u0111\u1ea7u, kh\u00f4ng th\u1ec3 th\u00eam \u0111\u1ed9i m\u1edbi."
      });
      return;
    }

    if (Object.keys(gameState.setup?.submissions || {}).length > 0 && !findTeam(id)) {
      socket.emit(EVENTS.GAME_STATE, {
        error: "\u0110\u00e3 c\u00f3 \u0111\u1ed9i n\u1ed9p m\u00ea cung, kh\u00f4ng th\u1ec3 th\u00eam \u0111\u1ed9i m\u1edbi n\u1eefa."
      });
      return;
    }

    const team = ensureTeam(gameState, id, teamName);

    socket.data.teamId = id;
    socket.join(ROOMS.team(id));
    socket.emit(EVENTS.GAME_STATE, getPlayerState(id));
    emitHostState();
  });

  registerSetupHandlers(io, socket);
  registerMovementHandlers(io, socket);
  registerAuctionHandlers(io, socket);
  registerCombatHandlers(io, socket);
  registerEventHandlers(io, socket);
  registerSupportHandlers(io, socket);
  registerMeteorHandlers(io, socket);
});

server.listen(config.port, config.host, () => {
  console.log(`M\u00e1y ch\u1ee7 \u0111ang ch\u1ea1y t\u1ea1i http://${config.host}:${config.port}`);
});
