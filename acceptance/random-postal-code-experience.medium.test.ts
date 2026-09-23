import type { PostalCode } from "@zipnami/shared";
import { expect, test as shellTest } from "./fixtures";
import { normalizedPostalCodes } from "./fixtures/postal-code-dataset.ts";
import {
  createPostalCodeGeneratorPage,
  type PostalCodeGeneratorPage,
  respondUnavailable,
  respondWith,
} from "./pages/postal-code-generator-page.ts";

/*
 * Acceptance test for Issue #6: Build the Web random postal-code experience.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * The Issue's Out of scope section — history persistence, Google Maps, and
 * advertisements — is deliberately untouched. Verifying any of it would pull
 * the implementation past the Issue's boundary.
 *
 * One criterion is not held here. "Component/integration tests assert
 * observable initial, loading, success, regeneration, copy, and failure
 * behavior" describes which tests the repository contains, and a browser cannot
 * observe that. The behavior it enumerates is what this file exercises; where
 * those tests live is settled by the package's own suite and its coverage gate.
 *
 * The endpoint is stubbed at the network boundary. `GET /api/random` already
 * ships (Issue #4), but a real service returns an unknown postal code, and
 * every criterion below is about what a visitor sees for a known one.
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

// Both carry two addresses, so "every returned address is displayed" is more
// than a shape check, and neither code nor address overlaps the other, so a
// screen that failed to replace the first result still shows it.
const firstResult = datasetEntry("3670030");
const secondResult = datasetEntry("4980000");

/*
 * Extends the shell fixture rather than editing it.
 *
 * ./fixtures/index.ts and ./fixtures/test.ts are committed, and the ATDD guard
 * locks a committed file under acceptance/ so an implementation cannot quietly
 * reshape the test it must satisfy. Adding a Page Object for a new Issue is not
 * that, but the guard cannot tell the two apart, so the fixture composes here.
 */
const test = shellTest.extend<{
  postalCodeGeneratorPage: PostalCodeGeneratorPage;
}>({
  postalCodeGeneratorPage: async ({ page }, use) => {
    await use(createPostalCodeGeneratorPage(page));
  },
});

