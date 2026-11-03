import type { Locator, Page } from "@playwright/test";
import { chromeSelectors, unknownPath } from "../selectors/chrome-selectors.ts";
import { failureText } from "../selectors/accessibility-selectors.ts";
import {
  designViewports,
  figmaResult,
  type ScreenState,
} from "../selectors/figma-visual-design-selectors.ts";
import {
  displayedPostalCode,
  generatorSelectors,
  randomEndpointPattern,
} from "../selectors/generator-selectors.ts";
import { refuseLiveThirdPartyRequests } from "./dependency-failure-page.ts";

/**
 * How one piece of text is painted, as the browser computed it.
 *
 * `background` is the first opaque background found walking from the element
 * up through its ancestors, which is the surface a visitor sees behind the
 * text. A translucent or non-rgb background stops the walk and is reported
 * as computed, because it cannot equal an opaque section 9.2 color.
 */
export type PaintedText = {
  readonly color: string;
  readonly background: string;
  readonly fontSize: number;
  readonly lineHeight: number | undefined;
  readonly fontWeight: number;
  readonly fontFamily: string;
};

/** What a search for visible text found: the text's paint, or what was there. */
export type TextSearch =
  | { readonly found: true; readonly paint: PaintedText }
  | { readonly found: false; readonly visibleTexts: readonly string[] };

type Viewport = (typeof designViewports)[keyof typeof designViewports];

/*
 * What `background` reads when no element up to the root paints one. The
 * evaluated functions below cannot close over this constant (Playwright
 * serialises them), so they repeat the literal; this export is what a test
 * compares against.
 */
export const transparentToCanvas =
  "transparent all the way up (the browser's default canvas)";

const responseHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
} as const;

/**
 * Page Object for the Figma visual design of Issue #97.
 *
 * The Issue's criteria are about what a visitor sees — which colors, which
 * sizes, which words — so this reads computed styles and rendered text. It
 * never reads a class name or the markup's shape: a headline is found by the
 * words it shows, not by its tag, so the implementation is free to choose the
 * element (ADR-0012 forbade style assertions; ADR-0013 and ADR-0015 superseded
 * it for exactly this kind of visual contract).
 *
 * Every live third-party request is refused at the network boundary, so the
 * advertising and Maps SDKs never reach Google, and a web font the design
 * might load from a CDN does not either (the same boundary Issue #17's
 * acceptance test draws).
 * @param page - The Playwright page driving the browser.
 */
