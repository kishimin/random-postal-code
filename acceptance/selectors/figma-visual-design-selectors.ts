import { figmaCopy } from "./figma-copy.ts";

/*
 * What the Issue #97 acceptance tests expect of the Figma visual design.
 *
 * Every value below was read from the Figma file `40UjUstDqllFYEaQ31J8L0`
 * through its API (node data, not screenshots) on 2026-11-03, and each entry
 * names the node it came from, so a reader can check a value against the
 * design without trusting this file. ui-design.md section 9.2 records the
 * colors and the representative type sizes; the per-screen copy is left to the
 * Figma nodes (section 9.2, "Copy"), which is why it is transcribed here, in
 * the test, rather than in the document.
 *
 * Holding the values here rather than in the tests keeps one edit per design
 * change (ADR-0054).
 */

/**
 * The twelve colors ui-design.md section 9.2 fixes, keyed by the role that
 * section gives each one. Re-read from Figma on 2026-11-05: the brand accent
 * changed from `#148CC7` to `#0F6E9E` to meet AA, and the advertising slot
 * gained its own surface (approved on Issue #97).
 */
export const designColors = {
  pageSurface: "#FAFBFA",
  cardSurface: "#FFFFFF",
  textPrimary: "#091F33",
  textSecondary: "#526B78",
  brandAccent: "#0F6E9E",
  accentSurface: "#E5F7F7",
  errorText: "#CC292E",
  errorSurface: "#FFF0F0",
  addressCardBorder: "#D1E3E5",
  mapPanelSurface: "#E8EDE3",
  mapPin: "#E04D40",
  adSurface: "#F5F5F0",
} as const;

/** One size of the section 9.2 type scale, in CSS pixels. */
export type TypeSize = {
  readonly role: string;
  readonly fontSize: number;
  readonly lineHeight?: number;
};

/*
 * The section 9.2 type scale.
 *
 * "Eyebrow label 11-13px (mobile 11px, desktop 13px)" and "footer/caption
 * 11-12px" are ranges in the document; the end points are the sizes the Figma
 * nodes actually use (eyebrow #2:6 13px and #6:5 11px; footer #2:14 12px and
 * #27:111 11px), so those are the sizes a token has to exist for. 11px serves
 * both the mobile eyebrow and the smallest caption, so it is listed once.
 */
const desktopDisplay: TypeSize = {
  role: "desktop display headline",
  fontSize: 52,
  lineHeight: 68,
};
const desktopBody: TypeSize = {
  role: "desktop body",
  fontSize: 17,
  lineHeight: 28,
};
const mobileDisplay: TypeSize = {
  role: "mobile display headline",
  fontSize: 34,
  lineHeight: 46,
};
const mobileBody: TypeSize = {
  role: "mobile body",
  fontSize: 14,
  lineHeight: 22,
};

export const typeScale: readonly TypeSize[] = [
  desktopDisplay,
  desktopBody,
  mobileDisplay,
  mobileBody,
  { role: "button label", fontSize: 16 },
  { role: "desktop eyebrow label", fontSize: 13 },
  { role: "footer/caption", fontSize: 12 },
  { role: "mobile eyebrow label and smallest caption", fontSize: 11 },
];

/*
 * Families known to carry Japanese glyphs.
 *
 * ui-design.md section 9.2 notes that `Inter` has none and that Figma names no
 * fallback, so Issue #97 has to choose one. Which one is the implementation's
 * decision; this list only recognises that a choice was made. It covers the
 * families every major platform ships (Hiragino on Apple platforms, Yu Gothic
 * and Meiryo on Windows, Noto Sans CJK JP on Android and Linux) and the
 * Japanese web fonts in common use.
 */
