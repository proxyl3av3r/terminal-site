import HomeClient from "@/components/home/HomeClient";

// Серверный компонент: читает статус верификации из query и отдаёт клиенту.
export default function HomePage({
  searchParams,
}: {
  searchParams: { verified?: string };
}) {
  return <HomeClient verified={searchParams.verified} />;
}
