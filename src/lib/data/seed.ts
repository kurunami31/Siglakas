import type {
  Announcement,
  Config,
  Criterion,
  EventItem,
  Gender,
  JudgeScore,
  Match,
  Result,
  Team,
  TeamUser,
} from "../types";
import { DEFAULT_PLACEMENT_TABLE } from "../scoring/placement";

/* ------------------------------------------------------------------ *
 * CREWS (the 12 competing teams)
 *
 * Colours and mascots come from the official "SIGLAKAS 2026 TEAM IDENTITIES"
 * sheet. `color` is the crew's REAL primary colour and is stored verbatim.
 *
 * Three of them are darker than the navy they get drawn on (FTED, CEC and
 * TARRAGONA — see `accentFor()` in lib/format.ts), so the UI lifts those for
 * display rather than keeping a faded copy of the truth in here. Editing a
 * colour in the admin screen or the Teams tab changes what is stored, not what
 * is shown, and vice versa.
 *
 * The official SECONDARY colours are recorded for reference only — the data
 * model carries one accent per crew, so nothing reads these:
 *   FAHUSCIC #B6DFE6 · FCJE #FFFFFF · FTED #2e86f0 · FBM #FFFFFF · FNAHS #FFFFFF
 *   BAGANGA #135c51 · BANAYBANAY #800000 · TARRAGONA Dim Gray · SAN ISIDRO #000000
 *   CATEEL #FFFFFF · FACET and FALS: none specified
 * ------------------------------------------------------------------ */

export const TEAMS: Team[] = [
  { id: "fted", name: "Faculty of Teacher Education", shortName: "FTED", group: "faculty", color: "#1a22a8", logoFile: "fted", mascot: "Phoenix", motto: "Rise and teach, rise and soar" },
  { id: "facet", name: "Faculty of Computing, Engineering, and Technology", shortName: "FACET", group: "faculty", color: "#FF5C00", logoFile: "facet", mascot: "Stallion", motto: "Build the future, ride the storm" },
  { id: "fahuscic", name: "Faculty of Human Sciences and Communication", shortName: "FAHUSCIC", group: "faculty", color: "#3FC7DD", logoFile: "fahuscic", mascot: "Shark (FaHuSciC Jaws)", motto: "Words cut deeper than tides" },
  { id: "fals", name: "Faculty of Agriculture and Life Sciences", shortName: "FALS", group: "faculty", color: "#6FBF5C", logoFile: "fals", mascot: "Python", motto: "Harvest the horizon" },
  { id: "fbm", name: "Faculty of Business and Management", shortName: "FBM", group: "faculty", color: "#FFDF00", logoFile: "fbm", mascot: "Griffins", motto: "Own the market, own the sky" },
  { id: "fcje", name: "Faculty of Criminal Justice Education", shortName: "FCJE", group: "faculty", color: "#FF2C2C", logoFile: "fcje", mascot: "Eagle", motto: "Justice flies on crimson wings" },
  { id: "fnahs", name: "Faculty of Nursing and Allied Health Sciences", shortName: "FNAHS", group: "faculty", color: "#C29320", logoFile: "fnahs", mascot: "Pegasus", motto: "Heal, rise, ascend" },
  { id: "siec", name: "San Isidro Extension Campus", shortName: "SIEC", group: "extension_campus", color: "#FFDF22", logoFile: "siec", mascot: "Hornets", motto: "Small wings, sharp sting" },
  { id: "tec", name: "Tarragona Extension Campus", shortName: "TEC", group: "extension_campus", color: "#000000", logoFile: "tec", mascot: "Direwolves", motto: "The pack never sails alone" },
  { id: "bec", name: "Banay-Banay Extension Campus", shortName: "BEC", group: "extension_campus", color: "#8b0000", logoFile: "bec", mascot: "Bulls", motto: "Charge without fear" },
  { id: "bgec", name: "Baganga Extension Campus", shortName: "BGEC", group: "extension_campus", color: "#59c9ae", logoFile: "bgec", mascot: "Bakunawa", motto: "From the deep, undefeated" },
  { id: "cec", name: "Cateel Extension Campus", shortName: "CEC", group: "extension_campus", color: "#080d61", logoFile: "cec", mascot: "Kraken", motto: "Many arms, one grip" },
];

