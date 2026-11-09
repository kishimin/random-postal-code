import type { Page } from "@playwright/test";
import { figmaCopy } from "../selectors/figma-copy.ts";
import { createAdvertisingPage } from "./advertising-page.ts";

/**
 * Page Object for the logo in the shared header (Issue #113).
 *
 * The logo is decorative: the wordmark beside it already names the site. So
 * it is not in the accessibility tree, and the image element is found by its
 * tag inside the banner instead. Everything else is read as a visitor or
 * assistive technology meets it: the banner, the link's name, document order.
 * @param page - The Playwright page driving the browser.
 */
export const createHeaderLogoPage = (page: Page) => {
  const advertising = createAdvertisingPage(page);

  /** Answers every advertising request. Call before navigating. */
  const isolateFromGoogle = () => advertising.failEveryAdvertisingRequest();

  /**
   * Opens a path of the site.
   * @param path - The path to open.
   */
  const navigate = (path: string) => page.goto(path);

  const banner = () => page.getByRole("banner");

  const logo = () => banner().locator("img");

  const wordmark = () =>
    banner().getByRole("link", { name: figmaCopy.wordmark, exact: true });

  // Images the accessibility tree exposes. A decorative image is not one.
  const namedImagesInBanner = () => banner().getByRole("img");

  /** The logo's `alt` attribute, or null when it has none. */
  const logoAlt = () => logo().getAttribute("alt");

  /** Whether the browser fetched and decoded the image. */
  const logoHasLoaded = () =>
    logo().evaluate(
      (element) =>
        element instanceof HTMLImageElement &&
        element.complete &&
        element.naturalWidth > 0,
    );

  /** The URL the image was actually loaded from. */
  const logoSource = () =>
    logo().evaluate((element) =>
      element instanceof HTMLImageElement ? element.currentSrc : "",
    );

  const siteOrigin = () => page.evaluate(() => window.location.origin);

  /**
   * Fetches the logo's URL the way the browser did and reports what came
   * back, so the asset is known to be the site's own file and not a
   * placeholder that happens to decode.
   */
  const fetchLogo = async () => {
    const response = await page.request.get(await logoSource());
    return {
      status: response.status(),
      contentType: response.headers()["content-type"] ?? "",
    };
  };

  /**
   * Whether nothing a visitor reads or reaches sits between the logo and the
   * wordmark: the element after the logo is the wordmark link or holds it.
   */
  const wordmarkFollowsLogo = async () => {
    const link = await wordmark().elementHandle();
    return logo().evaluate((element, target) => {
      const next = element.nextElementSibling;
      return (
        target !== null &&
        next !== null &&
        (next === target || next.contains(target))
      );
    }, link);
  };

  /** Whether the logo is a keyboard focus stop of its own. */
  const logoIsFocusable = () =>
    logo().evaluate(
      (element) => element instanceof HTMLElement && element.tabIndex >= 0,
    );

  return {
    isolateFromGoogle,
    navigate,
    banner,
    logo,
    wordmark,
    namedImagesInBanner,
    logoAlt,
    logoHasLoaded,
    logoSource,
    siteOrigin,
    fetchLogo,
    wordmarkFollowsLogo,
    logoIsFocusable,
  };
};

export type HeaderLogoPage = ReturnType<typeof createHeaderLogoPage>;
