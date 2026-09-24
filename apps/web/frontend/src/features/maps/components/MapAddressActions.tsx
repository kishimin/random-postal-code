import type { Address } from "@zipnami/shared";
import { buildExternalMapHref } from "../lib/map-url";
import { mapsText } from "../site-text";

type MapAddressActionsProps = {
  address: Address;
  isSelected: boolean;
  onSelect: () => void;
};

/**
 * One address's map actions, rendered inside that address's own list entry
 * (ui-design.md section 5.3 and section 8's per-address accessible name
 * requirement): the button that makes it the embedded map's target, and the
 * external Google Maps link every address carries regardless of selection.
 */
export const MapAddressActions = ({
  address,
  isSelected,
  onSelect,
}: MapAddressActionsProps) => (
  <>
    <button
      type={"button"}
      aria-pressed={isSelected}
      onClick={onSelect}
    >
      {mapsText.selectMapTargetLabel(address)}
    </button>
    <a href={buildExternalMapHref(address)} target={"_blank"} rel={"noreferrer"}>
      {mapsText.externalMapLinkLabel(address)}
    </a>
  </>
);
