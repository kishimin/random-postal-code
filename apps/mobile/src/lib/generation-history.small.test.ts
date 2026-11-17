import type { PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import {
  HISTORY_LIMIT,
  mergeLoadedHistory,
  parseStoredHistory,
  prependToHistory,
} from "./generation-history";

const resultOf = (index: number): PostalCode => ({
  postalCode: `90000${String(index).padStart(2, "0")}`,
  addresses: [{ prefecture: "沖縄県", city: "那覇市", town: `町${index}` }],
});

const numbered = (count: number): PostalCode[] =>
  Array.from({ length: count }, (_, index) => resultOf(index + 1));

describe("prependToHistory", () => {
  test("puts the new result first", () => {
    expect(prependToHistory([resultOf(1)], resultOf(2))).toEqual([
      resultOf(2),
      resultOf(1),
    ]);
  });

  test("keeps a repeated postal code as a separate entry", () => {
    expect(prependToHistory([resultOf(1)], resultOf(1))).toEqual([
      resultOf(1),
      resultOf(1),
    ]);
  });

  test("drops the oldest entry past the limit", () => {
    const full = numbered(HISTORY_LIMIT);

    const next = prependToHistory(full, resultOf(99));

    expect(next).toHaveLength(HISTORY_LIMIT);
    expect(next[0]).toEqual(resultOf(99));
    expect(next).not.toContainEqual(full[HISTORY_LIMIT - 1]);
  });

  test("does not change the history it is given", () => {
    const before = [resultOf(1)];

    prependToHistory(before, resultOf(2));

    expect(before).toEqual([resultOf(1)]);
  });
});

describe("mergeLoadedHistory", () => {
  test("places results made while loading before the stored ones", () => {
    expect(mergeLoadedHistory([resultOf(3)], [resultOf(2), resultOf(1)])).toEqual(
      [resultOf(3), resultOf(2), resultOf(1)],
    );
  });

  test("keeps at most the limit", () => {
    expect(
      mergeLoadedHistory([resultOf(99)], numbered(HISTORY_LIMIT)),
    ).toHaveLength(HISTORY_LIMIT);
  });
});

describe("parseStoredHistory", () => {
  test("restores what was stored, in order", () => {
    const stored = JSON.stringify([resultOf(2), resultOf(1)]);

    expect(parseStoredHistory(stored)).toEqual([resultOf(2), resultOf(1)]);
  });

  test("is empty when nothing is stored", () => {
    expect(parseStoredHistory(null)).toEqual([]);
  });

  test("discards text that is not JSON", () => {
    expect(parseStoredHistory("{not json")).toEqual([]);
  });

  test("discards JSON that is not a list", () => {
    expect(parseStoredHistory(JSON.stringify({ postalCode: "1000001" }))).toEqual(
      [],
    );
  });

  test("discards a list holding an entry the shared contract rejects", () => {
    const stored = JSON.stringify([
      resultOf(1),
      { postalCode: "12", addresses: [] },
    ]);

    expect(parseStoredHistory(stored)).toEqual([]);
  });

  test("keeps only the newest entries of an over-long list", () => {
    const stored = JSON.stringify(numbered(HISTORY_LIMIT + 5));

    expect(parseStoredHistory(stored)).toEqual(numbered(HISTORY_LIMIT));
  });
});
