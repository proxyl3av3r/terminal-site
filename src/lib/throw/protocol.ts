// Общие типы событий namespace «/throw» (см. realtime/throw.mjs).
// Скорости/позиция едут НЕ в пикселях, а нормализованными (см. physics.ts
// toWire/fromWire) — экраны ноутбука и телефона разного размера.

export type Edge = "top" | "left" | "right" | "bottom";

export interface ThrowPeer {
  id: string;
  position: Edge | "top" | "bottom" | "left" | "right";
}

export interface ThrowPayload {
  objectId: string;
  vx: number; // канвасов ширины / с
  vy: number; // канвасов высоты / с
  spin: number; // rad/s
  color: string;
  exitEdge: Edge | null;
  pos: number; // 0..1 — доля вдоль стороны выхода, куда войдёт объект на той стороне
  targetId?: string | null;
}

export interface IncomingThrow extends ThrowPayload {
  from: string; // "sender" | peerId телефона
  at: number; // Date.now() на сервере — для приблизительной компенсации задержки
}
