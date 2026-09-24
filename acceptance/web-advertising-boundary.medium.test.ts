import type { PostalCode } from "@zipnami/shared";
import { expect, test as shellTest } from "./fixtures";
import { normalizedPostalCodes } from "./fixtures/postal-code-dataset.ts";
import {
  createAdvertisingPage,
  rectanglesOverlap,
  type AdvertisingPage,
  type DocumentRect,
} from "./pages/advertising-page.ts";
import {
  createPostalCodeGeneratorPage,
  respondWith,
  type PostalCodeGeneratorPage,
} from "./pages/postal-code-generator-page.ts";
import { generatorSelectors } from "./selectors/generator-selectors.ts";

/*
 * Acceptance test for Issue #9: Integrate Google AdSense without blocking Web
 * features.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * The Issue's Out of scope section — interstitial, rewarded, and app-open
 * advertising — is deliberately untouched. Verifying any of it would pull the
 * implementation past the Issue's boundary.
 *
 * Nothing here contacts Google. Every advertising and consent host is answered
 * at the network boundary, either by a substitute that reproduces a filled unit
 * occupying space, or by a failure. That is not incidental: "Automated tests
 * cover application-owned states without relying on live ad delivery" is itself
 * one of the Issue's criteria, and it is a constraint on how this file is
 * built rather than an assertion this file can make. A browser cannot observe
 * which tests a repository contains — the same reason the Issue #6 acceptance
 * test declined to hold its own equivalent criterion.
 *
 * Two criteria are not held here, and neither is held anywhere else yet.
 *
 * "Regions requiring consent complete the selected Google CMP flow before
 * eligible ad requests" names a CMP that has not been selected: ui-design.md
 * section 12 still lists SDK-specific consent presentation as unresolved, and
 * design.md section 12 routes the AdSense and consent configuration to human
 * review before release. A browser also cannot place itself in a region that
 * requires consent — Google decides that from the request's origin — so the
 * precondition cannot be established without live delivery, which the criterion
 * above forbids.
 *
 * "Declined personalization uses an available non-personalized or limited mode"
 * depends on the same undecided CMP for the signal that personalization was
 * declined. Once the CMP is named, both become orderings at the network
 * boundary, which is testable here.
 *
 * "Ads do not overlap or obscure generation controls, addresses, maps, or
 * history" is held for the generation controls and the addresses. Maps are
 * Issue #8's and history is Issue #7's; both are still unmerged, so neither
 * exists on this branch to compare against.
 *
 * `GET /api/random` is stubbed for the same reason the Issue #6 acceptance
 * test stubs it: a real service returns an unknown postal code, and these
 * criteria are about where a known result sits relative to the advertisement.
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

// Two addresses, so the overlap check covers more than a single row.
const result = datasetEntry("3670030");

// Long enough for a bounded retry schedule to finish, and then for a second
// look to show it has stopped. Both are generous rather than tuned: the test
// holds that attempts stop, not how quickly.
const retryScheduleWindow = 4000;
const settledWindow = 3000;

/*
 * Extends the shell fixture rather than editing it.
 *
 * ./fixtures/index.ts and ./fixtures/test.ts are committed, and the ATDD guard
 * locks a committed file under acceptance/ so an implementation cannot quietly
 * reshape the test it must satisfy. Adding a Page Object for a new Issue is not
 * that, but the guard cannot tell the two apart, so the fixture composes here.
 */
const test = shellTest.extend<{
  advertisingPage: AdvertisingPage;
  postalCodeGeneratorPage: PostalCodeGeneratorPage;
}>({
  advertisingPage: async ({ page }, use) => {
    await use(createAdvertisingPage(page));
  },
  postalCodeGeneratorPage: async ({ page }, use) => {
    await use(createPostalCodeGeneratorPage(page));
  },
});

