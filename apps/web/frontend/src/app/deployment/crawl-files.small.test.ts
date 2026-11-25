import { describe, expect, test } from "vitest";
import { robotsTxtFor, sitemapXmlFor } from "./crawl-files";
import { canonicalUrlOf, PRODUCTION_ORIGIN } from "./site-origin";

describe("canonicalUrlOf", () => {
  test("puts a route on the production origin", () => {
    expect(canonicalUrlOf("/about")).toBe("https://zipnami.pages.dev/about");
  });

  // The root is written with its slash, so the home page has one address only.
  test("writes the root with its slash", () => {
    expect(canonicalUrlOf("/")).toBe(`${PRODUCTION_ORIGIN}/`);
  });
});

describe("robotsTxtFor", () => {
  test("allows every crawler and names the sitemap", () => {
    expect(robotsTxtFor("https://zipnami.pages.dev/sitemap.xml")).toBe(
      [
        "User-agent: *",
        "Allow: /",
        "Sitemap: https://zipnami.pages.dev/sitemap.xml",
        "",
      ].join("\n"),
    );
  });
});

describe("sitemapXmlFor", () => {
  test("lists exactly the given routes as absolute URLs", () => {
    const sitemap = sitemapXmlFor(["/", "/guide/data"]);

    expect(sitemap).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(
      [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map(([, url]) => url),
    ).toEqual([
      "https://zipnami.pages.dev/",
      "https://zipnami.pages.dev/guide/data",
    ]);
  });

  test("starts with an XML declaration", () => {
    expect(
      sitemapXmlFor(["/"]).startsWith('<?xml version="1.0" encoding="UTF-8"?>'),
    ).toBe(true);
  });
});
