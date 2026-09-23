import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./build-dataset.ts", import.meta.url),
);

// spawnSync blocks the test runner synchronously, so Vitest's own
// testTimeout cannot interrupt a hung child process; bound the subprocess
// itself instead.
const SPAWN_TIMEOUT_MS = 10_000;

// KEN_ALL.CSV is real, untrusted-format input, and this package's tsconfig
// has no noUncheckedIndexedAccess: a line shorter than the columns
// parseRecord indexes into produces an entry with undefined fields at
// runtime even though TypeScript types them as string. This line has no
// comma at all, so every column parseRecord reads is undefined. The locked
// acceptance fixture cannot stand in for this because every one of its
// rows is well-formed by design.
const malformedSource = '"0000000"\n';

// A minimal, well-formed KEN_ALL.CSV-shaped line: a valid seven-digit
// postal code and a non-empty prefecture/city/town, built inline rather
// than importing the locked acceptance fixture.
const wellFormedSource =
  '00000,"100  ","1000001","TOKYO","CHIYODA","CHIYODA",東京都,千代田区,千代田,0,0,0,0,0,0\n';

describe("build-dataset CLI", () => {
  test("exits non-zero, writes no output file, and reports the failing entry when a record fails the shared PostalCode contract", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "postal-data-guard-"));
    const inputPath = path.join(dir, "input.csv");
    const outputPath = path.join(dir, "output.json");
    writeFileSync(inputPath, malformedSource);

    try {
      const result = spawnSync(
        "bun",
        ["run", scriptPath, inputPath, outputPath],
        { encoding: "utf8", timeout: SPAWN_TIMEOUT_MS },
      );

      // A missing `bun` binary, a deleted/renamed script, or a crash
      // anywhere before the guard runs would also produce a non-zero (or
      // null) status, so pin the guard's actual evidence: it must exit
      // with exactly status 1 and print the specific refusal message,
      // not merely fail for some other reason.
      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(
        /Refusing to write a corrupt dataset: 1 entry failed/,
      );
      expect(existsSync(outputPath)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("exits zero and writes a valid dataset file when every record satisfies the shared PostalCode contract", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "postal-data-guard-"));
    const inputPath = path.join(dir, "input.csv");
    const outputPath = path.join(dir, "output.json");
    writeFileSync(inputPath, wellFormedSource);

    try {
      const result = spawnSync(
        "bun",
        ["run", scriptPath, inputPath, outputPath],
        { encoding: "utf8", timeout: SPAWN_TIMEOUT_MS },
      );

      // This is the positive control: without it, the test above being
      // red-for-the-right-reason would look identical to it always being
      // red, since neither alone proves the harness can also go green.
      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(0);
      expect(existsSync(outputPath)).toBe(true);
      expect(() =>
        JSON.parse(readFileSync(outputPath, "utf8")),
      ).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
