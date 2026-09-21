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
import { buildPostalCodeDataset } from "../src/index.ts";

const [inputPath, outputPath] = process.argv.slice(2);

if (inputPath === undefined) {
  console.error("Usage: bun run scripts/build-dataset.ts <input.csv> [output.json]");
  process.exit(1);
}

const source = readFileSync(inputPath, "utf8");
const dataset = await buildPostalCodeDataset(source);
const json = JSON.stringify(dataset);

if (outputPath === undefined) {
  console.log(json);
} else {
  writeFileSync(outputPath, json);
}
