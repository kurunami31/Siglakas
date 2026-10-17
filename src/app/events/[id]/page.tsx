import type { Metadata } from "next";
import { EventDetailView } from "@/components/events";
import { getPublicState } from "@/lib/server-state";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const state = await getPublicState();
  const event = state.events.find((e) => e.id === id);
  return { title: event?.name ?? "Island" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventDetailView eventId={id} />;
}
