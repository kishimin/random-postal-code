import type { Page, Request } from "@playwright/test";
import type { Address, PostalCode } from "@zipnami/shared";
import { anyDisplayedPostalCode } from "../selectors/generator-selectors.ts";
import { historySelectors } from "../selectors/history-selectors.ts";
import {
  createPostalCodeGeneratorPage,
  respondWith,
} from "./postal-code-generator-page.ts";

/** One call the page made to the Zipnami API, as a visitor's browser sent it. */
export type BackendCall = {
  readonly method: string;
  readonly path: string;
  readonly query: string;
  readonly body: string | null;
};

/**
 * Page Object for the generation history on the generator route.
 *
 * It composes the Issue #6 Page Object rather than restating it: history is
 * produced by generating, so the endpoint stub, the generate action and the
 * current result are the same ones that Issue's acceptance test drives. Only
 * what history adds lives here.
 * @param page - The Playwright page driving the browser.
 */
export const createGenerationHistoryPage = (page: Page) => {
  const generator = createPostalCodeGeneratorPage(page);
  const recordedBackendCalls: BackendCall[] = [];

  /*
   * Every request the page makes to the Zipnami API, by path rather than by
   * origin: the API base URL is baked into the build (VITE_API_BASE_URL), so
   * the origin differs between a local preview and a deployment while
   * `/api/...` does not.
   */
  const isBackendCall = (request: Request) =>
    new URL(request.url()).pathname.startsWith("/api/");

  const rememberBackendCall = (request: Request) => {
    if (!isBackendCall(request)) {
      return;
    }

    const { pathname, search } = new URL(request.url());
    recordedBackendCalls.push({
      method: request.method(),
      path: pathname,
      query: search,
      body: request.postData(),
    });
  };

  /** Starts recording API traffic. Call before navigating. */
  const recordBackendCalls = () => {
    page.on("request", rememberBackendCall);
  };

  const backendCalls = (): readonly BackendCall[] => [...recordedBackendCalls];

  const backendCallCount = () => recordedBackendCalls.length;

  /**
   * Queues the answers the stubbed endpoint gives, in order.
   * @param results - The postal codes successive generations return.
   */
  const stubGenerations = (results: readonly PostalCode[]) =>
    generator.stubRandomEndpoint(results.map(respondWith));

  const navigate = () => generator.navigate();

  const reload = () => page.reload();

  const historyHeading = () =>
    page.getByRole("heading", {
      name: historySelectors.historyHeading,
      exact: true,
    });

  const expandHistoryControl = () =>
    page.getByRole("button", {
      name: historySelectors.expandHistory,
      exact: true,
    });

  /*
   * Opens the history list the way a visitor does, through its 履歴を展開
   * control (ui-design.md section 9.2). A list that is already open, or one
   * the design shows without a control, is left as it is, so this can run
   * before every read.
   */
  const openHistory = async () => {
    const control = expandHistoryControl();
    if ((await control.count()) === 0) {
      return;
    }
    if ((await control.getAttribute("aria-expanded")) !== "true") {
      await control.click();
    }
  };

  /*
   * The history entries, newest first, as a visitor reads them.
   *
   * An entry is a list item carrying a postal code: ui-design.md section 8 asks
   * for native list semantics, and the current result shows its postal code
   * outside any list, so this separates the two without requiring the history
   * to be marked up as any particular container. Address rows nested inside an
   * entry carry no postal code of their own and so are not entries.
   */
  const historyEntries = () =>
    page
      .getByRole("main")
      .getByRole("listitem")
      .filter({ hasText: anyDisplayedPostalCode });

  /*
   * The canonical seven-digit codes the history shows, in the order it shows
   * them.
   *
   * The hyphen ui-design.md section 5.3 displays is removed here so a test
   * compares against the values the endpoint returned, and an entry whose text
   * carries no postal code at all is returned whole rather than as an empty
   * string, so a failure shows what was actually on screen.
   */
  const historyPostalCodes = async () => {
    await openHistory();
    const entryTexts = await historyEntries().allTextContents();

    return entryTexts.map((entryText) => {
      const displayed = entryText.match(anyDisplayedPostalCode)?.at(0);
      return displayed === undefined ? entryText : displayed.replace("-", "");
    });
  };

  const historyEntryCount = () => historyEntries().count();

  /**
   * The history entries that show this address in full.
   * @param address - The address that must be reachable in one entry.
   */
  const historyEntryShowing = (address: Address) =>
    historyEntries()
      .filter({ hasText: address.prefecture })
      .filter({ hasText: address.city })
      .filter({ hasText: address.town });

  /*
   * Makes every stored address readable.
   *
   * ui-design.md section 9.2: 履歴を展開 opens the list, and an opened entry
   * shows every address of its postal code. Nothing per entry is expanded on
   * top of that, so an entry that still hides an address fails the check
   * that follows.
   */
  const revealEveryAddress = () => openHistory();

  /**
   * Generates once and waits for the result to reach the screen.
   *
   * Waiting matters for more than tidiness: Issue #6 refuses a second
   * activation while a generation is in flight, so a loop that clicked without
   * waiting would silently produce fewer generations than it asked for.
   * @param postalCode - The code the stub answers this generation with.
   */
  const generate = async (postalCode: string) => {
    await generator.generate();
    await generator.postalCodeDisplay(postalCode).waitFor();
  };

  /**
   * Generates once per queued result, in order.
   * @param results - The results the stub is queued to return.
   */
  const generateAll = async (results: readonly PostalCode[]) => {
    for (const result of results) {
      await generate(result.postalCode);
    }
  };

  return {
    recordBackendCalls,
    backendCalls,
    backendCallCount,
    stubGenerations,
    navigate,
    reload,
    historyHeading,
    expandHistoryControl,
    openHistory,
    historyEntries,
    historyPostalCodes,
    historyEntryCount,
    historyEntryShowing,
    revealEveryAddress,
    generate,
    generateAll,
  };
};

export type GenerationHistoryPage = ReturnType<
  typeof createGenerationHistoryPage
>;