export const japaneseCapableFamilies: readonly string[] = [
  "Noto Sans JP",
  "Noto Sans CJK JP",
  "Hiragino Sans",
  "Hiragino Kaku Gothic ProN",
  "Hiragino Kaku Gothic Pro",
  "ヒラギノ角ゴシック",
  "ヒラギノ角ゴ ProN",
  "Yu Gothic",
  "YuGothic",
  "Yu Gothic UI",
  "游ゴシック",
  "游ゴシック体",
  "Meiryo",
  "メイリオ",
  "BIZ UDPGothic",
  "BIZ UDGothic",
  "M PLUS 1p",
  "M PLUS 1",
  "M PLUS 2",
  "Zen Kaku Gothic New",
  "Zen Maru Gothic",
  "Source Han Sans JP",
  "IBM Plex Sans JP",
  "LINE Seed JP",
  "Murecho",
  "Sawarabi Gothic",
  "Kosugi",
  "MS PGothic",
  "Osaka",
];

/** The literal strings section 9.2 fixes on every screen. */
export const fixedCopy = {
  wordmark: figmaCopy.wordmark,
  footer: figmaCopy.copyright,
} as const;

/** The viewport widths the Issue names for each Figma frame. */
export const designViewports = {
  desktop: { name: "desktop 1440px", width: 1440, height: 1024 },
  tablet: { name: "tablet 768px", width: 768, height: 1024 },
  mobile: { name: "mobile 390px", width: 390, height: 844 },
} as const;

/** How a screen is reached in the running application. */
export type ScreenState = "start" | "result" | "api-error" | "not-found";

/** One text a screen shows, with the Figma node it was read from. */
export type DesignText = {
  readonly node: string;
  readonly text: string;
  // Only where the Figma node uses a section 9.2 representative size. The
  // other headline sizes (the result's 36px, the 404's 30px, and so on) are
  // held by the human screenshot comparison the Issue requires, not here:
  // the criterion names "the section 9.2 sizes".
  readonly size?: TypeSize;
};

/** One MVP screen of ui-design.md section 9.1, as this test reaches it. */
export type DesignScreen = {
  readonly row: string;
  readonly label: string;
  readonly node: string;
  readonly state: ScreenState;
  readonly viewport: (typeof designViewports)[keyof typeof designViewports];
  // Primary-text copy (Figma fill #091F33) and secondary-text copy (Figma
  // fill #526B78). A screen can carry more than one pair: the API error
  // frames keep the start screen's headline and body behind the error panel.
  readonly headlines: readonly DesignText[];
  readonly bodies: readonly DesignText[];
};

// The copy lives in figma-copy.ts, with the node of each string. The tests
// compare copy with all white space removed, so where a Figma line break
// falls (a <br>, a block, or a wrap) is the layout's choice, not the copy's.
const startHeadlineDesktop = figmaCopy.startHeadline.regular;
const startBodyDesktop = figmaCopy.startBody.wide;
const startHeadlineMobile = figmaCopy.startHeadline.compact;
const startBodyMobile = figmaCopy.startBody.compact;
const apiErrorHeadline = figmaCopy.apiErrorHeading;
const apiErrorBody = figmaCopy.apiErrorBody;
const notFoundHeadline = figmaCopy.notFoundHeading;
const notFoundBody = figmaCopy.notFoundBody;

/*
 * The postal code every Figma result frame shows (#2:23, #4:18, #6:19), with
 * the three addresses #2:27, #2:29, and #2:31 list. Stubbing the endpoint with
 * exactly this result is what lets the result copy — which carries the
 * address count — be compared with the frame literally.
 */
export const figmaResult = {
  postalCode: "9012223",
  addresses: [
    { prefecture: "沖縄県", city: "宜野湾市", town: "大山1丁目" },
    { prefecture: "沖縄県", city: "宜野湾市", town: "大山2丁目" },
    { prefecture: "沖縄県", city: "宜野湾市", town: "大山3丁目" },
  ],
};

/*
 * ui-design.md section 9.1 rows 01-06 and 11-14.
 *
 * Rows 15 and 16 (Global Error) are not here: a browser cannot be driven to
 * the render failure that reaches that screen (ui-design.md section 10), so
 * no acceptance test can open it. Rows 07-10 are the Issue's Out of scope.
 * Figma draws no tablet frame for the API error and 404 screens, so those are
 * verified at desktop and mobile only.
 */
