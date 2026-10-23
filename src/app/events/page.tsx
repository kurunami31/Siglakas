import type { Metadata } from "next";
import { EventExplorer } from "@/components/events";
import { SealedStandings } from "@/components/effects";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Islands & Events" };

export default function Page() {
  // Every card names its top three finishers, so the list is a running
  // scoreboard — it closes with the board. Note this takes the schedule with it.
  return (
    <SealedStandings>
      <EventExplorer />
    </SealedStandings>
  );
}
