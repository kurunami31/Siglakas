import type { Metadata } from "next";
import { Require } from "@/components/admin/require";
import { JudgeScores } from "@/components/admin/judge-scores";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Judge scores" };

export default function Page() {
  return (
    <Require permission="edit_result">
      <JudgeScores />
    </Require>
  );
}
