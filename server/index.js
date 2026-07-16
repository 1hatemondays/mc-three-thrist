import cors from "cors";
import express from "express";
import http from "node:http";
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
      <li><a href="http://${host}:5173/guide">M\u00e0n h\u00ecnh d\u1eabn tr\u00f2 ch\u01a1i</a></li>
    </ul>
    <p>Kiểm tra máy chủ: <a href="/health">/health</a></p>
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
        error: "Nhập tên đội trước khi vào."
      });
      return;
    }

    if (gameState.setup?.started && !findTeam(id)) {
      socket.emit(EVENTS.GAME_STATE, {
        error: "Trò chơi đã bắt đầu, không thể thêm đội mới."
      });
      return;
    }

    if (Object.keys(gameState.setup?.submissions || {}).length > 0 && !findTeam(id)) {
      socket.emit(EVENTS.GAME_STATE, {
        error: "Đã có đội nộp mê cung, không thể thêm đội mới nữa."
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
  console.log(`Máy chủ đang chạy tại http://${config.host}:${config.port}`);
});
