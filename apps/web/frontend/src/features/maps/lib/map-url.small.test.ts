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

// Issue #99: an empty town, where Japan Post wrote a placeholder, leaves the
// query as prefecture and city with nothing trailing them.
describe("an address with an empty town", () => {
  const withoutTown: Address = {
    prefecture: "埼玉県",
    city: "草加市",
    town: "",
  };

  test("embeds a map queried by prefecture and city only", () => {
    const url = new URL(buildEmbedSrc(withoutTown, "test-key"));

    expect(url.searchParams.get("q")).toBe("埼玉県草加市");
  });

  test("links to a Google Maps search for prefecture and city only", () => {
    const url = new URL(buildExternalMapHref(withoutTown));

    expect(url.searchParams.get("query")).toBe("埼玉県草加市");
  });
});
