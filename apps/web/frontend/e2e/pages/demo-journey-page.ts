import type { Page } from "@playwright/test";
import { demoJourneySelectors } from "../selectors/demo-journey-selectors.ts";

/*
 * How long the recording stays on each screen before the next step.
 *
 * A test moves on as soon as the page is ready. A viewer needs time to read
 * what changed, so every step waits on its result. The longest pause is on
 * the result, which carries the most to read.
 */
const pauses = {
  screen: 2_500,
  result: 4_000,
} as const;

/**
 * Page Object for the v1.0.0 demo journey (Issue #132, step 3).
 *
 * It drives the deployed site the way a first-time visitor would, one step at
 * a time, and pauses after each so the video can be followed. It asserts
 * nothing: the production tests (Issue #104) already prove the journey works,
 * and a recording that stopped on a failed assertion would leave no video to
 * see why.
 * @param {Page} page - The Playwright page, as the production fixture prepared it.
 */
export const createDemoJourneyPage = (page: Page) => {
  const pause = (milliseconds: number) => page.waitForTimeout(milliseconds);

  const generateAction = () =>
    page.getByRole("button", { name: demoJourneySelectors.generateAction });

  const copyAction = () =>
    page.getByRole("button", { name: demoJourneySelectors.copyAction });

  const resultRegion = () =>
    page.getByRole("main").getByTestId("result-region");

  const guideLink = () =>
    page
      .getByRole("navigation", { name: demoJourneySelectors.guideNavigation })
      .getByRole("link", { name: demoJourneySelectors.guideLink, exact: true });

  const backToTopLink = () =>
    page.getByRole("link", { name: demoJourneySelectors.backToTop });

  const openStartScreen = async () => {
    await page.goto("/");
    await generateAction().waitFor();
    await pause(pauses.screen);
  };

  // Waits for the Worker's answer on screen, then lets the viewer read the
  // postal code and its address list.
  const generate = async () => {
    const answered = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/api/random"),
    );
    await generateAction().click();
    await answered;
    await resultRegion().getByRole("listitem").first().waitFor();
    await pause(pauses.result);
  };

  // The address list can be longer than a phone screen, so it is scrolled
  // through rather than left half out of view.
  const readResult = async () => {
    await resultRegion().getByRole("listitem").last().scrollIntoViewIfNeeded();
    await pause(pauses.screen);
    await generateAction().scrollIntoViewIfNeeded();
    await pause(pauses.screen);
  };

  const copy = async () => {
    await copyAction().scrollIntoViewIfNeeded();
    await copyAction().click();
    await pause(pauses.screen);
  };

  const openGuide = async () => {
    await guideLink().scrollIntoViewIfNeeded();
    await pause(pauses.screen);
    await guideLink().click();
    await backToTopLink().waitFor();
    await pause(pauses.screen);
  };

  const returnToTop = async () => {
    await backToTopLink().scrollIntoViewIfNeeded();
    await backToTopLink().click();
    await generateAction().waitFor();
    await pause(pauses.screen);
  };

  return {
    openStartScreen,
    generate,
    readResult,
    copy,
    openGuide,
    returnToTop,
  };
};

export type DemoJourneyPage = ReturnType<typeof createDemoJourneyPage>;
