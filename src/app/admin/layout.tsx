import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  return <AdminShell session={session}>{children}</AdminShell>;
}
