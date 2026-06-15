import ResetForm from "@/components/auth/ResetForm";

// Страница из письма сброса пароля: /reset?token=...&email=...
export default function ResetPage({
  searchParams,
}: {
  searchParams: { token?: string; email?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <ResetForm
        token={searchParams.token ?? ""}
        email={searchParams.email ?? ""}
      />
    </main>
  );
}
