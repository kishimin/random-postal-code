import type { PostalCode } from "@zipnami/shared";
import { expect, test as shellTest } from "./fixtures";
import { normalizedPostalCodes } from "./fixtures/postal-code-dataset.ts";
import {
  createAdEligibilityPage,
  type AdActivity,
  type AdEligibilityPage,
} from "./pages/ad-eligibility-page.ts";
import {
  createNotFoundPage,
  type NotFoundPage,
} from "./pages/not-found-page.ts";
import {
  createPostalCodeGeneratorPage,
  respondUnavailable,
  respondWith,
  type PostalCodeGeneratorPage,
} from "./pages/postal-code-generator-page.ts";
import {
  createPrivacyDisclosurePage,
  type PrivacyDisclosurePage,
} from "./pages/privacy-disclosure-page.ts";

/*
 * Acceptance test for Issue #120: Request ads only on screens with publisher
 * content.
 *
 * Each test name starts with the acceptance criterion it holds:
 *
 * - AC-2: the initial generator, loading, error, not-found, and privacy
 *   screens make no AdSense loader request, render no `ins.adsbygoogle`, and
 *   push nothing onto `adsbygoogle`.
 * - AC-3: moving from the result screen to a screen that may not carry ads
 *   leaves no ad unit behind and requests no ad there.
 * - AC-4's automatable part: every test runs on each configured Playwright
 *   project, which includes phones and desktops; the initial screen is held
 *   with an empty history and again with a stored one; an API failure is
 *   held; and so is returning to the initial screen.
 *
 * Which screens may carry ads is ui-design.md section 7.1's table. Only the
 * generator's result screen is eligible, and the Issue #9 and #17 acceptance
 * tests hold that it does request one. This file holds the other rows.
 *
 * Not held here:
 *
 * - AC-1 (the contract update) and AC-7 (no claim of a fix before review)
 *   are about documents and process, settled by review of the change.
 * - AC-5 (account-level Auto ads) is a setting inside the AdSense console,
 *   which a browser cannot observe; it is the owner's task.
 * - AC-6 is held by the existing acceptance tests passing, six of them
 *   rewritten with the owner's approval:
 *   https://github.com/kishimin/random-postal-code/issues/120#issuecomment-6751769425
 * - The global error screen: a browser cannot be driven to the render failure
 *   that shows it (ui-design.md section 10).
 *
 * Nothing here contacts Google. The AdSense loader is answered by the Issue #9
 * substitute, which fills any unit it finds, so an ad requested on the wrong
 * screen would really show rather than quietly fail. Every other advertising
 * and consent request is refused.
 *
 * `GET /api/random` is stubbed, as in the Issue #6 acceptance test, so each
 * state is reached on demand and a success carries a known result.
 */

/**
 * Finds a postal code in the shared acceptance dataset.
 * @param postalCode - The canonical seven-digit code to look up.
 */
const datasetEntry = (postalCode: string): PostalCode => {
  const entry = normalizedPostalCodes.find(
    (candidate) => candidate.postalCode === postalCode,
  );

  if (!entry) {
    throw new Error(`The acceptance dataset has no postal code ${postalCode}.`);
  }

  return entry;
};

const result = datasetEntry("3670030");

// How long a screen is watched for a late ad request after it has rendered.
// The ad tag starts within a moment of a screen mounting; this is generous
// rather than tuned, because what is held is that nothing arrives at all.
const settleWindow = 2000;

/*
 * Extends the shell fixture rather than editing it (committed files under
 * acceptance/ are locked).
 *
 * Every test records pushes and answers the loader before anything else, so
 * a request from the very first screen is already counted.
 */
