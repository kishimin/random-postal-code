import type { Address } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import { buildEmbedSrc, buildExternalMapHref } from "./map-url";

const address: Address = {
  prefecture: "東京都",
  city: "千代田区",
  town: "千代田",
};

describe("buildEmbedSrc", () => {
  test("points at the Google Maps Embed API with the given key and an address query naming every field", () => {
    const src = buildEmbedSrc(address, "test-key");
    const url = new URL(src);

    expect(url.hostname).toBe("www.google.com");
    expect(url.pathname).toBe("/maps/embed/v1/place");
    expect(url.searchParams.get("key")).toBe("test-key");

    const query = url.searchParams.get("q");
    expect(query).toContain(address.prefecture);
    expect(query).toContain(address.city);
    expect(query).toContain(address.town);
  });
});

describe("buildExternalMapHref", () => {
  test("points at a Google Maps search with an encoded query naming every field", () => {
    const href = buildExternalMapHref(address);
    const url = new URL(href);

    expect(url.hostname).toBe("www.google.com");

    const query = url.searchParams.get("query");
    expect(query).toContain(address.prefecture);
    expect(query).toContain(address.city);
    expect(query).toContain(address.town);

    // acceptance/selectors/map-selectors.ts reads the raw href, so the
    // criterion "an encoded address query" only holds if the town's literal
    // text never appears in the unparsed string -- a link that inlined the
    // address would decode to the same query without ever having encoded it.
    expect(href.includes(address.town)).toBe(false);
  });
});
