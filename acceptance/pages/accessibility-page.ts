import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import {
  applicationLinkNames,
  focusIndicatorMargin,
  generatorButtonNames,
  type RepresentativeViewport,
  wcagTags,
} from "../selectors/accessibility-selectors.ts";
import { liveRegionSelector } from "../selectors/generator-selectors.ts";

/** One rule the automated scan found broken, reduced to what a reader needs. */
export type AccessibilityViolation = {
  readonly rule: string;
  readonly impact: string | null | undefined;
  readonly targets: readonly string[];
};

/**
 * Page Object for the responsive and accessibility behavior of Issue #16.
 *
 * Every Web screen is addressed from here, because the Issue's criteria are
 * about properties every screen shares — landmarks, names, focus, reflow —
 * rather than about one screen's content. What a screen shows is still located
 * through that screen's own Page Object; this one measures it.
 *
 * Accessibility semantics (roles, names, live regions, `aria-busy`, the tab
 * order) are what an acceptance test may depend on. Markup, classes, and
 * style values are not (ADR-0012), so nothing here reads a colour, a class
 * name, or a computed style.
 * @param page - The Playwright page driving the browser.
 */
export const createAccessibilityPage = (page: Page) => {
  /**
   * Loads a path directly, as a deep link or a refresh would.
   * @param path - The path to request.
   */
  const navigate = (path: string) => page.goto(path);

  /**
   * Resizes the viewport to one of the representative sizes.
   * @param viewport - The size to lay the page out at.
   */
  const resizeTo = (viewport: RepresentativeViewport) =>
    page.setViewportSize({ width: viewport.width, height: viewport.height });

  const documentTitle = () => page.title();

  const currentPath = () => new URL(page.url()).pathname;

  const banners = () => page.getByRole("banner");

  const mains = () => page.getByRole("main");

  const contentInfos = () => page.getByRole("contentinfo");

  const topLevelHeadings = () => page.getByRole("heading", { level: 1 });

  // The top-level heading, when it is inside the main landmark. Resolves to
  // nothing when the page's title heading sits in the header or the footer.
  const topLevelHeadingInsideMain = () =>
    mains().getByRole("heading", { level: 1 });

  const buttons = () => page.getByRole("button");

  const namedButtons = () =>
    page.getByRole("button", { name: generatorButtonNames });

  const links = () => page.getByRole("link");

  const namedLinks = () =>
    page.getByRole("link", { name: applicationLinkNames });

  /**
   * The one link carrying this name.
   * @param name - The accessible name to locate the link by.
   */
  const linkNamed = (name: RegExp) => page.getByRole("link", { name });

  /**
   * A labelled region — a `section` named by its heading or label.
   * @param name - The accessible name to locate the region by.
   */
  const regionNamed = (name: RegExp) => page.getByRole("region", { name });

  /**
   * A second-level heading, which is where ui-design.md section 8 puts the
   * result, map, and history headings under the page's one `h1`.
   * @param name - The accessible name to locate the heading by.
   */
  const sectionHeadingNamed = (name: RegExp) =>
    page.getByRole("heading", { level: 2, name });

  /**
   * Visible text inside a given element.
   * @param container - Where to look.
   * @param text - What the visitor has to be able to read.
   */
  const visibleTextInside = (container: Locator, text: RegExp) =>
    container.getByText(text).first();

  /**
   * A labelled region nested inside another element.
   * @param container - Where to look.
   * @param name - The accessible name of the nested region.
   */
  const regionInside = (container: Locator, name: RegExp) =>
    container.getByRole("region", { name });

  const liveRegions = () => page.locator(liveRegionSelector);

  const liveRegionCount = () => liveRegions().count();

  const announcementText = async () =>
    (await liveRegions().allTextContents()).join(" ").trim();

  /**
   * Visible text anywhere in the main landmark.
   *
   * The first match is taken because a text locator also matches every
   * ancestor holding the text; the question is whether a sighted visitor can
   * read it, not how many elements contain it.
   * @param text - What the visitor has to be able to read.
   */
  const visibleTextInMain = (text: RegExp) => mains().getByText(text).first();

  // ui-design.md section 8: "Set aria-busy on the result region during
  // generation." aria-busy is an accessibility state, not markup, which is why
  // the test may locate by it (ADR-0012).
  const busyRegions = () => page.locator('[aria-busy="true"]');

  /*
   * Elements that place themselves ahead of the document order.
   *
   * ui-design.md section 8 asks for a focus order matching DOM order. A
   * positive tabindex is the one way markup can break that order, so none may
   * exist. Tab traversal itself is not used as the measurement: WebKit does not
   * move Tab focus to links unless full keyboard access is switched on, which
   * would make the result a browser setting rather than an application
   * contract (the same finding Issue #10's acceptance test records).
   */
  const elementsAheadOfDocumentOrder = () =>
    page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLElement>("[tabindex]")].filter(
          (element) => element.tabIndex > 0,
        ).length,
    );

  /**
   * Whether a control is in the document's tab order.
   * @param control - The control to inspect.
   */
  const tabIndexOf = (control: Locator) =>
    control.evaluate((element) => (element as HTMLElement).tabIndex);

  // Compares the document's scrollable width against its visible width. A
  // larger scrollWidth means content overflows horizontally, which
  // ui-design.md section 5.1 forbids for primary content and actions.
  const hasHorizontalOverflow = () =>
    page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );

  /**
   * Whether an element lies entirely inside the visible width of the page.
   *
   * No horizontal scroll bar is necessary but not sufficient: content pushed
   * past the edge of an `overflow: hidden` ancestor is lost without making the
   * document any wider. So each primary element is also measured against the
   * width a visitor can see. Only the horizontal axis is compared; vertical
   * scrolling is how a narrow page is meant to be read.
   * @param element - The element to measure. Must resolve to exactly one.
   */
  const liesWithinVisibleWidth = async (element: Locator) => {
    await element.waitFor({ state: "visible" });

    return element.evaluate((node) => {
      const { left, right } = node.getBoundingClientRect();
      const visibleWidth = document.documentElement.clientWidth;

      // Half a pixel of tolerance absorbs sub-pixel layout rounding, which
      // differs between engines and is not content a visitor loses.
      return left >= -0.5 && right <= visibleWidth + 0.5;
    });
  };

  /**
   * Whether an element's text is fully shown rather than clipped inside its
   * own box — for example an address cut off by `text-overflow: ellipsis`.
   * @param element - The element to measure. Must resolve to exactly one.
   */
  const showsAllOfItsText = async (element: Locator) => {
    await element.waitFor({ state: "visible" });

    return element.evaluate(
      (node) => node.scrollWidth <= node.clientWidth + 0.5,
    );
  };

  // Moves focus off every control, so the "before" picture below shows the
  // control unfocused. Blurring changes nothing a visitor did; it only
  // releases focus the previous step placed.
  const releaseFocus = () =>
    page.evaluate(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        active.blur();
      }
    });

  /**
   * Whether focusing a control from the keyboard visibly changes it.
   *
   * "Visible focus" is held without fixing what the indicator looks like:
   * the control and a margin around it are captured unfocused and focused, and
   * the two pictures must differ. Any indicator — an outline, a ring, a
   * background change — satisfies it; none at all does not. This compares the
   * page with itself at one moment, so no stored baseline is involved and no
   * appearance is fixed as an expectation (ADR-0012).
   *
   * Focus is placed after a key press, never after a pointer event, so every
   * engine treats it as keyboard focus and applies `:focus-visible`.
   * @param control - The control to focus. Must resolve to exactly one.
   */
  const showsFocusIndicator = async (control: Locator) => {
    await control.scrollIntoViewIfNeeded();
    await releaseFocus();

    const box = await control.boundingBox();
    if (!box) {
      return false;
    }

    const viewport = page.viewportSize();
    const x = Math.max(0, box.x - focusIndicatorMargin);
    const y = Math.max(0, box.y - focusIndicatorMargin);
    const clip = {
      x,
      y,
      width: Math.min(
        box.width + focusIndicatorMargin * 2,
        (viewport?.width ?? Number.POSITIVE_INFINITY) - x,
      ),
      height: Math.min(
        box.height + focusIndicatorMargin * 2,
        (viewport?.height ?? Number.POSITIVE_INFINITY) - y,
      ),
    };

    const unfocused = await page.screenshot({
      clip,
      animations: "disabled",
      caret: "hide",
    });

    // A modifier key alone activates nothing, but it marks the most recent
    // interaction as a keyboard one, which is what :focus-visible keys off.
    await page.keyboard.press("Shift");
    await control.focus();

    const focused = await page.screenshot({
      clip,
      animations: "disabled",
      caret: "hide",
    });

    return !unfocused.equals(focused);
  };

  /**
   * Whether a control currently holds focus.
   * @param control - The control to inspect.
   */
  const holdsFocus = (control: Locator) =>
    control.evaluate((element) => element === document.activeElement);

  /**
   * Operates a control with a key, as a keyboard-only visitor would.
   *
   * press() focuses the control and sends real key events, which a control
   * that only answers a mouse click does not act on.
   * @param control - The control to operate.
   * @param key - The key to press.
   */
  const operateWithKey = (control: Locator, key: "Enter" | " ") =>
    control.press(key);

  /*
   * Whether a newly arrived page is perceivable without looking at it.
   *
   * A route change inside a single-page application replaces the main
   * content while focus stays wherever the activated link was, so a
   * screen-reader user hears nothing. Two established answers exist — moving
   * focus into the new content, or announcing the arrival through a live
   * region — and ui-design.md section 8 chooses neither, so either one
   * satisfies this. Focus left on the link that started the navigation, which
   * sits in the header or the footer rather than in main, satisfies neither.
   */
  const arrivalIsPerceivable = async (pageName: RegExp) => {
    const focusIsInMain = await mains()
      .first()
      .evaluate(
        (main) =>
          document.activeElement !== document.body &&
          main.contains(document.activeElement),
      );

    return focusIsInMain || pageName.test(await announcementText());
  };

  /*
   * Runs the automated accessibility scan over the page as it is now.
   *
   * axe-core is the scanner because it is the engine the Storybook
   * accessibility addon already uses in this repository, so a component and
   * the assembled page are held to the same rules. Only the WCAG A and AA
   * rules run (see wcagTags). The result is reduced to the rule, its impact,
   * and where it failed, so a failing assertion reads as a list of findings
   * rather than as axe's whole report.
   */
  const scanForViolations = async (): Promise<
    readonly AccessibilityViolation[]
  > => {
    const results = await new AxeBuilder({ page })
      .withTags([...wcagTags])
      .analyze();

    return results.violations.map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    }));
  };

  return {
    navigate,
    resizeTo,
    documentTitle,
    currentPath,
    banners,
    mains,
    contentInfos,
    topLevelHeadings,
    topLevelHeadingInsideMain,
    buttons,
    namedButtons,
    links,
    namedLinks,
    linkNamed,
    regionNamed,
    sectionHeadingNamed,
    visibleTextInside,
    regionInside,
    liveRegionCount,
    announcementText,
    visibleTextInMain,
    busyRegions,
    elementsAheadOfDocumentOrder,
    tabIndexOf,
    hasHorizontalOverflow,
    liesWithinVisibleWidth,
    showsAllOfItsText,
    showsFocusIndicator,
    holdsFocus,
    operateWithKey,
    arrivalIsPerceivable,
    scanForViolations,
  };
};

export type AccessibilityPage = ReturnType<typeof createAccessibilityPage>;
