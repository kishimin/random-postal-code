import { expect, test } from "./fixtures/test.ts";
import { shellSelectors } from "./selectors/shell-selectors.ts";

/*
 * Acceptance test for Issue #5: Create the Cloudflare Pages React frontend
 * foundation.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * The Issue's Out of scope section — random result behavior, maps,
 * advertisements, and production deployment — is deliberately not exercised
 * here. Verifying it would pull the implementation past the Issue's boundary.
 *
 * Criteria that are not user-observable (where files live, that the API base
 * URL is read from a validated variable) are held by the build, the type check,
 * and unit tests instead. A browser cannot observe a directory layout.
 */
test.describe("Issue #5: frontend foundation", () => {
  test("the initial shell exposes a main landmark and an accessible document title", async ({
    generatorPage,
  }) => {
    await generatorPage.navigate();

    await expect(generatorPage.main()).toBeVisible();
    expect(await generatorPage.documentTitle()).toMatch(
      shellSelectors.siteName,
    );
  });

  test("a deep link to /privacy resolves through the SPA fallback instead of returning a not-found page", async ({
    privacyPage,
  }) => {
    const response = await privacyPage.navigate();

    expect(response?.status()).toBe(200);
    await expect(privacyPage.main()).toBeVisible();
    await expect(privacyPage.heading()).toBeVisible();
  });

  test("no primary content requires horizontal scrolling at a 320px viewport", async ({
    generatorPage,
  }) => {
    await generatorPage.resizeToNarrowPhone();
    await generatorPage.navigate();

    await expect(generatorPage.main()).toBeVisible();
    expect(await generatorPage.hasHorizontalOverflow()).toBe(false);
  });
});
