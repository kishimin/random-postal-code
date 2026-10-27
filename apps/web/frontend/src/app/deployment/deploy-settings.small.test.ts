import { describe, expect, test } from "vitest";
import { problemsWithFrontendDeploySettings } from "./deploy-settings";

const valid = {
  VITE_API_BASE_URL: "https://zipnami-api.example.workers.dev",
  VITE_GOOGLE_ADSENSE_CLIENT_ID: "ca-pub-1234567890123456",
  VITE_GOOGLE_ADSENSE_SLOT_ID: "9876543210",
  VITE_ADSENSE_TEST_MODE: "false",
  VITE_GOOGLE_MAPS_API_KEY: "AIzaSy0123456789abcdefghijklmnopqrstuvw",
};

describe("problemsWithFrontendDeploySettings", () => {
  test("accepts complete production settings", () => {
    expect(problemsWithFrontendDeploySettings(valid)).toEqual([]);
  });

  test.each([
    // GitHub Actions passes an unset `vars.X` as "", not as undefined.
    ["VITE_API_BASE_URL", undefined],
    ["VITE_API_BASE_URL", ""],
    ["VITE_API_BASE_URL", "http://zipnami-api.example.workers.dev"],
    ["VITE_API_BASE_URL", "not a url"],
    ["VITE_GOOGLE_ADSENSE_CLIENT_ID", undefined],
    ["VITE_GOOGLE_ADSENSE_CLIENT_ID", "ca-pub-0000000000000000"],
    ["VITE_GOOGLE_ADSENSE_CLIENT_ID", ""],
    ["VITE_GOOGLE_ADSENSE_CLIENT_ID", "pub-1234567890123456"],
    ["VITE_GOOGLE_ADSENSE_CLIENT_ID", "ca-pub-123456789012345"],
    ["VITE_GOOGLE_ADSENSE_CLIENT_ID", "ca-pub-12345678901234567"],
    ["VITE_GOOGLE_ADSENSE_SLOT_ID", undefined],
    ["VITE_GOOGLE_ADSENSE_SLOT_ID", "0000000000"],
    ["VITE_GOOGLE_ADSENSE_SLOT_ID", ""],
    ["VITE_GOOGLE_ADSENSE_SLOT_ID", "slot-1"],
    ["VITE_ADSENSE_TEST_MODE", undefined],
    ["VITE_ADSENSE_TEST_MODE", ""],
    ["VITE_ADSENSE_TEST_MODE", "true"],
    ["VITE_GOOGLE_MAPS_API_KEY", undefined],
    ["VITE_GOOGLE_MAPS_API_KEY", ""],
    ["VITE_GOOGLE_MAPS_API_KEY", "   "],
    // The values CI and the Large E2E run use in place of a real key.
    ["VITE_GOOGLE_MAPS_API_KEY", "ci-placeholder-maps-key"],
    ["VITE_GOOGLE_MAPS_API_KEY", "large-test-placeholder-maps-key"],
    // A Google browser key is "AIza" followed by 35 characters.
    ["VITE_GOOGLE_MAPS_API_KEY", "AIzaSy0123456789abcdefghijklmnopqrstu"],
    ["VITE_GOOGLE_MAPS_API_KEY", "AIzaSy0123456789abcdefghijklmnopqrstuvwx"],
    ["VITE_GOOGLE_MAPS_API_KEY", "AIzaSy0123456789abcdefghijklmnopqrstu v"],
  ])("refuses %s set to %s", (name, value) => {
    const problems = problemsWithFrontendDeploySettings({
      ...valid,
      [name]: value,
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(name);
  });

  test("reports every unusable setting at once, not only the first", () => {
    const problems = problemsWithFrontendDeploySettings({});

    for (const name of [
      "VITE_API_BASE_URL",
      "VITE_GOOGLE_ADSENSE_CLIENT_ID",
      "VITE_GOOGLE_ADSENSE_SLOT_ID",
      "VITE_ADSENSE_TEST_MODE",
      "VITE_GOOGLE_MAPS_API_KEY",
    ]) {
      expect(problems.filter((problem) => problem.includes(name))).toHaveLength(
        1,
      );
    }
  });

  test("never repeats a value it checked", () => {
    const settings = {
      ...valid,
      VITE_API_BASE_URL: "http://internal-looking-host.example",
      VITE_GOOGLE_ADSENSE_CLIENT_ID: "ca-pub-0000000000000000",
      VITE_GOOGLE_MAPS_API_KEY: "ci-placeholder-maps-key",
    };

    const reported = problemsWithFrontendDeploySettings(settings).join(" ");

    expect(reported).not.toContain(settings.VITE_API_BASE_URL);
    expect(reported).not.toContain(settings.VITE_GOOGLE_ADSENSE_CLIENT_ID);
    expect(reported).not.toContain(settings.VITE_GOOGLE_MAPS_API_KEY);
  });
});
