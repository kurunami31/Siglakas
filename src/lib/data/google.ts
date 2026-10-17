import { SignJWT, importPKCS8 } from "jose";
import { readFileSync } from "node:fs";

/**
 * Minimal Google Sheets REST client.
 *
 * We deliberately do NOT pull in the full `googleapis` package: it is very
 * large (bad for serverless cold starts and the 250 MB function limit) and we
 * only need a handful of endpoints. Service-account auth here is a single
 * RS256-signed JWT exchanged for an access token — ~50 lines with `jose`,
 * which we already depend on for session tokens.
 */

export interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URI = "https://oauth2.googleapis.com/token";
const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Parse a service-account JSON blob.
 *
 * Hosts (and some `.env` editors) sometimes store the escaped `\n` sequences
 * inside `private_key` as real newlines, which is not valid JSON. Rather than
 * failing at 6am on competition day, re-escape just that field and retry.
 */
export function parseServiceAccountJson(raw: string): ServiceAccountCredentials {
  const text = raw.trim();
  try {
    return JSON.parse(text) as ServiceAccountCredentials;
  } catch {
    const match = text.match(/"private_key"\s*:\s*"([\s\S]*?[^\\])"\s*(,|\})/);
    if (match) {
      try {
        const repaired = text.replace(
          match[0],
          `"private_key": ${JSON.stringify(match[1].replace(/\\n/g, "\n"))}${match[2]}`,
        );
        return JSON.parse(repaired) as ServiceAccountCredentials;
      } catch {
        /* fall through to the clear error below */
      }
    }
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON - paste the whole key file as a single line",
    );
  }
}

/**
 * Credentials are resolved from, in order of preference:
 *   1. `GOOGLE_SERVICE_ACCOUNT_JSON` — the whole JSON blob (needed on Vercel,
 *      where there is no disk to mount a key file on)
 *   2. `GOOGLE_SERVICE_ACCOUNT_FILE` — a path to the downloaded .json key
 *      (nice locally: the private key never lands in an env var)
 *   3. `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`
 */
export function loadCredentialsFromEnv(): ServiceAccountCredentials | null {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (json && json.trim().startsWith("{")) {
    return parseServiceAccountJson(json);
  }

  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (file) {
    try {
      return JSON.parse(readFileSync(file, "utf8")) as ServiceAccountCredentials;
    } catch (err) {
      throw new Error(
        `GOOGLE_SERVICE_ACCOUNT_FILE could not be read (${file}): ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (email && key) {
    return { client_email: email, private_key: key.replace(/\\n/g, "\n") };
  }
  return null;
}

export async function getAccessToken(creds: ServiceAccountCredentials): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(creds.private_key, "RS256");
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(creds.client_email)
    .setAudience(creds.token_uri ?? TOKEN_URI)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch(creds.token_uri ?? TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

export class SheetsClient {
  constructor(
    private readonly spreadsheetId: string,
    private readonly creds: ServiceAccountCredentials,
  ) {}

  private async auth(): Promise<HeadersInit> {
    const token = await getAccessToken(this.creds);
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  /** Read several ranges in a single request (counts as ONE quota unit). */
  async batchGet(ranges: string[]): Promise<Record<string, string[][]>> {
    const headers = await this.auth();
    const params = new URLSearchParams();
    for (const r of ranges) params.append("ranges", r);
    params.set("majorDimension", "ROWS");
    const url = `${BASE}/${this.spreadsheetId}/values:batchGet?${params.toString()}`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) throw new Error(`Sheets batchGet failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      valueRanges?: Array<{ range: string; values?: string[][] }>;
    };
    const out: Record<string, string[][]> = {};
    for (const vr of data.valueRanges ?? []) {
      const name = vr.range.split("!")[0].replace(/^'|'$/g, "");
      out[name] = vr.values ?? [];
    }
    return out;
  }

  async append(range: string, values: (string | number)[][]): Promise<void> {
    const headers = await this.auth();
    const url = `${BASE}/${this.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ values }),
    });
    if (!res.ok) throw new Error(`Sheets append failed: ${res.status} ${await res.text()}`);
  }

  async update(range: string, values: (string | number)[][]): Promise<void> {
    const headers = await this.auth();
    const url = `${BASE}/${this.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, { method: "PUT", headers, body: JSON.stringify({ values }) });
    if (!res.ok) throw new Error(`Sheets update failed: ${res.status} ${await res.text()}`);
  }

  async clear(range: string): Promise<void> {
    const headers = await this.auth();
    const url = `${BASE}/${this.spreadsheetId}/values/${encodeURIComponent(range)}:clear`;
    const res = await fetch(url, { method: "POST", headers, body: "{}" });
    if (!res.ok) throw new Error(`Sheets clear failed: ${res.status} ${await res.text()}`);
  }

  /** Spreadsheet title plus each tab's title and numeric sheetId. */
  async getMeta(): Promise<{
    title: string;
    sheets: Array<{ title: string; sheetId: number }>;
  }> {
    const headers = await this.auth();
    const res = await fetch(
      `${BASE}/${this.spreadsheetId}?fields=properties.title,sheets.properties(title,sheetId)`,
      { headers, cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Sheets metadata failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      properties?: { title?: string };
      sheets?: Array<{ properties: { title: string; sheetId: number } }>;
    };
    return {
      title: data.properties?.title ?? "",
      sheets: (data.sheets ?? []).map((s) => ({
        title: s.properties.title,
        sheetId: s.properties.sheetId,
      })),
    };
  }

  /** Apply structural changes: add/rename tabs, freeze rows, validation, formats. */
  async batchUpdate(requests: unknown[]): Promise<void> {
    if (requests.length === 0) return;
    const headers = await this.auth();
    const res = await fetch(`${BASE}/${this.spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers,
      body: JSON.stringify({ requests }),
    });
    if (!res.ok) throw new Error(`Sheets batchUpdate failed: ${res.status} ${await res.text()}`);
  }

  /** Ensure the spreadsheet has all the tabs we expect. */
  async ensureTabs(titles: string[]): Promise<void> {
    const headers = await this.auth();
    const res = await fetch(`${BASE}/${this.spreadsheetId}?fields=sheets.properties.title`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Sheets metadata failed: ${res.status}`);
    const data = (await res.json()) as { sheets?: Array<{ properties: { title: string } }> };
    const existing = new Set((data.sheets ?? []).map((s) => s.properties.title));
    const toAdd = titles.filter((t) => !existing.has(t));
    if (toAdd.length === 0) return;
    const res2 = await fetch(`${BASE}/${this.spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        requests: toAdd.map((title) => ({ addSheet: { properties: { title } } })),
      }),
    });
    if (!res2.ok) throw new Error(`Sheets batchUpdate failed: ${res2.status} ${await res2.text()}`);
  }
}

/** Convert an AOA block into header-keyed records. */
export function parseAoa(aoa: string[][]): { headers: string[]; rows: Record<string, string>[] } {
  if (!aoa || aoa.length === 0) return { headers: [], rows: [] };
  const [headerRow, ...body] = aoa;
  const headers = headerRow.map((h) => (h ?? "").trim());
  const rows = body
    .filter((r) => r.some((c) => (c ?? "").trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = (r[i] ?? "").toString().trim();
      });
      return obj;
    });
  return { headers, rows };
}
