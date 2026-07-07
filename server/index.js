import cors from "cors";
import express from "express";
import http from "node:http";
import { Server } from "socket.io";
import { EVENTS, ROOMS } from "../shared/constants.js";
import { config } from "./config.js";
import { findTeam, getHostState, getPlayerState, normalizeTeamId } from "./gameState.js";
import { registerAuctionHandlers } from "./handlers/auction.js";
import { registerCombatHandlers } from "./handlers/combat.js";
import { registerMovementHandlers } from "./handlers/movement.js";
import { registerSetupHandlers } from "./handlers/setup.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  const host = req.hostname === "0.0.0.0" ? "localhost" : req.hostname;
  res.type("html").send(`<!doctype html>
<html lang="vi">
  <body>
    <h1>Mê Cung Tri Thức - máy chủ</h1>
    <p>Mở giao diện trò chơi tại đây:</p>
    <ul>
      <li><a href="http://${host}:5174/">Màn hình đội chơi</a></li>
      <li><a href="http://${host}:5173/">Màn hình host</a></li>
    </ul>
    <p>Kiểm tra máy chủ: <a href="/health">/health</a></p>
  </body>
</html>`);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, teams: getHostState().config.teamCount });
});

const emitHostState = () => {
  io.to(ROOMS.HOSTS).emit(EVENTS.GAME_STATE, getHostState());
};

io.on("connection", (socket) => {
  if (socket.handshake.auth?.role === "host") {
    socket.join(ROOMS.HOSTS);
    socket.emit(EVENTS.GAME_STATE, getHostState());
  }

  socket.on(EVENTS.TEAM_JOIN, ({ teamId } = {}) => {
    const id = normalizeTeamId(teamId);
    const team = findTeam(id);

    if (!team) {
      socket.emit(EVENTS.GAME_STATE, {
        error: "Mã đội không tồn tại",
        allowedTeamIds: getHostState().teams.map(({ id }) => id)
      });
      return;
    }

    socket.data.teamId = id;
    socket.join(ROOMS.team(id));
    socket.emit(EVENTS.GAME_STATE, getPlayerState(id));
    emitHostState();
  });

  registerSetupHandlers(io, socket);
  registerMovementHandlers(io, socket);
  registerAuctionHandlers(io, socket);
  registerCombatHandlers(io, socket);
});

server.listen(config.port, config.host, () => {
  console.log(`Máy chủ đang chạy tại http://${config.host}:${config.port}`);
});
