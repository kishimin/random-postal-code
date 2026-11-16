import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

/*
 * Acceptance test for Issue #12: the Expo application foundation for
 * Android and iOS (docs/design.md section 6.3).
 *
 * Each test name starts with the criterion it holds (AC-2 … AC-8, in the
 * Issue's order).
 *
 * How the app is exercised
 * ------------------------
 * The app is built the way the Issue names it: `expo export` for each
 * platform, run from apps/mobile through the workspace's own Expo CLI. Both
 * exports run once, with two build-time variables set to recognisable
 * placeholder values, and with source maps so the test can see which source
 * files went into each bundle. The resolved native configuration comes from
 * `expo config --type introspect`, which applies the config plugins and
 * returns the AndroidManifest.xml and Info.plist that `expo prebuild` would
 * write.
 *
 * What this test deliberately does not pin
 * ----------------------------------------
 * - AC-1, that the app starts on an Android emulator or device. Nothing in
 *   CI or the unattended loop can start an emulator, and design.md section
 *   6.3 rules out Expo Go checks. It is left to a person, with the steps in
 *   apps/mobile/README.md.
 * - Permissions a native library's own manifest adds when Gradle merges it.
 *   Introspection shows the app's manifest before that merge; the app adds
 *   no library that declares the denied permissions, and the merged manifest
 *   only exists after a native build this test cannot run.
 * - What the screens look like. That is Issue #13's.
 * - That the documented production build succeeds. It needs an Expo
 *   account; AC-8 asks only that the commands are documented.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const mobileRoot = path.join(repositoryRoot, "apps", "mobile");

// Placeholders on reserved names, never real configuration.
const apiBaseUrl = "https://api.zipnami-acceptance.example";
const adBannerUnitId = "ca-app-pub-0000000000000000/0000000000";

/**
 * Runs the workspace's Expo CLI in apps/mobile.
 * @param args - The arguments after `expo`.
 * @param env - Extra environment variables.
 * @returns The finished process.
 */
const expo = (
  args: string[],
  env: Record<string, string> = {},
): SpawnSyncReturns<string> =>
  spawnSync("bun", ["run", "expo", ...args], {
    cwd: mobileRoot,
    encoding: "utf8",
    env: { ...process.env, CI: "1", ...env },
    maxBuffer: 64 * 1024 * 1024,
    timeout: 600_000,
    shell: process.platform === "win32",
  });

type Export = {
  result: SpawnSyncReturns<string>;
  /** Every bundle file of the platform, read as bytes-as-text. */
  bundleText: string;
  /** Every source path the platform's source maps list. */
  sources: string[];
};

const outputRoot = mkdtempSync(path.join(tmpdir(), "zipnami-mobile-export-"));
const exports = new Map<"android" | "ios", Export>();

/**
 * Exports one platform and reads back what it produced.
 * @param platform - The platform to export.
 * @returns The process and what the bundle holds.
 */
const exportPlatform = (platform: "android" | "ios"): Export => {
  const outputDir = path.join(outputRoot, platform);
  const result = expo(
    [
      "export",
      "--platform",
      platform,
      "--output-dir",
      outputDir,
      "--source-maps",
    ],
    {
      EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
      EXPO_PUBLIC_AD_BANNER_UNIT_ID: adBannerUnitId,
    },
  );
  const bundleDirectory = path.join(
    outputDir,
    "_expo",
    "static",
    "js",
    platform,
  );
  const files = existsSync(bundleDirectory) ? readdirSync(bundleDirectory) : [];
  // Hermes bytecode keeps ASCII string literals as they are, so reading the
  // bytes as latin1 finds them without a Hermes decoder.
  const bundleText = files
    .filter((name) => !name.endsWith(".map"))
    .map((name) => readFileSync(path.join(bundleDirectory, name), "latin1"))
    .join("\n");
  const sources = files
    .filter((name) => name.endsWith(".map"))
    .flatMap((name) => {
      const map: unknown = JSON.parse(
        readFileSync(path.join(bundleDirectory, name), "utf8"),
      );
      const listed =
        typeof map === "object" && map !== null && "sources" in map
          ? map.sources
          : [];
      return Array.isArray(listed)
        ? listed.filter(
            (source): source is string => typeof source === "string",
          )
        : [];
    })
    .map((source) => source.replaceAll("\\", "/"));
  return { result, bundleText, sources };
};

/**
 * One platform's export, run before the tests.
 * @param platform - The platform.
 * @returns Its export.
 */
const exported = (platform: "android" | "ios"): Export => {
  const found = exports.get(platform);
  if (found === undefined) throw new Error(`${platform} was not exported`);
  return found;
};

beforeAll(() => {
  exports.set("android", exportPlatform("android"));
  exports.set("ios", exportPlatform("ios"));
}, 1_200_000);

