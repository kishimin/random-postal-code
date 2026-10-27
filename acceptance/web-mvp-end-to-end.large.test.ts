import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Address, PostalCode } from "@zipnami/shared";
import { expect, test as shellTest } from "./fixtures";
import { refuseLiveThirdPartyRequests } from "./pages/dependency-failure-page.ts";
import {
  createWebMvpJourneyPage,
  type WebMvpJourneyPage,
} from "./pages/web-mvp-journey-page.ts";
import {
  loadingText,
  representativeViewports,
} from "./selectors/accessibility-selectors.ts";

/*
 * Acceptance test for Issue #21: Verify the Zipnami Web MVP end to end.
 *
 * Why this file is Large
 * ----------------------
 * Every earlier Web acceptance test answers `GET /api/random` itself, so none
 * of them shows that the production build actually reaches a Worker, that the
 * Worker answers from the dataset it bundles, or that its CORS allowlist lets
 * the site in and keeps other origins out. This file stubs nothing on that
 * path. It runs against two real processes: the production build served by
 * `vite preview`, and the Worker served by `wrangler dev`, with the build
 * pointed at the Worker through VITE_API_BASE_URL (Issue #21 answer B,
 * docs/deployment.md "To try it locally"). Two processes and a real HTTP hop
 * between them are what make it Large (ADR-0004, ADR-0044).
 *
 * What it expects from its runner
 * -------------------------------
 * - The page origin (Playwright `baseURL`) serves `vite build` output through
 *   `vite preview`, not the dev server.
 * - The build was made with VITE_API_BASE_URL naming a Worker reachable from
 *   the browser, and with a non-empty placeholder VITE_GOOGLE_MAPS_API_KEY so
 *   the map takes the path a deployment takes rather than the no-key
 *   fallback. No real key is needed: Google is never reached.
 * - The Worker runs with ALLOWED_ORIGINS naming exactly the page origin.
 * - Nothing listens on DISALLOWED_SITE_ORIGIN below; it is answered at the
 *   route, and only its origin matters.
 *
 * Third parties are refused, not reached
 * --------------------------------------
 * ui-design.md section 11 asks Large tests for "production-like Web SDK
 * configuration without real advertisement interaction". The Issue #17 guard
 * that refuses every non-local host is installed before anything else, so
 * the advertising, consent, and Maps scripts the build asks for are refused
 * rather than loaded. Where a test needs the embedded map to answer, it is
 * answered at the route by the Issue #8 Page Object. The Worker is local, so
 * the guard never touches it.
 *
 * Criteria held elsewhere
 * -----------------------
 * - "uniformly selected": uniformity is a statistical property of the
 *   selection, held deterministically by the Worker's own tests and the
 *   Issue #4 acceptance test. Here the selection is held to be real: every
 *   code the screen shows is one the Worker drew from its dataset, shown
 *   with every address that dataset holds for it.
 * - "/privacy and Japan Post attribution are publicly accessible and match
 *   deployed Web SDKs" needs the deployed site (Issue #19), and stays open on
 *   Issue #21 until then. The local half of it is the Issue #10 acceptance
 *   test.
 * - "Representative ... checks are recorded": this file is the reproducible
 *   check for each category; the record of a release run is
 *   docs/release-checklist.md, held by web-mvp-release-checklist.medium.test.ts.
 * - "All required formatting, type, lint, test, coverage, and build gates
 *   pass" is enforced by the ruleset on the default branch, which the Issue
 *   #18 acceptance tests (ci-quality-gates.*.test.ts) already hold. Running
 *   them again here would prove nothing new.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/*
 * The dataset the Worker bundles. Read from the artifact itself rather than
 * from an acceptance fixture, because the claim under test is that what the
 * screen shows came from what the Worker serves; a fixture would only be a
 * copy of it. When Issue #34's full dataset replaces this artifact, the test
 * reads that instead without changing.
 */
const workerDataset = JSON.parse(
  readFileSync(
    path.join(
      repositoryRoot,
      "apps",
      "web",
      "backend",
      "src",
      "data",
      "postal-codes.generated.json",
    ),
    "utf8",
  ),
) as PostalCode[];

/**
 * The dataset entry for a postal code, or undefined when the dataset has none.
 * @param postalCode - The canonical seven-digit code.
 */
const datasetEntry = (postalCode: string) =>
  workerDataset.find((entry) => entry.postalCode === postalCode);

/*
 * A browser origin the Worker must refuse: the same host as the site on the
 * next port. Same scheme and host means only the allowlist can tell the two
 * apart, which a check on hostname alone, a wildcard, or a prefix match
 * would get wrong. It is plain http on purpose: an https page would have its
 * request to a local http Worker blocked as mixed content, and the refusal
 * would then say nothing about CORS.
 */
