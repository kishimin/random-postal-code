/*
 * Screen tests render React Native, which Vitest cannot (Issue #13, option
 * A): Jest with the jest-expo presets runs them, and Vitest keeps the logic
 * tests and the export-based acceptance tests. Each screen test runs twice,
 * once as iOS and once as Android, because every mobile Issue holds for both
 * platforms (docs/design.md section 6.3). jest-expo/universal is not used:
 * it adds a Web project, and the app does not ship to Web.
 */

/** @type {import('jest').Config} */
const shared = {
  rootDir: __dirname,
  // The acceptance tests sit outside every package (ADR-0062).
  roots: ["<rootDir>/src", "<rootDir>/../../acceptance"],
  // An acceptance test resolves packages from acceptance/, and bun links
  // this package's dependencies only under apps/mobile/node_modules.
  modulePaths: ["<rootDir>/node_modules"],
  // Globs rather than <rootDir> paths: Jest does not normalise the `..` of
  // a <rootDir>-relative pattern, so the acceptance directory never matched.
  testMatch: [
    "**/apps/mobile/src/**/*.medium.test.tsx",
    "**/acceptance/mobile-*.medium.test.tsx",
  ],
  // jest-expo's own pattern, plus bun's isolated layout. bun keeps each
  // package at node_modules/.bun/<name>@<version>/node_modules/<name>, so the
  // first node_modules is followed by `.bun/`, which jest-expo's allowlist
  // does not name, and React Native's untranspiled sources were never
  // transformed. Letting `.bun/` through hands the decision to the second,
  // inner node_modules, where the allowlist applies as usual.
  // standard-navigation is Expo Router's ESM-only navigation core.
  transformIgnorePatterns: [
    "/node_modules/(?!\\.bun/|((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@testing-library/.*|test-renderer|standard-navigation)",
  ],
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    { ...shared, displayName: "ios", preset: "jest-expo/ios" },
    { ...shared, displayName: "android", preset: "jest-expo/android" },
  ],
};
