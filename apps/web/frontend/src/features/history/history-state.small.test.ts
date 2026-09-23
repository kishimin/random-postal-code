import type { PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import { prependHistoryEntry } from "./history-state";

const firstResult: PostalCode = {
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

const secondResult: PostalCode = {
  postalCode: "5300001",
  addresses: [{ prefecture: "大阪府", city: "大阪市北区", town: "梅田" }],
};

describe("prependHistoryEntry", () => {
  // design.md section 6.2: history is stored newest first.
  test("adds the entry to the beginning of an empty history", () => {
    expect(prependHistoryEntry([], firstResult)).toEqual([firstResult]);
  });

  // design.md section 6.2: "retaining duplicates" -- the same postal code
  // generated twice must not collapse into one entry.
  test("keeps a duplicate as a separate entry rather than replacing the existing one", () => {
    expect(prependHistoryEntry([firstResult], firstResult)).toEqual([
      firstResult,
      firstResult,
    ]);
  });

  // design.md section 6.2: "at most 20 entries... adding entry 21 removes the
  // oldest entry." A history already at the limit is exercised directly,
  // rather than built up one call at a time, so this stays a single fast
  // pure-function check independent of how many calls it takes to fill it.
  test("drops only the oldest entry when adding beyond the configured limit", () => {
    const fullHistory: PostalCode[] = Array.from({ length: 20 }, (_, index) => ({
      postalCode: String(9000000 + index).padStart(7, "0"),
      addresses: [{ prefecture: "県", city: "市", town: `${index}` }],
    }));

    const result = prependHistoryEntry(fullHistory, secondResult, 20);

    expect(result).toHaveLength(20);
    expect(result[0]).toEqual(secondResult);
    expect(result).not.toContainEqual(fullHistory[19]);
    expect(result).toContainEqual(fullHistory[18]);
  });
});
