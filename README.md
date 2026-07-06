# Mê Cung Tri Thức

Web game show realtime cho lớp học: Node.js + Express + Socket.io làm backend, hai React/Vite app riêng cho host TV và player.

## Kiến trúc deploy

- `server/`: backend Socket.io, giữ toàn bộ state trong RAM.
- `host/`: frontend cho màn hình TV, build ra static files.
- `player/`: frontend cho đội chơi, build ra static files.
- `shared/constants.js`: tên socket events dùng chung.

Backend cần được deploy ở nơi hỗ trợ Node.js và WebSocket. Host/player có thể deploy như static site, nhưng phải trỏ về backend bằng biến môi trường `VITE_SERVER_URL`.

## Chạy local

```bash
npm install
npm run dev
```

Mặc định:

- Server: `http://localhost:3000`
- Host: `http://localhost:5173`
- Player: `http://localhost:5174`

Nếu test bằng điện thoại cùng Wi-Fi, mở host/player bằng IP LAN của laptop và để server bind `0.0.0.0` như hiện tại.

## Biến môi trường

Backend:

```bash
PORT=3000
HOST=0.0.0.0
TEAM_COUNT=4
```

Frontend:

```bash
VITE_SERVER_URL=https://your-backend.example.com
```

`VITE_SERVER_URL` phải là URL public của backend Socket.io. Nếu không set, frontend sẽ mặc định gọi cùng hostname ở port `3000`, chỉ phù hợp khi chạy local/LAN.

## Build để deploy

Backend:

```bash
npm install
npm run start --workspace server
```

Host frontend:

```bash
npm install
npm exec --workspace host vite build
```

Deploy thư mục `host/dist`.

Player frontend:

```bash
npm install
npm exec --workspace player vite build
```

Deploy thư mục `player/dist`.

## Lưu ý production

- State đang nằm trong RAM, server restart là mất phiên chơi.
- Chưa có database, login thật, HTTPS config riêng, hoặc lưu lịch sử.
- Khi deploy tách domain, backend phải cho phép WebSocket từ domain của host/player.
