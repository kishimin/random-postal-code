import { describe, expect, test } from "vitest";
import {
  allGuidePages,
  guideIndexPage,
} from "../../features/guides/guide-pages";
import { notFoundHeading } from "../document-title";
import { contentRoutePaths, pageMetadataFor } from "../page-metadata";
import { siteText } from "../site-text";
import { buildPages, type PrerenderedPage } from "./prerender-pages";

/*
 * What the build writes into each file Cloudflare Pages serves (Issue #169).
 * Rendered through the production route configuration (ADR-0011), the way the
 * build renders it, so a route added without a prerendered page fails here
 * and not only in a browser run against the built site.
 */
const pages = await buildPages();

const bodyOf = (page: PrerenderedPage) =>
  new DOMParser().parseFromString(page.body, "text/html");

const headingsOf = (page: PrerenderedPage) =>
  [...bodyOf(page).querySelectorAll("h1")].map((heading) =>
    heading.textContent.trim(),
  );

const contentPages = () => pages.filter(({ path }) => path !== null);

describe("buildPages", () => {
  // Pages serves /about from about.html without a redirect, and a nested route
  // from the same shape under its directory; the root is index.html.
  test("writes one file per content route, named the way Pages looks for it, and a 404.html", () => {
    expect(pages.map(({ file }) => file).sort()).toEqual(
      [
        "index.html",
        "about.html",
        "guide/postal-code.html",
        "guide/address.html",
        "guide/data.html",
        "guide/how-to-use.html",
        "guide.html",
        "guide/history.html",
        "guide/business-code.html",
        "guide/writing.html",
        "guide/barcode.html",
        "guide/municipality-code.html",
        "privacy.html",
        "404.html",
      ].sort(),
    );
  });

  test("renders exactly the content routes, which the sitemap lists", () => {
    expect(contentPages().map(({ path }) => path)).toEqual(contentRoutePaths);
  });

  test.each([...allGuidePages, guideIndexPage])("renders $path's own h1 and body text", (guide) => {
    const page = contentPages().find(({ path }) => path === guide.path);

    expect(page && headingsOf(page)).toEqual([guide.name]);
    expect(page?.body).toContain(guide.lead);
  });

  test("renders the privacy page's own h1", () => {
    const page = contentPages().find(({ path }) => path === "/privacy");

    expect(page && headingsOf(page)).toEqual([siteText.privacyLabel]);
  });

  test("renders the generator's start screen at the root", () => {
    const page = contentPages().find(({ path }) => path === "/");

    expect(page?.body).toContain("波に乗って");
    expect(page && headingsOf(page)).toHaveLength(1);
  });

  test("renders the site's frame, a main landmark included, on every page", () => {
    for (const page of pages) {
      expect(bodyOf(page).querySelectorAll("main"), page.file).toHaveLength(1);
    }
  });

  // Seven identical pages are what the crawler saw before.
  test("renders no two pages alike", () => {
    expect(new Set(pages.map(({ body }) => body)).size).toBe(pages.length);
  });

  test("gives each content page the metadata the screen keeps once the client has taken over", () => {
    for (const { path, metadata } of contentPages()) {
      expect(metadata).toEqual(pageMetadataFor(path ?? ""));
    }
  });

  // Only the result screen requests ads (#120), so no page ships its markup.
  test("renders no advertising region", () => {
    expect(pages.filter(({ body }) => /adsbygoogle/i.test(body))).toEqual([]);
  });

  test("renders the not-found screen for 404.html, with no address of its own", () => {
    const page = pages.find(({ file }) => file === "404.html");

    expect(page?.path).toBeNull();
    expect(page && headingsOf(page)).toEqual([notFoundHeading]);
    expect(page?.metadata.canonicalPath).toBeNull();
  });
});
