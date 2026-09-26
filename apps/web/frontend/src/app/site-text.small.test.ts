import { describe, expect, test } from "vitest";
import { pageTitle, siteText } from "./site-text";

describe("pageTitle", () => {
  // The generator is the product's home screen; ui-design.md names no
  // screen-specific title for it, so its title is the product name alone.
  test("names only the product when no page name is given", () => {
    expect(pageTitle()).toBe(siteText.name);
  });

  // WCAG 2.4.2: every other screen names itself first, so two open tabs read
  // differently, while still carrying the product name a visitor recognises.
  test("puts the given page name ahead of the product name", () => {
    expect(pageTitle("プライバシーポリシー")).toBe(
      `プライバシーポリシー | ${siteText.name}`,
    );
  });

  test("gives two different page names two different titles", () => {
    expect(pageTitle("プライバシーポリシー")).not.toBe(
      pageTitle("ページが見つかりません"),
    );
  });
});
