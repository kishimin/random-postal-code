/*
 * Regenerates the Zipnami postal-code dataset from a KEN_ALL.CSV-shaped file
 * that has already been decoded to UTF-8. Fetching the archive from Japan
 * Post and decoding it from Shift-JIS are a separate, later concern (see
 * README.md); this script starts from decoded text.
 *
 * Usage: bun run scripts/build-dataset.ts <input.csv> [output.json]
 * With no output path, the JSON is written to stdout.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { postalCodeSchema } from "@zipnami/shared";
import { buildPostalCodeDataset } from "../src/index.ts";

const [inputPath, outputPath] = process.argv.slice(2);

if (inputPath === undefined) {
  console.error(
    "Usage: bun run scripts/build-dataset.ts <input.csv> [output.json]",
  );
  process.exit(1);
}

const source = readFileSync(inputPath, "utf8");
const dataset = await buildPostalCodeDataset(source);

// KEN_ALL.CSV is Japan Post's real, untrusted-format input, and this
// package's tsconfig has no noUncheckedIndexedAccess: a short or malformed
// line makes buildPostalCodeDataset produce an entry with an undefined
// field at runtime even though TypeScript types it as string. JSON.stringify
// then silently drops that field from the written key entirely, so every
// entry is checked against the shared contract before anything is written.
const invalidEntries = dataset.filter(
  (entry) => !postalCodeSchema.safeParse(entry).success,
);

if (invalidEntries.length > 0) {
  const identifiers = invalidEntries
    .map((entry) => entry.postalCode ?? JSON.stringify(entry))
    .join(", ");

  console.error(
    `Refusing to write a corrupt dataset: ${invalidEntries.length} ` +
      `entr${invalidEntries.length === 1 ? "y" : "ies"} failed the ` +
      `PostalCode contract: ${identifiers}`,
  );
  process.exit(1);
}

const json = JSON.stringify(dataset);

if (outputPath === undefined) {
  console.log(json);
} else {
  writeFileSync(outputPath, json);
}
