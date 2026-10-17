import type { Config } from "./types";

export interface Terms {
  points: string;
  rank: string;
  events: string;
  islands: string;
  teams: string;
  team: string;
  gold: string;
  silver: string;
  bronze: string;
  leaderboard: string;
  overall: string;
  sports: string;
  cultural: string;
  facultyFleet: string;
  campusFleet: string;
  live: string;
}

const ONEPIECE: Terms = {
  points: "Bounty",
  rank: "Pirate Rank",
  events: "Islands",
  islands: "Islands",
  teams: "Crews",
  team: "Crew",
  gold: "Gold Treasure",
  silver: "Silver Treasure",
  bronze: "Bronze Treasure",
  leaderboard: "Bounty Board",
  overall: "Grand Line Championship",
  sports: "Sports Seas",
  cultural: "Socio-Cultural Seas",
  facultyFleet: "Faculty Fleet",
  campusFleet: "Extension Campus Fleet",
  live: "LIVE",
};

const PLAIN: Terms = {
  points: "Points",
  rank: "Rank",
  events: "Events",
  islands: "Events",
  teams: "Teams",
  team: "Team",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  leaderboard: "Leaderboard",
  overall: "Overall Championship",
  sports: "Sports",
  cultural: "Socio-Cultural",
  facultyFleet: "Faculties",
  campusFleet: "Extension Campuses",
  live: "LIVE",
};

export function terms(config: Pick<Config, "terminology"> | undefined): Terms {
  return config?.terminology === "plain" ? PLAIN : ONEPIECE;
}
