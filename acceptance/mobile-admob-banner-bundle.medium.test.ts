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
 * Acceptance test for Issue #15, the part about what is built: the AdMob
 * identifiers per platform and per environment (AC-3, AC-4), the banner as
 * the only format in the app's code (AC-1), the production permissions and
 * usage descriptions (AC-10), and `expo export --platform ios` (AC-12). The
 * running app's behaviour is mobile-admob-banner.medium.test.tsx; this file
 * also checks that Jest runs it under both platform projects.
 *
 * How the app is exercised
 * ------------------------
 * Both platforms are exported with `expo export --source-maps` through the
 * workspace's Expo CLI, as Issues #12 to #14's acceptance tests do. The
 * native configuration comes from `expo config --type introspect`, which
 * applies the config plugins and returns the AndroidManifest.xml and
 * Info.plist that `expo prebuild` would write.
 *
 * The owner's decision on Issue #15 (option A, 2026-11-18) names the
 * variables: the AdMob app IDs are read from `ADMOB_ANDROID_APP_ID` and
 * `ADMOB_IOS_APP_ID` when the native configuration is resolved, and Google's
 * test app IDs are used when they are unset. The banner unit IDs are split
 * per platform the same way, as `EXPO_PUBLIC_AD_BANNER_UNIT_ID_ANDROID` and
 * `EXPO_PUBLIC_AD_BANNER_UNIT_ID_IOS`. An empty value, which a variable
 * listed in .env with nothing after `=` arrives as, counts as unset.
 *
 * "Production" is the EAS `production` build profile: EAS sets
 * `EAS_BUILD_PROFILE` while it resolves the configuration of a build.
 *
 * What this test deliberately does not pin
 * ----------------------------------------
 * - Permissions a native library's own manifest adds when Gradle merges it
 *   (the Google Mobile Ads SDK's AD_ID, for one). The merged manifest only
 *   exists after a native build this test cannot run.
 * - The wording of the tracking usage description, only that it is there.
 * - The production AdMob IDs themselves. None exist yet; placeholders on a
 *   publisher ID no one owns stand in for them.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const mobileRoot = path.join(repositoryRoot, "apps", "mobile");

const googleTestAppIds = {
  android: "ca-app-pub-3940256099942544~3347511713",
  ios: "ca-app-pub-3940256099942544~1458002511",
};
const productionAppIds = {
  android: "ca-app-pub-1111111111111111~1111111111",
  ios: "ca-app-pub-2222222222222222~2222222222",
};
const productionUnitIds = {
  android: "ca-app-pub-1111111111111111/1111111111",
  ios: "ca-app-pub-2222222222222222/2222222222",
};

/** Every AdMob setting unset, so nothing from the shell leaks in. */
const unset = {
  ADMOB_ANDROID_APP_ID: "",
  ADMOB_IOS_APP_ID: "",
  EXPO_PUBLIC_AD_BANNER_UNIT_ID_ANDROID: "",
  EXPO_PUBLIC_AD_BANNER_UNIT_ID_IOS: "",
};

const production = {
  ADMOB_ANDROID_APP_ID: productionAppIds.android,
  ADMOB_IOS_APP_ID: productionAppIds.ios,
  EXPO_PUBLIC_AD_BANNER_UNIT_ID_ANDROID: productionUnitIds.android,
  EXPO_PUBLIC_AD_BANNER_UNIT_ID_IOS: productionUnitIds.ios,
};

/**
 * Runs a workspace binary in apps/mobile.
 * @param args - The arguments after `bun run`.
 * @param env - Extra environment variables.
 * @returns The finished process.
 */
const run = (
  args: string[],
  env: Record<string, string> = {},
): SpawnSyncReturns<string> =>
  spawnSync("bun", ["run", ...args], {
    cwd: mobileRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "1",
      EXPO_PUBLIC_API_BASE_URL: "https://api.zipnami-acceptance.example",
      ...env,
    },
    maxBuffer: 64 * 1024 * 1024,
    timeout: 600_000,
    shell: process.platform === "win32",
  });

type Export = {
  result: SpawnSyncReturns<string>;
  /** Every exported file other than source maps, read as bytes-as-text. */
  exportedText: string;
  /** Every source path the platform's source maps list. */
  sources: string[];
};

