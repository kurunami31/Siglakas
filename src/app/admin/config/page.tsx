import type { Metadata } from "next";
import { Require } from "@/components/admin/require";
import { PointSystem } from "@/components/admin/point-system";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Point system" };

export default function Page() {
  return (
    <Require permission="manage_points">
      <PointSystem />
    </Require>
  );
}
