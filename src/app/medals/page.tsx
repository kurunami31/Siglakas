import type { Metadata } from "next";
import { MedalTally } from "@/components/medal-table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Medal Tally" };

export default function Page() {
  return <MedalTally />;
}
