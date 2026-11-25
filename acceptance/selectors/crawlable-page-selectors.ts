import { figmaCopy } from "./figma-copy.ts";
import { guideSelectors, guides } from "./guide-selectors.ts";

/*
 * What the Issue #169 acceptance tests locate the crawlable content pages by.
 *
 * The routes are ui-design.md section 3.1's first table, which the Issue's
 * acceptance criteria list by path. Each page's name is the string an
 * existing acceptance test already finds its h1 by, so this file adds no copy
 * of its own: the guide names come from guide-selectors.ts (ui-design.md
 * section 5.5), the generator's headline and the privacy heading from
 * figma-copy.ts (Issue #97).
 */

/** Which screen a content route shows, so a test knows how to read it. */
export type ContentScreen = "generator" | "guide" | "privacy";

/** One content route: where it is, what it shows, and the title it carries. */
export type ContentRoute = {
  readonly path: string;
  readonly screen: ContentScreen;
  /** The page's h1. For the generator, Figma's desktop and tablet headline. */
  readonly name: string;
  /** The document title pageTitle builds (ui-design.md section 9.2). */
  readonly title: string;
};

/*
 * The production origin canonical URLs and sitemap entries are written on
 * (docs/design.md section 6.2). A fixed constant rather than the origin the
 * test runs on: a crawler must be told the production address even by a
 * build served from somewhere else.
 */
export const productionOrigin = "https://zipnami.pages.dev";

/**
 * The absolute production URL of a route, as a canonical link or a sitemap
 * entry carries it. The root is written with its slash.
 * @param path - The route, starting with a slash.
 */
export const productionUrlOf = (path: string) => `${productionOrigin}${path}`;

export const sitemapUrl = productionUrlOf("/sitemap.xml");

/*
 * The seven content routes, in ui-design.md section 3.1's order with the
 * guides in the footer's order.
 */
export const contentRoutes: readonly ContentRoute[] = [
  {
    path: "/",
    screen: "generator",
    name: figmaCopy.startHeadline.regular,
    // The generator is the product's home screen and carries the bare name.
    title: "Zipnami",
  },
  ...guides.map((guide): ContentRoute => ({
    path: guide.path,
    screen: "guide",
    name: guide.name,
    title: `${guide.name}${guideSelectors.titleSuffix}`,
  })),
  {
    path: "/privacy",
    screen: "privacy",
    name: figmaCopy.privacyHeading,
    title: `${figmaCopy.privacyHeading}${guideSelectors.titleSuffix}`,
  },
];

/*
 * The unknown path the Issue names. Written as a literal so the test states
 * what it requests rather than computing it.
 */
export const unknownContentPath = "/nonexistent";

/*
 * The AdSense loader, as an HTML file would reference it. The same script
 * advertising-selectors.ts's advertisingScriptPattern matches at the network
 * boundary.
 */
export const adSenseLoaderReference =
  /pagead2\.googlesyndication\.com|adsbygoogle\.js/i;