/* ------------------------------------------------------------------ *
 * EVENTS (the 97 islands)
 * ------------------------------------------------------------------ */

interface EventSeed {
  id: string;
  name: string;
  category: string;
  medalWeight: number;
  gender?: Gender;
  division: "sports" | "cultural";
  verify?: boolean;
  note?: string;
  /**
   * Overrides the category-derived scoring type. Needed for participation events
   * (FUN RUN, FUNEBALL): their category is "Special Event", which otherwise maps
   * to a normal placement event, and a participation event scored as a placement
   * would award nothing at all.
   */
  scoringType?: EventItem["scoringType"];
}

const SPORTS_SEEDS: EventSeed[] = [
  // Team Sports — 65
  { id: "sepak-m", name: "Sepaktakraw (M)", category: "Team Sports", medalWeight: 3, gender: "M", division: "sports" },
  { id: "sepak-w", name: "Sepaktakraw (W)", category: "Team Sports", medalWeight: 3, gender: "W", division: "sports" },
  { id: "volley-m", name: "Volleyball (M)", category: "Team Sports", medalWeight: 6, gender: "M", division: "sports" },
  { id: "volley-w", name: "Volleyball (W)", category: "Team Sports", medalWeight: 6, gender: "W", division: "sports" },
  { id: "basketball-m", name: "Basketball (M) 5x5", category: "Team Sports", medalWeight: 5, gender: "M", division: "sports" },
  { id: "basketball-w", name: "Basketball (W) 5x5", category: "Team Sports", medalWeight: 5, gender: "W", division: "sports" },
  { id: "football", name: "Football", category: "Team Sports", medalWeight: 7, gender: "Open", division: "sports" },
  { id: "futsal", name: "Futsal", category: "Team Sports", medalWeight: 5, gender: "Open", division: "sports" },
  { id: "softball", name: "Softball", category: "Team Sports", medalWeight: 9, gender: "Open", division: "sports" },
  { id: "baseball", name: "Baseball", category: "Team Sports", medalWeight: 9, gender: "Open", division: "sports" },
  { id: "ultimate-frisbee", name: "Ultimate Frisbee", category: "Team Sports", medalWeight: 7, gender: "Open", division: "sports" },
  // E-Sports — 14
  { id: "esports-ml", name: "Mobile Legends", category: "E-Sports", medalWeight: 5, gender: "Open", division: "sports" },
  { id: "esports-cod-mp", name: "Call of Duty (MP)", category: "E-Sports", medalWeight: 5, gender: "Open", division: "sports" },
  { id: "esports-cod-br", name: "Call of Duty (BR)", category: "E-Sports", medalWeight: 4, gender: "Open", division: "sports" },
  // Individual / Dual — 159
  { id: "athletics-m", name: "Athletics (M)", category: "Individual/Dual Sports", medalWeight: 20, gender: "M", division: "sports" },
  { id: "athletics-w", name: "Athletics (W)", category: "Individual/Dual Sports", medalWeight: 20, gender: "W", division: "sports" },
  { id: "badminton-singles", name: "Badminton Singles (M&W)", category: "Individual/Dual Sports", medalWeight: 2, gender: "M&W", division: "sports" },
  { id: "badminton-doubles", name: "Badminton Doubles (M&W)", category: "Individual/Dual Sports", medalWeight: 4, gender: "M&W", division: "sports" },
  { id: "badminton-mixed-doubles", name: "Badminton Mixed Doubles", category: "Individual/Dual Sports", medalWeight: 2, gender: "Open", division: "sports" },
  { id: "chess-m", name: "Chess (M)", category: "Individual/Dual Sports", medalWeight: 4, gender: "M", division: "sports" },
  { id: "chess-w", name: "Chess (W)", category: "Individual/Dual Sports", medalWeight: 4, gender: "W", division: "sports" },
  { id: "dart-singles", name: "Dart Singles (M&W)", category: "Individual/Dual Sports", medalWeight: 2, gender: "M&W", division: "sports" },
  { id: "dart-doubles", name: "Dart Doubles (M&W)", category: "Individual/Dual Sports", medalWeight: 4, gender: "M&W", division: "sports" },
  { id: "dart-mixed", name: "Dart Mixed", category: "Individual/Dual Sports", medalWeight: 2, gender: "Open", division: "sports" },
  { id: "dart-mixed-3man", name: "Dart Mixed 3 Man", category: "Individual/Dual Sports", medalWeight: 3, gender: "Open", division: "sports" },
  { id: "tt-singles", name: "Table Tennis Singles (M&W)", category: "Individual/Dual Sports", medalWeight: 2, gender: "M&W", division: "sports" },
  { id: "tt-doubles", name: "Table Tennis Doubles (M&W)", category: "Individual/Dual Sports", medalWeight: 4, gender: "M&W", division: "sports" },
  { id: "tt-mixed-doubles", name: "Table Tennis Mixed Doubles", category: "Individual/Dual Sports", medalWeight: 2, gender: "Open", division: "sports" },
  { id: "tennis-singles", name: "Tennis Singles (M&W)", category: "Individual/Dual Sports", medalWeight: 2, gender: "M&W", division: "sports" },
  { id: "tennis-doubles", name: "Tennis Doubles (M&W)", category: "Individual/Dual Sports", medalWeight: 4, gender: "M&W", division: "sports" },
  { id: "tennis-mixed-doubles", name: "Tennis Mixed Doubles", category: "Individual/Dual Sports", medalWeight: 2, gender: "Open", division: "sports" },
  { id: "taekwondo-m", name: "Taekwondo (M)", category: "Individual/Dual Sports", medalWeight: 8, gender: "M", division: "sports" },
  { id: "taekwondo-w", name: "Taekwondo (W)", category: "Individual/Dual Sports", medalWeight: 8, gender: "W", division: "sports" },
  { id: "billiard-m", name: "Billiard (M)", category: "Individual/Dual Sports", medalWeight: 2, gender: "M", division: "sports" },
  { id: "billiard-w", name: "Billiard (W)", category: "Individual/Dual Sports", medalWeight: 2, gender: "W", division: "sports" },
  { id: "pickleball-singles", name: "Pickleball Singles (M&W)", category: "Individual/Dual Sports", medalWeight: 2, gender: "M&W", division: "sports" },
  { id: "pickleball-doubles", name: "Pickleball Doubles (M&W)", category: "Individual/Dual Sports", medalWeight: 4, gender: "M&W", division: "sports" },
  { id: "pickleball-mixed-doubles", name: "Pickleball Mixed Doubles", category: "Individual/Dual Sports", medalWeight: 2, gender: "Open", division: "sports" },
  { id: "swimming-m", name: "Swimming (M)", category: "Individual/Dual Sports", medalWeight: 12, gender: "M", division: "sports" },
  { id: "swimming-w", name: "Swimming (W)", category: "Individual/Dual Sports", medalWeight: 12, gender: "W", division: "sports" },
  { id: "arnis-padded-m", name: "Arnis Padded Point (M)", category: "Individual/Dual Sports", medalWeight: 8, gender: "M", division: "sports" },
  { id: "arnis-padded-w", name: "Arnis Padded Point (W)", category: "Individual/Dual Sports", medalWeight: 8, gender: "W", division: "sports" },
  { id: "arnis-anyo-m", name: "Arnis Anyo (M)", category: "Individual/Dual Sports", medalWeight: 4, gender: "M", division: "sports" },
  { id: "arnis-anyo-w", name: "Arnis Anyo (W)", category: "Individual/Dual Sports", medalWeight: 4, gender: "W", division: "sports" },
  // Traditional Games — 18
  { id: "tug-of-war", name: "Tug-of-War", category: "Traditional Games", medalWeight: 8, gender: "Open", division: "sports" },
  { id: "skipping-rope", name: "Skipping Rope", category: "Traditional Games", medalWeight: 8, gender: "Open", division: "sports" },
  { id: "chinese-garter", name: "Chinese Garter (M/W)", category: "Traditional Games", medalWeight: 2, gender: "M&W", division: "sports" },
  // Mind Games — 8
  { id: "word-scrabble", name: "Word Scrabble (M/W)", category: "Mind Games", medalWeight: 2, gender: "M&W", division: "sports" },
  { id: "word-factory", name: "Word Factory (M/W)", category: "Mind Games", medalWeight: 2, gender: "M&W", division: "sports" },
  { id: "rubiks-patterned", name: "Rubik's Cube Patterned (M/W)", category: "Mind Games", medalWeight: 2, gender: "M&W", division: "sports" },
  { id: "rubiks-standard", name: "Rubik's Cube Standard (M/W)", category: "Mind Games", medalWeight: 2, gender: "M&W", division: "sports" },
  // Special sports
  // Participation events: no placing, so one gold per participant and a weight of
  // 1 so the count IS the golds. They are exempt from the placement ladder
  // entirely — they are not games or matches.
  { id: "fun-run", name: "FUN RUN", category: "Special Event", medalWeight: 1, gender: "Open", division: "sports", scoringType: "participation" },
  { id: "funeball", name: "FUNEBALL", category: "Special Event", medalWeight: 1, gender: "Open", division: "sports", scoringType: "participation" },
];

