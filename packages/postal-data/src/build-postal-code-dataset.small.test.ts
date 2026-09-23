import { describe, expect, test } from "vitest";
import { buildPostalCodeDataset } from "./index.ts";

/**
 * Builds one KEN_ALL.CSV-shaped line. The reading columns default to a
 * marker distinct from any kanji value used in a test, so a test that reads
 * the wrong column fails loudly instead of coincidentally passing.
 */
const kenAllLine = ({
  postalCode,
  prefecture,
  city,
  town,
  prefectureKana = "READING_COLUMN_NOT_USED",
  cityKana = "READING_COLUMN_NOT_USED",
  townKana = "READING_COLUMN_NOT_USED",
}: {
  postalCode: string;
  prefecture: string;
  city: string;
  town: string;
  prefectureKana?: string;
  cityKana?: string;
  townKana?: string;
}): string =>
  [
    "00000",
    `"${postalCode.slice(0, 3)}  "`,
    `"${postalCode}"`,
    `"${prefectureKana}"`,
    `"${cityKana}"`,
    `"${townKana}"`,
    prefecture,
    city,
    town,
    "0",
    "0",
    "0",
    "0",
    "0",
    "0",
  ].join(",");

describe("buildPostalCodeDataset", () => {
  test("reads the address from the prefecture, city, and town columns of a record, not the reading columns", async () => {
    const source = kenAllLine({
      postalCode: "1000001",
      prefecture: "Tokyo",
      city: "Chiyoda City",
      town: "Chiyoda",
    });

    const dataset = await buildPostalCodeDataset(source);

    expect(dataset).toEqual([
      {
        postalCode: "1000001",
        addresses: [
          { prefecture: "Tokyo", city: "Chiyoda City", town: "Chiyoda" },
        ],
      },
    ]);
  });

  test("groups two records that share a seven-digit postal code into one entry holding both addresses", async () => {
    const source = [
      kenAllLine({
        postalCode: "1000001",
        prefecture: "Tokyo",
        city: "Chiyoda City",
        town: "Chiyoda",
      }),
      kenAllLine({
        postalCode: "1000001",
        prefecture: "Tokyo",
        city: "Chiyoda City",
        town: "Marunouchi",
      }),
    ].join("\n");

    const dataset = await buildPostalCodeDataset(source);

    expect(dataset).toEqual([
      {
        postalCode: "1000001",
        addresses: [
          { prefecture: "Tokyo", city: "Chiyoda City", town: "Chiyoda" },
          { prefecture: "Tokyo", city: "Chiyoda City", town: "Marunouchi" },
        ],
      },
    ]);
  });

  test("keeps the postal code as a string, so a leading zero is not lost", async () => {
    const source = kenAllLine({
      postalCode: "0600000",
      prefecture: "Hokkaido",
      city: "Sapporo",
      town: "Chuo Ward",
    });

    const dataset = await buildPostalCodeDataset(source);

    expect(dataset[0]?.postalCode).toBe("0600000");
    expect(typeof dataset[0]?.postalCode).toBe("string");
  });

  test.each([
    [
      "prefecture",
      { prefecture: "Tokyo", city: "Same City", town: "Same Town" },
      { prefecture: "Osaka", city: "Same City", town: "Same Town" },
    ],
    [
      "city",
      { prefecture: "Same Pref", city: "Chiyoda City", town: "Same Town" },
      { prefecture: "Same Pref", city: "Osaka City", town: "Same Town" },
    ],
    [
      "town",
      { prefecture: "Same Pref", city: "Same City", town: "Chiyoda" },
      { prefecture: "Same Pref", city: "Same City", town: "Marunouchi" },
    ],
  ] as const)(
    "retains both addresses under one postal code when they differ only by %s",
    async (_field, first, second) => {
      const source = [
        kenAllLine({ postalCode: "1000001", ...first }),
        kenAllLine({ postalCode: "1000001", ...second }),
      ].join("\n");

      const dataset = await buildPostalCodeDataset(source);

      expect(dataset[0]?.addresses).toEqual([first, second]);
    },
  );

  test("collapses two records under one postal code into a single address when their prefecture, city, and town are all identical", async () => {
    const record = {
      prefecture: "Tokyo",
      city: "Chiyoda City",
      town: "Chiyoda",
    };
    const source = [
      kenAllLine({ postalCode: "1000001", ...record }),
      // Reading columns differ, but Address is never built from them, so
      // this must still count as the same address as the record above.
      kenAllLine({
        postalCode: "1000001",
        ...record,
        prefectureKana: "A_DIFFERENT_READING",
      }),
    ].join("\n");

    const dataset = await buildPostalCodeDataset(source);

    expect(dataset[0]?.addresses).toEqual([record]);
  });

  test("orders addresses within a postal code by first appearance in the source rather than sorting them", async () => {
    // "Zenith" sorts after "Anchor" by code point, so a sort step would
    // reorder them; only preserving source order keeps this order.
    const source = [
      kenAllLine({
        postalCode: "1000001",
        prefecture: "Tokyo",
        city: "Chiyoda City",
        town: "Zenith",
      }),
      kenAllLine({
        postalCode: "1000001",
        prefecture: "Tokyo",
        city: "Chiyoda City",
        town: "Anchor",
      }),
    ].join("\n");

    const dataset = await buildPostalCodeDataset(source);

    expect(dataset[0]?.addresses.map((address) => address.town)).toEqual([
      "Zenith",
      "Anchor",
    ]);
  });

  test("keeps postal codes separate even when their records are not adjacent in the source", async () => {
    const source = [
      kenAllLine({
        postalCode: "1000001",
        prefecture: "Tokyo",
        city: "Chiyoda City",
        town: "Chiyoda",
      }),
      kenAllLine({
        postalCode: "5300001",
        prefecture: "Osaka",
        city: "Osaka City",
        town: "Umeda",
      }),
      kenAllLine({
        postalCode: "1000001",
        prefecture: "Tokyo",
        city: "Chiyoda City",
        town: "Marunouchi",
      }),
    ].join("\n");

    const dataset = await buildPostalCodeDataset(source);

    expect(dataset.map((entry) => entry.postalCode).sort()).toEqual([
      "1000001",
      "5300001",
    ]);
    expect(
      dataset.find((entry) => entry.postalCode === "1000001")?.addresses,
    ).toHaveLength(2);
    // A grouping bug that leaked the interleaved record's address into the
    // wrong group would still pass the two assertions above; pin 5300001's
    // full address list too so it cannot pass by accident.
    expect(
      dataset.find((entry) => entry.postalCode === "5300001")?.addresses,
    ).toEqual([{ prefecture: "Osaka", city: "Osaka City", town: "Umeda" }]);
  });

  test("returns exactly one entry per unique postal code across the whole dataset", async () => {
    const source = [
      kenAllLine({
        postalCode: "1000001",
        prefecture: "Tokyo",
        city: "Chiyoda City",
        town: "Chiyoda",
      }),
      kenAllLine({
        postalCode: "1000001",
        prefecture: "Tokyo",
        city: "Chiyoda City",
        town: "Marunouchi",
      }),
      kenAllLine({
        postalCode: "5300001",
        prefecture: "Osaka",
        city: "Osaka City",
        town: "Umeda",
      }),
    ].join("\n");

    const dataset = await buildPostalCodeDataset(source);
    const postalCodes = dataset.map((entry) => entry.postalCode);

    // An implementation that drops every record produces [], and
    // [].length === new Set([]).size (0 === 0) is vacuously true. Pin the
    // actual expected postal codes so an empty (or otherwise wrong) result
    // cannot pass by accident; keep the Set comparison as a secondary,
    // documentation-only check of the "unique" part of the claim.
    expect(postalCodes).toEqual(["1000001", "5300001"]);
    expect(postalCodes).toHaveLength(new Set(postalCodes).size);
  });

  test("returns byte-identical JSON when run twice against the same input", async () => {
    const source = [
      kenAllLine({
        postalCode: "1000001",
        prefecture: "Tokyo",
        city: "Chiyoda City",
        town: "Chiyoda",
      }),
      kenAllLine({
        postalCode: "5300001",
        prefecture: "Osaka",
        city: "Osaka City",
        town: "Umeda",
      }),
    ].join("\n");

    const first = await buildPostalCodeDataset(source);
    const second = await buildPostalCodeDataset(source);

    // JSON.stringify(second) === JSON.stringify(first) is vacuously true
    // for [] === [] too, so it alone cannot tell "deterministic" apart from
    // "always empty". Pin the real serialized content once, in addition to
    // the run-to-run comparison.
    expect(JSON.stringify(first)).toBe(
      '[{"postalCode":"1000001","addresses":[{"prefecture":"Tokyo","city":"Chiyoda City","town":"Chiyoda"}]},{"postalCode":"5300001","addresses":[{"prefecture":"Osaka","city":"Osaka City","town":"Umeda"}]}]',
    );
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  test("rejects instead of throwing synchronously when the source is not a string", async () => {
    // A caller that bypasses the type system (plain JS, or an `any`-typed
    // value) can still pass a non-string source. buildPostalCodeDataset's
    // contract is a Promise, so an idiomatic `buildPostalCodeDataset(source)
    // .catch(handleError)` must have handleError invoked for any internal
    // failure; a synchronous throw from the call itself would escape that
    // .catch() entirely. The call is captured once, inside a try/catch that
    // returns rather than reassigns, so the same promise is both proven not
    // to have thrown synchronously and observed to reject.
    const invalidSource = null as unknown as string;
    const capture = (): { error?: unknown; promise?: Promise<unknown> } => {
      try {
        return { promise: buildPostalCodeDataset(invalidSource) };
      } catch (error) {
        return { error };
      }
    };
    const { error, promise } = capture();

    expect(error).toBeUndefined();
    await expect(promise).rejects.toBeInstanceOf(Error);
  });

  test("returns an empty dataset for an empty source string", async () => {
    const dataset = await buildPostalCodeDataset("");

    expect(dataset).toEqual([]);
  });

  test("treats a comma inside a quoted field as part of the field, not a field separator", async () => {
    // This is the entire reason splitCsvLine tracks inQuotes: every other
    // test's input has no embedded comma. A parser that closed a field on
    // every comma regardless of quoting would split this reading column in
    // two, shifting every column after it by one - which would make the
    // address below read from the wrong columns entirely (prefecture would
    // come out as "READING_COLUMN_NOT_USED", not "Tokyo").
    const source = kenAllLine({
      postalCode: "1000001",
      prefecture: "Tokyo",
      city: "Chiyoda City",
      town: "Chiyoda",
      prefectureKana: "A,B",
    });

    const dataset = await buildPostalCodeDataset(source);

    expect(dataset).toEqual([
      {
        postalCode: "1000001",
        addresses: [
          { prefecture: "Tokyo", city: "Chiyoda City", town: "Chiyoda" },
        ],
      },
    ]);
  });

  test("parses records the same way whether lines are separated by CRLF or LF", async () => {
    // Real KEN_ALL.CSV ships CRLF; every other test in this file uses LF
    // only.
    const source = [
      kenAllLine({
        postalCode: "1000001",
        prefecture: "Tokyo",
        city: "Chiyoda City",
        town: "Chiyoda",
      }),
      kenAllLine({
        postalCode: "1000001",
        prefecture: "Tokyo",
        city: "Chiyoda City",
        town: "Marunouchi",
      }),
    ].join("\r\n");

    const dataset = await buildPostalCodeDataset(source);

    expect(dataset).toEqual([
      {
        postalCode: "1000001",
        addresses: [
          { prefecture: "Tokyo", city: "Chiyoda City", town: "Chiyoda" },
          { prefecture: "Tokyo", city: "Chiyoda City", town: "Marunouchi" },
        ],
      },
    ]);
  });
});
