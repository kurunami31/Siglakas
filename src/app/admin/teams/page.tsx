import type { Metadata } from "next";
import { Require } from "@/components/admin/require";
import { TeamAdmin } from "@/components/admin/team-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Teams & logos" };

export default function Page() {
  return (
    <Require permission="manage_teams">
      <TeamAdmin />
    </Require>
  );
}
