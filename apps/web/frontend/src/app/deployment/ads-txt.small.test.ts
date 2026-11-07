import { describe, expect, test } from "vitest";
import { DEV_ADSENSE_CLIENT_ID_PLACEHOLDER } from "../schemas/env.schema";
import { adsTxtFor } from "./ads-txt";

describe("adsTxtFor", () => {
  test("authorizes Google to sell the site's inventory for the publisher the ad code names", () => {
    expect(adsTxtFor("ca-pub-8746223957326560")).toBe(
      "google.com, pub-8746223957326560, DIRECT, f08c47fec0942fa0\n",
    );
  });

  // A build without a real publisher (development, the PR workflow's
  // placeholder build) must not publish an ads.txt naming a seller that does
  // not exist; it publishes none.
  test("publishes nothing for the development placeholder", () => {
    expect(adsTxtFor(DEV_ADSENSE_CLIENT_ID_PLACEHOLDER)).toBeNull();
  });

  test.each([
    "pub-8746223957326560",
    "ca-pub-123",
    "ca-pub-8746223957326560\nx",
  ])("refuses a client ID that is not a publisher ID (%s)", (clientId) => {
    expect(() => adsTxtFor(clientId)).toThrow(/publisher ID/);
  });
});