afterAll(() => {
  rmSync(outputRoot, { recursive: true, force: true });
});

const platforms = ["android", "ios"] as const;

describe("Issue #12: the Expo application foundation for Android and iOS", () => {
  test.each(platforms)(
    "AC-2 `expo export --platform %s` succeeds",
    (platform) => {
      const { result, bundleText } = exported(platform);

      expect({
        status: result.status,
        output: `${result.stdout}\n${result.stderr}`.slice(-3000),
      }).toMatchObject({ status: 0 });
      expect(bundleText.length).toBeGreaterThan(0);
    },
  );

  test.each(platforms)(
    "AC-3 on %s, Expo Router is the entry and the information route is bundled",
    (platform) => {
      const manifest: unknown = JSON.parse(
        readFileSync(path.join(mobileRoot, "package.json"), "utf8"),
      );
      expect(manifest).toMatchObject({ main: "expo-router/entry" });

      const { sources } = exported(platform);
      expect(
        sources.some((source) =>
          source.endsWith("apps/mobile/src/app/_layout.tsx"),
        ),
      ).toBe(true);
      expect(
        sources.some((source) =>
          source.endsWith("apps/mobile/src/app/info.tsx"),
        ),
      ).toBe(true);
    },
  );

  test.each(platforms)(
    "AC-4 on %s, a workspace package is bundled from its own source",
    (platform) => {
      const { sources } = exported(platform);

      expect(
        sources.some((source) => source.includes("packages/shared/src/")),
      ).toBe(true);
    },
  );

  test("AC-5 Metro has no manual watchFolders, nodeModulesPath, or extraNodeModules", () => {
    const metroConfigs = readdirSync(mobileRoot).filter((name) =>
      /^metro\.config\.(c|m)?(j|t)s$/.test(name),
    );

    for (const name of metroConfigs) {
      const text = readFileSync(path.join(mobileRoot, name), "utf8");
      expect({ name, text }).not.toMatchObject({
        text: expect.stringMatching(
          /watchFolders|nodeModulesPath|extraNodeModules/,
        ),
      });
    }
  });

  test("AC-6 neither platform requests location, camera, microphone, or contacts", () => {
    const result = expo(["config", "--type", "introspect", "--json"]);
    expect(result.status).toBe(0);
    const config = JSON.stringify(
      JSON.parse(result.stdout.slice(result.stdout.indexOf("{"))),
    );

    for (const permission of [
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "CAMERA",
      "RECORD_AUDIO",
      "READ_CONTACTS",
      "WRITE_CONTACTS",
      "GET_ACCOUNTS",
    ]) {
      expect(config).not.toContain(`"android.permission.${permission}"`);
    }
    for (const usage of [
      "NSLocationWhenInUseUsageDescription",
      "NSLocationAlwaysAndWhenInUseUsageDescription",
      "NSLocationAlwaysUsageDescription",
      "NSCameraUsageDescription",
      "NSMicrophoneUsageDescription",
      "NSContactsUsageDescription",
    ]) {
      expect(config).not.toContain(`"${usage}"`);
    }
    // The introspected manifest is really there, so the absences above are
    // about a permission list, not about a missing one.
    expect(config).toContain('"android.permission.INTERNET"');
  });

  test.each(platforms)(
    "AC-7 on %s, the API and advertisement settings come from the build environment",
    (platform) => {
      const { bundleText } = exported(platform);

      expect(bundleText).toContain(apiBaseUrl);
      expect(bundleText).toContain(adBannerUnitId);
    },
  );

  test("AC-7 the settings are named in a committed example and the real file is ignored by Git", () => {
    const example = readFileSync(path.join(mobileRoot, ".env.example"), "utf8");
    expect(example).toMatch(/^EXPO_PUBLIC_API_BASE_URL=/m);
    expect(example).toMatch(/^EXPO_PUBLIC_AD_BANNER_UNIT_ID=/m);

    const ignored = spawnSync(
      "git",
      ["check-ignore", "--quiet", "apps/mobile/.env"],
      {
        cwd: repositoryRoot,
      },
    );
    expect(ignored.status).toBe(0);
  });

  test("AC-8 the development and production build commands are documented", () => {
    const readme = readFileSync(path.join(mobileRoot, "README.md"), "utf8");
    const eas: unknown = JSON.parse(
      readFileSync(path.join(mobileRoot, "eas.json"), "utf8"),
    );

    for (const profile of ["development", "production"]) {
      expect(readme).toContain(`--profile ${profile}`);
      expect(eas).toMatchObject({ build: { [profile]: expect.any(Object) } });
    }
    expect(readme).toContain("bun run --filter @zipnami/mobile start");
  });
});
