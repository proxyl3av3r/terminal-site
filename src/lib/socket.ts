"use client";

import { io, type Socket } from "socket.io-client";

// Один общий сокет на вкладку (его шарят ChatClient, Sidebar, MobileNav).
// Подключаемся к тому же ориджину; Nginx проксирует /socket.io/ на realtime.
// Cookie сессии next-auth уходит автоматически (same-origin) — по ней сервер
// аутентифицирует соединение.
let socket: Socket | null = null;

export function getChatSocket(): Socket {
  if (!socket) {
    socket = io({
      path: "/socket.io",
      withCredentials: true,
      // polling → upgrade до websocket (Nginx настроен на Upgrade-заголовки).
      reconnectionDelayMax: 8000,
    });
  }
  return socket;
}
