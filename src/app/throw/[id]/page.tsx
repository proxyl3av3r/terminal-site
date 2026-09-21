import type { Metadata, Viewport } from "next";
import ThrowReceiverClient from "@/components/throw/ThrowReceiverClient";

export const metadata: Metadata = {
  title: "лови — bash-app.com",
  description: "поймай объект, брошенный с ноутбука",
};

// Свайпы должны управлять шаром, а не браузерным зумом/скроллом страницы.
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function ThrowRoomPage({ params }: { params: { id: string } }) {
  return <ThrowReceiverClient roomId={params.id} />;
}