const test = shellTest.extend<{
  adEligibilityPage: AdEligibilityPage;
  notFoundPage: NotFoundPage;
  postalCodeGeneratorPage: PostalCodeGeneratorPage;
  privacyDisclosurePage: PrivacyDisclosurePage;
}>({
  adEligibilityPage: async ({ page }, use) => {
    const adEligibilityPage = createAdEligibilityPage(page);
    await adEligibilityPage.recordAdPushes();
    await adEligibilityPage.answerAdRequestsWithFilledAds();
    await use(adEligibilityPage);
  },
  notFoundPage: async ({ page }, use) => {
    await use(createNotFoundPage(page));
  },
  postalCodeGeneratorPage: async ({ page }, use) => {
    await use(createPostalCodeGeneratorPage(page));
  },
  privacyDisclosurePage: async ({ page }, use) => {
    await use(createPrivacyDisclosurePage(page));
  },
});

/**
 * Holds that the current screen requested no ad since `before`, and shows
 * none: no new loader request, no new push, and no ad unit in the document.
 *
 * Checked once on arrival and again after the screen has had time to start a
 * late request, so neither an immediate nor a deferred request passes.
 * @param adEligibilityPage - The ad observer.
 * @param before - The activity to compare against. Pushes are counted per
 *   document, so after a full page load this is zero pushes.
 */
const expectNoAdRequestedSince = async (
  adEligibilityPage: AdEligibilityPage,
  before: AdActivity,
) => {
  await expect(adEligibilityPage.adUnits()).toHaveCount(0);

  await adEligibilityPage.letLateAdRequestsArrive(settleWindow);

  expect(await adEligibilityPage.adActivity()).toEqual(before);
  await expect(adEligibilityPage.adUnits()).toHaveCount(0);
};

const nothingRequested: AdActivity = { loaderRequests: 0, pushes: 0 };

/**
 * Shows a result and waits until its ad has been requested, so a later
 * screen has an ad to leave behind and a request to repeat.
 *
 * Returns the activity at that point. Without having seen the ad here, "no ad
 * on the next screen" would hold for a build that never advertises.
 * @param postalCodeGeneratorPage - The generator screen.
 * @param adEligibilityPage - The ad observer.
 */
const showResultWithItsAd = async (
  postalCodeGeneratorPage: PostalCodeGeneratorPage,
  adEligibilityPage: AdEligibilityPage,
): Promise<AdActivity> => {
  await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
  await postalCodeGeneratorPage.navigate();
  await postalCodeGeneratorPage.generate();
  await expect(
    postalCodeGeneratorPage.postalCodeDisplay(result.postalCode),
  ).toBeVisible();

  await expect(adEligibilityPage.adUnits()).toHaveCount(1);
  await expect
    .poll(async () => (await adEligibilityPage.adActivity()).loaderRequests)
    .toBeGreaterThan(0);
  await expect.poll(() => adEligibilityPage.adPushCount()).toBeGreaterThan(0);

  return adEligibilityPage.adActivity();
};

