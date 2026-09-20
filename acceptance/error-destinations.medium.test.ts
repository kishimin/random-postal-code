import { expect, test } from "./fixtures";

/*
 * Acceptance test for Issue #26: unknown-route and global error screens.
 *
 * Only the unknown path is exercised here. The global error screen answers a
 * thrown render failure, which a browser cannot provoke without a route that
 * exists to throw; that criterion is held by a test at the router boundary
 * instead.
 *
 * The Issue's out-of-scope list — Android screens, partial failures inside a
 * rendered result, and API retry states — is not touched.
 */
test.describe("Issue #26: error destinations", () => {
  test("an unknown path reaches the not-found screen rather than the generator", async ({
    notFoundPage,
  }) => {
    await notFoundPage.navigate();

    await expect(notFoundPage.heading()).toBeVisible();
  });

  test("the not-found screen offers a way back to the generator", async ({
    notFoundPage,
  }) => {
    await notFoundPage.navigate();

    await expect(notFoundPage.backToGeneratorLink()).toBeVisible();
  });

  test("the not-found screen keeps the header and the footer attribution", async ({
    notFoundPage,
  }) => {
    await notFoundPage.navigate();

    await expect(notFoundPage.header()).toBeVisible();
    await expect(notFoundPage.footer()).toBeVisible();
    await expect(notFoundPage.attribution()).toBeVisible();
  });

  test("the not-found screen requires no horizontal scrolling at a 320px viewport", async ({
    generatorPage,
    notFoundPage,
  }) => {
    await generatorPage.resizeToNarrowPhone();
    await notFoundPage.navigate();

    await expect(notFoundPage.heading()).toBeVisible();
    expect(await notFoundPage.hasHorizontalOverflow()).toBe(false);
  });
});
