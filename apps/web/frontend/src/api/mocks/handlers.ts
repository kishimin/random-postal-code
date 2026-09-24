import { HttpResponse, http } from "msw";
import type { RequestHandler } from "msw";

// Mirrors features/advertising/config.ts's ADSENSE_LOADER_URL as a literal
// rather than an import: the boundaries lint rule keeps shared/ (this file's
// directory) from depending on features/.
const ADSENSE_LOADER_URL =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";

/**
 * Default request handlers applied to every test and Storybook story.
 *
 * Handlers are added per feature as its acceptance criteria are implemented;
 * an unhandled request is bypassed rather than falls to the real network,
 * which the AdSense loader would otherwise do: every component test that
 * mounts AdvertisingRegion loads this script (features/advertising/hooks/
 * use-adsense-script.ts), and "bypass" would send that request to Google's
 * real servers. Answering it here is this feature's controlled substitute
 * (ui-design.md section 11), the same role
 * acceptance/selectors/advertising-selectors.ts's advertisingSdkSubstitute
 * plays for the Playwright acceptance test -- a minimal one, since no
 * component test here asserts anything about a filled ad.
 */
export const handlers: RequestHandler[] = [
  http.get(ADSENSE_LOADER_URL, () =>
    HttpResponse.text("/* test substitute: no-op AdSense loader */", {
      headers: { "content-type": "text/javascript; charset=utf-8" },
    }),
  ),
];
