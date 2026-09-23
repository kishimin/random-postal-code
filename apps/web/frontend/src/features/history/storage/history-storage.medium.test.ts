import type { PostalCode } from "@zipnami/shared";
import { beforeEach, describe, expect, test } from "vitest";
import {
  HISTORY_STORAGE_KEY,
  readHistoryEntries,
  writeHistoryEntries,
} from "./history-storage";

const firstResult: PostalCode = {
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

const secondResult: PostalCode = {
  postalCode: "5300001",
  addresses: [{ prefecture: "大阪府", city: "大阪市北区", town: "梅田" }],
};

// The real browser's own localStorage (vite.config.ts runs this project's
// tests in Chromium), so this is the browser-persistence boundary
// ui-design.md section 11 assigns to Medium tests -- unlike
// parse-stored-history.small.test.ts, which never touches storage itself.
describe("history storage", () => {
  beforeEach(() => localStorage.clear());

  test("returns no entries when nothing has been stored yet", () => {
    expect(readHistoryEntries()).toEqual([]);
  });

  // design.md section 6.2's persistence requirement, exercised at the
  // storage boundary directly rather than through a rendered component.
  test("returns what was written in a write/read round trip", () => {
    writeHistoryEntries([secondResult, firstResult]);

    expect(readHistoryEntries()).toEqual([secondResult, firstResult]);
  });

  // ui-design.md section 5.4: corrupt persisted data must not block a new
  // generation. Seeded directly at the storage key, which is exactly what
  // the acceptance test's own header comment says a browser cannot observe
  // and defers to this Issue's Small/Medium tests instead.
  test("discards corrupt stored data and still allows a later write to succeed", () => {
    localStorage.setItem(HISTORY_STORAGE_KEY, "{not json");

    expect(readHistoryEntries()).toEqual([]);

    writeHistoryEntries([firstResult]);

    expect(readHistoryEntries()).toEqual([firstResult]);
  });

  test("discards well-formed but unsupported stored data and still allows a later write to succeed", () => {
    localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify({ version: 999, entries: [firstResult] }),
    );

    expect(readHistoryEntries()).toEqual([]);

    writeHistoryEntries([secondResult]);

    expect(readHistoryEntries()).toEqual([secondResult]);
  });
});
