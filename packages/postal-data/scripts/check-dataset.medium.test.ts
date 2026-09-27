import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./check-dataset.ts", import.meta.url),
);

// spawnSync blocks the test runner synchronously, so Vitest's own
// testTimeout cannot interrupt a hung child process; bound the subprocess
// itself instead.
const SPAWN_TIMEOUT_MS = 10_000;

const wellFormedSource =
  '00000,"100  ","1000001","READING","READING","READING",Tokyo,Chiyoda City,Chiyoda,0,0,0,0,0,0\n';

const matchingArtifact = JSON.stringify([
  {
    postalCode: "1000001",
    addresses: [{ prefecture: "Tokyo", city: "Chiyoda City", town: "Chiyoda" }],
  },
]);

const runCheck = (sourcePath: string, artifactPath: string) =>
  spawnSync("bun", ["run", scriptPath, sourcePath, artifactPath], {
    encoding: "utf8",
    timeout: SPAWN_TIMEOUT_MS,
  });

describe("check-dataset CLI", () => {
  test("exits 0 and leaves the artifact file's bytes unchanged when it matches what the source regenerates", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "postal-data-check-"));
    const sourcePath = path.join(dir, "source.csv");
    const artifactPath = path.join(dir, "artifact.json");
    writeFileSync(sourcePath, wellFormedSource);
    writeFileSync(artifactPath, matchingArtifact);

    try {
      const result = runCheck(sourcePath, artifactPath);

      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(0);
      expect(readFileSync(artifactPath, "utf8")).toBe(matchingArtifact);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("exits non-zero and leaves the artifact file's bytes unchanged when it has drifted from what the source regenerates", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "postal-data-check-"));
    const sourcePath = path.join(dir, "source.csv");
    const artifactPath = path.join(dir, "artifact.json");
    const driftedArtifact = JSON.stringify([]);
    writeFileSync(sourcePath, wellFormedSource);
    writeFileSync(artifactPath, driftedArtifact);

    try {
      const result = runCheck(sourcePath, artifactPath);

      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/drift/i);
      // A check that "fixes" drift by overwriting the artifact and then
      // reporting success would pass the exit-code assertion above for the
      // wrong reason; pinning the bytes here catches that.
      expect(readFileSync(artifactPath, "utf8")).toBe(driftedArtifact);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
