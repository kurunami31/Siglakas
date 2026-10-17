import type { Metadata } from "next";
import { EventExplorer } from "@/components/events";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Islands & Events" };

export default function Page() {
  return <EventExplorer />;
}