test.describe("Issue #9: the advertising and consent boundary", () => {
  test("the page carries exactly one advertisement area, and a label rather than only a colour tells a visitor it is one", async ({
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await advertisingPage.substituteAdvertisingSdk();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();

    // Located by its advertising label, so one match means both that the area
    // exists and that it says what it is (ui-design.md sections 7 and 8).
    // Exactly one, because the Issue asks for one area, and a second would be a
    // second thing to keep clear of the application's own controls.
    await expect(advertisingPage.advertisingRegion()).toHaveCount(1);
    await expect(advertisingPage.advertisingRegion()).toBeVisible();
  });

  test("the advertisement overlaps neither the generate action, the copy action, nor any address", async ({
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await advertisingPage.substituteAdvertisingSdk();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();

    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(result.postalCode),
    ).toBeVisible();

    const advertisement = await advertisingPage.documentRectOf(
      advertisingPage.advertisingRegion(),
    );

    // An advertisement with no area cannot cover anything, so the comparison
    // below would hold for a region that never rendered. The substitute fills
    // the slot precisely so this is the occupied case.
    expect(advertisement.width).toBeGreaterThan(0);
    expect(advertisement.height).toBeGreaterThan(0);

    const addresses = await advertisingPage.documentRectsOf(
      postalCodeGeneratorPage
        .addressEntry(result.addresses[0])
        .or(postalCodeGeneratorPage.addressEntry(result.addresses[1])),
    );
    expect(addresses).toHaveLength(result.addresses.length);

    const generationControls: readonly DocumentRect[] = [
      await advertisingPage.documentRectOf(
        postalCodeGeneratorPage.generateAction(),
      ),
      await advertisingPage.documentRectOf(
        postalCodeGeneratorPage.copyAction(),
      ),
    ];

    for (const occupied of [...generationControls, ...addresses]) {
      expect(rectanglesOverlap(advertisement, occupied)).toBe(false);
    }
  });

  test("the advertisement area carries none of the application's own actions", async ({
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await advertisingPage.substituteAdvertisingSdk();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();

    await expect(postalCodeGeneratorPage.copyAction()).toBeVisible();

    // Where the advertisement is placed is only a question once there is one,
    // and without this the counts of zero below would hold for a page that
    // shows no advertising at all.
    await expect(advertisingPage.advertisingRegion()).toBeVisible();

    /*
     * Whether an advertisement looks like a Zipnami control is a judgement
     * about appearance, which this repository keeps out of automated tests
     * (ADR-0012). What can be held is the confusion's cause: a control inside
     * the advertisement that a visitor would activate expecting the
     * application to answer. None of the application's actions may live there.
     */
    for (const action of [
      generatorSelectors.generateAction,
      generatorSelectors.copyAction,
      generatorSelectors.navigationLink,
    ]) {
      await expect(
        advertisingPage.applicationActionInsideAdvertisingRegion(action),
      ).toHaveCount(0);
    }

    // The three actions above are on the page, so the counts of zero mean the
    // advertisement is clear of them rather than that the page has no actions.
    await expect(postalCodeGeneratorPage.generateAction()).toBeVisible();
    await expect(postalCodeGeneratorPage.copyAction()).toBeVisible();
    await expect(postalCodeGeneratorPage.navigationLink()).toBeVisible();
  });

  test("outside production the advertisement slot asks for test ads", async ({
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await advertisingPage.substituteAdvertisingSdk();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();

    /*
     * This build is not the production one: it is served by the local preview
     * and was made without a production advertising account, which CI is
     * required never to hand to a build step. So the slot it renders has to be
     * the test-ad configuration.
     *
     * Unlike an account-side restriction, this is configuration the
     * application renders into its own page, which is what makes the criterion
     * observable at all rather than a claim about a Google console.
     */
    await expect(advertisingPage.adSlot()).toHaveCount(1);
    await expect(advertisingPage.testConfiguredAdSlot()).toHaveCount(1);
  });

  test("generating, reading, and copying a result all survive every advertising and consent request failing", async ({
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.recordClipboardWrites();
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();

    // There has to have been something to fail. Without a request that was
    // refused, everything below would hold for a page that never advertises,
    // and the criterion would be satisfied by not attempting at all.
    await expect
      .poll(() => advertisingPage.advertisingRequestCount())
      .toBeGreaterThan(0);

    await postalCodeGeneratorPage.generate();

    // design.md section 7: an optional dependency failing must not make an
    // otherwise successful postal code or its addresses unavailable.
    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(result.postalCode),
    ).toBeVisible();

    for (const address of result.addresses) {
      await expect(postalCodeGeneratorPage.addressEntry(address)).toBeVisible();
    }

    await expect(postalCodeGeneratorPage.copyAction()).toBeVisible();
    await postalCodeGeneratorPage.copy();

    await expect
      .poll(() => postalCodeGeneratorPage.clipboardWrites())
      .toContain(result.postalCode);

    // ui-design.md section 7: an advertisement that never arrives collapses or
    // keeps a reserved region, and either way offers nothing to activate. A
    // control left behind by a failed ad is the accidental click the Issue's
    // Problem section is about.
    await expect(
      advertisingPage.interactiveControlsInsideAdvertisingRegion(),
    ).toHaveCount(0);
  });

  test("a failing advertisement request is attempted and then stops being retried", async ({
    advertisingPage,
    postalCodeGeneratorPage,
  }) => {
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();

    // The page has to ask at least once, or "not retried indefinitely" would
    // hold for an implementation that never advertises at all.
    await expect
      .poll(() => advertisingPage.advertisingScriptRequestCount())
      .toBeGreaterThan(0);

    await advertisingPage.letFurtherAttemptsArrive(retryScheduleWindow);
    const attemptsAfterSchedule =
      advertisingPage.advertisingScriptRequestCount();

    await advertisingPage.letFurtherAttemptsArrive(settledWindow);

    // Every request so far failed, so an unbounded scheme would still be
    // asking. That the count stopped moving is what bounded means here; the
    // Issue fixes no particular limit, so neither does this.
    expect(advertisingPage.advertisingScriptRequestCount()).toBe(
      attemptsAfterSchedule,
    );
  });
});
