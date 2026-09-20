import { readFileSync, readdirSync } from "node:fs";
import { buildPostalCodeDataset } from "@zipnami/postal-data";
import { postalCodeSchema, type PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";

/*
 * Acceptance test for Issue #3: Build and normalize the Japan Post postal-code
 * dataset.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * Why this acceptance test has no browser
 * ---------------------------------------
 * Every acceptance test in this repository so far drives a screen, so the
 * conventions around `acceptance/` assume Playwright. This Issue has no screen:
 * what the Issue delivers is a build step that turns the Japan Post source into
 * a dataset, and the only place that behavior is observable is the dataset it
 * produces. Serving it is Issue #4's work, so waiting for a screen would mean
 * this Issue could not be verified at all. The test therefore runs under Vitest,
 * the runner the rest of the workspace already uses, and stays in `acceptance/`
 * because ADR-0062 makes that directory the location that identifies and
 * protects an acceptance test, independently of how the test is executed.
 *
 * Where the implementation lives
 * ------------------------------
 * The Issue's Proposed solution names `scripts/build-data.ts`, but the
 * acceptance criteria name no path, and design.md — the cross-cutting contract
 * the criteria are written against — places this work in `packages/postal-data`
 * in both its workspace tree and its architecture diagram. The package is what
 * this test reaches for.
 *
 * What this test deliberately does not pin
 * ----------------------------------------
 * - The artifact's file format. design.md section 12 hands that decision to
 *   this Issue's own Red/Green cycles, together with the Worker size and
 *   loading-failure concerns that decide it, so the contract held here is the
 *   dataset value, not its serialization.
 * - Retrieval and Shift-JIS decoding. The real distribution is Shift-JIS and
 *   design.md section 4.3 asks for UTF-8 at build time, but no acceptance
 *   criterion states it, and this repository normalizes every checked-in file
 *   to LF and UTF-8, so a fixture could not carry the original bytes honestly.
 *   The build entry point takes decoded source text; whoever fetches and
 *   decodes the archive is a separate, later concern.
 * - The order of entries in the dataset. No criterion states one. Only its
 *   stability is held, by the re-run criterion below.
 *
 * The Issue's Out of scope section — runtime calls to Japan Post and
 * Android-bundled copies of the dataset — is not exercised here.
 *
 * The criterion "Conversion, grouping, deduplication, ordering, and uniqueness
 * have automated tests" is met by the tests below existing and by the unit
 * tests the inner loop adds; asserting on the test suite itself would test the
 * tests rather than the dataset.
 */

/*
 * A hand-built excerpt shaped like KEN_ALL.CSV, not a slice of the real file:
 * each row exists to make one criterion fail loudly when it is broken.
 *
 *   0600000  three records, one of them repeated verbatim and one of them
 *            separated from the others by unrelated records, differing only in
 *            the reading column. Leading zeroes, grouping that does not depend
 *            on adjacency, and deduplication of identical addresses.
 *   0640941  one record that shares a prefecture and city with 0600000, so
 *            grouping by postal code cannot be confused with grouping by city.
 *   4980000  two prefectures under one postal code, the later one sorting
 *            first by code point.
 *   3670030  two towns under one postal code, the later one sorting first by
 *            code point.
 *   3620000  two cities of one prefecture under one postal code.
 *
 * The addresses appear only in the kanji columns, and every quoted field is
 * quoted the way the real file quotes it, so a parser that reads the reading
 * columns or keeps the quotation marks cannot pass.
 */
const source = readFileSync(
  new URL("./fixtures/japan-post-ken-all-excerpt.csv", import.meta.url),
  "utf8",
);

const postalDataPackage = new URL("../packages/postal-data/", import.meta.url);

/** The build as the data pipeline runs it: decoded source text in, dataset out. */
const buildDataset = async (): Promise<PostalCode[]> =>
  await buildPostalCodeDataset(source);

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

/**
 * Every Markdown file the package publishes about itself, read as one text.
 * The criterion asks that the source and the update procedure be documented,
 * not that a particular file carry them, so the file names stay open.
 */
const documentationOfPostalDataPackage = (): string => {
  const markdown = readdirSync(postalDataPackage).filter((name) =>
    name.endsWith(".md"),
  );

  expect(markdown, "the package documents nothing").not.toEqual([]);

  return markdown
    .map((name) => readFileSync(new URL(name, postalDataPackage), "utf8"))
    .join("\n");
};

describe("Issue #3: the Japan Post postal-code dataset build", () => {
  test("reads an address from the prefecture, city, and town of a Japan Post record", async () => {
    const dataset = await buildDataset();

    expect(entryFor(dataset, "0640941").addresses).toEqual([
      { prefecture: "北海道", city: "札幌市中央区", town: "旭ケ丘" },
    ]);
  });

  test("groups records by the seven-digit postal code and retains leading zeroes", async () => {
    const dataset = await buildDataset();

    // Ten source records, five postal codes. Sorted because the order of the
    // entries is the build's to choose.
    expect(dataset.map((entry) => entry.postalCode).sort()).toEqual([
      "0600000",
      "0640941",
      "3620000",
      "3670030",
      "4980000",
    ]);
  });

  test("retains every distinct prefecture, city, and town tuple under one postal code", async () => {
    const dataset = await buildDataset();

    expect(entryFor(dataset, "3670030").addresses).toEqual(
      expect.arrayContaining([
        { prefecture: "埼玉県", city: "本庄市", town: "朝日町" },
        { prefecture: "埼玉県", city: "本庄市", town: "早稲田の杜" },
      ]),
    );
    expect(entryFor(dataset, "3670030").addresses).toHaveLength(2);
  });

  test("deduplicates only addresses whose prefecture, city, and town are all identical", async () => {
    const dataset = await buildDataset();

    // 0600000 has three source records: two identical ones and a third that
    // differs only in a column the address is not built from. All three are the
    // same address, so one survives.
    expect(entryFor(dataset, "0600000").addresses).toEqual([
      {
        prefecture: "北海道",
        city: "札幌市中央区",
        town: "以下に掲載がない場合",
      },
    ]);
  });

  test("orders addresses by first appearance in the Japan Post source", async () => {
    const dataset = await buildDataset();

    // In both groups the record that appears second sorts first by code point,
    // so sorting the addresses cannot pass this by accident.
    expect(entryFor(dataset, "3670030").addresses).toEqual([
      { prefecture: "埼玉県", city: "本庄市", town: "朝日町" },
      { prefecture: "埼玉県", city: "本庄市", town: "早稲田の杜" },
    ]);
    expect(entryFor(dataset, "4980000").addresses).toEqual([
      {
        prefecture: "愛知県",
        city: "弥富市",
        town: "以下に掲載がない場合",
      },
      {
        prefecture: "三重県",
        city: "桑名郡木曽岬町",
        town: "以下に掲載がない場合",
      },
    ]);
  });

  test("retains addresses that differ by prefecture or by city instead of replacing them with a representative value", async () => {
    const dataset = await buildDataset();

    expect(
      entryFor(dataset, "4980000").addresses.map(
        (address) => address.prefecture,
      ),
    ).toEqual(["愛知県", "三重県"]);
    expect(
      entryFor(dataset, "3620000").addresses.map((address) => address.city),
    ).toEqual(["上尾市", "北足立郡伊奈町"]);
  });

  test("contains exactly one entry per unique postal code, including one whose records are not adjacent", async () => {
    const dataset = await buildDataset();
    const postalCodes = dataset.map((entry) => entry.postalCode);

    expect(postalCodes).toHaveLength(new Set(postalCodes).size);
    expect(
      postalCodes.filter((postalCode) => postalCode === "0600000"),
    ).toHaveLength(1);
  });

  test("produces identical output when it runs again against identical input", async () => {
    const first = await buildDataset();
    const second = await buildDataset();

    // Deep equality would accept a different entry order, address order, or key
    // order between the two runs. The artifact is written from this value, so
    // the criterion is about the bytes, not about equivalence.
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  test("produces entries the shared PostalCode contract accepts", async () => {
    const dataset = await buildDataset();

    // What the API serves is this value. An entry the contract rejects would
    // reach the client as a data failure rather than as an address.
    expect(
      dataset.filter((entry) => !postalCodeSchema.safeParse(entry).success),
    ).toEqual([]);
  });

  test("documents the Japan Post source, when it was retrieved, and the command that regenerates the data", () => {
    const documentation = documentationOfPostalDataPackage();
    const manifest = JSON.parse(
      readFileSync(new URL("package.json", postalDataPackage), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(documentation).toMatch(/japanpost\.jp/);
    // design.md section 4.3 asks for the retrieval date as well: without it,
    // nobody can tell how old the generated data is.
    expect(documentation).toMatch(/\d{4}-\d{2}-\d{2}/);

    // A command documented but absent is worse than none: the reader has no
    // reason to doubt it. The filter form counts as the same command.
    const documented = [
      ...documentation.matchAll(/bun run (?:--filter\s+\S+\s+)?([^\s`]+)/g),
    ].map(([, name]) => name);

    expect(
      documented.length,
      "no command regenerates the data",
    ).toBeGreaterThan(0);
    expect(
      documented.filter(
        (name) => !Object.keys(manifest.scripts ?? {}).includes(name),
      ),
    ).toEqual([]);
  });
});
