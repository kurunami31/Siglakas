import type { Metadata } from "next";
import { Require } from "@/components/admin/require";
import { AuditLog } from "@/components/admin/audit-log";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Audit log" };

export default function Page() {
  return (
    <Require permission="view_audit">
      <AuditLog />
    </Require>
  );
}
