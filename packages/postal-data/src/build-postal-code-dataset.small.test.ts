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

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  test("rejects instead of throwing synchronously when an internal step fails", async () => {
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
    expect(promise).toBeDefined();
    await expect(promise).rejects.toBeInstanceOf(Error);
  });
});
