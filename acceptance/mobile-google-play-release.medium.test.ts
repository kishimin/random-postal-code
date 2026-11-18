import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/*
 * Acceptance test for Issue #20: prepare the Android app for Google Play
 * release, the part that can be checked from the repository.
 *
 * Each test name starts with the criterion it holds, numbered in the Issue's
 * order (AC-1 … AC-11).
 *
 * What is held here
 * -----------------
 * - AC-1 the package name of a production build.
 * - AC-2 that the EAS production profile builds an Android App Bundle. Running
 *   the build needs the owner's Expo account, so the profile is what is held.
 * - AC-3 the store assets that can be made without a device: the app icon, the
 *   adaptive icon, the splash image, the 512px listing icon, the feature
 *   graphic, and the Japanese title, short and full descriptions. They live in
 *   apps/mobile/fastlane/metadata/android/ja-JP, the layout `fastlane supply`
 *   reads, so they can be uploaded as they are or copied into Play Console by
 *   hand. The images are held by format, size, and by not being the Expo
 *   template's placeholders; what they look like is a person's judgement
 *   (ADR-0012), recorded in the release checklist.
 * - AC-5 and AC-6 as a written declaration, docs/google-play-data-safety.md,
 *   that names the exact versions of the SDKs the production build installs
 *   (read from the installed packages, so a version bump without updating the
 *   declaration fails here) and the AdMob/UMP configuration the build resolves.
 * - AC-7 the production manifest's permissions.
 * - AC-9 that no automated test or CI workflow carries a production AdMob ID.
 * - AC-8, AC-10, AC-11 and the remaining parts of AC-2 to AC-4 as items of a
 *   written release checklist, docs/google-play-release-checklist.md, so the
 *   owner can run them on a device and in Play Console.
 *
 * What is deliberately not held
 * -----------------------------
 * - Phone screenshots. They have to be taken from the running app on a device
 *   or emulator, neither of which exists here, and a made-up image would be a
 *   false record. They are an item of the checklist.
 * - Whether the privacy policy page discloses the app: that is a page in the
 *   Web application, held by mobile-app-privacy-policy.medium.test.ts.
 * - Permissions a native library adds when Gradle merges its manifest (the
 *   advertising ID, for one). The merged manifest only exists after a native
 *   build; reviewing it in the built bundle is an item of the checklist.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const mobileRoot = path.join(repositoryRoot, "apps", "mobile");
const listingRoot = path.join(
  mobileRoot,
  "fastlane",
  "metadata",
  "android",
  "ja-JP",
);
const dataSafetyPath = path.join(
  repositoryRoot,
  "docs",
  "google-play-data-safety.md",
);
const checklistPath = path.join(
  repositoryRoot,
  "docs",
  "google-play-release-checklist.md",
);
const packageName = "io.github.kishimin.zipnami";

// Placeholders on a publisher ID no one owns; a production build refuses to
// resolve without all four (Issue #15).
const productionEnv = {
  EAS_BUILD_PROFILE: "production",
  ADMOB_ANDROID_APP_ID: "ca-app-pub-1111111111111111~1111111111",
  ADMOB_IOS_APP_ID: "ca-app-pub-2222222222222222~2222222222",
  EXPO_PUBLIC_AD_BANNER_UNIT_ID_ANDROID:
    "ca-app-pub-1111111111111111/1111111111",
  EXPO_PUBLIC_AD_BANNER_UNIT_ID_IOS: "ca-app-pub-2222222222222222/2222222222",
};

/*
 * SHA-256 of the images create-expo-app committed with the app (#136). A
 * store listing showing Expo's logo or a blank grid is not a prepared asset.
 */
