import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/admin";
import AdminUsers from "@/components/dashboard/AdminUsers";

// Раздел доступен только супер-админу (SUPER_ADMIN_EMAILS). Иначе — на дашборд.
export default async function AdminPage() {
  const admin = await getAdmin();
  if (!admin) redirect("/dashboard");
  return <AdminUsers />;
}
