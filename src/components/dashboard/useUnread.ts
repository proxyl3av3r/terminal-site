"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Опрос числа непрочитанных + входящих запросов для бейджа на пункте chat.
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
    const i = setInterval(poll, 10000);
    return () => {
      alive = false;
      clearInterval(i);
    };
  }, [pathname]);

  return unread;
}
