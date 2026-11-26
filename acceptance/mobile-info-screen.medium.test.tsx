import { describe, expect, jest, test } from "@jest/globals";
import path from "node:path";

/*
 * Acceptance test for Issue #175: the 「Zipnami について」 screen no longer
 * shows the API's address.
 *
 * Each test name starts with the criterion it holds (AC-1, AC-2). AC-3
 * (generation still calls `${EXPO_PUBLIC_API_BASE_URL}/api/random`) is
 * already held by Issue #13's mobile-random-postal-code.medium.test.tsx and
 * the bundle check of mobile-expo-foundation.medium.test.ts, so it is not
 * repeated here.
 *
 * How the screen is exercised
 * ---------------------------
 * The API origin is inlined when the app is built, so "any build" is the
 * screen loaded once with EXPO_PUBLIC_API_BASE_URL set and once without it.
 * Each load happens in its own module registry (jest.isolateModules), so the
 * configuration is read afresh, the way a separate build reads it.
 *
 * React, React Native's components and the Testing Library are taken from
 * that same registry, so the screen and its renderer share one copy of
 * React. They are required while each `describe` block is collected, not
 * inside a test: the Testing Library registers its cleanup hooks when it is
 * loaded, and Jest accepts hooks only at collection time.
 *
 * The route file is the one that ships, apps/mobile/src/app/info.tsx.
 */

const infoRoute = path.resolve(
  __dirname,
  "..",
  "apps",
  "mobile",
  "src",
  "app",
  "info.tsx",
);

const apiBaseUrl = "https://api.zipnami-acceptance.example";

type Library = typeof import("@testing-library/react-native");

/**
 * Loads the information route the way a build with this API origin would,
 * and returns a function that renders it.
 */
const loadInfoRoute = (
  configuredOrigin: string | undefined,
): { render: () => ReturnType<Library["render"]> } => {
  const originalOrigin = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configuredOrigin === undefined) {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  } else {
    process.env.EXPO_PUBLIC_API_BASE_URL = configuredOrigin;
  }
  let loaded: { render: () => ReturnType<Library["render"]> } | undefined;
  try {
    jest.isolateModules(() => {
      const react = require("react") as typeof import("react");
      const library = require("@testing-library/react-native") as Library;
      const route = require(infoRoute) as {
        default: () => React.ReactElement;
      };
      loaded = {
        // The result's own queries, not `screen`: `screen` is rebound only
        // after an awaited render.
        render: () => library.render(react.createElement(route.default)),
      };
    });
  } finally {
    // The route has read the variable; later files see the original value.
    if (originalOrigin === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = originalOrigin;
    }
  }
  if (loaded === undefined) {
    throw new Error("the information route did not load");
  }
  return loaded;
};

describe.each([
  ["with the API origin configured", apiBaseUrl],
  ["with the API origin unset", undefined],
])("Issue #175: the information screen %s", (_, configuredOrigin) => {
  const info = loadInfoRoute(configuredOrigin);

  test("AC-1 the screen shows neither the API origin nor 「API:」", async () => {
    const screen = await info.render();
    expect(screen.queryAllByText(/API:/)).toEqual([]);
    expect(screen.queryAllByText(/zipnami-acceptance\.example/)).toEqual([]);
    expect(screen.queryAllByText(/未設定/)).toEqual([]);
  });

  test("AC-2 the description, the example postal code and the Japan Post attribution stay", async () => {
    const screen = await info.render();
    expect(
      screen.getByText(
        "Zipnamiは、日本の郵便番号をランダムに1つ表示するアプリです。",
      ),
    ).toBeTruthy();
    expect(screen.getByText(/〒100-0001/)).toBeTruthy();
    expect(screen.getByText(/日本郵便株式会社/)).toBeTruthy();
  });
});
