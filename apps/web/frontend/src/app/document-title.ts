import { pageTitle, siteText } from "./site-text";

/**
 * The not-found screen's heading.
 *
 * Exported so NotFoundView's own `<h1>` and titleForPathname's guess below
 * read the same string, rather than two independent phrasings of "this
 * address doesn't exist" that could drift apart.
 */
export const notFoundHeading = "ページが見つかりません";

// The two paths app-router.tsx registers as real routes. Duplicated here as
// literals rather than imported from that module: it is a small, stable
// table, and importing the router module from this early-bootstrap path
// would pull the whole route tree in just to read two strings off it.
const GENERATOR_PATH = "/";
const PRIVACY_PATH = "/privacy";

/**
 * A best-effort document title for a URL path, computed synchronously and
 * without the router.
 *
 * Every screen already sets its own title once it mounts (useDocumentTitle),
 * and that call is what actually keeps the title correct, including across
 * every later client-side route change. This function exists only for the
 * one moment that mount has not happened yet: a direct navigation's `load`
 * event can fire before this application's asynchronous initial route match
 * commits -- reliably on WebKit, in the timing this repository's automated
 * test runs under -- and the acceptance test reads `document.title` once,
 * immediately after navigating, with no retry (AC-6 of Issue #16). Calling
 * this synchronously in main.tsx, before React ever mounts, closes that gap.
 * A path this function guesses wrong self-corrects the moment the matched
 * screen's own useDocumentTitle call runs a little later.
 * @param {string} pathname - The path to guess a title for, typically
 * `window.location.pathname`.
 */
export const titleForPathname = (pathname: string): string => {
  if (pathname === GENERATOR_PATH) return pageTitle();
  if (pathname === PRIVACY_PATH) return pageTitle(siteText.privacyLabel);
  return pageTitle(notFoundHeading);
};