test.describe("Issue #6: the random postal-code experience", () => {
  test("the initial screen offers the branding, an explanation, and the generate action with an empty result and no request", async ({
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.stubRandomEndpoint([
      respondWith(firstResult),
    ]);
    await postalCodeGeneratorPage.navigate();

    await expect(postalCodeGeneratorPage.brandingHeading()).toBeVisible();
    await expect(postalCodeGeneratorPage.explanation()).toBeVisible();
    await expect(postalCodeGeneratorPage.generateAction()).toBeVisible();
    await expect(postalCodeGeneratorPage.anyPostalCodeDisplay()).toHaveCount(0);
    await expect(postalCodeGeneratorPage.copyAction()).toHaveCount(0);
    expect(postalCodeGeneratorPage.randomRequestCount()).toBe(0);
  });

  test("activating the generate action requests one random postal code", async ({
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.stubRandomEndpoint([
      respondWith(firstResult),
    ]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();

    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(firstResult.postalCode),
    ).toBeVisible();
    expect(postalCodeGeneratorPage.randomRequestCount()).toBe(1);
  });

  test("the returned postal code and every returned address are displayed", async ({
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.stubRandomEndpoint([
      respondWith(firstResult),
    ]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();

    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(firstResult.postalCode),
    ).toBeVisible();

    for (const address of firstResult.addresses) {
      await expect(postalCodeGeneratorPage.addressEntry(address)).toBeVisible();
    }
  });

  test("the displayed postal code is copied as its canonical seven digits", async ({
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.recordClipboardWrites();
    await postalCodeGeneratorPage.stubRandomEndpoint([
      respondWith(firstResult),
    ]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();

    await expect(postalCodeGeneratorPage.copyAction()).toBeVisible();
    await postalCodeGeneratorPage.copy();

    // ui-design.md section 5.3: the screen shows NNN-NNNN, the clipboard
    // carries the canonical value, and Issue #6 does not change that contract.
    await expect
      .poll(() => postalCodeGeneratorPage.clipboardWrites())
      .toContain(firstResult.postalCode);
  });

  test("regenerating replaces the current result with the newly returned one", async ({
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.stubRandomEndpoint([
      respondWith(firstResult),
      respondWith(secondResult),
    ]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();

    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(firstResult.postalCode),
    ).toBeVisible();

    await postalCodeGeneratorPage.generate();

    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(secondResult.postalCode),
    ).toBeVisible();
    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(firstResult.postalCode),
    ).toHaveCount(0);

    for (const address of secondResult.addresses) {
      await expect(postalCodeGeneratorPage.addressEntry(address)).toBeVisible();
    }

    for (const address of firstResult.addresses) {
      await expect(postalCodeGeneratorPage.addressEntry(address)).toHaveCount(
        0,
      );
    }
  });

  test("a second activation while a generation is in flight starts no second request, and navigation stays usable", async ({
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.stubRandomEndpoint([
      respondWith(firstResult),
      respondWith(secondResult),
    ]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();

    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(firstResult.postalCode),
    ).toBeVisible();

    postalCodeGeneratorPage.holdResponses();
    await postalCodeGeneratorPage.generate();
    await postalCodeGeneratorPage.attemptDuplicateGeneration();

    // Nothing else is suspended while the request is out: the result already on
    // screen stays readable and the footer navigation stays operable.
    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(firstResult.postalCode),
    ).toBeVisible();
    await expect(postalCodeGeneratorPage.navigationLink()).toBeEnabled();

    postalCodeGeneratorPage.releaseResponses();

    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(secondResult.postalCode),
    ).toBeVisible();
    // Two activations reached the endpoint, not three: the duplicate was
    // refused rather than queued and answered later.
    expect(postalCodeGeneratorPage.randomRequestCount()).toBe(2);
  });

  test("a new result is announced in a live region", async ({
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.stubRandomEndpoint([
      respondWith(firstResult),
    ]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();

    await expect(
      postalCodeGeneratorPage.announcementOf(firstResult.postalCode),
    ).not.toHaveCount(0);
  });

  test("a failed generation is announced, keeps the previous result, and allows another attempt", async ({
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.stubRandomEndpoint([
      respondWith(firstResult),
      respondUnavailable(),
      respondWith(secondResult),
    ]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();

    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(firstResult.postalCode),
    ).toBeVisible();
    const announcedOnSuccess = await postalCodeGeneratorPage.announcementText();

    await postalCodeGeneratorPage.generate();

    // What is announced has to change and has to say something. The wording is
    // the implementation's to choose (ui-design.md section 12), so the test
    // holds that the failure reaches a live region at all, not how it reads.
    await expect
      .poll(async () => {
        const announced = await postalCodeGeneratorPage.announcementText();
        return announced !== "" && announced !== announcedOnSuccess;
      })
      .toBe(true);

    // A failure returns no result, so there is nothing to replace the one the
    // visitor already has (design.md section 6.1).
    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(firstResult.postalCode),
    ).toBeVisible();

    await postalCodeGeneratorPage.generate();

    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(secondResult.postalCode),
    ).toBeVisible();
  });

  test("generating and copying work with keyboard input alone", async ({
    postalCodeGeneratorPage,
  }) => {
    await postalCodeGeneratorPage.recordClipboardWrites();
    await postalCodeGeneratorPage.stubRandomEndpoint([
      respondWith(firstResult),
    ]);
    await postalCodeGeneratorPage.navigate();

    await postalCodeGeneratorPage.generateWithKeyboard();

    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(firstResult.postalCode),
    ).toBeVisible();
    // A result arriving must not take focus away from the action that asked for
    // it, or the next step of the flow starts from somewhere unannounced.
    await expect(postalCodeGeneratorPage.generateAction()).toBeFocused();

    await expect(postalCodeGeneratorPage.copyAction()).toBeVisible();
    await postalCodeGeneratorPage.copyWithKeyboard();

    await expect
      .poll(() => postalCodeGeneratorPage.clipboardWrites())
      .toContain(firstResult.postalCode);
  });
});
