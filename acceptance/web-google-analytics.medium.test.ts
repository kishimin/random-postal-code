import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PostalCode } from "@zipnami/shared";
import { expect, test as shellTest } from "./fixtures";
import { normalizedPostalCodes } from "./fixtures/postal-code-dataset.ts";
import {
  createAnalyticsPage,
  type AnalyticsPage,
  type DataLayerEntry,
} from "./pages/analytics-page.ts";
import { refuseLiveThirdPartyRequests } from "./pages/dependency-failure-page.ts";
import {
  createGenerationHistoryPage,
  type GenerationHistoryPage,
} from "./pages/generation-history-page.ts";
import {
  createPostalCodeGeneratorPage,
  type PostalCodeGeneratorPage,
} from "./pages/postal-code-generator-page.ts";
import {
  consentRegions,
  consentTypes,
  testMeasurementId,
} from "./selectors/analytics-selectors.ts";

/*
 * Acceptance test for Issue #92: Measure Web visits with Google Analytics in
 * production (browser half).
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion. The repository
 * half (design.md, deploy settings, deploy.yml, docs/deployment.md, and the
 * content security policy) is web-google-analytics-release.medium.test.ts.
 *
 * The Out of scope section (custom events for user actions, a development
 * property, server-side tagging, Cloudflare Web Analytics) is untouched.
 *
 * Two builds
 * ----------
 * The preview server this suite runs against serves the build CI made, and CI
 * carries no measurement ID (Issue #92: only production does). That build is
 * where "a build without a measurement ID loads no Google Analytics script"
 * is held, and /privacy, whose text does not depend on an ID.
 *
 * Every other criterion needs a build that carries an ID. This file makes one
 * itself, once per worker, with the measurement ID passed the way the
 * production deploy passes it: under the environment name deploy.yml gives
 * ZIPNAMI_WEB_GA_MEASUREMENT_ID in the Pages build step. Reading the name from
 * the workflow keeps it the implementation decision, and keeps this test on
 * the path production really takes. That build is served on the preview
 * origin in place of the preview server, so the Page Objects run unchanged.
 *
 * Nothing contacts Google. Every third-party request is refused first, and
 * the tag loader is answered by a substitute that only records that it ran.
 *
 * How the consent and page-view criteria are read (Google documentation as
 * of 2026-11-03)
 * --------------------------------------------------------------------------
 * - Consent defaults: Google consent mode is set with
 *   gtag("consent", "default", {...}), "before any commands that send
 *   measurement data (such as config or event)", and a default may carry a
 *   region array of ISO 3166-2 codes; a default without a region applies to
 *   every visitor no region-specific default covers (Google tag platform,
 *   "Set up consent mode on websites"). So the criterion is held on the data
 *   layer the tag reads: regional defaults that deny every consent type for
 *   exactly the EEA, the UK, and Switzerland, a default without a region that
 *   grants them, and all of them queued before the first config or event
 *   command. The Privacy & messaging message (#39) then updates consent per
 *   visitor; that happens in Google code in production and is not observable
 *   here.
 * - Page views on screen changes: GA4 enhanced measurement counts a page view
 *   on browser history changes (pushState, replaceState, popstate), an
 *   advanced setting of the "Page views" option (Google Analytics Help,
 *   "Enhanced measurement events"). This test assumes that mechanism, which is
 *   also the only one compatible with "the application sends no custom
 *   events" without double counting: the application queues no event command
 *   at all, does not turn off page views in its config, and moves between
 *   screens as same-document History API navigations, which is what the tag
 *   listens to. Whether the property keeps that setting on is a console
 *   setting, so the release half holds docs/deployment.md to naming it.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const frontend = path.join(repositoryRoot, "apps", "web", "frontend");
const deployWorkflow = path.join(
  repositoryRoot,
  ".github",
  "workflows",
  "deploy.yml",
);

const BUILD_TIMEOUT_MS = 300_000;

/*
 * The environment name the Pages build reads the measurement ID from: the
 * key deploy.yml binds to vars.ZIPNAMI_WEB_GA_MEASUREMENT_ID. Undefined until
 * the deploy passes it, which this file then reports as the reason it cannot
 * build what production builds.
 */
const measurementIdEnvironmentName = (): string | undefined =>
  /^\s*([A-Za-z_][A-Za-z0-9_]*):\s*\$\{\{\s*(?:vars|secrets)\.ZIPNAMI_WEB_GA_MEASUREMENT_ID\s*\}\}\s*$/m.exec(
    readFileSync(deployWorkflow, "utf8"),
  )?.[1];

/**
 * Finds a postal code in the shared acceptance dataset.
 * @param postalCode - The canonical seven-digit code to look up.
 */