const CULTURAL_SEEDS: EventSeed[] = [
  // Visual Arts — 5
  { id: "poster-making", name: "On the Spot Poster Making", category: "Visual Arts", medalWeight: 1, division: "cultural" },
  { id: "pencil-drawing", name: "Pencil Drawing", category: "Visual Arts", medalWeight: 1, division: "cultural" },
  { id: "charcoal-rendering", name: "Charcoal Rendering", category: "Visual Arts", medalWeight: 1, division: "cultural" },
  { id: "in-situ-painting", name: "In-situ Painting", category: "Visual Arts", medalWeight: 1, division: "cultural" },
  { id: "photo-contest", name: "Photo Contest", category: "Visual Arts", medalWeight: 1, division: "cultural" },
  // Music Arts — 43
  { id: "song-writing", name: "Song Writing", category: "Music Arts", medalWeight: 2, division: "cultural" },
  { id: "piano", name: "Piano", category: "Music Arts", medalWeight: 1, division: "cultural" },
  { id: "violin", name: "Violin", category: "Music Arts", medalWeight: 1, division: "cultural" },
  { id: "classical-guitar", name: "Classical Guitar", category: "Music Arts", medalWeight: 1, division: "cultural" },
  { id: "bandurria", name: "Banduria", category: "Music Arts", medalWeight: 1, division: "cultural" },
  // Confirmed with OSCAL: 5. The manual's printed line and its Music Arts
  // sub-total disagreed; the printed line was the correct one.
  { id: "live-band", name: "Live Band Competition", category: "Music Arts", medalWeight: 5, division: "cultural" },
  { id: "vocal-solo-kundiman", name: "Vocal Solo (Kundiman)", category: "Music Arts", medalWeight: 1, division: "cultural" },
  { id: "vocal-duet", name: "Vocal Duet", category: "Music Arts", medalWeight: 2, division: "cultural" },
  { id: "pop-solo", name: "Pop Solo", category: "Music Arts", medalWeight: 1, division: "cultural" },
  { id: "quartet", name: "Quartet", category: "Music Arts", medalWeight: 4, division: "cultural" },
  { id: "chorale", name: "Standard Chorale Contest", category: "Music Arts", medalWeight: 10, division: "cultural" },
  { id: "show-choir", name: "Show Choir", category: "Music Arts", medalWeight: 10, division: "cultural" },
  // Dance Arts — 46
  { id: "folk-dance", name: "Folk Dance", category: "Dance Arts", medalWeight: 10, division: "cultural" },
  { id: "contemporary-duo", name: "Contemporary Duo", category: "Dance Arts", medalWeight: 2, division: "cultural" },
  { id: "contemporary-dance", name: "Contemporary Dance", category: "Dance Arts", medalWeight: 10, division: "cultural" },
  { id: "street-dance", name: "Street Dance", category: "Dance Arts", medalWeight: 10, division: "cultural" },
  { id: "dance-sports", name: "Dance Sports", category: "Dance Arts", medalWeight: 14, division: "cultural" },
  // Dramatic Arts — 19
  { id: "short-sweet-dialogue", name: "Short and Sweet Play (Dialogue)", category: "Dramatic Arts", medalWeight: 5, division: "cultural" },
  { id: "short-sweet-musical", name: "Short and Sweet Play (Musical)", category: "Dramatic Arts", medalWeight: 5, division: "cultural" },
  { id: "radio-drama", name: "Radio Drama", category: "Dramatic Arts", medalWeight: 5, division: "cultural" },
  { id: "duo-acting", name: "Duo Acting", category: "Dramatic Arts", medalWeight: 2, division: "cultural" },
  { id: "pandalawahang", name: "Pandalawahang Pag-Arte", category: "Dramatic Arts", medalWeight: 2, division: "cultural" },
  // Literary Arts — 13
  { id: "sanaysay", name: "Pagsulat ng Sanaysay", category: "Literary Arts", medalWeight: 1, division: "cultural" },
  { id: "dagliang-talumpati", name: "Dagliang Talumpati", category: "Literary Arts", medalWeight: 1, division: "cultural" },
  { id: "pagkukuwento", name: "Pagkukuwento", category: "Literary Arts", medalWeight: 1, division: "cultural" },
  { id: "essay-writing", name: "Essay Writing", category: "Literary Arts", medalWeight: 1, division: "cultural" },
  { id: "extemporaneous-speech", name: "Extemporaneous Speech", category: "Literary Arts", medalWeight: 1, division: "cultural" },
  { id: "storytelling", name: "Storytelling", category: "Literary Arts", medalWeight: 1, division: "cultural" },
  { id: "declamation", name: "Declamation", category: "Literary Arts", medalWeight: 1, division: "cultural" },
  { id: "deklamasyon", name: "Deklamasyon", category: "Literary Arts", medalWeight: 1, division: "cultural" },
  { id: "dramatic-monologue", name: "Dramatic Monologue", category: "Literary Arts", medalWeight: 1, division: "cultural" },
  { id: "dramatic-monologue-fil", name: "Dramatic Monologue (Filipino)", category: "Literary Arts", medalWeight: 1, division: "cultural" },
  { id: "oral-interpretation-poetry", name: "Oral Interpretation of Poetry", category: "Literary Arts", medalWeight: 1, division: "cultural" },
  { id: "persuasive-oratory", name: "Persuasive Oratory", category: "Literary Arts", medalWeight: 1, division: "cultural" },
  { id: "oratorio", name: "Oratorio", category: "Literary Arts", medalWeight: 1, division: "cultural" },
  // Special Category — 38
  { id: "ginoong-dorsu", name: "Ginoong DOrSU", category: "Special Category", medalWeight: 10, gender: "M", division: "cultural" },
  { id: "hiyas-ng-dorsu", name: "Hiyas ng DOrSU", category: "Special Category", medalWeight: 10, gender: "W", division: "cultural" },
  { id: "cheer-dance", name: "Cheer Dance", category: "Special Category", medalWeight: 15, division: "cultural" },
  { id: "mascot", name: "Mascot", category: "Special Category", medalWeight: 3, division: "cultural" },
];