const DISALLOWED_SITE_ORIGIN = "http://localhost:4174";

// A second refused origin, unrelated to the site, checked at the header level
// only (a browser page on it could not be loaded without leaving the machine).
const UNRELATED_ORIGIN = "https://zipnami.example.com";

// design.md section 6.2.
const HISTORY_LIMIT = 20;

/**
 * Whether a map query names every part of an address.
 * @param query - The decoded address query taken from a Google Maps URL.
 * @param address - The address the query is supposed to name.
 */
const namesFullAddress = (query: string, address: Address) =>
  query.includes(address.prefecture) &&
  query.includes(address.city) &&
  query.includes(address.town);

/**
 * The representative viewport of the given width (ui-design.md section 10).
 * @param width - The CSS pixel width to look up.
 */
const viewportOfWidth = (width: number) => {
  const viewport = representativeViewports.find(
    (candidate) => candidate.width === width,
  );
  if (viewport === undefined) {
    throw new Error(`No representative viewport is ${width}px wide.`);
  }
  return viewport;
};

// Mobile, tablet, and desktop, as the criterion names them.
const mobileTabletDesktop = [
  viewportOfWidth(390),
  viewportOfWidth(768),
  viewportOfWidth(1440),
];

/*
 * Extends the shell fixture rather than editing it (committed files under
 * acceptance/ are locked).
 *
 * `page` itself is extended so the third-party guard is the first route
 * every test installs, as in the Issue #17 acceptance test: Playwright
 * consults the most recent matching route first, so a substitute a test
 * adds afterwards still answers its own requests, and only what none of
 * them answers reaches the guard. Held advertising requests are released
 * after each test so none is left open when the page closes.
 */
const test = shellTest.extend<{ journeyPage: WebMvpJourneyPage }>({
  page: async ({ page }, use) => {
    await refuseLiveThirdPartyRequests(page);
    await use(page);
  },
  journeyPage: async ({ page }, use) => {
    const journeyPage = createWebMvpJourneyPage(page);
    await use(journeyPage);
    await journeyPage.releaseHeldAdvertisingRequests();
  },
});

/**
 * Generates once and returns the Worker's answer, after holding that the
 * page reached a real Worker and got a postal code back.
 * @param journeyPage - The generator screen on the local stack.
 */
const generateFromWorker = async (journeyPage: WebMvpJourneyPage) => {
  const answer = await journeyPage.generateThroughWorker();

  // A CORS refusal or a Worker failure shows up here first, as a status
  // other than 200, before the screen can say anything.
  expect(answer.status).toBe(200);
  // Pages and the Worker are separate origins (design.md section 10), so a
  // page that answered its own /api/random is not the stack under test.
  expect(answer.apiOrigin).not.toBe(answer.pageOrigin);

  const { postalCode } = answer.body as { postalCode: string };
  await expect(journeyPage.postalCodeDisplay(postalCode)).toBeVisible();

  return answer.body as PostalCode;
};

