import type { CompetitionState, RawSheets } from "../types";
import type { Repository } from "../data/repo";
import { DemoRepository } from "../data/demo-repo";
import { SheetsRepository } from "../data/sheets-repo";
import { loadCredentialsFromEnv } from "../data/google";
import { DEFAULT_CONFIG } from "../data/seed";

export function isDemoMode(): boolean {
  const flag = process.env.DEMO_MODE;
  if (flag === "0" || flag === "false") return false;
  // default to demo unless a spreadsheet id + credentials are present
  const hasSheets = !!process.env.GOOGLE_SHEET_ID && !!loadCredentialsFromEnv();
  return flag === "1" || flag === "true" || !hasSheets;
}

export function createRepository(): Repository {
  if (isDemoMode()) return new DemoRepository();

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const creds = loadCredentialsFromEnv();
  if (!spreadsheetId || !creds) {
    console.warn("[repo] Sheets mode requested but credentials missing — falling back to demo data");
    return new DemoRepository();
  }
  return new SheetsRepository(spreadsheetId, creds, DEFAULT_CONFIG);
}