const datasetEntry = (postalCode: string): PostalCode => {
  const entry = normalizedPostalCodes.find(
    (candidate) => candidate.postalCode === postalCode,
  );

  if (!entry) {
    throw new Error("The acceptance dataset has no postal code " + postalCode);
  }

  return entry;
};

// No code or address in common, so a kept or replaced result is unambiguous.
const firstResult = datasetEntry("3670030");
const secondResult = datasetEntry("4980000");

/**
 * Builds the frontend the way the production deploy does, with a measurement
 * ID, into a directory of its own.
 * @param outDir - Where the build is written.
 */
const buildWithMeasurementId = (outDir: string) => {
  const name = measurementIdEnvironmentName();
  if (name === undefined) {
    throw new Error(
      "deploy.yml passes no ZIPNAMI_WEB_GA_MEASUREMENT_ID to the Pages build, so there is no production way to build with a measurement ID",
    );
  }

  const result = spawnSync(
    "bun",
    ["x", "vite", "build", "--outDir", outDir, "--emptyOutDir"],
    {
      cwd: frontend,
      encoding: "utf8",
      env: {
        ...process.env,
        VITE_API_BASE_URL: "http://127.0.0.1:8787",
        VITE_GOOGLE_MAPS_API_KEY: "",
        [name]: testMeasurementId,
      },
      timeout: BUILD_TIMEOUT_MS,
    },
  );
  if (result.status !== 0) {
    throw new Error(
      "production build with a measurement ID failed:\n" +
        result.stdout +
        "\n" +
        result.stderr,
    );
  }
};

/*
 * Extends the shell fixture rather than editing it (committed files under
 * acceptance/ are locked). The third-party guard is the first route every test
 * installs, so each substitute added afterwards takes precedence over it.
 */
const test = shellTest.extend<
  {
    analyticsPage: AnalyticsPage;
    generationHistoryPage: GenerationHistoryPage;
    postalCodeGeneratorPage: PostalCodeGeneratorPage;
  },
  { measuredBuild: string }
>({
  page: async ({ page }, use) => {
    await refuseLiveThirdPartyRequests(page);
    await use(page);
  },
  analyticsPage: async ({ page }, use) => {
    const analyticsPage = createAnalyticsPage(page);
    await use(analyticsPage);
    await analyticsPage.releaseHeldTag();
  },
  generationHistoryPage: async ({ page }, use) => {
    await use(createGenerationHistoryPage(page));
  },
  postalCodeGeneratorPage: async ({ page }, use) => {
    await use(createPostalCodeGeneratorPage(page));
  },
  // Once per worker: a production build takes far longer than a test.
  measuredBuild: [
    async ({}, use) => {
      const outDir = mkdtempSync(path.join(tmpdir(), "zipnami-ga-build-"));
      buildWithMeasurementId(outDir);
      await use(outDir);
      rmSync(outDir, { recursive: true, force: true });
    },
    { scope: "worker", timeout: BUILD_TIMEOUT_MS },
  ],
});

/** The commands on the data layer, without directly pushed objects. */
const commandsOf = (entries: readonly DataLayerEntry[]) =>
  entries.flatMap((entry) => ("command" in entry ? [entry.command] : []));

/** Whether an entry is an object pushed with an event key (Tag Manager form). */
const isPushedEvent = (entry: DataLayerEntry) =>
  "object" in entry &&
  typeof entry.object === "object" &&
  entry.object !== null &&
  "event" in entry.object;

/** Index of the first entry that measures something: config or an event. */
const firstMeasuringIndex = (entries: readonly DataLayerEntry[]) =>
  entries.findIndex(
    (entry) =>
      isPushedEvent(entry) ||
      ("command" in entry &&
        (entry.command[0] === "config" || entry.command[0] === "event")),
  );

/** The parameters of a consent default entry, or undefined if it is not one. */
const consentDefaultOf = (entry: DataLayerEntry) =>
  "command" in entry &&
  entry.command[0] === "consent" &&
  entry.command[1] === "default" &&
  typeof entry.command[2] === "object" &&
  entry.command[2] !== null
    ? new Map(Object.entries(entry.command[2]))
    : undefined;

const sorted = (values: readonly string[]) => [...values].sort();

