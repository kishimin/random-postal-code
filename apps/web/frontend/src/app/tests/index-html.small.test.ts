import { describe, expect, test } from "vitest";
import indexHtml from "../../../index.html?raw";
import { siteDescription } from "../page-metadata";

/*
 * index.html is the template every prerendered page is made from (Issue #169)
 * and what the dev server serves, so the description it carries is the site's
 * default: what a page that sets nothing of its own tells a crawler, and what
 * leaving a guide restores (use-meta-description.ts). It is held equal to the
 * constant the application uses, so the two cannot drift.
 */
describe("index.html", () => {
  test("ships the site's default description", () => {
    const document = new DOMParser().parseFromString(indexHtml, "text/html");

    // Read as an attribute rather than matched with toHaveAttribute: the
    // parsed document is a separate realm, so jest-dom does not accept its
    // elements.
    expect(
      document.head
        .querySelector('meta[name="description"]')
        ?.getAttribute("content"),
    ).toBe(siteDescription);
  });
});
