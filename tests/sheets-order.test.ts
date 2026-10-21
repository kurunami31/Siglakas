import { describe, expect, it, vi } from "vitest";

/**
 * Ordering guarantees on the sheets path.
 *
 * These exist because the announcements list was returned in sheet order —
 * oldest first — while every consumer assumes index 0 is the latest. The demo
 * repository unshifted, so demo mode looked right and the bug only existed
 * against the real spreadsheet, which is precisely the shape of bug that unit
 * tests on the demo data cannot catch. So this stubs the Sheets client instead.
 */

const hoisted = vi.hoisted(() => ({
  SHEET: {
    Announcements: [
      ["timestamp", "message", "posted_by"],
      ["2026-10-20T08:13:18.609Z", "oldest bulletin", "superadmin"],
      ["2026-10-27T09:00:00.000Z", "newest bulletin", "superadmin"],
    ],
  } as Record<string, string[][]>,
}));

vi.mock("@/lib/data/google", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/google")>();
  return {
    ...actual,
    // Stub only the network client — parseAoa and the rest stay real.
    SheetsClient: class {
      async batchGet(ranges: string[]) {
        const out: Record<string, string[][]> = {};
        for (const range of ranges) {
          const tab = range.split("!")[0];
          if (hoisted.SHEET[tab]) out[tab] = hoisted.SHEET[tab];
        }
        return out;
      }
      async append() {
        /* writes are not exercised here */
      }
      async update() {
        /* writes are not exercised here */
      }
    },
  };
});

// Imported after the mock is registered.
import { SheetsRepository } from "@/lib/data/sheets-repo";
import { DEFAULT_CONFIG } from "@/lib/data/seed";

const repo = () =>
  new SheetsRepository("test-sheet", { client_email: "t", private_key: "k" }, DEFAULT_CONFIG);

describe("sheets repository ordering", () => {
  it("returns announcements newest first", async () => {
    const raw = await repo().read();
    expect(raw.announcements.map((a) => a.message)).toEqual(["newest bulletin", "oldest bulletin"]);
  });

  it("keeps index 0 as the latest, which is what the ticker and toast rely on", async () => {
    const raw = await repo().read();
    const [latest] = raw.announcements;
    expect(latest.message).toBe("newest bulletin");
    expect(latest.timestamp).toBe("2026-10-27T09:00:00.000Z");
  });
});
