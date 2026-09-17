import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 5,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "Google Chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "Microsoft Edge",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
    },
    {
      name: "Safari",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "Android (Chrome)",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "iPhone (Safari)",
      use: { ...devices["iPhone 15"] },
    },
  ],
  webServer: [
    {
      command: "bun run preview",
      url: "http://localhost:4173",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "bun run storybook -- --ci",
      url: "http://localhost:6006",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
