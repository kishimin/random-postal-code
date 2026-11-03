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
      className={
        "inline-flex min-h-11 items-center rounded-full border border-card-border bg-card px-4 text-caption font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-pressed:border-brand"
      }
      onClick={onSelect}
    >
      {mapsText.selectMapTargetLabel(address)}
    </button>
    <a
      className={"inline-flex min-h-11 items-center text-caption underline"}
      href={buildExternalMapHref(address)}
      target={"_blank"}
      rel={"noreferrer"}
    >
      {mapsText.externalMapLinkLabel(address)}
    </a>
  </>
);
