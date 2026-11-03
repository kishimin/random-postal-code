import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";
import {
  colorsNotMapped,
  colorsWithoutToken,
  colorTokensOf,
  fontTokensOf,
  japaneseCapableFontTokensOf,
  rawValuesIn,
  recordedFontStacks,
  sizesNotMapped,
  sizesWithoutToken,
  textSizeTokensOf,
  themeTokensOf,
} from "./fixtures/design-tokens.ts";
import { typeScale } from "./selectors/figma-visual-design-selectors.ts";

/*
 * Acceptance test for Issue #97: Apply the Figma visual design to the Web MVP
 * screens — the half that lives in files.
 *
 * Each test name starts with the acceptance criterion it holds.
 *
 *   AC-1  `docs/ui-design.md` records the Japanese-capable font stack, and how
 *         the section 9.2 tokens map to theme code.
 *   AC-2  `src/theme/globals.css` defines a token for each of the eleven
 *         section 9.2 colors and for the section 9.2 type scale. Components
 *         use those tokens, not raw hex values or one-off sizes.
 *
 * That the screens really are painted with those tokens is
 * `acceptance/web-figma-visual-design.medium.test.ts`. This file holds what
 * a browser cannot see: where the values come from.
 *
 * Why this runs under `bun test`, and why it is Medium
 * ----------------------------------------------------
 * It reads repository files and drives no browser, so Playwright is not its
 * runner (ADR-0069), and its subject spans a document and a package, so no
 * single `vitest.config.ts` has a claim on it. ADR-0077 binds such a test to
 * its runner by a CI step naming its path, as Issue #25's acceptance test is
 * bound. It reads the file system and nothing else (ADR-0004, ADR-0044).
 *
 * How the theme and the document are read
 * ---------------------------------------
 * A token is a custom property declared inside an `@theme` block of
 * globals.css (Tailwind v4): `--color-*` for colors, `--text-*` with its
 * `--text-*--line-height` for the type scale, `--font-*` for the family.
 * Colors are compared by value, written as hex or `rgb()`, so each token's
 * name is the implementation's choice.
 *
 * The document has to name, for each section 9.2 value, the token that holds
 * it on the same line — a table row or a list item. For colors that line must
 * carry no other section 9.2 color: one paragraph listing every hex and every
 * token name would leave a reader to pair them by guessing.
 *
 * "Components use those tokens" is held as a scan of every `.ts`, `.tsx`, and
 * `.css` file under `apps/web/frontend/src` — except globals.css, where the
 * raw values belong, and test, story, and mock files — for the ways a raw
 * value gets into a component; `rawValuesIn` lists them. The scan asserts it
 * read the frame and generator components, so a wrong path cannot make it
 * pass by scanning nothing.
 *
 * What this deliberately does not pin
 * -----------------------------------
 * - That the document changed before the restyle ("contract first"). A
 *   squash merge leaves one commit, so the order is not observable after the
 *   merge; it is settled by review of the pull request.
 * - Font weights 400/600/700. Whether a weight renders is a font-loading
 *   question a file cannot answer; the human screenshot comparison does.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const frontendSource = path.join(
  repositoryRoot,
  "apps",
  "web",
  "frontend",
  "src",
);

const tokens = themeTokensOf(
  readFileSync(path.join(frontendSource, "theme", "globals.css"), "utf8"),
);
const documentLines = readFileSync(
  path.join(repositoryRoot, "docs", "ui-design.md"),
  "utf8",
).split(/\r?\n/);

/** Every scanned component source, relative to the frontend source root. */
const componentSources = readdirSync(frontendSource, { recursive: true })
  .map((entry) => String(entry).replace(/\\/g, "/"))
  .filter((file) => /\.(?:tsx?|css)$/.test(file))
  .filter((file) => file !== "theme/globals.css")
  .filter((file) => !/\.(?:test|stories)\.tsx?$/.test(file))
  .filter((file) => !/(?:^|\/)(?:tests|mocks)\//.test(file))
  .filter((file) => !file.endsWith(".d.ts"));

describe("Issue #97: Figma design tokens and their documented mapping", () => {
  test("AC-2 globals.css defines a color token for each of the eleven section 9.2 colors", () => {
    expect(
      colorsWithoutToken(tokens),
      `globals.css @theme should declare a --color-* token holding each section 9.2 color. Color tokens found: ${JSON.stringify(colorTokensOf(tokens))}`,
    ).toEqual([]);
  });

  test("AC-2 globals.css defines a type-scale token for each section 9.2 size, with its line height where section 9.2 gives one", () => {
    expect(
      sizesWithoutToken(tokens, typeScale),
      `globals.css @theme should declare a --text-* token (and its --text-*--line-height) for each section 9.2 size. Text tokens found: ${JSON.stringify(textSizeTokensOf(tokens))}`,
    ).toEqual([]);
  });

  test("AC-2 globals.css defines a font token that starts with Inter and falls back to a Japanese-capable family", () => {
    expect(
      japaneseCapableFontTokensOf(tokens).map((token) => token.name),
      `globals.css @theme should declare a --font-* token whose stack is Inter followed by a Japanese-capable family. Font tokens found: ${JSON.stringify(fontTokensOf(tokens))}`,
    ).not.toEqual([]);
  });

  test("AC-1 ui-design.md records the Japanese-capable font stack, naming the token that holds it", () => {
    expect(
      recordedFontStacks(tokens, documentLines).map((token) => token.name),
      `ui-design.md should have a line naming the font token, Inter, and the Japanese-capable family that token falls back to. Candidate tokens in globals.css: ${JSON.stringify(japaneseCapableFontTokensOf(tokens))}`,
    ).not.toEqual([]);
  });

  test("AC-1 ui-design.md maps each section 9.2 color to the globals.css token that holds it, one color per line", () => {
    expect(
      colorsNotMapped(tokens, documentLines),
      "ui-design.md should have, for each section 9.2 color, a line carrying that hex, no other section 9.2 hex, and the --color-* token globals.css defines with it",
    ).toEqual([]);
  });

  test("AC-1 ui-design.md maps each section 9.2 type size to the globals.css token that holds it", () => {
    expect(
      sizesNotMapped(tokens, documentLines, typeScale),
      "ui-design.md should have, for each section 9.2 size, a line carrying that px value and the --text-* token globals.css defines with it",
    ).toEqual([]);
  });

  test("AC-2 components use the theme tokens, not raw hex values or one-off sizes", () => {
    // Guards the scan itself: a wrong root would scan nothing and pass.
    expect(componentSources).toContain("app/views/RootLayout.tsx");
    expect(componentSources).toContain("app/views/GeneratorView.tsx");
    expect(componentSources).toContain(
      "features/postal-generator/components/CurrentResult.tsx",
    );

    const findings = componentSources.flatMap((file) =>
      rawValuesIn(
        file,
        readFileSync(path.join(frontendSource, file), "utf8"),
        tokens,
      ),
    );

    expect(
      findings.map(
        (finding) =>
          `${finding.file}:${finding.line} ${finding.found} (${finding.why})`,
      ),
      "component sources should reach colors and type sizes only through the globals.css theme tokens",
    ).toEqual([]);
  });
});