const expoTemplateImages = new Set([
  "119462bb78eb240a65c869fc067ee599639b3cb5a41953f25c07b17d2a8c7e0f", // icon.png
  "9e3d0315a33c6799de601dd34cd8bf8cc3a8d16f3bf75592baec2ceb7240b391", // android-icon-foreground.png
  "6371fc2c12e33ad2215a86c281db3d682a81bebe7c957a842c13b8bf00cceb83", // android-icon-monochrome.png
  "5f4c0a732b6325bf4071d9124d2ae67e037cb24fcc9c482ef82bea742109a3b8", // splash-icon.png
  "a4e030697a7571b3e95d31860e4da55d2f98e5e861e2b55e414f45a8556828ba", // favicon.png
]);

// Google's published sample publisher, the only real one a test may use.
const googleTestPublisher = "3940256099942544";

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/**
 * Runs the workspace's Expo CLI in apps/mobile.
 * @param args - The arguments after `expo`.
 * @param env - Extra environment variables.
 * @returns The finished process.
 */
const expo = (
  args: string[],
  env: Record<string, string>,
): SpawnSyncReturns<string> =>
  spawnSync("bun", ["run", "expo", ...args], {
    cwd: mobileRoot,
    encoding: "utf8",
    env: { ...process.env, CI: "1", ...env },
    maxBuffer: 64 * 1024 * 1024,
    timeout: 600_000,
    shell: process.platform === "win32",
  });

/**
 * The configuration Expo resolves for a production build.
 * @param type - `public` for the app config, `introspect` for the native files.
 * @returns The parsed configuration.
 */
const productionConfig = (
  type: "public" | "introspect",
): Record<string, unknown> => {
  const result = expo(["config", "--type", type, "--json"], productionEnv);
  expect({
    status: result.status,
    output: result.stderr.slice(-3000),
  }).toMatchObject({ status: 0 });
  return record(JSON.parse(result.stdout.slice(result.stdout.indexOf("{"))));
};

type Png = {
  width: number;
  height: number;
  /** PNG colour type: 4 and 6 carry an alpha channel. */
  colorType: number;
  bytes: number;
  sha256: string;
};

/**
 * Reads a PNG's header.
 * @param file - Absolute path of the image.
 * @returns Its size, colour type and hash, or undefined when it is not a PNG.
 */
const readPng = (file: string): Png | undefined => {
  if (!existsSync(file)) return undefined;
  const data = readFileSync(file);
  const signature = "89504e470d0a1a0a";
  if (data.subarray(0, 8).toString("hex") !== signature) return undefined;
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
    colorType: data.readUInt8(25),
    bytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
  };
};

/**
 * A text file of the store listing, without the trailing newline.
 * @param name - The file name under the ja-JP listing.
 * @returns Its text, or an empty string when it is missing.
 */
const listingText = (name: string): string => {
  const file = path.join(listingRoot, name);
  return existsSync(file) ? readFileSync(file, "utf8").trim() : "";
};

/** Length as Play Console counts it: characters, not UTF-16 code units. */
const characters = (text: string): number => [...text].length;

const japanese = /[぀-ヿ一-鿿]/;

const readOrEmpty = (file: string): string =>
  existsSync(file) ? readFileSync(file, "utf8") : "";

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
 * The package.json of a dependency as apps/mobile resolves it.
 * @param name - The package name.
 * @returns The installed manifest.
 */
const installedManifest = (name: string): Record<string, unknown> => {
  const require = createRequire(path.join(mobileRoot, "package.json"));
  return record(
    JSON.parse(readFileSync(require.resolve(`${name}/package.json`), "utf8")),
  );
};

