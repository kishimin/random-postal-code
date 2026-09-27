import { describe, expect, test } from "vitest";
import { checkPostalDataForDrift } from "./check-dataset.ts";

/**
 * Builds one KEN_ALL.CSV-shaped line. Mirrors the helper in
 * build-postal-code-dataset.small.test.ts; reading columns default to a
 * marker distinct from any kanji value used in a test.
 */
const kenAllLine = ({
  postalCode,
  prefecture,
  city,
  town,
}: {
  postalCode: string;
  prefecture: string;
  city: string;
  town: string;
}): string =>
  [
    "00000",
    `"${postalCode.slice(0, 3)}  "`,
    `"${postalCode}"`,
    '"READING_COLUMN_NOT_USED"',
    '"READING_COLUMN_NOT_USED"',
    '"READING_COLUMN_NOT_USED"',
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

const twoEntrySource = [
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

const twoEntryDataset = [
  {
    postalCode: "1000001",
    addresses: [{ prefecture: "Tokyo", city: "Chiyoda City", town: "Chiyoda" }],
  },
  {
    postalCode: "5300001",
    addresses: [{ prefecture: "Osaka", city: "Osaka City", town: "Umeda" }],
  },
];

describe("checkPostalDataForDrift", () => {
  test("reports no drift when regenerating the source produces a dataset deeply equal to the committed artifact", async () => {
    const result = await checkPostalDataForDrift({
      source: twoEntrySource,
      committedArtifact: JSON.stringify(twoEntryDataset),
    });

    expect(result).toEqual({ drifted: false });
  });
});
