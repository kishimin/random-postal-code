import type { Address } from "@zipnami/shared";

const fullAddressText = (address: Address): string =>
  `${address.prefecture}${address.city}${address.town}`;

// Figma's labels for the two per-address controls (the address rows of the
// result frames). They repeat on every address, so each control's accessible
// name puts the address in front of them (ui-design.md sections 8 and 9.2).
const SELECT_MAP_TARGET_TEXT = "地図に表示";
const EXTERNAL_MAP_LINK_TEXT = "Google マップで開く";

/**
 * Japanese strings the maps feature shows (ui-design.md section 9: Japanese
 * display strings live in UI-owned resources; the MVP ships Japanese only).
 */
export const mapsText = {
  mapHeading: "地図",
  selectMapTargetText: SELECT_MAP_TARGET_TEXT,
  externalMapLinkText: EXTERNAL_MAP_LINK_TEXT,
  selectMapTargetLabel: (address: Address) =>
    `${fullAddressText(address)}を${SELECT_MAP_TARGET_TEXT}`,
  externalMapLinkLabel: (address: Address) =>
    `${fullAddressText(address)}を${EXTERNAL_MAP_LINK_TEXT}`,
  embedTitle: (address: Address) => `${fullAddressText(address)}の地図`,
  fallbackMessage: "地図を表示できませんでした。",
} as const;
