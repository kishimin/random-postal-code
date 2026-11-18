import {
  createDemoJourneyPage,
  type DemoJourneyPage,
} from "../pages/demo-journey-page.ts";
import { test as productionTest } from "../production/fixtures.ts";

/*
 * The v1.0.0 demo journey, recorded once per browser (Issue #132, step 3).
 *
 * The browser comes from the production fixture, which aborts the AdSense,
 * consent, and Analytics hosts on the context before the first navigation,
 * so recording the deployed site requests no ad and records no visit.
 */
const test = productionTest.extend<{ demoPage: DemoJourneyPage }>({
  demoPage: async ({ page }, provide) => {
    await provide(createDemoJourneyPage(page));
  },
});

test("the v1.0.0 demo journey: generate, read, generate again, copy, open a guide, and return to the top", async ({
  demoPage,
}) => {
  await demoPage.openStartScreen();
  await demoPage.generate();
  await demoPage.readResult();
  await demoPage.generate();
  await demoPage.copy();
  await demoPage.openGuide();
  await demoPage.returnToTop();
});
