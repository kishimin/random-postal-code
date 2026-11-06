import type { PostalCode } from "@zipnami/shared";
import { expect, test as shellTest } from "./fixtures";
import { normalizedPostalCodes } from "./fixtures/postal-code-dataset.ts";
import {
  createAdvertisingPage,
  type AdvertisingPage,
} from "./pages/advertising-page.ts";
import {
  createPrivacyDisclosurePage,
  type PrivacyDisclosurePage,
} from "./pages/privacy-disclosure-page.ts";
import {
  createPostalCodeGeneratorPage,
  respondWith,
  type PostalCodeGeneratorPage,
} from "./pages/postal-code-generator-page.ts";
import { privacySelectors } from "./selectors/privacy-selectors.ts";

/*
 * Acceptance test for Issue #10: Publish privacy and postal-data attribution
 * information.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * The Issue's Out of scope section — legal advice, and claims not supported by
 * the implemented SDK configuration — is deliberately untouched. Nothing here
 * asserts that a sentence is legally sufficient, and nothing requires the page
 * to describe behaviour this repository has not built. design.md section 12
 * already routes the advertising and consent configuration to a human review
 * before release; whether the published sentences match that configuration is
 * that review's subject, not this file's.
 *
 * The page is divided by Figma's four section headings, and each statement is
 * asserted inside the section it sits under. That replaced the earlier split
 * into "data stored by Zipnami" and "data processed by third parties", and the
 * contact method went to V2 (Issue #105): the owner's decision, approved as an
 * acceptance-test rewrite on Issue #97 (ADR-0080),
 * https://github.com/kishimin/random-postal-code/issues/97#issuecomment-6670298264.
 *
 * Nothing here contacts Google. The generator screen loads the AdSense tag, so
 * the tests that visit it refuse every advertising and consent request at the
 * network boundary first, the same way Issue #9's acceptance test does.
 * `GET /api/random` is stubbed for the same reason that test stubs it: a real
 * service returns an unknown postal code, and the criterion below is about the
 * credit that sits beside a known address.
 *
 * Three criteria are held in a narrower form than their wording suggests, and
 * the difference is deliberate.
 *
 * "It states that Zipnami does not issue its own user identifier or store
 * advertising identifiers on its server" is held as a statement on the page,
 * which is what the criterion's own verb asks for. That the product behaves
 * that way is not held here and cannot be: proving an absence at runtime means
 * enumerating every path by which an identifier could be issued or stored, and
 * a check that misses one still passes (ADR-0019). The server side of that
 * claim is the API's boundary, which Issue #11 owns.
 *
 * "The product does not present Japan Post data as proprietary Zipnami address
 * data" is held in its positive form: the screen that shows an address credits
 * Japan Post as the source of the data on it. The negative form would require
 * ruling out every possible phrasing of an ownership claim, which has the same
 * problem as above — and a page carrying the credit beside the addresses is
 * the observable state the criterion exists to produce.
 *
 * "readable on mobile layouts" is held as content that is present and reachable
 * at a narrow viewport without horizontal scrolling, and by the whole file also
 * running on this suite's two phone projects. Whether the result looks good is
 * an appearance judgement this repository keeps out of automated tests
 * (ADR-0012).
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

// More than one address, so the credit is shown to sit beside a real result
// rather than beside an empty region.
const result = datasetEntry("3670030");

const { collectedInformation, purposeOfUse, advertisingAndAnalytics, history } =
  privacySelectors.sectionHeadings;

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
  privacyDisclosurePage: PrivacyDisclosurePage;
}>({
  advertisingPage: async ({ page }, use) => {
    await use(createAdvertisingPage(page));
  },
  postalCodeGeneratorPage: async ({ page }, use) => {
    await use(createPostalCodeGeneratorPage(page));
  },
  privacyDisclosurePage: async ({ page }, use) => {
    await use(createPrivacyDisclosurePage(page));
  },
});

test.describe("Issue #10: the privacy and attribution disclosure", () => {
  test("a visitor reaches the disclosure from the application using the keyboard alone", async ({
    advertisingPage,
    postalCodeGeneratorPage,
    privacyDisclosurePage,
  }) => {
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.navigate();

    // Reachable means a visitor who does not know the address can still get
    // there, so the route is arrived at by activating a link rather than by
    // typing the path.
    await expect(privacyDisclosurePage.disclosureLink()).toBeVisible();
    await privacyDisclosurePage.openDisclosureWithKeyboard();

    await expect
      .poll(() => privacyDisclosurePage.currentPath())
      .toBe("/privacy");
    await expect(privacyDisclosurePage.heading()).toBeVisible();
  });

  test("a direct request for /privacy is answered by the disclosure itself", async ({
    privacyDisclosurePage,
  }) => {
    const response = await privacyDisclosurePage.navigate();

    // Publicly reachable: the address answers with the page, with nothing in
    // front of it to sign in to or dismiss first.
    expect(response?.status()).toBe(200);
    await expect(privacyDisclosurePage.main()).toBeVisible();
    await expect(privacyDisclosurePage.heading()).toBeVisible();
  });

  test("the disclosure has Figma's four section headings, each heading its own region", async ({
    privacyDisclosurePage,
  }) => {
    await privacyDisclosurePage.navigate();

    // Separately named regions rather than one page of prose. Exactly one of
    // each: a second section answering to the same name would leave a reader
    // unable to tell which one a paragraph belongs to, and would make the
    // placements asserted below ambiguous. The heading is looked for inside
    // its region, so a region merely labelled with the same words does not
    // count as that heading's section.
    for (const name of privacyDisclosurePage.sectionHeadings) {
      await expect(privacyDisclosurePage.section(name), name).toHaveCount(1);
      await expect(privacyDisclosurePage.section(name), name).toBeVisible();
      await expect(
        privacyDisclosurePage.headingOfSection(name),
        name,
      ).toHaveCount(1);
      await expect(
        privacyDisclosurePage.headingOfSection(name),
        name,
      ).toBeVisible();
    }

    // ui-design.md section 8: one h1 per page. The disclosure's own sections
    // sit under the page title rather than beside it.
    await expect(privacyDisclosurePage.topLevelHeadings()).toHaveCount(1);
  });

  test("the disclosure documents Google Maps under 2. 利用目的, and Google AdSense and consent under 3. 広告とアクセス解析", async ({
    privacyDisclosurePage,
  }) => {
    await privacyDisclosurePage.navigate();

    // Each is asserted against the section it sits under rather than the
    // page, so that naming a service is also the act of placing it: a page
    // that described Google Maps under 1. 取得する情報 as information Zipnami
    // itself collects would not satisfy this.
    await expect(
      privacyDisclosurePage.sectionStating(
        purposeOfUse,
        privacySelectors.googleMaps,
      ),
    ).toHaveCount(1);
    await expect(
      privacyDisclosurePage.sectionStating(
        advertisingAndAnalytics,
        privacySelectors.googleAdSense,
      ),
    ).toHaveCount(1);
    await expect(
      privacyDisclosurePage.sectionStating(
        advertisingAndAnalytics,
        privacySelectors.consent,
      ),
    ).toHaveCount(1);
  });

  test("the disclosure documents the browser-local history under 4. 履歴, and that no location is collected under 1. 取得する情報", async ({
    privacyDisclosurePage,
  }) => {
    await privacyDisclosurePage.navigate();

    // Where the history lives is what its own section is for (design.md
    // section 6.2), and the absence of location collection is a statement
    // about what Zipnami itself collects (design.md section 2).
    await expect(
      privacyDisclosurePage.sectionStating(
        history,
        privacySelectors.browserLocalHistory,
      ),
    ).toHaveCount(1);
    await expect(
      privacyDisclosurePage.sectionStating(
        collectedInformation,
        privacySelectors.noLocationCollection,
      ),
    ).toHaveCount(1);
  });

  test("the disclosure states under 1. 取得する情報 that no identifier of its own is issued and no advertising identifier is stored", async ({
    privacyDisclosurePage,
  }) => {
    await privacyDisclosurePage.navigate();

    // Two separate statements, because the Issue asks for two: one about an
    // identifier Zipnami could have minted, one about an identifier the
    // advertising SDK supplies. A page denying only the first would leave the
    // second unanswered.
    await expect(
      privacyDisclosurePage.sectionStating(
        collectedInformation,
        privacySelectors.noOwnUserIdentifier,
      ),
    ).toHaveCount(1);
    await expect(
      privacyDisclosurePage.sectionStating(
        collectedInformation,
        privacySelectors.noStoredAdvertisingIdentifier,
      ),
    ).toHaveCount(1);
  });

  test("the screen showing an address credits Japan Post as the source of the postal data", async ({
    advertisingPage,
    postalCodeGeneratorPage,
    privacyDisclosurePage,
  }) => {
    await advertisingPage.failEveryAdvertisingRequest();
    await postalCodeGeneratorPage.stubRandomEndpoint([respondWith(result)]);
    await postalCodeGeneratorPage.navigate();
    await postalCodeGeneratorPage.generate();

    // The addresses have to be on screen, or the credit would be shown to
    // accompany nothing and the criterion would hold for a page that never
    // displays Japan Post's data at all.
    await expect(
      postalCodeGeneratorPage.postalCodeDisplay(result.postalCode),
    ).toBeVisible();

    for (const address of result.addresses) {
      await expect(postalCodeGeneratorPage.addressEntry(address)).toBeVisible();
    }

    await expect(privacyDisclosurePage.japanPostCredit()).toBeVisible();

    // And on the information page, which is the other place the Issue accepts
    // the credit in. Reading one screen's credit says nothing about the other.
    await privacyDisclosurePage.navigate();
    await expect(privacyDisclosurePage.japanPostCredit()).toBeVisible();
  });

  test("the disclosure stays readable at a 320px viewport without horizontal scrolling", async ({
    privacyDisclosurePage,
  }) => {
    await privacyDisclosurePage.resizeToNarrowPhone();
    await privacyDisclosurePage.navigate();

    await expect(privacyDisclosurePage.heading()).toBeVisible();
    expect(await privacyDisclosurePage.hasHorizontalOverflow()).toBe(false);

    // Narrow layouts lose content by collapsing it away, so the parts a
    // visitor came for are checked to still be there rather than only that
    // nothing overflowed.
    for (const name of privacyDisclosurePage.sectionHeadings) {
      await expect(privacyDisclosurePage.section(name), name).toBeVisible();
    }
    await expect(privacyDisclosurePage.japanPostCredit()).toBeVisible();
  });
});
