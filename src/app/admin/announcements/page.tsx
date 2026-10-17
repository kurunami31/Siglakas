import type { Metadata } from "next";
import { Require } from "@/components/admin/require";
import { Announcements } from "@/components/admin/announcements";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Announcements" };

export default function Page() {
  return (
    <Require permission="post_announcement">
      <Announcements />
    </Require>
  );
}
