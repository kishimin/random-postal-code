import type { ConfigContext, ExpoConfig } from "expo/config";
import type { ModConfig } from "expo/config-plugins";
import { afterEach, describe, expect, test, vi } from "vitest";
import appConfig from "../../app.config";

// Plugins attach their mods to the config; ExpoConfig itself does not declare
// the field.
type ConfigWithMods = ExpoConfig & { mods?: ModConfig };

const adMobNames = [
  "ADMOB_ANDROID_APP_ID",
  "ADMOB_IOS_APP_ID",
  "EXPO_PUBLIC_AD_BANNER_UNIT_ID_ANDROID",
  "EXPO_PUBLIC_AD_BANNER_UNIT_ID_IOS",
] as const;
type AdMobEnv = Partial<Record<(typeof adMobNames)[number], string>>;

// Placeholder values in the shape of real IDs; the production profile refuses
// to resolve without all four.
const productionAdMobEnv: AdMobEnv = {
  ADMOB_ANDROID_APP_ID: "ca-app-pub-0000000000000000~1111111111",
  ADMOB_IOS_APP_ID: "ca-app-pub-0000000000000000~2222222222",
  EXPO_PUBLIC_AD_BANNER_UNIT_ID_ANDROID:
    "ca-app-pub-0000000000000000/3333333333",
  EXPO_PUBLIC_AD_BANNER_UNIT_ID_IOS: "ca-app-pub-0000000000000000/4444444444",
};

const resolve = (
  profile: string | undefined,
  env: AdMobEnv = {},
): ConfigWithMods => {
  vi.stubEnv("EAS_BUILD_PROFILE", profile);
  // Unset unless given, so the developer's own shell cannot change the result.
  for (const name of adMobNames) {
    vi.stubEnv(name, env[name]);
  }
  const context: ConfigContext = {
    projectRoot: ".",
    staticConfigPath: null,
    packageJsonPath: null,
    config: { android: { package: "io.github.kishimin.zipnami" } },
  };
  return appConfig(context);
};

const pluginOptions = (config: ExpoConfig, name: string): unknown => {
  const plugin = config.plugins?.find(
    (entry) => Array.isArray(entry) && entry[0] === name,
  );
  return Array.isArray(plugin) ? plugin[1] : undefined;
};

const proguardRules = (config: ExpoConfig): string =>
  JSON.stringify(pluginOptions(config, "expo-build-properties"));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("app.config", () => {
  // Measurement that starts at launch would run before the person has
  // answered the consent form; initialize() starts it after consent.
  test("delays the ad SDK's app measurement until it is initialised", () => {
    expect(
      pluginOptions(resolve(undefined), "react-native-google-mobile-ads"),
    ).toMatchObject({ delayAppMeasurementInit: true });
  });
});

// Issue #173: the diagnostic profile is the release build with R8, plus a
// trace that logs who calls System.exit.
describe("app.config for the diagnostic profile", () => {
  test("adds the exit trace to MainApplication and writes its source", () => {
    const config = resolve("diagnostic");

    expect(config.mods?.android?.mainApplication).toBeTypeOf("function");
    expect(config.mods?.android?.dangerous).toBeTypeOf("function");
  });

  test("keeps the production R8 rules and leaves class names readable", () => {
    const rules = proguardRules(resolve("diagnostic"));

    expect(rules).toContain("androidx.room.RoomDatabase");
    expect(rules).toContain("-dontobfuscate");
  });

  test("blocks the same unused permissions as a production build", () => {
    const production = resolve("production", productionAdMobEnv);

    expect(resolve("diagnostic").android?.blockedPermissions).toEqual(
      production.android?.blockedPermissions,
    );
    expect(production.android?.blockedPermissions).toContain(
      "android.permission.SYSTEM_ALERT_WINDOW",
    );
  });

  // The production AdMob IDs belong to the production profile alone
  // (docs/google-play-release-checklist.md), so this profile stays on
  // Google's test IDs and must resolve without them.
  test("resolves without the production AdMob IDs", () => {
    expect(() => resolve("diagnostic")).not.toThrow();
  });
});

describe("app.config for the other profiles", () => {
  test.each([
    ["production", productionAdMobEnv],
    ["development", {}],
    [undefined, {}],
  ])(
    "the %s profile carries no exit trace and keeps obfuscation",
    (profile, env) => {
      const config = resolve(profile, env);

      expect(config.mods?.android?.mainApplication).toBeUndefined();
      expect(proguardRules(config)).not.toContain("-dontobfuscate");
    },
  );
});
