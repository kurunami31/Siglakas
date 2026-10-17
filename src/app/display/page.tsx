import type { Metadata } from "next";
import { DisplayView } from "@/components/display";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "TV / Projector Mode" };

export default function Page() {
  return <DisplayView />;
}
