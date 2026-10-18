import type { MetadataRoute } from "next";
import { getViewerState } from "@/lib/server-state";

export const dynamic = "force-dynamic";

/**
 * Every public page: the landing pages plus one URL per crew and per event.
 * Built from live state so a new event or crew appears without touching code.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://siglakas.vercel.app";
  const state = await getViewerState();

  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/welcome`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/medals`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/events`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/sports`, changeFrequency: "hourly", priority: 0.7 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.3 },
  ];

  return [
    ...pages,
    ...state.teams.map((t) => ({
      url: `${base}/teams/${t.id}`,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
    ...state.events.map((e) => ({
      url: `${base}/events/${e.id}`,
      changeFrequency: "daily" as const,
      priority: 0.4,
    })),
  ];
}
