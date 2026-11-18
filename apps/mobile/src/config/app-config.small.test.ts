import type { ConfigContext } from "expo/config";
import { describe, expect, test } from "vitest";
import appConfig from "../../app.config";

const adsPluginOptions = (): unknown => {
  const context: ConfigContext = {
    projectRoot: ".",
    staticConfigPath: null,
    packageJsonPath: null,
    config: {},
  };
  const plugin = appConfig(context).plugins?.find(
    (entry) =>
      Array.isArray(entry) && entry[0] === "react-native-google-mobile-ads",
  );
  return Array.isArray(plugin) ? plugin[1] : undefined;
};

describe("app.config", () => {
  // Measurement that starts at launch would run before the person has
  // answered the consent form; initialize() starts it after consent.
  test("delays the ad SDK's app measurement until it is initialised", () => {
    expect(adsPluginOptions()).toMatchObject({ delayAppMeasurementInit: true });
  });
});
