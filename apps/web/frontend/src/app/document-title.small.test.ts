import { describe, expect, test } from "vitest";
import { notFoundHeading, titleForPathname } from "./document-title";
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
});
