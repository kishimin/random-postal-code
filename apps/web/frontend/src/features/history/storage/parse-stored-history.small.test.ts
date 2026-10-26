import type { PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import { HISTORY_LIMIT } from "../history-state";
import { parseStoredHistory } from "./parse-stored-history";

const storedResult: PostalCode = {
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

describe("parseStoredHistory", () => {
  test("returns no entries when nothing has been stored yet", () => {
    expect(parseStoredHistory(null)).toEqual([]);
  });

  test("returns the persisted entries for a well-formed, current-version value", () => {
    const raw = JSON.stringify({ version: 1, entries: [storedResult] });

    expect(parseStoredHistory(raw)).toEqual([storedResult]);
  });

  // ui-design.md section 5.4: "Corrupt or unsupported persisted data is
  // discarded ... without blocking generation." A visitor cannot produce this
  // through the UI, so this Small test seeds it directly rather than relying
  // on the acceptance test, which cannot (see that test file's own comment).
  test("discards a value that is not valid JSON", () => {
    expect(parseStoredHistory("{not json")).toEqual([]);
  });

  test("discards well-formed JSON of an unsupported version", () => {
    const raw = JSON.stringify({ version: 999, entries: [storedResult] });

    expect(parseStoredHistory(raw)).toEqual([]);
  });

  test("discards well-formed JSON whose entries do not match the postal code shape", () => {
    const raw = JSON.stringify({
      version: 1,
      entries: [{ postalCode: "not-seven-digits", addresses: [] }],
    });

    expect(parseStoredHistory(raw)).toEqual([]);
  });

  // design.md section 6.2's limit applies to what a visitor sees, so a value
  // holding more than the limit (an older build's, or one edited by hand) is
  // trimmed on read instead of rendering in full until the next generation.
  test("returns at most the history limit, keeping the newest entries", () => {
    const entries = Array.from({ length: HISTORY_LIMIT + 1 }, (_, index) => ({
      ...storedResult,
      postalCode: String(1000000 + index),
    }));
    const raw = JSON.stringify({ version: 1, entries });

    expect(parseStoredHistory(raw)).toEqual(entries.slice(0, HISTORY_LIMIT));
  });
});
