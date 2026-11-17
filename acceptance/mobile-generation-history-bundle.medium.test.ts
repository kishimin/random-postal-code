import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

/*
 * Acceptance test for Issue #14, the part about what is built: AC-7 (no map
 * SDK or location permission on either platform), AC-9's two platforms,
 * and AC-10 (`expo export --platform ios` still succeeds). The screen's
 * behaviour is mobile-generation-history.medium.test.tsx.
 *
 * How the app is exercised
 * ------------------------
 * Both platforms are exported with `expo export --source-maps` through the
 * workspace's Expo CLI, as Issues #12 and #13's acceptance tests do. A map
 * SDK or a location library counts as added when a platform's source maps
 * list a file of one, or when the app's package declares one. Permissions
 * come from `expo config --type introspect`, which applies the config
 * plugins and returns the AndroidManifest.xml and Info.plist that
 * `expo prebuild` would write.
 *
 * AC-9's platforms are read from Jest's resolved configuration
 * (`jest --showConfig`), and `jest --listTests` must name the screen test.
 *
 * What this test deliberately does not pin
 * ----------------------------------------
 * - Permissions a native library's own manifest adds when Gradle merges it.
 *   The merged manifest only exists after a native build this test cannot
 *   run; the package check above covers the libraries that would add them.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const mobileRoot = path.join(repositoryRoot, "apps", "mobile");

/**
 * Map SDKs and location libraries for React Native and Expo. Opening a map
 * externally needs none of them.
 */
const mapOrLocationPackages = [
  "react-native-maps",
  "expo-maps",
  "@rnmapbox/maps",
  "react-native-mapbox-gl",
  "@react-native-mapbox-gl/maps",
  "react-native-google-maps",
  "react-native-yamap",
  "expo-location",
  "react-native-geolocation-service",
  "@react-native-community/geolocation",
  "react-native-location",
  "react-native-background-geolocation",
];

/**
 * Runs a workspace binary in apps/mobile.
 * @param args - The arguments after `bun run`.
 * @returns The finished process.
 */
const run = (args: string[]): SpawnSyncReturns<string> =>
  spawnSync("bun", ["run", ...args], {
    cwd: mobileRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "1",
      EXPO_PUBLIC_API_BASE_URL: "https://api.zipnami-acceptance.example",
    },
    maxBuffer: 64 * 1024 * 1024,
    timeout: 600_000,
    shell: process.platform === "win32",
  });

type Export = {
  result: SpawnSyncReturns<string>;
  /** Every exported file other than source maps. */
  files: string[];
  /** Every source path the platform's source maps list. */
  sources: string[];
};

const outputRoot = mkdtempSync(
  path.join(tmpdir(), "zipnami-mobile-14-export-"),
);
const exports = new Map<"android" | "ios", Export>();

/**
 * Every file under a directory.
 * @param directory - Where to start.
 * @returns Absolute paths of the files.
 */
const filesUnder = (directory: string): string[] =>
  existsSync(directory)
    ? readdirSync(directory).flatMap((name) => {
        const entry = path.join(directory, name);
        return statSync(entry).isDirectory() ? filesUnder(entry) : [entry];
      })
    : [];

/**
 * Exports one platform and reads back the sources its bundle lists.
 * @param platform - The platform to export.
 * @returns The process and what the export holds.
 */
const exportPlatform = (platform: "android" | "ios"): Export => {
  const outputDir = path.join(outputRoot, platform);
  const result = run([
    "expo",
    "export",
    "--platform",
    platform,
    "--output-dir",
    outputDir,
    "--source-maps",
  ]);
  const all = filesUnder(outputDir);
  const sources = all
    .filter((file) => file.endsWith(".map"))
    .flatMap((file) => {
      const map: unknown = JSON.parse(readFileSync(file, "utf8"));
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
  return {
    result,
    files: all.filter((file) => !file.endsWith(".map")),
    sources,
  };
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

describe("Issue #14: what the mobile app is built from", () => {
  test("AC-10 `expo export --platform ios` still succeeds", () => {
    const { result, files } = exported("ios");

    expect({
      status: result.status,
      output: `${result.stdout}\n${result.stderr}`.slice(-3000),
    }).toMatchObject({ status: 0 });
    expect(files.length).toBeGreaterThan(0);
  });

  test.each(platforms)(
    "AC-7 on %s, the bundle carries no map SDK or location library",
    (platform) => {
      const { result, sources } = exported(platform);
      expect(result.status).toBe(0);
      // The bundle really lists its sources, so the absence below is about
      // map libraries, not about an empty list.
      expect(
        sources.some((source) =>
          source.endsWith("apps/mobile/src/app/index.tsx"),
        ),
      ).toBe(true);

      expect(
        sources.filter((source) =>
          mapOrLocationPackages.some((name) =>
            source.includes(`node_modules/${name}/`),
          ),
        ),
      ).toEqual([]);
    },
  );

  test("AC-7 the app declares no map SDK or location library", () => {
    const manifest: unknown = JSON.parse(
      readFileSync(path.join(mobileRoot, "package.json"), "utf8"),
    );
    const declared =
      typeof manifest === "object" &&
      manifest !== null &&
      "dependencies" in manifest &&
      typeof manifest.dependencies === "object" &&
      manifest.dependencies !== null
        ? Object.keys(manifest.dependencies)
        : [];
    expect(declared).toContain("expo");

    expect(
      declared.filter((name) => mapOrLocationPackages.includes(name)),
    ).toEqual([]);
  });

  test("AC-7 neither platform requests a location permission", () => {
    const result = run(["expo", "config", "--type", "introspect", "--json"]);
    expect({
      status: result.status,
      output: result.stderr.slice(-3000),
    }).toMatchObject({ status: 0 });
    const config = JSON.stringify(
      JSON.parse(result.stdout.slice(result.stdout.indexOf("{"))),
    );

    for (const permission of [
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "ACCESS_MEDIA_LOCATION",
    ]) {
      expect(config).not.toContain(`"android.permission.${permission}"`);
    }
    for (const usage of [
      "NSLocationWhenInUseUsageDescription",
      "NSLocationAlwaysAndWhenInUseUsageDescription",
      "NSLocationAlwaysUsageDescription",
      "NSLocationUsageDescription",
    ]) {
      expect(config).not.toContain(`"${usage}"`);
    }
    // The introspected manifest is really there, so the absences above are
    // about a permission list, not about a missing one.
    expect(config).toContain('"android.permission.INTERNET"');
  });

  test("AC-9 the screen test runs under an iOS project and an Android project", () => {
    const result = run(["jest", "--showConfig"]);
    expect({
      status: result.status,
      output: result.stderr.slice(-3000),
    }).toMatchObject({ status: 0 });

    const shown: unknown = JSON.parse(
      result.stdout.slice(result.stdout.indexOf("{")),
    );
    const configs =
      typeof shown === "object" && shown !== null && "configs" in shown
        ? shown.configs
        : [];
    const projectPlatforms = (Array.isArray(configs) ? configs : []).map(
      (config: unknown) => {
        const text = JSON.stringify(config);
        return /"defaultPlatform":"(\w+)"/.exec(text)?.[1];
      },
    );

    expect([...projectPlatforms].sort()).toEqual(
      expect.arrayContaining(["android", "ios"]),
    );
    expect(projectPlatforms).not.toContain("web");

    const listed = run(["jest", "--listTests"]);
    expect(listed.status).toBe(0);
    expect(listed.stdout.replaceAll("\\", "/")).toContain(
      "acceptance/mobile-generation-history.medium.test.tsx",
    );
  });
});
