import { describe, expect, test } from "vitest";
import {
  applyInitialDocumentTitle,
  notFoundHeading,
  titleForPathname,
} from "./document-title";
import { siteText } from "./site-text";

describe("titleForPathname", () => {
  test("names the product for the generator's path", () => {
    expect(titleForPathname("/")).toBe(siteText.name);
  });

  test("names the privacy screen for its path", () => {
    expect(titleForPathname("/privacy")).toBe(
      `${siteText.privacyLabel} | ${siteText.name}`,
    );
  });

  test("names the not-found screen for any other path", () => {
    expect(titleForPathname("/this-path-does-not-exist")).toBe(
      `${notFoundHeading} | ${siteText.name}`,
    );
  });

  // Codex review on this PR: app-router.tsx sets no trailingSlash option, so
  // createRouter's "never" default resolves "/privacy/" to the same route as
  // "/privacy" -- this guess must agree, or a direct navigation to the
  // slashed form would show the not-found title for a moment.
  test("names the privacy screen for its path with a trailing slash too", () => {
    expect(titleForPathname("/privacy/")).toBe(
      `${siteText.privacyLabel} | ${siteText.name}`,
    );
  });

  // Issue #121: the same early guess has to name each guide, or WebKit's
  // direct navigation would read the not-found title until the route mounts.
  test.each([
    ["/about", "サイトについて"],
    ["/guide/postal-code", "郵便番号のしくみ"],
    ["/guide/address", "郵便番号と住所"],
    ["/guide/data", "データについて"],
    ["/guide/how-to-use", "使い方"],
  ])("names the guide at %s as %s", (pathname, name) => {
    expect(titleForPathname(pathname)).toBe(`${name} | ${siteText.name}`);
    expect(titleForPathname(`${pathname}/`)).toBe(`${name} | ${siteText.name}`);
  });
});

describe("applyInitialDocumentTitle", () => {
  // TR-002 (test review): titleForPathname's own logic was already covered
  // above, but nothing exercised the one statement in main.tsx that actually
  // writes it to document.title -- the wiring this function now is.
  test("writes titleForPathname's guess for the given path to document.title", () => {
    applyInitialDocumentTitle("/privacy");

    expect(document.title).toBe(`${siteText.privacyLabel} | ${siteText.name}`);
  });
});
