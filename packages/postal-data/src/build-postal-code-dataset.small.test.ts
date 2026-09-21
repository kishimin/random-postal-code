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
});