test.describe("Issue #92: Google Analytics measures visits in production only", () => {
  test("a build without a measurement ID loads no Google Analytics script and makes no request to Google Analytics", async ({
    analyticsPage,
    page,
    generationHistoryPage,
    postalCodeGeneratorPage,
  }) => {
    await generationHistoryPage.stubGenerations([firstResult]);
    await postalCodeGeneratorPage.navigate();
    await generationHistoryPage.generate(firstResult.postalCode);

    // Moving between screens too: a tag that only loads on a later screen
    // would otherwise go unnoticed.
    await analyticsPage.followPrivacyLink();
    await expect(page).toHaveURL(/\/privacy$/);
    await analyticsPage.followHomeLink();
    await expect(page).toHaveURL(/\/$/);

    const scriptSources = await analyticsPage.scriptSources();
    expect(
      scriptSources.filter((source) => /\/gtag\/js\b/.test(source)),
    ).toEqual([]);
    expect(analyticsPage.analyticsRequests()).toEqual([]);
  });

  test("/privacy discloses Google Analytics: what is sent, the cookies it may set, its behavior in consent regions, and how to opt out", async ({
    privacyPage,
  }) => {
    await privacyPage.navigate();
    await expect(privacyPage.heading()).toBeVisible();
    const text = (await privacyPage.main().textContent()) ?? "";

    expect(text).toMatch(/Google\s*Analytics/);
    // What is sent: the pages visited, where the visit came from, the device,
    // and the region (the Issue lists page views, referrers, region, device).
    expect(text).toMatch(/\u30da\u30fc\u30b8|page/i);
    expect(text).toMatch(/\u53c2\u7167\u5143|\u30ea\u30d5\u30a1\u30e9|referr/i);
    expect(text).toMatch(/\u7aef\u672b|\u30c7\u30d0\u30a4\u30b9|device/i);
    expect(text).toMatch(/\u5730\u57df|region/i);
    // The cookies it may set: GA4 sets _ga and _ga_<container ID>.
    expect(text).toMatch(/Cookie|\u30af\u30c3\u30ad\u30fc/i);
    expect(text).toMatch(/_ga\b/);
    // Its behavior in consent regions.
    expect(text).toMatch(/\u6b27\u5dde\u7d4c\u6e08\u9818\u57df|EEA/);
    expect(text).toMatch(
      /\u82f1\u56fd|\u30a4\u30ae\u30ea\u30b9|UK|United Kingdom/,
    );
    expect(text).toMatch(/\u30b9\u30a4\u30b9|Switzerland/);
    expect(text).toMatch(/\u540c\u610f|consent/i);
    // How to opt out.
    expect(text).toMatch(/\u30aa\u30d7\u30c8\u30a2\u30a6\u30c8|opt.?out/i);
  });

  test.describe("a production build with a measurement ID", () => {
    test.beforeEach(async ({ analyticsPage, baseURL, measuredBuild }) => {
      await analyticsPage.serveBuild(
        measuredBuild,
        new URL(baseURL ?? "http://localhost:4173").origin,
      );
    });

    test("loads the Google Analytics 4 tag with the measurement ID it was built with", async ({
      analyticsPage,
      postalCodeGeneratorPage,
    }) => {
      await analyticsPage.answerTag();
      await postalCodeGeneratorPage.navigate();

      await expect
        .poll(() => analyticsPage.requestedMeasurementIds())
        .toContain(testMeasurementId);
      await expect
        .poll(async () =>
          commandsOf(await analyticsPage.dataLayerEntries()).some(
            (command) =>
              command[0] === "config" && command[1] === testMeasurementId,
          ),
        )
        .toBe(true);
    });

    test("consent defaults are declared before the tag measures anything: denied for the EEA, the UK, and Switzerland, and granted elsewhere", async ({
      analyticsPage,
      postalCodeGeneratorPage,
    }) => {
      await analyticsPage.answerTag();
      await postalCodeGeneratorPage.navigate();
      await expect
        .poll(() => analyticsPage.tagRequestCount())
        .toBeGreaterThan(0);
      await expect
        .poll(async () =>
          firstMeasuringIndex(await analyticsPage.dataLayerEntries()),
        )
        .toBeGreaterThanOrEqual(0);

      const entries = await analyticsPage.dataLayerEntries();
      const declaredBefore = entries
        .slice(0, firstMeasuringIndex(entries))
        .map(consentDefaultOf)
        .filter((parameters) => parameters !== undefined);

      // Region-specific defaults: together they name exactly the EEA, the
      // UK, and Switzerland, and each denies every consent type.
      const regional = declaredBefore.filter((parameters) =>
        Array.isArray(parameters.get("region")),
      );
      const regions = regional.flatMap((parameters) => {
        const region: unknown = parameters.get("region");
        return Array.isArray(region) ? region.map(String) : [];
      });
      expect(sorted(regions)).toEqual(sorted(consentRegions));
      expect(
        regional.map((parameters) =>
          consentTypes.map((type) => [type, parameters.get(type)]),
        ),
      ).toEqual(
        regional.map(() => consentTypes.map((type) => [type, "denied"])),
      );

      // The default without a region, for every other visitor, grants them.
      const elsewhere = declaredBefore.filter(
        (parameters) => !parameters.has("region"),
      );
      expect(elsewhere.length).toBeGreaterThan(0);
      expect(
        elsewhere.map((parameters) =>
          consentTypes.map((type) => [type, parameters.get(type)]),
        ),
      ).toEqual(
        elsewhere.map(() => consentTypes.map((type) => [type, "granted"])),
      );
    });

    test("the application sends no custom Analytics events, and moving between screens is a History API navigation the tag counts as a page view", async ({
      analyticsPage,
      page,
      generationHistoryPage,
      postalCodeGeneratorPage,
    }) => {
      await analyticsPage.answerTag();
      await generationHistoryPage.stubGenerations([firstResult, secondResult]);
      await postalCodeGeneratorPage.navigate();
      await expect
        .poll(() => analyticsPage.tagRequestCount())
        .toBeGreaterThan(0);
      await analyticsPage.markDocument();

      // The actions a custom event would have measured.
      await generationHistoryPage.generate(firstResult.postalCode);
      await generationHistoryPage.generate(secondResult.postalCode);

      // Each screen change keeps the document and changes the URL, which only
      // the History API does: the changes enhanced measurement counts.
      await analyticsPage.followPrivacyLink();
      await expect(page).toHaveURL(/\/privacy$/);
      expect(await analyticsPage.isSameDocument()).toBe(true);

      await analyticsPage.followHomeLink();
      await expect(page).toHaveURL(/\/$/);
      expect(await analyticsPage.isSameDocument()).toBe(true);

      await analyticsPage.goBack();
      await expect(page).toHaveURL(/\/privacy$/);
      expect(await analyticsPage.isSameDocument()).toBe(true);

      const entries = await analyticsPage.dataLayerEntries();
      const commands = commandsOf(entries);

      // The tag is configured, and nothing turns its page views off.
      const configs = commands.filter(
        (command) =>
          command[0] === "config" && command[1] === testMeasurementId,
      );
      expect(configs.length).toBeGreaterThan(0);
      expect(
        configs.filter((config) => {
          const parameters: unknown = config[2];
          return (
            typeof parameters === "object" &&
            parameters !== null &&
            Reflect.get(parameters, "send_page_view") === false
          );
        }),
      ).toEqual([]);

      // No event of any kind is queued by the application.
      expect(commands.filter((command) => command[0] === "event")).toEqual([]);
      expect(entries.filter(isPushedEvent)).toEqual([]);
    });

    const unavailableTags: readonly (readonly [
      string,
      (analyticsPage: AnalyticsPage) => Promise<void>,
    ])[] = [
      ["fails to load", (analyticsPage) => analyticsPage.failTag()],
      ["is blocked", (analyticsPage) => analyticsPage.blockTag()],
      ["never answers", (analyticsPage) => analyticsPage.holdTag()],
    ];

    unavailableTags.forEach(([condition, makeUnavailable]) => {
      test(
        "when Google Analytics " +
          condition +
          ", the postal code, its addresses, history, and regeneration stay usable",
        async ({
          analyticsPage,
          generationHistoryPage,
          postalCodeGeneratorPage,
        }) => {
          await makeUnavailable(analyticsPage);
          await generationHistoryPage.stubGenerations([
            firstResult,
            secondResult,
          ]);
          await analyticsPage.openGeneratorWithoutWaitingForLoad();

          // There has to have been a tag to lose, or this would hold for a
          // page that never measures.
          await expect
            .poll(() => analyticsPage.tagRequestCount())
            .toBeGreaterThan(0);

          await generationHistoryPage.generate(firstResult.postalCode);
          await Promise.all(
            firstResult.addresses.map((address) =>
              expect(
                postalCodeGeneratorPage.addressEntry(address),
              ).toBeVisible(),
            ),
          );

          await generationHistoryPage.generate(secondResult.postalCode);
          await expect(
            postalCodeGeneratorPage.postalCodeDisplay(secondResult.postalCode),
          ).toBeVisible();
          await Promise.all(
            secondResult.addresses.map((address) =>
              expect(
                postalCodeGeneratorPage.addressEntry(address),
              ).toBeVisible(),
            ),
          );
          await expect
            .poll(() => generationHistoryPage.historyPostalCodes())
            .toEqual([secondResult.postalCode, firstResult.postalCode]);

          // A tag that never answers was still outstanding throughout, so
          // nothing above can have been waiting on it.
          expect(
            condition !== "never answers" ||
              analyticsPage.answeredTagRequestCount() === 0,
          ).toBe(true);
        },
      );
    });
  });
});
