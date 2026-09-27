import type { PostalCode } from "@zipnami/shared";
import { expect, test as shellTest } from "./fixtures";
import { normalizedPostalCodes } from "./fixtures/postal-code-dataset.ts";
import {
  createAdvertisingPage,
  type AdvertisingPage,
} from "./pages/advertising-page.ts";
import {
  answerDataUnavailable,
  answerInternalError,
  answerNonJsonBody,
  answerSchemaViolatingBody,
  answerWith,
  createDependencyFailurePage,
  refuseLiveThirdPartyRequests,
  type DependencyFailurePage,
} from "./pages/dependency-failure-page.ts";
import {
  createPostalCodeGeneratorPage,
  type PostalCodeGeneratorPage,
} from "./pages/postal-code-generator-page.ts";

/*
 * Acceptance test for Issue #17: Keep core features usable during dependency
 * failures.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * The Issue's Out of scope section — service-level uptime guarantees — is
 * deliberately untouched.
 *
 * How the Issue's wording is read here:
 *
 * - "An actionable retry state" is a failure the visitor is told about through
 *   a live region, with the generation action usable again and a retry through
 *   it producing a result. ui-design.md section 4 asks for "an understandable
 *   retry action" without deciding whether that is the generate action itself
 *   or a separate control, and section 12 leaves the wording open, so neither
 *   the control's label nor the message's text is fixed here.
 * - "Distinguishable" is that what the visitor is told differs between the two
 *   failures. Both invalid forms a response can take are compared against
 *   being offline: JSON that is not a postal code, and a body that is not JSON.
 * - "An unbounded loop" is held as the Issue #9 acceptance test holds it for
 *   advertising: requests to a failing API stop arriving. api-design.md section
 *   4.2 allows a client to "retry with bounded backoff", so this does not fix
 *   the number of automatic attempts — only that they end.
 *
 * Two criteria, and part of a third, are not held here, because the feature
 * they describe does not exist on this branch to fail:
 *
 * - "Maps embed failure leaves the postal code, addresses, history, and
 *   external map links usable where possible", and
 * - "External map launch failure preserves the current result".
 *   Both depend on the Google Maps integration Issue #8 owns, which has not
 *   been merged: there is no embed to fail and no external map link to launch.
 * - "Advertisement and consent failures do not block generation, addresses,
 *   maps, or history" is held for generation and addresses. Maps are Issue
 *   #8's and browser-local history is Issue #7's; neither is merged.
 *
 * None of this is an open design question. design.md sections 6.2 and 7
 * already commit Maps and history to the MVP and state the isolation they must
 * satisfy; what is missing is the features themselves. Whichever Issue delivers
 * them owns their failure boundaries' acceptance.
 *
 * "Automated tests cover each failure boundary without calling live
 * third-party services" is a property of how the suite is built, which a
 * browser cannot observe — the same reason the Issue #6 and #9 acceptance tests
 * declined to assert their equivalents. It constrains this file instead: every
 * dependency is answered at the network boundary, and a guard installed before
 * anything else refuses any request that would still leave for a third-party
 * host.
 *
 * `GET /api/random` is stubbed for the same reason the Issue #6 acceptance
 * test stubs it: every failure below has to be produced on demand, and a
 * success has to carry a known result.
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

// Two addresses each, with no code or address in common, so a screen that kept
// the wrong result is told apart from one that kept the right one.
const firstResult = datasetEntry("3670030");
const secondResult = datasetEntry("4980000");

// Long enough for a bounded retry schedule to finish, and then for a second
// look to show it has stopped. Generous rather than tuned, as in the Issue #9
// acceptance test: what is held is that attempts stop, not how quickly.
const retryScheduleWindow = 4000;
const settledWindow = 3000;

/*
 * Extends the shell fixture rather than editing it (committed files under
 * acceptance/ are locked).
 *
 * `page` itself is extended so the third-party guard is the first route every
 * test installs. Playwright consults the most recent matching route first, so
 * each substitute a test adds afterwards still answers its own requests, and
 * only what none of them answers reaches the guard.
 */
const test = shellTest.extend<{
  advertisingPage: AdvertisingPage;
  dependencyFailurePage: DependencyFailurePage;
  postalCodeGeneratorPage: PostalCodeGeneratorPage;
}>({
  page: async ({ page }, use) => {
    await refuseLiveThirdPartyRequests(page);
    await use(page);
  },
  advertisingPage: async ({ page }, use) => {
    await use(createAdvertisingPage(page));
  },
  dependencyFailurePage: async ({ page }, use) => {
    const dependencyFailurePage = createDependencyFailurePage(page);
    await use(dependencyFailurePage);
    await dependencyFailurePage.releaseHeldAdvertisingRequests();
  },
  postalCodeGeneratorPage: async ({ page }, use) => {
    await use(createPostalCodeGeneratorPage(page));
  },
});

