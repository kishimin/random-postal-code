import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./build-dataset.ts", import.meta.url),
);

// KEN_ALL.CSV is real, untrusted-format input, and this package's tsconfig
// has no noUncheckedIndexedAccess: a line shorter than the columns
// parseRecord indexes into produces an entry with undefined fields at
// runtime even though TypeScript types them as string. This line has no
// comma at all, so every column parseRecord reads is undefined. The locked
// acceptance fixture cannot stand in for this because every one of its
// rows is well-formed by design.
const malformedSource = '"0000000"\n';

describe("build-dataset CLI", () => {
  test("exits non-zero and writes no output file when a record fails the shared PostalCode contract", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "postal-data-guard-"));
    const inputPath = path.join(dir, "input.csv");
    const outputPath = path.join(dir, "output.json");
    writeFileSync(inputPath, malformedSource);

    try {
      const result = spawnSync(
        "bun",
        ["run", scriptPath, inputPath, outputPath],
        { encoding: "utf8" },
      );

      expect(result.status).not.toBe(0);
      expect(existsSync(outputPath)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
