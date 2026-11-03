import { expect, test as shellTest } from "./fixtures";
import {
  createFigmaVisualDesignPage,
  type FigmaVisualDesignPage,
  type TextSearch,
  transparentToCanvas,
} from "./pages/figma-visual-design-page.ts";
import {
  computedRgbOf,
  designColors,
  designScreens,
  type DesignText,
  fixedCopy,
  japaneseCapableFamilies,
} from "./selectors/figma-visual-design-selectors.ts";

/*
 * Acceptance test for Issue #97: Apply the Figma visual design to the Web MVP
 * screens — the half a browser observes.
 *
 * Each test name starts with the acceptance criterion it holds and the
 * ui-design.md section 9.1 row and Figma node it compares with, so a failure
 * names both the criterion and the screen.
 *
 *   AC-3  On every MVP screen, the page surface, card surface, primary text,
 *         secondary text, and brand-accent primary action use the section 9.2
 *         colors, and the headline and body use the section 9.2 sizes for
 *         desktop and mobile.
 *   AC-4  Every MVP screen shows the wordmark `ZIPNAMI` and the footer
 *         `© kishimin 2026`.
 *   AC-5  Each MVP screen's headline and body copy matches its Figma node.
 *   AC-7  Text contrast meets AA with the new colors.
 *
 * AC-1 and AC-2 (the document and the theme file) are held by
 * `acceptance/figma-design-tokens.medium.test.ts`, which reads files rather
 * than driving a browser. The rest of AC-7 — the existing #16 responsive and
 * accessibility tests, including the axe-core WCAG A/AA scans and the 320px
 * reflow — is `acceptance/web-responsive-accessibility.medium.test.ts`
 * itself, and is not repeated here. AC-6 (a human compares screenshots with
 * Figma before merge) and AC-8 (redeploy, and the deployed site matches)
 * are human and release steps no test can stand in for.
 *
 * Which screen is which
 * ---------------------
 * Section 9.1 rows 01-06 are the generator before a generation (Start) and
 * after one (Result) at the three frame widths the Issue names (1440px, 768px,
 * 390px). Rows 11-12 are a failed generation from the start screen — the
 * Figma frames keep the start headline and body behind the error panel — and
 * rows 13-14 are the not-found destination. Rows 15-16 (Global Error) cannot
 * be opened from a browser (ui-design.md section 10), so they are a manual
 * comparison. Figma draws no tablet frame for rows 11-14.
 *
 * How each color role is located
 * ------------------------------
 * - Page surface: the opaque surface behind the main landmark.
 * - Card surface: the opaque surface behind the banner (section 9.2
 *   "header/card surface"), and on a result, behind the current result's
 *   address list (Figma "Address panel" #2:21, #4:17; "Address list" #6:22).
 * - Primary and secondary text: the headline copy (Figma fill #091F33) and
 *   the body copy (Figma fill #526B78) of that screen's node.
 * - Brand-accent primary action: the surface of the control each frame's
 *   "Primary Button" stands for — the generate action, or the not-found
 *   screen's way back.
 *
 * Sizes are compared only where the Figma node itself uses a section 9.2
 * representative size (the start headline and body at desktop and mobile,
 * which the API error frames repeat, and the mobile result's postal code).
 * Every other headline size is a Figma value section 9.2 does not list, and
 * the criterion names the section 9.2 sizes.
 *
 * Copy is compared with all white space removed, and the element is found by
 * its words rather than by a tag, so the design is free to choose which
 * element carries a headline (the Issue #6 test still requires the page's
 * `h1` to be named Zipnami).
 */

const test = shellTest.extend<{ figmaVisualDesignPage: FigmaVisualDesignPage }>(
  {
    figmaVisualDesignPage: async ({ page }, use) => {
      await use(createFigmaVisualDesignPage(page));
    },
  },
);

/**
 * Asserts the copy was found and returns how it is painted.
 * @param search - What the page object found.
 * @param where - Which screen and node, for the failure message.
 * @param copy - The expected copy.
 */
const paintOf = (search: TextSearch, where: string, copy: string) => {
  if (!search.found) {
    throw new Error(
      `${where}: no visible element reads ${JSON.stringify(copy)} (white space ignored). Visible texts on screen: ${JSON.stringify(search.visibleTexts)}`,
    );
  }
  return search.paint;
};

/**
 * The WCAG 2 relative luminance of an `rgb(r, g, b)` string.
 * @param rgb - An opaque color as getComputedStyle reports it.
 */
const relativeLuminance = (rgb: string) => {
  const channels = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(rgb);
  if (!channels) {
    throw new Error(
      `Cannot compute contrast for ${JSON.stringify(rgb)}: not an opaque rgb() color.`,
    );
  }
  const [red, green, blue] = channels
    .slice(1, 4)
    .map((channel) => Number(channel) / 255)
    .map((value) =>
      value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );

  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
};