/**
 * Activates the generation action and returns what the page then announces,
 * once the attempt has settled.
 *
 * Settled means the action is usable again: ui-design.md section 4 disables
 * only duplicate generation, so while it is disabled the attempt is still in
 * flight and the live region may still carry the loading announcement.
 * @param generatorPage - The generator screen.
 */
const settledAnnouncementAfterGenerating = async (
  generatorPage: PostalCodeGeneratorPage,
) => {
  await generatorPage.generate();
  await expect(generatorPage.generateAction()).toBeEnabled();

  await expect.poll(() => generatorPage.announcementText()).not.toBe("");
  return generatorPage.announcementText();
};

test.describe("Issue #17: core features stay usable during dependency failures", () => {
  test("a postal-data failure on the first generation is announced with a retry that produces a result", async ({
    dependencyFailurePage,
    postalCodeGeneratorPage,
  }) => {
    await dependencyFailurePage.stubRandomEndpoint([
      answerDataUnavailable(),
      answerWith(firstResult),
    ]);
    await postalCodeGeneratorPage.navigate();

    const announced = await settledAnnouncementAfterGenerating(
      postalCodeGeneratorPage,
    );

    // A failure with nothing before it: the visitor is told, nothing
    // pretends to be a result, and the way forward is still offered.
    expect(announced).not.toBe("");
    await expect(postalCodeGeneratorPage.anyPostalCodeDisplay()).toHaveCount(0);
    await expect(postalCodeGeneratorPage.generateAction()).toBeEnabled();

    await postalCodeGeneratorPage.generate();

    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(firstResult.postalCode),
    ).toBeVisible();
    for (const address of firstResult.addresses) {
      await expect(postalCodeGeneratorPage.addressEntry(address)).toBeVisible();
    }
  });

  test("an API failure after a result is announced, keeps that result, and offers a retry that replaces it", async ({
    dependencyFailurePage,
    postalCodeGeneratorPage,
  }) => {
    await dependencyFailurePage.stubRandomEndpoint([
      answerWith(firstResult),
      answerInternalError(),
      answerWith(secondResult),
    ]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();

    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(firstResult.postalCode),
    ).toBeVisible();
    const announcedOnSuccess = await postalCodeGeneratorPage.announcementText();

    const announcedOnFailure = await settledAnnouncementAfterGenerating(
      postalCodeGeneratorPage,
    );

    expect(announcedOnFailure).not.toBe(announcedOnSuccess);

    // design.md section 6.1: a failure must not discard the last result.
    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(firstResult.postalCode),
    ).toBeVisible();
    for (const address of firstResult.addresses) {
      await expect(postalCodeGeneratorPage.addressEntry(address)).toBeVisible();
    }

    await postalCodeGeneratorPage.generate();

    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(secondResult.postalCode),
    ).toBeVisible();
  });

  test("being offline is announced differently from a response that is not a postal code, and reconnecting lets a retry succeed", async ({
    dependencyFailurePage,
    postalCodeGeneratorPage,
  }) => {
    await dependencyFailurePage.stubRandomEndpoint([
      answerSchemaViolatingBody(),
      answerNonJsonBody(),
      answerWith(firstResult),
    ]);
    await postalCodeGeneratorPage.navigate();

    await dependencyFailurePage.goOffline();
    const announcedOffline = await settledAnnouncementAfterGenerating(
      postalCodeGeneratorPage,
    );

    await dependencyFailurePage.goOnline();
    const announcedOnSchemaViolation = await settledAnnouncementAfterGenerating(
      postalCodeGeneratorPage,
    );
    const announcedOnNonJson = await settledAnnouncementAfterGenerating(
      postalCodeGeneratorPage,
    );

    // Each failure reached the visitor, and being offline did not read the
    // same as either way the API can answer with something unusable. Whether
    // the two invalid forms read alike is the implementation's to decide.
    expect(announcedOffline).not.toBe("");
    expect(announcedOnSchemaViolation).not.toBe(announcedOffline);
    expect(announcedOnNonJson).not.toBe(announcedOffline);

    // An invalid response is not a result: none was displayed.
    await expect(postalCodeGeneratorPage.anyPostalCodeDisplay()).toHaveCount(0);

    await postalCodeGeneratorPage.generate();

    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(firstResult.postalCode),
    ).toBeVisible();
  });

  test("activating retry again while a retry is in flight starts no second request", async ({
    dependencyFailurePage,
    postalCodeGeneratorPage,
  }) => {
    await dependencyFailurePage.stubRandomEndpoint([
      answerDataUnavailable(),
      answerWith(firstResult),
    ]);
    await postalCodeGeneratorPage.navigate();
    await settledAnnouncementAfterGenerating(postalCodeGeneratorPage);
    expect(dependencyFailurePage.randomRequestCount()).toBe(1);

    dependencyFailurePage.holdResponses();
    await postalCodeGeneratorPage.generate();
    await postalCodeGeneratorPage.attemptDuplicateGeneration();
    await postalCodeGeneratorPage.attemptDuplicateGeneration();
    await postalCodeGeneratorPage.attemptDuplicateGeneration();
    dependencyFailurePage.releaseResponses();

    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(firstResult.postalCode),
    ).toBeVisible();
    // The first attempt and one retry reached the endpoint. The repeated
    // activations during the retry were refused, not queued and sent later.
    expect(dependencyFailurePage.randomRequestCount()).toBe(2);
  });

  test("a persistently failing API is not retried without end, and the visitor can still retry after it stops", async ({
    dependencyFailurePage,
    postalCodeGeneratorPage,
  }) => {
    await dependencyFailurePage.stubRandomEndpoint([answerInternalError()]);
    await postalCodeGeneratorPage.navigate();
    await settledAnnouncementAfterGenerating(postalCodeGeneratorPage);

    await dependencyFailurePage.letFurtherAttemptsArrive(retryScheduleWindow);
    const requestsAfterSchedule = dependencyFailurePage.randomRequestCount();

    await dependencyFailurePage.letFurtherAttemptsArrive(settledWindow);

    // Every answer so far was a failure, so an unbounded scheme would still be
    // asking.
    expect(dependencyFailurePage.randomRequestCount()).toBe(
      requestsAfterSchedule,
    );

    // Stopping on its own must not also stop the visitor.
    await settledAnnouncementAfterGenerating(postalCodeGeneratorPage);
    expect(dependencyFailurePage.randomRequestCount()).toBeGreaterThan(
      requestsAfterSchedule,
    );
  });

  test("every advertising and consent request failing blocks neither generation, a retry after an API failure, the addresses, nor copying", async ({
    advertisingPage,
    dependencyFailurePage,
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.recordClipboardWrites();
    await advertisingPage.failEveryAdvertisingRequest();
    await dependencyFailurePage.stubRandomEndpoint([
      answerDataUnavailable(),
      answerWith(firstResult),
    ]);
    await postalCodeGeneratorPage.navigate();

    // There has to have been something to fail, or this would hold for a page
    // that never advertises.
    await expect
      .poll(() => advertisingPage.advertisingRequestCount())
      .toBeGreaterThan(0);

    await settledAnnouncementAfterGenerating(postalCodeGeneratorPage);
    await postalCodeGeneratorPage.generate();

    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(firstResult.postalCode),
    ).toBeVisible();
    for (const address of firstResult.addresses) {
      await expect(postalCodeGeneratorPage.addressEntry(address)).toBeVisible();
    }

    await postalCodeGeneratorPage.copy();
    await expect
      .poll(() => postalCodeGeneratorPage.clipboardWrites())
      .toContain(firstResult.postalCode);
  });

  test("an advertising SDK that throws blocks neither generation, regeneration, the addresses, nor copying", async ({
    dependencyFailurePage,
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.recordClipboardWrites();
    await dependencyFailurePage.serveThrowingAdvertisingSdk();
    await dependencyFailurePage.stubRandomEndpoint([
      answerWith(firstResult),
      answerWith(secondResult),
    ]);
    await postalCodeGeneratorPage.navigate();

    // The failing SDK has to have arrived and run, or this would hold for a
    // page that never loads one.
    await expect
      .poll(() => dependencyFailurePage.answeredAdvertisingRequestCount())
      .toBeGreaterThan(0);

    await postalCodeGeneratorPage.generate();
    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(firstResult.postalCode),
    ).toBeVisible();

    await postalCodeGeneratorPage.generate();
    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(secondResult.postalCode),
    ).toBeVisible();
    for (const address of secondResult.addresses) {
      await expect(postalCodeGeneratorPage.addressEntry(address)).toBeVisible();
    }

    await postalCodeGeneratorPage.copy();
    await expect
      .poll(() => postalCodeGeneratorPage.clipboardWrites())
      .toContain(secondResult.postalCode);
  });

  test("a successful response is rendered while every advertising and consent request is still unanswered", async ({
    dependencyFailurePage,
    postalCodeGeneratorPage,
  }) => {
    await dependencyFailurePage.holdEveryAdvertisingRequest();
    await dependencyFailurePage.stubRandomEndpoint([answerWith(firstResult)]);
    await postalCodeGeneratorPage.navigate();

    // The optional integration has to be outstanding before generating, or the
    // result could not have been waiting on it.
    await expect
      .poll(() => dependencyFailurePage.advertisingRequestCount())
      .toBeGreaterThan(0);

    await postalCodeGeneratorPage.generate();

    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(firstResult.postalCode),
    ).toBeVisible();
    for (const address of firstResult.addresses) {
      await expect(postalCodeGeneratorPage.addressEntry(address)).toBeVisible();
    }
    await expect(postalCodeGeneratorPage.copyAction()).toBeVisible();

    // Nothing the advertising boundary asked for was ever answered, so the
    // result above cannot have been waiting on it.
    expect(dependencyFailurePage.answeredAdvertisingRequestCount()).toBe(0);
  });
});