function scoringTypeFor(category: string): EventItem["scoringType"] {
  if (category === "Team Sports" || category === "E-Sports") return "match";
  if (category === "Individual/Dual Sports" || category === "Traditional Games" || category === "Mind Games" || category === "Special Event") {
    return "placement";
  }
  // every socio-cultural event is judged
  return "judged";
}

export const EVENTS: EventItem[] = [...SPORTS_SEEDS, ...CULTURAL_SEEDS].map((s) => ({
  id: s.id,
  name: s.name,
  division: s.division,
  category: s.category,
  scoringType: s.scoringType ?? scoringTypeFor(s.category),
  medalWeight: s.medalWeight,
  gender: s.gender ?? "Open",
  multiplier: 1,
  status: "upcoming",
  locked: false,
  verify: s.verify,
  note: s.note,
}));

/* ------------------------------------------------------------------ *
 * JUDGING CRITERIA (defaults per category — fully editable)
 * ------------------------------------------------------------------ */

export const CRITERIA_BY_CATEGORY: Record<string, Array<{ criterion: string; weight: number }>> = {
  "Visual Arts": [
    { criterion: "Creativity", weight: 40 },
    { criterion: "Craftsmanship", weight: 30 },
    { criterion: "Impact", weight: 30 },
  ],
  "Music Arts": [
    { criterion: "Musicality", weight: 40 },
    { criterion: "Technique", weight: 30 },
    { criterion: "Stage Presence", weight: 30 },
  ],
  "Dance Arts": [
    { criterion: "Technique", weight: 40 },
    { criterion: "Choreography", weight: 30 },
    { criterion: "Stage Presence", weight: 30 },
  ],
  "Dramatic Arts": [
    { criterion: "Acting", weight: 40 },
    { criterion: "Stage Presence", weight: 30 },
    { criterion: "Overall Impact", weight: 30 },
  ],
  "Literary Arts": [
    { criterion: "Content", weight: 40 },
    { criterion: "Delivery", weight: 30 },
    { criterion: "Language", weight: 30 },
  ],
  "Special Category": [
    { criterion: "Poise & Presence", weight: 30 },
    { criterion: "Talent", weight: 30 },
    { criterion: "Interview", weight: 20 },
    { criterion: "Cultural Attire", weight: 20 },
  ],
};