export const designScreens: readonly DesignScreen[] = [
  {
    row: "01",
    label: "Web / Desktop / Start",
    node: "11:2",
    state: "start",
    viewport: designViewports.desktop,
    headlines: [
      { node: "2:7", text: startHeadlineDesktop, size: desktopDisplay },
    ],
    bodies: [{ node: "2:8", text: startBodyDesktop, size: desktopBody }],
  },
  {
    row: "02",
    label: "Web / Desktop / Result",
    node: "11:3",
    state: "result",
    viewport: designViewports.desktop,
    headlines: [{ node: "2:20", text: figmaCopy.resultHeading }],
    bodies: [{ node: "2:25", text: "この郵便番号に対応する住所 3件" }],
  },
  {
    row: "03",
    label: "Web / Tablet / Start",
    node: "11:4",
    state: "start",
    viewport: designViewports.tablet,
    headlines: [{ node: "4:5", text: startHeadlineDesktop }],
    bodies: [
      {
        node: "4:6",
        text: figmaCopy.startBody.regular,
      },
    ],
  },
  {
    row: "04",
    label: "Web / Tablet / Result",
    node: "11:5",
    state: "result",
    viewport: designViewports.tablet,
    headlines: [{ node: "4:16", text: figmaCopy.resultHeading }],
    bodies: [{ node: "4:20", text: "対応する住所 3件" }],
  },
  {
    row: "05",
    label: "Web / Mobile / Start",
    node: "11:6",
    state: "start",
    viewport: designViewports.mobile,
    headlines: [
      { node: "6:6", text: startHeadlineMobile, size: mobileDisplay },
    ],
    bodies: [{ node: "6:7", text: startBodyMobile, size: mobileBody }],
  },
  {
    row: "06",
    label: "Web / Mobile / Result",
    node: "11:7",
    state: "result",
    viewport: designViewports.mobile,
    // The mobile result frame shows no "波が運んできた場所"; its headline is the
    // postal code itself, at the mobile display size (34px; Figma gives this
    // node no line height, so none is required).
    headlines: [
      {
        node: "6:19",
        text: "〒901-2223",
        size: { role: "mobile display headline", fontSize: 34 },
      },
    ],
    bodies: [{ node: "6:21", text: "対応する住所 3件" }],
  },
  {
    row: "11",
    label: "Web / Desktop / API Error",
    node: "27:72",
    state: "api-error",
    viewport: designViewports.desktop,
    headlines: [
      { node: "27:64", text: startHeadlineDesktop, size: desktopDisplay },
      { node: "27:75", text: apiErrorHeadline },
    ],
    bodies: [
      { node: "27:65", text: startBodyDesktop, size: desktopBody },
      { node: "27:76", text: apiErrorBody },
    ],
  },
  {
    row: "12",
    label: "Web / Mobile / API Error",
    node: "27:93",
    state: "api-error",
    viewport: designViewports.mobile,
    headlines: [
      { node: "27:84", text: startHeadlineMobile, size: mobileDisplay },
      { node: "27:96", text: apiErrorHeadline },
    ],
    bodies: [
      { node: "27:85", text: startBodyMobile, size: mobileBody },
      { node: "27:97", text: apiErrorBody },
    ],
  },
  {
    row: "13",
    label: "404 / Desktop",
    node: "27:100",
    state: "not-found",
    viewport: designViewports.desktop,
    headlines: [{ node: "27:107", text: notFoundHeadline }],
    bodies: [{ node: "27:108", text: notFoundBody }],
  },
  {
    row: "14",
    label: "404 / Mobile",
    node: "27:112",
    state: "not-found",
    viewport: designViewports.mobile,
    headlines: [{ node: "27:118", text: notFoundHeadline }],
    bodies: [{ node: "27:119", text: notFoundBody }],
  },
];
