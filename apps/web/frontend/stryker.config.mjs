/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: "npm",
  testRunner: "vitest",
  vitest: {
    configFile: "vite.config.ts",
    dir: ".",
    related: false,
  },
  reporters: ["html", "progress"],
  mutate: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.stories.{ts,tsx}",
    "!src/components/ui/**",
  ],
  thresholds: { high: 80, low: 60, break: 0 },
};
