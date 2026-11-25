import { describe, expect, test } from "vitest";
import { guidePages } from "../features/guides/guide-pages";
import { notFoundHeading } from "./document-title";
import {
  contentRoutePaths,
  pageMetadataFor,
  siteDescription,
} from "./page-metadata";
import { pageTitle, siteText } from "./site-text";

describe("contentRoutePaths", () => {
  test("lists the home page, the five guides and the privacy page", () => {
    expect([...contentRoutePaths].sort()).toEqual(
      [
        "/",
        "/about",
        "/guide/postal-code",
        "/guide/address",
        "/guide/data",
        "/guide/how-to-use",
        "/privacy",
      ].sort(),
    );
  });
});

describe("pageMetadataFor", () => {
  test("gives the home page the product name and the site's default description", () => {
    expect(pageMetadataFor("/")).toEqual({
      title: pageTitle(),
      description: siteDescription,
      canonicalPath: "/",
    });
  });

  test("gives the privacy page its own title and description", () => {
    const metadata = pageMetadataFor("/privacy");

    expect(metadata.title).toBe(pageTitle(siteText.privacyLabel));
    expect(metadata.canonicalPath).toBe("/privacy");
    expect(metadata.description).not.toBe("");
    expect(metadata.description).not.toBe(siteDescription);
  });

  test.each(guidePages)("gives $path the guide's own name and description", (page) => {
    expect(pageMetadataFor(page.path)).toEqual({
      title: pageTitle(page.name),
      description: page.description,
      canonicalPath: page.path,
    });
  });

  // Two pages with one description describe neither of them.
  test("gives no two content pages the same title or description", () => {
    const all = contentRoutePaths.map(pageMetadataFor);

    expect(new Set(all.map(({ description }) => description)).size).toBe(
      contentRoutePaths.length,
    );
    expect(new Set(all.map(({ title }) => title)).size).toBe(
      contentRoutePaths.length,
    );
  });

  // The not-found page is no address to index, so it names none.
  test("names no canonical path for a path no route claims", () => {
    expect(pageMetadataFor("/nonexistent")).toEqual({
      title: pageTitle(notFoundHeading),
      description: siteDescription,
      canonicalPath: null,
    });
  });
});
