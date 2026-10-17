import type { Metadata } from "next";
import { TeamProfile } from "@/components/team-profile";
import { getPublicState } from "@/lib/server-state";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const state = await getPublicState();
  const team = state.teams.find((t) => t.id === id);
  return {
    title: team ? `${team.shortName} — The ${team.mascot}` : "Crew",
    description: team ? `${team.name} (${team.mascot}): medals, bounty and event-by-event results.` : undefined,
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeamProfile teamId={id} />;
}
