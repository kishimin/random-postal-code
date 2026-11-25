/*
 * The address crawlers are told the site lives at (docs/design.md section
 * 6.2). A fixed constant rather than the origin a build is served from: a
 * preview or a branch deployment must still name the production address in its
 * canonical links, or search engines would index the copy.
 */
export const PRODUCTION_ORIGIN = "https://zipnami.pages.dev";

/**
 * The absolute production URL of a route, as a canonical link or a sitemap
 * entry carries it. The root keeps its slash, so the home page has one address.
 * @param {string} path - The route, starting with a slash.
 */
export const canonicalUrlOf = (path: string): string =>
  `${PRODUCTION_ORIGIN}${path}`;
