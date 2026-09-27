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

  test("reports drift when the committed artifact is missing an entry that regenerating the source would produce", async () => {
    // Mirrors the acceptance test's drift scenario: an artifact with its
    // first entry dropped, exactly like a hand edit that fell behind source.
    const committedArtifact = JSON.stringify(twoEntryDataset.slice(1));

    const result = await checkPostalDataForDrift({
      source: twoEntrySource,
      committedArtifact,
    });

    expect(result.drifted).toBe(true);
  });

  test("reports no drift when the committed artifact holds the same content with its object keys in a different order", async () => {
    // The committed artifact is hand-formatted; a generator that only
    // compares serialized text would report drift over key order alone,
    // even though the content is identical. Comparison must be by content.
    const reorderedKeys = twoEntryDataset.map((entry) => ({
      addresses: entry.addresses,
      postalCode: entry.postalCode,
    }));

    const result = await checkPostalDataForDrift({
      source: twoEntrySource,
      committedArtifact: JSON.stringify(reorderedKeys),
    });

    expect(result).toEqual({ drifted: false });
  });

  test("reports drift when the committed artifact has an entry that regenerating the source does not produce", async () => {
    const committedArtifact = JSON.stringify([
      ...twoEntryDataset,
      {
        postalCode: "6008216",
        addresses: [
          { prefecture: "Kyoto", city: "Kyoto City", town: "Higashishiokoji" },
        ],
      },
    ]);

    const result = await checkPostalDataForDrift({
      source: twoEntrySource,
      committedArtifact,
    });

    expect(result.drifted).toBe(true);
  });

  test("reports drift when the committed artifact holds the same entries in a different order", async () => {
    // Order is part of the contract (design.md 4.3: "the same input must
    // produce the same content and order"), so reordering the committed
    // entries must count as drift even though the content set is unchanged.
    const reordered = [...twoEntryDataset].reverse();

    const result = await checkPostalDataForDrift({
      source: twoEntrySource,
      committedArtifact: JSON.stringify(reordered),
    });

    expect(result.drifted).toBe(true);
  });
});
