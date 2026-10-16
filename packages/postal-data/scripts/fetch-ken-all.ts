/*
 * Downloads Japan Post's ken_all.zip, extracts KEN_ALL.CSV, decodes it from
 * Shift-JIS, and writes it as UTF-8: the input `regenerate`
 * (scripts/build-dataset.ts) reads. See README.md for the full procedure.
 *
 * Usage: bun run scripts/fetch-ken-all.ts <output.csv>
 *
 * ZIPNAMI_KEN_ALL_URL overrides the download URL. It exists so the
 * acceptance test can serve the archive locally instead of reaching Japan
 * Post; a maintainer never needs to set it.
 */
import { renameSync, rmSync, writeFileSync } from "node:fs";
import { KEN_ALL_ZIP_URL, retrieveKenAllCsv } from "../src/ken-all-archive.ts";

const [outputPath] = process.argv.slice(2);

if (outputPath === undefined) {
  console.error("Usage: bun run scripts/fetch-ken-all.ts <output.csv>");
  process.exit(1);
}

const url = process.env.ZIPNAMI_KEN_ALL_URL ?? KEN_ALL_ZIP_URL;

const text = await retrieveKenAllCsv(url).catch((error: unknown) => {
  console.error(
    `Refusing to write ${outputPath}: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});

// Written beside the target and then renamed over it, so an interrupted
// write never leaves a half-written file where a previous, complete
// retrieval used to be.
const temporaryPath = `${outputPath}.partial`;

try {
  writeFileSync(temporaryPath, text);
  renameSync(temporaryPath, outputPath);
} catch (error) {
  rmSync(temporaryPath, { force: true });
  throw error;
}

console.error(`Wrote ${outputPath} from ${url}`);
