import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ExpoConfig } from "expo/config";
import type { ModConfig } from "expo/config-plugins";
import { describe, expect, onTestFinished, test } from "vitest";
import {
  exitTraceSource,
  withExitTrace,
  writeExitTraceSource,
} from "./exit-trace-plugin";

const packageName = "io.github.kishimin.zipnami";
const exitTracePath =
  "app/src/main/java/io/github/kishimin/zipnami/ExitTrace.kt";

const temporaryAndroidRoot = async (): Promise<string> => {
  const androidRoot = await mkdtemp(path.join(tmpdir(), "zipnami-exit-trace-"));
  onTestFinished(() => rm(androidRoot, { recursive: true, force: true }));
  return androidRoot;
};

// Plugins attach their mods to the config; ExpoConfig itself does not declare
// the field.
const androidMods = (): NonNullable<ModConfig["android"]> => {
  const config: ExpoConfig & { mods?: ModConfig } = withExitTrace({
    name: "Zipnami",
    slug: "zipnami",
    android: { package: packageName },
  });
  const mods = config.mods?.android;
  if (mods === undefined) {
    throw new Error("withExitTrace attached no Android mod");
  }
  return mods;
};

const modRequest = (androidRoot: string, modName: string) => ({
  projectRoot: path.dirname(androidRoot),
  platformProjectRoot: androidRoot,
  modName,
  platform: "android" as const,
  introspect: false,
});

describe("writeExitTraceSource", () => {
  test("writes the trace beside MainApplication in a fresh android project", async () => {
    const androidRoot = await temporaryAndroidRoot();

    await writeExitTraceSource(androidRoot, packageName);

    const written = await readFile(
      path.join(androidRoot, exitTracePath),
      "utf8",
    );
    expect(written).toBe(exitTraceSource(packageName));
  });
});

// The mods as `expo prebuild` runs them: the wiring between the plugin and
// the functions above is what decides whether the build carries the trace.
describe("withExitTrace's mods", () => {
  test("the dangerous mod writes ExitTrace.kt into the generated android project", async () => {
    const androidRoot = await temporaryAndroidRoot();
    const { dangerous } = androidMods();

    await dangerous?.({
      name: "Zipnami",
      slug: "zipnami",
      modRequest: modRequest(androidRoot, "dangerous"),
      modResults: undefined,
      modRawConfig: { name: "Zipnami", slug: "zipnami" },
    });

    const written = await readFile(
      path.join(androidRoot, exitTracePath),
      "utf8",
    );
    expect(written).toMatch(/^package io\.github\.kishimin\.zipnami\n/);
  });

  test("the MainApplication mod returns the source with the trace installed", async () => {
    const androidRoot = await temporaryAndroidRoot();
    const { mainApplication } = androidMods();

    const result = await mainApplication?.({
      name: "Zipnami",
      slug: "zipnami",
      modRequest: modRequest(androidRoot, "mainApplication"),
      modResults: {
        path: path.join(androidRoot, "MainApplication.kt"),
        language: "kt",
        contents:
          "class MainApplication : Application(), ReactApplication {\n}\n",
      },
      modRawConfig: { name: "Zipnami", slug: "zipnami" },
    });

    expect(result?.modResults.contents).toContain("ExitTrace.install()");
  });
});