test.describe("Issue #21: the Web MVP end to end on a local production stack", () => {
  test("a generated postal code is one the Worker drew from its dataset, shown with every address the dataset holds for it", async ({
    journeyPage,
  }) => {
    journeyPage.recordSiteRequests();
    await journeyPage.navigate();

    // Several draws, so a screen that showed one fixed code, or a Worker that
    // answered one, would not pass on the first by luck.
    const drawn: string[] = [];
    for (let draw = 0; draw < 5; draw += 1) {
      const generated = await generateFromWorker(journeyPage);
      drawn.push(generated.postalCode);

      expect(generated.postalCode).toMatch(/^\d{7}$/);

      const entry = datasetEntry(generated.postalCode);
      expect({
        postalCode: generated.postalCode,
        inDataset: entry !== undefined,
      }).toEqual({ postalCode: generated.postalCode, inDataset: true });

      // Every address, not only the first: the Worker returns the entry
      // whole, and the screen shows each address of it as its own entry.
      expect(generated.addresses).toEqual(entry?.addresses);
      for (const address of entry?.addresses ?? []) {
        await expect(journeyPage.resultAddressEntry(address)).toHaveCount(1);
        await expect(journeyPage.resultAddressEntry(address)).toBeVisible();
      }
    }

    /*
     * The draws vary (Issue #82). Without this, a Worker that always returned
     * the same code would pass: each check above would be met by the result
     * the previous draw already put on screen. Uniformity itself stays with
     * the Worker's tests and the Issue #4 acceptance test. With the five-entry
     * placeholder dataset, five uniform draws are all the same code about
     * once in 625 runs, which CI's retries absorb; with Issue #34's full
     * dataset that chance is negligible.
     */
    expect(new Set(drawn).size).toBeGreaterThan(1);

    // Production build: everything the page loaded from its own origin came
    // out of `vite build`. A dev server would have served module sources.
    expect(journeyPage.siteRequestPaths().length).toBeGreaterThan(0);
    expect(journeyPage.developmentServerRequests()).toEqual([]);
  });

  test("the postal code is copied, an address becomes the embedded map's target, and every address opens in Google Maps", async ({
    journeyPage,
  }) => {
    await journeyPage.stubMapEmbed("served");
    await journeyPage.recordClipboardWrites();
    await journeyPage.navigate();

    const generated = await generateFromWorker(journeyPage);

    await journeyPage.copy();

    // The canonical seven digits, as the Worker returned them (ui-design.md
    // section 5.3), not the hyphenated form the screen shows.
    await expect
      .poll(() => journeyPage.clipboardWrites())
      .toContain(generated.postalCode);

    // The last address, so that whenever the Worker returns more than one,
    // choosing it moves the map off the first address it starts on. A
    // single-address result still holds that choosing works.
    const [firstAddress, ...laterAddresses] = generated.addresses;
    const target = laterAddresses.at(-1) ?? firstAddress;
    await journeyPage.revealMap();
    await journeyPage.selectResultMapTarget(target);

    await expect
      .poll(() => journeyPage.currentEmbeddedAddress())
      .toContain(target.town);
    expect(namesFullAddress(journeyPage.currentEmbeddedAddress(), target)).toBe(
      true,
    );

    for (const address of generated.addresses) {
      await expect(
        journeyPage.resultExternalMapLinks(address).first(),
      ).toBeVisible();

      const queries = await journeyPage.resultExternalMapAddresses(address);
      expect({
        town: address.town,
        opensThisAddress: queries.some((query) =>
          namesFullAddress(query, address),
        ),
      }).toEqual({ town: address.town, opensThisAddress: true });
    }
  });

  test("history survives a reload, keeps every generation including repeats, and drops the oldest after twenty", async ({
    journeyPage,
  }) => {
    // Twenty-one real round trips.
    test.slow();
    await journeyPage.navigate();

    const generated = await journeyPage.generateTimes(HISTORY_LIMIT + 1);

    /*
     * The Worker chooses the codes, so this cannot pick a repeat; it can only
     * require that history mirrors exactly what was generated. That is the
     * whole criterion at once: newest first, the oldest of twenty-one gone,
     * and a code drawn twice present twice, because collapsing a repeat would
     * make the history shorter than the generations it mirrors. With the
     * five-entry placeholder dataset, twenty-one draws must repeat; with the
     * full dataset, the Issue #7 acceptance test holds repeats on a stub.
     */
    const expected = generated.slice(-HISTORY_LIMIT).reverse();

    await expect.poll(() => journeyPage.historyPostalCodes()).toEqual(expected);
    await expect(journeyPage.historyEntries()).toHaveCount(HISTORY_LIMIT);

    await journeyPage.reload();

    await expect.poll(() => journeyPage.historyPostalCodes()).toEqual(expected);
  });

  test("with Maps, advertising, and consent all refused, the Worker still generates, the addresses still show, and copying still works", async ({
    journeyPage,
  }) => {
    // Every Maps, advertising, and consent request is refused, and counted:
    // the third-party guard would refuse them too, but without counting, a
    // build that never asked for them would pass as well (Issue #82).
    await journeyPage.stubMapEmbed("unreachable");
    await journeyPage.refuseEveryAdvertisingRequest();
    await journeyPage.recordClipboardWrites();
    await journeyPage.navigate();

    const generated = await generateFromWorker(journeyPage);

    // The dependencies were really asked for, and really refused. The map
    // loads only once it is in view, so it is brought into view first.
    // Consent is part of the advertising tag (design.md section 12), so the
    // advertising boundary is where a consent request would appear.
    await journeyPage.revealMap();
    await expect.poll(() => journeyPage.mapRequestCount()).toBeGreaterThan(0);
    await expect
      .poll(() => journeyPage.refusedAdvertisingRequestCount())
      .toBeGreaterThan(0);

    for (const address of generated.addresses) {
      await expect(journeyPage.resultAddressEntry(address)).toBeVisible();
      // ui-design.md section 7: a map failure falls back to the external
      // link, so the visitor can still open the address.
      await expect(
        journeyPage.resultExternalMapLinks(address).first(),
      ).toBeVisible();
    }

    await journeyPage.copy();
    await expect
      .poll(() => journeyPage.clipboardWrites())
      .toContain(generated.postalCode);

    await expect
      .poll(() => journeyPage.historyPostalCodes())
      .toEqual([generated.postalCode]);

    // And generating again still reaches the Worker.
    await generateFromWorker(journeyPage);
  });

  test("with advertising and consent never answering and Maps unreachable, the Worker's result still renders", async ({
    journeyPage,
  }) => {
    // A dependency that never answers is the case that would gate rendering
    // if anything waited on it; a refusal would end the wait and hide that.
    await journeyPage.holdEveryAdvertisingRequest();
    await journeyPage.stubMapEmbed("unreachable");
    await journeyPage.navigate();

    const generated = await generateFromWorker(journeyPage);

    for (const address of generated.addresses) {
      await expect(journeyPage.resultAddressEntry(address)).toBeVisible();
    }
    await expect(journeyPage.generateAction()).toBeEnabled();

    // The requests that never answer were really made, so the result above
    // rendered while they were open rather than because nothing was asked
    // for (Issue #82).
    await journeyPage.revealMap();
    await expect.poll(() => journeyPage.mapRequestCount()).toBeGreaterThan(0);
    await expect
      .poll(() => journeyPage.advertisingRequestCount())
      .toBeGreaterThan(0);
  });

  test("the Worker authorizes the site's own origin and no other, and a browser on another origin cannot read it", async ({
    journeyPage,
  }) => {
    await journeyPage.navigate();
    const siteOrigin = journeyPage.pageOrigin();

    // The site reaching the Worker at all is the allowed half: generating
    // asserts a 200 from a different origin.
    await generateFromWorker(journeyPage);

    const asSite = await journeyPage.askWorkerAs(siteOrigin, "read");
    expect(asSite.allowedOrigin).toBe(siteOrigin);

    // api-design.md section 6: only an origin present verbatim in the
    // allowlist is authorized, so neither a refused origin nor a wildcard
    // may come back, for a read or for the preflight a browser sends first.
    for (const origin of [DISALLOWED_SITE_ORIGIN, UNRELATED_ORIGIN]) {
      for (const kind of ["read", "preflight"] as const) {
        const answer = await journeyPage.askWorkerAs(origin, kind);
        expect({ origin, kind, allowedOrigin: answer.allowedOrigin }).toEqual({
          origin,
          kind,
          allowedOrigin: null,
        });
      }
    }

    // What the headers mean, as a browser enforces it: the same script reads
    // the Worker from the site and is refused from the origin next door.
    expect(await journeyPage.readWorkerFromThisSite()).toBe("read");
    expect(await journeyPage.readWorkerFrom(DISALLOWED_SITE_ORIGIN)).toBe(
      "refused",
    );
  });

  for (const viewport of mobileTabletDesktop) {
    test(`at ${viewport.name}, a result from the Worker fits the width and passes the WCAG A and AA scan`, async ({
      journeyPage,
    }) => {
      await journeyPage.stubMapEmbed("served");
      await journeyPage.resizeTo(viewport);
      await journeyPage.navigate();

      const generated = await generateFromWorker(journeyPage);
      for (const address of generated.addresses) {
        await expect(journeyPage.resultAddressEntry(address)).toBeVisible();
      }

      // ui-design.md section 5.1: no horizontal scrolling for primary
      // content, measured on the screen as the Worker filled it rather than
      // on a stubbed result whose length the test chose.
      expect(await journeyPage.hasHorizontalOverflow()).toBe(false);

      // The Issue #16 scan, on the production build with real data.
      expect(await journeyPage.scanForViolations()).toEqual([]);
    });
  }

  test("offline, a generation fails visibly and keeps what was shown, and back online the Worker answers again", async ({
    journeyPage,
  }) => {
    await journeyPage.navigate();

    const before = await generateFromWorker(journeyPage);
    const announcedOnSuccess = await journeyPage.announcementText();

    await journeyPage.goOffline();
    await journeyPage.generate();
    await expect(journeyPage.generateAction()).toBeEnabled();

    /*
     * The visitor is told about the failure (design.md section 6.1): the
     * announcement settles on something that is neither empty, nor the
     * success they were last told, nor the loading message. Without the last
     * part, "still loading" would pass for "failed" (Issue #82). The Issue
     * #17 acceptance test holds the offline message apart from the API's own
     * failures on a stub.
     */
    const isFailureAnnouncement = (text: string) =>
      text !== "" && text !== announcedOnSuccess && !loadingText.test(text);
    await expect
      .poll(async () =>
        isFailureAnnouncement(await journeyPage.announcementText()),
      )
      .toBe(true);

    // A failure must not discard the last result or the history.
    await expect(
      journeyPage.postalCodeDisplay(before.postalCode),
    ).toBeVisible();
    for (const address of before.addresses) {
      await expect(journeyPage.resultAddressEntry(address)).toBeVisible();
    }
    await expect
      .poll(() => journeyPage.historyPostalCodes())
      .toEqual([before.postalCode]);

    await journeyPage.goOnline();
    await generateFromWorker(journeyPage);

    await expect(journeyPage.historyEntries()).toHaveCount(2);
  });
});
