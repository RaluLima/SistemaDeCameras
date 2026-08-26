const { createServer } = require("http");
const { Server } = require("socket.io");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

let io;

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));

  io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/api/socketio",
  });

  globalThis._io = io;

  io.on("connection", (socket) => {
    console.log(`[WS] Cliente conectado: ${socket.id}`);

    socket.on("join-camera", (cameraId) => {
      socket.join(`camera:${cameraId}`);
      console.log(`[WS] ${socket.id} entrou na sala camera:${cameraId}`);
    });

    socket.on("leave-camera", (cameraId) => {
      socket.leave(`camera:${cameraId}`);
    });

    socket.on("disconnect", () => {
      console.log(`[WS] Cliente desconectado: ${socket.id}`);
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO rodando em /api/socketio`);
  });
});