test.describe("Issue #120: only the generator's result screen requests ads", () => {
  test("AC-2 the initial generator with an empty history requests no ad: no loader request, no ad unit, no push", async ({
    adEligibilityPage,
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();

    // The initial screen, ready to be used: before any result.
    await expect(postalCodeGeneratorPage.startAction()).toBeVisible();

    await expectNoAdRequestedSince(adEligibilityPage, nothingRequested);
  });

  test("AC-2 the first generation's loading state requests no ad", async ({
    adEligibilityPage,
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();

    postalCodeGeneratorPage.holdResponses();
    await postalCodeGeneratorPage.generate();

    // Still loading, with no result yet: ui-design.md section 4 disables
    // only duplicate generation while a request is in flight.
    await expect(postalCodeGeneratorPage.generateAction()).toBeDisabled();
    await expect(postalCodeGeneratorPage.anyPostalCodeDisplay()).toHaveCount(0);

    await expectNoAdRequestedSince(adEligibilityPage, nothingRequested);

    // Still loading after the wait, so the wait was spent in that state.
    await expect(postalCodeGeneratorPage.generateAction()).toBeDisabled();
    postalCodeGeneratorPage.releaseResponses();
  });

  test("AC-2 an API failure with no result shown requests no ad", async ({
    adEligibilityPage,
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.stubRandomEndpoint([respondUnavailable()]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();

    await expect(postalCodeGeneratorPage.failureShown()).toBeVisible();
    await expect(postalCodeGeneratorPage.anyPostalCodeDisplay()).toHaveCount(0);

    await expectNoAdRequestedSince(adEligibilityPage, nothingRequested);
  });

  test("AC-2 the not-found screen requests no ad", async ({
    adEligibilityPage,
    notFoundPage,
  }) => {
    await notFoundPage.navigate();
    await expect(notFoundPage.heading()).toBeVisible();

    await expectNoAdRequestedSince(adEligibilityPage, nothingRequested);
  });

  test("AC-2 the privacy page requests no ad", async ({
    adEligibilityPage,
    privacyDisclosurePage,
  }) => {
    await privacyDisclosurePage.navigate();
    await expect(privacyDisclosurePage.heading()).toBeVisible();

    await expectNoAdRequestedSince(adEligibilityPage, nothingRequested);
  });

  test("AC-3 leaving a result for the privacy page leaves no ad unit behind and requests no ad there", async ({
    adEligibilityPage,
    postalCodeGeneratorPage,
    privacyDisclosurePage,
  }) => {
    const onResult = await showResultWithItsAd(
      postalCodeGeneratorPage,
      adEligibilityPage,
    );

    // Within the application, so the document the result's ad was rendered
    // into is the one the privacy page now occupies.
    await postalCodeGeneratorPage.navigationLink().click();
    await expect(privacyDisclosurePage.heading()).toBeVisible();

    await expectNoAdRequestedSince(adEligibilityPage, onResult);
  });

  test("AC-3 AC-4 going back from the privacy page to the initial generator requests no ad there", async ({
    adEligibilityPage,
    postalCodeGeneratorPage,
    privacyDisclosurePage,
  }) => {
    const onResult = await showResultWithItsAd(
      postalCodeGeneratorPage,
      adEligibilityPage,
    );

    await postalCodeGeneratorPage.navigationLink().click();
    await expect(privacyDisclosurePage.heading()).toBeVisible();

    await adEligibilityPage.goBack();

    // Back on the generator's initial screen, before any result: the screen
    // the visitor returns to, not the result they left.
    await expect(postalCodeGeneratorPage.startAction()).toBeVisible();

    await expectNoAdRequestedSince(adEligibilityPage, onResult);
  });

  test("AC-3 AC-4 leaving a result for an unknown address, then following its way back, requests no ad on either screen", async ({
    adEligibilityPage,
    notFoundPage,
    postalCodeGeneratorPage,
  }) => {
    const onResult = await showResultWithItsAd(
      postalCodeGeneratorPage,
      adEligibilityPage,
    );

    // A typed address: a new document, so pushes start again from zero, while
    // loader requests are counted across documents.
    await notFoundPage.navigate();
    await expect(notFoundPage.heading()).toBeVisible();

    const onArrival: AdActivity = {
      loaderRequests: onResult.loaderRequests,
      pushes: 0,
    };
    await expectNoAdRequestedSince(adEligibilityPage, onArrival);

    await notFoundPage.backToGeneratorLink().click();
    await expect(postalCodeGeneratorPage.startAction()).toBeVisible();

    await expectNoAdRequestedSince(adEligibilityPage, onArrival);
  });

  test("AC-2 AC-4 reloading after a result returns to the initial generator with a stored history, which requests no ad", async ({
    adEligibilityPage,
    postalCodeGeneratorPage,
  }) => {
    const onResult = await showResultWithItsAd(
      postalCodeGeneratorPage,
      adEligibilityPage,
    );

    // The result is now in the browser-local history, but no result is
    // shown: the initial screen, not the result screen.
    await adEligibilityPage.reload();
    await expect(postalCodeGeneratorPage.startAction()).toBeVisible();

    await expectNoAdRequestedSince(adEligibilityPage, {
      loaderRequests: onResult.loaderRequests,
      pushes: 0,
    });
  });
});
