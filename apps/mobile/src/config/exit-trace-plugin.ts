import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ConfigPlugin } from "expo/config-plugins";
import { withDangerousMod, withMainApplication } from "expo/config-plugins";

/*
 * The diagnostic build of Issue #173. The production build exits by itself
 * on its first launches after install, and logcat records only
 * "System.exit called, status: 0", with no caller. This plugin adds a
 * shutdown hook that logs the stack of the thread inside Runtime.exit, so
 * one logcat from the owner's device names the component that exits.
 *
 * A shutdown hook rather than a SecurityManager: Android refuses to install
 * a SecurityManager, while Runtime.exit still starts every hook and waits for
 * it before the process ends.
 */

const hookCall = "ExitTrace.install()";
const superOnCreate = /^([ \t]*)super\.onCreate\(\)[ \t]*$/m;

/**
 * Calls the trace right after the application's super.onCreate().
 * @param {string} mainApplication - MainApplication.kt as prebuild wrote it.
 * @returns {string} The source with the trace installed once.
 */
export const installExitTrace = (mainApplication: string): string => {
  if (mainApplication.includes(hookCall)) {
    return mainApplication;
  }
  const match = superOnCreate.exec(mainApplication);
  if (match === null) {
    throw new Error(
      "Issue #173 exit trace: MainApplication.kt has no super.onCreate() to install the trace after.",
    );
  }
  const [line, indent] = match;
  const end = match.index + line.length;
  return `${mainApplication.slice(0, end)}\n${indent ?? ""}${hookCall}${mainApplication.slice(end)}`;
};

/**
 * Installs the trace into the MainApplication file a mod hands over.
 * @param {T} file - The MainApplication file and its language.
 * @returns {T} The same file with the trace installed.
 */
export const hookMainApplication = <
  T extends { language: string; contents: string },
>(
  file: T,
): T => {
  if (file.language !== "kt") {
    throw new Error(
      `Issue #173 exit trace: ExitTrace is Kotlin, but MainApplication is ${file.language}.`,
    );
  }
  return { ...file, contents: installExitTrace(file.contents) };
};

/**
 * The Kotlin source of the trace.
 * @param {string} packageName - The application's Android package.
 * @returns {string} ExitTrace.kt.
 */
export const exitTraceSource = (packageName: string): string => `package ${packageName}

import android.util.Log

// Diagnostic EAS profile only (Issue #173). Logs who calls System.exit.
object ExitTrace {
  private const val TAG = "ZipnamiExitTrace"

  fun install() {
    Log.i(TAG, "Installed. The caller of System.exit is logged under this tag.")
    Runtime.getRuntime().addShutdownHook(Thread(Runnable { logExitCallers() }, TAG))
  }

  private fun callsExit(frames: Array<StackTraceElement>): Boolean =
    frames.any { frame -> frame.className == "java.lang.Runtime" && frame.methodName == "exit" }

  private fun logExitCallers() {
    val stacks = Thread.getAllStackTraces().filterKeys { it !== Thread.currentThread() }
    val exiting = stacks.filterValues { callsExit(it) }
    if (exiting.isEmpty()) {
      Log.e(TAG, "No thread is inside Runtime.exit. Every thread follows.")
    }
    val shown = if (exiting.isEmpty()) stacks else exiting
    for ((thread, frames) in shown) {
      Log.e(TAG, "Stack of thread \\"\${thread.name}\\":")
      for (frame in frames) {
        Log.e(TAG, "    at $frame")
      }
    }
  }
}
`;

/**
 * Where the trace's source goes, relative to the android directory.
 * @param {string} packageName - The application's Android package.
 * @returns {string} The path of ExitTrace.kt.
 */
export const exitTraceSourcePath = (packageName: string): string =>
  `app/src/main/java/${packageName.replaceAll(".", "/")}/ExitTrace.kt`;

/**
 * Writes ExitTrace.kt into a generated android project.
 * @param {string} androidRoot - The android directory prebuild generated.
 * @param {string} packageName - The application's Android package.
 * @returns {Promise<void>} Resolves once the file is written.
 */
export const writeExitTraceSource = async (
  androidRoot: string,
  packageName: string,
): Promise<void> => {
  const file = path.join(androidRoot, exitTraceSourcePath(packageName));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, exitTraceSource(packageName));
};

/**
 * Adds the System.exit trace to the Android build.
 * @param {object} config - The resolved Expo config.
 * @returns {object} The config with the two mods that add the trace.
 */
export const withExitTrace: ConfigPlugin = (config) => {
  const packageName = config.android?.package;
  if (packageName === undefined || packageName === "") {
    throw new Error(
      "Issue #173 exit trace: the config has no android.package to put ExitTrace in.",
    );
  }
  const hooked = withMainApplication(config, (mod) => ({
    ...mod,
    modResults: hookMainApplication(mod.modResults),
  }));
  return withDangerousMod(hooked, [
    "android",
    async (mod) => {
      await writeExitTraceSource(
        mod.modRequest.platformProjectRoot,
        packageName,
      );
      return mod;
    },
  ]);
};
