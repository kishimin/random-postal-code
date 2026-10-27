import type { Address } from "@zipnami/shared";

/**
 * The full address text a map query should name (ui-design.md section 5.3:
 * "an encoded full-address query"). Concatenated rather than joined with a
 * separator, matching how AddressList already displays the same three
 * fields. Exported so the map failure fallback can show the same text a
 * query would have named.
 */
export const fullAddressText = (address: Address): string =>
  `${address.prefecture}${address.city}${address.town}`;

/**
 * The Google Maps Embed API URL for showing `address` in an `<iframe>`.
 *
 * `place` mode takes a free-text `q` query rather than resolved coordinates,
 * which is what design.md section 4 gives this Issue: prefecture, city, and
 * town text, not a geocoded point.
 * @param {Address} address - The address the embedded map should show.
 * @param {string} apiKey - The Web Maps API key (design.md section 7). May
 * be empty; the caller decides whether an empty key is a usable request.
 */
export const buildEmbedSrc = (address: Address, apiKey: string): string => {
  const url = new URL("https://www.google.com/maps/embed/v1/place");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", fullAddressText(address));
  return url.toString();
};

/**
 * The external Google Maps link for `address` (ui-design.md section 5.3:
 * "a clearly named external Google Maps link with an encoded full-address
 * query"). `URLSearchParams` percent-encodes the query, so the address text
 * never appears literally in the returned string.
 * @param {Address} address - The address the link should open.
 */
export const buildExternalMapHref = (address: Address): string => {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", fullAddressText(address));
  return url.toString();
};