/**
 * Per-event weightings where the manual specifies an exact scoring table rather
 * than a per-category default. Source: SIGLAKAS 2026 Manual of Operations.
 */
export const CRITERIA_BY_EVENT: Record<string, Array<{ criterion: string; weight: number }>> = {
  // "SCORING SYSTEM for PRELIMINARY ROUND (TOP 5)" — totals 100%
  "ginoong-dorsu": [
    { criterion: "Closed-Door Interview", weight: 30 },
    { criterion: "Talent Competition", weight: 15 },
    { criterion: "Cultural Attire", weight: 15 },
    { criterion: "Production Number", weight: 10 },
    { criterion: "Playsuit", weight: 15 },
    { criterion: "Barong Tagalog / Modern Terno", weight: 15 },
  ],
  "hiyas-ng-dorsu": [
    { criterion: "Closed-Door Interview", weight: 30 },
    { criterion: "Talent Competition", weight: 15 },
    { criterion: "Cultural Attire", weight: 15 },
    { criterion: "Production Number", weight: 10 },
    { criterion: "Playsuit", weight: 15 },
    { criterion: "Barong Tagalog / Modern Terno", weight: 15 },
  ],
  // Cheer Dance is adjudicated as a dance routine, not as a pageant.
  "cheer-dance": [
    { criterion: "Technique", weight: 40 },
    { criterion: "Choreography", weight: 30 },
    { criterion: "Stage Presence", weight: 30 },
  ],
};

