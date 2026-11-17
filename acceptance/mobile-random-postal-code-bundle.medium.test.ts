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
 * Acceptance test for Issue #13, the part about what is built: AC-5 (the
 * Japan Post dataset is not packaged), AC-9's two platforms, and AC-10
 * (`expo export --platform ios` still succeeds). The screen's behaviour is
 * mobile-random-postal-code.medium.test.tsx.
 *
 * How the app is exercised
 * ------------------------
 * Both platforms are exported with `expo export --source-maps` through the
 * workspace's Expo CLI, as Issue #12's acceptance test does, and every file
 * of each export is read back. The dataset counts as packaged when a source
 * map lists a file of the dataset package or the API's generated data, or
 * when the export carries the postal codes themselves: a sample of postal
 * codes is taken from the committed Japan Post source and looked for in the
 * export's bytes. Hermes bytecode keeps ASCII strings as they are, so seven
 * ASCII digits are findable without a Hermes decoder.
 *
 * AC-9's platforms are read from Jest's resolved configuration
 * (`jest --showConfig`): the screen test must run under an iOS project and
 * an Android project, each with that platform as its default.
 *
 * What this test deliberately does not pin
 * ----------------------------------------
 * - The bundle's size. A size limit says nothing about the dataset and
 *   would fail for unrelated growth.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const mobileRoot = path.join(repositoryRoot, "apps", "mobile");
const datasetSource = path.join(
  repositoryRoot,
  "packages",
  "postal-data",
  "data",
  "ken-all.source.csv",
);

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
  /** Every exported file, read as bytes-as-text. */
  exportedText: string;
  /** Every source path the platform's source maps list. */
  sources: string[];
};

const outputRoot = mkdtempSync(
  path.join(tmpdir(), "zipnami-mobile-13-export-"),
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
 * Exports one platform and reads back what it produced.
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
  const files = filesUnder(outputDir);
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

/**
 * Every 500th postal code of the committed Japan Post source.
 * @returns Seven-digit postal codes.
 */
const samplePostalCodes = (): string[] =>
  readFileSync(datasetSource, "utf8")
    .split("\n")
    .filter((_, index) => index % 500 === 0)
    .map((line) => /^[^,]*,[^,]*,"(\d{7})"/.exec(line)?.[1])
    .filter((code): code is string => code !== undefined);

beforeAll(() => {
  exports.set("android", exportPlatform("android"));
  exports.set("ios", exportPlatform("ios"));
}, 1_200_000);

afterAll(() => {
  rmSync(outputRoot, { recursive: true, force: true });
});

const platforms = ["android", "ios"] as const;

describe("Issue #13: what the mobile app is built from", () => {
  test("AC-10 `expo export --platform ios` still succeeds", () => {
    const { result, exportedText } = exported("ios");

    expect({
      status: result.status,
      output: `${result.stdout}\n${result.stderr}`.slice(-3000),
    }).toMatchObject({ status: 0 });
    expect(exportedText.length).toBeGreaterThan(0);
  });

  test.each(platforms)(
    "AC-5 on %s, no dataset source file is bundled",
    (platform) => {
      const { result, sources } = exported(platform);
      expect(result.status).toBe(0);
      // The bundle really lists its sources, so the absences below are about
      // the dataset, not about an empty list.
      expect(
        sources.some((source) =>
          source.endsWith("apps/mobile/src/app/index.tsx"),
        ),
      ).toBe(true);

      expect(
        sources.filter(
          (source) =>
            source.includes("packages/postal-data/") ||
            source.includes("apps/web/backend/src/data/") ||
            source.endsWith(".csv"),
        ),
      ).toEqual([]);
    },
  );

  test.each(platforms)(
    "AC-5 on %s, the export does not carry the Japan Post postal codes",
    (platform) => {
      const { result, exportedText } = exported(platform);
      expect(result.status).toBe(0);
      const sample = samplePostalCodes();
      expect(sample.length).toBeGreaterThan(100);

      // A few codes may appear as examples in the app's own copy; the
      // dataset would bring nearly all of them.
      const carried = sample.filter((code) => exportedText.includes(code));
      expect(carried.length).toBeLessThanOrEqual(3);
    },
  );

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
      "acceptance/mobile-random-postal-code.medium.test.tsx",
    );
  });
});