export const createFigmaVisualDesignPage = (page: Page) => {
  const main = () => page.getByRole("main");

  const banner = () => page.getByRole("banner");

  const contentInfo = () => page.getByRole("contentinfo");

  const generateAction = () =>
    page
      .getByRole("button", { name: generatorSelectors.generateAction })
      .first();

  const backToGeneratorLink = () =>
    page.getByRole("link", { name: chromeSelectors.backToGenerator });

  /*
   * The list holding the current result's addresses.
   *
   * Located through the result region the Issue #6 Page Object already uses
   * (approved on Issue #7), so the history list further down main is never
   * mistaken for the result card.
   */
  const resultAddressList = () =>
    main().getByTestId("result-region").getByRole("list").first();

  // The control each screen's Figma "Primary Button" stands for: the generate
  // action on the generator, and the way back on the not-found screen.
  const primaryActionOf = (state: ScreenState) =>
    state === "not-found" ? backToGeneratorLink() : generateAction();

  const answerPreflight = {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,OPTIONS",
      "access-control-allow-headers": "accept,content-type",
    },
  };

  const answerRandomWithFigmaResult = () =>
    page.route(randomEndpointPattern, (route) =>
      route.request().method() === "OPTIONS"
        ? route.fulfill(answerPreflight)
        : route.fulfill({
            status: 200,
            headers: responseHeaders,
            body: JSON.stringify(figmaResult),
          }),
    );

  /*
   * Fails `GET /api/random` the way a dropped connection does.
   *
   * The Figma API error frames (#27:76, #27:97) tell the visitor to check
   * their connection, which is the offline failure (ui-design.md section 4),
   * so that is the failure this reaches rather than a server error whose
   * message would honestly say something else.
   */
  const failRandomAsDisconnected = () =>
    page.route(randomEndpointPattern, (route) =>
      route.abort("internetdisconnected"),
    );

  /**
   * Opens one MVP screen at one Figma frame's width, and waits until the
   * state that frame draws is on screen.
   * @param state - Which screen of ui-design.md section 9.1 to reach.
   * @param viewport - The width of the Figma frame being compared.
   */
  const open = async (state: ScreenState, viewport: Viewport) => {
    await refuseLiveThirdPartyRequests(page);
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });

    if (state === "not-found") {
      await page.goto(unknownPath);
      await page
        .getByRole("heading", { name: chromeSelectors.notFoundHeading })
        .waitFor();
      return;
    }

    if (state === "result") {
      await answerRandomWithFigmaResult();
    }
    if (state === "api-error") {
      await failRandomAsDisconnected();
    }

    await page.goto("/");
    await generateAction().waitFor();

    if (state === "result") {
      await generateAction().click();
      await main()
        .getByTestId("result-region")
        .filter({ hasText: displayedPostalCode(figmaResult.postalCode) })
        .waitFor();
    }
    if (state === "api-error") {
      await generateAction().click();
      await main().getByText(failureText).first().waitFor();
    }
  };

  /**
   * Finds the visible element whose rendered text is exactly this copy, and
   * reports how it is painted.
   *
   * White space is ignored on both sides, so a line break Figma writes as
   * "\n" may be a `<br>`, a block, or a wrap. "Visible" means rendered with
   * a box larger than one pixel each way and not hidden, which excludes
   * visually-hidden screen-reader text: the criterion is what a sighted
   * visitor reads. When several nested elements match, the innermost one is
   * measured, since that is the one whose own style paints the glyphs.
   * When nothing matches, the visible texts that are there are returned, so a
   * failure shows the copy the screen actually carries.
   * @param scope - Where to look: main, the banner, or the contentinfo.
   * @param copy - The text, as Figma writes it.
   */
  const findText = (scope: Locator, copy: string): Promise<TextSearch> =>
    scope.first().evaluate((root, wanted) => {
      const normalise = (text: string) => text.replace(/\s+/g, "");

      const opaqueRgb = (value: string) => {
        const match = /^rgba?\(([^)]*)\)$/.exec(value.trim());
        if (!match?.[1]) return undefined;
        const parts = match[1]
          .split(/[\s,/]+/)
          .filter((part) => part.length > 0)
          .map(Number);
        return {
          rgb: `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`,
          alpha: parts[3] ?? 1,
        };
      };

      const backgroundBehind = (element: Element) => {
        for (
          let node: Element | null = element;
          node;
          node = node.parentElement
        ) {
          const { backgroundColor } = getComputedStyle(node);
          const parsed = opaqueRgb(backgroundColor);
          if (!parsed) return backgroundColor;
          if (parsed.alpha === 0) continue;
          if (parsed.alpha < 1) return backgroundColor;
          return parsed.rgb;
        }
        return "transparent all the way up (the browser's default canvas)";
      };

      const isVisible = (element: HTMLElement) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          box.width > 1 &&
          box.height > 1 &&
          style.visibility !== "hidden" &&
          Number(style.opacity) > 0
        );
      };

      const elements = [root, ...root.querySelectorAll("*")].filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      );
      const target = normalise(wanted);
      const matches = elements.filter(
        (element) =>
          isVisible(element) && normalise(element.innerText) === target,
      );
      const innermost = matches.find(
        (element) =>
          !matches.some(
            (other) => other !== element && element.contains(other),
          ),
      );

      if (!innermost) {
        const visibleTexts = elements
          .filter(
            (element) =>
              element.children.length === 0 &&
              isVisible(element) &&
              element.innerText.trim().length > 0,
          )
          .map((element) => element.innerText.trim());
        return { found: false as const, visibleTexts };
      }

      const style = getComputedStyle(innermost);
      const fontSize = Number.parseFloat(style.fontSize);
      const lineHeight = style.lineHeight.endsWith("px")
        ? Number.parseFloat(style.lineHeight)
        : /^[\d.]+$/.test(style.lineHeight)
          ? Number.parseFloat(style.lineHeight) * fontSize
          : undefined;

      return {
        found: true as const,
        paint: {
          color: opaqueRgb(style.color)?.rgb ?? style.color,
          background: backgroundBehind(innermost),
          fontSize,
          lineHeight,
          fontWeight: Number(style.fontWeight),
          fontFamily: style.fontFamily,
        },
      };
    }, copy);

  /**
   * The opaque surface a visitor sees at an element: its own background, or
   * the first opaque one among its ancestors.
   * @param element - Must resolve to at least one element; the first is used.
   */
  const surfaceOf = (element: Locator) =>
    element.first().evaluate((start) => {
      for (let node: Element | null = start; node; node = node.parentElement) {
        const { backgroundColor } = getComputedStyle(node);
        const match = /^rgba?\(([^)]*)\)$/.exec(backgroundColor.trim());
        if (!match?.[1]) return backgroundColor;
        const parts = match[1]
          .split(/[\s,/]+/)
          .filter((part) => part.length > 0)
          .map(Number);
        const alpha = parts[3] ?? 1;
        if (alpha === 0) continue;
        if (alpha < 1) return backgroundColor;
        return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
      }
      return "transparent all the way up (the browser's default canvas)";
    });

  /**
   * The text color and size of a control's label, with the surface behind it.
   * @param control - Must resolve to exactly one control.
   */
  const labelPaintOf = (control: Locator) =>
    control.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        color: style.color,
        fontSize: Number.parseFloat(style.fontSize),
        fontWeight: Number(style.fontWeight),
      };
    });

  return {
    open,
    main,
    banner,
    contentInfo,
    resultAddressList,
    primaryActionOf,
    findText,
    surfaceOf,
    labelPaintOf,
  };
};

export type FigmaVisualDesignPage = ReturnType<
  typeof createFigmaVisualDesignPage
>;
