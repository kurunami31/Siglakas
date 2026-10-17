import type { Criterion, JudgeScore, Team } from "../types";

export type TieBreak = "first_criterion" | "manual" | "none";

export interface JudgedStanding {
  teamId: string;
  /** weighted average score per judge */
  judgeScores: Record<string, number>;
  /** weighted average across all judges */
  finalScore: number;
  /** average per criterion (used for tie-breaks) */
  criterionScores: Record<string, number>;
  rank: number;
  /** team ids sharing this exact score */
  tiedWith: string[];
  tied: boolean;
}

/**
 * Score a judged (socio-cultural) event.
 *
 * - Criteria carry weights; weights are normalised across the criteria that
 *   actually have scores, so a missing criterion cannot silently zero a team.
 * - Each judge produces a weighted average, then judges are averaged.
 * - Ties are resolved with `tieBreak`:
 *    - "first_criterion": compare the average of the highest-weighted criterion
 *    - "manual": keep the tie and flag it (Secretariat decides later)
 *    - "none": fall back to stable order
 */
export function computeJudgedStandings(
  eventId: string,
  teams: Team[],
  criteria: Criterion[],
  judgeScores: JudgeScore[],
  tieBreak: TieBreak = "first_criterion",
): JudgedStanding[] {
  const eventCriteria = criteria
    .filter((c) => c.eventId === eventId)
    .sort((a, b) => a.order - b.order);
  const criteriaNames = eventCriteria.map((c) => c.criterion);
  const scores = judgeScores.filter((s) => s.eventId === eventId);

  const judges = [...new Set(scores.map((s) => s.judge))];

  const rows = teams.map((team) => {
    const teamScores = scores.filter((s) => s.teamId === team.id);
    const judgeScoresMap: Record<string, number> = {};
    const criterionTotals: Record<string, { sum: number; n: number }> = {};
    for (const name of criteriaNames) criterionTotals[name] = { sum: 0, n: 0 };

    for (const judge of judges) {
      const forJudge = teamScores.filter((s) => s.judge === judge);
      if (forJudge.length === 0) continue;
      let weightSum = 0;
      let acc = 0;
      for (const s of forJudge) {
        const criterion = eventCriteria.find((c) => c.criterion === s.criterion);
        if (!criterion) continue;
        weightSum += criterion.weight;
        acc += s.score * criterion.weight;
        criterionTotals[s.criterion].sum += s.score;
        criterionTotals[s.criterion].n += 1;
      }
      if (weightSum > 0) judgeScoresMap[judge] = round2(acc / weightSum);
    }

    const judgeValues = Object.values(judgeScoresMap);
    const finalScore =
      judgeValues.length > 0
        ? round2(judgeValues.reduce((a, b) => a + b, 0) / judgeValues.length)
        : 0;

    const criterionScores: Record<string, number> = {};
    for (const name of criteriaNames) {
      const t = criterionTotals[name];
      criterionScores[name] = t.n > 0 ? round2(t.sum / t.n) : 0;
    }

    return { teamId: team.id, judgeScores: judgeScoresMap, finalScore, criterionScores };
  });

  const topCriterion = [...eventCriteria].sort((a, b) => b.weight - a.weight)[0]?.criterion;

  const sorted = [...rows].sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (tieBreak === "first_criterion" && topCriterion) {
      const diff = b.criterionScores[topCriterion] - a.criterionScores[topCriterion];
      if (diff !== 0) return diff;
    }
    return 0;
  });

  // Assign competition ranks, honouring declared ties.
  const standings: JudgedStanding[] = [];
  let lastScore: number | null = null;
  let lastRank = 0;
  sorted.forEach((row, i) => {
    const isTie =
      tieBreak === "manual" && lastScore !== null && row.finalScore === lastScore;
    const rank = isTie ? lastRank : i + 1;
    lastScore = row.finalScore;
    lastRank = rank;
    standings.push({
      ...row,
      rank,
      tied: tieBreak === "manual" && sorted.some((o) => o.finalScore === row.finalScore && o.teamId !== row.teamId),
      tiedWith: sorted
        .filter((o) => o.finalScore === row.finalScore && o.teamId !== row.teamId)
        .map((o) => o.teamId),
    });
  });

  return standings;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
