import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, onTestFinished, test } from "vitest";
import { exitTraceSource, writeExitTraceSource } from "./exit-trace-plugin";

describe("writeExitTraceSource", () => {
  test("writes the trace beside MainApplication in a fresh android project", async () => {
    const androidRoot = await mkdtemp(
      path.join(tmpdir(), "zipnami-exit-trace-"),
    );
    onTestFinished(() => rm(androidRoot, { recursive: true, force: true }));

    await writeExitTraceSource(androidRoot, "io.github.kishimin.zipnami");

    const written = await readFile(
      path.join(
        androidRoot,
        "app/src/main/java/io/github/kishimin/zipnami/ExitTrace.kt",
      ),
      "utf8",
    );
    expect(written).toBe(exitTraceSource("io.github.kishimin.zipnami"));
  });
});
