import type { Metadata } from "next";
import { Require } from "@/components/admin/require";
import { UserAdmin } from "@/components/admin/user-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Accounts" };

export default function Page() {
  return (
    <Require permission="manage_users">
      <UserAdmin />
    </Require>
  );
}
