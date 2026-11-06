import {
  designColors,
  japaneseCapableFamilies,
  type TypeSize,
} from "../selectors/figma-visual-design-selectors.ts";

/*
 * How the Issue #97 acceptance test reads the theme file, the design
 * document, and the component sources.
 *
 * Every function here takes text and returns what it found, without touching
 * the file system, so the reading itself can be checked against hand-written
 * input — the acceptance test decides which files to hand it.
 */

/** A custom property declared in an `@theme` block, by name. */
export type ThemeTokens = ReadonlyMap<string, string>;

const withoutBlockComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, " "),
  );

/*
 * Removes comments while keeping every line where it was, so a reported line
 * number is still the line in the file. A line comment's `//` is only taken
 * as one when no colon precedes it, because `https://` in a string is not a
 * comment.
 */
export const withoutComments = (source: string) =>
  withoutBlockComments(source).replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");

/**
 * Every custom property declared inside an `@theme` block (Tailwind v4,
 * including `@theme inline` and `@theme static`).
 * @param css - The theme stylesheet.
 */
export const themeTokensOf = (css: string): ThemeTokens => {
  const tokens = new Map<string, string>();
  for (const block of withoutBlockComments(css).matchAll(
    /@theme\b[^{]*\{([^}]*)\}/g,
  )) {
    for (const declaration of (block[1] ?? "").matchAll(
      /(--[\w-]+)\s*:\s*([^;]+);/g,
    )) {
      const [, name, value] = declaration;
      if (name && value) tokens.set(name, value.trim());
    }
  }
  return tokens;
};

/**
 * A color value as six lower-case hex digits, or undefined when it is not an
 * opaque hex or `rgb()` color.
 * @param value - A CSS color value.
 */
export const hexOf = (value: string) => {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (hex?.[1]) {
    const digits = hex[1].toLowerCase();
    return digits.length === 3
      ? [...digits].map((digit) => digit + digit).join("")
      : digits;
  }
  const rgb =
    /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*(?:1|1\.0+|100%)\s*)?\)$/i.exec(
      value.trim(),
    );
  if (rgb) {
    return rgb
      .slice(1, 4)
      .map((channel) => Number(channel).toString(16).padStart(2, "0"))
      .join("");
  }
  return undefined;
};

/**
 * A length in CSS pixels, or undefined when it is not px or rem.
 * @param value - A CSS length such as `52px` or `3.25rem`.
 */
export const pixelsOf = (value: string) => {
  const length = /^(\d+(?:\.\d+)?|\.\d+)(px|rem)$/.exec(value.trim());
  if (!length?.[1]) return undefined;
  const amount = Number(length[1]);
  return length[2] === "rem" ? amount * 16 : amount;
};

/**
 * A line height in CSS pixels for a given font size: px, rem, or a unitless
 * ratio of the font size. Undefined for anything else (`normal`, `calc()`).
 * @param value - The `--text-*--line-height` value.
 * @param fontSize - The font size it belongs to, in pixels.
 */
export const lineHeightPixelsOf = (value: string, fontSize: number) => {
  const pixels = pixelsOf(value);
  if (pixels !== undefined) return pixels;
  return /^(\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())
    ? Number(value) * fontSize
    : undefined;
};

/** The `--color-*` tokens, with their values as hex where they are plain. */
export const colorTokensOf = (tokens: ThemeTokens) =>
  [...tokens]
    .filter(([name]) => name.startsWith("--color-"))
    .map(([name, value]) => ({ name, hex: hexOf(value) }));

/*
 * The `--text-*` size tokens. `--text-*--line-height` and the other
 * sub-properties share the prefix; they are read through their size token.
 */
export const textSizeTokensOf = (tokens: ThemeTokens) =>
  [...tokens]
    .filter(([name]) => /^--text-[\w-]+$/.test(name) && !name.includes("--", 2))
    .map(([name, value]) => ({
      name,
      fontSize: pixelsOf(value),
      lineHeight: tokens.get(`${name}--line-height`),
    }));