export function buildCriteria(events: EventItem[]): Criterion[] {
  const out: Criterion[] = [];
  for (const e of events) {
    if (e.scoringType !== "judged") continue;
    const set =
      CRITERIA_BY_EVENT[e.id] ??
      CRITERIA_BY_CATEGORY[e.category] ??
      CRITERIA_BY_CATEGORY["Music Arts"];
    set.forEach((c, i) => {
      out.push({ eventId: e.id, criterion: c.criterion, weight: c.weight, order: i });
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * CONFIG
 * ------------------------------------------------------------------ */

export const DEFAULT_CONFIG: Config = {
  competitionName: "DORSU Socio-Cultural & Sports Festival",
  schoolName: "Davao Oriental State University",
  subtitle: "The Grand Line Tally",
  // Both SIGLAKAS 2026 manuals: "The greatest number of gold medals earned to
  // win the overall championship", tie-broken by silvers then bronzes.
  championshipRankBy: "gold_first",
  medalPoints: { gold: 3, silver: 2, bronze: 1 },
  defaultPlacementTable: DEFAULT_PLACEMENT_TABLE,
  terminology: "onepiece",
  pointsFreeze: false,
  revealMode: false,
};

/* ------------------------------------------------------------------ *
 * DEMO ACCOUNTS
 *   superadmin  / grandline-superadmin
 *   secretariat / grandline-secretariat
 *   pio         / grandline-pio
 * ------------------------------------------------------------------ */

export const DEMO_USERS: TeamUser[] = [
  {
    username: "superadmin",
    passwordHash: "$2b$10$FNdc9DmXRwC0G9ttNj6Rge41fjv7Tp/Zx0VF8t4F9YI/zDe7Xu3qi",
    role: "superadmin",
    teamId: "",
    active: true,
  },
  {
    username: "secretariat",
    passwordHash: "$2b$10$0klWGr.GHl9AgBWzrcuZnexdNsc6nGv1F.sW2rishE2Hjr3733pO.",
    role: "secretariat",
    teamId: "",
    active: true,
  },
  {
    username: "pio",
    passwordHash: "$2b$10$yazpTsgbAede0iobJ1FrVu0IvhVdnCzNOxHHd/Ca3H4N4s4PaUHbny",
    role: "pio",
    teamId: "",
    active: true,
  },
];

export const DEMO_ANNOUNCEMENTS: Announcement[] = [
  { timestamp: nowMinus(35), message: "Welcome to the Grand Line! The Grand Line Tally is now live. Fair winds to all twelve crews!", postedBy: "secretariat" },
  { timestamp: nowMinus(18), message: "Basketball (M) 5x5 tips off at the university gym at 3:00 PM. Come cheer for your crew!", postedBy: "pio" },
];

/* ------------------------------------------------------------------ *
 * DEMO DATA GENERATORS
 * ------------------------------------------------------------------ */

/** Deterministic PRNG so demo mode looks the same on every reload. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_STRENGTH: Record<string, number> = {
  fbm: 0.94, facet: 0.88, fnahs: 0.83, fted: 0.79, fals: 0.75, fahuscic: 0.71, fcje: 0.66,
  bgec: 0.82, cec: 0.77, siec: 0.7, tec: 0.63, bec: 0.58,
};

export interface DemoBundle {
  results: Result[];
  matches: Match[];
  judgeScores: JudgeScore[];
}

export function generateDemoData(
  events: EventItem[],
  teams: Team[],
  criteria: Criterion[],
  seed = 20261016,
): DemoBundle {
  const rng = mulberry32(seed);
  const results: Result[] = [];
  const matches: Match[] = [];
  const judgeScores: JudgeScore[] = [];

  const byId = (id: string) => teams.find((t) => t.id === id)!;

  /** teams sorted by strength with a little noise */
  const ranked = () =>
    [...teams]
      .map((t) => ({ id: t.id, s: (DEMO_STRENGTH[t.id] ?? 0.5) + (rng() - 0.5) * 0.35 }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.id);

  const finishRatio = 0.42;

  for (const event of events) {
    const done = rng() < finishRatio;
    const live = !done && rng() < 0.12;
    if (!done && !live) continue;

    const order = ranked();
    const top = order.slice(0, Math.min(6, teams.length));

    if (event.scoringType === "match") {
      // one final + a live group match for flavour
      const [a, b] = top;
      matches.push({
        id: `${event.id}-final`,
        eventId: event.id,
        round: "Final",
        teamA: a,
        teamB: b,
        scoreA: done ? 3 : 1,
        scoreB: done ? Math.max(0, 3 - Math.round(rng() * 3)) : 1,
        detail: done ? "25-20, 22-25, 25-18, 25-21" : "18-15",
        winner: done ? a : "",
        status: done ? "final" : "live",
      });
      if (done) {
        results.push(mkResult(event.id, a, 1, "published"));
        results.push(mkResult(event.id, b, 2, "published"));
        results.push(mkResult(event.id, top[2], 3, "published"));
      }
      continue;
    }

    if (event.scoringType === "judged") {
      const rows = judgeScoresFor(event.id, order, criteria, rng);
      const publish = done;
      for (const { teamId, judge, criterion, score } of rows) {
        judgeScores.push({ eventId: event.id, teamId, judge, criterion, score });
      }
      if (publish) {
        const finals = order.map((id, i) => ({ id, score: baseScore(DEMO_STRENGTH[id] ?? 0.5, rng) }));
        finals.sort((x, y) => y.score - x.score);
        finals.slice(0, 3).forEach((f, i) => results.push(mkResult(event.id, f.id, i + 1, "published")));
        if (rng() < 0.5) {
          results.push(mkResult(event.id, "cec", 0, "published"));
        }
      } else if (live) {
        results.push(mkResult(event.id, order[0], 1, "draft"));
      }
      continue;
    }

    // placement events
    if (done) {
      top.slice(0, 3).forEach((id, i) => results.push(mkResult(event.id, id, i + 1, "published")));
      if (rng() < 0.35) results.push(mkResult(event.id, order[3], 4, "published"));
      if (rng() < 0.25) results.push(mkResult(event.id, order[4], 0, "published"));
    } else if (live) {
      results.push(mkResult(event.id, order[0], 1, "draft"));
    }
  }

  void byId;
  return { results, matches, judgeScores };
}

function mkResult(eventId: string, teamId: string, placement: number, status: Result["status"]): Result {
  return { eventId, teamId, placement, tie: false, status, enteredBy: status === "published" ? "secretariat" : "pio", timestamp: new Date().toISOString() };
}

function baseScore(strength: number, rng: () => number): number {
  return Math.round((70 + strength * 28 + (rng() - 0.5) * 6) * 10) / 10;
}

function judgeScoresFor(
  eventId: string,
  order: string[],
  criteria: Criterion[],
  rng: () => number,
): JudgeScore[] {
  const cs = criteria.filter((c) => c.eventId === eventId);
  const judges = ["Judge A", "Judge B", "Judge C"];
  const rows: JudgeScore[] = [];
  for (const teamId of order.slice(0, 6)) {
    const strength = DEMO_STRENGTH[teamId] ?? 0.5;
    for (const judge of judges) {
      for (const c of cs) {
        rows.push({
          eventId,
          teamId,
          judge,
          criterion: c.criterion,
          score: Math.max(60, Math.min(100, Math.round(baseScore(strength, rng) + c.weight / 10))),
        });
      }
    }
  }
  return rows;
}

function nowMinus(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}
