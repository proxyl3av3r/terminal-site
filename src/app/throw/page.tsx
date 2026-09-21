import type { Metadata } from "next";
import ThrowSenderClient from "@/components/throw/ThrowSenderClient";

export const metadata: Metadata = {
  title: "бросок жестом — bash-app.com",
  description: "схвати объект жестом перед камерой и брось его на телефон",
};

export default function ThrowPage() {
  return <ThrowSenderClient />;
}
