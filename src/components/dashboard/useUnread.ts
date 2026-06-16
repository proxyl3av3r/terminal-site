"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getChatSocket } from "@/lib/socket";

// Число непрочитанных + входящих запросов для бейджа на пункте chat.
// Realtime: пересчитываем мгновенно на событиях сокета; поллинг оставлен
// редким страховочным fallback (если realtime недоступен).
export function useUnread(): number {
  const [unread, setUnread] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/chat/unread");
        const data = await res.json();
        if (alive && data.ok) setUnread(data.total ?? data.count ?? 0);
      } catch {
        /* ignore */
      }
    };
    poll();

    // Мгновенный пересчёт при активности в чате.
    const socket = getChatSocket();
    const bump = () => poll();
    socket.on("conversation:bump", bump);
    socket.on("request:new", bump);
    socket.on("conversation:removed", bump);

    // Страховочный fallback (раньше было 10с) — на случай простоя realtime.
    const i = setInterval(poll, 30000);
    return () => {
      alive = false;
      clearInterval(i);
      socket.off("conversation:bump", bump);
      socket.off("request:new", bump);
      socket.off("conversation:removed", bump);
    };
  }, [pathname]);

  return unread;
}
