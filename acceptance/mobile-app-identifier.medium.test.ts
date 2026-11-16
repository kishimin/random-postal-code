import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/*
 * Acceptance test for Issue #12, criterion 1: the Android application ID and
 * the iOS bundle identifier (owner decision, 2026-11-16).
 *
 * The identifier is read twice: from apps/mobile/app.json, where the
 * criterion names it, and from `expo config --type public`, the configuration
 * Expo actually builds from. The second read fails if a later app.config.*
 * file or plugin replaces the value without app.json changing.
 *
 * Starting the app on an emulator or device is #20's, not this test's.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const mobileRoot = path.join(repositoryRoot, "apps", "mobile");
const identifier = "io.github.kishimin.zipnami";

describe("Issue #12: the application identifier", () => {
  test("AC-1 app.json sets android.package and ios.bundleIdentifier to the owner's ID", () => {
    const appJson: unknown = JSON.parse(
      readFileSync(path.join(mobileRoot, "app.json"), "utf8"),
    );

    expect(appJson).toMatchObject({
      expo: {
        android: { package: identifier },
        ios: { bundleIdentifier: identifier },
      },
    });
  });

  test("AC-1 the configuration Expo resolves carries the same ID on both platforms", () => {
    const result = spawnSync(
      "bun",
      ["run", "expo", "config", "--type", "public", "--json"],
      {
        cwd: mobileRoot,
        encoding: "utf8",
        env: { ...process.env, CI: "1" },
        maxBuffer: 16 * 1024 * 1024,
        timeout: 300_000,
        shell: process.platform === "win32",
      },
    );
    expect({
      status: result.status,
      output: `${result.stdout}\n${result.stderr}`.slice(-3000),
    }).toMatchObject({ status: 0 });

    const config: unknown = JSON.parse(
      result.stdout.slice(result.stdout.indexOf("{")),
    );
    expect(config).toMatchObject({
      android: { package: identifier },
      ios: { bundleIdentifier: identifier },
    });
  });
});
