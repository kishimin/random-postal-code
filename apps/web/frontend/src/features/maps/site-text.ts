import type { Address } from "@zipnami/shared";

const fullAddressText = (address: Address): string =>
  `${address.prefecture}${address.city}${address.town}`;

/**
 * Japanese strings the maps feature shows (ui-design.md section 9: Japanese
 * display strings live in UI-owned resources; the MVP ships Japanese only).
 */
export const mapsText = {
  mapHeading: "地図",
  // acceptance/selectors/map-selectors.ts matches this control by /地図/, and
  // ui-design.md section 8 asks every address map action for a unique
  // accessible name carrying address context.
  selectMapTargetLabel: (address: Address) =>
    `${fullAddressText(address)}を地図に表示`,
  externalMapLinkLabel: (address: Address) =>
    `${fullAddressText(address)}をGoogleマップで開く`,
  embedTitle: (address: Address) => `${fullAddressText(address)}の地図`,
  fallbackMessage: "地図を表示できませんでした。",
} as const;
