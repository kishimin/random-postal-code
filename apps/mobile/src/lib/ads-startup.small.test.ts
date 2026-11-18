import { describe, expect, test } from "vitest";
import { startAds, type AdsPorts } from "./ads-startup";

type Overrides = Partial<AdsPorts>;

/**
 * Ports that answer "everything allowed" and write the order they were called
 * in to `calls`.
 * @param {string[]} calls - Where each step records its name.
 * @param {Overrides} overrides - Steps to replace for one scenario.
 * @returns {AdsPorts} The ports.
 */
const portsRecordingTo = (
  calls: string[],
  overrides: Overrides = {},
): AdsPorts => ({
  gatherConsent: () => {
    calls.push("consent");
    return Promise.resolve({ canRequestAds: true, status: "OBTAINED" });
  },
  choosesPersonalisedAds: () => {
    calls.push("choices");
    return Promise.resolve(true);
  },
  askTracking: () => {
    calls.push("tracking");
    return Promise.resolve(true);
  },
  initialize: () => {
    calls.push("initialize");
    return Promise.resolve();
  },
  ...overrides,
});

describe("startAds", () => {
  test("asks consent, then tracking, then starts the SDK, and allows ads", async () => {
    const calls: string[] = [];

    const result = await startAds(portsRecordingTo(calls));

    expect(calls).toEqual(["consent", "choices", "tracking", "initialize"]);
    expect(result).toEqual({ status: "ready", nonPersonalizedOnly: false });
  });

  test("skips the tracking prompt where the platform has none", async () => {
    const calls: string[] = [];

    const result = await startAds(
      portsRecordingTo(calls, { askTracking: undefined }),
    );

    expect(calls).toEqual(["consent", "choices", "initialize"]);
    expect(result).toEqual({ status: "ready", nonPersonalizedOnly: false });
  });

  describe("when ads cannot be requested after the consent flow", () => {
    test("shows no ad and goes no further", async () => {
      const calls: string[] = [];

      const result = await startAds(
        portsRecordingTo(calls, {
          gatherConsent: () =>
            Promise.resolve({ canRequestAds: false, status: "REQUIRED" }),
        }),
      );

      expect(result).toEqual({ status: "unavailable" });
      expect(calls).toEqual([]);
    });
  });

  describe("when a step fails", () => {
    test("shows no ad when the consent flow fails, and never reaches the SDK", async () => {
      const calls: string[] = [];

      const result = await startAds(
        portsRecordingTo(calls, {
          gatherConsent: () => Promise.reject(new Error("no consent info")),
        }),
      );

      expect(result).toEqual({ status: "unavailable" });
      expect(calls).toEqual([]);
    });

    test("shows no ad when the SDK fails to start", async () => {
      const result = await startAds(
        portsRecordingTo([], {
          initialize: () => Promise.reject(new Error("failed to start")),
        }),
      );

      expect(result).toEqual({ status: "unavailable" });
    });

    test("falls back to non-personalised ads when the tracking prompt fails", async () => {
      const calls: string[] = [];

      const result = await startAds(
        portsRecordingTo(calls, {
          askTracking: () => Promise.reject(new Error("no prompt")),
        }),
      );

      expect(calls).toContain("initialize");
      expect(result).toEqual({ status: "ready", nonPersonalizedOnly: true });
    });
  });

  describe("personalisation", () => {
    test("is declined when the person denies tracking", async () => {
      const result = await startAds(
        portsRecordingTo([], { askTracking: () => Promise.resolve(false) }),
      );

      expect(result).toEqual({ status: "ready", nonPersonalizedOnly: true });
    });

    test("is declined when the person refuses it in the consent form", async () => {
      const result = await startAds(
        portsRecordingTo([], {
          choosesPersonalisedAds: () => Promise.resolve(false),
        }),
      );

      expect(result).toEqual({ status: "ready", nonPersonalizedOnly: true });
    });

    test("is declined when the choices cannot be read after consent was obtained", async () => {
      const result = await startAds(
        portsRecordingTo([], {
          choosesPersonalisedAds: () => Promise.reject(new Error("unreadable")),
        }),
      );

      expect(result).toEqual({ status: "ready", nonPersonalizedOnly: true });
    });

    // Only NOT_REQUIRED means the form never ran. Any other status, one this
    // code does not know included, may have a stored refusal behind it.
    test.each(["OBTAINED", "REQUIRED", "UNKNOWN", "SOMETHING_NEW"])(
      "honours the form's choices when the consent status is %s",
      async (status) => {
        const calls: string[] = [];

        const result = await startAds(
          portsRecordingTo(calls, {
            gatherConsent: () =>
              Promise.resolve({ canRequestAds: true, status }),
            choosesPersonalisedAds: () => {
              calls.push("choices");
              return Promise.resolve(false);
            },
          }),
        );

        expect(calls).toContain("choices");
        expect(result).toEqual({ status: "ready", nonPersonalizedOnly: true });
      },
    );

    // Where no consent is needed the form never ran, so there are no
    // choices to honour and none are read.
    test("does not consult the form's choices when consent is not required", async () => {
      const calls: string[] = [];

      const result = await startAds(
        portsRecordingTo(calls, {
          gatherConsent: () => {
            calls.push("consent");
            return Promise.resolve({
              canRequestAds: true,
              status: "NOT_REQUIRED",
            });
          },
          choosesPersonalisedAds: () => Promise.resolve(false),
        }),
      );

      expect(calls).not.toContain("choices");
      expect(result).toEqual({ status: "ready", nonPersonalizedOnly: false });
    });
  });
});
