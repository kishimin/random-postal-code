import { expect, test as shellTest } from "./fixtures";
import {
  createHeaderLogoPage,
  type HeaderLogoPage,
} from "./pages/header-logo-page.ts";

/*
 * Acceptance test for Issue #113: Show the Figma logo before the wordmark in
 * the header.
 *
 * Held here, on the generator, the privacy page, and the not-found screen:
 * the header shows a loaded logo immediately before the ZIPNAMI wordmark,
 * fetched from the site's own origin as an SVG; the image is decorative (no
 * text alternative, not exposed as an image, no focus stop of its own); and
 * the header link is still named exactly ZIPNAMI.
 *
 * Not held here:
 *
 *   - The global error screen. A browser cannot be driven to the render
 *     failure that shows it (ui-design.md section 10). It shares AppFrame
 *     with every other screen, and the frontend's own test of AppErrorView
 *     holds its header.
 *   - That the file is the export of Figma node 51:361, and how the header
 *     compares with Figma. The Issue leaves the comparison to a person, and a
 *     test that compared pixels would only restate the file.
 *   - "The existing acceptance tests pass unchanged": the rest of this
 *     directory, run as it stands.
 */

const screens = [
  { name: "the generator", path: "/" },
  { name: "the privacy page", path: "/privacy" },
  { name: "the not-found screen", path: "/no-such-page-113" },
] as const;

const test = shellTest.extend<{ headerLogoPage: HeaderLogoPage }>({
  headerLogoPage: async ({ page }, use) => {
    await use(createHeaderLogoPage(page));
  },
});

test.describe("Issue #113: the logo in the header", () => {
  for (const screen of screens) {
    test(`on ${screen.name}, the header shows the logo immediately before the ZIPNAMI wordmark`, async ({
      headerLogoPage,
    }) => {
      await headerLogoPage.isolateFromGoogle();
      await headerLogoPage.navigate(screen.path);

      await expect(headerLogoPage.wordmark()).toBeVisible();
      await expect(headerLogoPage.logo()).toHaveCount(1);
      await expect(headerLogoPage.logo()).toBeVisible();
      await expect.poll(() => headerLogoPage.logoHasLoaded()).toBe(true);
      expect(await headerLogoPage.wordmarkFollowsLogo()).toBe(true);
    });

    test(`on ${screen.name}, the logo is an SVG served from the site's own origin`, async ({
      headerLogoPage,
    }) => {
      await headerLogoPage.isolateFromGoogle();
      await headerLogoPage.navigate(screen.path);
      await expect.poll(() => headerLogoPage.logoHasLoaded()).toBe(true);

      const source = new URL(await headerLogoPage.logoSource());
      expect(source.origin).toBe(await headerLogoPage.siteOrigin());

      const response = await headerLogoPage.fetchLogo();
      expect(response.status).toBe(200);
      expect(response.contentType).toContain("image/svg+xml");
    });

    test(`on ${screen.name}, the logo adds no text alternative and no focus stop, and the header link is still named exactly ZIPNAMI`, async ({
      headerLogoPage,
    }) => {
      await headerLogoPage.isolateFromGoogle();
      await headerLogoPage.navigate(screen.path);
      await expect(headerLogoPage.logo()).toHaveCount(1);

      expect(await headerLogoPage.logoAlt()).toBe("");
      await expect(headerLogoPage.namedImagesInBanner()).toHaveCount(0);
      expect(await headerLogoPage.logoIsFocusable()).toBe(false);
      await expect(headerLogoPage.wordmark()).toHaveCount(1);
    });
  }
});
