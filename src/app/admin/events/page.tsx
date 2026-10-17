import type { Metadata } from "next";
import { Require } from "@/components/admin/require";
import { EventAdmin } from "@/components/admin/event-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Events & locks" };

export default function Page() {
  return (
    <Require permission="manage_events">
      <EventAdmin />
    </Require>
  );
}
