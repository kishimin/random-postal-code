/*
 * Checks whether the committed postal-code dataset artifact matches what
 * regenerating it from a KEN_ALL.CSV-shaped source (already decoded to
 * UTF-8) would produce, without writing anything back: this is a check, not
 * a regeneration. Exits 0 when they match and non-zero when they do not.
 *
 * Usage: bun run scripts/check-dataset.ts <source.csv> <artifact.json>
 */
import { readFileSync } from "node:fs";
import { checkPostalDataForDrift } from "../src/check-dataset.ts";

const [sourcePath, artifactPath] = process.argv.slice(2);

if (sourcePath === undefined || artifactPath === undefined) {
  console.error(
    "Usage: bun run scripts/check-dataset.ts <source.csv> <artifact.json>",
  );
  process.exit(1);
}

const source = readFileSync(sourcePath, "utf8");
const committedArtifact = readFileSync(artifactPath, "utf8");

const result = await checkPostalDataForDrift({ source, committedArtifact });

if (result.drifted) {
  console.error(`Postal data drift detected: ${result.reason}`);
  process.exit(1);
}

console.log("Postal data matches its committed source; no drift detected.");
