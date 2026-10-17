import type { Metadata } from "next";
import { SportsView } from "@/components/sports";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sports Seas" };

export default function Page() {
  return <SportsView />;
}
