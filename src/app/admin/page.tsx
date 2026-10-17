import type { Metadata } from "next";
import { Require } from "@/components/admin/require";
import { QuickResult } from "@/components/admin/quick-result";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quick results" };

export default function Page() {
  return (
    <Require permission="edit_result">
      <QuickResult />
    </Require>
  );
}
