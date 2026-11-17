import { describe, expect, test } from "vitest";
import { buildExternalMapHref, fullAddressText } from "./map-url";

const address = { prefecture: "東京都", city: "千代田区", town: "千代田" };

describe("fullAddressText", () => {
  test("joins prefecture, city and town without a separator", () => {
    expect(fullAddressText(address)).toBe("東京都千代田区千代田");
  });
});

describe("buildExternalMapHref", () => {
  test("opens a Google Maps search for the full address", () => {
    const href = buildExternalMapHref(address);

    expect(href).toMatch(
      /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/,
    );
    expect(new URL(href).searchParams.get("query")).toBe(
      "東京都千代田区千代田",
    );
  });

  test("percent-encodes the address so it never appears as written", () => {
    expect(buildExternalMapHref(address)).not.toContain("東京都");
  });

  test("encodes characters that would end the query early", () => {
    const href = buildExternalMapHref({ ...address, town: "A&B #1" });

    expect(new URL(href).searchParams.get("query")).toBe(
      "東京都千代田区A&B #1",
    );
  });
});
