import type { Metadata } from "next";
import { Require } from "@/components/admin/require";
import { MatchScoring } from "@/components/admin/match-scoring";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Match scoring" };

export default function Page() {
  return (
    <Require permission="edit_result">
      <MatchScoring />
    </Require>
  );
}
