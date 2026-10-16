import { describe, expect, test } from "vitest";
import { problemsWithFrontendDeploySettings } from "./deploy-settings";

const valid = {
  VITE_API_BASE_URL: "https://zipnami-api.example.workers.dev",
  VITE_GOOGLE_ADSENSE_CLIENT_ID: "ca-pub-1234567890123456",
  VITE_GOOGLE_ADSENSE_SLOT_ID: "9876543210",
  VITE_ADSENSE_TEST_MODE: "false",
};

describe("problemsWithFrontendDeploySettings", () => {
  test("accepts complete production settings", () => {
    expect(problemsWithFrontendDeploySettings(valid)).toEqual([]);
  });

  test.each([
    ["VITE_API_BASE_URL", undefined],
    ["VITE_API_BASE_URL", "http://zipnami-api.example.workers.dev"],
    ["VITE_API_BASE_URL", "not a url"],
    ["VITE_GOOGLE_ADSENSE_CLIENT_ID", undefined],
    ["VITE_GOOGLE_ADSENSE_CLIENT_ID", "ca-pub-0000000000000000"],
    ["VITE_GOOGLE_ADSENSE_CLIENT_ID", "pub-1234567890123456"],
    ["VITE_GOOGLE_ADSENSE_SLOT_ID", undefined],
    ["VITE_GOOGLE_ADSENSE_SLOT_ID", "0000000000"],
    ["VITE_GOOGLE_ADSENSE_SLOT_ID", "slot-1"],
    ["VITE_ADSENSE_TEST_MODE", undefined],
    ["VITE_ADSENSE_TEST_MODE", "true"],
  ])("refuses %s set to %s", (name, value) => {
    const problems = problemsWithFrontendDeploySettings({
      ...valid,
      [name]: value,
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(name);
  });

  test("reports every unusable setting at once, not only the first", () => {
    expect(problemsWithFrontendDeploySettings({})).toHaveLength(4);
  });

  test("never repeats a value it checked", () => {
    const settings = {
      ...valid,
      VITE_API_BASE_URL: "http://internal-looking-host.example",
      VITE_GOOGLE_ADSENSE_CLIENT_ID: "ca-pub-0000000000000000",
    };

    const reported = problemsWithFrontendDeploySettings(settings).join(" ");

    expect(reported).not.toContain(settings.VITE_API_BASE_URL);
    expect(reported).not.toContain(settings.VITE_GOOGLE_ADSENSE_CLIENT_ID);
  });
});
