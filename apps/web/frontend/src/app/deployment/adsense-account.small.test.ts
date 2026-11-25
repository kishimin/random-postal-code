import { describe, expect, test } from "vitest";
import { DEV_ADSENSE_CLIENT_ID_PLACEHOLDER } from "../schemas/env.schema";
import { adSenseAccountFor } from "./adsense-account";

describe("adSenseAccountFor", () => {
  test("names the publisher the build is given", () => {
    expect(adSenseAccountFor("ca-pub-8746223957326560")).toBe(
      "ca-pub-8746223957326560",
    );
  });

  // A development build names no publisher, so it must not claim one.
  test("names nobody for the development placeholder", () => {
    expect(adSenseAccountFor(DEV_ADSENSE_CLIENT_ID_PLACEHOLDER)).toBeNull();
  });

  test.each([
    "pub-8746223957326560",
    "ca-pub-123",
    "ca-pub-8746223957326560\nx",
  ])("refuses a client ID that is not a publisher ID (%s)", (clientId) => {
    expect(() => adSenseAccountFor(clientId)).toThrow(/publisher ID/);
  });
});