describe("Issue #20: the Android app is prepared for Google Play", () => {
  test("AC-1 a production build carries the package name io.github.kishimin.zipnami", () => {
    const config = productionConfig("public");

    expect(record(config.android).package).toBe(packageName);
  });

  test("AC-2 the EAS production profile builds an Android App Bundle, not a development client", () => {
    const eas = record(
      JSON.parse(readFileSync(path.join(mobileRoot, "eas.json"), "utf8")),
    );
    const production = record(record(eas.build).production);

    expect(record(production.android).buildType).toBe("app-bundle");
    expect(production.developmentClient).not.toBe(true);
    expect(production.distribution).not.toBe("internal");
  });

  test("AC-3 the app icon is a square PNG of at least 1024px that is not Expo's placeholder", () => {
    const config = productionConfig("public");
    const icon = readPng(path.join(mobileRoot, String(config.icon)));

    expect(icon).toBeDefined();
    expect(icon?.width).toBe(icon?.height);
    expect(icon?.width).toBeGreaterThanOrEqual(1024);
    expect(expoTemplateImages.has(icon?.sha256 ?? "")).toBe(false);
  });

  test("AC-3 the adaptive icon's foreground and monochrome layers are square PNGs that are not Expo's placeholders", () => {
    const config = productionConfig("public");
    const adaptive = record(record(config.android).adaptiveIcon);

    for (const layer of ["foregroundImage", "monochromeImage"] as const) {
      const image = readPng(path.join(mobileRoot, String(adaptive[layer])));
      expect({ layer, isPng: image !== undefined }).toEqual({
        layer,
        isPng: true,
      });
      expect(image?.width).toBe(image?.height);
      expect(image?.width).toBeGreaterThanOrEqual(432);
      expect({
        layer,
        isTemplate: expoTemplateImages.has(image?.sha256 ?? ""),
      }).toEqual({ layer, isTemplate: false });
    }
  });

  test("AC-3 a splash image is configured, and it is not Expo's placeholder", () => {
    const config = productionConfig("public");
    const fromPlugin = list(config.plugins)
      .filter(
        (plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
      )
      .map((plugin) => record(list(plugin)[1]).image);
    const candidates = [
      ...fromPlugin,
      record(config.splash).image,
      record(record(config.android).splash).image,
    ].filter((image): image is string => typeof image === "string");

    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      const image = readPng(path.join(mobileRoot, candidate));
      expect({ candidate, isPng: image !== undefined }).toEqual({
        candidate,
        isPng: true,
      });
      expect({
        candidate,
        isTemplate: expoTemplateImages.has(image?.sha256 ?? ""),
      }).toEqual({ candidate, isTemplate: false });
    }
  });

  test("AC-3 the listing icon is a 512x512 PNG of at most 1 MB", () => {
    const icon = readPng(path.join(listingRoot, "images", "icon.png"));

    expect(icon).toBeDefined();
    expect({ width: icon?.width, height: icon?.height }).toEqual({
      width: 512,
      height: 512,
    });
    expect(icon?.bytes ?? Infinity).toBeLessThanOrEqual(1024 * 1024);
    expect(expoTemplateImages.has(icon?.sha256 ?? "")).toBe(false);
  });

  test("AC-3 the feature graphic is a 1024x500 PNG without an alpha channel", () => {
    const graphic = readPng(
      path.join(listingRoot, "images", "featureGraphic.png"),
    );

    expect(graphic).toBeDefined();
    expect({ width: graphic?.width, height: graphic?.height }).toEqual({
      width: 1024,
      height: 500,
    });
    expect([4, 6]).not.toContain(graphic?.colorType);
    expect(graphic?.bytes ?? Infinity).toBeLessThanOrEqual(15 * 1024 * 1024);
  });

  test("AC-3 the Japanese title fits Play's 30 characters and names Zipnami", () => {
    const title = listingText("title.txt");

    expect(title).toContain("Zipnami");
    expect(characters(title)).toBeLessThanOrEqual(30);
  });

  test("AC-3 the Japanese short description fits 80 characters and says what the app does", () => {
    const short = listingText("short_description.txt");

    expect(short).toMatch(japanese);
    expect(short).toMatch(/郵便番号/);
    expect(short).toMatch(/ランダム/);
    expect(characters(short)).toBeGreaterThan(0);
    expect(characters(short)).toBeLessThanOrEqual(80);
  });

  test("AC-3 the Japanese full description fits 4000 characters, credits Japan Post, and claims no location use", () => {
    const full = listingText("full_description.txt");

    expect(full).toMatch(japanese);
    expect(full).toMatch(/郵便番号/);
    expect(full).toMatch(/日本郵便/);
    expect(full).toMatch(/広告/);
    expect(full).not.toMatch(/GPS|現在地/);
    expect(characters(full)).toBeGreaterThan(80);
    expect(characters(full)).toBeLessThanOrEqual(4000);
  });

  test("AC-5 the Data safety declaration names the exact SDK versions the production build installs", () => {
    const declaration = readOrEmpty(dataSafetyPath);
    expect(declaration).not.toBe("");

    const ads = installedManifest("react-native-google-mobile-ads");
    const androidSdks = record(record(ads.sdkVersions).android);
    const storage = installedManifest(
      "@react-native-async-storage/async-storage",
    );
    const expected = {
      "react-native-google-mobile-ads": String(ads.version),
      "Google Mobile Ads SDK": String(androidSdks.googleMobileAds),
      "User Messaging Platform": String(androidSdks.googleUmp),
      "@react-native-async-storage/async-storage": String(storage.version),
    };

    for (const [name, version] of Object.entries(expected)) {
      // The name and its version on one line, so a version written next to
      // the wrong SDK does not count.
      const declared = declaration
        .split(/\r?\n/)
        .some((text) => text.includes(name) && text.includes(version));
      expect({ name, version, declared }).toEqual({
        name,
        version,
        declared: true,
      });
    }
  });

  test("AC-5 the Data safety declaration covers the data types the Google Mobile Ads SDK collects", () => {
    const declaration = readOrEmpty(dataSafetyPath);
    const dataTypes: readonly { name: string; pattern: RegExp }[] = [
      { name: "approximate location", pattern: /Approximate location/i },
      { name: "app interactions", pattern: /App interactions/i },
      { name: "diagnostics", pattern: /Crash logs|Diagnostics/i },
      { name: "device or other IDs", pattern: /Device or other IDs/i },
    ];

    for (const { name, pattern } of dataTypes) {
      expect({ dataType: name, declared: pattern.test(declaration) }).toEqual({
        dataType: name,
        declared: true,
      });
    }
    expect(declaration).toMatch(/encrypted in transit/i);
    // The history never leaves the device, so it is declared as not collected.
    expect(declaration).toMatch(/history[^\n]*(not collected|on the device)/i);
  });

  test("AC-6 the advertising and consent declaration matches the AdMob and UMP configuration the build resolves", () => {
    const declaration = readOrEmpty(dataSafetyPath);
    const config = productionConfig("public");
    const adsPlugin = list(config.plugins).find(
      (plugin) =>
        Array.isArray(plugin) && plugin[0] === "react-native-google-mobile-ads",
    );
    const options = record(list(adsPlugin)[1]);
    expect(options.delayAppMeasurementInit).toBe(true);

    expect(declaration).toMatch(/Contains ads[^\n]*Yes/i);
    expect(declaration).toContain("com.google.android.gms.permission.AD_ID");
    expect(declaration).toMatch(/AdsConsent|UMP/);
    expect(declaration).toMatch(/EEA/);
    expect(declaration).toMatch(/non-personali[sz]ed/i);
    // The SDK starts measuring only after consent, which is what this option
    // does; the declaration has to say so in the option's own name.
    expect(declaration).toContain("delayAppMeasurementInit");
  });

  test("AC-7 the production manifest asks for no location, camera, microphone or contacts permission", () => {
    const config = productionConfig("introspect");
    const manifest = record(
      record(
        record(record(record(config._internal).modResults).android).manifest,
      ).manifest,
    );
    const permissions = list(manifest["uses-permission"])
      .map((entry) => record(record(entry).$))
      .filter((entry) => entry["tools:node"] !== "remove")
      .map((entry) => String(entry["android:name"]));
    expect(permissions).toContain("android.permission.INTERNET");

    expect(
      permissions.filter((permission) =>
        /LOCATION|CAMERA|RECORD_AUDIO|CONTACTS/.test(permission),
      ),
    ).toEqual([]);
  });

  test("AC-9 no automated test carries an AdMob ID of a real publisher other than Google's test one", () => {
    const listed = spawnSync("git", ["ls-files", "-z"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    expect(listed.status).toBe(0);
    const testFiles = listed.stdout
      .split("\0")
      .filter(
        (file) =>
          /\.test\.[cm]?[jt]sx?$/.test(file) ||
          /(^|\/)(jest|vitest)\.(setup|config)\.[cm]?[jt]s$/.test(file),
      );
    expect(testFiles.length).toBeGreaterThan(0);

    const realPublishers = testFiles.flatMap((file) =>
      [
        ...readFileSync(path.join(repositoryRoot, file), "utf8").matchAll(
          /ca-app-pub-(\d{16})/g,
        ),
      ]
        .map((match) => match[1] ?? "")
        // A publisher made of one repeated digit is a placeholder.
        .filter((id) => id !== googleTestPublisher && !/^(\d)\1+$/.test(id))
        .map((id) => `${file}: ${id}`),
    );

    expect(realPublishers).toEqual([]);
  });

  test("AC-9 no CI workflow hands AdMob IDs from secrets or variables to its jobs", () => {
    const workflows = filesUnder(
      path.join(repositoryRoot, ".github", "workflows"),
    );
    expect(workflows.length).toBeGreaterThan(0);

    expect(
      workflows.filter((file) =>
        /\$\{\{\s*(secrets|vars)\.[A-Z0-9_]*(ADMOB|AD_BANNER)/i.test(
          readFileSync(file, "utf8"),
        ),
      ),
    ).toEqual([]);
  });

  test("AC-2, AC-3, AC-4, AC-7, AC-8, AC-10, AC-11 the release checklist lists every step only the owner can run", () => {
    const checklist = readOrEmpty(checklistPath);
    expect(checklist).not.toBe("");
    const items = checklist
      .split(/\r?\n/)
      .filter((line) => /^\s*[-*+]\s+\[[ xX]\]\s+/.test(line))
      .join("\n");

    const steps: readonly { name: string; pattern: RegExp }[] = [
      { name: "EAS production build", pattern: /eas build[^\n]*production/i },
      { name: "production AdMob IDs", pattern: /ADMOB_ANDROID_APP_ID/ },
      { name: "phone screenshots", pattern: /screenshot/i },
      { name: "store images reviewed", pattern: /feature graphic/i },
      { name: "privacy policy URL", pattern: /privacy policy URL/i },
      { name: "Data safety form", pattern: /Data safety/i },
      { name: "merged manifest review", pattern: /merged manifest/i },
      { name: "test track", pattern: /(internal|closed) testing/i },
      { name: "feedback and crashes", pattern: /crash/i },
      { name: "starts on a device", pattern: /emulator|device/i },
      { name: "API", pattern: /\bAPI\b/ },
      { name: "history", pattern: /history/i },
      { name: "external maps", pattern: /map/i },
      { name: "ads", pattern: /\bads?\b|banner/i },
      { name: "consent", pattern: /consent/i },
      { name: "offline", pattern: /offline/i },
    ];

    for (const { name, pattern } of steps) {
      expect({ step: name, listed: pattern.test(items) }).toEqual({
        step: name,
        listed: true,
      });
    }
    expect(checklist).toContain("docs/google-play-data-safety.md");
    expect(checklist).toContain("apps/mobile/fastlane/metadata/android/ja-JP");
    expect(checklist).toMatch(/^#{1,6}\s+Evidence\s*$/m);
  });
});
