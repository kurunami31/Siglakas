import { NextResponse } from "next/server";
import { can } from "@/lib/auth/permissions";
import { AuthError, requireSession } from "@/lib/auth/server";
import { getStore } from "@/lib/store/state-store";
import { sortStandings } from "@/lib/scoring/rank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CSV exports for the official record.
 *
 * The sheet is the source of truth, but the Secretariat still needs a portable
 * snapshot for the archives and for printouts, so this renders the same numbers
 * the public site shows — standings and medals from published results only.
 */

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

function download(filename: string, body: string): NextResponse {
  return new NextResponse(`\uFEFF${body}`, {
    headers: {
      // The BOM makes Excel read it as UTF-8; without it, ฿ and accented names break.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!can(session.role, "export")) {
      return NextResponse.json({ error: 'Requires the "export" permission' }, { status: 403 });
    }

    const what = new URL(request.url).searchParams.get("what") ?? "medals";
    const state = await getStore().ensureFresh();
    const stamp = new Date().toISOString().slice(0, 10);
    const teamById = new Map(state.teams.map((t) => [t.id, t]));

    if (what === "medals" || what === "standings") {
      const rows = sortStandings(state.standings, "overall");
      const withPoints = what === "standings";
      const header = [
        "rank", "crew", "code", "group", "gold", "silver", "bronze", "total_medals",
        ...(withPoints ? ["points"] : []),
      ];
      const body = rows.map((r) => {
        const t = teamById.get(r.teamId);
        const base: unknown[] = [
          r.ranks.overall,
          t?.name ?? r.teamId,
          t?.shortName ?? "",
          t?.group ?? "",
          r.overall.gold,
          r.overall.silver,
          r.overall.bronze,
          r.overall.totalMedals,
        ];
        return withPoints ? [...base, r.overall.points] : base;
      });
      return download(`siglakas-${what}-${stamp}.csv`, toCsv([header, ...body]));
    }

    if (what === "results") {
      const eventById = new Map(state.events.map((e) => [e.id, e]));
      const rows = [...state.results]
        .sort((a, b) => {
          const ea = eventById.get(a.eventId)?.name ?? a.eventId;
          const eb = eventById.get(b.eventId)?.name ?? b.eventId;
          return ea.localeCompare(eb) || a.placement - b.placement;
        })
        .map((r) => {
          const e = eventById.get(r.eventId);
          const t = teamById.get(r.teamId);
          const medal =
            r.status === "published" && r.placement >= 1 && r.placement <= 3
              ? r.placement === 1
                ? "gold"
                : r.placement === 2
                  ? "silver"
                  : "bronze"
              : "";
          return [
            r.eventId,
            e?.name ?? "",
            e?.division ?? "",
            e?.category ?? "",
            t?.shortName ?? r.teamId,
            r.placement,
            r.tie ? "TRUE" : "FALSE",
            r.status,
            medal,
            e?.medalWeight ?? "",
            r.enteredBy ?? "",
            r.timestamp,
          ];
        });
      const header = [
        "event_id", "event", "division", "category", "crew", "placement", "tie",
        "status", "medal", "medal_weight", "entered_by", "timestamp",
      ];
      return download(`siglakas-results-${stamp}.csv`, toCsv([header, ...rows]));
    }

    if (what === "events") {
      const rows = [...state.events]
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
        .map((e) => [
          e.id, e.name, e.division, e.category, e.scoringType, e.medalWeight, e.gender,
          e.multiplier, e.schedule, e.venue, e.status,
          e.locked ? "TRUE" : "FALSE",
          e.verify ? "TRUE" : "FALSE",
          e.note ?? "",
        ]);
      const header = [
        "id", "name", "division", "category", "scoring_type", "medal_weight", "gender",
        "multiplier", "schedule", "venue", "status", "locked", "verify", "note",
      ];
      return download(`siglakas-events-${stamp}.csv`, toCsv([header, ...rows]));
    }

    return NextResponse.json(
      { error: "Unknown export. Use what=medals|standings|results|events" },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
