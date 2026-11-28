import { describe, expect, test } from "vitest";
import {
  exitTraceSource,
  exitTraceSourcePath,
  hookMainApplication,
  installExitTrace,
  withExitTrace,
} from "./exit-trace-plugin";

// The shape of the MainApplication.kt that `expo prebuild` writes (SDK 58).
const mainApplication = `package io.github.kishimin.zipnami

class MainApplication : Application(), ReactApplication {
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }
}
`;

describe("installExitTrace", () => {
  test("installs the trace right after the application's super.onCreate()", () => {
    const installed = installExitTrace(mainApplication);

    expect(installed).toMatch(
      /super\.onCreate\(\)\n\s+ExitTrace\.install\(\)\n\s+loadReactNative\(this\)/,
    );
  });

  test("installs the trace once when the mod runs twice", () => {
    const installed = installExitTrace(installExitTrace(mainApplication));

    expect(installed.match(/ExitTrace\.install\(\)/g)).toHaveLength(1);
  });

  // A build that silently lacks the trace would send the owner to the device
  // for nothing, so a template change must fail the build instead.
  test("fails when MainApplication has no super.onCreate() to hook", () => {
    expect(() => installExitTrace("class MainApplication")).toThrow(
      /super\.onCreate\(\)/,
    );
  });
});

describe("exitTraceSource", () => {
  const source = exitTraceSource("io.github.kishimin.zipnami");

  test("declares the trace in the application's package", () => {
    expect(source).toMatch(/^package io\.github\.kishimin\.zipnami\n/);
  });

  test("logs from a shutdown hook, which Runtime.exit runs before the process ends", () => {
    expect(source).toContain("Runtime.getRuntime().addShutdownHook(");
  });

  test("logs the stack of the thread inside Runtime.exit under one logcat tag", () => {
    expect(source).toContain('"ZipnamiExitTrace"');
    expect(source).toContain('frame.className == "java.lang.Runtime"');
    expect(source).toContain('frame.methodName == "exit"');
    expect(source).toContain("Thread.getAllStackTraces()");
  });
});

describe("hookMainApplication", () => {
  test("installs the trace into a Kotlin MainApplication", () => {
    const hooked = hookMainApplication({
      language: "kt",
      contents: mainApplication,
    });

    expect(hooked.contents).toContain("ExitTrace.install()");
  });

  // ExitTrace is Kotlin; a Java MainApplication could not call it as written.
  test("fails on a MainApplication that is not Kotlin", () => {
    expect(() =>
      hookMainApplication({ language: "java", contents: mainApplication }),
    ).toThrow(/Kotlin/);
  });
});

describe("withExitTrace", () => {
  test("fails when the config names no Android package to put the trace in", () => {
    expect(() => withExitTrace({ name: "Zipnami", slug: "zipnami" })).toThrow(
      /android\.package/,
    );
  });
});

describe("exitTraceSourcePath", () => {
  test("places the source in the package's directory of the app module", () => {
    expect(exitTraceSourcePath("io.github.kishimin.zipnami")).toBe(
      "app/src/main/java/io/github/kishimin/zipnami/ExitTrace.kt",
    );
  });
});