const outputRoot = mkdtempSync(
  path.join(tmpdir(), "zipnami-mobile-15-export-"),
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
 * Exports one platform with production identifiers configured.
 * @param platform - The platform to export.
 * @returns The process and what the export holds.
 */
const exportPlatform = (platform: "android" | "ios"): Export => {
  const outputDir = path.join(outputRoot, platform);
  const result = run(
    [
      "expo",
      "export",
      "--platform",
      platform,
      "--output-dir",
      outputDir,
      "--source-maps",
    ],
    production,
  );
  const files = filesUnder(outputDir);
  // Hermes bytecode keeps ASCII string literals as they are, so reading the
  // bytes as latin1 finds them without a Hermes decoder.
  const exportedText = files
    .filter((file) => !file.endsWith(".map"))
    .map((file) => readFileSync(file, "latin1"))
    .join("\n");
  const sources = files
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
  return { result, exportedText, sources };
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

type Introspected = {
  /** `uses-permission` names, without those marked `tools:node="remove"`. */
  androidPermissions: string[];
  /** The AdMob application ID in AndroidManifest.xml. */
  androidAppId: unknown;
  infoPlist: Record<string, unknown>;
};

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const attributes = (element: unknown): Record<string, unknown> =>
  record(record(element).$);

/**
 * Resolves the native configuration as `expo prebuild` would write it.
 * @param env - The build environment.
 * @returns What the manifest and the Info.plist hold.
 */
const introspect = (env: Record<string, string>): Introspected => {
  const result = run(["expo", "config", "--type", "introspect", "--json"], env);
  expect({
    status: result.status,
    output: result.stderr.slice(-3000),
  }).toMatchObject({ status: 0 });
  const config = record(
    JSON.parse(result.stdout.slice(result.stdout.indexOf("{"))),
  );
  const modResults = record(record(config._internal).modResults);
  const manifest = record(
    record(record(record(modResults.android).manifest).manifest),
  );
  const androidPermissions = list(manifest["uses-permission"])
    .map(attributes)
    .filter((permission) => permission["tools:node"] !== "remove")
    .map((permission) => String(permission["android:name"]));
  const application = list(manifest.application)[0];
  const androidAppId = list(record(application)["meta-data"])
    .map(attributes)
    .find(
      (entry) =>
        entry["android:name"] === "com.google.android.gms.ads.APPLICATION_ID",
    )?.["android:value"];
  const infoPlist = record(record(modResults.ios).infoPlist);
  return { androidPermissions, androidAppId, infoPlist };
};

/**
 * The app's own source files, without its tests.
 * @returns Paths under apps/mobile/src.
 */
const appSources = (): string[] =>
  filesUnder(path.join(mobileRoot, "src")).filter(
    (file) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file),
  );

beforeAll(() => {
  exports.set("android", exportPlatform("android"));
  exports.set("ios", exportPlatform("ios"));
}, 1_200_000);

afterAll(() => {
  rmSync(outputRoot, { recursive: true, force: true });
});

const platforms = ["android", "ios"] as const;

describe("Issue #15: what the mobile app's advertising is built from", () => {
  test("AC-12 `expo export --platform ios` still succeeds", () => {
    const { result, exportedText } = exported("ios");

    expect({
      status: result.status,
      output: `${result.stdout}\n${result.stderr}`.slice(-3000),
    }).toMatchObject({ status: 0 });
    expect(exportedText.length).toBeGreaterThan(0);
  });

  test("AC-1 the app depends on the owner's ad and tracking libraries", () => {
    const manifest = record(
      JSON.parse(readFileSync(path.join(mobileRoot, "package.json"), "utf8")),
    );
    const declared = Object.keys(record(manifest.dependencies));

    expect(declared).toEqual(
      expect.arrayContaining([
        "react-native-google-mobile-ads",
        "expo-tracking-transparency",
      ]),
    );
  });

  test.each(platforms)(
    "AC-1 on %s, the bundle carries the Google Mobile Ads library",
    (platform) => {
      const { result, sources } = exported(platform);
      expect(result.status).toBe(0);

      expect(
        sources.some((source) =>
          source.includes("node_modules/react-native-google-mobile-ads/"),
        ),
      ).toBe(true);
    },
  );

  test("AC-1 the app's code uses no ad format other than the banner", () => {
    const sources = appSources();
    expect(sources.length).toBeGreaterThan(0);
    const otherFormat =
      /\b(InterstitialAd|RewardedAd|RewardedInterstitialAd|AppOpenAd|NativeAd|NativeAdView|NativeMediaView|useInterstitialAd|useRewardedAd|useRewardedInterstitialAd|useAppOpenAd)\b/;

    expect(
      sources.filter((file) => otherFormat.test(readFileSync(file, "utf8"))),
    ).toEqual([]);
  });

  test("AC-3 without configured IDs, each platform gets Google's test AdMob app ID", () => {
    const { androidAppId, infoPlist } = introspect(unset);

    expect(androidAppId).toBe(googleTestAppIds.android);
    expect(infoPlist.GADApplicationIdentifier).toBe(googleTestAppIds.ios);
  });

  test("AC-3 the committed example leaves every AdMob ID empty", () => {
    const example = readFileSync(path.join(mobileRoot, ".env.example"), "utf8");

    for (const name of Object.keys(unset)) {
      expect(example).toMatch(new RegExp(`^${name}=\\s*$`, "m"));
    }
  });

  test("AC-3 no build profile other than production configures AdMob IDs", () => {
    const eas = record(
      JSON.parse(readFileSync(path.join(mobileRoot, "eas.json"), "utf8")),
    );
    const profiles = record(eas.build);
    expect(Object.keys(profiles)).toContain("production");

    for (const [name, profile] of Object.entries(profiles)) {
      if (name === "production") continue;
      const env = JSON.stringify(record(record(profile).env));
      expect({ name, env }).not.toMatchObject({
        env: expect.stringMatching(/ADMOB_|AD_BANNER_UNIT_ID/),
      });
    }
  });

  test("AC-4 configured AdMob app IDs reach their own platform only", () => {
    const { androidAppId, infoPlist } = introspect(production);
    const plist = JSON.stringify(infoPlist);

    expect(androidAppId).toBe(productionAppIds.android);
    expect(infoPlist.GADApplicationIdentifier).toBe(productionAppIds.ios);
    expect(plist).not.toContain(productionAppIds.android);
    expect(androidAppId).not.toBe(productionAppIds.ios);
  });

  test.each(platforms)(
    "AC-4 on %s, a release bundle carries that platform's banner unit ID",
    (platform) => {
      const { result, exportedText } = exported(platform);
      expect(result.status).toBe(0);

      // A boolean, so a failure does not print the whole export.
      expect(exportedText.includes(productionUnitIds[platform])).toBe(true);
    },
  );

  test("AC-10 a production Android build grants no permission beyond the network and the advertising ID", () => {
    const { androidPermissions } = introspect({
      ...production,
      EAS_BUILD_PROFILE: "production",
    });
    // The introspected manifest is really there, so the absences below are
    // about a permission list, not about a missing one.
    expect(androidPermissions).toContain("android.permission.INTERNET");

    const needed = [
      "android.permission.INTERNET",
      "android.permission.ACCESS_NETWORK_STATE",
      "com.google.android.gms.permission.AD_ID",
    ];
    expect(
      androidPermissions.filter((permission) => !needed.includes(permission)),
    ).toEqual([]);
  });

  test("AC-10 a production iOS build describes only the tracking prompt and the development client's local network use", () => {
    const { infoPlist } = introspect({
      ...production,
      EAS_BUILD_PROFILE: "production",
    });

    expect(typeof infoPlist.NSUserTrackingUsageDescription).toBe("string");
    expect(String(infoPlist.NSUserTrackingUsageDescription).trim()).not.toBe(
      "",
    );
    // expo-dev-client writes NSLocalNetworkUsageDescription into the one
    // Info.plist that development and release builds share; it is the only
    // other description allowed.
    expect(
      Object.keys(infoPlist).filter(
        (key) =>
          key.endsWith("UsageDescription") &&
          key !== "NSUserTrackingUsageDescription" &&
          key !== "NSLocalNetworkUsageDescription",
      ),
    ).toEqual([]);
  });

  test("the screen test runs under an iOS project and an Android project", () => {
    const result = run(["jest", "--showConfig"]);
    expect({
      status: result.status,
      output: result.stderr.slice(-3000),
    }).toMatchObject({ status: 0 });

    const shown = record(
      JSON.parse(result.stdout.slice(result.stdout.indexOf("{"))),
    );
    const projectPlatforms = list(shown.configs).map(
      (config) => /"defaultPlatform":"(\w+)"/.exec(JSON.stringify(config))?.[1],
    );
    expect([...projectPlatforms].sort()).toEqual(
      expect.arrayContaining(["android", "ios"]),
    );
    expect(projectPlatforms).not.toContain("web");

    const listed = run(["jest", "--listTests"]);
    expect(listed.status).toBe(0);
    expect(listed.stdout.replaceAll("\\", "/")).toContain(
      "acceptance/mobile-admob-banner.medium.test.tsx",
    );
  });
});
