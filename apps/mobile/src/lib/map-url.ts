import type { Address } from "@zipnami/shared";

/**
 * The full address text a map query names and a link is called after
 * (ui-design.md section 5.3). The three fields are concatenated, as the
 * Web client does, so both clients show and search the same text.
 * @param {Address} address - The address to name.
 */
export const fullAddressText = (address: Address): string =>
  `${address.prefecture}${address.city}${address.town}`;

/**
 * The external Google Maps search link for an address. The Web client's
 * (apps/web/frontend/src/features/maps/lib/map-url.ts) is the precedent.
 * The query is percent-encoded by hand: React Native's URL does not
 * implement `searchParams` on every version, so a `URL` built here would
 * pass under Node and throw on a device.
 * @param {Address} address - The address the link should open.
 */
export const buildExternalMapHref = (address: Address): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    fullAddressText(address),
  )}`;
