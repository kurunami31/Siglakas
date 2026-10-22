import type { Metadata } from "next";
import { MedalTally } from "@/components/medal-table";
import { SealedStandings } from "@/components/effects";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Medal Tally" };

export default function Page() {
  // Sealed here rather than inside the table: the freeze hides the standings, and
  // this page *is* the standings. Without it the audience read the whole tally off
  // this page while the home board claimed to be locked.
  return (
    <SealedStandings>
      <MedalTally />
    </SealedStandings>
  );
}