/**
 * The WCAG 2 contrast ratio between two opaque colors.
 * @param foreground - The text color.
 * @param background - The surface behind it.
 */
const contrastRatio = (foreground: string, background: string) => {
  // Nothing painted all the way up means the text sits on the browser's own
  // canvas, which is white in the light scheme this suite runs in. That is a
  // surface a visitor really sees, so contrast is measured against it rather
  // than refused; AC-3 is what rejects an unpainted page surface.
  const surface =
    background === transparentToCanvas ? "rgb(255, 255, 255)" : background;
  const [lighter, darker] = [
    relativeLuminance(foreground),
    relativeLuminance(surface),
  ].sort((first, second) => second - first);

  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
};

/*
 * WCAG 2.2 success criterion 1.4.3: 4.5:1, or 3:1 for large text. Large is
 * at least 18pt (24px), or 14pt (18.66px) and bold.
 */
const requiredContrast = (fontSize: number, fontWeight: number) =>
  fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5;

const firstFamilyOf = (fontFamily: string) =>
  (fontFamily.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");

const namesJapaneseCapableFamily = (fontFamily: string) =>
  fontFamily
    .split(",")
    .map((family) => family.trim().replace(/^["']|["']$/g, ""))
    .some((family) => japaneseCapableFamilies.includes(family));

test.describe("Issue #97: the Figma visual design on the Web MVP screens", () => {
  for (const screen of designScreens) {
    const title = `${screen.row} ${screen.label} (Figma ${screen.node}) at ${screen.viewport.name}`;
    const texts: readonly { kind: string; copy: DesignText }[] = [
      ...screen.headlines.map((copy) => ({ kind: "headline", copy })),
      ...screen.bodies.map((copy) => ({ kind: "body", copy })),
    ];

    test(`AC-5 ${title}: the headline and body copy match the Figma nodes`, async ({
      figmaVisualDesignPage,
    }) => {
      await figmaVisualDesignPage.open(screen.state, screen.viewport);

      for (const { kind, copy } of texts) {
        const search = await figmaVisualDesignPage.findText(
          figmaVisualDesignPage.main(),
          copy.text,
        );
        expect
          .soft(
            search.found,
            `${title}: the ${kind} of Figma node ${copy.node} should read ${JSON.stringify(copy.text)}; visible texts are ${JSON.stringify(search.found ? [] : search.visibleTexts)}`,
          )
          .toBe(true);
      }
    });

    test(`AC-4 ${title}: the wordmark ZIPNAMI and the footer © kishimin 2026 are shown`, async ({
      figmaVisualDesignPage,
    }) => {
      await figmaVisualDesignPage.open(screen.state, screen.viewport);

      const wordmark = await figmaVisualDesignPage.findText(
        figmaVisualDesignPage.banner(),
        fixedCopy.wordmark,
      );
      expect
        .soft(
          wordmark.found,
          `${title}: the banner should show the wordmark ${JSON.stringify(fixedCopy.wordmark)} as rendered text; it shows ${JSON.stringify(wordmark.found ? [] : wordmark.visibleTexts)}`,
        )
        .toBe(true);

      const footer = await figmaVisualDesignPage.findText(
        figmaVisualDesignPage.contentInfo(),
        fixedCopy.footer,
      );
      expect
        .soft(
          footer.found,
          `${title}: the footer should show ${JSON.stringify(fixedCopy.footer)}; it shows ${JSON.stringify(footer.found ? [] : footer.visibleTexts)}`,
        )
        .toBe(true);
    });

    test(`AC-3 ${title}: the page surface, card surface, primary and secondary text, and the primary action use the section 9.2 colors`, async ({
      figmaVisualDesignPage,
    }) => {
      await figmaVisualDesignPage.open(screen.state, screen.viewport);

      expect(
        await figmaVisualDesignPage.surfaceOf(figmaVisualDesignPage.main()),
        `${title}: the page surface behind main should be ${designColors.pageSurface}`,
      ).toBe(computedRgbOf(designColors.pageSurface));

      expect(
        await figmaVisualDesignPage.surfaceOf(figmaVisualDesignPage.banner()),
        `${title}: the header/card surface behind the banner should be ${designColors.cardSurface}`,
      ).toBe(computedRgbOf(designColors.cardSurface));

      if (screen.state === "result") {
        expect(
          await figmaVisualDesignPage.surfaceOf(
            figmaVisualDesignPage.resultAddressList(),
          ),
          `${title}: the card surface behind the result's address list should be ${designColors.cardSurface}`,
        ).toBe(computedRgbOf(designColors.cardSurface));
      }

      for (const copy of screen.headlines) {
        const paint = paintOf(
          await figmaVisualDesignPage.findText(
            figmaVisualDesignPage.main(),
            copy.text,
          ),
          `${title}, headline ${copy.node}`,
          copy.text,
        );
        expect(
          paint.color,
          `${title}: headline ${copy.node} should be primary text ${designColors.textPrimary}`,
        ).toBe(computedRgbOf(designColors.textPrimary));
      }

      for (const copy of screen.bodies) {
        const paint = paintOf(
          await figmaVisualDesignPage.findText(
            figmaVisualDesignPage.main(),
            copy.text,
          ),
          `${title}, body ${copy.node}`,
          copy.text,
        );
        expect(
          paint.color,
          `${title}: body ${copy.node} should be secondary text ${designColors.textSecondary}`,
        ).toBe(computedRgbOf(designColors.textSecondary));
      }

      expect(
        await figmaVisualDesignPage.surfaceOf(
          figmaVisualDesignPage.primaryActionOf(screen.state),
        ),
        `${title}: the primary action's surface should be the brand accent ${designColors.brandAccent}`,
      ).toBe(computedRgbOf(designColors.brandAccent));
    });

    test(`AC-3 ${title}: the headline and body are set in Inter with a Japanese-capable fallback, at the section 9.2 sizes where the node uses them`, async ({
      figmaVisualDesignPage,
    }) => {
      await figmaVisualDesignPage.open(screen.state, screen.viewport);

      for (const { kind, copy } of texts) {
        const paint = paintOf(
          await figmaVisualDesignPage.findText(
            figmaVisualDesignPage.main(),
            copy.text,
          ),
          `${title}, ${kind} ${copy.node}`,
          copy.text,
        );

        expect(
          firstFamilyOf(paint.fontFamily),
          `${title}: the ${kind} of ${copy.node} should be set in Inter first (section 9.2); its font-family is ${paint.fontFamily}`,
        ).toBe("Inter");
        expect(
          namesJapaneseCapableFamily(paint.fontFamily),
          `${title}: the ${kind} of ${copy.node} is Japanese, so its font-family should name a Japanese-capable family after Inter; it is ${paint.fontFamily}`,
        ).toBe(true);

        if (!copy.size) continue;

        expect(
          paint.fontSize,
          `${title}: the ${kind} of ${copy.node} should be the ${copy.size.role} size ${copy.size.fontSize}px`,
        ).toBeCloseTo(copy.size.fontSize, 0);

        if (copy.size.lineHeight !== undefined) {
          expect(
            paint.lineHeight,
            `${title}: the ${kind} of ${copy.node} should have the ${copy.size.role} line height ${copy.size.lineHeight}px`,
          ).toBeCloseTo(copy.size.lineHeight, 0);
        }
      }
    });

    test(`AC-7 ${title}: the headline, body, fixed copy, and primary action label meet WCAG AA contrast`, async ({
      figmaVisualDesignPage,
    }) => {
      await figmaVisualDesignPage.open(screen.state, screen.viewport);

      const painted = [
        ...texts.map(({ kind, copy }) => ({
          what: `${kind} ${copy.node}`,
          scope: figmaVisualDesignPage.main(),
          copy: copy.text,
        })),
        {
          what: "wordmark",
          scope: figmaVisualDesignPage.banner(),
          copy: fixedCopy.wordmark,
        },
        {
          what: "footer",
          scope: figmaVisualDesignPage.contentInfo(),
          copy: fixedCopy.footer,
        },
      ];

      for (const { what, scope, copy } of painted) {
        const paint = paintOf(
          await figmaVisualDesignPage.findText(scope, copy),
          `${title}, ${what}`,
          copy,
        );
        const ratio = contrastRatio(paint.color, paint.background);
        const required = requiredContrast(paint.fontSize, paint.fontWeight);
        expect(
          ratio,
          `${title}: the ${what} (${paint.color} on ${paint.background}, ${paint.fontSize}px weight ${paint.fontWeight}) should reach ${required}:1`,
        ).toBeGreaterThanOrEqual(required);
      }

      const action = figmaVisualDesignPage.primaryActionOf(screen.state);
      const label = await figmaVisualDesignPage.labelPaintOf(action);
      const surface = await figmaVisualDesignPage.surfaceOf(action);
      const required = requiredContrast(label.fontSize, label.fontWeight);
      expect(
        contrastRatio(label.color, surface),
        `${title}: the primary action's label (${label.color} on ${surface}, ${label.fontSize}px weight ${label.fontWeight}) should reach ${required}:1`,
      ).toBeGreaterThanOrEqual(required);
    });
  }
});
