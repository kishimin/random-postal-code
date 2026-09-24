/*
 * What the Issue #8 acceptance test locates map behavior by.
 *
 * ui-design.md section 9 keeps Japanese display strings in UI-owned resources
 * and the MVP ships Japanese only, so each expression below fixes only the word
 * a visitor recognises the control by, not the sentence around it. Holding them
 * here rather than in the Page Object keeps a copy change to one edit
 * (ADR-0054).
 */
export const mapSelectors = {
  /*
   * The per-address control that makes that address the embedded map's target.
   *
   * ui-design.md section 8 asks for native `button`, `a`, and list semantics
   * before ARIA alternatives. Choosing which address the embedded map shows
   * changes the current page rather than navigating away from it, so the
   * control is a button, and the same section requires its accessible name to
   * carry address context — which is why the Page Object scopes this pattern to
   * one address entry instead of matching it page-wide.
   */
  selectMapTarget: /地図/,
} as const;

/*
 * A link that hands the visitor off to Google Maps.
 *
 * Matched on where it goes rather than on how it reads: the criterion it serves
 * is about the URL the visitor receives, so the locator and the assertion about
 * it stay the same fact. Google publishes more than one shape for this URL
 * (`/maps/search/?api=1&query=` and `maps.google.com/?q=` among them) and no
 * repository contract picks one, so only the host family is fixed here.
 */
export const externalMapLinkSelector = 'a[href*="google."]';

/*
 * Every request the embedded map makes to Google.
 *
 * The acceptance test answers these itself. design.md section 7 calls Maps an
 * optional dependency, and a test that let real requests out would measure
 * Google's availability, its billing state, and the key the build happened to
 * carry, none of which is what Issue #8 asks for. The pattern covers both the
 * Maps Embed API host (`www.google.com/maps/embed/v1/...`) and the older
 * `maps.google.com/maps?...` form, so no shape of map request escapes.
 */
export const googleMapsRequestPattern =
  /^https:\/\/(?:[\w-]+\.)*google\.[\w.]+\/maps(?:[/?]|$)/;

/**
 * The address a Google Maps URL asks to be shown, decoded.
 *
 * Returns an empty string for a URL that carries no address query, so a caller
 * asserting on the address never has to distinguish "absent" from "malformed" —
 * both are simply not the address.
 * @param url - A Google Maps URL, as requested or as written in an `href`.
 */
export const mapAddressQuery = (url: string): string => {
  try {
    const { searchParams } = new URL(url);
    return searchParams.get("q") ?? searchParams.get("query") ?? "";
  } catch {
    return "";
  }
};
