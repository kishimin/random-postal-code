import { test as base, expect } from "@playwright/test";
import {
  createProductionSitePage,
  type ProductionSitePage,
} from "../pages/production-site-page.ts";
import { blockedThirdPartyPattern } from "../selectors/production-selectors.ts";

/*
 * The one place every production test takes its browser from (Issue #104).
 *
 * The advertising, consent, and Analytics hosts are aborted on the browser
 * context, not on the page. The context exists before any page, so the
 * blocking is in place before the first navigation, and it also covers any
 * page the site opens. A test that adds its own page route still has these
 * blocked: Playwright consults page routes first and falls back to the
 * context's.
 *
 * The fixture callback is named `provide` rather than Playwright's usual
 * `use`, which oxlint's React rules would read as a hook call.
 */
export const test = base.extend<{ sitePage: ProductionSitePage }>({
  context: async ({ context }, provide) => {
    await context.route(blockedThirdPartyPattern, (route) =>
      route.abort("blockedbyclient"),
    );
    await provide(context);
  },
  sitePage: async ({ page }, provide) => {
    await provide(createProductionSitePage(page));
  },
});

export { expect };
