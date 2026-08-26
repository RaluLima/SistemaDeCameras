import { Server as SocketIOServer } from "socket.io";

declare global {
  var _io: SocketIOServer | undefined;
}

export function getIO(): SocketIOServer | null {
  if (globalThis._io) {
    return globalThis._io;
  }
  return null;
}

export function emitAlert(data: {
  id: string;
  cameraId: string;
  cameraName: string;
  type: string;
  description: string;
  timestamp: string;
}) {
  const socket = getIO();
  if (!socket) {
    console.log("[WS] Socket.IO não disponível, alerta criado apenas no banco");
    return;
  }

  socket.emit("new-alert", data);
  socket.to(`camera:${data.cameraId}`).emit("camera-alert", data);
  console.log(`[WS] Alerta emitido: ${data.type} para camera ${data.cameraName}`);
}
