import VerifyConfirm from "@/components/auth/VerifyConfirm";

// Лёгкая страница подтверждения email (без canvas/boot тяжёлой главной).
// GET-ссылка из письма ведёт сюда; само подтверждение — POST из браузера
// (см. VerifyConfirm), чтобы префетч почтовых сканеров не тратил токен.
export default function VerifyPage({
  searchParams,
}: {
  searchParams: { token?: string; email?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-[min(92vw,440px)]">
        <VerifyConfirm token={searchParams.token ?? ""} email={searchParams.email ?? ""} />
      </div>
    </main>
  );
}
