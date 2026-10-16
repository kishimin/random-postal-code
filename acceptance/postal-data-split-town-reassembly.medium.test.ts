import { readFileSync } from "node:fs";
import { buildPostalCodeDataset } from "@zipnami/postal-data";
import type { PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import { normalizedPostalCodes } from "./fixtures/postal-code-dataset.ts";

/*
 * Acceptance test for Issue #33: Reassemble KEN_ALL.CSV town names split
 * across consecutive records.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * Like the Issue #3 acceptance test, this one has no browser: the behavior is
 * only observable in the dataset the build produces, so it runs under the
 * postal-data package's Vitest and stays in `acceptance/` (ADR-0062).
 *
 * What this test deliberately does not pin
 * ----------------------------------------
 * - What happens to an unmatched `（` that is never closed, or whose next
 *   record has a different postal code, prefecture, or city. No criterion
 *   states it, and the Issue's own convention only describes the case where
 *   the continuation exists.
 * - The reading (kana) columns. The address is built from the kanji columns
 *   only (Issue #3), so how the kana columns are split is irrelevant here; the
 *   fixture splits them the way the real file does so that a parser reading
 *   them would produce a visibly wrong town.
 * - Any reassembly signal other than parenthesis balance (Out of scope).
 */

/*
 * A hand-built excerpt shaped like KEN_ALL.CSV, not a slice of the real file:
 *
 *   0285102  one town name split across two records; the first carries an
 *            unmatched `（`, the second closes it.
 *   6008216  one town name split across three records; the middle record has
 *            neither `（` nor `）`, so a reassembly that stops at the first
 *            record without an open parenthesis stops one record too early.
 *   0600042  three adjacent records sharing one postal code, prefecture, and
 *            city whose town fields are each already balanced (two of them
 *            contain a full `（…）` pair). None of them may be merged.
 */
const splitTownSource = readFileSync(
  new URL(
    "./fixtures/japan-post-ken-all-split-town-excerpt.csv",
    import.meta.url,
  ),
  "utf8",
);

/* The Issue #3 excerpt, which contains no split record. */
const unsplitSource = readFileSync(
  new URL("./fixtures/japan-post-ken-all-excerpt.csv", import.meta.url),
  "utf8",
);

const postalDataPackage = new URL("../packages/postal-data/", import.meta.url);

const entryFor = (dataset: PostalCode[], postalCode: string): PostalCode => {
  const entry = dataset.find(
    (candidate) => candidate.postalCode === postalCode,
  );

  if (entry === undefined) {
    const found = dataset.map((candidate) => candidate.postalCode).join(", ");

    throw new Error(`no entry for ${postalCode}; the dataset has ${found}`);
  }

  return entry;
};

const byPostalCode = (dataset: readonly PostalCode[]): PostalCode[] =>
  [...dataset].sort((left, right) =>
    left.postalCode < right.postalCode ? -1 : 1,
  );

describe("Issue #33: reassembling town names split across KEN_ALL.CSV records", () => {
  test("reassembles a town name split across two consecutive records into one address", async () => {
    const dataset = await buildPostalCodeDataset(splitTownSource);

    expect(entryFor(dataset, "0285102").addresses).toEqual([
      {
        prefecture: "岩手県",
        city: "岩手郡葛巻町",
        town: "葛巻（第４０地割「５７番地１２５、１７６を除く」～第４５地割）",
      },
    ]);
  });

  test("reassembles a town name split across three or more consecutive records", async () => {
    const dataset = await buildPostalCodeDataset(splitTownSource);

    expect(entryFor(dataset, "6008216").addresses).toEqual([
      {
        prefecture: "京都府",
        city: "京都市下京区",
        town: "東塩小路町（烏丸通塩小路下る、烏丸通七条上る、塩小路通烏丸西入、七条通烏丸西入、七条通烏丸東入）",
      },
    ]);
  });

  test("never merges a record whose town parentheses are already balanced with an adjacent record", async () => {
    const dataset = await buildPostalCodeDataset(splitTownSource);

    expect(entryFor(dataset, "0600042").addresses).toEqual([
      {
        prefecture: "北海道",
        city: "札幌市中央区",
        town: "大通西（１～１９丁目）",
      },
      {
        prefecture: "北海道",
        city: "札幌市中央区",
        town: "大通西（２０丁目）",
      },
      {
        prefecture: "北海道",
        city: "札幌市中央区",
        town: "以下に掲載がない場合",
      },
    ]);
  });

  test("leaves one entry per postal code and no fragment addresses behind", async () => {
    const dataset = await buildPostalCodeDataset(splitTownSource);

    expect(dataset.map((entry) => entry.postalCode).sort()).toEqual([
      "0285102",
      "0600042",
      "6008216",
    ]);
    expect(
      dataset
        .flatMap((entry) => entry.addresses)
        .filter(({ town }) => /^[^（]*）|（[^）]*$/.test(town)),
    ).toEqual([]);
  });

  test("leaves grouping, deduplication, and ordering of non-split input unchanged", async () => {
    const dataset = await buildPostalCodeDataset(unsplitSource);

    // The normalized value the Issue #4 acceptance test already holds as the
    // output of this excerpt. Sorted by postal code because entry order is the
    // build's to choose; address order within each entry is compared as is.
    expect(byPostalCode(dataset)).toEqual(byPostalCode(normalizedPostalCodes));
  });

  test("documents the reassembly in the postal-data README", () => {
    const readme = readFileSync(
      new URL("README.md", postalDataPackage),
      "utf8",
    );

    // Each Markdown section, as its heading plus the text up to the next
    // heading. The reassembly has to be explained in one place, so the
    // mention and the signal it relies on must share a section (Issue #52):
    // "reassembl" in one section and a full-width parenthesis in an unrelated
    // example elsewhere would not document anything.
    const sections = readme
      .split(/^(?=#{1,6} )/m)
      .map((section) => section.trim())
      .filter((section) => section !== "");
    const documenting = sections.filter((section) => {
      const [heading = "", ...body] = section.split("\n");

      return /reassembl/i.test(heading) && /（/.test(body.join("\n"));
    });

    expect(documenting).not.toEqual([]);
  });
});