/** The `--font-*` family tokens, each split into its families. */
export const fontTokensOf = (tokens: ThemeTokens) =>
  [...tokens]
    .filter(
      ([name]) =>
        name.startsWith("--font-") && !name.startsWith("--font-weight-"),
    )
    .map(([name, value]) => ({
      name,
      families: value
        .split(",")
        .map((family) => family.trim().replace(/^["']|["']$/g, "")),
    }));

/**
 * The first Japanese-capable family in a stack, if any.
 * @param families - The stack, in order.
 */
export const japaneseFamilyIn = (families: readonly string[]) =>
  families.find((family) => japaneseCapableFamilies.includes(family));

/**
 * The font tokens whose stack starts with Inter and names a
 * Japanese-capable family after it.
 * @param tokens - The theme tokens.
 */
export const japaneseCapableFontTokensOf = (tokens: ThemeTokens) =>
  fontTokensOf(tokens).filter(
    (token) =>
      token.families[0] === "Inter" &&
      japaneseFamilyIn(token.families.slice(1)) !== undefined,
  );

const sameSize = (first: number | undefined, second: number) =>
  first !== undefined && Math.abs(first - second) < 0.01;

/**
 * The section 9.2 colors no `--color-*` token holds, as "role #HEX".
 * @param tokens - The theme tokens.
 */
export const colorsWithoutToken = (tokens: ThemeTokens) => {
  const colorTokens = colorTokensOf(tokens);
  return Object.entries(designColors)
    .filter(
      ([, hex]) =>
        !colorTokens.some(
          (token) => token.hex === hex.replace(/^#/, "").toLowerCase(),
        ),
    )
    .map(([role, hex]) => `${role} ${hex}`);
};

/**
 * The type-scale sizes no `--text-*` token holds (with the line height,
 * where the size has one), as "role 52px/68px".
 * @param tokens - The theme tokens.
 * @param scale - The sizes required.
 */
export const sizesWithoutToken = (
  tokens: ThemeTokens,
  scale: readonly TypeSize[],
) => {
  const textTokens = textSizeTokensOf(tokens);
  return scale
    .filter(
      (size) =>
        !textTokens.some(
          (token) =>
            sameSize(token.fontSize, size.fontSize) &&
            (size.lineHeight === undefined ||
              (token.lineHeight !== undefined &&
                Math.abs(
                  (lineHeightPixelsOf(token.lineHeight, size.fontSize) ??
                    Number.NaN) - size.lineHeight,
                ) < 0.5)),
        ),
    )
    .map(
      (size) =>
        `${size.role} ${size.fontSize}px${size.lineHeight === undefined ? "" : `/${size.lineHeight}px`}`,
    );
};

/** Every custom property name a line of text mentions. */
const tokenNamesOn = (line: string) =>
  [...line.matchAll(/--[\w-]+/g)].map((match) => match[0]);

const sectionNineTwoHexes = Object.values(designColors).map((hex) =>
  hex.replace(/^#/, "").toLowerCase(),
);

/**
 * The font tokens the document records: a line naming the token, `Inter`,
 * and the Japanese-capable family that token's stack falls back to.
 * @param tokens - The theme tokens.
 * @param documentLines - The design document, one entry per line.
 */
export const recordedFontStacks = (
  tokens: ThemeTokens,
  documentLines: readonly string[],
) =>
  japaneseCapableFontTokensOf(tokens).filter((token) => {
    const family = japaneseFamilyIn(token.families.slice(1));
    return (
      family !== undefined &&
      documentLines.some(
        (line) =>
          tokenNamesOn(line).includes(token.name) &&
          line.includes("Inter") &&
          line.includes(family),
      )
    );
  });

/**
 * The section 9.2 colors the document does not map to their token: no line
 * carries that hex, no other section 9.2 hex, and the name of a `--color-*`
 * token whose value is that hex.
 * @param tokens - The theme tokens.
 * @param documentLines - The design document, one entry per line.
 */
export const colorsNotMapped = (
  tokens: ThemeTokens,
  documentLines: readonly string[],
) => {
  const colorTokens = colorTokensOf(tokens);
  return Object.entries(designColors)
    .filter(([, hex]) => {
      const digits = hex.replace(/^#/, "").toLowerCase();
      return !documentLines.some((line) => {
        const lower = line.toLowerCase();
        const mentionsAnother = sectionNineTwoHexes.some(
          (other) => other !== digits && lower.includes(`#${other}`),
        );
        return (
          lower.includes(`#${digits}`) &&
          !mentionsAnother &&
          tokenNamesOn(line).some(
            (name) =>
              colorTokens.find((token) => token.name === name)?.hex === digits,
          )
        );
      });
    })
    .map(([role, hex]) => `${role} ${hex}`);
};

/**
 * The type-scale sizes the document does not map to their token: no line
 * carries the px value and the name of a `--text-*` token of that size.
 * @param tokens - The theme tokens.
 * @param documentLines - The design document, one entry per line.
 * @param scale - The sizes required.
 */
export const sizesNotMapped = (
  tokens: ThemeTokens,
  documentLines: readonly string[],
  scale: readonly TypeSize[],
) => {
  const textTokens = textSizeTokensOf(tokens);
  return scale
    .filter(
      (size) =>
        !documentLines.some(
          (line) =>
            new RegExp(String.raw`(?<![\d.])${size.fontSize}px`).test(line) &&
            tokenNamesOn(line).some((name) =>
              sameSize(
                textTokens.find((token) => token.name === name)?.fontSize,
                size.fontSize,
              ),
            ),
        ),
    )
    .map((size) => `${size.role} ${size.fontSize}px`);
};

/** One raw value found in a component source. */
export type RawValue = {
  readonly file: string;
  readonly line: number;
  readonly found: string;
  readonly why: string;
};

const tailwindPalette =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const colorUtilityPrefixes =
  "text|bg|border(?:-[trblxyse])?|ring|ring-offset|outline|fill|stroke|from|via|to|divide|decoration|placeholder|caret|accent|shadow|inset-shadow";

/**
 * Every way a raw color or a one-off type size appears in one component
 * source, comments excluded.
 *
 * - a hex color literal, or an `rgb()`/`hsl()`/`oklch()`-style color function;
 * - a Tailwind arbitrary text size or line height (`text-[17px]`,
 *   `leading-[28px]`), unless it only refers to a token (`[var(--…)]`);
 * - a Tailwind default-palette color (`text-gray-500`, `bg-white`), a default
 *   font size (`text-sm`), or a default line height (`leading-6`), unless the
 *   theme itself defines that name as a token — a default the theme does not
 *   define is not one of the section 9.2 values;
 * - `font-size` or `line-height` in a stylesheet, or a literal `fontSize` or
 *   `lineHeight` in a style object, unless the value is a `var(--…)`.
 * @param file - The path to report the findings under.
 * @param text - The file's contents.
 * @param tokens - The theme tokens, which decide which utility names exist.
 */
export const rawValuesIn = (
  file: string,
  text: string,
  tokens: ThemeTokens,
): RawValue[] => {
  const source = withoutComments(text);
  const findings: RawValue[] = [];

  const report = (
    pattern: RegExp,
    why: string,
    allowed?: (match: RegExpExecArray) => boolean,
  ) => {
    for (const match of source.matchAll(pattern)) {
      if (allowed?.(match)) continue;
      const line = source.slice(0, match.index).split("\n").length;
      findings.push({ file, line, found: match[0].trim(), why });
    }
  };

  report(
    /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g,
    "raw hex color",
  );
  report(/\b(?:rgba?|hsla?|oklch|oklab|hwb)\(/g, "raw color function");
  report(
    /\b(?:text|leading)-\[(?!(?:[a-z-]+:)?var\(--)[^\]]+\]/g,
    "one-off arbitrary text size or line height",
  );
  report(
    new RegExp(
      String.raw`\b(?:${colorUtilityPrefixes})-((?:${tailwindPalette})-\d{2,3}|black|white)\b`,
      "g",
    ),
    "Tailwind default color, not a section 9.2 token",
    (match) => tokens.has(`--color-${match[1]}`),
  );
  report(
    /\btext-(xs|sm|base|lg|xl|[2-9]xl)\b/g,
    "Tailwind default font size, not a section 9.2 token",
    (match) => tokens.has(`--text-${match[1]}`),
  );
  report(
    /\bleading-(none|tight|snug|normal|relaxed|loose|\d+(?:\.\d+)?)\b/g,
    "Tailwind default line height, not a section 9.2 token",
    (match) => tokens.has(`--leading-${match[1]}`),
  );
  if (file.endsWith(".css")) {
    report(
      // The look-ahead sits before the white space: after `\s*` it could be
      // satisfied by backtracking to zero spaces and reading " var(".
      /\b(?:font-size|line-height)\s*:(?!\s*var\(--)[^;]+;/g,
      "one-off size in a stylesheet",
    );
  } else {
    // A literal value only — a string that is not a var() reference, or a
    // number. A type annotation (`fontSize: number`) is not a value.
    report(
      /\b(?:fontSize|lineHeight)\s*:\s*(?:["'`](?!var\(--)[^"'`]*["'`]|\d[\d.]*)/g,
      "one-off size in a style object",
    );
  }

  return findings;
};
