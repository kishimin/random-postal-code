import type { Page, Response } from "@playwright/test";
import type { Address } from "@zipnami/shared";
import {
  anyDisplayedPostalCode,
  displayedPostalCode,
  externalMapLinkSelector,
  mapEmbedSelector,
  mapEmbedUrlPattern,
  productionSelectors,
  randomEndpointPattern,
} from "../selectors/production-selectors.ts";

/** One generation, as the Worker answered it. */
export type GeneratedPostalCode = {
  readonly postalCode: string;
  readonly addresses: readonly Address[];
};

/** What the deployed Worker answered one generation with. */
export type WorkerAnswer = {
  readonly status: number;
  /** The origin the page called: the Worker baked in at build time. */
  readonly apiOrigin: string;
  /** The origin of the page that called it: the Pages site. */
  readonly pageOrigin: string;
  /** The parsed body, or null when it was not JSON. */
  readonly body: GeneratedPostalCode | null;
};

/**
 * Page Object for the deployed Web MVP (Issue #104).
 *
 * Nothing here answers a request. The site calls the Worker its build was
 * given, and the map loads from Google; only the hosts the fixture blocks are
 * refused.
 * @param {Page} page - The Playwright page, as the production fixture prepared it.
 */
export const createProductionSitePage = (page: Page) => {
  const navigate = () => page.goto("/");

  const navigateToPrivacy = () => page.goto("/privacy");

  const reload = () => page.reload();

  const isWorkerGeneration = (response: Response) =>
    randomEndpointPattern.test(new URL(response.url()).pathname) &&
    response.request().method() === "GET";

  const generateAction = () =>
    page.getByRole("button", { name: productionSelectors.generateAction });

  const copyAction = () =>
    page.getByRole("button", { name: productionSelectors.copyAction });

  /**
   * Generates once and returns what the Worker answered. The response is
   * awaited, not the screen, because the screen is checked against it.
   */
  const generateThroughWorker = async (): Promise<WorkerAnswer> => {
    const answered = page.waitForResponse(isWorkerGeneration);
    await generateAction().click();
    const response = await answered;
    const body = (await response
      .json()
      .catch(() => null)) as GeneratedPostalCode | null;

    return {
      status: response.status(),
      apiOrigin: new URL(response.url()).origin,
      pageOrigin: new URL(page.url()).origin,
      body,
    };
  };

  /*
   * The current result. Since Issue #7 the history repeats the same codes
   * and addresses inside main, so a match anywhere in main could be the
   * history rather than the result.
   */
  const resultRegion = () =>
    page.getByRole("main").getByTestId("result-region");

  const postalCodeDisplay = (postalCode: string) =>
    resultRegion().getByText(displayedPostalCode(postalCode), { exact: true });

  /*
   * The result's address rows, in the order the Worker returned them
   * (ui-design.md section 5.3 renders them in source order). Matched by
   * position rather than by text: a town that is a prefix of another in the
   * same result (本町 and 本町通), or an empty town, would make a text filter
   * match more than one row.
   */
  const resultAddressEntries = () => resultRegion().getByRole("listitem");

  /**
   * The row of the address at this position in the Worker's answer.
   * @param {number} index - Its position among the answer's addresses.
   */
  const resultAddressEntry = (index: number) =>
    resultAddressEntries().nth(index);

  /**
   * The `href` of each Google Maps link of one row, exactly as written: only
   * the raw attribute shows whether the query was encoded.
   * @param {number} index - The row's position among the answer's addresses.
   */
  const externalMapHrefs = async (index: number) => {
    const links = await resultAddressEntry(index)
      .locator(externalMapLinkSelector)
      .all();

    return Promise.all(
      links.map(async (link) => (await link.getAttribute("href")) ?? ""),
    );
  };

  const mapRegion = () =>
    page.getByRole("region", { name: productionSelectors.mapRegion });

  // The frame loads only once it is in view, as it does for a visitor who
  // scrolls to it.
  const revealMap = () => mapRegion().scrollIntoViewIfNeeded();

  const mapEmbed = () => mapRegion().locator(mapEmbedSelector);

  const mapEmbedSource = () => mapEmbed().getAttribute("src");

  /*
   * Waits for the embedded map to finish loading. The site replaces a frame
   * that has not loaded in time with the fallback link, so a frame still
   * there after its load is one the site kept.
   */
  const waitForMapEmbedToLoad = async () => {
    const frame = await (await mapEmbed().elementHandle()).contentFrame();
    if (frame === null) {
      throw new Error("The map embed has no frame to load.");
    }
    // A frame just attached starts on about:blank, whose load would resolve
    // before Google has answered.
    await frame.waitForURL(mapEmbedUrlPattern);
    await frame.waitForLoadState("load");
  };

  /*
   * Google's answer to a key it refuses (wrong referrer, API not enabled).
   * That page still fires `load`, so the site keeps the frame and only its
   * content shows the key was rejected.
   */
  const mapEmbedRejection = () =>
    page
      .frameLocator(mapEmbedSelector)
      .getByText(productionSelectors.mapsKeyRejected);

  const copy = () => copyAction().click();

  // The real clipboard: the production config grants the permission, so
  // nothing stands in for navigator.clipboard. Passed as a string because
  // this tsconfig carries no DOM types.
  const clipboardText = () =>
    page.evaluate<string>("navigator.clipboard.readText()");

  /*
   * Opens the history list the way a visitor does, through 履歴を展開
   * (ui-design.md section 9.2). A list already open is left as it is.
   */
  const openHistory = async () => {
    const control = page.getByRole("button", {
      name: productionSelectors.expandHistory,
    });
    if ((await control.getAttribute("aria-expanded")) !== "true") {
      await control.click();
    }
  };

  /*
   * The canonical codes the history lists, newest first. An entry is a list
   * item carrying a postal code; the result's own address rows carry none.
   */
  const historyPostalCodes = async () => {
    await openHistory();
    const entryTexts = await page
      .getByRole("main")
      .getByRole("listitem")
      .filter({ hasText: anyDisplayedPostalCode })
      .allTextContents();

    return entryTexts.map(
      (entryText) =>
        entryText.match(anyDisplayedPostalCode)?.at(0)?.replace("-", "") ??
        entryText,
    );
  };

  const privacyLink = () =>
    page.getByRole("link", { name: productionSelectors.privacyLink });

  const openPrivacy = () => privacyLink().click();

  const privacyHeading = () =>
    page.getByRole("heading", {
      level: 1,
      name: productionSelectors.privacyHeading,
    });

  /**
   * The first element of the page stating this, so a statement repeated in
   * a heading and its paragraph is still one match. The whole page, not
   * main: the Japan Post credit is in the footer every screen shares.
   * @param {RegExp} statement - What the page has to say.
   */
  const privacyStatement = (statement: RegExp) =>
    page.getByText(statement).first();

  return {
    navigate,
    navigateToPrivacy,
    reload,
    generateThroughWorker,
    postalCodeDisplay,
    resultAddressEntries,
    resultAddressEntry,
    externalMapHrefs,
    revealMap,
    mapEmbed,
    mapEmbedSource,
    waitForMapEmbedToLoad,
    mapEmbedRejection,
    copy,
    clipboardText,
    historyPostalCodes,
    openPrivacy,
    privacyHeading,
    privacyStatement,
  };
};

export type ProductionSitePage = ReturnType<typeof createProductionSitePage>;
