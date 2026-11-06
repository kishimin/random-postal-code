import type { Address } from "@zipnami/shared";
import {
  applicationCopy,
  openInGoogleMapsName,
  showOnMapName,
} from "./figma-copy.ts";

/*
 * What the Issue #8 acceptance test locates map behavior by: the exact names
 * from figma-copy.ts (approved on Issue #97).
 */
export const mapSelectors = {
  /*
   * The per-address control that makes that address the embedded map's target.
   *
   * ui-design.md section 8 asks for native `button`, `a`, and list semantics
   * before ARIA alternatives. Choosing which address the embedded map shows
   * changes the current page rather than navigating away from it, so the
   * control is a button, and the same section requires its accessible name to
   * carry address context -- which is why the name is built from the address.
   */
  selectMapTarget: (address: Address) => showOnMapName(address),

  /*
   * The per-address link that hands the visitor off to Google Maps. Where it
   * goes is still asserted from its `href`; the name is how it is found.
   */
  externalMapLink: (address: Address) => openInGoogleMapsName(address),

  // The embedded map's region, named by its heading.
  mapRegion: applicationCopy.mapHeading,
} as const;

/*
 * Where an external map link has to lead: a Google host.
 *
 * The links are found by their exact names, and this narrows them to the ones
 * whose `href` points at Google. A name alone would also accept a link that
 * hands the visitor to another map service, which the Issue #8 criterion of an
 * external Google Maps link rules out. The rewrite approved on Issue #97 kept
 * what each test checks, so this host check stays alongside the exact name.
 */
export const externalMapHostSelector = 'a[href*="google."]';

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
